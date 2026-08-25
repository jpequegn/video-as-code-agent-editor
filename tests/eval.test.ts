import { readFile } from "node:fs/promises";

import { expect, it } from "vitest";

import { evaluateGoldenCase, summarizeEvaluations } from "../src/eval/evaluate.js";
import { goldenCaseSchema, type GoldenCase } from "../src/eval/schema.js";
import type { CreativePlan } from "../src/plan/schema.js";
import type { QaReport } from "../src/qa/schema.js";
import { testComposition } from "./helpers/composition.js";

const composition = testComposition();
const plan = {
  planId: composition.planId,
  mediaManifestId: composition.mediaManifestId
} as CreativePlan;
const qa = {
  reportId: "1".repeat(64),
  verdict: "pass",
  findings: []
} as unknown as QaReport;
const golden: GoldenCase = {
  schemaVersion: 1,
  caseId: "test-case",
  title: "Test",
  expectedCuts: [{ sourceStartSeconds: 0, sourceEndSeconds: 1, toleranceSeconds: 0.01 }],
  duration: { minimumSeconds: 0.9, maximumSeconds: 1.1 },
  requiredCaptions: [],
  expectedQaFailures: [],
  expectedVerdict: "pass",
  baselineMinutes: 12,
  actualMinutes: 2,
  reworkCount: 0
};

it("evaluates traceable golden edit constraints", () => {
  const result = evaluateGoldenCase({ golden, plan, composition, qa });
  expect(result.passed).toBe(true);
  expect(result.timeSavedMinutes).toBe(10);
  expect(result.evidence).toContain(`qa:${qa.reportId}`);
});

it("aggregates all cases without hiding failures", () => {
  const passing = evaluateGoldenCase({ golden, plan, composition, qa });
  const failing = { ...passing, caseId: "failed", passed: false, qaRecall: 0 };
  const summary = summarizeEvaluations([passing, failing]);
  expect(summary.passRate).toBe(0.5);
  expect(summary.averageQaRecall).toBe(0.5);
  expect(summary.cases).toHaveLength(2);
});

it("ships parseable clean and injected-defect golden cases", async () => {
  const names = ["clean-talk", "black-regression", "silent-regression"];
  const cases = await Promise.all(
    names.map(async (name) =>
      goldenCaseSchema.parse(
        JSON.parse(await readFile(`fixtures/golden/${name}.json`, "utf8")) as unknown
      )
    )
  );
  expect(new Set(cases.map((item) => item.caseId)).size).toBe(3);
  expect(cases.flatMap((item) => item.expectedQaFailures)).toEqual(["black_frames", "silence"]);
});
