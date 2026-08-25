import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const renderJobSchema = z.object({
  schemaVersion: z.literal(1),
  jobId: digest,
  idempotencyKey: z.string().regex(/^[a-zA-Z0-9._-]{1,120}$/),
  compositionId: digest,
  planId: digest,
  mode: z.enum(["fake", "fixture", "local", "docker"]),
  outputFile: z.string().regex(/^renders\/[a-f0-9]{64}\.mp4$/),
  timeoutMs: z.number().int().min(1000).max(3_600_000)
});

export const renderEventSchema = z.object({
  schemaVersion: z.literal(1),
  sequence: z.number().int().positive(),
  jobId: digest,
  idempotencyKey: z.string(),
  status: z.enum(["prepared", "running", "succeeded", "failed", "cancelled"]),
  timestamp: z.string().datetime(),
  detail: z.string(),
  outputHash: digest.nullable(),
  previousEventHash: digest.nullable(),
  eventHash: digest
});

export const renderReceiptSchema = z.object({
  schemaVersion: z.literal(1),
  jobId: digest,
  compositionId: digest,
  outputFile: z.string().regex(/^renders\/[a-f0-9]{64}\.mp4$/),
  outputHash: digest,
  rendererMode: z.enum(["fake", "fixture", "local", "docker"]),
  finalEventHash: digest
});

export type RenderJob = z.infer<typeof renderJobSchema>;
export type RenderEvent = z.infer<typeof renderEventSchema>;
export type RenderReceipt = z.infer<typeof renderReceiptSchema>;
