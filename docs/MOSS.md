# Moss — The Retrieval Hero (Host Platform Guide)

> Hackathon writer's note: Moss is the **host** of the Conversational AI Hackathon 2026 (Moss, F25) and the single most important platform here. The whole event thesis is "voice is cheap/fast now; **retrieval is the bottleneck** — Moss solves it with sub-10 ms semantic search that runs *where your agent lives*." If you build a voice/co-pilot/support agent this weekend, **Moss is your retrieval layer.** This guide is exhaustive. For the raw HTTP control-plane endpoints (presigned uploads, `/v1/manage` actions, request/response JSON), see the companion file **`MOSS-API-REFERENCE.md`** — this guide deliberately links to it instead of duplicating it.

---

## 1. What is Moss, in one paragraph

**Moss is a high-performance runtime for real-time semantic search.** You give it documents (`{id, text, metadata}`); it builds an efficient index; you `load` that index into your process and `query` it. Once loaded, a query is a **local, in-memory function call (~1–10 ms)** — it embeds the query text with a built-in on-device model, runs vector + keyword (hybrid) search in Rust, and returns ranked docs. No per-query network round trip, no vector DB to operate. The exact same API runs in **the cloud, in Node.js, in the browser (WASM), and on-device (iOS/C/Elixir)**, and it can **sync indexes between those surfaces** with zero-downtime hot-swaps. Two write paths exist: **cloud indexes** (`createIndex` → async server build → `loadIndex`) for large stable corpora, and **sessions** (`client.session(name)` → `add_docs`/`query` locally → `push_index`) for data created *during* a live interaction (a call transcript, a per-user working set). The canonical copy lives in the cloud; readers `loadIndex`/`session(name)` to get a warm in-memory snapshot.

### Why it matters for a voice-AI hackathon — and which of the 3 tracks it serves

Voice agents have a hard latency budget: the human notices any pause over ~300–500 ms. Traditional RAG (network call → remote vector DB → rerank) burns 100–500 ms *per turn* before the LLM even starts. Moss collapses retrieval to **single-digit milliseconds** because the index is in-process next to your agent. That directly unlocks the judging criteria (fundable, real voice-AI products):

