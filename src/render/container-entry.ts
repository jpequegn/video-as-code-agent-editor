import path from "node:path";

import { LocalRemotionAdapter, loadCompositionManifest } from "./adapters.js";

const manifestPath = process.env.VACE_COMPOSITION_MANIFEST;
const outputPath = process.env.VACE_OUTPUT;
const publicRoot = process.env.VACE_PUBLIC;
if (!manifestPath || !outputPath || !publicRoot) {
  throw new Error("VACE_COMPOSITION_MANIFEST, VACE_OUTPUT, and VACE_PUBLIC are required");
}
const composition = await loadCompositionManifest(manifestPath);
await new LocalRemotionAdapter().render(
  {
    schemaVersion: 1,
    jobId: composition.compositionId,
    idempotencyKey: composition.compositionId,
    compositionId: composition.compositionId,
    planId: composition.planId,
    mode: "docker",
    outputFile: `renders/${composition.compositionId}.mp4`,
    timeoutMs: 300_000
  },
  {
    composition,
    entryPoint: path.resolve("remotion/index.ts"),
    publicRoot,
    bundleRoot: "/tmp/vace-bundle",
    outputPath
  }
);
