import { describe, expect, it } from "vitest";

import { MediaError } from "../src/media/errors.js";
import { parseProbeDocument, parseRational } from "../src/media/ffprobe.js";

describe("ffprobe parsing", () => {
  it("parses rational frame rates and streams", () => {
    expect(parseRational("30000/1001")).toEqual({ numerator: 30000, denominator: 1001 });
    const parsed = parseProbeDocument(
      JSON.stringify({
        format: { duration: "3.0", format_name: "mov,mp4" },
        streams: [
          {
            codec_type: "video",
            codec_name: "h264",
            width: 640,
            height: 360,
            avg_frame_rate: "30/1"
          },
          { codec_type: "audio", codec_name: "aac", channels: 1, sample_rate: "48000" }
        ]
      })
    );
    expect(parsed.video.width).toBe(640);
    expect(parsed.audio?.sampleRate).toBe(48000);
  });

  it("rejects invalid rational values", () => {
    expect(() => parseRational("30")).toThrow(MediaError);
    expect(() => parseRational("30/0")).toThrow("Invalid frame rate");
  });
});
