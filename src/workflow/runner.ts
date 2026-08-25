import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { compileComposition } from "../composition/compiler.js";
import { compositionManifestSchema, type CompositionManifest } from "../composition/schema.js";
import { evaluateGoldenCase, summarizeEvaluations } from "../eval/evaluate.js";
import { evalSummarySchema, type EvalSummary, type GoldenCase } from "../eval/schema.js";
import { canonicalJson } from "../lib/canonical-json.js";
import { generateSyntheticFixture } from "../media/fixture.js";
import { buildMediaManifest } from "../media/manifest.js";
import { mediaManifestSchema, type MediaManifest } from "../media/schema.js";
import { DecisionLog } from "../plan/decisions.js";
import { draftPlan } from "../plan/draft.js";
import { creativePlanSchema, type CreativePlan, type PlanDecision } from "../plan/schema.js";
import { collectQaObservations } from "../qa/detectors.js";
import { evaluateQa } from "../qa/evaluate.js";
import { generateQaFixtures } from "../qa/fixtures.js";
import { qaReportSchema, type QaReport } from "../qa/schema.js";
import { createReviewPacket, writeReviewPacket } from "../review/packet.js";
import { FixtureCopyAdapter, LocalRemotionAdapter } from "../render/adapters.js";
import { RenderCoordinator, type RenderReceipt } from "../render/coordinator.js";
import { prepareRenderJob } from "../render/job.js";
import { RenderLedger } from "../render/ledger.js";
import { renderReceiptSchema } from "../render/schema.js";
import {
  readState,
  requireStatePath,
  workspacePaths,
  writeState,
  type WorkflowState
} from "./state.js";

async function readJson<T>(filePath: string, parse: (value: unknown) => T): Promise<T> {
  return parse(JSON.parse(await readFile(filePath, "utf8")) as unknown);
}

