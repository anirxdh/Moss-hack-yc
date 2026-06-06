# Moss Coverage Audit

**Platform:** Moss (host platform — near-complete coverage expected)
**Ground truth:** `raw/moss-llms.txt` — 117 documentation page entries (lines 7–123; "Optional" section: Discord/GitHub/Typeform are link-outs, not doc pages).
**Reports audited:** `docs/MOSS.md` (921 lines) + `docs/MOSS-API-REFERENCE.md` (1206 lines).
**Full-content cross-check:** `raw/moss-llms-full.txt` (79 distinct `Source:` pages; the index's extra ~40 entries are short JS/Python interface + type-alias reference stubs).

Buckets: **COVERED** (key facts present), **PARTIAL** (mentioned but a key param/detail/example missing), **MISSED-IN-SCOPE** (genuinely absent), **OMITTED** (out of scope — almost none here, since this is the host).

---

## Docs — API Reference / Getting Started (Control Plane)

| Page | Bucket | Note |
| --- | --- | --- |
| Add Documents (addDocs) | COVERED | API-REF §3b: full curl, async job, upsert default true, 404/500 errors. |
| Delete Documents (deleteDocs) | COVERED | API-REF §3b: curl, docIds array, async jobId. |
| Get Documents (getDocs) | COVERED | API-REF §3b: curl, options.docIds subset, no-embeddings note. |
| Authentication (api-reference getting-started) | COVERED | API-REF §1: x-project-key header + projectId body, 403, curl. |
| Introduction (Control Plane base URL) | COVERED | API-REF §3: base URL `https://service.usemoss.dev/v1`. |
| Overview (endpoint structure / shared schema) | COVERED | API-REF §3: shared request schema, actions-at-a-glance table. |
| Delete Index | COVERED | API-REF §3a: curl, returns literal `true`, 404. |
| Get Index | COVERED | API-REF §3a: curl + full IndexInfo response JSON. |
| Get Job Status | COVERED | API-REF §5: completed/building JSON, all 8 response fields, 404. |
| Init Upload | COVERED | API-REF §3a: required fields (modelId/docCount/dimension), presigned uploadUrl, expiresIn 3600. |
| List Indexes | COVERED | API-REF §3a: curl + array response. |
| Start Build | COVERED | API-REF §3a: curl, jobId, building status, 404. |

## Docs — Build (use-case guides)

| Page | Bucket | Note |
| --- | --- | --- |
| Agent Context | COVERED | MOSS §6 "Agent context as memory" — capture/recall loop, working vs durable context. |
| Browser Extension Context | COVERED | MOSS §4 — background service worker, postMessage, IndexedDB persistence. |
| Cross-Agent Context & Omni-Channel Handoff | COVERED | MOSS §6 — same-name session, push/read diagram, semantics, use cases. |
| Data Hydration & Sync | COVERED | MOSS §5 — hydration, 2 freshness layers, per-index refresh, convergence. |
| Electron App Local Search | COVERED | MOSS §4 — main-process client, IPC, full code sample. |
| Live-Call Context | COVERED | MOSS §6 — dual-index short+long term, full Python example. |
| Local Embeddings | COVERED | MOSS §2/§3 — on-device Rust embedding, model selection. |
| Sub-10ms Knowledge Retrieval (offline-first-search) | COVERED | MOSS §3 — query pipeline diagram, load-once rule. |
| Real-Time Local Indexing | COVERED | MOSS §2/§5 — session ops, perf characteristics, session-vs-loaded. |
| Voice Agent (LiveKit) | COVERED | MOSS §10 + API-REF Recipe 1 — full context-injection agent. |

## Docs — top-level

| Page | Bucket | Note |
| --- | --- | --- |
| Product Updates (changelog) | PARTIAL | MOSS §3/§14 cite the load-bearing entries (beta.14 2,300→10ms; beta.9 ~3× mgmt; multi-index v1.1.0 2026-05-06; portal multi-org 2026-04). Full per-version JS/Python/CLI/Portal history is summarized, not enumerated (e.g. beta.5 Pipecat removal, beta.2 ESM fix, JS v1.0.1 `withAuthenticator()` factory + `CLOUD_API_*` constant rename). Acceptable for a battle-pack; not a true gap. |
| Docs (index landing) | OMITTED | Pure nav/landing page, no unique facts. |
| Pricing & Limits | PARTIAL | MOSS §13 + API-REF §9 reproduce the full tier table (price/storage/ingest/egress/voice-min/projects/indexes/sessions-Enterprise/never-metered). **Missing one row: "Sync Engine" (-, Standard, Standard, Dedicated).** |

## Docs — Integrate (concept guides)

| Page | Bucket | Note |
| --- | --- | --- |
| Authentication (integrate) | COVERED | MOSS §9 + API-REF §1 — server vs browser, session auth, 403. |
| Custom Embeddings | COVERED | MOSS §3 + API-REF §4 — model_id custom, embedding on every doc+query, ValueError. |
| Deployment / Production | COVERED | API-REF §9 production checklist (env keys, cachePath, p50/p95, offline, encrypt, backups). |
| Hybrid Search | COVERED | MOSS §3 + API-REF §4 — alpha table, per-language examples, choosing alpha. |
| Indexing Data | COVERED | MOSS §2 + API-REF — data model, upsert, session indexing, chunking tips. |
| Metadata Filtering | COVERED | MOSS §3 + API-REF §4 — all operators incl `$near` haversine, string-compare rule. |
| Multi-Index Search | COVERED | MOSS §3 + API-REF §4 — load_indexes/query_multi_index, global top_k, same-model rule. |
| Parsing Files | COVERED | MOSS §3 + API-REF — PDF-only, ≤20 files, no custom, onProgress, path/data. |
| Retrieval | COVERED | MOSS §3 + API-REF §4 — vector/keyword/hybrid, tuning. |
| Sessions | COVERED | MOSS §2/§7 + API-REF §7 — lifecycle, SessionIndex methods, models, auth. |
| Storage & Persistence | COVERED | MOSS §5 + API-REF §7 — cloud canonical, disk cache, hot-reload/auto-refresh. |

## Docs — Integrations

| Page | Bucket | Note |
| --- | --- | --- |
| Agora | COVERED | MOSS §10 — agora-moss MCP, /join body, ≤48-char name rule, ngrok. |
| DSPy | COVERED | MOSS §10 — MossRM (k=3, alpha=0.5 defaults), ReAct tool. |
| ElevenLabs | COVERED | MOSS §10 — elevenlabs-moss client tool, dashboard steps, MossClientTool params. |
| LangChain | COVERED | MOSS §10 — MossRetriever, get_moss_tool (`moss_search`). |
| LiveKit | COVERED | MOSS §10 + API-REF Recipe 1 — flagship context-injection agent. |
| MCP Server | COVERED | MOSS §10 + API-REF Recipe 7 — all tools, env vars, base-URL override. |
| Moss CLI | COVERED | MOSS §10 — moss init/index/query/doc/job, profiles, interactive REPL, file formats. |
| Next.js | COVERED | MOSS §10 — Server Actions, module-scope loadIndex, env keys. |
| Pipecat | COVERED | MOSS §10 — pipecat-moss MossRetrievalService processor, params. |
| VAPI | COVERED | MOSS §10 — vapi-moss Custom KB webhook, verify_vapi_signature, dashboard. |
| Vercel AI SDK | COVERED | MOSS §10 — all 4 tools, read-only vs needsApproval mutating. |
| VitePress | COVERED | MOSS §10 — vitepress-plugin-moss, two-phase search, Ctrl/Cmd+K. |

## Docs — Reference / Browser SDK

| Page | Bucket | Note |
| --- | --- | --- |
| Browser SDK reference (browser/api) | COVERED | MOSS §4/§7.3 — WASM, load-before-query, custom auth. |
| Browser vs Node | COVERED | MOSS §4 surface table contrasts browser vs Node clearly. |
| MossClient (browser class) | COVERED | MOSS §4 — lazy vs eager `create()`, query/load, model option. |

## Docs — Reference / C SDK

| Page | Bucket | Note |
| --- | --- | --- |
| C API reference | COVERED | MOSS §7.4 — MossResult/OK=0, moss_last_error, handle/free rules, MossQueryOptions. |
| C examples | COVERED | MOSS §7.4 shows the session workflow (add/query/filter/push/free) pattern. |
| C SDK reference (getting-started) | COVERED | MOSS §7.4 — tarball install, link flags (Security/SystemConfiguration, Linux libs). |

## Docs — Reference / Elixir SDK

| Page | Bucket | Note |
| --- | --- | --- |
| Elixir SDK reference (api) | COVERED | MOSS §7.5 — Elixir 1.15+/OTP 26+, Rust core. |
| Moss.Client | COVERED | MOSS §7.5 — Client.new/create_index/load_index/query, default minilm. |
| Moss.Session | COVERED | MOSS §7.5 — session/add_docs/query/push_index, {:ok,{added,updated}}. |
| Types (Elixir) | PARTIAL | DocumentInfo/result structs implied via examples; the explicit Elixir struct/enum type listing is not enumerated separately. Low importance. |

## Docs — Reference / Errors

| Page | Bucket | Note |
| --- | --- | --- |
| Errors & Troubleshooting | COVERED | MOSS §15 + API-REF §6 — full error table (Unauthorized, Index not found/loaded/exists, embeddings runtime, custom, job failed) + HTTP codes. |

## Docs — Reference / JS SDK

| Page | Bucket | Note |
| --- | --- | --- |
| SDK reference (js/api) | COVERED | MOSS §7.1 + API-REF §7 — full MossClient method list. |
| MossClient (js class) | COVERED | API-REF §7 — signatures + defaults (topK 5, alpha 0.8, autoRefresh false, polling 600). |
| Custom Authenticator (JS) | COVERED | MOSS §9 + API-REF §1 — IAuthenticator, backend token endpoint, `expiresIn-60` cache. |
| CreateIndexFromFilesOptions | COVERED | API-REF §7 data types — modelId minilm/mediumlm, onProgress. |
| CreateIndexOptions | COVERED | API-REF §7 — modelId, onProgress. |
| DocumentInfo (JS) | COVERED | MOSS §2 + API-REF — id/text/metadata/embedding. |
| GetDocumentsOptions (JS) | COVERED | API-REF §7 — docIds optional. |
| IndexInfo (JS) | COVERED | MOSS §2 + API-REF — id/name/version/status/docCount/model. |
| JobProgress (JS) | MISSED-IN-SCOPE | Neither report names the `JobProgress` interface (the onProgress callback payload: phase/progress shape). Low importance — onProgress is mentioned, the field-level struct isn't. |
| JobStatusResponse (JS) | COVERED | API-REF §5/§7 — all fields enumerated. |
| LoadIndexOptions (JS) | COVERED | MOSS §7.1 + API-REF — autoRefresh/pollingIntervalInSeconds/cachePath. |
| ModelRef (JS) | COVERED | MOSS §2 + API-REF — `{id, version}`. |
| MutationOptions (JS) | COVERED | API-REF — upsert default true, onProgress. |
| MutationResult (JS) | COVERED | API-REF — jobId/indexName/docCount. |
| ParseFileInput (JS) | COVERED | MOSS §3 + API-REF — name/contentType/path/data, data wins. |
| QueryOptions (JS) | COVERED | API-REF §4 — topK/alpha/embedding/filter, full property table. |
| QueryResultDocumentInfo (JS) | COVERED | API-REF §4 — adds score + index_name. |
| RefreshResult (JS) | MISSED-IN-SCOPE | Neither report names the `RefreshResult` interface (`wasUpdated`, `previousUpdatedAt`, `newUpdatedAt`). The auto-refresh *behavior* is covered; this return-type struct is not. Low importance. |
| SearchResult (JS) | COVERED | API-REF §4 — docs/query/indexName/timeTakenInMs. |
| FilterCondition (JS) | COVERED | API-REF §4 — full operator union type. |
| ISODate (JS) | OMITTED | Trivial type alias (string). No unique fact. |
| JobPhase (JS) | COVERED | API-REF §2 enums — downloading/deserializing/generating_embeddings/building_index/uploading/cleanup. |
| JobStatus (JS) | COVERED | API-REF §2 enums — pending_upload/uploading/building/completed/failed. |
| MetadataFilter (JS) | COVERED | API-REF §4 — full recursive type. |
| MossModel (JS) | COVERED | API-REF §2 — moss-minilm/moss-mediumlm/custom. |

## Docs — Reference / Python SDK

| Page | Bucket | Note |
| --- | --- | --- |
| SDK reference (python/api) | COVERED | MOSS §7.2 + API-REF §7 — full method list. |
| MossClient (python class) | COVERED | API-REF §7 — all signatures + defaults. |
| SessionIndex (python class) | COVERED | API-REF §7 — add_docs/(added,updated), delete/get/query/push_index. |
| AddDocumentsOptions (py) | COVERED | API-REF — upsert (MutationOptions-equivalent). |
| DocumentInfo (py) | COVERED | MOSS §2 + API-REF. |
| GetDocumentsOptions (py) | COVERED | API-REF — doc_ids. |
| IndexInfo (py) | COVERED | API-REF. |
| IndexStatus (py) | COVERED | API-REF §2 — NotStarted/Building/Ready/Failed. |
| JobPhase (py) | COVERED | API-REF §2 enums. |
| JobProgress (py) | PARTIAL | onProgress concept covered; the explicit JobProgress struct fields not separately enumerated. Low importance. |
| JobStatus (py) | COVERED | API-REF §2 enums. |
| JobStatusResponse (py) | COVERED | API-REF §5/§7. |
| LoadIndexesResult (py) | COVERED | MOSS §3 + API-REF — loaded/failed. |
| ModelRef (py) | COVERED | API-REF. |
| MutationOptions (py) | COVERED | API-REF. |
| MutationResult (py) | COVERED | API-REF. |
| ParseFileInput (py) | COVERED | MOSS §3 + API-REF. |
| PushIndexResult (py) | COVERED | MOSS §5 + API-REF — job_id/index_name/doc_count/status. |
| QueryOptions (py) | COVERED | API-REF §4 — full table. |
| QueryResultDocumentInfo (py) | COVERED | API-REF §4. |
| SearchResult (py) | COVERED | API-REF §4. |

## Docs — Reference / SDK overview & Swift

| Page | Bucket | Note |
| --- | --- | --- |
| SDK Overview (reference/sdk) | COVERED | MOSS §7 intro — cross-SDK compatibility, build-in-one/query-in-another. |
| Swift SDK reference (api) | COVERED | MOSS §7.6 — iOS 15+/Xcode 15+, moss-litelm default. |
| MossClient (swift class) | COVERED | MOSS §7.6 — init, session(), close(). |
| MossSession (swift class) | COVERED | MOSS §7.6 — addDocs/query/pushIndex, save(toCachePath:)/loadFromDisk, onMemoryPressure. |
| Custom Authenticator (Swift) | COVERED | MOSS §7.6/§9 — raw token only (no `Bearer ` prefix), the JS-vs-Swift gotcha. |
| Querying (Swift) | COVERED | MOSS §7.6 — filterJson string, raw string literals, getDocs by id, custom embeddings. |
| Types (Swift) | PARTIAL | Used implicitly in examples (QueryOptions/DocumentInfo/QueryResult); the explicit struct/enum listing page isn't enumerated separately. Low importance. |

## Docs — Start

| Page | Bucket | Note |
| --- | --- | --- |
| Core Concepts | COVERED | MOSS §2 + API-REF §2 — index/document/embeddings/retrieval/sessions/storage. |
| Quickstart | COVERED | MOSS §1/§8 + API-REF — install/auth/createIndex/loadIndex/query, JS+Py tabs. |
| Vibecoding with Moss | COVERED | MOSS §8 — Copy-page/llms.txt, MCP config, verbatim starter prompt. |
| What is Moss? | COVERED | MOSS §1 + API-REF intro — one-paragraph definition, "retrieval is a function you call". |

## Docs — Voice Agents

| Page | Bucket | Note |
| --- | --- | --- |
| Voice Agents | COVERED | MOSS §12 — Agent SDK (moss-voice-agent-manager), Backend SDK (@moss-tools/voice-server / moss-voice-server, createParticipantToken 15-min JWT), Agent CLI (deploy/env push/logs/transcripts), TTS override, multi-agent transfers, MOSS_VOICE_AGENT_ID. |

---

## Gaps to patch (specific missing facts)

1. **Pricing — "Sync Engine" row (MEDIUM):** The pricing table in MOSS.md §13 (and API-REF §9) omits the `Sync Engine` row: Developer = none, Hobbyist/Startup = **Standard**, Enterprise = **Dedicated**. Add this row so the tier comparison is complete. (Source: `pricing.md`, line 4393.)

2. **`RefreshResult` JS interface (LOW):** The auto-refresh *return type* is undocumented. Add the struct: `{ indexName, previousUpdatedAt, newUpdatedAt, wasUpdated: boolean }` — useful when a dev wants to know whether a refresh actually swapped in a new version. (Source: `reference/js/interfaces/RefreshResult`.)

3. **`JobProgress` interface (LOW):** Both reports reference the `onProgress` callback but never give its payload shape. Add the `JobProgress` field listing (phase/percent) for JS and Python so devs can type their progress handlers. (Source: `reference/js/interfaces/JobProgress`, `reference/python/interfaces/JobProgress`.)

4. **Changelog enumeration (LOW / optional):** A few discrete changelog facts aren't surfaced and could matter for "which version do I need": JS **v1.0.1** added `MossClient.withAuthenticator()` factory + renamed `CLOUD_API_MANAGE_URL` → granular `CLOUD_API_IDENTITY_URL`/`CLOUD_API_AUTH_URL`; Python **beta.5** removed the in-SDK Pipecat integration (now a separate extension); session report requires `moss-voice-agent-manager>=1.0.0b14`, env push requires `moss-agent-cli>=0.4.0`, transcripts require `>=0.3.0`. (Source: `changelog.md`.) These version floors are partly captured in §12 but not consolidated.

5. **Elixir/Swift `Types` pages (LOW):** Explicit struct/enum reference listings for Elixir and Swift are only shown implicitly through code examples. Field-level type tables aren't reproduced. Acceptable given cross-SDK type identity is stated, but a dev writing Elixir/Swift structs from scratch has slightly less to copy.

---

## Intentionally omitted (out of scope)

Given the host-platform policy, almost nothing is deliberately out of scope. The only entries treated as non-substantive (no unique technical facts to cover):

- **Docs (index.md)** — nav/landing page only.
- **ISODate (js)** — trivial `string` type alias.
- **Optional section link-outs** — Discord (`discord.gg/eMXExuafBR`), GitHub samples (`github.com/usemoss/moss-samples`), Typeform "Request a Demo". All three are *cited* in the reports (Discord + samples appear in MOSS §8/§15) but are not doc pages, so they don't count toward the page denominator.

---

## Verdict

The two reports together provide **near-complete, high-fidelity coverage** of the Moss documentation set. All 12 Control Plane endpoints, all 11 integration adapters, all 6 SDKs (JS/Python/Swift/C/Elixir/Browser), the full voice-agents managed stack, pricing, errors, and every build/integrate concept guide are covered with correct endpoints, parameters, defaults, and runnable code. The only genuine in-scope misses are three small JS/Python type-interface stubs (`RefreshResult`, `JobProgress`) and one pricing-table row (`Sync Engine`) — all low/medium importance and none affecting the core build path. The changelog and the Elixir/Swift `Types` pages are summarized rather than exhaustively enumerated, which is appropriate for a hackathon battle-pack rather than a true gap.
