# Moss — Pain Points, Limitations & Whitespace

Research for YC Conversational AI Hackathon 2026 (Moss is the host/retrieval sponsor).
Two source lanes: **(A)** honest constraints pulled from our own docs + the raw `moss-llms-full.txt`, and
**(B)** what real users/devs hit in the wild (GitHub issues, Show HN, category research). Cited throughout.

> TL;DR framing: Moss nails the *hot path* (sub-10 ms local query). The pain lives at the **edges** —
> Node has no sessions, reranking isn't shipped, the cloud-fallback path silently degrades (no filter, no alpha),
> the embedding models are small (recall gap), browser/on-device pay a cold-start + RAM tax, and ingestion is thin
> (PDF-only, 20 files/call, no connectors). Every gap below is a place a hackathon team can build a wedge.

---

## What Moss itself can't (yet) do  (product limits, cited)

**Sessions (real-time local read/write) are missing on the most popular runtime.**
- "Sessions exist in Python, Swift, Elixir, and C today; **JavaScript (Node) session support is 'coming.'**" — `docs/MOSS.md` §2 (also §7.1, §14, §16). Browser SDK: **"Sessions: Not supported"** — `raw/moss-llms-full.txt:4507` and `docs/MOSS.md` §4 table.
- Consequence (called out verbatim): *"Node has no sessions yet. Need live transcript indexing/handoff? Use Python or Swift for the agent, even if your web app is Node."* — `docs/MOSS.md` §14. So the canonical JS/TS voice stack can't do live transcript indexing or cross-agent handoff locally — it must shell out to a Python/Swift process.

**The "cloud fallback" path silently degrades — and this has produced real bugs.**
- If you `query()` without `loadIndex()`, JS/Python *silently* hit the cloud `/query` API (~100–500 ms) instead of erroring — "fine for a quick test, fatal for a voice agent's latency budget." — `docs/MOSS.md` §1, §3, §14.
- On that fallback path, **metadata filters are silently skipped** ("the cloud query API doesn't support filtering yet," warning logged) — `docs/MOSS.md` §3; `raw/moss-llms-full.txt:1477`. Confirmed as a real shipped bug: **Issue #204 "[Bug]: Metadata filters silently ignored in TypeScript Cloud fallback"** (closed) — https://github.com/usemoss/moss/issues/204.
- `alpha` (hybrid blend) was **not honored in the cloud fallback** either — **Issue #205 "[Feature]: Support 'alpha' parameter in Cloud Query fallback"** (closed) — https://github.com/usemoss/moss/issues/205. So the convenience path quietly returns *different, worse* results than the loaded path.

**Reranking is documented as a "knob" but is NOT actually shipped.**
- Docs imply reranking exists: *"Knobs: top_k, alpha. Optional metadata filter and reranking"* and the pipeline diagram shows "Rerank (optional)" — `docs/MOSS.md` §2, §3.
- But it's an **open feature request: Issue #84 "[Feature]: Support for Reranking Models"** (open) — https://github.com/usemoss/moss/issues/84. This matters because reranking is the standard fix for small-embedding recall gaps (see §B).

**Embedding models are small/proprietary — a recall ceiling, and you can't bring your own *model* (only your own *vectors*).**
- Default `moss-minilm` = 384-dim, "fast, lightweight." Higher-accuracy `moss-mediumlm` exists but dims unspecified; HQ/HP models are **Enterprise-only** — `docs/MOSS.md` §2, §13 pricing table ("HQ/HP models, SOC2, HIPAA, VPC — Enterprise only").
- `custom` model means *you supply vectors* — Moss won't run your model on-device; you must embed query text yourself everywhere (every doc AND every query), or it raises `ValueError` — `docs/MOSS.md` §2.

