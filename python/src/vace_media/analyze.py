"""FFmpeg-backed deterministic media analysis."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class AudioLevels:
    mean_db: float
    peak_db: float


def parse_volume_detect(stderr: str) -> AudioLevels:
    mean = re.search(r"mean_volume:\s*(-?[\d.]+) dB", stderr)
    peak = re.search(r"max_volume:\s*(-?[\d.]+) dB", stderr)
    if not mean or not peak:
        raise ValueError("ffmpeg output did not contain volume observations")
    return AudioLevels(mean_db=float(mean.group(1)), peak_db=float(peak.group(1)))


def analyze_audio(media_path: Path) -> tuple[AudioLevels, list[str], str]:
    command = [
        "ffmpeg",
        "-nostdin",
        "-i",
        str(media_path),
        "-af",
        "volumedetect",
        "-f",
        "null",
        "-",
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "ffmpeg analysis failed")
    return parse_volume_detect(result.stderr), command, result.stderr


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Analyze audio and scene fixtures")
    parser.add_argument("media", type=Path)
    parser.add_argument("--scene-fixture", type=Path)
    return parser


def main() -> None:
    args = build_parser().parse_args()
    levels, command, _ = analyze_audio(args.media)
    scenes = []
    if args.scene_fixture:
        scenes = json.loads(args.scene_fixture.read_text())
    output = {"audio": asdict(levels), "scenes": scenes, "command": command}
    print(json.dumps(output, sort_keys=True))


if __name__ == "__main__":
    main()
