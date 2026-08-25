import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const editSegmentSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  sourceAssetId: digest,
  sourceStartSeconds: z.number().nonnegative(),
  sourceEndSeconds: z.number().positive(),
  label: z.string().min(1)
});

export const captionSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  text: z.string().min(1).max(240),
  position: z.enum(["top", "bottom"]).default("bottom")
});

export const creativePlanSchema = z
  .object({
    schemaVersion: z.literal(1),
    planId: digest,
    mediaManifestId: digest,
    title: z.string().min(1).max(120),
    brief: z.string().min(1).max(2000),
    hook: z.string().min(1).max(240),
    output: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      frameRate: z.number().int().min(1).max(120),
      targetDurationSeconds: z.number().positive(),
      maxDurationSeconds: z.number().positive()
    }),
    segments: z.array(editSegmentSchema).min(1),
    captions: z.array(captionSchema),
    highlights: z.array(
      z.object({
        startSeconds: z.number().nonnegative(),
        endSeconds: z.number().positive(),
        label: z.string().min(1).max(80),
        color: z.string().regex(/^#[a-fA-F0-9]{6}$/)
      })
    ),
    audioMarkers: z.array(
      z.object({
        kind: z.enum(["music", "voiceover"]),
        startSeconds: z.number().nonnegative(),
        endSeconds: z.number().positive(),
        note: z.string().min(1).max(240),
        gainDb: z.number().min(-60).max(12)
      })
    ),
    transitions: z.array(
      z.object({
        afterSegmentId: z.string().min(1),
        type: z.enum(["cut", "fade"]),
        durationSeconds: z.number().min(0).max(2)
      })
    ),
    constraints: z.object({
      maxCaptionCharacters: z.number().int().min(10).max(240),
      captionSafeAreaPercent: z.number().min(5).max(40),
      allowedVideoCodecs: z.array(z.string().min(1)).min(1)
    }),
    template: z.object({ name: z.string().min(1), version: z.string().min(1) })
  })
  .superRefine((plan, context) => {
    if (plan.output.targetDurationSeconds > plan.output.maxDurationSeconds) {
      context.addIssue({
        code: "custom",
        path: ["output", "targetDurationSeconds"],
        message: "target duration exceeds maximum duration"
      });
    }

    const segmentIds = new Set<string>();
    for (const segment of plan.segments) {
      if (segment.sourceEndSeconds <= segment.sourceStartSeconds) {
        context.addIssue({
          code: "custom",
          path: ["segments", segment.id],
          message: "segment end must follow start"
        });
      }
      if (segmentIds.has(segment.id)) {
        context.addIssue({
          code: "custom",
          path: ["segments"],
          message: "segment IDs must be unique"
        });
      }
      segmentIds.add(segment.id);
    }

    for (const caption of plan.captions) {
      if (caption.endSeconds <= caption.startSeconds) {
        context.addIssue({
          code: "custom",
          path: ["captions", caption.id],
          message: "caption end must follow start"
        });
      }
      if (caption.endSeconds > plan.output.maxDurationSeconds) {
        context.addIssue({
          code: "custom",
          path: ["captions", caption.id],
          message: "caption exceeds output duration"
        });
      }
      if (caption.text.length > plan.constraints.maxCaptionCharacters) {
        context.addIssue({
          code: "custom",
          path: ["captions", caption.id],
          message: "caption exceeds plan character limit"
        });
      }
    }

    for (const transition of plan.transitions) {
      if (!segmentIds.has(transition.afterSegmentId)) {
        context.addIssue({
          code: "custom",
          path: ["transitions"],
          message: "transition references an unknown segment"
        });
      }
    }
  });

export const planDecisionSchema = z.object({
  schemaVersion: z.literal(1),
  sequence: z.number().int().positive(),
  action: z.enum(["approved", "rejected", "revised"]),
  targetPlanId: digest,
  replacementPlanId: digest.optional(),
  actor: z.string().min(1),
  timestamp: z.string().datetime(),
  reason: z.string().min(1),
  previousEventHash: digest.nullable(),
  eventHash: digest
});

export type CreativePlan = z.infer<typeof creativePlanSchema>;
export type PlanDecision = z.infer<typeof planDecisionSchema>;
