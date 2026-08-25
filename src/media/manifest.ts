import { readFile } from "node:fs/promises";

import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import { ContentStore } from "./content-store.js";
import { probeMedia } from "./ffprobe.js";
import {
  mediaManifestSchema,
  transcriptSegmentSchema,
  type MediaManifest,
  type SceneBoundary,
  type TranscriptSegment
} from "./schema.js";

async function loadTranscript(sidecarPath?: string): Promise<TranscriptSegment[]> {
  if (!sidecarPath) return [];
  const raw = JSON.parse(await readFile(sidecarPath, "utf8")) as unknown;
  return transcriptSegmentSchema.array().parse(raw);
}

export async function buildMediaManifest(options: {
  sourcePath: string;
  storeRoot: string;
  transcriptPath?: string;
  scenes?: SceneBoundary[];
}): Promise<MediaManifest> {
  const store = new ContentStore(options.storeRoot);
  const source = await store.ingest(options.sourcePath);
  const probe = probeMedia(options.sourcePath);
  const transcript = await loadTranscript(options.transcriptPath);
  const scenes = options.scenes ?? [];
  const provenance = [
    {
      tool: "ffprobe",
      version: probe.version,
      command: probe.command,
      outputHash: sha256(probe.raw)
    }
  ];
  const identity = {
    schemaVersion: 1,
    assetId: source.digest,
    source,
    container: probe.container,
    durationSeconds: probe.durationSeconds,
    video: probe.video,
    audio: probe.audio,
    transcript,
    scenes,
    provenance
  } as const;
  const manifest = mediaManifestSchema.parse({
    ...identity,
    manifestId: sha256(canonicalJson(identity))
  });
  await store.writeManifest(manifest);
  return manifest;
}