**File ingestion is thin.**
- `createIndexFromFiles`: **PDF only** (`application/pdf`), **max 20 files/call**, **`custom` model not supported** (server embeds) — `docs/MOSS.md` §3, §14; `raw/moss-llms-full.txt:2230, 2330, 7028`.
- Docs themselves admit Moss PDF parsing is only good for *simple* docs: *"For complex docs (tables, nested layouts, scanned forms), parse with Unsiloed first"* — `docs/MOSS.md` §3, §11. No DOCX/HTML/PPTX/CSV-to-chunks, no built-in chunker for arbitrary text.
- **No source connectors yet** — heavily requested: Postgres (#168), Snowflake (#170), DynamoDB (#171), MySQL (#169 closed), Supabase (#167 closed), generic doc-parsing connectors (#98), N8N (#198/#158), Firecrawl (#200), Unstructured (#203). See https://github.com/usemoss/moss/issues.

**Mutations are async/eventually-consistent — not a live write path (outside sessions).**
- `createIndex`/`addDocs`/`deleteDocs` are async jobs (`pending_upload → uploading → building → completed`); SDK polls. Index `status` must be `Ready` before queries return data. For big corpora this is "seconds." — `docs/MOSS.md` §5, §14.
- Freshness on a loaded index is **poll-based**: default `polling_interval_in_seconds = 600` (10 min). "Converges to the latest version within at most one polling interval." So edits aren't instantly visible unless you tune polling down (which costs build/refresh overhead) or force a blocking `load_index` — `docs/MOSS.md` §5.
- `createIndex` **throws if the index already exists** (must `addDocs(upsert)` or delete first) — `docs/MOSS.md` §14, §15.

**Metadata model is rigid: flat string→string.**
- Numeric values stored/compared **as strings** ("100", not 100). Easy footgun on range filters; the docs literally say "Easy to lose 20 minutes here." — `docs/MOSS.md` §2, §14; `docs/MOSS-API-REFERENCE.md:1103`. No nested objects, no arrays, no native numeric/date types.

**Memory & sizing pressure (especially browser/mobile).**
- "~1M × 256-dim vectors ≈ 500 MB" in RAM; "Budget RAM for big indexes; use Swift `onMemoryPressure` on mobile." — `docs/MOSS.md` §4, §14.
- Browser: "WASM module + embedding model download on first use" — a cold-start tax before first query — `docs/MOSS.md` §4.

**Free-tier limits are tight for anything beyond a demo.**
- Developer (free): **3 indexes**, 1 project, 500 MB storage, **50 MB/mo ingest**, **60 voice-min/mo** — `docs/MOSS.md` §13. Sessions are gated to higher tiers in the pricing matrix (the §13 "Sessions" row only shows ✅ under Enterprise — ambiguous vs. SDK availability, a documentation inconsistency in itself).

**Platform/version constraints.**
- Python 3.10–3.14 (3.14 only "partial," local embedding disabled — `raw/...:1510`; dropped 3.9 in beta.9). Node 20+. Swift iOS 15+, Apple-Silicon simulator only. C binaries via GitHub tarballs (not crates.io). — `docs/MOSS.md` §7.
- API auth/header inconsistency across SDKs: **JS returns full `Bearer <token>`; Swift returns the raw token (no prefix)** — a documented copy-paste footgun — `docs/MOSS.md` §7.6, §9, §14.

---

## What users struggle with / complain about  (with URLs)

**Real bugs filed against Moss (corroborate the doc gotchas):**
- **#204** Metadata filters silently ignored in TS cloud fallback — https://github.com/usemoss/moss/issues/204
- **#205** alpha not supported in cloud fallback — https://github.com/usemoss/moss/issues/205
- **#190** `pipecat-moss` breaks with Pipecat 1.1.0 (removed APIs) — integration fragility against fast-moving voice frameworks — https://github.com/usemoss/moss/issues/190
- **#185** Next.js 16 Turbopack build fails on `@moss-dev/moss-core` native asset — native-binary bundling pain in modern JS toolchains — https://github.com/usemoss/moss/issues/185
- **#5** "Discord link is invalid" — the docs' primary support channel link was broken (onboarding friction) — https://github.com/usemoss/moss/issues/5

**What the open issue backlog tells us users actually want (42 issues; ~half are integrations/connectors):**
- Reranking models (#84), Go bindings (#227), VS Code extension (#91), reranking + connectors for Postgres/Snowflake/DynamoDB, and a long tail of framework cookbooks (LangGraph, CrewAI, LlamaIndex, OpenAI Agents SDK, Google ADK, Smolagents, Semantic Kernel, Pydantic AI). Full list: https://github.com/usemoss/moss/issues. Signal: the **ecosystem/integration surface is the felt gap**, not the core query engine.

**Show HN reception (early, thin):** "Show HN: Moss – AI-Powered Semantic Search Running In-Browser (No Cloud)" — only ~6 points, few comments; top questions were *"who benefits from this?"* and *"how is this deployed — library or service?"* — i.e., **positioning/wedge was unclear to readers**, and the founders themselves were soliciting a VitePress integration. https://news.ycombinator.com/item?id=43900296

**Licensing confusion (a real adoption blocker):** sources disagree — the GitHub repo reports a permissive license, but the published npm/PyPI packages have been described under the **PolyForm Shield License 1.0.0** ("free for testing/evaluation, not for production or competing commercial use"). A hackathon team planning to commercialize should confirm the license on the exact package before building on it. (Search surfaced both BSD-2 and PolyForm Shield framings — https://github.com/usemoss/moss and https://www.npmjs.com/package/@inferedge/moss.)

**Category-level struggles that apply directly to a Moss build (well-documented elsewhere):**
- *RAG latency is the real voice bottleneck* — a vector-DB query adds 50–300 ms, blowing the ~200 ms conversational budget once you add embedding + LLM. This is Moss's whole thesis, and confirms the pain is real. arXiv "VoiceAgentRAG" — https://arxiv.org/html/2603.02206v2
- *Small embedding models trade recall.* MiniLM-L6 runs ~5–8% lower retrieval accuracy than larger models, "fine for casual search… not for precise use cases" — and the standard remedy is **reranking (+6–7% accuracy, ~5% better context adherence / fewer hallucinations)**, which Moss hasn't shipped (#84). https://supermemory.ai/blog/best-open-source-embedding-models-benchmarked-and-ranked/ · https://arxiv.org/html/2506.00049v1
- *In-browser model cold-start is hostile UX.* A MiniLM-class ONNX model is ~23 MB quantized but takes **8–15 s to download+deserialize on a throttled/mobile connection**, and ONNX WASM runs on the main thread by default (UI jank). Moss inherits exactly this on `@moss-dev/moss-web` first use. https://www.sitepoint.com/optimizing-transformers-js-production/ · https://dev.to/soasme/running-kittentts-in-the-browser-a-deep-dive-into-wasm-and-onnx-18hk
- *WASM RAM ceilings.* Browser ArrayBuffer/4 GB limits and fragmentation mean large in-browser indexes fail earlier than expected — relevant to Moss's "500 MB/1M-vector" budget on real laptops/phones. https://loke.dev/blog/wasm-64-bit-memory-limit-wasm64

---

## Whitespace & unmet needs

1. **Node/JS live sessions don't exist.** The most popular voice/web stack can't do real-time transcript indexing, memory, or cross-agent handoff without bolting on a Python/Swift sidecar. Huge wedge for anyone who builds the missing piece *on top of* Moss for the hackathon (the demo writes itself).
2. **No reranking layer.** Moss returns raw hybrid scores from a small model; the proven accuracy fix (cross-encoder / LLM rerank) is unshipped. A drop-in reranker that stays inside the latency budget is open territory.
3. **Cloud-fallback is a silent quality cliff** (no filters, no alpha). A guardrail/observability layer that *detects* "you forgot to loadIndex / you're filtering on an unloaded index" and warns loudly would save teams hours.
4. **Ingestion is PDF-only + 20 files + no connectors.** Everything upstream of the index — chunking, complex-doc parsing (tables/scans), DOCX/HTML/web, and live data-source sync (Postgres/Notion/Drive/Slack) — is unowned. Compose with Unsiloed for parsing.
5. **No eval/quality tooling.** Nothing helps you pick `alpha`, chunk size, or `minilm` vs `mediumlm` for *your* corpus. Tuning is folklore ("aim 200–500 tokens," "alpha 0.8 for voice"). A corpus-aware auto-tuner is wide open.
6. **No multi-tenant / per-end-user index ergonomics.** Sessions are keyed by name, but there's no first-class "one index per customer with auth scoping" pattern beyond minting tokens — fertile ground for a B2B support/co-pilot wedge.
7. **Cost/limits cliff for real usage.** 50 MB/mo ingest and 60 voice-min/mo on free tier; sessions gated up the ladder. Tools that minimize re-ingest (dedupe, delta sync) have value.

---

## → Idea seeds for the hackathon

1. **"Moss Sessions for Node" shim (live transcript memory for the JS voice stack).** A tiny Node service (or worker) that fronts a Python/Swift Moss session over IPC/WebSocket and exposes a clean JS `session.addDocs/query/pushIndex` API — closing the #1 documented gap. Demo: a fully-JS LiveKit/Vapi agent that remembers what the caller said two turns ago + hands off to a human, with the latency counter on screen. Directly exploits `docs/MOSS.md` §14 "Node has no sessions yet."

2. **In-budget reranker for Moss (the unshipped #84).** Wrap `query(top_k=20)` → fast cross-encoder / LLM-as-reranker → return top 3–5, measured to stay under the voice budget. Show the recall/accuracy lift (the literature says +6–7%) live against raw `moss-minilm`. Fills a gap Moss's own docs *imply exists but don't ship*.

3. **"Did you loadIndex?" — a Moss reliability/observability guardrail.** A wrapper SDK or MCP middleware that flags the silent cloud-fallback (latency spike), warns when a filter/alpha is being dropped on an unloaded index (bugs #204/#205), and surfaces `timeTakenInMs` + freshness/staleness per query. Turns three documented footguns into a dashboard. Great "dev-tool for Moss" angle judges love.

4. **Corpus-aware auto-tuner + eval harness.** Feed it your docs + a handful of question/answer pairs; it sweeps `alpha`, chunk size, and `minilm` vs `mediumlm`, reports recall@k, and emits the optimal `QueryOptions`. Kills the "tuning is folklore" problem (§14 guidance is all heuristics).

5. **Connector + complex-doc ingestion pipeline (Unsiloed → Moss).** A one-command ingester that pulls from a live source (Postgres / Notion / a website via crawl), parses complex PDFs/tables with Unsiloed, chunks intelligently, and upserts into a Moss index with delta-sync to respect the 50 MB/mo ingest cap. Attacks the entire "ingestion is thin + no connectors" whitespace (issues #98/#168/#170/#171/#200/#203).

6. **Per-user on-device memory co-pilot (privacy wedge).** Use the Swift/WASM on-device path so "data never leaves the device," with one Moss session per end-user as durable memory; mitigate the cold-start tax with a tiny pre-warmed index + progressive model load. Leans into Moss's strongest, least-contested claim while solving the documented first-load UX pain.
