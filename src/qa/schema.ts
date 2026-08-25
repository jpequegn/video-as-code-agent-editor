import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/);

const intervalSchema = z.object({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
  durationSeconds: z.number().nonnegative()
});

export const qaPolicySchema = z.object({
  schemaVersion: z.literal(1),
  durationToleranceSeconds: z.number().nonnegative(),
  black: z.object({
    minimumDurationSeconds: z.number().nonnegative(),
    pictureBlackRatio: z.number().min(0).max(1)
  }),
  silence: z.object({
    minimumDurationSeconds: z.number().nonnegative(),
    noiseDb: z.number().max(0)
  }),
  maximumAudioPeakDb: z.number().max(0),
  captionSafeAreaPercent: z.number().min(5).max(40),
  maximumCaptionLines: z.number().int().positive()
});

export const qaObservationsSchema = z.object({
  schemaVersion: z.literal(1),
  mediaHash: digest,
  toolVersion: z.string().min(1),
  probe: z.object({
    durationSeconds: z.number().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    hasVideo: z.boolean(),
    hasAudio: z.boolean(),
    rawHash: digest,
    command: z.array(z.string())
  }),
  blackSegments: z.array(intervalSchema),
  silenceSegments: z.array(intervalSchema),
  audioPeakDb: z.number().nullable(),
  detectors: z.array(
    z.object({
      name: z.string(),
      command: z.array(z.string()),
      rawHash: digest,
      exitCode: z.number().int()
    })
  )
});

export const qaFindingSchema = z.object({
  code: z.string().min(1),
  status: z.enum(["pass", "fail", "unknown"]),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string().min(1),
  evidenceSeconds: z.array(z.number().nonnegative())
});

export const qaReportSchema = z.object({
  schemaVersion: z.literal(1),
  reportId: digest,
  mediaHash: digest,
  compositionId: digest,
  policyHash: digest,
  observationHash: digest,
  verdict: z.enum(["pass", "warn", "fail"]),
  findings: z.array(qaFindingSchema),
  observations: qaObservationsSchema
});

export type QaPolicy = z.infer<typeof qaPolicySchema>;
export type QaObservations = z.infer<typeof qaObservationsSchema>;
export type QaFinding = z.infer<typeof qaFindingSchema>;
export type QaReport = z.infer<typeof qaReportSchema>;
