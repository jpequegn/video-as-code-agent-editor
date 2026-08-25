# Usage

## Install

```bash
npm install
uv sync
```

## Run the generated demo

Draft only:

```bash
npm run vace -- demo --dry-run --workspace /tmp/vace-demo
```

Run every stage after explicitly approving the generated plan:

```bash
npm run vace -- demo --approve --renderer fixture --workspace /tmp/vace-demo
```

Use the actual Remotion renderer:

```bash
npm run vace -- demo --approve --renderer local --workspace /tmp/vace-remotion-demo
```

Inject a known black-frame failure:

```bash
npm run vace -- demo --approve --fixture black --workspace /tmp/vace-black-demo
```

The black case exits with code `2` after writing its QA and review artifacts.

## Run your own media

```bash
npm run vace -- run ./talk.mp4 \
  --transcript ./talk.mp4.transcript.json \
  --title "Edited talk" \
  --brief "Keep the complete useful take and add captions" \
  --approve-as "julien" \
  --renderer local \
  --workspace ./my-edit
```

The `--approve-as` option is mandatory. It records user approval for the exact generated plan.
Inspect and revise the plan before running `approve` separately when handling consequential media.

Use `--dry-run` without `--approve-as` to stop after ingest and plan creation. Add `--output status`
to any command for one-line output; JSON is the default.

## Run stages separately

```bash
npm run vace -- ingest ./talk.mp4 --transcript ./talk.json --workspace ./my-edit
npm run vace -- plan --title "Edited talk" --brief "Keep the useful take" --workspace ./my-edit
npm run vace -- approve --actor julien --reason "Reviewed all ranges" --workspace ./my-edit
npm run vace -- compile --workspace ./my-edit
npm run vace -- render --renderer local --workspace ./my-edit
npm run vace -- qa --workspace ./my-edit
npm run vace -- evaluate --workspace ./my-edit
npm run vace -- review --workspace ./my-edit
```

## Exit codes

| Code | Meaning                                            |
| ---- | -------------------------------------------------- |
| `0`  | Completed and automated evidence supports approval |
| `1`  | Invalid input, missing tool, or execution failure  |
| `2`  | QA or review packet rejects the output             |
| `3`  | Warnings require human review                      |
