# Security model

## Trust boundaries

- Source media is immutable after ingestion. The content store checks SHA-256 on reuse.
- Creative plans are JSON data validated with Zod. The pipeline never executes generated source code
  from a plan.
- Compilation requires an append-only approval event for the exact plan hash.
- The compiler resolves media through controlled content paths and rejects missing objects,
  unsupported codecs, oversized output, and unsafe references before render.
- Render outputs cannot overlap source, public, or composition roots.

## Docker renderer

`Dockerfile.render` and the generated Docker command use a non-root user, no network, a read-only
container filesystem, read-only source mounts, one writable output mount, process limits, CPU and
memory limits, and a timeout. Build the image before using Docker mode:

```bash
docker build -f Dockerfile.render -t vace-renderer:local .
```

The deterministic fixture renderer is for generated test media only. It does not apply cuts or
captions. Use `--renderer local` to render the actual Remotion composition.

## Data handling

Do not commit private footage or workspaces. Transcript sidecars are stored locally and should be
redacted before sharing. The project does not call an external model or transcription API by
default.
