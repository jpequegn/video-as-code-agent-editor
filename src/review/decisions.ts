import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import { reviewDecisionSchema, type ReviewDecision } from "./schema.js";

type ReviewDecisionInput = Omit<
  ReviewDecision,
  "schemaVersion" | "sequence" | "previousEventHash" | "eventHash"
>;

export class ReviewDecisionLog {
  public constructor(private readonly filePath: string) {}

  public async read(): Promise<ReviewDecision[]> {
    try {
      return (await readFile(this.filePath, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => reviewDecisionSchema.parse(JSON.parse(line) as unknown));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }

  public async append(input: ReviewDecisionInput): Promise<ReviewDecision> {
    const events = await this.read();
    const previous = events.at(-1);
    const identity = {
      schemaVersion: 1 as const,
      sequence: (previous?.sequence ?? 0) + 1,
      ...input,
      previousEventHash: previous?.eventHash ?? null
    };
    const event = reviewDecisionSchema.parse({
      ...identity,
      eventHash: sha256(canonicalJson(identity))
    });
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${canonicalJson(event)}\n`);
    return event;
  }
}
