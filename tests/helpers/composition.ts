import type { CompositionManifest } from "../../src/composition/schema.js";

export function testComposition(): CompositionManifest {
  const digest = "c".repeat(64);
  return {
    schemaVersion: 1,
    compositionId: digest,
    planId: "d".repeat(64),
    mediaManifestId: "e".repeat(64),
    compiler: { name: "vace-composition-compiler", version: "1.0.0" },
    video: { width: 320, height: 180, fps: 30, durationInFrames: 30, durationSeconds: 1 },
    asset: {
      assetId: "f".repeat(64),
      publicPath: `assets/${"f".repeat(64)}.mp4`,
      sourceObjectPath: `objects/sha256/ff/${"f".repeat(64)}`,
      codec: "h264"
    },
    timeline: [
      {
        segmentId: "test",
        timelineStartFrame: 0,
        durationInFrames: 30,
        sourceStartFrame: 0,
        label: "Test",
        transition: null
      }
    ],
    captions: [],
    highlights: [],
    audioMarkers: []
  };
}
