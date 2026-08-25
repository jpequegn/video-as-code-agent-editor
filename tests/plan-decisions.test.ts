import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DecisionLog, isPlanApproved, requireApprovedPlan } from "../src/plan/decisions.js";
import type { CreativePlan } from "../src/plan/schema.js";

const planId = "1".repeat(64);

describe("plan decision history", () => {
  it("requires approval for the exact current plan hash", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vace-decisions-"));
    const log = new DecisionLog(path.join(root, "decisions.jsonl"));
    await log.append({
      action: "approved",
      targetPlanId: planId,
      actor: "reviewer@example.test",
      timestamp: "2026-08-24T12:00:00.000Z",
      reason: "Ranges and captions reviewed"
    });
    expect(isPlanApproved(planId, await log.read())).toBe(true);
    expect(isPlanApproved("2".repeat(64), await log.read())).toBe(false);
  });

  it("invalidates approval when the plan is revised", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "vace-revision-"));
    const log = new DecisionLog(path.join(root, "decisions.jsonl"));
    await log.append({
      action: "approved",
      targetPlanId: planId,
      actor: "reviewer@example.test",
      timestamp: "2026-08-24T12:00:00.000Z",
      reason: "Approved"
    });
    await log.append({
      action: "revised",
      targetPlanId: planId,
      replacementPlanId: "2".repeat(64),
      actor: "editor@example.test",
      timestamp: "2026-08-24T12:05:00.000Z",
      reason: "Shorten the hook"
    });
    const events = await log.read();
    expect(isPlanApproved(planId, events)).toBe(false);
    expect(() => requireApprovedPlan({ planId } as CreativePlan, events)).toThrow(
      "is not approved"
    );
  });
});
