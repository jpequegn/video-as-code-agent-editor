import { expect, it } from "vitest";

import { diffRuns, type RunSnapshot } from "../src/eval/diff.js";
import type { EvalSummary } from "../src/eval/schema.js";

function snapshot(passRate: number): RunSnapshot {
  return {
    planId: "a".repeat(64),
    compositionId: "b".repeat(64),
    renderHash: "c".repeat(64),
    qaReportId: "d".repeat(64),
    evaluation: {
      passRate,
      averageQaRecall: passRate,
      totalTimeSavedMinutes: passRate * 10
    } as EvalSummary
  };
}

it("reports changed identities and metric regressions", () => {
  const before = snapshot(1);
  const after = { ...snapshot(0.5), renderHash: "e".repeat(64) };
  const diff = diffRuns(before, after);
  expect(diff.changed).toEqual(["renderHash"]);
  expect(diff.regressions).toHaveLength(3);
});
