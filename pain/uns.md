# Unsiloed — Pain Points, Limitations & Whitespace

Research for YC Mosshack 2026 (Moss voice-AI hackathon). Two lenses: (A) what the product itself admits it can't do, cited to our docs report + raw mirror; (B) what users/devs struggle with in the wild, with source URLs. Then whitespace + idea seeds for a Moss-powered voice build.

Sources of truth:
- Docs report: `/Users/anirudh/Desktop/yc-mosshack/docs/UNSILOED.md`
- Raw mirror: `/Users/anirudh/Desktop/yc-mosshack/raw/uns-llms-full.txt` (line refs below)

---

## What Unsiloed itself can't (yet) do — product limits (cited)

**1. It is NOT real-time — parsing is slow and async-only.** A 10-page doc took ~6 minutes end-to-end in the docs' own example (`created_at` 06:51 → `finished_at` 06:57); quickstarts poll every 5s with a 5-min timeout (UNSILOED.md §Gotchas, line 556). `use_high_resolution=true` (the default) adds +2–3s/page; `validate_segments` adds +1–2s/page (raw line 2507–2508). Latency is the single most-tracked problem on their own open-source repo (GitHub issue #2, "Reduce the latency of document parser"). **Implication: you cannot parse a fresh document live on a voice call — you must pre-index.**

**2. No webhooks / callbacks / push — polling is the ONLY completion signal.** Every endpoint is job-based: POST → `job_id` → poll `GET .../{job_id}` (raw lines 532, 1791, 9332). A grep of the entire raw mirror for `webhook|callback|notify` returns zero matches. Competitors (Reducto, Unstructured) advertise webhook job-completion as a first-class feature; Unsiloed makes you build a poller and eat the latency.

**3. No synchronous endpoint.** Even the "Fast mode" preset is pitched at "real-time applications requiring quick results" (raw line 2528) — i.e. it's aspirational; there is no sub-second sync parse. Everything goes through the queue (which can 503 "at capacity," raw line 3355).

**4. No official SDK.** Plain REST only; examples are cURL / Python `requests` / JS `fetch` (UNSILOED.md platform table, line 86). No typed client, no retry/backoff built in — devs reimplement polling + error handling every time (confirmed by the community n8n node and OpenClaw skill, which both hand-roll polling).

**5. Short result retention — results evaporate.** v1/v2 results stored ~7 days then `404` "results have been cleaned up" (raw line 1724). **v3 artifacts deleted after 24 hours** (UNSILOED.md line 558; benchmark repo confirms "auto-deleted after 24 hours"). You must pull and persist results same-session; no long-term result store.

**6. Tight rate/throughput ceilings.** Org-wide **60 requests / 60s sliding window** (raw line 3542); **402** on insufficient page credits; **429** on usage cap with **no Retry-After** set by the app (raw line 3542); **503** when the queue is full. v3 is far tighter: **100 requests/day, 2 RPS, 2 burst per key** (raw line 4468). "Limited number of active parsing jobs per API key" (raw line 2269). **Not built for live, bursty, per-user voice traffic.**

**7. Big-doc handling is bolted on, not seamless.** Inline multipart caps: v3 ~3MB, classify 50MB, parse/extract 100MB (raw lines 18, 538, 3330, 4267). Anything bigger forces the 3-call presigned-upload dance (v2/v3 `/upload` → PUT → enqueue). A 400-page manual is a multi-step ingest, not a one-liner.

**8. The best engines/modes are enterprise- or invite-gated.** `UnsiloedStorm` (50+ languages, the multilingual engine) is labeled "enterprise-grade / enterprise" (raw lines 2333, 3601; UNSILOED.md line 121). v3 needs a **separately-issued key** you must email `aman@unsiloed.ai` for, on a different auth header (`X-API-Key` vs `api-key`) and base URL (UNSILOED.md lines 82, 276). Self-hosted / air-gapped is "contact support."

**9. It stops at Markdown — no embeddings, no index, no retrieval.** `chunks[].embed` is embedding-*ready* Markdown, but Unsiloed neither embeds nor stores nor retrieves. Field `embed` is literally just "Vector embeddings / embed text" you still have to embed yourself (raw line 2395). **The entire retrieval + voice half is yours to build — which is exactly the Moss gap.**

