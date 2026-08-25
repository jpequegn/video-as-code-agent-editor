# Video-as-Code Agent Editor

Video-as-Code Agent Editor turns source footage and a typed creative plan into a reproducible
Remotion composition, rendered preview, media QA report, and human review packet.

The project keeps source analysis, creative decisions, compilation, rendering, and verification as
separate recorded stages. A generated plan cannot render until a human approves its exact hash.

## Status

The repository is under active implementation from
[project-ideas #249](https://github.com/jpequegn/project-ideas/issues/249). The initial workspace
and CI are available; media commands will be added in the following issues.

## Requirements

- Node.js 22 or newer
- Python 3.12
- [uv](https://docs.astral.sh/uv/)
- FFmpeg and ffprobe 5 or newer
- Docker 27 or newer for the optional isolated renderer

## Development

```bash
npm install
uv sync
npm run check
uv run ruff check .
uv run pytest
npm run vace -- --help
```

CI deliberately uses no API keys, model calls, private media, or Docker daemon.

## Safety model

- Source media is immutable and addressed by SHA-256.
- Plans are data, not executable code.
- Rendering requires approval for the exact plan hash.
- Generated processes receive read-only source mounts and a dedicated output directory.
- Automated QA reports evidence and thresholds; it does not silently repair output.

Licensed under the MIT License.
