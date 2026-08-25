import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import { renderEventSchema, type RenderEvent, type RenderJob } from "./schema.js";

export type Clock = () => string;

function createEvent(options: {
  job: RenderJob;
  status: RenderEvent["status"];
  detail: string;
  outputHash?: string;
  previous?: RenderEvent;
  now: Clock;
}): RenderEvent {
  const identity = {
    schemaVersion: 1 as const,
    sequence: (options.previous?.sequence ?? 0) + 1,
    jobId: options.job.jobId,
    idempotencyKey: options.job.idempotencyKey,
    status: options.status,
    timestamp: options.now(),
    detail: options.detail,
    outputHash: options.outputHash ?? null,
    previousEventHash: options.previous?.eventHash ?? null
  };
  return renderEventSchema.parse({ ...identity, eventHash: sha256(canonicalJson(identity)) });
}

export class RenderLedger {
  public constructor(
    private readonly filePath: string,
    private readonly now: Clock = () => new Date().toISOString()
  ) {}

  public async read(): Promise<RenderEvent[]> {
    try {
      return (await readFile(this.filePath, "utf8"))
        .split("\n")
        .filter(Boolean)
        .map((line) => renderEventSchema.parse(JSON.parse(line) as unknown));
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
      throw error;
    }
  }

  public async append(
    job: RenderJob,
    status: RenderEvent["status"],
    detail: string,
    outputHash?: string
  ): Promise<RenderEvent> {
    const events = await this.read();
    const previous = events.at(-1);
    const event = createEvent({
      job,
      status,
      detail,
      ...(outputHash ? { outputHash } : {}),
      ...(previous ? { previous } : {}),
      now: this.now
    });
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${canonicalJson(event)}\n`);
    return event;
  }
}
