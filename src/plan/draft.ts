import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import type { MediaManifest } from "../media/schema.js";
import { creativePlanSchema, type CreativePlan } from "./schema.js";

export interface DraftOptions {
  title: string;
  brief: string;
  hook?: string;
  template?: "concise-talk" | "full-take";
}

export function computePlanId(plan: Omit<CreativePlan, "planId">): string {
  return sha256(canonicalJson(plan));
}

export function draftPlan(manifest: MediaManifest, options: DraftOptions): CreativePlan {
  const template = options.template ?? "concise-talk";
  const transcript = manifest.transcript;
  const start = template === "full-take" ? 0 : (transcript[0]?.startSeconds ?? 0);
  const end =
    template === "full-take"
      ? manifest.durationSeconds
      : (transcript.at(-1)?.endSeconds ?? manifest.durationSeconds);
  const boundedEnd = Math.min(end, manifest.durationSeconds);
  const duration = boundedEnd - start;
  const captions = transcript.map((segment, index) => ({
    id: `caption-${index + 1}`,
    startSeconds: Math.max(0, segment.startSeconds - start),
    endSeconds: Math.min(duration, segment.endSeconds - start),
    text: segment.text,
    position: "bottom" as const
  }));
  const identity: Omit<CreativePlan, "planId"> = {
    schemaVersion: 1,
    mediaManifestId: manifest.manifestId,
    title: options.title,
    brief: options.brief,
    hook: options.hook ?? transcript[0]?.text ?? options.title,
    output: {
      width: manifest.video.width,
      height: manifest.video.height,
      frameRate: Math.round(
        manifest.video.frameRate.numerator / manifest.video.frameRate.denominator
      ),
      targetDurationSeconds: duration,
      maxDurationSeconds: Math.max(duration, 1)
    },
    segments: [
      {
        id: "take-1",
        sourceAssetId: manifest.assetId,
        sourceStartSeconds: start,
        sourceEndSeconds: boundedEnd,
        label: template === "concise-talk" ? "Transcript-backed primary take" : "Full primary take"
      }
    ],
    captions,
    highlights: [],
    audioMarkers: [],
    transitions: [],
    constraints: {
      maxCaptionCharacters: 96,
      captionSafeAreaPercent: 10,
      allowedVideoCodecs: ["h264", "hevc", "vp9", "av1"]
    },
    template: { name: template, version: "1.0.0" }
  };
  return creativePlanSchema.parse({ ...identity, planId: computePlanId(identity) });
}
