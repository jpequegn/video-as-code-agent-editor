import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { expect, it } from "vitest";

import { ReviewDecisionLog } from "../src/review/decisions.js";

it("preserves append-only reviewer decisions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vace-review-decisions-"));
  const log = new ReviewDecisionLog(path.join(root, "decisions.jsonl"));
  const first = await log.append({
    packetId: "a".repeat(64),
    action: "revise_requested",
    actor: "reviewer@example.test",
    timestamp: "2026-08-24T12:00:00.000Z",
    reason: "Move the first caption"
  });
  const second = await log.append({
    packetId: "b".repeat(64),
    action: "approved",
    actor: "reviewer@example.test",
    timestamp: "2026-08-24T12:05:00.000Z",
    reason: "Revision accepted"
  });
  expect(second.previousEventHash).toBe(first.eventHash);
  expect((await log.read()).map((event) => event.action)).toEqual(["revise_requested", "approved"]);
});
