import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildDockerCommand } from "../src/render/docker.js";
import type { RenderJob } from "../src/render/schema.js";

const job = {
  schemaVersion: 1,
  jobId: "1".repeat(64),
  idempotencyKey: "docker-run",
  compositionId: "2".repeat(64),
  planId: "3".repeat(64),
  mode: "docker",
  outputFile: `renders/${"2".repeat(64)}.mp4`,
  timeoutMs: 10_000
} satisfies RenderJob;

describe("Docker render command", () => {
  it("uses read-only mounts, no network, non-root identity, and resource limits", () => {
    const args = buildDockerCommand({
      job,
      image: "vace-renderer:test",
      artifactRoot: "/tmp/vace-artifacts",
      publicRoot: "/tmp/vace-public",
      outputRoot: "/tmp/vace-output"
    });
    expect(args).toContain("none");
    expect(args).toContain("--read-only");
    expect(args).toContain("10001:10001");
    expect(args.filter((argument) => argument.includes("readonly"))).toHaveLength(2);
  });

  it("rejects output nested beneath a source root", () => {
    expect(() =>
      buildDockerCommand({
        job,
        image: "vace-renderer:test",
        artifactRoot: "/tmp/vace-artifacts",
        publicRoot: "/tmp/vace-public",
        outputRoot: path.join("/tmp/vace-public", "output")
      })
    ).toThrow("must not overlap");
  });
});
