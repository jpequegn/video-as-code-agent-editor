import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame
} from "remotion";

import type { CompositionManifest } from "../../src/composition/schema.js";

const captionStyle: CSSProperties = {
  position: "absolute",
  left: "8%",
  right: "8%",
  padding: "12px 18px",
  color: "#ffffff",
  backgroundColor: "rgba(12, 16, 22, 0.82)",
  fontFamily: "Arial, sans-serif",
  fontSize: 28,
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: 0,
  textAlign: "center"
};

function Segment({ manifest, index }: { manifest: CompositionManifest; index: number }) {
  const frame = useCurrentFrame();
  const segment = manifest.timeline[index];
  if (!segment) return null;
  const fadeFrames = segment.transition?.type === "fade" ? segment.transition.durationInFrames : 0;
  const opacity = fadeFrames
    ? interpolate(frame, [0, fadeFrames], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp"
      })
    : 1;
  return (
    <AbsoluteFill style={{ opacity, backgroundColor: "#000000" }}>
      <OffthreadVideo
        src={staticFile(manifest.asset.publicPath)}
        startFrom={segment.sourceStartFrame}
        pauseWhenBuffering
      />
    </AbsoluteFill>
  );
}

export function VideoEdit(manifest: CompositionManifest) {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {manifest.timeline.map((segment, index) => (
        <Sequence
          key={segment.segmentId}
          from={segment.timelineStartFrame}
          durationInFrames={segment.durationInFrames}
        >
          <Segment manifest={manifest} index={index} />
        </Sequence>
      ))}
      {manifest.captions.map((caption) => (
        <Sequence
          key={caption.id}
          from={caption.startFrame}
          durationInFrames={caption.endFrame - caption.startFrame}
        >
          <div style={{ ...captionStyle, [caption.position]: "8%" }}>{caption.text}</div>
        </Sequence>
      ))}
      {manifest.highlights.map((highlight, index) => (
        <Sequence
          key={`${highlight.label}-${index}`}
          from={highlight.startFrame}
          durationInFrames={highlight.endFrame - highlight.startFrame}
        >
          <div
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              padding: "8px 12px",
              backgroundColor: highlight.color,
              color: "#111111",
              fontFamily: "Arial, sans-serif",
              fontWeight: 700,
              letterSpacing: 0
            }}
          >
            {highlight.label}
          </div>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
