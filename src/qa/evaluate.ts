import { canonicalJson, sha256 } from "../lib/canonical-json.js";
import type { CompositionManifest } from "../composition/schema.js";
import {
  qaPolicySchema,
  qaReportSchema,
  type QaFinding,
  type QaObservations,
  type QaPolicy,
  type QaReport
} from "./schema.js";

export const DEFAULT_QA_POLICY: QaPolicy = {
  schemaVersion: 1,
  durationToleranceSeconds: 0.15,
  black: { minimumDurationSeconds: 0.2, pictureBlackRatio: 0.98 },
  silence: { minimumDurationSeconds: 0.2, noiseDb: -50 },
  maximumAudioPeakDb: -0.5,
  captionSafeAreaPercent: 10,
  maximumCaptionLines: 3
};

function finding(
  code: string,
  passed: boolean,
  message: string,
  evidenceSeconds: number[] = [],
  severity: QaFinding["severity"] = "error"
): QaFinding {
  return {
    code,
    status: passed ? "pass" : "fail",
    severity: passed ? "info" : severity,
    message,
    evidenceSeconds
  };
}

function captionFindings(composition: CompositionManifest, policy: QaPolicy): QaFinding[] {
  const usableWidth = composition.video.width * (1 - (2 * policy.captionSafeAreaPercent) / 100);
  const estimatedCharactersPerLine = Math.max(1, Math.floor(usableWidth / (28 * 0.58)));
  return composition.captions.map((caption) => {
    const estimatedLines = Math.ceil(caption.text.length / estimatedCharactersPerLine);
    const timingValid =
      caption.startFrame >= 0 && caption.endFrame <= composition.video.durationInFrames;
    const passed = estimatedLines <= policy.maximumCaptionLines && timingValid;
    return finding(
      "caption_safe_area",
      passed,
      passed
        ? `Caption ${caption.id} fits the configured safe area`
        : `Caption ${caption.id} may clip or exceeds the composition timeline`,
      [caption.startFrame / composition.video.fps],
      "warning"
    );
  });
}

export function evaluateQa(
  observations: QaObservations,
  composition: CompositionManifest,
  policyInput: QaPolicy = DEFAULT_QA_POLICY
): QaReport {
  const policy = qaPolicySchema.parse(policyInput);
  const expectedDuration = composition.video.durationSeconds;
  const blackFailures = observations.blackSegments.filter(
    (segment) => segment.durationSeconds >= policy.black.minimumDurationSeconds
  );
  const silenceFailures = observations.silenceSegments.filter(
    (segment) => segment.durationSeconds >= policy.silence.minimumDurationSeconds
  );
  const findings: QaFinding[] = [
    finding(
      "video_stream",
      observations.probe.hasVideo,
      observations.probe.hasVideo ? "Video stream present" : "Video stream missing"
    ),
    finding(
      "audio_stream",
      observations.probe.hasAudio,
      observations.probe.hasAudio ? "Audio stream present" : "Audio stream missing"
    ),
    finding(
      "dimensions",
      observations.probe.width === composition.video.width &&
        observations.probe.height === composition.video.height,
      `${observations.probe.width}x${observations.probe.height}; expected ${composition.video.width}x${composition.video.height}`
    ),
    finding(
      "duration",
      Math.abs(observations.probe.durationSeconds - expectedDuration) <=
        policy.durationToleranceSeconds,
      `Duration ${observations.probe.durationSeconds.toFixed(3)}s; expected ${expectedDuration.toFixed(3)}s`
    ),
    finding(
      "black_frames",
      blackFailures.length === 0,
      blackFailures.length === 0
        ? "No black-frame interval exceeded policy"
        : `${blackFailures.length} black interval(s) exceeded policy`,
      blackFailures.map((segment) => segment.startSeconds)
    ),
    finding(
      "silence",
      silenceFailures.length === 0,
      silenceFailures.length === 0
        ? "No silence interval exceeded policy"
        : `${silenceFailures.length} silence interval(s) exceeded policy`,
      silenceFailures.map((segment) => segment.startSeconds),
      "warning"
    ),
    observations.audioPeakDb === null
      ? {
          code: "audio_peak",
          status: "unknown",
          severity: "warning",
          message: "Audio peak evidence is unavailable",
          evidenceSeconds: []
        }
      : finding(
          "audio_peak",
          observations.audioPeakDb <= policy.maximumAudioPeakDb,
          `Peak ${observations.audioPeakDb.toFixed(1)} dB; maximum ${policy.maximumAudioPeakDb.toFixed(1)} dB`,
          [],
          "warning"
        ),
    ...captionFindings(composition, policy)
  ];
  const verdict = findings.some((entry) => entry.status === "fail" && entry.severity === "error")
    ? "fail"
    : findings.some((entry) => entry.status !== "pass")
      ? "warn"
      : "pass";
  const policyHash = sha256(canonicalJson(policy));
  const observationHash = sha256(canonicalJson(observations));
  const identity = {
    schemaVersion: 1 as const,
    mediaHash: observations.mediaHash,
    compositionId: composition.compositionId,
    policyHash,
    observationHash,
    verdict,
    findings,
    observations
  };
  return qaReportSchema.parse({ ...identity, reportId: sha256(canonicalJson(identity)) });
}
