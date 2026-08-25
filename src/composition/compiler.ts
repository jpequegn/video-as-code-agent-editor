import { constants } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import { ContentStore } from "../media/content-store.js";
import type { MediaManifest } from "../media/schema.js";
import { requireApprovedPlan } from "../plan/decisions.js";
import type { CreativePlan, PlanDecision } from "../plan/schema.js";
import { validatePlanForMedia } from "../plan/validate.js";
import { compositionManifestSchema, type CompositionManifest } from "./schema.js";

export const COMPILER_VERSION = "1.0.0";

function secondsToFrames(seconds: number, fps: number): number {
  return Math.max(0, Math.round(seconds * fps));
}

async function writeImmutable(target: string, body: string): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await writeFile(target, body, { flag: "wx" });
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    if ((await readFile(target, "utf8")) !== body) {
      throw new Error(`Immutable composition artifact differs: ${target}`);
    }
  }
}

async function publishAsset(source: string, target: string, expectedDigest: string): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await copyFile(source, target, constants.COPYFILE_EXCL);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
  }
  const digest = sha256(await readFile(target));
  if (digest !== expectedDigest) throw new Error(`Published asset hash mismatch: ${target}`);
}

export async function compileComposition(options: {
  plan: CreativePlan;
  media: MediaManifest;
  decisions: PlanDecision[];
  storeRoot: string;
  artifactRoot: string;
  publicRoot: string;
}): Promise<{ manifest: CompositionManifest; jsonPath: string; modulePath: string }> {
  requireApprovedPlan(options.plan, options.decisions);
  const plan = validatePlanForMedia(options.plan, options.media);
  if (plan.output.width > 3840 || plan.output.height > 2160) {
    throw new Error("Output dimensions exceed the 3840x2160 compiler limit");
  }

  const store = new ContentStore(options.storeRoot);
  if (!(await store.has(options.media.source))) {
    throw new Error(`Missing source object: ${options.media.source.objectPath}`);
  }
  const publicPath = `assets/${options.media.assetId}.mp4`;
  await publishAsset(
    store.resolve(options.media.source),
    path.join(options.publicRoot, ...publicPath.split("/")),
    options.media.assetId
  );

  const fps = plan.output.frameRate;
  let timelineFrame = 0;
  const timeline = plan.segments.map((segment) => {
    const durationInFrames = Math.max(
      1,
      secondsToFrames(segment.sourceEndSeconds - segment.sourceStartSeconds, fps)
    );
    const transition = plan.transitions.find((entry) => entry.afterSegmentId === segment.id);
    const compiled = {
      segmentId: segment.id,
      timelineStartFrame: timelineFrame,
      durationInFrames,
      sourceStartFrame: secondsToFrames(segment.sourceStartSeconds, fps),
      label: segment.label,
      transition: transition
        ? {
            type: transition.type,
            durationInFrames: secondsToFrames(transition.durationSeconds, fps)
          }
        : null
    };
    timelineFrame += durationInFrames;
    return compiled;
  });
  if (timelineFrame > fps * 60 * 60 * 2) throw new Error("Composition exceeds the two-hour limit");

  const identity = {
    schemaVersion: 1 as const,
    planId: plan.planId,
    mediaManifestId: options.media.manifestId,
    compiler: { name: "vace-composition-compiler" as const, version: COMPILER_VERSION },
    video: {
      width: plan.output.width,
      height: plan.output.height,
      fps,
      durationInFrames: timelineFrame,
      durationSeconds: timelineFrame / fps
    },
    asset: {
      assetId: options.media.assetId,
      publicPath,
      sourceObjectPath: options.media.source.objectPath,
      codec: options.media.video.codec
    },
    timeline,
    captions: plan.captions.map((caption) => ({
      id: caption.id,
      startFrame: secondsToFrames(caption.startSeconds, fps),
      endFrame: secondsToFrames(caption.endSeconds, fps),
      text: caption.text,
      position: caption.position
    })),
    highlights: plan.highlights.map((highlight) => ({
      startFrame: secondsToFrames(highlight.startSeconds, fps),
      endFrame: secondsToFrames(highlight.endSeconds, fps),
      label: highlight.label,
      color: highlight.color
    })),
    audioMarkers: plan.audioMarkers.map((marker) => ({
      kind: marker.kind,
      startFrame: secondsToFrames(marker.startSeconds, fps),
      endFrame: secondsToFrames(marker.endSeconds, fps),
      note: marker.note,
      gainDb: marker.gainDb
    }))
  };
  const manifest = compositionManifestSchema.parse({
    ...identity,
    compositionId: sha256(canonicalJson(identity))
  });
  const directory = path.join(options.artifactRoot, manifest.compositionId);
  const jsonPath = path.join(directory, "composition.json");
  const modulePath = path.join(directory, "composition.ts");
  await writeImmutable(jsonPath, `${canonicalJson(manifest)}\n`);
  await writeImmutable(modulePath, `export default ${canonicalJson(manifest)} as const;\n`);
  return { manifest, jsonPath, modulePath };
}
