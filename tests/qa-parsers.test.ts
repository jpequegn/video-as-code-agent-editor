import { expect, it } from "vitest";

import { parseBlackSegments, parsePeakDb, parseSilenceSegments } from "../src/qa/detectors.js";

it("parses FFmpeg detector evidence", () => {
  expect(parseBlackSegments("black_start:0 black_end:1.2 black_duration:1.2")).toEqual([
    { startSeconds: 0, endSeconds: 1.2, durationSeconds: 1.2 }
  ]);
  expect(
    parseSilenceSegments("silence_start: 0\nsilence_end: 0.7 | silence_duration: 0.7", 1)
  ).toEqual([{ startSeconds: 0, endSeconds: 0.7, durationSeconds: 0.7 }]);
  expect(parsePeakDb("max_volume: -0.2 dB")).toBe(-0.2);
  expect(parsePeakDb("no audio")).toBeNull();
});
