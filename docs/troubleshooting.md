# Troubleshooting

## FFmpeg is unavailable

Install FFmpeg 5 or newer and confirm both commands resolve:

```bash
ffmpeg -version
ffprobe -version
```

## The real renderer cannot find a browser

By default, Remotion provisions its supported headless-shell build on the first local render. Allow
that download and retry. For an offline installation, set `REMOTION_BROWSER_EXECUTABLE` to a
compatible Chrome for Testing executable; a newer consumer Chrome build may not match the installed
Remotion renderer. The fixture renderer remains available for deterministic generated-media tests
but does not apply the composition.

## The plan is not approved

Approval is tied to one plan hash. Any revision creates a new hash and invalidates the earlier
approval. Run `approve` again only after inspecting the revised plan.

## An immutable artifact differs

The same identity must never map to different bytes. Preserve the workspace for investigation, then
use a new workspace instead of overwriting the conflicting artifact.

## Docker is unavailable

The normal test suite does not need a Docker daemon. Use `--renderer fixture` for the generated demo
or start Docker before building `Dockerfile.render`.
