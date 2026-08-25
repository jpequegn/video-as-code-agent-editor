import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import type { CompositionManifest } from "../composition/schema.js";
import type { CreativePlan } from "../plan/schema.js";
import type { QaReport } from "../qa/schema.js";
import {
  caseResultSchema,
  evalSummarySchema,
  goldenCaseSchema,
  type CaseResult,
  type EvalSummary,
  type GoldenCase
} from "./schema.js";

export function evaluateGoldenCase(options: {
  golden: GoldenCase;
  plan: CreativePlan;
  composition: CompositionManifest;
  qa: QaReport;
}): CaseResult {
  const golden = goldenCaseSchema.parse(options.golden);
  const actualCuts = options.composition.timeline.map((segment) => ({
    start: segment.sourceStartFrame / options.composition.video.fps,
    end: (segment.sourceStartFrame + segment.durationInFrames) / options.composition.video.fps
  }));
  const matchedCuts = golden.expectedCuts.filter((expected) =>
    actualCuts.some(
      (actual) =>
        Math.abs(actual.start - expected.sourceStartSeconds) <= expected.toleranceSeconds &&
        Math.abs(actual.end - expected.sourceEndSeconds) <= expected.toleranceSeconds
    )
  ).length;
  const captions = options.composition.captions.map((caption) => caption.text.toLowerCase());
  const matchedCaptions = golden.requiredCaptions.filter((required) =>
    captions.some((caption) => caption.includes(required.toLowerCase()))
  ).length;
  const failedQaCodes = new Set(
    options.qa.findings
      .filter((finding) => finding.status === "fail")
      .map((finding) => finding.code)
  );
  const matchedQa = golden.expectedQaFailures.filter((code) => failedQaCodes.has(code)).length;
  const cutRecall = golden.expectedCuts.length === 0 ? 1 : matchedCuts / golden.expectedCuts.length;
  const captionCoverage =
    golden.requiredCaptions.length === 0 ? 1 : matchedCaptions / golden.requiredCaptions.length;
  const qaRecall =
    golden.expectedQaFailures.length === 0 ? 1 : matchedQa / golden.expectedQaFailures.length;
  const durationCompliant =
    options.composition.video.durationSeconds >= golden.duration.minimumSeconds &&
    options.composition.video.durationSeconds <= golden.duration.maximumSeconds;
  const editValid =
    options.composition.planId === options.plan.planId &&
    options.composition.mediaManifestId === options.plan.mediaManifestId;
  const verdictMatched = options.qa.verdict === golden.expectedVerdict;
  return caseResultSchema.parse({
    caseId: golden.caseId,
    passed:
      editValid &&
      cutRecall === 1 &&
      durationCompliant &&
      captionCoverage === 1 &&
      qaRecall === 1 &&
      verdictMatched,
    editValid,
    cutRecall,
    durationCompliant,
    captionCoverage,
    qaRecall,
    verdictMatched,
    timeSavedMinutes: golden.baselineMinutes - golden.actualMinutes,
    reworkCount: golden.reworkCount,
    evidence: [
      `plan:${options.plan.planId}`,
      `composition:${options.composition.compositionId}`,
      `qa:${options.qa.reportId}`
    ]
  });
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeEvaluations(cases: CaseResult[]): EvalSummary {
  if (cases.length === 0) throw new Error("At least one case is required");
  const identity = {
    schemaVersion: 1 as const,
    cases,
    passRate: cases.filter((item) => item.passed).length / cases.length,
    averageCutRecall: average(cases.map((item) => item.cutRecall)),
    averageCaptionCoverage: average(cases.map((item) => item.captionCoverage)),
    averageQaRecall: average(cases.map((item) => item.qaRecall)),
    totalTimeSavedMinutes: cases.reduce((sum, item) => sum + item.timeSavedMinutes, 0),
    totalReworkCount: cases.reduce((sum, item) => sum + item.reworkCount, 0)
  };
  return evalSummarySchema.parse({ ...identity, evaluationId: sha256(canonicalJson(identity)) });
}
