import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { compileComposition } from "../src/composition/compiler.js";
import { ContentStore } from "../src/media/content-store.js";
import type { MediaManifest } from "../src/media/schema.js";
import { createDecision } from "../src/plan/decisions.js";
import { draftPlan } from "../src/plan/draft.js";

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), "vace-compile-"));
  const sourcePath = path.join(root, "source.mp4");
  await writeFile(sourcePath, "video-bytes");
  const storeRoot = path.join(root, ".vace");
  const source = await new ContentStore(storeRoot).ingest(sourcePath);
  const media: MediaManifest = {
    schemaVersion: 1,
    manifestId: "a".repeat(64),
    assetId: source.digest,
    source,
    container: "mp4",
    durationSeconds: 3,
    video: { codec: "h264", width: 640, height: 360, frameRate: { numerator: 30, denominator: 1 } },
    audio: null,
    transcript: [{ startSeconds: 0, endSeconds: 3, text: "A complete take" }],
    scenes: [],
    provenance: [{ tool: "test", version: "1", command: [], outputHash: "b".repeat(64) }]
  };
  const plan = draftPlan(media, { title: "Compiled", brief: "Keep the take" });
  const decision = createDecision({
    action: "approved",
    targetPlanId: plan.planId,
    actor: "reviewer@example.test",
    timestamp: "2026-08-24T12:00:00.000Z",
    reason: "Reviewed"
  });
  const paths = {
    storeRoot,
    artifactRoot: path.join(root, "artifacts"),
    publicRoot: path.join(root, "public")
  };
  return { media, plan, decision, paths };
}

describe("composition compiler", () => {
  it("emits byte-stable manifests and hash-addressed assets", async () => {
    const { media, plan, decision, paths } = await setup();
    const first = await compileComposition({ plan, media, decisions: [decision], ...paths });
    const second = await compileComposition({ plan, media, decisions: [decision], ...paths });
    expect(second.manifest).toEqual(first.manifest);
    expect(first.manifest.video.durationInFrames).toBe(90);
    expect(first.manifest.asset.publicPath).toBe(`assets/${media.assetId}.mp4`);
  });

  it("requires approval for the exact plan", async () => {
    const { media, plan, paths } = await setup();
    await expect(compileComposition({ plan, media, decisions: [], ...paths })).rejects.toThrow(
      "is not approved"
    );
  });

  it("fails before render when the object is missing", async () => {
    const { media, plan, decision, paths } = await setup();
    await expect(
      compileComposition({
        plan,
        media,
        decisions: [decision],
        ...paths,
        storeRoot: path.join(paths.storeRoot, "missing")
      })
    ).rejects.toThrow("Missing source object");
  });
});
