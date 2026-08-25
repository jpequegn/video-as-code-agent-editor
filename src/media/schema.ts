import { z } from "zod";

const sha256Digest = z.string().regex(/^[a-f0-9]{64}$/);

export const contentReferenceSchema = z.object({
  algorithm: z.literal("sha256"),
  digest: sha256Digest,
  bytes: z.number().int().nonnegative(),
  objectPath: z.string().regex(/^objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/)
});

export const transcriptSegmentSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().min(1),
  speaker: z.string().min(1).optional()
});

export const sceneBoundarySchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  score: z.number().min(0).max(1)
});

export const mediaManifestSchema = z.object({
  schemaVersion: z.literal(1),
  manifestId: sha256Digest,
  assetId: sha256Digest,
  source: contentReferenceSchema,
  container: z.string().min(1),
  durationSeconds: z.number().positive(),
  video: z.object({
    codec: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    frameRate: z.object({
      numerator: z.number().int().positive(),
      denominator: z.number().int().positive()
    })
  }),
  audio: z
    .object({
      codec: z.string().min(1),
      channels: z.number().int().positive(),
      sampleRate: z.number().int().positive()
    })
    .nullable(),
  transcript: z.array(transcriptSegmentSchema),
  scenes: z.array(sceneBoundarySchema),
  provenance: z.array(
    z.object({
      tool: z.string().min(1),
      version: z.string().min(1),
      command: z.array(z.string()),
      outputHash: sha256Digest
    })
  )
});

export type ContentReference = z.infer<typeof contentReferenceSchema>;
export type MediaManifest = z.infer<typeof mediaManifestSchema>;
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;
export type SceneBoundary = z.infer<typeof sceneBoundarySchema>;
