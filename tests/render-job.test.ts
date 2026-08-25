import { expect, it } from "vitest";

import { createDecision } from "../src/plan/decisions.js";
import type { CreativePlan } from "../src/plan/schema.js";
import { prepareRenderJob } from "../src/render/job.js";
import type { CompositionManifest } from "../src/composition/schema.js";

const plan = { planId: "a".repeat(64) } as CreativePlan;
const composition = { compositionId: "b".repeat(64), planId: plan.planId } as CompositionManifest;
const decision = createDecision({
  action: "approved",
  targetPlanId: plan.planId,
  actor: "reviewer@example.test",
  timestamp: "2026-08-24T12:00:00.000Z",
  reason: "Reviewed"
});

it("creates stable jobs only for the approved plan", () => {
  const options = {
    composition,
    plan,
    decisions: [decision],
    idempotencyKey: "demo-1",
    mode: "fake" as const
  };
  expect(prepareRenderJob(options)).toEqual(prepareRenderJob(options));
  expect(() => prepareRenderJob({ ...options, decisions: [] })).toThrow("is not approved");
});

it("rejects a composition built from another plan", () => {
  expect(() =>
    prepareRenderJob({
      composition: { ...composition, planId: "c".repeat(64) },
      plan,
      decisions: [decision],
      idempotencyKey: "demo-2",
      mode: "fake"
    })
  ).toThrow("does not belong");
});
