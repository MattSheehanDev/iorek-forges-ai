# Iorek Forges

**[Live demo](https://mattsheehandev.github.io/iorek-forges-ai/)**

Daily, self-contained demos of new AI papers and of conventions for coding agents. Each demo lives in its own folder and is meant to be opened and clicked.

## Demos

- [2026-11-02 — Nestor, nested sparsity](demos/2026-11-02-nestor-nested-sparsity/) — Tokens pick a few attention columns, and each column has its own experts. Toy routers, causal masks, and stored-versus-used counters.
- [2026-11-01 — Structured Outputs Playground](demos/2026-11-01-structured-outputs-playground/) — Step through a schema mask that blocks illegal JSON tokens, next to a draft that breaks.
- [2026-10-31 — RAG Retrieval Visualizer](demos/2026-10-31-rag-retrieval-visualizer/) — Chunk a clinic handbook and see which passage BM25 and a hashed embedding return for a help-desk question.

## New demos

Every new demo must be a static, browser-runnable folder under `demos/` with an `index.html` entry point and relative asset paths. The landing page is generated from those folders. See [CONTRIBUTING.md](CONTRIBUTING.md).

