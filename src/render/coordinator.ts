import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import type { CompositionManifest } from "../composition/schema.js";
import type { RenderAdapter } from "./adapters.js";
import type { RenderLedger } from "./ledger.js";
import { resolveOutputFile, validateRenderRoots, type RenderRoots } from "./paths.js";
import type { RenderJob } from "./schema.js";

export interface RenderReceipt {
  schemaVersion: 1;
  jobId: string;
  compositionId: string;
  outputFile: string;
  outputHash: string;
  rendererMode: RenderJob["mode"];
  finalEventHash: string;
}

export class RenderCoordinator {
  public constructor(
    private readonly roots: RenderRoots,
    private readonly ledger: RenderLedger,
    private readonly entryPoint: string
  ) {}

  public async execute(
    job: RenderJob,
    composition: CompositionManifest,
    adapter: RenderAdapter
  ): Promise<RenderReceipt> {
    const roots = validateRenderRoots(this.roots);
    const outputPath = resolveOutputFile(roots.outputRoot, job.outputFile);
    const receiptPath = `${outputPath}.manifest.json`;
    const existing = (await this.ledger.read()).find(
      (event) => event.idempotencyKey === job.idempotencyKey && event.status === "succeeded"
    );
    if (existing) return JSON.parse(await readFile(receiptPath, "utf8")) as RenderReceipt;

    await this.ledger.append(job, "prepared", "Validated render roots and immutable inputs");
    await this.ledger.append(job, "running", `Started ${job.mode} renderer`);
    try {
      await adapter.render(job, {
        composition,
        entryPoint: this.entryPoint,
        publicRoot: roots.publicRoot,
        bundleRoot: path.join(roots.outputRoot, ".bundles", composition.compositionId),
        outputPath
      });
      const outputHash = sha256(await readFile(outputPath));
      const finalEvent = await this.ledger.append(
        job,
        "succeeded",
        "Output hashed and recorded",
        outputHash
      );
      const receipt: RenderReceipt = {
        schemaVersion: 1,
        jobId: job.jobId,
        compositionId: composition.compositionId,
        outputFile: job.outputFile,
        outputHash,
        rendererMode: job.mode,
        finalEventHash: finalEvent.eventHash
      };
      await writeFile(receiptPath, `${canonicalJson(receipt)}\n`, { flag: "wx" });
      return receipt;
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown renderer failure";
      await this.ledger.append(job, "failed", detail);
      throw error;
    }
  }
}