**10. Output is not perfectly accurate — you need a human-in-the-loop gate.** Their own olmOCR benchmark puts the hosted parser at **88.0 ± 1.0 overall** (best in class, but ~12% residual error) — source: `Unsiloed-AI/unsiloed-olmocr-benchmark`. Extract confidence bands explicitly say <0.6 "likely needs manual verification," 0.6–0.8 "should review" (UNSILOED.md line 397). So any production use needs a review/confirm loop Unsiloed doesn't provide.

**11. Footguns that silently break demos (UNSILOED.md §Gotchas, lines 560–568):**
- Status strings differ per endpoint (`Succeeded` vs `done` vs `completed` vs `COMPLETED`) — a poller hardcoded to one hangs forever.
- `include_url=true` is required or `pdf_url` / segment `image` / `exports` all come back `null` (privacy default) → blank highlight crops (raw line 1813).
- Two auth headers (`api-key` vs `X-API-Key`) and two base URLs; cross them → 401/403.
- Parse error bodies are **plain text, not JSON** — calling `.json()` on a 429/503 throws (raw line 3542).
- `file` XOR `url`; field name is `file` for parse/split but `pdf_file` for extract/classify; JSON multipart fields must be JSON-encoded strings; extract schema needs `additionalProperties:false` at *every* nesting level or it rejects.

**12. Citation/format gaps.** `xml_citation` (bibliography hyperlinking) is **PDF-only**, silently ignored on images/Office docs (raw line 2860). Strikethrough/colors/links are opt-in flags, off by default.

**13. The open-source chunker was pulled.** The `Unsiloed-AI/Unsiloed-chunker` repo that shows up in search results now 404s and is gone from the org's public repos (verified via `gh search repos unsiloed` — only the hosted-v3 benchmark harness, cookbook, and UAP search remain). The OSS self-serve path narrowed to "use our hosted API."

---

## What users struggle with / complain about (with URLs)

- **Latency is the #1 documented pain.** Unsiloed's own repo opened "Fix: Reduce the latency of document parser" — current implementation has "higher-than-expected latency during document processing, especially for larger documents." A perf PR got a single small doc down to ~1.45s TTFB, "most of the time spent on processing." → https://github.com/Unsiloed-AI/Unsiloed-chunker/issues/2 and PR https://github.com/Unsiloed-AI/Unsiloed-chunker/pull/12 (note: repo since taken private/removed; surfaced via web search cache).
- **Async friction in integrations.** The community n8n node has to expose "Polling Interval" (default 2s) + "Max Polling Time" (default 60s) and hand-roll retry/backoff because "the API doesn't return results synchronously"; it also only supports PDF/PNG/JPEG/TIFF and notes **no webhook support, no batch, no field-level error reporting beyond confidence scores.** → https://github.com/opensource-cmyk/n8n-nodes-unsiloedAI
- **Devs are wrapping it themselves to make it usable** — an OpenClaw skill exists purely to "route document tasks through the Unsiloed document AI API," i.e. the raw API needs an agent-friendly wrapper. → https://github.com/LewisDwyer/unsiloed-skill
- **Competitive pressure on enterprise table-stakes Unsiloed under-advertises.** Comparison write-ups repeatedly highlight that Reducto/Unstructured lead with **zero data retention (retention=0), SOC 2 Type II + HIPAA BAA, on-prem/VPC, webhooks, and high-volume SLAs** as default selling points — Unsiloed's docs bury self-host/air-gap behind "contact support" and don't surface compliance certs. → https://llms.reducto.ai/document-parser-comparison and https://www.llamaindex.ai/insights/best-alternatives-to-reducto
- **Single processing mode = overpay or under-serve.** General critique of this category: "Most alternatives offer only single processing modes, forcing you to overpay for batch workloads or under-serve real-time requirements"; Unstructured's cloud caps (10 files/job, 10MB/file) make it "a batch preprocessing step rather than a real-time parsing layer." Unsiloed's async-queue + 60/60s + v3 100/day land it in the same batch-not-realtime bucket. → https://llms.reducto.ai/document-parser-comparison
- **Accuracy still drops on the hard cases (whole category).** Even top vision-LLM parsers "can drop subtle content when document pages are large or resolution is reduced," and struggle on "large complex tables (thousands of rows), merged cells, small-font embedded metadata, handwriting." → https://www.invofox.com/en/document-parsing-pain-points and https://www.evolution.ai/post/document-parsing
- **General document-parsing pain that voice makes worse:** hallucinated values on charts/merged cells, and the need for human verification on accuracy-sensitive finance/healthcare docs — exactly the domains Unsiloed targets (their YC profile cites finance/healthcare where LLMs "suffer at deterministic extraction"). → https://www.ycombinator.com/companies/unsiloed-ai

