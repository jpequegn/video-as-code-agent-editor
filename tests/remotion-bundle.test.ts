import { access, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, it } from "vitest";

import { bundleComposition } from "../src/composition/bundle.js";

it("bundles the Remotion composition", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "vace-remotion-"));
  const bundlePath = await bundleComposition({
    entryPoint: path.resolve("remotion/index.ts"),
    outDir: outputDir,
    publicDir: path.resolve("remotion/public")
  });
  await expect(access(path.join(bundlePath, "index.html"))).resolves.toBeUndefined();
}, 30_000);
