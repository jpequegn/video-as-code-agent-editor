import { expect, it } from "vitest";

import { evaluateQa, DEFAULT_QA_POLICY } from "../src/qa/evaluate.js";
import type { QaObservations } from "../src/qa/schema.js";
import { testComposition } from "./helpers/composition.js";

const digest = "a".repeat(64);
const composition = testComposition();
const observations: QaObservations = {
  schemaVersion: 1,
  mediaHash: digest,
  toolVersion: "ffmpeg test",
  probe: {
    durationSeconds: 1,
    width: 320,
    height: 180,
    hasVideo: true,
    hasAudio: true,
    rawHash: digest,
    command: []
  },
  blackSegments: [],
  silenceSegments: [],
  audioPeakDb: -1,
  detectors: []
};

it("changes policy verdicts without changing observations", () => {
  const first = evaluateQa(observations, composition);
  const stricter = evaluateQa(observations, composition, {
    ...DEFAULT_QA_POLICY,
    maximumAudioPeakDb: -2
  });
  expect(first.verdict).toBe("pass");
  expect(stricter.verdict).toBe("warn");
  expect(stricter.observations).toEqual(first.observations);
  expect(stricter.observationHash).toBe(first.observationHash);
});

it("reports missing evidence as unknown", () => {
  const report = evaluateQa({ ...observations, audioPeakDb: null }, composition);
  expect(report.findings.find((finding) => finding.code === "audio_peak")?.status).toBe("unknown");
});

it("detects estimated caption clipping", () => {
  const clipped = {
    ...composition,
    captions: [
      {
        id: "long",
        startFrame: 0,
        endFrame: 30,
        text: "x".repeat(300),
        position: "bottom" as const
      }
    ]
  };
  const report = evaluateQa(observations, clipped);
  expect(report.findings.find((finding) => finding.code === "caption_safe_area")?.status).toBe(
    "fail"
  );
});
