import { spawnSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

function make(
  output: string,
  videoSource: string,
  audioSource: string,
  audioFilter?: string
): void {
  const args = ["-y", "-f", "lavfi", "-i", videoSource, "-f", "lavfi", "-i", audioSource];
  if (audioFilter) args.push("-af", audioFilter);
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", output);
  const result = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr.trim() || "QA fixture generation failed");
}

export async function generateQaFixtures(
  root: string
): Promise<Record<"good" | "black" | "silent" | "peak", string>> {
  await mkdir(root, { recursive: true });
  const paths = {
    good: path.join(root, "good.mp4"),
    black: path.join(root, "black.mp4"),
    silent: path.join(root, "silent.mp4"),
    peak: path.join(root, "peak.mp4")
  };
  const motion = "testsrc2=size=320x180:rate=30:duration=1";
  const tone = "sine=frequency=440:sample_rate=48000:duration=1";
  make(paths.good, motion, tone);
  make(paths.black, "color=c=black:size=320x180:rate=30:duration=1", tone);
  make(paths.silent, motion, "anullsrc=channel_layout=mono:sample_rate=48000", undefined);
  make(paths.peak, motion, tone, "volume=30dB");
  return paths;
}
