# Capabilities and extensions

## Typical uses

- Prepare reviewable talk-to-camera edits with deterministic captions and source ranges.
- Turn incident reviews, finance explainers, and training recaps into versioned video compositions.
- Compare editing-policy changes with the same golden footage and QA thresholds.
- Test agent-generated creative plans without allowing the agent to execute arbitrary code.

## Useful extensions

- Add Whisper behind the existing transcript adapter and retain word-level model provenance.
- Add face and shot detectors as derived observations without changing source manifests.
- Add a browser review application that submits append-only approve, reject, and revise decisions.
- Add mobile upload that hashes footage before transfer and resumes by object identity.
- Add an object-store adapter while preserving the current content-addressed layout.

## Less obvious uses

- Compile compliance evidence into short, cited training videos where each visual claim links to an
  approved source range.
- Generate two composition variants, then use review history and rework count as preference data for
  a planning model.
- Treat incident timelines as video plans so operational events, screenshots, and narration remain
  synchronized and replayable.
- Run adversarial creative-plan fixtures to evaluate whether an agent tries unsafe paths,
  unsupported codecs, excessive duration, hidden media, or approval bypasses.
- Compile the manifest validator to Rust/WASM for client-side preflight before footage enters a
  managed environment.