- **Track 1 — Lead Gen:** sub-10 ms lookups over a product/pricing/objection-handling corpus so the agent answers prospect questions instantly; metadata filters segment by plan/region/industry.
- **Track 2 — Support (CS bots that pull docs + user history):** Moss is purpose-built for this — query a **long-term knowledge index** (FAQs, policies, manuals via PDF parsing) **and** a **per-conversation session** (the live transcript + that user's history) in the same turn, both local, both fast. Drop-in adapters exist for VAPI, ElevenLabs, Agora, Pipecat, and LiveKit.
- **Track 3 — Co-Pilot (ambient agents that listen and surface live context):** sessions index transcript turns in real time on-device; **cross-agent handoff** lets one process write and another read the same named index; **live-call context** queries short-term + long-term together. This is the ambient/co-pilot pattern out of the box.

### Hello world (the entire core loop)

```bash
npm install @moss-dev/moss        # JS/TS (Node)
# or: pip install moss            # Python
export MOSS_PROJECT_ID=your_project_id
export MOSS_PROJECT_KEY=your_project_key
```

```ts
import { MossClient, DocumentInfo } from '@moss-dev/moss'

const client = new MossClient(process.env.MOSS_PROJECT_ID!, process.env.MOSS_PROJECT_KEY!)

const documents: DocumentInfo[] = [
  { id: 'doc1', text: 'How do I track my order? Log into your account.', metadata: { category: 'shipping' } },
  { id: 'doc2', text: 'What is your return policy? 30-day returns for most items.', metadata: { category: 'returns' } },
]

await client.createIndex('faqs', documents, { modelId: 'moss-minilm' }) // async build, polls to completion
await client.loadIndex('faqs')                                          // hydrate into memory (do this ONCE)
const results = await client.query('faqs', 'How do I return a damaged product?', { topK: 3 })
console.log(results.docs[0]) // { id: 'doc2', score: ~0.88, text: '...', metadata: {...} }
```

Python equivalent:

```python
import os, asyncio
from moss import MossClient, DocumentInfo, QueryOptions

client = MossClient(os.getenv("MOSS_PROJECT_ID"), os.getenv("MOSS_PROJECT_KEY"))

async def main():
    docs = [
        DocumentInfo(id="doc1", text="How do I track my order? Log into your account.", metadata={"category": "shipping"}),
        DocumentInfo(id="doc2", text="What is your return policy? 30-day returns for most items.", metadata={"category": "returns"}),
    ]
    await client.create_index("faqs", docs, "moss-minilm")
    await client.load_index("faqs")
    results = await client.query("faqs", "How do I return a damaged product?", QueryOptions(top_k=3, alpha=0.6))
    print(results.docs[0].id, results.docs[0].score, results.docs[0].text)

asyncio.run(main())
```

> **The one rule that trips everyone up:** you MUST `loadIndex` / `load_index` (or open a `session`) before you `query`. A query runs against an *in-memory* index. If you skip the load, the JS/Python SDK will **fall back to the cloud `/query` HTTP endpoint** (~100–500 ms) instead of running locally — fine for a quick test, fatal for a voice agent's latency budget. The browser, C, Elixir, and Swift SDKs throw if you query without loading.

---

## 2. Core concepts

### Index
The structure that powers fast local search. You add documents; Moss builds an efficient index for sub-10 ms queries. Each project can hold **multiple indexes** (isolated search spaces), each with its own embedding model. An `IndexInfo` carries: `id`, `name`, `version`, `status` (`NotStarted` | `Building` | `Ready` | `Failed`), `docCount`, `createdAt`, `updatedAt`, `model` (`{id, version}`).

### Document
```
{ id: string, text: string (REQUIRED, the canonical text to embed/search),
  metadata?: Record<string,string>, embedding?: number[] }
```
- `id` is unique within an index. **Upserts replace matching ids** — keep ids stable so updates work.
- `metadata` is a **flat string→string map**. Numeric values are stored/compared **as strings** (write `"100"`, not `100`).
- `embedding` is only for the `custom` model path.

### Embeddings & models
Vectors generated **on-device** by a built-in model (embedding runs in Rust for speed), or supplied by you (`custom`). Pick the model **per index at creation**:

| Model | Behavior | Dimension | When |
| --- | --- | --- | --- |
| `moss-minilm` | fast, lightweight; **default** | 384 | speed-first, edge/offline, voice |
| `moss-mediumlm` | higher accuracy, still efficient | — | when you need more recall/precision |
| `moss-litelm` | the on-device default on **iOS (Swift)** | — | mobile |
| `custom` | you supply vectors; Moss does **not** embed | your dim | proprietary/hosted embedding pipeline |

All vectors in an index must share one dimensionality and one model. **All SDKs read the same index format** — build in Python, query from Swift or JS.

### Retrieval
Three strategies, all over the same `query` call, tuned by **`alpha`**:
- **Vector / semantic** — matches on meaning (`alpha = 1.0`)
- **Keyword / BM25** — matches on exact terms (`alpha = 0.0`)
- **Hybrid** — blends both; **default `alpha = 0.8`** (semantic-heavy)

Knobs: `top_k` (result count) and `alpha`. Optional metadata `filter` and reranking.

### Sessions (the real-time / local-first path)
A **session** is an in-process index you read AND write in real time with **no cloud round trip on any op**. Lifecycle: **create-or-resume → mutate locally → query locally → push (optional)**. Opened with `client.session(name)`; backed by `SessionIndex` (Python) / `MossSession` (Swift/C/Elixir). This is how Moss indexes data *during* a live call. **Sessions exist in Python, Swift, Elixir, and C today; JavaScript (Node) session support is "coming."**

### Storage & sync
Indexes live in the cloud (the source of truth). SDKs hydrate them into memory (`loadIndex`). Optional: disk cache (JS), auto-refresh hot-swap, and `push_index` (device → cloud). Local compute is free and never metered.

### The runtime in one sentence
"Because the index lives next to your agent, **retrieval is a function you call, not a service you query.**"

---

## 3. How retrieval works (the query pipeline)

```
Query text ─► Embed locally (built-in model) ─► Retrieve in-memory top-k ─► Rerank (optional) ─► Results
            └──────────────── all in-process against the loaded index ──────────────┘
```

- Load the index once; then every query is local.
- `query()` returns a `SearchResult`: `{ docs: QueryResultDocumentInfo[], query, indexName?, timeTakenInMs? }`.
- Each result doc: `{ id, text, metadata?, score (0–1, higher = more similar), index_name? }`.
- **Latency claim, verbatim from the changelog:** query latency dropped from **~2,300 ms to ~10 ms for 100K vectors** (v1.0.0-beta.14). A million 256-dim vectors compress to ~500 MB in memory.
- **Cloud fallback:** in JS/Python, if you call `query()` on an index you never loaded, it transparently hits the cloud `/query` API. Convenient, but ~100–500 ms — load first for voice.

### Hybrid search — the `alpha` parameter

| `alpha` | Behavior |
| --- | --- |
| `1.0` | Pure semantic (embeddings only) |
| `0.0` | Pure keyword (BM25 only) |
| between | Blend; **default `0.8`** (semantic-heavy) |

```python
hybrid       = await client.query("idx", "return policy", QueryOptions(top_k=3, alpha=0.6))
keyword_only = await client.query("idx", "return policy", QueryOptions(top_k=3, alpha=0.0))
semantic     = await client.query("idx", "return policy", QueryOptions(top_k=3, alpha=1.0))
```
Lower `alpha` (toward keyword) for exact identifiers, SKUs, names, jargon. Higher (toward semantic) for natural-language paraphrases. Tune **per index and per intent**. `0.8` is recommended for most **voice** use cases.

### Metadata filtering

Attach metadata at index time, then constrain queries. **Filtering is evaluated only on the locally loaded index** — load (or open a session) before filtering. If you pass a `filter` to a non-loaded index, the SDK logs a warning and **skips the filter** (the cloud query API doesn't support filtering yet).

Operators:

| Operator | Meaning |
| --- | --- |
| `$eq`, `$ne` | equals / not equals |
| `$gt`, `$gte`, `$lt`, `$lte` | comparisons (values compared **as strings**) |
| `$in`, `$nin` | value in / not in a list |
| `$near` | within a haversine distance of a point: `"lat,lng,radiusMeters"` |
| `$and`, `$or` | compose conditions (arbitrarily nestable) |

A single condition needs no wrapper; compose with `$and`/`$or`.

```python
# $eq — single condition, no wrapper
QueryOptions(top_k=5, filter={"field": "category", "condition": {"$eq": "shoes"}})

# $and — shoes under $100 (note: numeric values as strings)
QueryOptions(top_k=5, alpha=0.6, filter={"$and": [
    {"field": "category", "condition": {"$eq": "shoes"}},
    {"field": "price",    "condition": {"$lt": "100"}},
]})

# $in — city in a set
QueryOptions(top_k=5, filter={"field": "city", "condition": {"$in": ["new-york"]}})

# $near — within 5 km of Times Square
QueryOptions(top_k=5, filter={"field": "location", "condition": {"$near": "40.7580,-73.9855,5000"}})
```

JS `FilterCondition` accepts `string | number` in the value (numbers auto-stringified). Python QueryOptions filter accepts ints (auto-coerced to strings). C passes the filter as an escaped JSON string in `MossQueryOptions.filter_json`.

### Multi-index search
Query several **loaded** indexes in one call; get a **global top-K** with each result tagged by source `index_name`. All indexes must be loaded and **share the same embedding model**. `top_k` is the global cap (not per-index).

```python
indexes = ["products", "reviews", "faqs"]
result = await client.load_indexes(indexes)             # best-effort: LoadIndexesResult{loaded, failed}
print(result.loaded, result.failed)
results = await client.query_multi_index(indexes, "wireless headphones battery life", QueryOptions(top_k=6))
for doc in results.docs:
    print(f"[{doc.index_name}] {doc.id} {doc.score:.3f} {doc.text[:60]}")
await client.unload_indexes(indexes)                    # idempotent
```
(Multi-index landed in Python **v1.1.0 / 2026-05-06**.)

### Custom embeddings (bring your own vectors)
Use `model_id="custom"` when you already generate embeddings (proprietary/hosted model, shared pipeline). Moss indexes & searches them but does **not** embed.
- **At index time:** every document must carry `.embedding`. (Omit `model_id` and if *all* docs have embeddings, Moss infers `"custom"`; mixed docs are rejected.)
- **At query time:** pass the query vector via `QueryOptions.embedding` (no local model to embed query text).
- All vectors must share dimensionality. Adding a doc without `.embedding`, or querying without `QueryOptions.embedding`, raises a `ValueError`.
- **`create_index_from_files` does NOT support custom** (it embeds server-side).

```python
docs = [DocumentInfo(id="1", text="...", embedding=embed("..."))]
await client.create_index("tickets", docs, model_id="custom")
await client.load_index("tickets")
results = await client.query("tickets", "billing problem", QueryOptions(top_k=3, embedding=embed("billing problem")))
```

### File parsing (PDF ingest, server-side)
`createIndexFromFiles` / `create_index_from_files` indexes raw files directly — **server parses, chunks, and embeds**; you don't extract text or chunk yourself.

- **Supported format:** PDF (`application/pdf`) today. More planned. For other types, extract text yourself and use `createIndex`.
- **Limits:** **max 20 files per call.** Each `ParseFileInput` needs at least one of `path` or `data` (`data` wins if both).
- **Model:** `moss-minilm` (default) or `moss-mediumlm`; **`custom` not supported** (server embeds).
- **Progress (JS only):** `onProgress` callback ~every 2 s.

```ts
// Node: from disk
const result = await client.createIndexFromFiles('knowledge-base', [
  { name: 'report.pdf', contentType: 'application/pdf', path: '/docs/report.pdf' },
  { name: 'manual.pdf', contentType: 'application/pdf', path: '/docs/manual.pdf' },
], { modelId: 'moss-minilm' })
console.log(`Index ready - ${result.docCount} chunks created`)

// Browser: directly from a <input type=file>
const files = Array.from(fileInput.files!).map(file => ({
  name: file.name, contentType: 'application/pdf' as const, data: file, // Blob/File accepted
}))
await client.createIndexFromFiles('knowledge-base', files, {
  onProgress: (p) => console.log(`${p.currentPhase}: ${p.progress}%`)
})
```
```python
result = await client.create_index_from_files('knowledge-base', [
    ParseFileInput(name='report.pdf', content_type='application/pdf', path='/docs/report.pdf'),
], model_id='moss-minilm')
# Or in-memory bytes:
with open('/docs/report.pdf','rb') as f: pdf = f.read()
await client.create_index_from_files('kb', [ParseFileInput(name='report.pdf', content_type='application/pdf', data=pdf)])
```
> **Compose tip:** Moss PDF parsing is great for simple FAQ PDFs. For complex docs (tables, nested layouts, scanned forms), parse with **Unsiloed** first, then push the cleaned chunks into Moss via `createIndex`. See Hackathon Recipes.

---

## 4. Deployment surfaces: cloud vs browser vs on-device

Same API everywhere; choose where queries run.

| Surface | SDK / package | Where queries run | Sessions | Use it for |
| --- | --- | --- | --- | --- |
| **Cloud-backed server** | `@moss-dev/moss` (Node), `moss` (Python) | server-side runtime, in-memory after `loadIndex` | Python: yes; Node: coming | API routes, voice-agent backends, pipelines |
| **Browser (WASM)** | `@moss-dev/moss-web` | locally in the browser after `loadIndex` (no server round-trip, data stays on device) | not supported | private in-app/extension search, VitePress docs |
| **On-device iOS** | Swift package `usemoss/moss` | on-device (libmoss), no network | yes (`MossSession`) | mobile copilots, offline search |
| **Native / embedded** | C `libmoss`, Elixir `moss` | in-process / on-device | yes | C/C++/Rust/Elixir backends, edge |
| **Electron desktop** | `@moss-dev/moss` in main process | main process, queried over IPC | (Node) | desktop apps, offline search |

### Cloud (server) — the default for hackathon backends
`createIndex` builds through the cloud, then `loadIndex` pulls it into your process. Reads dominate; data changes infrequently → use a **loaded cloud index**.

### Browser / WASM (`@moss-dev/moss-web`)
In-browser vector search; **WASM module + embedding model download on first use**. Queries run on WebAssembly — **no data leaves the device once loaded.** Full CRUD from the browser. **Never ship your `projectKey` in client code** — use the custom authenticator (mint short-lived tokens from your backend). A million 256-dim vectors ≈ 500 MB; most apps need far less.

```ts
import { MossClient } from "@moss-dev/moss-web";
const client = new MossClient("project-id", "project-key");   // lazy init (WASM/model on first call)
// or: const client = await MossClient.create("project-id","project-key");  // eager
await client.createIndex("kb", [{ id: "1", text: "Machine learning fundamentals" }]);
await client.loadIndex("kb");                                 // ALWAYS load before query
const results = await client.query("kb", "AI and neural networks");
// options: { model: "moss-minilm" | "moss-mediumlm", baseUrl }
```
**Browser extension pattern:** host the Moss client + index in the **background service worker**; content scripts `postMessage` queries to it; persist the index in IndexedDB / extension storage.

### On-device iOS (Swift)
On-device by default (`moss-litelm`); indexes are created **locally** (`session` → `addDocs` embeds on-device), then `pushIndex`/`loadIndex` to sync via cloud. `save(toCachePath:)` / `loadFromDisk` persist without re-embedding. Wire `onMemoryPressure` from `UIApplication.didReceiveMemoryWarningNotification`.

### Electron desktop
Main process owns the client + index; renderer calls over IPC. Index persists to the user data dir; syncs in background when online; works offline.

```ts
// main.ts
import { app, ipcMain } from 'electron'
import { MossClient } from '@moss-dev/moss'
let client: MossClient; const INDEX = 'electron-docs'
app.whenReady().then(async () => {
  client = new MossClient(process.env.MOSS_PROJECT_ID!, process.env.MOSS_PROJECT_KEY!)
  await client.createIndex(INDEX, initialDocs, { modelId: 'moss-minilm' })
})
ipcMain.handle('search', async (_e, q: string) => {
  await client.loadIndex(INDEX)
  return client.query(INDEX, q, { topK: 5 })
})
```

---

## 5. Instant index updates / real-time sync / data hydration

Two directions: **hydration** (cloud → device) and **persist** (device → cloud). Two independent freshness layers once live.

### Hydration
Opening a session or `loadIndex` downloads the index binary and deserializes into memory — **no re-embedding**, agent starts warm.

### Layer 1 — mutations (the write API)
`add_docs` / `delete_docs` are **async**: you submit; Moss rebuilds server-side **without touching your live service**. A mutation moves through `pending_upload → uploading → building → completed`; while building it reports phases (`generating_embeddings`, `building_index`). When `completed`, the new version is available in the cloud. `MutationResult` = `{ job_id, index_name, doc_count }`.

```python
await client.add_docs("product-catalog",
  [DocumentInfo(id="item-9182", text="Wireless headphones, 40-hour battery.",
                metadata={"category": "audio", "in_stock": "true"})],
  MutationOptions(upsert=True))
```

### Layer 2 — runtime hot-swap (auto-refresh)
Load with `auto_refresh` and Moss keeps the in-memory copy current automatically. It polls the cloud; on a newer version, it **downloads in the background while the current version keeps serving**, then **hot-swaps atomically**. In-flight queries finish on the old version; new queries see the update. **No restart, no dropped requests.**

```python
await client.load_index("product-catalog", auto_refresh=True, polling_interval_in_seconds=120)
```
```ts
await client.loadIndex('my-index', { autoRefresh: true, pollingIntervalInSeconds: 300 })
```

**Tuning `polling_interval_in_seconds`** (controls *how often it checks*, not build speed; default **600**):

| Data change frequency | Interval | Notes |
| --- | --- | --- |
| Near-real-time (live inventory/pricing) | 30–60 s | size your build time accordingly |
| Regular (daily policy changes) | 300–600 s | default 600 s fits here |
| Infrequent (quarterly/stable FAQs) | 1800 s+ | low overhead |

- **Force an immediate refresh:** call `load_index(name)` again (blocking download+install). Calling `loadIndex` again *without* `autoRefresh` stops polling and replaces the snapshot.
- **Independent per-index refresh:** each index runs its own timer; a slow rebuild on one never blocks another.
  ```python
  await client.load_index("live-inventory",   auto_refresh=True, polling_interval_in_seconds=30)
  await client.load_index("support-policies", auto_refresh=True, polling_interval_in_seconds=600)
  await client.load_index("legal-archive",    auto_refresh=True, polling_interval_in_seconds=3600)
  ```
- **Convergence:** with auto-refresh, a loaded index converges to the latest version within at most one polling interval after the build completes.

### Persist (device → cloud)
A session accumulates context locally; `push_index()` syncs it back — at the end or at checkpoints — so it survives and any agent can resume it. `PushIndexResult` = `{ job_id, index_name, doc_count, status }`. **No server-side re-embedding** (pushed embeddings are kept).

### Disk cache (JS SDK, Node/Bun)
`loadIndex(name, { cachePath })` caches the binary + docs to disk; subsequent loads skip the fetch when cloud data hasn't changed. Cache auto-invalidates on cloud update; auto-refresh writes through; atomic writes; path-traversal protection; graceful re-download if corrupted.

---

## 6. Cross-agent context handoff / memory

A **session is identified by its index name.** Any process that calls `client.session(name)` loads the most recent pushed version. Multiple agents/channels/devices share one evolving index by using the **same name**: one process `push_index()`-writes, another `session(name)`-reads.

```
Agent A: session("conv-123") → add_docs(...) → push_index()  ───►  Cloud index "conv-123"
Agent B: session("conv-123") ◄── loads latest pushed version ──── query(...) → push_index()
```

```python
# Agent A accumulates context, then pushes
session = await client.session(index_name="conv-123")
await session.add_docs([
  DocumentInfo(id="turn-1", text="Customer reported a duplicate $49.99 charge."),
  DocumentInfo(id="turn-2", text="Agent confirmed a refund in 3-5 business days."),
])
await session.push_index()

# Agent B (another process/device) resumes the same name
session = await client.session(index_name="conv-123")
print(f"{session.doc_count} documents loaded")
results = await session.query("status of the refund", QueryOptions(top_k=3))
await session.add_docs([DocumentInfo(id="turn-3", text="Customer confirmed the refund posted.")])
await session.push_index()
```

**Semantics:** `push_index()` creates or replaces the named cloud index; readers see the most recent completed push; loaded docs keep their pushed embeddings (no re-embedding); **all participants must use the same embedding model** (a different `model_id` than the stored index raises an error).

**Use cases:** omni-channel (voice/chat/email handlers share one index keyed by conversation/customer ID); agent escalation (frontline pushes; specialist/human opens with full history); multi-device continuity; multi-agent pipelines (router → retrieval → reasoning → review pass state through one named index — each read/write is a local in-memory op).

### Agent context as memory (capture–recall loop)
Persist agent memory as documents. Per turn: **recall** (query for relevant context, top-k) → **respond** (LLM grounded in results) → **capture** (`addDocs` upsert new insights). Two kinds in one index: **working context** (preferences, tone, decisions — updated each turn) and **durable context** (profile, tier, identifiers — changes rarely).

### Live-call context (short-term + long-term, both local)
During a call you typically query **two** indexes per turn, both loaded so neither needs a network hop:
- **Long-term** — a persistent cloud index of durable knowledge (FAQs, policies, profile); `load_index()` once at call start (optionally `auto_refresh`).
- **Short-term** — a session holding the current conversation; build it up with `add_docs()` as turns arrive; `session.push_index()` at call end.

```python
await client.load_index("support-faqs")                          # long-term
session = await client.session(index_name=f"call-{datetime.now():%Y%m%d-%H%M%S}")  # short-term
await session.add_docs([DocumentInfo(id="turn-1", text="Customer billed twice for the same renewal.")])
knowledge = await client.query("support-faqs", "duplicate charge refund policy", QueryOptions(top_k=3))
recent    = await session.query("refund request", QueryOptions(top_k=3))
# pass BOTH result sets to the model, then at call end:
await session.push_index()
```

---

## 7. All SDKs — install + quickstart

> **Cross-SDK compatibility:** JavaScript, Python, and Swift (and C/Elixir) read the **same indexes**. Build in one, query from another. Same `alpha`/filter semantics everywhere.

### 7.1 JavaScript / TypeScript (Node) — `@moss-dev/moss` (v1.0.2)
```bash
npm install @moss-dev/moss
```
`MossClient` methods (all async; mutations poll server-side until done):
`createIndex(indexName, docs, options?) → MutationResult` · `createIndexFromFiles(indexName, files, options?)` · `getIndex(name) → IndexInfo` · `listIndexes() → IndexInfo[]` · `deleteIndex(name) → boolean` · `addDocs(name, docs, options?) → MutationResult` · `deleteDocs(name, docIds, options?)` · `getJobStatus(jobId) → JobStatusResponse` · `getDocs(name, options?) → DocumentInfo[]` · `loadIndex(name, options?) → string` · `query(name, query, options?) → SearchResult` · `getAuthToken() → AuthToken`.

Key option objects:
- `QueryOptions` = `{ topK?, alpha? (default 0.8), embedding?, filter? }`
- `MutationOptions` = `{ upsert? (default true), onProgress? }`
- `CreateIndexOptions` = `{ modelId?, onProgress? }`
- `LoadIndexOptions` = `{ autoRefresh? (false), pollingIntervalInSeconds? (600), cachePath? }`
- `ParseFileInput` = `{ name, contentType, path?, data? }`

Two constructors: `new MossClient(projectId, projectKey)` (server) **or** `new MossClient(projectId, authenticator)` (browser/untrusted — see §9). Node session support is "coming"; use sessions in Python/Swift for now.

### 7.2 Python — `moss` (v1.4.0; was `inferedge-moss`)
```bash
pip install moss     # Python 3.10–3.14
```
```python
from moss import MossClient, DocumentInfo, QueryOptions, MutationOptions, GetDocumentsOptions, ParseFileInput
client = MossClient(project_id, project_key)
await client.create_index("faqs", docs, "moss-minilm")
await client.load_index("faqs", auto_refresh=True, polling_interval_in_seconds=300)
res = await client.query("faqs", "return a damaged product", QueryOptions(top_k=3, alpha=0.6))
```
`MossClient`: `create_index` · `add_docs` · `delete_docs` · `get_job_status` · `get_index` · `list_indexes` · `delete_index` · `get_docs` · `load_index(name, auto_refresh=False, polling_interval_in_seconds=600)` · `unload_index` · `query` · `query_multi_index(names, query, options)` · `load_indexes(names, ...)` → `LoadIndexesResult{loaded, failed}` · `unload_indexes(names)` · `create_index_from_files` · `session(index_name, model_id=None) → SessionIndex`.

`SessionIndex` (real-time, local; props `name`, `doc_count`): `add_docs(docs, options?) → (added, updated)` · `delete_docs(ids) → int` · `get_docs(options?)` · `query(text, options?) → SearchResult` · `push_index() → PushIndexResult`.

### 7.3 Browser / WASM — `@moss-dev/moss-web`
```bash
npm install @moss-dev/moss-web      # pulls @moss-dev/moss-wasm automatically
```
See §4 (Browser). No sessions. Always `loadIndex` before `query`. Use a custom authenticator.

### 7.4 C — `libmoss` (v0.17.0)
Prebuilt binary tarballs on GitHub (not crates.io). Two handles: `MossClient`, `MossSession`. Every fallible fn returns `MossResult` (`OK=0`, negatives are errors; `moss_last_error()` for message).
```bash
VERSION=0.17.0; TARGET=aarch64-apple-darwin   # or x86_64-apple-darwin / *-unknown-linux-gnu
curl -L -o libmoss.tar.gz \
  "https://github.com/usemoss/moss/releases/download/libmoss-v${VERSION}/libmoss-v${VERSION}-${TARGET}.tar.gz"
mkdir -p libmoss && tar -xzf libmoss.tar.gz -C libmoss   # libmoss.dylib/.so, libmoss.a, libmoss.h
```
```bash
# macOS link
clang your_app.c -o your_app -I/path/libmoss -L/path/libmoss -lmoss \
  -framework Security -framework SystemConfiguration
export DYLD_LIBRARY_PATH=/path/libmoss && ./your_app
# Linux: gcc ... -lmoss -lpthread -lm -ldl ; export LD_LIBRARY_PATH=...
```
```c
MossClient *client = NULL; moss_client_new("id","key",&client);
MossSession *session = NULL; moss_client_session(client, "my-index", NULL, &session); // NULL opts = defaults
MossDocumentInfo docs[] = {{ .id="1", .text="Billing refund request" }};
size_t added=0, updated=0; moss_session_add_docs(session, docs, 1, NULL, &added, &updated);
MossSearchResult *r = NULL; moss_session_query(session, "refund", NULL, &r);   // local, no network
moss_free_search_result(r);
MossPushIndexResult *p = NULL; moss_session_push_index(session, &p); moss_free_push_index_result(p);
moss_session_free(session); moss_client_free(client);
```
Memory rule: every out-pointer must be freed with its matching `moss_free_*()`. `MossQueryOptions` = `{ top_k, alpha, filter_json, embedding, embedding_dim }`. Handles are mutex-protected/thread-safe. Filters go in `filter_json` as escaped JSON. `model_id`: pass `NULL` for default, `"moss-mediumlm"`, or `"custom"`.

### 7.5 Elixir — `moss` (Hex.pm)
Elixir 1.15+, OTP 26+. Rust core under the hood.
```elixir
# mix.exs
defp deps, do: [{:moss, "~> 1.0"}]
```
```elixir
alias Moss.{Client, DocumentInfo}
{:ok, client} = Client.new("project-id", "project-key")
docs = [%DocumentInfo{id: "doc1", text: "How do I track my order?", metadata: %{"category" => "shipping"}}]
{:ok, _} = Client.create_index(client, "faqs", docs)        # defaults to moss-minilm
{:ok, _} = Client.load_index(client, "faqs")                # load before query
{:ok, result} = Client.query(client, "faqs", "return a damaged product", top_k: 3, alpha: 0.6)
for doc <- result.docs, do: IO.puts("#{doc.id} (#{Float.round(doc.score,4)}): #{doc.text}")
```
Sessions: `Moss.Client.session(client, "session-abc")` → `Moss.Session.add_docs/2` (returns `{:ok, {added, updated}}`) → `Moss.Session.query/3` → `Moss.Session.push_index/1`.

### 7.6 Swift (iOS) — `usemoss/moss` package (from 0.3.0)
iOS 15+, Xcode 15+, Apple-Silicon simulator. On-device default model `moss-litelm`.
```swift
// Package.swift: .package(url: "https://github.com/usemoss/moss", from: "0.3.0")
import Moss
let client = try MossClient(projectId: "id", projectKey: "key")   // or authenticator form for shipped apps
defer { client.close() }
let session = try await client.session("products")                 // on-device; embeds locally
try await session.addDocs([.init(id: "p1", text: "Running shoes.", metadata: ["category":"shoes","price":"79"])])
let hits = try await session.query("something to run in", options: .init(topK: 3))   // local query
let push = try await session.pushIndex()                           // sync to cloud
while try await client.getJobStatus(push.jobId).status != "ready" { try await Task.sleep(nanoseconds: 1_000_000_000) }
```
`MossSession` also has `save(toCachePath:)` / `loadFromDisk(cachePath:)` (persist without re-embedding), and `query(_:embedding:options:)` for custom vectors. Custom auth returns the **raw token only** (no `Bearer ` prefix — differs from JS!).

---

## 8. The Platform / Portal, Quickstart, and Vibecoding with Moss

### Portal
Sign up at **https://portal.usemoss.dev**, confirm email, sign in. Click **Create Index**; copy your **Project ID** and **Project Key** from project settings. Portal supports multi-org/team management (2026-04 update), billing UI, self-service password/profile. Onboarding help: **Moss Discord** (`https://discord.gg/eMXExuafBR`). Samples: **`github.com/usemoss/moss-samples`**.

### Quickstart (the canonical 3 steps)
1. `npm install @moss-dev/moss` (or `pip install moss`)
2. `export MOSS_PROJECT_ID=... ; export MOSS_PROJECT_KEY=...`
3. `createIndex` → `loadIndex` → `query` (see Hello World in §1).

### Vibecoding with Moss (build it WITH an AI coding tool — do this!)
Every docs page has a **Copy page** button. There's a machine-readable index at **`https://docs.moss.dev/llms.txt`** you can feed an AI tool at session start. Two power moves for the hackathon:

**A) Wire the Moss MCP server into your coding tool** so Claude Desktop / Cursor / VS Code can create indexes, add docs, and run queries *during* coding:
```json
{ "mcpServers": { "moss": {
  "command": "npx", "args": ["-y", "@moss-tools/mcp-server"],
  "env": { "MOSS_PROJECT_ID": "your-project-id", "MOSS_PROJECT_KEY": "your-project-key" } } } }
```
(Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`; Cursor: `.cursor/mcp.json`.)

**B) Paste this starter prompt** into your AI coding tool before you start (verbatim from the docs):
```
You are helping me build an application that uses Moss for real-time semantic search.
Moss: sub-10ms local queries, instant index updates, same SDK for browser/on-device/cloud.
Packages: JS @moss-dev/moss | Python moss. Creds: MOSS_PROJECT_ID, MOSS_PROJECT_KEY.
Core flow: createIndex / loadIndex / query. Hybrid: alpha (0.0 keyword, 1.0 semantic, default 0.8).
Mutations (createIndex, addDocs, deleteDocs) are async jobs; SDK polls until done.
Models: moss-minilm (fast default), moss-mediumlm (accuracy), custom (BYO vectors).
Metadata filters on local indexes: $eq,$ne,$in,$gt,$lt,$and,$or.
Common errors: Unauthorized (creds), Index not found (createIndex first), Index not loaded (loadIndex before query).
```

---

## 9. Authentication & secret hygiene

- **Server-side:** `new MossClient(projectId, projectKey)` / `MossClient(project_id, project_key)`. Export `MOSS_PROJECT_ID` / `MOSS_PROJECT_KEY`.
- **Browser / mobile / untrusted:** **never embed `projectKey`.** Implement a custom authenticator that fetches a **short-lived token** from your backend.

**JS custom authenticator** — backend mints token, frontend implements `IAuthenticator`:
```ts
// Backend (Express): your projectKey stays here
app.get('/api/moss-token', yourAuthMiddleware, async (_req, res) =>
  res.json(await moss.getAuthToken()))   // returns { token, expiresIn }

// Frontend
class MyAuth implements IAuthenticator {
  async getAuthToken(): Promise<AuthToken> {
    const r = await fetch('/api/moss-token', { credentials: 'include' }); return r.json()
  }
  async getAuthHeader(): Promise<string> { const { token } = await this.getAuthToken(); return `Bearer ${token}` }
}
const client = new MossClient('your-project-id', new MyAuth())
```
The SDK caches tokens for `expiresIn - 60` s automatically. **JS returns the full `Bearer <token>` header; Swift returns the raw token only (no prefix).**

Session auth: credentials are validated when a session opens (`session()` raises if invalid); long-lived sessions cache + auto-refresh tokens. Invalid creds on the control plane return `403 Forbidden`.

---

## 10. ALL integrations (pattern + code)

> **Recurring pattern across voice integrations:** expose Moss as `search_knowledge_base(query)`, pre-load the index once, set `top_k` (5 default) and `alpha` (0.8 default). For the lowest latency, prefer **context injection on every user turn** over LLM "tool calling" (no "should I search?" round trip). Most adapters fall back to env vars `MOSS_PROJECT_ID`/`MOSS_PROJECT_KEY`/`MOSS_INDEX_NAME`.

### LiveKit (voice transport + agents) — the flagship voice integration
LiveKit provides STT/LLM/TTS; **Moss supplies retrieval.** Two patterns: a **function tool** the LLM calls, or **context injection** (recommended). The docs ship a full **Context Injection** agent that queries Moss on *every* user turn and injects results as a system message before generation (lower latency, more consistent than tool-calling).
```bash
pip install moss python-dotenv
```
```python
from moss import MossClient, QueryOptions
class MossSemanticRetrievalAgent(Agent):
    def __init__(self, moss_client): super().__init__(instructions="..."); self.moss = moss_client
    async def on_user_turn_completed(self, turn_ctx, new_message):
        results = await self.moss.query(INDEX_NAME, new_message.text_content, QueryOptions(top_k=5, alpha=0.8))
        if results.docs:
            ctx = "\n".join(f"- {d.text}" for d in results.docs)
            turn_ctx.add_message(role="system", content=f"Relevant context:\n{ctx}\nUse this to answer.")
        await super().on_user_turn_completed(turn_ctx, new_message)

async def entrypoint(ctx):
    await ctx.connect()
    moss = MossClient(MOSS_PROJECT_ID, MOSS_PROJECT_KEY); await moss.load_index(INDEX_NAME)  # pre-load!
    session = AgentSession(stt=deepgram.STT(), llm=openai.LLM(model="gpt-4o"), tts=openai.TTS(),
                           turn_detection=EnglishModel(), vad=silero.VAD.load())
    await session.start(agent=MossSemanticRetrievalAgent(moss), room=ctx.room)
```
There's also a managed **Moss Voice Agents** stack (`moss-voice-agent-manager`) built on LiveKit — see §12.

### VAPI (Custom Knowledge Base webhook)
VAPI's Custom KB webhook fires on every user turn; Moss answers in <10 ms. Use `vapi-moss`.
```bash
pip install vapi-moss
```
```python
from vapi_moss import MossVapiSearch, verify_vapi_signature
search = MossVapiSearch(index_name="my-faq-index", top_k=5, alpha=0.8)
await search.load_index()
result = await search.search("How do I return an item?")
# result.documents -> [{"content":"...","similarity":0.92}, ...]; result.time_taken_ms -> 3
is_valid = verify_vapi_signature(raw_body=request_bytes, signature_header=headers["x-vapi-signature"], secret="...")
```
Dashboard: Agent → Knowledge Base → **Custom Knowledge Base** → set webhook URL → add webhook secret.

### ElevenLabs (Conversational AI — client tool)
`elevenlabs-moss` registers a `search_knowledge_base` client tool.
```bash
pip install elevenlabs-moss
```
```python
from elevenlabs_moss import MossClientTool
moss_tool = MossClientTool(index_name="support-docs", tool_name="search_knowledge_base", top_k=3)
await moss_tool.load_index()
client_tools = ClientTools(); moss_tool.register(client_tools)
conversation = Conversation(client=ElevenLabs(api_key="..."), agent_id="...",
                            audio_interface=DefaultAudioInterface(), client_tools=client_tools)
conversation.start_session()
```
Dashboard: add a **Client** tool named `search_knowledge_base` (case-sensitive) with a required `string` param `query`; enable **Wait for response**.

### Agora (Conversational AI — MCP over streamable HTTP)
`agora-moss` exposes Moss as one MCP tool (`search_knowledge_base`); index pre-loaded in server lifespan.
```bash
pip install agora-moss
```
```python
from agora_moss import MossAgoraSearch, create_mcp_app
search = MossAgoraSearch(project_id=..., project_key=..., index_name=..., top_k=5, alpha=0.8)
app = create_mcp_app(search).streamable_http_app()    # uvicorn.run(app, host="0.0.0.0", port=8080)
```
Wire into Agora ConvoAI `/join` body: add `llm.mcp_servers` entry (`transport: "streamable_http"`, `allowed_tools: ["search_knowledge_base"]`) and `advanced_features.enable_tools: true`. **Server `name` must be ≤48 chars, alphanumeric only.** Expose `/mcp` publicly (ngrok/cloudflared for local dev).

### Pipecat (pipeline processor — context injection)
`pipecat-moss` adds `MossRetrievalService` as a **processor between user input and LLM**, injecting context before the LLM (no slow tool-calling).
```bash
pip install pipecat-moss
```
```python
from pipecat_moss import MossRetrievalService
moss_service = MossRetrievalService(project_id=..., project_key=...,
                                    system_prompt="Relevant passages from the Moss knowledge base:\n\n")
await moss_service.load_index(os.getenv("MOSS_INDEX_NAME"))
pipeline = Pipeline([
    transport.input(), rtvi, stt, context_aggregator.user(),
    moss_service.query(os.getenv("MOSS_INDEX_NAME"), top_k=5),   # <-- Moss injection
    llm, tts, transport.output(), context_aggregator.assistant(),
])
```
Processor params: `index_name`, `top_k` (5), `alpha` (0.8; recommended for voice). (Pairs naturally with Deepgram STT + Cartesia TTS + OpenAI LLM.)

### DSPy (retrieval module / ReAct tool)
```bash
pip install moss dspy nest-asyncio python-dotenv
```
```python
from moss import MossClient
from moss_dspy import MossRM
import dspy
client = MossClient("id","key")
dspy.configure(rm=MossRM(index_name="idx", moss_client=client, k=3, alpha=0.5))
results = dspy.Retrieve(k=3)("What is the return policy?")    # results.passages
# or as a ReAct tool: dspy.ReAct(signature="question -> answer", tools=[moss_search], max_iters=5)
```

### LangChain (retriever / agent tool)
```bash
pip install moss langchain langchain-openai python-dotenv
```
```python
from moss_langchain import MossRetriever, get_moss_tool
retriever = MossRetriever(project_id="...", project_key="...", index_name="...", top_k=3, alpha=0.5)
docs = await retriever.ainvoke("What is the return policy?")   # doc.page_content, doc.metadata["score"]
tool = get_moss_tool(retriever)                                # tool.name == "moss_search"
```

### Vercel AI SDK (typed tools for `generateText`/`streamText`)
```bash
npm install @moss-tools/vercel-sdk @moss-dev/moss ai zod
```
```ts
import { mossSearchTool, mossAddDocsTool, mossCreateIndexTool, mossListIndexesTool } from "@moss-tools/vercel-sdk";
const tools = {
  search: mossSearchTool({ client, indexName: "docs" }),       // prebind index -> simpler schema
  addDocs: mossAddDocsTool({ client, indexName: "docs" }),     // mutating tools have needsApproval: true
  createIndex: mossCreateIndexTool({ client }),
  listIndexes: mossListIndexesTool({ client }),
};
await generateText({ model: openai("gpt-4o"), tools, stopWhen: stepCountIs(5), prompt: "Search docs and summarize." })
```
Read-only: `mossSearchTool`, `mossListIndexesTool`. Mutating (require user approval): `mossAddDocsTool`, `mossDeleteDocsTool`, `mossCreateIndexTool`.

### Next.js (Server Actions — keep keys server-side)
```bash
npm install @moss-dev/moss     # .env.local: MOSS_PROJECT_ID / MOSS_PROJECT_KEY / MOSS_INDEX_NAME
```
```ts
"use server";
import { MossClient } from "@moss-dev/moss";
const client = new MossClient(process.env.MOSS_PROJECT_ID!, process.env.MOSS_PROJECT_KEY!);
const indexReady = client.loadIndex(process.env.MOSS_INDEX_NAME!);   // load once at module scope
export async function searchMoss(query: string) {
  await indexReady;
  const r = await client.query(process.env.MOSS_INDEX_NAME!, query, { topK: 5 });
  return r.docs.map(d => ({ id: d.id, text: d.text, score: d.score, metadata: d.metadata }));
}
```

### VitePress (zero-config docs search)
```bash
npm install vitepress-plugin-moss      # package.json needs "type": "module"
```
```ts
// docs/.vitepress/config.ts
import { mossIndexerPlugin } from 'vitepress-plugin-moss'
export default defineConfig({
  themeConfig: { search: { provider: 'moss' as any, options: {
    projectId: process.env.MOSS_PROJECT_ID!, projectKey: process.env.MOSS_PROJECT_KEY!, indexName: process.env.MOSS_INDEX_NAME!,
  } } },
  vite: { plugins: [mossIndexerPlugin()] },
})
```
Indexes content at build; **two-phase search** = cloud hot-path from first keystroke → local WASM (sub-10 ms) once downloaded. `Ctrl/Cmd+K` to open. `search: false` frontmatter excludes a page.

### MCP Server (any MCP client) — `@moss-tools/mcp-server`
Node 18+. Exposes tools: **Search** (`query`, `load_index`), **Index mgmt** (`create_index`, `list_indexes`, `get_index`, `delete_index`), **Docs** (`add_docs`, `get_docs`, `delete_docs`), **Jobs** (`get_job_status`). Env: `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY` (optional `MOSS_CLOUD_API_BASE_URL`, default `https://service.usemoss.dev`). Config shown in §8.

### Moss CLI — `moss-cli` (binary: `moss`)
```bash
pip install moss-cli
moss init                                  # interactive creds; profiles via --profile / ~/.moss/config.json
moss index create my-index -f docs.json --wait
moss query my-index "what is deep learning"            # downloads index, runs local
moss query my-index "neural nets" --top-k 20 --alpha 0.3
moss query my-index "transformers" --cloud             # skip download, hit cloud API
moss query my-index "shoes" --filter '{"field":"category","condition":{"$eq":"footwear"}}'  # local only
moss query my-index --interactive                      # REPL: /set alpha 0.5, /set top-k 10, /exit
moss doc add my-index -f new-docs.json --upsert --wait
moss job status <job-id> --wait
```
Doc files: JSON array `[{id,text,metadata}]` (or `{"documents":[...]}`), CSV (`id,text,metadata`), or stdin (`-f -`). Global flags: `--project-id/-p`, `--project-key`, `--profile`, `--json`, `--verbose/-v`.

---

## 11. Hackathon recipes — Moss as the retrieval hero for each track

> Sponsor map used below: **Unsiloed** = PDF parsing/ingest · **Moss** = retrieval · **LiveKit** = voice transport+agents · **MiniMax** = TTS/voice-clone/multimodal · **TrueFoundry** = LLM gateway/govern · **AWS** = hosting.

### Recipe 1 — Support voice bot that pulls docs + user history (Track 2) ⭐ flagship
**Why it wins:** demonstrates Moss's signature dual-index move (long-term knowledge + per-user session), all local, all sub-10 ms.
1. **Ingest:** Run your support PDFs/policy docs through **Unsiloed** (handles tables/scans cleanly) → push cleaned chunks into a Moss cloud index `support-kb` via `createIndex` (or, for simple PDFs, `createIndexFromFiles` directly — max 20 files). Load with `auto_refresh` so doc edits hot-swap live.
2. **Per-user memory:** On call start, `client.session(f"user-{userId}")` resumes that customer's history (or starts empty). Add each transcript turn with `add_docs`.
3. **Voice loop (LiveKit + Moss context injection):** each user turn → `query("support-kb", ...)` **and** `session.query(...)` → inject both into the LLM system message before generation. STT via Deepgram, TTS via **MiniMax** (or Cartesia), LLM routed through **TrueFoundry** gateway for governance/observability.
4. **Handoff:** `session.push_index()` so a human agent or a different channel can resume `user-{userId}` with full context (cross-agent handoff).
5. **Host** the agent + token backend on **AWS** (the Moss Voice Agent CLI deploys; or your own FastAPI).

### Recipe 2 — Lead-gen outbound/inbound agent (Track 1)
**Why it wins:** instant, accurate objection handling and pricing answers; metadata segmentation by plan/region.
1. Build a Moss index of product facts, pricing tiers, objection scripts, competitor comparisons. Tag each doc with `metadata` (`plan`, `industry`, `region`).
2. Voice via **LiveKit** or **VAPI** (`vapi-moss` Custom KB webhook). On each prospect question, query with a metadata filter: `{"$and":[{"field":"plan","condition":{"$eq":"startup"}},{"field":"region","condition":{"$eq":"us"}}]}`.
3. Tune `alpha` low (~0.3–0.5) for SKU/pricing exactness; high (~0.8) for "convince me" paraphrases.
4. **MiniMax voice clone** for an on-brand SDR voice; **TrueFoundry** to A/B LLMs and cap cost.

### Recipe 3 — Ambient co-pilot that listens and surfaces live context (Track 3)
**Why it wins:** real-time on-device session indexing + cross-agent handoff is exactly the "ambient agent" thesis.
1. Stream the meeting/call audio via **LiveKit**; STT each turn.
2. Open a Moss **session** (Python/Swift) and `add_docs` every transcript turn in real time (on-device, no network). Simultaneously `load_index` a long-term "company knowledge" index.
3. On a trigger phrase (or every N turns), `query_multi_index(["session","company-kb"], ...)` and surface cards/whispers to the user.
4. At session end, `push_index()` → the named index becomes the meeting memory; a follow-up agent or the next meeting resumes it.
5. For a desktop co-pilot, run Moss in the **Electron** main process; for mobile, the **Swift** on-device session.

### Recipe 4 — Private, in-browser knowledge widget (any track, "wow privacy" angle)
1. `@moss-dev/moss-web` in a background worker / page; `createIndexFromFiles` directly from a drag-drop `<input type=file>` (PDF → server parse → index).
2. Mint tokens via a tiny backend (custom authenticator) so `projectKey` never ships. Queries run **entirely in the browser on WASM** — great demo line: "your data never leaves the tab, and it's still sub-10 ms."

### Recipe 5 — Agent that manages its own knowledge (Vercel AI SDK / MCP)
Give the LLM Moss **tools** (`@moss-tools/vercel-sdk` or the MCP server). The agent searches, and — with approval — creates indexes and upserts new facts it learns mid-conversation (the capture–recall memory loop). Demo: the bot literally remembers what it was told earlier in the same call.

### Recipe 6 — Fastest path to a demo with zero glue code
Use the **Moss MCP server** in Cursor/Claude to scaffold the index from your docs, then drop **`pipecat-moss`** or the **LiveKit context-injection** agent in. You can have a grounded voice agent talking in well under an hour. Vibecode it with the starter prompt in §8.

---

## 12. Managed Voice Agents stack (deploy faster)

Three packages share `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`, `MOSS_VOICE_AGENT_ID`:

- **Agent SDK** `moss-voice-agent-manager` (Python 3.10+): build agents; auto-configures STT/LLM/TTS. `MossAgentSession`, `Agent`, `llm.function_tool`, multi-agent transfers (return another `Agent` from a tool), per-session TTS override (`TTSOptions(model="sonic-2", voice="...", language="en")`), `submit_session_report` for transcripts.
- **Backend SDK** (mint short-lived participant tokens — never hold LiveKit secrets in the frontend): `@moss-tools/voice-server` (Node) or `moss-voice-server` (Python; `MossVoiceServerSync` for Flask/Django). `createParticipantToken(...)` → signed 15-min-TTL JWT + WebSocket URL.
- **Agent CLI** `moss-agent-cli`: `moss-agent deploy`, `moss-agent env push` (push runtime env to the deployed agent — your local `.env` is excluded from the deploy package; pushing restarts the agent), `moss-agent logs [--log-type build]`, `moss-agent transcripts list|download`. Agent dir: `agent.py` + `requirements.txt` (must include `moss-voice-agent-manager`) + `.env`.

```python
session = MossAgentSession(userdata=None, ctx=ctx, max_tool_steps=10)
await session.start(agent=MyAgent(), room=ctx.room)
```

---

## 13. Pricing & limits

| Feature | Developer | Hobbyist | Startup | Enterprise | Pay-as-you-go |
| --- | --- | --- | --- | --- | --- |
| **Price** | Free – $5/mo credits | $30/mo | $200/mo | Custom | — |
| **Storage** | 500 MB | 2 GB | 10 GB | Custom | $1.50 / GB-month |
| **Ingest** | 50 MB/mo | 500 MB/mo | 5 GB/mo | Custom | $0.03 / MB |
| **Egress** | 10 GB/mo | 100 GB/mo | 500 GB/mo | Custom | $0.09 / GB |
| **Voice-minutes** | 60/mo | 250/mo | 1,500/mo | Commit ladder | $0.05 / min |
| **Projects** | 1 | Unlimited | Unlimited | Unlimited | — |
| **Indexes** | 3 | Unlimited | Unlimited | Unlimited | — |
| **Local queries** | Unlimited | Unlimited | Unlimited | Unlimited | **Never metered** |
| **Sessions** | — | — | — | ✅ | — |
| **Std / BYO embeddings** | ✅ | ✅ | ✅ | ✅ | — |
| **HQ/HP models, SOC2, HIPAA, VPC** | — | — | — | ✅ | — |
| **Support** | Discord | Discord | Email | Shared Slack | — |

**Local queries are never metered** — the in-process model is free at the hot path; you pay for storage/ingest/egress/voice-minutes. The Free **Developer** tier (1 project, 3 indexes, 500 MB) is enough for a hackathon. (Per-turn / per-async-conversation pricing and VPC/on-prem available on request.)

---

## 14. Gotchas, latency notes, and what to demo

### Gotchas (the ones that will bite you at 2am)
- **`query` before `loadIndex`** → silent cloud fallback (~100–500 ms) in JS/Python; **throws** in browser/C/Elixir/Swift. Always load once at startup. For voice, **pre-load in the agent entrypoint**, not per turn.
- **Metadata is string→string.** Write numeric filters as strings (`"100"`, not `100`). Filters only apply on a **locally loaded** index — on a non-loaded index the filter is silently skipped (warning logged).
- **Mutations are async.** `createIndex`/`addDocs`/`deleteDocs` return after the server build *completes* (SDK polls). For huge corpora this takes seconds — show progress via `onProgress` / `get_job_status`. Index `status` must be `Ready` before queries return data.
- **Node has no sessions yet.** Need live transcript indexing/handoff? Use **Python or Swift** for the agent, even if your web app is Node. (Node can still use cloud indexes + `loadIndex`.)
- **One model per index.** All participants resuming a named session/index must use the same `model_id`; a mismatch raises. `custom` model = you must supply embeddings on every doc AND every query.
- **`createIndexFromFiles`:** PDF only today, **≤20 files/call**, no `custom` model. Complex PDFs → parse with Unsiloed first.
- **Don't ship `projectKey` to the browser/mobile.** Use the custom authenticator + a backend token endpoint. (JS auth header includes `Bearer `; Swift returns the raw token — don't copy the JS convention.)
- **Re-pull to get changes** unless you set `auto_refresh` (or, on Swift, enable auto-sync). `loadIndex` is a one-time hydration by default.
- **`createIndex` throws if the index already exists.** Use `addDocs(..., upsert: true)` to update, or delete first.

### Latency / sizing notes
- **Loaded local query: ~1–10 ms.** Cloud fallback: ~100–500 ms. Management ops got ~3× faster (beta.9). 100K vectors went from ~2,300 ms → ~10 ms (beta.14).
- **Memory:** ~1M × 256-dim vectors ≈ **500 MB**. Budget RAM for big indexes; use Swift `onMemoryPressure` on mobile.
- **Chunking for recall:** ~200–500 tokens/chunk (Swift guidance: 100–250 tokens), 10–20% overlap, normalize whitespace, strip boilerplate. Long docs dilute the embedding signal.
- **Voice budget:** prefer **context injection** over tool-calling (skips the LLM's "should I search?" hop). Pre-load indexes. Keep `alpha ≈ 0.8` for natural-language voice queries.

### What to demo (the wow moments)
1. **Speak a question, get a grounded answer with no pause.** Put `results.timeTakenInMs` on screen — a sub-10 ms number next to a fluid voice reply sells the whole thesis.
2. **Edit a doc mid-demo, watch the agent update live** (auto-refresh hot-swap, no restart, no dropped queries).
3. **Hand the conversation from voice → web → human** by resuming the same named session — full history intact (cross-agent handoff).
4. **Drag-drop a PDF into the browser and search it on WASM** — "data never left the tab," still instant.
5. **Dual-index recall:** the agent answers from the manual *and* remembers what the caller said two turns ago (long-term + session in one turn).

---

## 15. Error reference (quick triage)

| Error | Cause | Fix |
| --- | --- | --- |
| `Unauthorized` (403) | Missing/invalid creds | Set `MOSS_PROJECT_ID` / `MOSS_PROJECT_KEY` |
| `Index not found` | Querying/loading a non-existent index | `createIndex()` first; names are **case-sensitive** |
| `Index not loaded` | `query()` before `loadIndex()` | `loadIndex(name)` (or open a session) first |
| `Index already exists` | `createIndex()` on existing name | `addDocs(upsert: true)` or delete first |
| `Missing embeddings runtime` | Bad `modelId` | Use `moss-minilm` / `moss-mediumlm` / `custom` |
| `Embedding required` | `custom` without `embedding` | Supply `embedding` on every doc and every query |
| `custom model not supported` | `createIndexFromFiles` with `custom` | Use `moss-minilm`/`moss-mediumlm` |
| `Job failed` | Async mutation error | Inspect `JobStatusResponse.error` via `getJobStatus(jobId)`; a stuck `downloading` phase usually = network |

Irrelevant results? Lower `alpha` (more keyword), re-chunk (200–500 tokens), or switch to `moss-mediumlm`. Community help: **Moss Discord** `https://discord.gg/eMXExuafBR`.

---

## 16. 2 a.m. cheat-sheet — the 10 things you'll copy-paste

```bash
# 1. Install + auth
npm install @moss-dev/moss        # or: pip install moss
export MOSS_PROJECT_ID=...  MOSS_PROJECT_KEY=...   # from portal.usemoss.dev
```
```ts
// 2. Core loop (JS) — create, LOAD (once), query
const c = new MossClient(process.env.MOSS_PROJECT_ID!, process.env.MOSS_PROJECT_KEY!)
await c.createIndex('faqs', [{ id:'1', text:'30-day returns.', metadata:{ category:'returns' } }], { modelId:'moss-minilm' })
await c.loadIndex('faqs')                          // ALWAYS load before query
const r = await c.query('faqs', 'return policy', { topK: 5, alpha: 0.8 })
```
```python
# 3. Core loop (Python) — same flow
client = MossClient(os.getenv("MOSS_PROJECT_ID"), os.getenv("MOSS_PROJECT_KEY"))
await client.create_index("faqs", docs, "moss-minilm"); await client.load_index("faqs")
res = await client.query("faqs", "return policy", QueryOptions(top_k=5, alpha=0.8))
```
```python
# 4. Hybrid dial:  alpha 0.0 = keyword | 1.0 = semantic | 0.8 = default
QueryOptions(top_k=5, alpha=0.6)
```
```python
# 5. Metadata filter (LOCAL loaded index only; numbers as STRINGS)
QueryOptions(top_k=5, filter={"$and":[
  {"field":"category","condition":{"$eq":"shoes"}},
  {"field":"price","condition":{"$lt":"100"}}]})
```
```python
# 6. Session = real-time local memory (Python/Swift/C/Elixir; NOT Node yet)
s = await client.session(index_name="call-123")    # create-or-resume by name
await s.add_docs([DocumentInfo(id="t1", text="...")])   # embeds locally, no network
hits = await s.query("...", QueryOptions(top_k=3)); await s.push_index()   # handoff/persist
```
```python
# 7. Live-call dual query (long-term + short-term, both local)
await client.load_index("support-kb")
know = await client.query("support-kb", q, QueryOptions(top_k=3))
recent = await s.query(q, QueryOptions(top_k=3))    # pass BOTH to the LLM
```
```python
# 8. Auto-refresh hot-swap (instant updates, no restart)
await client.load_index("kb", auto_refresh=True, polling_interval_in_seconds=120)
```
```python
# 9. PDF ingest (server parses+chunks+embeds; PDF only, <=20 files, no custom model)
await client.create_index_from_files("kb",
  [ParseFileInput(name="manual.pdf", content_type="application/pdf", path="/docs/manual.pdf")])
```
```python
# 10. LiveKit context-injection (the lowest-latency voice pattern)
async def on_user_turn_completed(self, turn_ctx, msg):
    r = await self.moss.query(INDEX, msg.text_content, QueryOptions(top_k=5, alpha=0.8))
    if r.docs:
        turn_ctx.add_message(role="system", content="Context:\n" + "\n".join(f"- {d.text}" for d in r.docs))
    await super().on_user_turn_completed(turn_ctx, msg)
```

**Drop-in voice adapters:** `pip install vapi-moss | elevenlabs-moss | agora-moss | pipecat-moss` · **MCP:** `npx @moss-tools/mcp-server` · **CLI:** `pip install moss-cli; moss init` · **Portal:** portal.usemoss.dev · **Samples:** github.com/usemoss/moss-samples · **HTTP API details:** see `MOSS-API-REFERENCE.md`.

---

## Appendix — Coverage Completion (audit-driven, added 2026-06-05)

> Patches the one MEDIUM-importance in-scope gap the coverage audit found. (Source: `docs/pricing` / `raw/moss-llms-full.txt` line 4393.) The remaining audited gaps — `RefreshResult`, `JobProgress`, full changelog enumeration, Elixir/Swift `Types` pages — were all rated LOW importance and don't affect the core build path, so they're intentionally not added here.

### Pricing — "Sync Engine" tier row (MEDIUM)

The pricing table in §13 (and API-REF §9) was missing the **Sync Engine** row. The complete row from the official pricing page is:

| Feature | Developer | Hobbyist | Startup | Enterprise | Pay-as-you-go |
| --- | --- | --- | --- | --- | --- |
| **Sync Engine** | – | Standard | Standard | Dedicated | – |

So the §13 table now reads, in order: …Indexes → Local queries → **Sync Engine** (–, Standard, Standard, Dedicated, –) → Sessions → Std/BYO embeddings → HQ/HP models/SOC2/HIPAA/VPC → Support.

**What "Sync Engine" is:** the cloud→device hydration + auto-refresh hot-swap machinery documented in §5 (background polling, atomic version swap, `push_index`). On **Hobbyist/Startup** it runs as **Standard** (shared) infrastructure; **Enterprise** gets a **Dedicated** sync engine; the free **Developer** tier has **no** sync engine entitlement (–).

**Why it matters for the hackathon:** if your demo leans on the live-update "edit a doc, watch the agent answer correctly with no restart" moment (§14 wow-demo #2, the auto-refresh hot-swap), that's the **Sync Engine**. The free Developer tier shows `–` for it — so confirm your account tier early, or fall back to a manual `loadIndex()` re-pull to force the refresh instead of relying on background auto-refresh during the demo.
