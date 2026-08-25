import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const goldenCaseSchema = z.object({
  schemaVersion: z.literal(1),
  caseId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  title: z.string().min(1),
  expectedCuts: z.array(
    z.object({
      sourceStartSeconds: z.number().nonnegative(),
      sourceEndSeconds: z.number().positive(),
      toleranceSeconds: z.number().nonnegative()
    })
  ),
  duration: z.object({
    minimumSeconds: z.number().nonnegative(),
    maximumSeconds: z.number().positive()
  }),
  requiredCaptions: z.array(z.string().min(1)),
  expectedQaFailures: z.array(z.string().min(1)),
  expectedVerdict: z.enum(["pass", "warn", "fail"]),
  baselineMinutes: z.number().nonnegative(),
  actualMinutes: z.number().nonnegative(),
  reworkCount: z.number().int().nonnegative()
});

export const caseResultSchema = z.object({
  caseId: z.string(),
  passed: z.boolean(),
  editValid: z.boolean(),
  cutRecall: z.number().min(0).max(1),
  durationCompliant: z.boolean(),
  captionCoverage: z.number().min(0).max(1),
  qaRecall: z.number().min(0).max(1),
  verdictMatched: z.boolean(),
  timeSavedMinutes: z.number(),
  reworkCount: z.number().int().nonnegative(),
  evidence: z.array(z.string())
});

export const evalSummarySchema = z.object({
  schemaVersion: z.literal(1),
  evaluationId: digest,
  cases: z.array(caseResultSchema).min(1),
  passRate: z.number().min(0).max(1),
  averageCutRecall: z.number().min(0).max(1),
  averageCaptionCoverage: z.number().min(0).max(1),
  averageQaRecall: z.number().min(0).max(1),
  totalTimeSavedMinutes: z.number(),
  totalReworkCount: z.number().int().nonnegative()
});

export type GoldenCase = z.infer<typeof goldenCaseSchema>;
export type CaseResult = z.infer<typeof caseResultSchema>;
export type EvalSummary = z.infer<typeof evalSummarySchema>;
