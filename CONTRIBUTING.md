# Contributing

Use Node.js 22, Python 3.12, and generated media fixtures. Do not commit private footage, API keys,
rendered binaries, or model responses containing personal data.

Before opening a pull request, run:

```bash
npm run check
uv run ruff check .
uv run pytest
```

Keep source ingestion, planning, compilation, rendering, and QA changes independently testable.
