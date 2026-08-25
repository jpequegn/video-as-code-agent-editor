import { expect, it } from "vitest";

import type { MediaManifest } from "../src/media/schema.js";
import { draftPlan } from "../src/plan/draft.js";
import { PlanValidationError, validatePlanForMedia } from "../src/plan/validate.js";

const digest = "d".repeat(64);
const manifest = {
  schemaVersion: 1,
  manifestId: "e".repeat(64),
  assetId: digest,
  source: { algorithm: "sha256", digest, bytes: 1, objectPath: `objects/sha256/dd/${digest}` },
  container: "mp4",
  durationSeconds: 5,
  video: { codec: "h264", width: 1280, height: 720, frameRate: { numerator: 30, denominator: 1 } },
  audio: null,
  transcript: [],
  scenes: [],
  provenance: [{ tool: "test", version: "1", command: [], outputHash: "f".repeat(64) }]
} satisfies MediaManifest;

it("validates a plan against its exact media", () => {
  const plan = draftPlan(manifest, {
    title: "Full",
    brief: "Use all footage",
    template: "full-take"
  });
  expect(validatePlanForMedia(plan, manifest)).toEqual(plan);
});

it("rejects source ranges outside the asset", () => {
  const plan = draftPlan(manifest, { title: "Full", brief: "Use all footage" });
  plan.segments[0]!.sourceEndSeconds = 6;
  expect(() => validatePlanForMedia(plan, manifest)).toThrow(PlanValidationError);
});

it("rejects stale media references", () => {
  const plan = draftPlan(manifest, { title: "Full", brief: "Use all footage" });
  plan.mediaManifestId = "0".repeat(64);
  expect(() => validatePlanForMedia(plan, manifest)).toThrow("mediaManifestId does not match");
});
