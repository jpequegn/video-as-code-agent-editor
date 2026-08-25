import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { selectComposition, renderMedia } from "@remotion/renderer";

import { canonicalJson } from "../lib/canonical-json.js";
import { bundleComposition } from "../composition/bundle.js";
import type { CompositionManifest } from "../composition/schema.js";
import type { RenderJob } from "./schema.js";

export interface RenderAdapterContext {
  composition: CompositionManifest;
  entryPoint: string;
  publicRoot: string;
  bundleRoot: string;
  outputPath: string;
}

export interface RenderAdapter {
  render(job: RenderJob, context: RenderAdapterContext): Promise<void>;
}

export class FakeRenderAdapter implements RenderAdapter {
  public calls = 0;

  public async render(job: RenderJob, context: RenderAdapterContext): Promise<void> {
    this.calls += 1;
    await mkdir(path.dirname(context.outputPath), { recursive: true });
    await writeFile(
      context.outputPath,
      canonicalJson({ renderer: "fake-v1", jobId: job.jobId, composition: context.composition })
    );
  }
}

export class LocalRemotionAdapter implements RenderAdapter {
  public async render(_job: RenderJob, context: RenderAdapterContext): Promise<void> {
    const serveUrl = await bundleComposition({
      entryPoint: context.entryPoint,
      outDir: context.bundleRoot,
      publicDir: context.publicRoot
    });
    const composition = await selectComposition({
      serveUrl,
      id: "VideoEdit",
      inputProps: context.composition
    });
    await mkdir(path.dirname(context.outputPath), { recursive: true });
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: context.outputPath,
      inputProps: context.composition,
      overwrite: false
    });
  }
}

export async function loadCompositionManifest(filePath: string): Promise<CompositionManifest> {
  return JSON.parse(await readFile(filePath, "utf8")) as CompositionManifest;
}
