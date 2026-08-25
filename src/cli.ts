#!/usr/bin/env node

import { pathToFileURL } from "node:url";

import { Command } from "commander";

import { VERSION } from "./version.js";
import {
  approveStage,
  compileStage,
  evaluateStage,
  ingestStage,
  planStage,
  qaStage,
  renderStage,
  reviewStage,
  runDemo,
  runWorkflow
} from "./workflow/runner.js";

type OutputMode = "json" | "status";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function formatCliOutput(value: unknown, mode: OutputMode): string {
  if (mode === "json") return `${JSON.stringify(value, null, 2)}\n`;
  const item = record(value);
  const packet = record(item.packet);
  const plan = record(item.plan);
  const fields = [
    typeof item.status === "string" ? item.status : undefined,
    typeof item.verdict === "string" ? `verdict=${item.verdict}` : undefined,
    typeof packet.verdict === "string" ? `verdict=${packet.verdict}` : undefined,
    typeof item.manifestId === "string" ? `manifest=${item.manifestId}` : undefined,
    typeof item.planId === "string" ? `plan=${item.planId}` : undefined,
    typeof plan.planId === "string" ? `plan=${plan.planId}` : undefined,
    typeof item.compositionId === "string" ? `composition=${item.compositionId}` : undefined,
    typeof item.jobId === "string" ? `job=${item.jobId}` : undefined,
    typeof item.reportId === "string" ? `report=${item.reportId}` : undefined,
    typeof item.evaluationId === "string" ? `evaluation=${item.evaluationId}` : undefined,
    typeof item.markdownPath === "string" ? `review=${item.markdownPath}` : undefined
  ].filter((field): field is string => field !== undefined);
  return `${fields.length > 0 ? fields.join(" ") : "complete"}\n`;
}

export function verdictExitCode(verdict: "approve" | "review" | "reject"): number {
  if (verdict === "reject") return 2;
  if (verdict === "review") return 3;
  return 0;
}

function applyVerdictExitCode(verdict: "approve" | "review" | "reject"): void {
  const code = verdictExitCode(verdict);
  if (code !== 0) process.exitCode = code;
}

