import type { EvalSummary } from "./schema.js";

export interface RunSnapshot {
  planId: string;
  compositionId: string;
  renderHash: string;
  qaReportId: string;
  evaluation: EvalSummary;
}

export interface RunDiff {
  changed: string[];
  passRateDelta: number;
  qaRecallDelta: number;
  timeSavedDeltaMinutes: number;
  regressions: string[];
}

export function diffRuns(before: RunSnapshot, after: RunSnapshot): RunDiff {
  const changed = (["planId", "compositionId", "renderHash", "qaReportId"] as const).filter(
    (field) => before[field] !== after[field]
  );
  const passRateDelta = after.evaluation.passRate - before.evaluation.passRate;
  const qaRecallDelta = after.evaluation.averageQaRecall - before.evaluation.averageQaRecall;
  const timeSavedDeltaMinutes =
    after.evaluation.totalTimeSavedMinutes - before.evaluation.totalTimeSavedMinutes;
  const regressions = [
    ...(passRateDelta < 0 ? [`Pass rate decreased by ${Math.abs(passRateDelta).toFixed(3)}`] : []),
    ...(qaRecallDelta < 0 ? [`QA recall decreased by ${Math.abs(qaRecallDelta).toFixed(3)}`] : []),
    ...(timeSavedDeltaMinutes < 0
      ? [`Estimated time saved decreased by ${Math.abs(timeSavedDeltaMinutes).toFixed(1)} minutes`]
      : [])
  ];
  return { changed, passRateDelta, qaRecallDelta, timeSavedDeltaMinutes, regressions };
}
