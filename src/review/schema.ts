import { z } from "zod";

const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const reviewPacketSchema = z.object({
  schemaVersion: z.literal(1),
  packetId: digest,
  title: z.string().min(1),
  sourceManifestId: digest,
  planId: digest,
  approvalEventHash: digest,
  compositionId: digest,
  renderHash: digest,
  qaReportId: digest,
  evaluationId: digest,
  previewLink: z.string().regex(/^(?!\/)(?!.*\.\.)[a-zA-Z0-9._/-]+$/),
  verdict: z.enum(["approve", "review", "reject"]),
  claims: z.array(
    z.object({ statement: z.string().min(1), evidence: z.array(z.string().min(1)).min(1) })
  ),
  actions: z.array(z.enum(["approve", "reject", "revise"]))
});

export const reviewDecisionSchema = z.object({
  schemaVersion: z.literal(1),
  sequence: z.number().int().positive(),
  packetId: digest,
  action: z.enum(["approved", "rejected", "revise_requested"]),
  actor: z.string().min(1),
  timestamp: z.string().datetime(),
  reason: z.string().min(1),
  previousEventHash: digest.nullable(),
  eventHash: digest
});

export type ReviewPacket = z.infer<typeof reviewPacketSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
