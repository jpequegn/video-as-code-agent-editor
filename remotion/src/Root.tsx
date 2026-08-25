import { Composition } from "remotion";

import { demoManifest } from "./demo-manifest.js";
import { VideoEdit } from "./VideoEdit.js";

export function RemotionRoot() {
  return (
    <Composition
      id="VideoEdit"
      component={VideoEdit}
      durationInFrames={demoManifest.video.durationInFrames}
      fps={demoManifest.video.fps}
      width={demoManifest.video.width}
      height={demoManifest.video.height}
      defaultProps={demoManifest}
      calculateMetadata={({ props }) => {
        return {
          durationInFrames: props.video.durationInFrames,
          fps: props.video.fps,
          width: props.video.width,
          height: props.video.height
        };
      }}
    />
  );
}
