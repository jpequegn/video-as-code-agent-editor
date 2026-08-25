import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { CompositionManifest } from "../src/composition/schema.js";
import { FakeRenderAdapter, type RenderAdapter } from "../src/render/adapters.js";
import { RenderCoordinator } from "../src/render/coordinator.js";
import { RenderLedger } from "../src/render/ledger.js";
import type { RenderJob } from "../src/render/schema.js";

const composition = { compositionId: "d".repeat(64) } as CompositionManifest;
const job = {
  schemaVersion: 1,
  jobId: "e".repeat(64),
  idempotencyKey: "same-run",
  compositionId: composition.compositionId,
  planId: "f".repeat(64),
  mode: "fake",
  outputFile: `renders/${composition.compositionId}.mp4`,
  timeoutMs: 10_000
} satisfies RenderJob;

async function setup() {
  const root = await mkdtemp(path.join(os.tmpdir(), "vace-render-"));
  const roots = {
    artifactRoot: path.join(root, "artifacts"),
    publicRoot: path.join(root, "public"),
    outputRoot: path.join(root, "output")
  };
  let tick = 0;
  const ledger = new RenderLedger(path.join(root, "ledger.jsonl"), () =>
    new Date(Date.UTC(2026, 7, 24, 12, 0, tick++)).toISOString()
  );
  return { coordinator: new RenderCoordinator(roots, ledger, "remotion/index.ts"), ledger };
}

describe("RenderCoordinator", () => {
  it("records lifecycle, hashes output, and deduplicates retries", async () => {
    const { coordinator, ledger } = await setup();
    const adapter = new FakeRenderAdapter();
    const first = await coordinator.execute(job, composition, adapter);
    const second = await coordinator.execute(job, composition, adapter);
    expect(second).toEqual(first);
    expect(adapter.calls).toBe(1);
    expect((await ledger.read()).map((event) => event.status)).toEqual([
      "prepared",
      "running",
      "succeeded"
    ]);
  });

  it("records failed adapters", async () => {
    const { coordinator, ledger } = await setup();
    const adapter: RenderAdapter = { render: () => Promise.reject(new Error("renderer stopped")) };
    await expect(
      coordinator.execute({ ...job, idempotencyKey: "failed-run" }, composition, adapter)
    ).rejects.toThrow("renderer stopped");
    expect((await ledger.read()).at(-1)?.status).toBe("failed");
  });
});