export function createProgram(): Command {
  const program = new Command()
    .name("vace")
    .description("Compile reviewable video edits from typed plans")
    .version(VERSION)
    .option("--output <format>", "json or status", "json")
    .hook("preAction", (command) => {
      const output = command.optsWithGlobals<{ output: string }>().output;
      if (output !== "json" && output !== "status")
        throw new Error("output must be json or status");
    })
    .showHelpAfterError();

  const print = (value: unknown): void => {
    const mode = program.opts<{ output: OutputMode }>().output;
    process.stdout.write(formatCliOutput(value, mode));
  };

  program
    .command("ingest")
    .description("Hash, inspect, and store source media")
    .argument("<source>")
    .option("-w, --workspace <directory>", "workspace directory", "vace-workspace")
    .option("--transcript <file>", "deterministic transcript sidecar")
    .action(async (source: string, options: { workspace: string; transcript?: string }) => {
      print(
        await ingestStage({
          workspace: options.workspace,
          sourcePath: source,
          ...(options.transcript ? { transcriptPath: options.transcript } : {})
        })
      );
    });

  program
    .command("plan")
    .description("Draft an unapproved creative plan from ingested media")
    .requiredOption("--title <title>")
    .requiredOption("--brief <brief>")
    .option("-w, --workspace <directory>", "workspace directory", "vace-workspace")
    .action(async (options: { workspace: string; title: string; brief: string }) => {
      print(await planStage(options));
    });

  program
    .command("approve")
    .description("Approve the exact active plan hash")
    .requiredOption("--actor <identity>")
    .requiredOption("--reason <reason>")
    .option("-w, --workspace <directory>", "workspace directory", "vace-workspace")
    .action(async (options: { workspace: string; actor: string; reason: string }) => {
      print(await approveStage(options));
    });

  program
    .command("compile")
    .description("Compile the approved plan into a Remotion composition")
    .option("-w, --workspace <directory>", "workspace directory", "vace-workspace")
    .action(async (options: { workspace: string }) => {
      print(await compileStage(options.workspace));
    });

  program
    .command("render")
    .description("Render the active composition")
    .option("-w, --workspace <directory>", "workspace directory", "vace-workspace")
    .option("--renderer <mode>", "fixture or local", "fixture")
    .action(async (options: { workspace: string; renderer: string }) => {
      if (options.renderer !== "fixture" && options.renderer !== "local")
        throw new Error("renderer must be fixture or local");
      print(await renderStage({ workspace: options.workspace, renderer: options.renderer }));
    });

  program
    .command("qa")
    .description("Collect media evidence and evaluate QA policy")
    .option("-w, --workspace <directory>", "workspace directory", "vace-workspace")
    .action(async (options: { workspace: string }) => {
      const report = await qaStage(options.workspace);
      print(report);
      if (report.verdict === "fail") process.exitCode = 2;
      if (report.verdict === "warn") process.exitCode = 3;
    });

  program
    .command("evaluate")
    .description("Evaluate the current run against its golden fixture")
    .option("-w, --workspace <directory>", "workspace directory", "vace-workspace")
    .action(async (options: { workspace: string }) => {
      print(await evaluateStage(options.workspace));
    });

  program
    .command("review")
    .description("Generate JSON and Markdown human review packets")
    .option("-w, --workspace <directory>", "workspace directory", "vace-workspace")
    .action(async (options: { workspace: string }) => {
      const result = await reviewStage(options.workspace);
      print(result);
      applyVerdictExitCode(result.packet.verdict);
    });

  program
    .command("run")
    .description("Run the complete pipeline over supplied media")
    .argument("<source>")
    .requiredOption("--title <title>")
    .requiredOption("--brief <brief>")
    .option("--approve-as <identity>", "explicit reviewer identity")
    .option("--dry-run", "stop after writing the unapproved plan", false)
    .option("--transcript <file>")
    .option("--renderer <mode>", "fixture or local", "local")
    .option("-w, --workspace <directory>", "workspace directory", "vace-workspace")
    .action(
      async (
        source: string,
        options: {
          title: string;
          brief: string;
          approveAs?: string;
          dryRun: boolean;
          transcript?: string;
          renderer: string;
          workspace: string;
        }
      ) => {
        if (options.renderer !== "fixture" && options.renderer !== "local")
          throw new Error("renderer must be fixture or local");
        if (!options.dryRun && !options.approveAs)
          throw new Error("--approve-as is required unless --dry-run is used");
        const result = await runWorkflow({
          workspace: options.workspace,
          sourcePath: source,
          ...(options.transcript ? { transcriptPath: options.transcript } : {}),
          title: options.title,
          brief: options.brief,
          ...(options.approveAs ? { approveAs: options.approveAs } : {}),
          dryRun: options.dryRun,
          renderer: options.renderer
        });
        print(result);
        if (result.status === "complete") applyVerdictExitCode(result.packet.verdict);
      }
    );

  program
    .command("demo")
    .description("Run the generated-media demonstration")
    .option("-w, --workspace <directory>", "workspace directory", "vace-demo")
    .option("--fixture <kind>", "good, black, silent, or peak", "good")
    .option("--renderer <mode>", "fixture or local", "fixture")
    .option("--approve", "record explicit demo-user approval and run all stages", false)
    .option("--dry-run", "stop after writing the unapproved plan", false)
    .action(
      async (options: {
        workspace: string;
        fixture: string;
        renderer: string;
        approve: boolean;
        dryRun: boolean;
      }) => {
        if (!["good", "black", "silent", "peak"].includes(options.fixture)) {
          throw new Error("fixture must be good, black, silent, or peak");
        }
        if (options.renderer !== "fixture" && options.renderer !== "local")
          throw new Error("renderer must be fixture or local");
        if (options.approve && options.dryRun) throw new Error("--approve and --dry-run conflict");
        const result = await runDemo({
          workspace: options.workspace,
          fixtureKind: options.fixture as "good" | "black" | "silent" | "peak",
          approve: options.approve && !options.dryRun,
          renderer: options.renderer
        });
        print(result);
        if (result.status === "complete") applyVerdictExitCode(result.packet.verdict);
      }
    );

  return program;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await createProgram().parseAsync(process.argv);
}