const parseMediaManifest = (value: unknown) => mediaManifestSchema.parse(value);
const parseCreativePlan = (value: unknown) => creativePlanSchema.parse(value);
const parseCompositionManifest = (value: unknown) => compositionManifestSchema.parse(value);
const parseQaReport = (value: unknown) => qaReportSchema.parse(value);
const parseEvalSummary = (value: unknown) => evalSummarySchema.parse(value);
const parseRenderReceipt = (value: unknown) => renderReceiptSchema.parse(value);

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${canonicalJson(value)}\n`);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ingestStage(options: {
  workspace: string;
  sourcePath: string;
  transcriptPath?: string;
  fixtureKind?: WorkflowState["fixtureKind"];
}): Promise<MediaManifest> {
  const paths = workspacePaths(options.workspace);
  const manifest = await buildMediaManifest({
    sourcePath: options.sourcePath,
    storeRoot: paths.store,
    ...(options.transcriptPath ? { transcriptPath: options.transcriptPath } : {})
  });
  const manifestPath = path.join(paths.store, "manifests", `${manifest.manifestId}.json`);
  await writeState(paths, {
    schemaVersion: 1,
    sourcePath: path.resolve(options.sourcePath),
    ...(options.transcriptPath ? { transcriptPath: path.resolve(options.transcriptPath) } : {}),
    ...(options.fixtureKind ? { fixtureKind: options.fixtureKind } : {}),
    mediaManifestPath: manifestPath
  });
  return manifest;
}

export async function planStage(options: {
  workspace: string;
  title: string;
  brief: string;
}): Promise<CreativePlan> {
  const paths = workspacePaths(options.workspace);
  const state = await readState(paths);
  const manifest = await readJson(requireStatePath(state, "mediaManifestPath"), parseMediaManifest);
  const plan = draftPlan(manifest, {
    title: options.title,
    brief: options.brief,
    template: "full-take"
  });
  const planPath = path.join(paths.plans, `${plan.planId}.json`);
  await writeJson(planPath, plan);
  await writeState(paths, {
    ...state,
    planPath,
    planDecisionPath: path.join(paths.decisions, "plans.jsonl")
  });
  return plan;
}

export async function approveStage(options: {
  workspace: string;
  actor: string;
  reason: string;
  timestamp?: string;
}): Promise<PlanDecision> {
  const paths = workspacePaths(options.workspace);
  const state = await readState(paths);
  const plan = await readJson(requireStatePath(state, "planPath"), parseCreativePlan);
  const decisionPath = state.planDecisionPath ?? path.join(paths.decisions, "plans.jsonl");
  const decision = await new DecisionLog(decisionPath).append({
    action: "approved",
    targetPlanId: plan.planId,
    actor: options.actor,
    timestamp: options.timestamp ?? new Date().toISOString(),
    reason: options.reason
  });
  await writeState(paths, { ...state, planDecisionPath: decisionPath });
  return decision;
}

export async function compileStage(workspace: string): Promise<CompositionManifest> {
  const paths = workspacePaths(workspace);
  const state = await readState(paths);
  const media = await readJson(requireStatePath(state, "mediaManifestPath"), parseMediaManifest);
  const plan = await readJson(requireStatePath(state, "planPath"), parseCreativePlan);
  const decisions = await new DecisionLog(requireStatePath(state, "planDecisionPath")).read();
  const compiled = await compileComposition({
    plan,
    media,
    decisions,
    storeRoot: paths.store,
    artifactRoot: paths.compositions,
    publicRoot: paths.public
  });
  await writeState(paths, { ...state, compositionPath: compiled.jsonPath });
  return compiled.manifest;
}

export async function renderStage(options: {
  workspace: string;
  renderer: "fixture" | "local";
}): Promise<RenderReceipt> {
  const paths = workspacePaths(options.workspace);
  const state = await readState(paths);
  const composition = await readJson(
    requireStatePath(state, "compositionPath"),
    parseCompositionManifest
  );
  const plan = await readJson(requireStatePath(state, "planPath"), parseCreativePlan);
  const decisions = await new DecisionLog(requireStatePath(state, "planDecisionPath")).read();
  const job = prepareRenderJob({
    composition,
    plan,
    decisions,
    idempotencyKey: `${composition.compositionId}-${options.renderer}`,
    mode: options.renderer
  });
  const coordinator = new RenderCoordinator(
    { artifactRoot: paths.compositions, publicRoot: paths.public, outputRoot: paths.outputs },
    new RenderLedger(path.join(paths.artifacts, "render-events.jsonl")),
    path.resolve("remotion/index.ts")
  );
  const adapter =
    options.renderer === "local"
      ? new LocalRemotionAdapter()
      : new FixtureCopyAdapter(path.join(paths.public, ...composition.asset.publicPath.split("/")));
  const receipt = await coordinator.execute(job, composition, adapter);
  const renderOutputPath = path.join(paths.outputs, ...receipt.outputFile.split("/"));
  await writeState(paths, {
    ...state,
    renderOutputPath,
    renderReceiptPath: `${renderOutputPath}.manifest.json`
  });
  return receipt;
}

export async function qaStage(workspace: string): Promise<QaReport> {
  const paths = workspacePaths(workspace);
  const state = await readState(paths);
  const composition = await readJson(
    requireStatePath(state, "compositionPath"),
    parseCompositionManifest
  );
  const observations = await collectQaObservations(requireStatePath(state, "renderOutputPath"));
  const report = evaluateQa(observations, composition);
  const reportPath = path.join(paths.qa, `${report.reportId}.json`);
  await writeJson(reportPath, report);
  await writeState(paths, { ...state, qaReportPath: reportPath });
  return report;
}

function goldenForRun(
  state: WorkflowState,
  plan: CreativePlan,
  composition: CompositionManifest,
  qa: QaReport
): GoldenCase {
  const expected: Record<string, { failures: string[]; verdict: QaReport["verdict"] }> = {
    good: { failures: [], verdict: "pass" },
    black: { failures: ["black_frames"], verdict: "fail" },
    silent: { failures: ["silence"], verdict: "warn" },
    peak: { failures: ["audio_peak"], verdict: "warn" }
  };
  const kind = state.fixtureKind ?? "good";
  const expectation = expected[kind] ?? { failures: [], verdict: qa.verdict };
  return {
    schemaVersion: 1,
    caseId: `${kind}-workflow`,
    title: `${kind} end-to-end workflow`,
    expectedCuts: plan.segments.map((segment) => ({
      sourceStartSeconds: segment.sourceStartSeconds,
      sourceEndSeconds: segment.sourceEndSeconds,
      toleranceSeconds: 1 / composition.video.fps
    })),
    duration: {
      minimumSeconds: composition.video.durationSeconds - 0.05,
      maximumSeconds: composition.video.durationSeconds + 0.05
    },
    requiredCaptions: plan.captions.map((caption) => caption.text),
    expectedQaFailures: expectation.failures,
    expectedVerdict: expectation.verdict,
    baselineMinutes: 15,
    actualMinutes: 2,
    reworkCount: kind === "good" ? 0 : 1
  };
}

export async function evaluateStage(workspace: string): Promise<EvalSummary> {
  const paths = workspacePaths(workspace);
  const state = await readState(paths);
  const plan = await readJson(requireStatePath(state, "planPath"), parseCreativePlan);
  const composition = await readJson(
    requireStatePath(state, "compositionPath"),
    parseCompositionManifest
  );
  const qa = await readJson(requireStatePath(state, "qaReportPath"), parseQaReport);
  const result = evaluateGoldenCase({
    golden: goldenForRun(state, plan, composition, qa),
    plan,
    composition,
    qa
  });
  const summary = summarizeEvaluations([result]);
  const evaluationPath = path.join(paths.evaluations, `${summary.evaluationId}.json`);
  await writeJson(evaluationPath, summary);
  await writeState(paths, { ...state, evaluationPath });
  return summary;
}

export async function reviewStage(workspace: string) {
  const paths = workspacePaths(workspace);
  const state = await readState(paths);
  const source = await readJson(requireStatePath(state, "mediaManifestPath"), parseMediaManifest);
  const plan = await readJson(requireStatePath(state, "planPath"), parseCreativePlan);
  const decisions = await new DecisionLog(requireStatePath(state, "planDecisionPath")).read();
  const approval = decisions
    .filter((decision) => decision.targetPlanId === plan.planId && decision.action === "approved")
    .at(-1);
  if (!approval) throw new Error("No active approval exists for review");
  const composition = await readJson(
    requireStatePath(state, "compositionPath"),
    parseCompositionManifest
  );
  const render: RenderReceipt = await readJson(
    requireStatePath(state, "renderReceiptPath"),
    parseRenderReceipt
  );
  const qa = await readJson(requireStatePath(state, "qaReportPath"), parseQaReport);
  const evaluation = await readJson(requireStatePath(state, "evaluationPath"), parseEvalSummary);
  const packet = createReviewPacket({
    title: plan.title,
    source,
    plan,
    approval,
    composition,
    render,
    qa,
    evaluation,
    previewLink: path.relative(paths.root, requireStatePath(state, "renderOutputPath"))
  });
  const written = await writeReviewPacket(packet, qa, evaluation, paths.reviews);
  await writeState(paths, {
    ...state,
    reviewPacketPath: written.jsonPath,
    reviewMarkdownPath: written.markdownPath
  });
  return { packet, ...written };
}

export async function runWorkflow(options: {
  workspace: string;
  sourcePath: string;
  transcriptPath?: string;
  fixtureKind?: WorkflowState["fixtureKind"];
  title: string;
  brief: string;
  approveAs?: string;
  dryRun?: boolean;
  renderer: "fixture" | "local";
}) {
  await ingestStage(options);
  const plan = await planStage(options);
  if (options.dryRun) return { status: "awaiting-approval" as const, plan };
  if (!options.approveAs) throw new Error("approveAs is required unless dryRun is enabled");
  await approveStage({
    workspace: options.workspace,
    actor: options.approveAs,
    reason: "Explicit CLI approval"
  });
  const composition = await compileStage(options.workspace);
  const render = await renderStage({ workspace: options.workspace, renderer: options.renderer });
  const qa = await qaStage(options.workspace);
  const evaluation = await evaluateStage(options.workspace);
  const review = await reviewStage(options.workspace);
  return { status: "complete" as const, plan, composition, render, qa, evaluation, ...review };
}

export async function runDemo(options: {
  workspace: string;
  fixtureKind: "good" | "black" | "silent" | "peak";
  approve: boolean;
  renderer: "fixture" | "local";
}) {
  const paths = workspacePaths(options.workspace);
  const inputRoot = path.join(paths.root, "input");
  await mkdir(inputRoot, { recursive: true });
  let sourcePath: string;
  let transcriptPath: string | undefined;
  if (options.fixtureKind === "good") {
    sourcePath = path.join(inputRoot, "talk-to-camera.mp4");
    transcriptPath = `${sourcePath}.transcript.json`;
    if (!(await exists(sourcePath))) transcriptPath = await generateSyntheticFixture(sourcePath);
  } else {
    sourcePath = path.join(inputRoot, `${options.fixtureKind}.mp4`);
    if (!(await exists(sourcePath))) {
      const fixtures = await generateQaFixtures(inputRoot);
      sourcePath = fixtures[options.fixtureKind];
    }
  }
  if (!options.approve) {
    await ingestStage({
      workspace: options.workspace,
      sourcePath,
      ...(transcriptPath ? { transcriptPath } : {}),
      fixtureKind: options.fixtureKind
    });
    const plan = await planStage({
      workspace: options.workspace,
      title: "Synthetic talk edit",
      brief: "Keep the complete generated take."
    });
    return { status: "awaiting-approval" as const, plan };
  }
  const result = await runWorkflow({
    workspace: options.workspace,
    sourcePath,
    ...(transcriptPath ? { transcriptPath } : {}),
    fixtureKind: options.fixtureKind,
    title: "Synthetic talk edit",
    brief: "Keep the complete generated take and show transcript-backed captions.",
    approveAs: "demo-user",
    renderer: options.renderer
  });
  return result;
}
