import { spawnSync } from "node:child_process";

import { MediaError } from "./errors.js";

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  channels?: number;
  sample_rate?: string;
}

interface ProbeDocument {
  format?: { duration?: string; format_name?: string };
  streams?: ProbeStream[];
}

export interface ProbeResult {
  container: string;
  durationSeconds: number;
  video: {
    codec: string;
    width: number;
    height: number;
    frameRate: { numerator: number; denominator: number };
  };
  audio: { codec: string; channels: number; sampleRate: number } | null;
  raw: string;
  version: string;
  command: string[];
}

export function parseRational(value: string): { numerator: number; denominator: number } {
  const match = /^(\d+)\/(\d+)$/.exec(value);
  if (!match) {
    throw new MediaError(`Invalid frame rate: ${value}`, "INVALID_MEDIA");
  }
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (numerator <= 0 || denominator <= 0) {
    throw new MediaError(`Invalid frame rate: ${value}`, "INVALID_MEDIA");
  }
  return { numerator, denominator };
}

export function parseProbeDocument(raw: string): Omit<ProbeResult, "raw" | "version" | "command"> {
  let document: ProbeDocument;
  try {
    document = JSON.parse(raw) as ProbeDocument;
  } catch {
    throw new MediaError("ffprobe returned invalid JSON", "PROBE_FAILED");
  }

  const durationSeconds = Number(document.format?.duration);
  const video = document.streams?.find((stream) => stream.codec_type === "video");
  const audio = document.streams?.find((stream) => stream.codec_type === "audio");
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !video?.codec_name ||
    !video.width ||
    !video.height ||
    !video.avg_frame_rate ||
    !document.format?.format_name
  ) {
    throw new MediaError(
      "Media is missing a supported video stream or duration",
      "UNSUPPORTED_MEDIA"
    );
  }

  return {
    container: document.format.format_name,
    durationSeconds,
    video: {
      codec: video.codec_name,
      width: video.width,
      height: video.height,
      frameRate: parseRational(video.avg_frame_rate)
    },
    audio:
      audio?.codec_name && audio.channels && audio.sample_rate
        ? {
            codec: audio.codec_name,
            channels: audio.channels,
            sampleRate: Number(audio.sample_rate)
          }
        : null
  };
}

export function probeMedia(mediaPath: string): ProbeResult {
  const command = [
    "-v",
    "error",
    "-show_entries",
    "format=duration,format_name:stream=codec_type,codec_name,width,height,avg_frame_rate,channels,sample_rate",
    "-of",
    "json",
    mediaPath
  ];
  const result = spawnSync("ffprobe", command, { encoding: "utf8" });
  if (result.error) {
    throw new MediaError(`ffprobe is unavailable: ${result.error.message}`, "TOOL_UNAVAILABLE");
  }
  if (result.status !== 0) {
    throw new MediaError(result.stderr.trim() || "ffprobe failed", "PROBE_FAILED");
  }

  const versionResult = spawnSync("ffprobe", ["-version"], { encoding: "utf8" });
  const version = versionResult.stdout.split("\n")[0] ?? "ffprobe unknown";
  return { ...parseProbeDocument(result.stdout), raw: result.stdout, version, command };
}
