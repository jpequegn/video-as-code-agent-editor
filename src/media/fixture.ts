import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { MediaError } from "./errors.js";

export async function generateSyntheticFixture(outputPath: string): Promise<string> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=640x360:rate=30:duration=3",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:sample_rate=48000:duration=3",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    outputPath
  ];
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (result.error) {
    throw new MediaError(`ffmpeg is unavailable: ${result.error.message}`, "TOOL_UNAVAILABLE");
  }
  if (result.status !== 0) {
    throw new MediaError(result.stderr.trim() || "fixture generation failed", "PROBE_FAILED");
  }

  const transcriptPath = `${outputPath}.transcript.json`;
  await writeFile(
    transcriptPath,
    `${JSON.stringify(
      [
        { startSeconds: 0.2, endSeconds: 1.3, text: "A deterministic opening line." },
        { startSeconds: 1.5, endSeconds: 2.8, text: "A second line for edit planning." }
      ],
      null,
      2
    )}\n`
  );
  return transcriptPath;
}
