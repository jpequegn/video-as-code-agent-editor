import { access, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runDemo } from "../src/workflow/runner.js";

describe("end-to-end generated media workflow", () => {
  it("stops at the unapproved draft by default", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "vace-draft-demo-"));
    const result = await runDemo({
      workspace,
      fixtureKind: "good",
      approve: false,
      renderer: "fixture"
    });
    expect(result.status).toBe("awaiting-approval");
  });

  it("produces stable identities, valid media, and a review packet", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "vace-clean-demo-"));
    const first = await runDemo({
      workspace,
      fixtureKind: "good",
      approve: true,
      renderer: "fixture"
    });
    const second = await runDemo({
      workspace,
      fixtureKind: "good",
      approve: true,
      renderer: "fixture"
    });
    expect(first.status).toBe("complete");
    if (first.status !== "complete" || second.status !== "complete") {
      throw new Error("Expected completed demos");
    }
    expect(first.packet.verdict).toBe("approve");
    expect(first.qa.verdict).toBe("pass");
    expect(first.evaluation.passRate).toBe(1);
    expect(second.plan.planId).toBe(first.plan.planId);
    expect(second.composition.compositionId).toBe(first.composition.compositionId);
    await expect(access(first.markdownPath)).resolves.toBeUndefined();
    expect(await readFile(first.markdownPath, "utf8")).toContain("Review actions");
  });

  it("rejects an injected black-frame render at the QA gate", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "vace-black-demo-"));
    const result = await runDemo({
      workspace,
      fixtureKind: "black",
      approve: true,
      renderer: "fixture"
    });
    expect(result.status).toBe("complete");
    if (result.status !== "complete") throw new Error("Expected a completed failure-path demo");
    expect(result.packet.verdict).toBe("reject");
    expect(result.qa.findings.find((finding) => finding.code === "black_frames")?.status).toBe(
      "fail"
    );
    expect(result.evaluation.passRate).toBe(1);
  });
});
