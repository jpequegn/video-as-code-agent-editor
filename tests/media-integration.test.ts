import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { generateSyntheticFixture } from "../src/media/fixture.js";
import { buildMediaManifest } from "../src/media/manifest.js";

describe("media manifest integration", () => {
  it("generates, probes, and stores a reproducible fixture", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vace-media-"));
    const mediaPath = path.join(root, "fixture.mp4");
    const transcriptPath = await generateSyntheticFixture(mediaPath);
    const options = { sourcePath: mediaPath, transcriptPath, storeRoot: path.join(root, ".vace") };
    const first = await buildMediaManifest(options);
    const second = await buildMediaManifest(options);
    expect(second).toEqual(first);
    expect(first.video).toMatchObject({ width: 640, height: 360 });
    expect(first.audio?.sampleRate).toBe(48000);
    expect(first.transcript).toHaveLength(2);
  });

  it("rejects malformed media", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vace-bad-media-"));
    const sourcePath = path.join(root, "bad.mp4");
    await writeFile(sourcePath, "not media");
    await expect(
      buildMediaManifest({ sourcePath, storeRoot: path.join(root, ".vace") })
    ).rejects.toMatchObject({
      code: "PROBE_FAILED"
    });
  });
});
