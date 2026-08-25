# Architecture

The editor records five boundaries instead of treating video editing as one model call.

1. **Ingestion** hashes source bytes into `.vace/objects/sha256` and records FFprobe, transcript,
   scene, and tool provenance in an immutable manifest.
2. **Planning** produces a typed creative plan. Drafts have no authority. Approval applies to one
   exact plan hash and lives in an append-only decision log.
3. **Compilation** converts approved source ranges, captions, highlights, and transitions into a
   canonical frame timeline. Only hash-addressed assets enter Remotion's public directory.
4. **Rendering** runs through an adapter. The real adapter uses Remotion; the fixture adapter copies
   generated media for fast offline integration tests. Docker mode restricts networking, identity,
   mounts, processes, CPU, memory, and time.
5. **Verification** collects FFmpeg observations, applies a versioned QA policy, evaluates golden
   cases, and generates review packets. A reviewer still records the final decision.

`workflow.json` points to the active artifacts. It is an index, not a source of truth. Every durable
artifact carries the hashes needed to reconstruct the run.
