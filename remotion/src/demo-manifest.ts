import type { CompositionManifest } from "../../src/composition/schema.js";

const digest = "0".repeat(64);

export const demoManifest: CompositionManifest = {
  schemaVersion: 1,
  compositionId: digest,
  planId: digest,
  mediaManifestId: digest,
  compiler: { name: "vace-composition-compiler", version: "1.0.0" },
  video: { width: 640, height: 360, fps: 30, durationInFrames: 90, durationSeconds: 3 },
  asset: {
    assetId: digest,
    publicPath: `assets/${digest}.mp4`,
    sourceObjectPath: `objects/sha256/00/${digest}`,
    codec: "h264"
  },
  timeline: [
    {
      segmentId: "demo",
      timelineStartFrame: 0,
      durationInFrames: 90,
      sourceStartFrame: 0,
      label: "Demo clip",
      transition: null
    }
  ],
  captions: [],
  highlights: [],
  audioMarkers: []
};
