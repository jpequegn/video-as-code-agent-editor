import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import { planDecisionSchema, type CreativePlan, type PlanDecision } from "./schema.js";

export type DecisionInput = Omit<
  PlanDecision,
  "schemaVersion" | "sequence" | "previousEventHash" | "eventHash"
>;

export function createDecision(input: DecisionInput, previous?: PlanDecision): PlanDecision {
  if (input.action === "revised" && !input.replacementPlanId) {
    throw new Error("A revised decision requires replacementPlanId");
  }
  if (input.action !== "revised" && input.replacementPlanId) {
    throw new Error("replacementPlanId is only valid for revised decisions");
  }
  const identity = {
    schemaVersion: 1 as const,
    sequence: (previous?.sequence ?? 0) + 1,
    ...input,
    previousEventHash: previous?.eventHash ?? null
  };
  return planDecisionSchema.parse({ ...identity, eventHash: sha256(canonicalJson(identity)) });
}

export function verifyDecisionChain(events: PlanDecision[]): void {
  let previous: PlanDecision | undefined;
  for (const event of events) {
    const expected = createDecision(
      {
        action: event.action,
        targetPlanId: event.targetPlanId,
        ...(event.replacementPlanId ? { replacementPlanId: event.replacementPlanId } : {}),
        actor: event.actor,
        timestamp: event.timestamp,
        reason: event.reason
      },
      previous
    );
    if (expected.eventHash !== event.eventHash || expected.sequence !== event.sequence) {
      throw new Error(`Invalid decision chain at sequence ${event.sequence}`);
    }
    previous = event;
  }
}

export function isPlanApproved(planId: string, events: PlanDecision[]): boolean {
  verifyDecisionChain(events);
  const latest = events.filter((event) => event.targetPlanId === planId).at(-1);
  return latest?.action === "approved";
}

export function requireApprovedPlan(plan: CreativePlan, events: PlanDecision[]): void {
  if (!isPlanApproved(plan.planId, events)) {
    throw new Error(`Plan ${plan.planId} is not approved`);
  }
}

export class DecisionLog {
  public constructor(private readonly filePath: string) {}

  public async read(): Promise<PlanDecision[]> {
    try {
      const body = await readFile(this.filePath, "utf8");
      const events = body
        .split("\n")
        .filter(Boolean)
        .map((line) => planDecisionSchema.parse(JSON.parse(line) as unknown));
      verifyDecisionChain(events);
      return events;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }

  public async append(input: DecisionInput): Promise<PlanDecision> {
    const events = await this.read();
    const decision = createDecision(input, events.at(-1));
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${canonicalJson(decision)}\n`, { flag: "a" });
    return decision;
  }
}
