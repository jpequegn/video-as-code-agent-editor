import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { sha256 } from "../lib/canonical-json.js";
import { MediaError } from "../media/errors.js";
import { parseProbeDocument } from "../media/ffprobe.js";
import { qaObservationsSchema, type QaObservations } from "./schema.js";

function run(command: string, args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error)
    throw new MediaError(`${command} is unavailable: ${result.error.message}`, "TOOL_UNAVAILABLE");
  return { stdout: result.stdout, stderr: result.stderr, status: result.status ?? -1 };
}

export function parseBlackSegments(
  raw: string
): Array<{ startSeconds: number; endSeconds: number; durationSeconds: number }> {
  return [
    ...raw.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)
  ].map((match) => ({
    startSeconds: Number(match[1]),
    endSeconds: Number(match[2]),
    durationSeconds: Number(match[3])
  }));
}

export function parseSilenceSegments(raw: string, mediaDuration: number) {
  const starts = [...raw.matchAll(/silence_start:\s*([\d.]+)/g)].map((match) => Number(match[1]));
  const ends = [
    ...raw.matchAll(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g)
  ].map((match) => ({
    endSeconds: Number(match[1]),
    durationSeconds: Number(match[2])
  }));
  return starts.map((startSeconds, index) => {
    const matched = ends[index];
    const endSeconds = matched?.endSeconds ?? mediaDuration;
    return {
      startSeconds,
      endSeconds,
      durationSeconds: matched?.durationSeconds ?? endSeconds - startSeconds
    };
  });
}

export function parsePeakDb(raw: string): number | null {
  const match = /max_volume:\s*(-?[\d.]+) dB/.exec(raw);
  return match ? Number(match[1]) : null;
}

export async function collectQaObservations(
  mediaPath: string,
  options?: {
    blackMinimumSeconds?: number;
    blackPictureRatio?: number;
    silenceMinimumSeconds?: number;
    silenceNoiseDb?: number;
  }
): Promise<QaObservations> {
  const probeArgs = [
    "-v",
    "error",
    "-show_entries",
    "format=duration,format_name:stream=codec_type,codec_name,width,height,avg_frame_rate,channels,sample_rate",
    "-of",
    "json",
    mediaPath
  ];
  const probeRun = run("ffprobe", probeArgs);
  if (probeRun.status !== 0)
    throw new MediaError(probeRun.stderr || "ffprobe failed", "PROBE_FAILED");
  const probe = parseProbeDocument(probeRun.stdout);
  const blackArgs = [
    "-nostdin",
    "-v",
    "info",
    "-i",
    mediaPath,
    "-vf",
    `blackdetect=d=${options?.blackMinimumSeconds ?? 0.2}:pic_th=${options?.blackPictureRatio ?? 0.98}`,
    "-an",
    "-f",
    "null",
    "-"
  ];
  const blackRun = run("ffmpeg", blackArgs);
  const silenceArgs = [
    "-nostdin",
    "-v",
    "info",
    "-i",
    mediaPath,
    "-af",
    `silencedetect=n=${options?.silenceNoiseDb ?? -50}dB:d=${options?.silenceMinimumSeconds ?? 0.2}`,
    "-f",
    "null",
    "-"
  ];
  const silenceRun = run("ffmpeg", silenceArgs);
  const volumeArgs = [
    "-nostdin",
    "-v",
    "info",
    "-i",
    mediaPath,
    "-af",
    "volumedetect",
    "-f",
    "null",
    "-"
  ];
  const volumeRun = run("ffmpeg", volumeArgs);
  const versionRun = run("ffmpeg", ["-version"]);
  const document = JSON.parse(probeRun.stdout) as { streams?: Array<{ codec_type?: string }> };
  const video = document.streams?.find((stream) => stream.codec_type === "video");
  const audio = document.streams?.find((stream) => stream.codec_type === "audio");
  return qaObservationsSchema.parse({
    schemaVersion: 1,
    mediaHash: sha256(await readFile(mediaPath)),
    toolVersion: versionRun.stdout.split("\n")[0] ?? "ffmpeg unknown",
    probe: {
      durationSeconds: probe.durationSeconds,
      width: probe.video.width,
      height: probe.video.height,
      hasVideo: Boolean(video),
      hasAudio: Boolean(audio),
      rawHash: sha256(probeRun.stdout),
      command: probeArgs
    },
    blackSegments: parseBlackSegments(blackRun.stderr),
    silenceSegments: parseSilenceSegments(silenceRun.stderr, probe.durationSeconds),
    audioPeakDb: parsePeakDb(volumeRun.stderr),
    detectors: [
      {
        name: "blackdetect",
        command: blackArgs,
        rawHash: sha256(blackRun.stderr),
        exitCode: blackRun.status
      },
      {
        name: "silencedetect",
        command: silenceArgs,
        rawHash: sha256(silenceRun.stderr),
        exitCode: silenceRun.status
      },
      {
        name: "volumedetect",
        command: volumeArgs,
        rawHash: sha256(volumeRun.stderr),
        exitCode: volumeRun.status
      }
    ]
  });
}
