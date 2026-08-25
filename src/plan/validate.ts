import type { MediaManifest } from "../media/schema.js";
import { creativePlanSchema, type CreativePlan } from "./schema.js";

export class PlanValidationError extends Error {
  public constructor(public readonly findings: string[]) {
    super(findings.join("; "));
    this.name = "PlanValidationError";
  }
}

export function validatePlanForMedia(planInput: unknown, manifest: MediaManifest): CreativePlan {
  const result = creativePlanSchema.safeParse(planInput);
  if (!result.success) {
    throw new PlanValidationError(
      result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    );
  }

  const plan = result.data;
  const findings: string[] = [];
  if (plan.mediaManifestId !== manifest.manifestId) {
    findings.push("mediaManifestId does not match the supplied manifest");
  }
  if (!plan.constraints.allowedVideoCodecs.includes(manifest.video.codec)) {
    findings.push(`video codec ${manifest.video.codec} is not allowed by the plan`);
  }
  for (const segment of plan.segments) {
    if (segment.sourceAssetId !== manifest.assetId) {
      findings.push(`segment ${segment.id} references an unknown source asset`);
    }
    if (segment.sourceEndSeconds > manifest.durationSeconds) {
      findings.push(`segment ${segment.id} exceeds source duration`);
    }
  }
  const sorted = [...plan.segments].sort(
    (left, right) => left.sourceStartSeconds - right.sourceStartSeconds
  );
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const previous = sorted[index - 1];
    if (current && previous && current.sourceStartSeconds < previous.sourceEndSeconds) {
      findings.push(`segments ${previous.id} and ${current.id} overlap in source time`);
    }
  }
  if (findings.length > 0) throw new PlanValidationError(findings);
  return plan;
}
