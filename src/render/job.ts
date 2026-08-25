import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import { requireApprovedPlan } from "../plan/decisions.js";
import type { CreativePlan, PlanDecision } from "../plan/schema.js";
import type { CompositionManifest } from "../composition/schema.js";
import { renderJobSchema, type RenderJob } from "./schema.js";

export function prepareRenderJob(options: {
  composition: CompositionManifest;
  plan: CreativePlan;
  decisions: PlanDecision[];
  idempotencyKey: string;
  mode: RenderJob["mode"];
  timeoutMs?: number;
}): RenderJob {
  requireApprovedPlan(options.plan, options.decisions);
  if (options.composition.planId !== options.plan.planId) {
    throw new Error("Composition does not belong to the approved plan");
  }
  const identity = {
    schemaVersion: 1 as const,
    idempotencyKey: options.idempotencyKey,
    compositionId: options.composition.compositionId,
    planId: options.plan.planId,
    mode: options.mode,
    outputFile: `renders/${options.composition.compositionId}.mp4`,
    timeoutMs: options.timeoutMs ?? 300_000
  };
  return renderJobSchema.parse({ ...identity, jobId: sha256(canonicalJson(identity)) });
}
