import { expect, it } from "vitest";

import type { MediaManifest } from "../src/media/schema.js";
import { draftPlan } from "../src/plan/draft.js";

const digest = "a".repeat(64);
const manifest: MediaManifest = {
  schemaVersion: 1,
  manifestId: "b".repeat(64),
  assetId: digest,
  source: { algorithm: "sha256", digest, bytes: 12, objectPath: `objects/sha256/aa/${digest}` },
  container: "mp4",
  durationSeconds: 4,
  video: { codec: "h264", width: 640, height: 360, frameRate: { numerator: 30, denominator: 1 } },
  audio: { codec: "aac", channels: 1, sampleRate: 48000 },
  transcript: [
    { startSeconds: 0.5, endSeconds: 1.5, text: "Opening" },
    { startSeconds: 2, endSeconds: 3.5, text: "Conclusion" }
  ],
  scenes: [],
  provenance: [{ tool: "test", version: "1", command: [], outputHash: "c".repeat(64) }]
};

it("drafts the same unapproved plan for the same inputs", () => {
  const options = { title: "Test edit", brief: "Keep the useful lines." };
  expect(draftPlan(manifest, options)).toEqual(draftPlan(manifest, options));
  expect(draftPlan(manifest, options).captions).toHaveLength(2);
});

it("changes identity when the brief changes", () => {
  const first = draftPlan(manifest, { title: "Test", brief: "Short" });
  const second = draftPlan(manifest, { title: "Test", brief: "Longer" });
  expect(second.planId).not.toBe(first.planId);
});