---

## Whitespace & unmet needs

1. **No "ingest → retrieve → speak" loop in the box.** Unsiloed stops at Markdown chunks; there's no embedding, no index, no query, no citation-rendering, no voice. The entire retrieval+voice half is greenfield — and is literally the Moss hackathon thesis.
2. **No real-time path.** A 6-minute parse + poll-only + 24h/7d retention means *nothing* about Unsiloed is live-call-ready out of the box. A thin "warm pre-index + live retrieval" layer is missing.
3. **No push notification when a job finishes.** Whoever wires a webhook-shim (poll Unsiloed → fire a callback/voice-callback) removes the single biggest integration headache.
4. **No human-in-the-loop review UX.** Confidence scores exist (`min_confidence_score`, per-field `score`) but there's no flow that routes <0.7 fields to a human — and **voice is a natural review channel** ("I read total as $4,200 — is that right?").
5. **No grounded-citation rendering.** Bboxes + page numbers + cropped segment images exist in the payload but nobody ships the "show me where on the page" overlay; perfect for a voice agent that says "per page 212…" and highlights it.
6. **Multilingual + handwriting are weakest and gated.** Storm (50+ langs) is enterprise-only; handwriting is a known hard case across the category. A demo that leans into a scanned, handwritten, or non-English intake doc shows off exactly where naive parsers fail.
7. **No long-term, queryable document memory.** Results vanish in 24h–7d. A persistent "parse once, ask forever by voice" store is unbuilt.

---

## → Idea seeds for the hackathon (Moss-powered voice exploiting the gap)

1. **"Talk to the manual" — pre-indexed voice RAG (flagship, Support track).** Pre-parse a real 100–400pg PDF (insurance policy / equipment manual / SEC filing) with Unsiloed v2 presigned upload (`merge_tables=true`, `UnsiloedHawk`), push every `chunks[].embed` into a **Moss index** with `{page, bbox}` metadata. LiveKit voice agent: STT → Moss retrieve (sub-10ms) → LLM → TTS, citing the page number while the UI highlights the exact `bbox`. **This directly buys around Unsiloed's only real weakness (latency) by doing the slow part offline and keeping the live turn 100% Moss.** Wow moment: grounded citation overlay proves no hallucination.

2. **"Confirm by voice" — confidence-gated human-in-the-loop extractor (Lead Gen / ops).** Run `/v2/extract` with `enable_citations=true` over an RFP/invoice/intake form. Any field with `score < 0.7` → the voice agent reads it back and asks the caller to confirm out loud ("I have the deductible as $1,500 — correct?"), writing the corrected value to the CRM. Fills the missing review-UX gap *and* turns Unsiloed's ~12% error rate into a feature, not a bug. Moss handles retrieval of prior context to disambiguate.

3. **Webhook/voice-callback shim ("Unsiloed → ring me when ready").** A tiny service that polls Unsiloed for you and, on `Succeeded`, places an outbound voice call / Slack-voice ping summarizing the parsed doc ("Your 312-page contract is indexed; ask me anything"). Productizes the #1 integration headache (poll-only + no webhooks) with a delightful voice surface.

4. **Mixed-inbox triage by voice (Co-Pilot).** `/splitter` + `/classify` a messy AP/mailroom PDF bundle into invoice/contract/receipt, parse each → Moss, then a voice agent answers "what's the warranty on order #1182?" by retrieving only the contract chunks. Showcases Unsiloed's underused split+classify and hides their latency behind a batch pre-step.

5. **Ambient contract co-pilot with on-screen highlight (Co-Pilot).** During a live sales/legal call, the agent listens (LiveKit), and when a clause is named, queries a Moss index built from `/parse`, surfacing the cropped `segments[].image` of the exact clause on screen. Exploits the unused bbox/image payload nobody renders.

6. **"Read me this scanned handwritten form" (accessibility / hard-case demo).** Lean into the gated/weak case: a scanned, handwritten, or non-English intake form → `force_ocr` + `advanced_layout_detection` (KeyValuePair/Signature) → voice agent reads back extracted fields and flags low-confidence ones. Demonstrates value exactly where generic OCR collapses, and where Unsiloed's premium engines are otherwise enterprise-gated.
