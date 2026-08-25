import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const compositionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  compositionId: digest,
  planId: digest,
  mediaManifestId: digest,
  compiler: z.object({ name: z.literal("vace-composition-compiler"), version: z.string() }),
  video: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
    durationInFrames: z.number().int().positive(),
    durationSeconds: z.number().positive()
  }),
  asset: z.object({
    assetId: digest,
    publicPath: z.string().regex(/^assets\/[a-f0-9]{64}\.mp4$/),
    sourceObjectPath: z.string().regex(/^objects\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/),
    codec: z.string().min(1)
  }),
  timeline: z.array(
    z.object({
      segmentId: z.string().min(1),
      timelineStartFrame: z.number().int().nonnegative(),
      durationInFrames: z.number().int().positive(),
      sourceStartFrame: z.number().int().nonnegative(),
      label: z.string().min(1),
      transition: z
        .object({ type: z.enum(["cut", "fade"]), durationInFrames: z.number().int().nonnegative() })
        .nullable()
    })
  ),
  captions: z.array(
    z.object({
      id: z.string().min(1),
      startFrame: z.number().int().nonnegative(),
      endFrame: z.number().int().positive(),
      text: z.string().min(1),
      position: z.enum(["top", "bottom"])
    })
  ),
  highlights: z.array(
    z.object({
      startFrame: z.number().int().nonnegative(),
      endFrame: z.number().int().positive(),
      label: z.string().min(1),
      color: z.string()
    })
  ),
  audioMarkers: z.array(
    z.object({
      kind: z.enum(["music", "voiceover"]),
      startFrame: z.number().int().nonnegative(),
      endFrame: z.number().int().positive(),
      note: z.string().min(1),
      gainDb: z.number()
    })
  )
});

export type CompositionManifest = z.infer<typeof compositionManifestSchema>;
