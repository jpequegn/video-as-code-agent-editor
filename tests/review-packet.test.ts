import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, it } from "vitest";

import { summarizeEvaluations } from "../src/eval/evaluate.js";
import type { CaseResult } from "../src/eval/schema.js";
import type { MediaManifest } from "../src/media/schema.js";
import { createDecision } from "../src/plan/decisions.js";
import type { CreativePlan } from "../src/plan/schema.js";
import type { QaReport } from "../src/qa/schema.js";
import { createReviewPacket, writeReviewPacket } from "../src/review/packet.js";
import type { RenderReceipt } from "../src/render/coordinator.js";
import { testComposition } from "./helpers/composition.js";

it("writes a traceable JSON and Markdown review packet", async () => {
  const composition = testComposition();
  const plan = { planId: composition.planId } as CreativePlan;
  const approval = createDecision({
    action: "approved",
    targetPlanId: plan.planId,
    actor: "reviewer@example.test",
    timestamp: "2026-08-24T12:00:00.000Z",
    reason: "Reviewed"
  });
  const qa = {
    reportId: "2".repeat(64),
    verdict: "pass",
    findings: [
      {
        code: "duration",
        status: "pass",
        severity: "info",
        message: "Duration matches",
        evidenceSeconds: []
      }
    ]
  } as unknown as QaReport;
  const evaluation = summarizeEvaluations([
    {
      caseId: "clean",
      passed: true,
      editValid: true,
      cutRecall: 1,
      durationCompliant: true,
      captionCoverage: 1,
      qaRecall: 1,
      verdictMatched: true,
      timeSavedMinutes: 10,
      reworkCount: 0,
      evidence: ["qa:evidence"]
    } satisfies CaseResult
  ]);
  const packet = createReviewPacket({
    title: "Review clean edit",
    source: { manifestId: "3".repeat(64) } as MediaManifest,
    plan,
    approval,
    composition,
    render: {
      outputHash: "4".repeat(64),
      finalEventHash: "5".repeat(64)
    } as RenderReceipt,
    qa,
    evaluation,
    previewLink: "renders/preview.mp4"
  });
  const output = await writeReviewPacket(
    packet,
    qa,
    evaluation,
    await mkdtemp(path.join(os.tmpdir(), "vace-review-"))
  );
  const markdown = await readFile(output.markdownPath, "utf8");
  expect(packet.verdict).toBe("approve");
  expect(markdown).toContain("Automated verdicts never approve on behalf of a reviewer");
  expect(markdown).toContain(composition.compositionId);
});

it("rejects unsafe preview links", () => {
  expect(() =>
    createReviewPacket({
      previewLink: "../../private.mp4"
    } as Parameters<typeof createReviewPacket>[0])
  ).toThrow();
});
