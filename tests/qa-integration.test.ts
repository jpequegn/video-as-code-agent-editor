import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import { collectQaObservations } from "../src/qa/detectors.js";
import { evaluateQa } from "../src/qa/evaluate.js";
import { generateQaFixtures } from "../src/qa/fixtures.js";
import { testComposition } from "./helpers/composition.js";

const composition = testComposition();

describe("FFmpeg QA integration", () => {
  let fixtures: Awaited<ReturnType<typeof generateQaFixtures>>;

  beforeAll(async () => {
    fixtures = await generateQaFixtures(await mkdtemp(path.join(os.tmpdir(), "vace-qa-")));
  });

  it("passes the clean generated fixture", async () => {
    expect(evaluateQa(await collectQaObservations(fixtures.good), composition).verdict).toBe(
      "pass"
    );
  });

  it("detects black frames", async () => {
    const report = evaluateQa(await collectQaObservations(fixtures.black), composition);
    expect(report.findings.find((finding) => finding.code === "black_frames")?.status).toBe("fail");
  });

  it("detects silence", async () => {
    const report = evaluateQa(await collectQaObservations(fixtures.silent), composition);
    expect(report.findings.find((finding) => finding.code === "silence")?.status).toBe("fail");
  });

  it("detects excessive peaks", async () => {
    const report = evaluateQa(await collectQaObservations(fixtures.peak), composition);
    expect(report.findings.find((finding) => finding.code === "audio_peak")?.status).toBe("fail");
  });
});
