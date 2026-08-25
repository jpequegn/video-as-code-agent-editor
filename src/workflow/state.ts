import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { canonicalJson } from "../lib/canonical-json.js";

const stateSchema = z.object({
  schemaVersion: z.literal(1),
  fixtureKind: z.enum(["good", "black", "silent", "peak"]).optional(),
  sourcePath: z.string().optional(),
  transcriptPath: z.string().optional(),
  mediaManifestPath: z.string().optional(),
  planPath: z.string().optional(),
  planDecisionPath: z.string().optional(),
  compositionPath: z.string().optional(),
  renderOutputPath: z.string().optional(),
  renderReceiptPath: z.string().optional(),
  qaReportPath: z.string().optional(),
  evaluationPath: z.string().optional(),
  reviewPacketPath: z.string().optional(),
  reviewMarkdownPath: z.string().optional()
});

export type WorkflowState = z.infer<typeof stateSchema>;

export interface WorkspacePaths {
  root: string;
  index: string;
  store: string;
  artifacts: string;
  plans: string;
  decisions: string;
  compositions: string;
  public: string;
  outputs: string;
  qa: string;
  evaluations: string;
  reviews: string;
}

export function workspacePaths(root: string): WorkspacePaths {
  const resolved = path.resolve(root);
  const artifacts = path.join(resolved, "artifacts");
  return {
    root: resolved,
    index: path.join(resolved, "workflow.json"),
    store: path.join(resolved, ".vace"),
    artifacts,
    plans: path.join(artifacts, "plans"),
    decisions: path.join(artifacts, "decisions"),
    compositions: path.join(artifacts, "compositions"),
    public: path.join(resolved, "public"),
    outputs: path.join(resolved, "output"),
    qa: path.join(artifacts, "qa"),
    evaluations: path.join(artifacts, "evaluations"),
    reviews: path.join(artifacts, "reviews")
  };
}

export async function readState(paths: WorkspacePaths): Promise<WorkflowState> {
  try {
    return stateSchema.parse(JSON.parse(await readFile(paths.index, "utf8")) as unknown);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return { schemaVersion: 1 };
    throw error;
  }
}

export async function writeState(paths: WorkspacePaths, state: WorkflowState): Promise<void> {
  await mkdir(paths.root, { recursive: true });
  await writeFile(paths.index, `${canonicalJson(stateSchema.parse(state))}\n`);
}

export function requireStatePath(state: WorkflowState, key: keyof WorkflowState): string {
  const value = state[key];
  if (typeof value !== "string") throw new Error(`Workflow stage is missing ${key}`);
  return value;
}
