import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import type { CompositionManifest } from "../composition/schema.js";
import type { EvalSummary } from "../eval/schema.js";
import type { MediaManifest } from "../media/schema.js";
import type { CreativePlan, PlanDecision } from "../plan/schema.js";
import type { QaReport } from "../qa/schema.js";
import type { RenderReceipt } from "../render/coordinator.js";
import { reviewPacketSchema, type ReviewPacket } from "./schema.js";

export function createReviewPacket(options: {
  title: string;
  source: MediaManifest;
  plan: CreativePlan;
  approval: PlanDecision;
  composition: CompositionManifest;
  render: RenderReceipt;
  qa: QaReport;
  evaluation: EvalSummary;
  previewLink: string;
}): ReviewPacket {
  if (
    options.approval.action !== "approved" ||
    options.approval.targetPlanId !== options.plan.planId
  ) {
    throw new Error("Review packet requires approval for the exact plan");
  }
  const verdict =
    options.qa.verdict === "fail" || options.evaluation.passRate < 1
      ? "reject"
      : options.qa.verdict === "warn"
        ? "review"
        : "approve";
  const identity = {
    schemaVersion: 1 as const,
    title: options.title,
    sourceManifestId: options.source.manifestId,
    planId: options.plan.planId,
    approvalEventHash: options.approval.eventHash,
    compositionId: options.composition.compositionId,
    renderHash: options.render.outputHash,
    qaReportId: options.qa.reportId,
    evaluationId: options.evaluation.evaluationId,
    previewLink: options.previewLink,
    verdict,
    claims: [
      {
        statement: `Automated media QA verdict: ${options.qa.verdict}`,
        evidence: [
          `qa:${options.qa.reportId}`,
          ...options.qa.findings.flatMap((finding) =>
            finding.evidenceSeconds.map((second) => `media:${second.toFixed(3)}s`)
          )
        ]
      },
      {
        statement: `Golden edit pass rate: ${(options.evaluation.passRate * 100).toFixed(1)}%`,
        evidence: [`evaluation:${options.evaluation.evaluationId}`]
      },
      {
        statement: `Rendered output hash: ${options.render.outputHash}`,
        evidence: [`render-event:${options.render.finalEventHash}`]
      }
    ],
    actions: ["approve", "reject", "revise"] as const
  };
  return reviewPacketSchema.parse({ ...identity, packetId: sha256(canonicalJson(identity)) });
}

function markdown(packet: ReviewPacket, qa: QaReport, evaluation: EvalSummary): string {
  const findings = qa.findings
    .map(
      (finding) =>
        `| ${finding.code} | ${finding.status} | ${finding.severity} | ${finding.message.replaceAll("|", "\\|")} |`
    )
    .join("\n");
  return `# ${packet.title}

Verdict: **${packet.verdict}**

Preview: [rendered video](${packet.previewLink})

## Provenance

| Artifact | Identity |
| --- | --- |
| Source manifest | \`${packet.sourceManifestId}\` |
| Approved plan | \`${packet.planId}\` |
| Approval event | \`${packet.approvalEventHash}\` |
| Composition | \`${packet.compositionId}\` |
| Render | \`${packet.renderHash}\` |
| QA report | \`${packet.qaReportId}\` |
| Evaluation | \`${packet.evaluationId}\` |

## Evaluation

- Pass rate: ${(evaluation.passRate * 100).toFixed(1)}%
- Cut recall: ${(evaluation.averageCutRecall * 100).toFixed(1)}%
- Caption coverage: ${(evaluation.averageCaptionCoverage * 100).toFixed(1)}%
- QA recall: ${(evaluation.averageQaRecall * 100).toFixed(1)}%
- Estimated time saved: ${evaluation.totalTimeSavedMinutes.toFixed(1)} minutes
- Rework count: ${evaluation.totalReworkCount}

## QA findings

| Check | Status | Severity | Evidence |
| --- | --- | --- | --- |
${findings}

## Review actions

Record one append-only decision: \`approve\`, \`reject\`, or \`revise\`. Automated verdicts never approve on behalf of a reviewer.
`;
}

export async function writeReviewPacket(
  packet: ReviewPacket,
  qa: QaReport,
  evaluation: EvalSummary,
  outputRoot: string
): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(outputRoot, { recursive: true });
  const jsonPath = path.join(outputRoot, `${packet.packetId}.json`);
  const markdownPath = path.join(outputRoot, `${packet.packetId}.md`);
  const jsonBody = `${canonicalJson(packet)}\n`;
  const markdownBody = markdown(packet, qa, evaluation);
  for (const [target, body] of [
    [jsonPath, jsonBody],
    [markdownPath, markdownBody]
  ] as const) {
    try {
      await writeFile(target, body, { flag: "wx" });
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      if ((await readFile(target, "utf8")) !== body)
        throw new Error(`Review packet collision: ${target}`);
    }
  }
  return { jsonPath, markdownPath };
}
