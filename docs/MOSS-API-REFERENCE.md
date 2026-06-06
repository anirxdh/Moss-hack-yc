# Moss — Developer API Reference (HTTP + SDK)

> Source of truth for this doc: `raw/moss-llms.txt` (index) and `raw/moss-llms-full.txt` (full docs export from `https://docs.moss.dev`). Everything below is taken verbatim from those files. This is written for a 21-hour voice-AI hackathon — every endpoint, header, field, default, curl, and SDK method you'll actually need is here.

---

## What is Moss in one paragraph

Moss is a high-performance runtime for **real-time semantic search**. It delivers **sub-10 ms lookups**, instant index updates, and zero infra overhead. Moss runs *where your agent lives* — cloud, in-browser, or on-device — so search feels native and users never wait. The mental model: you connect your data once, Moss packages and distributes the index, and **retrieval becomes a function you call, not a service you query**. Indexes live in the cloud (canonical copy), but the SDK pulls them into memory with `loadIndex()`/`load_index()` so queries run locally (~1–10 ms) instead of over the network (~100–500 ms). There are two control surfaces: a single HTTP **Control Plane** endpoint (`POST /v1/manage`) for index/document lifecycle, and language SDKs (JS, Python, Swift, Elixir, C, browser/WASM) that wrap that plane plus add the local query engine, real-time **sessions**, and hybrid/metadata search.

## Why it matters for a voice-AI hackathon / which track it serves

Voice models are now cheap and fast; the bottleneck is **retrieval latency**. A 300 ms network RAG lookup is audible dead air in a voice call; Moss's in-memory `query()` (~1–10 ms) is not. Moss is the retrieval layer for all three tracks:

- **Support track** — load a cloud FAQ/policy/docs index once at call start; query it on every user turn to ground a CS bot in docs + user history (Moss's `live-call-context` and LiveKit `on_user_turn_completed` context-injection pattern are purpose-built for exactly this).
- **Co-Pilot / ambient track** — `Session`s index transcript turns *locally in real time* (no cloud round trip), so an ambient agent can recall "what was just said 90 seconds ago" instantly while also querying long-term knowledge.
- **Lead Gen track** — multi-index search across a product catalog + CRM notes + objection-handling playbook, all loaded in memory, tagged by source index, returned as a single global top-K.

Moss ships first-class integrations for **LiveKit, ElevenLabs, VAPI, Agora, Pipecat** (all voice transports at this hackathon) and an MCP server for vibecoding.

## Quickstart "hello world"

```bash
npm install @moss-dev/moss        # JS / TS
pip install moss                  # Python
export MOSS_PROJECT_ID="your_project_id"
export MOSS_PROJECT_KEY="your_project_key"
```

```ts
import { MossClient, DocumentInfo } from '@moss-dev/moss'
const client = new MossClient(process.env.MOSS_PROJECT_ID!, process.env.MOSS_PROJECT_KEY!)
const documents: DocumentInfo[] = [
  { id: 'doc1', text: 'How do I track my order? Log into your account.', metadata: { category: 'shipping' } },
  { id: 'doc2', text: 'What is your return policy? 30-day return policy for most items.', metadata: { category: 'returns' } },
]
await client.createIndex('faqs', documents, { modelId: 'moss-minilm' }) // creates + builds + polls until ready
await client.loadIndex('faqs')                                          // pull into memory for fast local queries
const results = await client.query('faqs', 'How do I return a damaged product?', { topK: 3 })
console.log(results.docs[0])  // { id: 'doc2', score: 0.88, text: '...' }
```

The three-call core flow is always: **`createIndex` → `loadIndex` → `query`**.

---

# 1. Authentication & Key Model

## HTTP Control Plane auth

All mutating **and** read operations are routed through a single endpoint, `POST /v1/manage`, and require **both** a header credential and a body field:

| Requirement | Where | Value |
| --- | --- | --- |
| `x-project-key` | HTTP header | Your project access key (e.g. `moss_access_key_xxxxx`) |
| `x-service-version` | HTTP header | `v1` |
| `Content-Type` | HTTP header | `application/json` |
| `projectId` | JSON body field | Project identifier issued by Moss Control (e.g. `project_123`) |

The service verifies credentials **before** running the requested action. Invalid credentials return **`403 Forbidden`** with a JSON error payload.

```bash
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" \
  -H "x-service-version: v1" \
  -H "x-project-key: moss_access_key_xxxxx" \
  -d '{
    "action": "listIndexes",
    "projectId": "project_123"
  }'
```

> Note the **two distinct identifiers**: `projectId` (goes in the JSON body) and the `x-project-key` header (the secret). Both are required on every call. You get both from the [Moss Portal](https://portal.usemoss.dev) → project settings.

## SDK auth (server-side)

Export credentials and pass them to the client constructor:

```bash
export MOSS_PROJECT_ID=your_project_id
export MOSS_PROJECT_KEY=your_project_key
```

```ts
import { MossClient } from '@moss-dev/moss'
const client = new MossClient(process.env.MOSS_PROJECT_ID!, process.env.MOSS_PROJECT_KEY!)
```

```python
import os
from moss import MossClient
client = MossClient(os.getenv('MOSS_PROJECT_ID'), os.getenv('MOSS_PROJECT_KEY'))
```

For **sessions**, project credentials are validated when the session is opened (`client.session(...)` raises if invalid). For long-lived sessions, tokens are cached and auto-refreshed so you stay authenticated without re-supplying credentials.

## SDK auth (browser / untrusted clients — never ship `projectKey`)

The `projectKey` must **never** appear in browser-facing code. Use a **custom authenticator**: your backend holds the key, mints a short-lived token, and the frontend sends a bearer token.

The SDK exports `IAuthenticator` and `AuthToken`:

```ts
// Exported from '@moss-dev/moss' - shown here for reference
interface AuthToken {
  token: string;      // Bearer token to send with each request
  expiresIn: number;  // Token lifetime in seconds, as returned by your backend
}

interface IAuthenticator {
  getAuthToken(): Promise<AuthToken>;
  getAuthHeader(): Promise<string>; // returns "Bearer <token>"
}
```

**Backend token endpoint** (holds the key securely):

```ts
import express from 'express';
import { MossClient } from '@moss-dev/moss';

const app = express();
const moss = new MossClient('your-project-id', 'your-project-key');

app.get('/api/moss-token', yourAuthMiddleware, async (req, res) => {
  try {
    res.json(await moss.getAuthToken()); // { token, expiresIn } -> forward directly
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve token' });
  }
});
```

**Frontend authenticator**:

```ts
import { MossClient } from '@moss-dev/moss';
import type { IAuthenticator, AuthToken } from '@moss-dev/moss';

class MyBackendAuthenticator implements IAuthenticator {
  async getAuthToken(): Promise<AuthToken> {
    const response = await fetch('/api/moss-token', { credentials: 'include' });
    if (!response.ok) throw new Error(`Failed to fetch Moss token: HTTP ${response.status}`);
    return response.json(); // shape matches AuthToken: { token, expiresIn }
  }
  async getAuthHeader(): Promise<string> {
    const { token } = await this.getAuthToken();
    return `Bearer ${token}`;
  }
}

const client = new MossClient('your-project-id', new MyBackendAuthenticator());
```

The SDK auto-caches tokens for `expiresIn - 60` seconds, so your backend is only called when the token is about to expire.

| Use case | How to initialize |
| --- | --- |
| Server-side (Node.js) | `new MossClient(projectId, projectKey)` |
| Frontend — custom auth | `new MossClient(projectId, new MyBackendAuthenticator())` |

## SDK error: auth

`Unauthorized` → cause: missing or invalid credentials → fix: set `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY`.

---

# 2. Core Concepts

| Concept | What it is |
| --- | --- |
| **Project** | Top-level account scope, identified by `projectId` + authenticated by `projectKey`. Holds many indexes. |
| **Index** | A named, searchable corpus. Identified by `indexName` (case-sensitive, unique within a project). Has a status, embedding model, version, and `docCount`. Lives in the cloud as canonical copy. |
| **Document** | `{ id, text, metadata?, embedding? }`. `text` is the canonical string embedded/searched; `metadata` is `Record<string,string>` (values stored/compared **as strings**). `embedding` is optional caller-provided vector. |
| **Embedding model** | `moss-minilm` (default, fast, 384-dim, edge/offline), `moss-mediumlm` (higher accuracy), `moss-litelm` (on-device default on iOS), `custom` (you bring vectors). Pick per index. |
| **Loading** | `loadIndex()`/`load_index()` downloads the cloud index into memory. **Required before `query()`.** Without it queries fall back to the cloud `/query` endpoint (~100–500 ms); with it, queries run in-memory (~1–10 ms). |
| **Session** | A *local-first*, real-time index you read/write in-memory with **no cloud round trip on any operation**. Used to index transcript turns mid-call. Create/resume → mutate → query → optionally `push_index()` to cloud. |
| **Job** | Mutations (`createIndex`, `addDocs`, `deleteDocs`, `startBuild`, file parse) are **async**. They return a `jobId`; you poll `getJobStatus`. SDKs poll internally and resolve when done. |
| **Hybrid search (`alpha`)** | One knob blends semantic (vector) and keyword (BM25). `1.0` = pure semantic, `0.0` = pure keyword, default `0.8` (semantic-heavy). |
| **Short vs long-term context** | Session = short-term (current interaction, built turn-by-turn). Loaded cloud index = long-term (durable knowledge across interactions). Most real-time apps query both per turn. |

### Index lifecycle

```
Create index (with docs + model)  →  Load index  →  Query (topK, alpha, filter)
                                          ↑                    ↓
                                    addDocs / deleteDocs  →  (rebuild, async)  →  Delete index when done
```

### Status & job enums

- **Index status** (`IndexInfo.status`): `"NotStarted"` | `"Building"` | `"Ready"` | `"Failed"`
- **Job status** (`JobStatus`): `"pending_upload"` | `"uploading"` | `"building"` | `"completed"` | `"failed"`
- **Job phase** (`JobPhase`): `"downloading"` | `"deserializing"` | `"generating_embeddings"` | `"building_index"` | `"uploading"` | `"cleanup"`
- **Embedding models** (`MossModel`): `"moss-minilm"` | `"moss-mediumlm"` | `"custom"`

---

# 3. HTTP Control Plane API

### Base URL

```text
https://service.usemoss.dev/v1
```

All actions are multiplexed through `POST https://service.usemoss.dev/v1/manage`. You provide an `action` string plus the fields that action requires.

### Shared request schema

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action` | string | ✅ | One of `initUpload`, `startBuild`, `getJobStatus`, `getIndex`, `listIndexes`, `deleteIndex`, `addDocs`, `deleteDocs`, `getDocs`, `getIndexUrl`. |
| `projectId` | string | ✅ | Project identifier issued by Moss Control. |
| `indexName` | string | ▶︎ (conditional) | Required for index-scoped actions. |

**Required headers on every request:** `x-project-key: <your key>`, `x-service-version: v1`, `Content-Type: application/json`.

### Supported actions at a glance

| Action | Purpose | Extra required fields |
| --- | --- | --- |
| `initUpload` | Get a presigned URL to upload index data. | `indexName`, `modelId`, `docCount`, `dimension` |
| `startBuild` | Trigger an index build after uploading data. | `jobId` |
| `getJobStatus` | Check the status of an async build job. | `jobId` |
| `getIndex` | Fetch metadata for a single index. | `indexName` |
| `listIndexes` | Enumerate every index under the project. | None |
| `deleteIndex` | Remove an index record and assets. | `indexName` |
| `getIndexUrl` | Get download URLs for a built index. | `indexName` |
| `addDocs` | Upsert documents into an existing index. | `indexName`, `docs` |
| `deleteDocs` | Remove documents by ID. | `indexName`, `docIds` |
| `getDocs` | Retrieve stored documents (without embeddings). | `indexName` |

### Generic error envelope

Failures return structured JSON:

```json
{
  "error": "Human-readable message",
  "action": "addDocs"
}
```

`action` is present on server errors. Successful handlers return `2xx` JSON payloads (documented per-action below).

---

## 3a. Index operations

### `initUpload` — get presigned upload URL for a new index

Initialize an upload session for a new index. Returns a presigned URL to `PUT` your pre-computed index data, plus a `jobId` for `startBuild`.

**Required:** `indexName`, `modelId`, `docCount`, `dimension`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `indexName` | string | ✅ | Name for the new index. |
| `modelId` | string | ✅ | Embedding model id (e.g. `moss-minilm`). |
| `docCount` | integer | ✅ | Total number of documents being uploaded. |
| `dimension` | integer | ✅ | Embedding vector dimension (e.g. `384` for `moss-minilm`). |

```bash
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" \
  -H "x-service-version: v1" \
  -H "x-project-key: moss_access_key_xxxxx" \
  -d '{
    "action": "initUpload",
    "projectId": "project_123",
    "indexName": "support-faq",
    "modelId": "moss-minilm",
    "docCount": 2,
    "dimension": 384
  }'
```

**200 — OK**

```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "uploadUrl": "https://<bucket>.r2.cloudflarestorage.com/temp-uploads/<project_id>/<job_id>/data.bin?<signed_params>",
  "expiresIn": 3600
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `jobId` | string | Use with `startBuild` after uploading. |
| `uploadUrl` | string | Presigned URL to `PUT` your index data. Expires after `expiresIn` seconds. |
| `expiresIn` | integer | Seconds until the upload URL expires (default `3600`). |

**Errors:** `400` when `docCount` or `dimension` is missing/invalid; `404` if the project does not exist.

---

### `startBuild` — trigger build after upload

After uploading index data to the presigned URL, call `startBuild`. The build runs asynchronously — poll `getJobStatus`.

**Required:** `jobId` (the id returned by `initUpload`)

```bash
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" \
  -H "x-service-version: v1" \
  -H "x-project-key: moss_access_key_xxxxx" \
  -d '{
    "action": "startBuild",
    "projectId": "project_123",
    "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

**200 — OK**

```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "building"
}
```

**Errors:** `400` when `jobId` is missing; `404` if the upload data is not found (upload may not have completed).

---

### `getIndex` — fetch metadata for one index

**Required:** `indexName`

```bash
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" \
  -H "x-service-version: v1" \
  -H "x-project-key: moss_access_key_xxxxx" \
  -d '{
    "action": "getIndex",
    "projectId": "project_123",
    "indexName": "support-faq"
  }'
```

**200 — OK**

```json
{
  "id": "a98fe5f5-1c00-4d5c-b2a5-6c1ef8d157cc",
  "name": "support-faq",
  "model": { "id": "moss-minilm", "version": "service-v1.0.0" },
  "status": "Ready",
  "version": "service-v1.0.0",
  "docCount": 124,
  "createdAt": "2025-01-09T21:14:07.000+00:00",
  "updatedAt": "2025-01-10T03:52:11.000+00:00"
}
```

**Errors:** `404` if the index is unknown.

---

### `listIndexes` — list all indexes in the project

**Required:** none (beyond `action` + `projectId`)

```bash
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" \
  -H "x-service-version: v1" \
  -H "x-project-key: moss_access_key_xxxxx" \
  -d '{
    "action": "listIndexes",
    "projectId": "project_123"
  }'
```

**200 — OK** (array of index records)

```json
[
  {
    "id": "a98fe5f5-1c00-4d5c-b2a5-6c1ef8d157cc",
    "name": "support-faq",
    "model": { "id": "moss-minilm", "version": "service-v1.0.0" },
    "status": "Ready",
    "version": "service-v1.0.0",
    "docCount": 124,
    "createdAt": "2025-01-09T21:14:07.000+00:00",
    "updatedAt": "2025-01-10T03:52:11.000+00:00"
  }
]
```

---

### `deleteIndex` — delete an index and its assets

**Required:** `indexName`

```bash
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" \
  -H "x-service-version: v1" \
  -H "x-project-key: moss_access_key_xxxxx" \
  -d '{
    "action": "deleteIndex",
    "projectId": "project_123",
    "indexName": "support-faq"
  }'
```

**200 — OK** (returns the literal boolean)

```json
true
```

**Errors:** `404` if the index is missing.

---

### `getIndexUrl` — get download URLs for a built index

Listed in the action table (purpose: "Get download URLs for a built index", required field: `indexName`). No dedicated request/response example is given in the docs; it is the action the SDKs use under the hood when `loadIndex()` fetches index assets from the cloud.

---

## 3b. Document operations

### `addDocs` — append/upsert documents (async)

Append or upsert documents into an existing index. **Async** — the response includes a `jobId` you poll with `getJobStatus`. The service merges new docs, rebuilds the index efficiently, and makes fresh artifacts available.

**Required:** `indexName`, `docs`
**Optional:** `options.upsert` (defaults to `true`)

```bash
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" \
  -H "x-service-version: v1" \
  -H "x-project-key: moss_access_key_xxxxx" \
  -d '{
    "action": "addDocs",
    "projectId": "project_123",
    "indexName": "support-faq",
    "docs": [
      { "id": "faq-125", "text": "How do I change billing cycles?" }
    ],
    "options": {
      "upsert": true
    }
  }'
```

**200 — OK**

```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "building"
}
```

**Errors:** `404` if the index cannot be located; `500` when existing documents cannot be downloaded or the update fails.

---

### `deleteDocs` — remove documents by ID (async)

Remove specific documents by ID and rebuild the index. **Async** — returns a `jobId`.

**Required:** `indexName`, `docIds` (non-empty array)

```bash
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" \
  -H "x-service-version: v1" \
  -H "x-project-key: moss_access_key_xxxxx" \
  -d '{
    "action": "deleteDocs",
    "projectId": "project_123",
    "indexName": "support-faq",
    "docIds": ["faq-001", "faq-042", "faq-099"]
  }'
```

**200 — OK**

```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "building"
}
```

---

### `getDocs` — retrieve stored documents (no embeddings)

**Required:** `indexName`
**Optional:** `options.docIds` to return a subset.

```bash
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" \
  -H "x-service-version: v1" \
  -H "x-project-key: moss_access_key_xxxxx" \
  -d '{
    "action": "getDocs",
    "projectId": "project_123",
    "indexName": "support-faq"
  }'
```

**200 — OK** (array of documents)

```json
[
  {
    "id": "faq-1",
    "text": "Reset password: Click 'Forgot Password' on the sign-in page to receive a reset link via email.",
    "metadata": { "category": "account", "topic": "password" }
  },
  {
    "id": "faq-2",
    "text": "Enable two-factor authentication: Go to Account Settings > Security and toggle on 2FA.",
    "metadata": { "category": "account", "topic": "2fa" }
  }
]
```

---

# 4. Search / Query

> **Important:** the HTTP Control Plane (`/v1/manage`) covers index/document *lifecycle*. **Querying is done through the SDK** (or the cloud `/query` endpoint the SDK falls back to). The SDK `query()` runs in-memory **only after `loadIndex()`**; otherwise it falls back to the cloud `/query` endpoint. Metadata filtering and hybrid `alpha` are evaluated on the **locally loaded** index, so you must load (or open a session) before filtering.

## The query request shape

A query is `(indexName, queryText, options)`. The options object:

**JS `QueryOptions`:**

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `embedding?` | `number[]` | — | Caller-provided embedding vector. When supplied, embedding generation is skipped. |
| `topK?` | `number` | method default `5` | Number of top results to return. |
| `alpha?` | `number` | `0.8` | Hybrid fusion weight. `1.0` = pure semantic, `0.0` = pure keyword. |
| `filter?` | `MetadataFilter` | — | Metadata filter; supports field conditions and `$and`/`$or`. Evaluated on the loaded index. |

**Python `QueryOptions`:**

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `embedding` | `Optional[Sequence[float]]` | — | Caller-provided query embedding. |
| `top_k` | `Optional[int]` | — | Number of top results. |
| `alpha` | `Optional[float]` | `0.8` | Hybrid fusion weight. |
| `filter` | `Optional[dict]` | — | Metadata filter (loaded indexes only). |

## Response shape (`SearchResult`)

```
SearchResult {
  docs: QueryResultDocumentInfo[]   // ordered by similarity score (descending)
  query: string                     // the original query text
  indexName? / index_name?: string  // index that was searched
  timeTakenInMs? / time_taken_ms?: number
}

QueryResultDocumentInfo {
  id: string
  text: string
  metadata?: Record<string,string>
  embedding?: number[]
  score: number                     // similarity 0-1, higher = more similar
  index_name?: string               // set by query_multi_index; null/absent for single-index
}
```

## Basic query

```ts
await client.loadIndex('my-index')
const results = await client.query('my-index', 'getting started latency', { topK: 5 })
results.docs.forEach(doc => console.log(`${doc.id}: ${doc.text} (score: ${doc.score})`))
```

```python
await client.load_index("my-index")
results = await client.query("my-index", "getting started latency", QueryOptions(top_k=5))
```

## Hybrid search (`alpha`)

| `alpha` | Behavior |
| --- | --- |
| `1.0` | Pure semantic (embeddings only) |
| `0.0` | Pure keyword (BM25 only) |
| between | Blend; default is semantic-heavy at `0.8` |

```ts
await client.query('faqs', 'return policy', { topK: 3, alpha: 0.0 }) // Pure keyword
await client.query('faqs', 'return policy', { topK: 3 })              // Default (semantic heavy)
await client.query('faqs', 'return policy', { topK: 3, alpha: 1.0 }) // Pure semantic
```

```python
await client.query("faqs", "return policy", QueryOptions(top_k=3, alpha=0.0))  # Pure keyword
await client.query("faqs", "return policy", QueryOptions(top_k=3))             # Default
await client.query("faqs", "return policy", QueryOptions(top_k=3, alpha=1.0))  # Pure semantic
```

**Choosing alpha:** lower (toward keyword) for exact identifiers/SKUs/names/jargon; higher (toward semantic) for natural-language paraphrases. Tune per index and per intent.

## Metadata filtering

Attach `metadata` (a `Record<string,string>`) at index time, then constrain queries. **Metadata values are stored and compared as strings** — write numeric filters as strings (`"100"`, not `100`). Filtering is only applied on locally loaded indexes (or sessions).

**Operators:**

| Operator | Meaning |
| --- | --- |
| `$eq`, `$ne` | equals / not equals |
| `$gt`, `$gte`, `$lt`, `$lte` | greater / less than (compared as strings) |
| `$in`, `$nin` | value in / not in a list |
| `$near` | within a haversine distance of a point: `"lat,lng,radiusMeters"` |

**Filter shapes** (`MetadataFilter`):

```ts
type MetadataFilter =
  | { field: string; condition: FilterCondition }
  | { $and: MetadataFilter[] }
  | { $or:  MetadataFilter[] };

type FilterCondition =
  | { $eq:  string | number }
  | { $ne:  string | number }
  | { $gt:  string | number }
  | { $gte: string | number }
  | { $lt:  string | number }
  | { $lte: string | number }
  | { $in:  (string | number)[] }
  | { $nin: (string | number)[] }
  | { $near: string };
```

A single condition can be passed on its own without a `$and`/`$or` wrapper.

```python
# $eq - single condition needs no wrapper
await client.query(index, "running gear",
    QueryOptions(top_k=5, filter={"field": "category", "condition": {"$eq": "shoes"}}))

# $and - shoes under $100 (note string "100")
await client.query(index, "running shoes",
    QueryOptions(top_k=5, alpha=0.6, filter={"$and": [
        {"field": "category", "condition": {"$eq": "shoes"}},
        {"field": "price",    "condition": {"$lt": "100"}},
    ]}))

# $in - city in a set
await client.query(index, "city essentials",
    QueryOptions(top_k=5, filter={"field": "city", "condition": {"$in": ["new-york"]}}))

# $near - within 5km of Times Square
await client.query(index, "city products",
    QueryOptions(top_k=5, filter={"field": "location",
                                  "condition": {"$near": "40.7580,-73.9855,5000"}}))
```

```ts
const results = await client.query('products', 'running shoes', {
  topK: 5,
  alpha: 0.6,
  filter: {
    $and: [
      { field: 'category', condition: { $eq: 'shoes' } },
      { field: 'price',    condition: { $lt: 100 } },
    ],
  },
});
```

## Multi-index search (Python)

Query several loaded indexes in one call and get a **global** top-K, each result tagged with its source `index_name`.

```python
indexes = ["products", "reviews", "faqs"]
result = await client.load_indexes(indexes)        # bulk load, best-effort
print(f"loaded={result.loaded} failed={result.failed}")

results = await client.query_multi_index(
    indexes, "wireless headphones battery life", QueryOptions(top_k=6)  # top_k is GLOBAL
)
for doc in results.docs:
    print(f"[{doc.index_name}] {doc.id} score={doc.score:.3f} {doc.text[:60]}")

await client.unload_indexes(indexes)
```

**Behavior:** all indexes must be loaded locally **and share the same embedding model**; `top_k` is global (caps the merged set); `filter` and `embedding` work the same as single-index.

## Custom embeddings at query time

With `model_id="custom"` there is no local model, so you must pass the query vector via `QueryOptions.embedding`. All vectors must share dimensionality. Omitting it raises `ValueError` / `Embedding required`.

```python
q = embed("billing problem")  # your embedding fn
results = await client.query("tickets", "billing problem", QueryOptions(top_k=3, embedding=q))
```

---

# 5. Jobs / Async Status

All mutations (`createIndex`, `addDocs`, `deleteDocs`, `startBuild`, file parse, session `push_index`) are async and return a `jobId`. SDK methods poll internally and resolve when complete; with the raw HTTP API you poll `getJobStatus` yourself.

### `getJobStatus` (HTTP)

Poll a build job started by `startBuild`, `addDocs`, or `deleteDocs`.

**Required:** `jobId`

```bash
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" \
  -H "x-service-version: v1" \
  -H "x-project-key: moss_access_key_xxxxx" \
  -d '{
    "action": "getJobStatus",
    "projectId": "project_123",
    "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

**200 — OK (completed)**

```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "completed",
  "progress": 100,
  "currentPhase": null,
  "error": null,
  "createdAt": "2025-01-09T21:14:07.000+00:00",
  "updatedAt": "2025-01-09T21:14:32.000+00:00",
  "completedAt": "2025-01-09T21:14:32.000+00:00"
}
```

**200 — OK (building)**

```json
{
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "building",
  "progress": 45,
  "currentPhase": "indexing",
  "error": null,
  "createdAt": "2025-01-09T21:14:07.000+00:00",
  "updatedAt": "2025-01-09T21:14:15.000+00:00",
  "completedAt": null
}
```

**Response fields:**

| Field | Type | Notes |
| --- | --- | --- |
| `jobId` | string | The job identifier. |
| `status` | string | One of `building`, `completed`, or `failed`. |
| `progress` | integer | Percentage complete (0–100). |
| `currentPhase` | string \| null | Current build phase, or `null` when completed. |
| `error` | string \| null | Error message if the job failed, otherwise `null`. |
| `createdAt` | string | ISO 8601 when the job was created. |
| `updatedAt` | string | ISO 8601 of the last status update. |
| `completedAt` | string \| null | ISO 8601 when completed, or `null` if still running. |

**Errors:** `404` if the job ID is not found.

### Async polling pattern (HTTP, pseudo)

```
1. POST initUpload   -> { jobId, uploadUrl, expiresIn }
2. PUT  <your data> to uploadUrl
3. POST startBuild   -> { jobId, status: "building" }
4. loop POST getJobStatus until status == "completed" (or "failed")
   - on "failed": read .error, optionally inspect .currentPhase to see where it broke
```

The SDK collapses all of this into a single awaited `createIndex(...)` call.

---

# 6. Errors

### Control Plane HTTP error codes

| Code | Meaning |
| --- | --- |
| `403 Forbidden` | Invalid credentials (bad `x-project-key` / `projectId`). |
| `400` | Missing/invalid required field (e.g. `docCount`, `dimension`, `jobId`). |
| `404` | Index, project, job, or upload data not found. |
| `500` | Server-side failure (e.g. existing documents cannot be downloaded during `addDocs`). |

### SDK error reference

| Error | Cause | Fix |
| --- | --- | --- |
| `Unauthorized` | Missing or invalid credentials | Set `MOSS_PROJECT_ID` and `MOSS_PROJECT_KEY`. |
| `Index not found` | Querying/loading an index that doesn't exist | Call `createIndex()` first; verify the name matches exactly (case-sensitive). |
| `Index not loaded` | Calling `query()` before `loadIndex()` | Call `loadIndex(name)` before `query()`. `query()` throws if the index isn't loaded locally. |
| `Index already exists` | Calling `createIndex()` on an existing name | Use `addDocs()` with `upsert: true`, or delete the index first. |
| `Missing embeddings runtime` | Invalid/unrecognised `modelId` | Use `moss-minilm`, `moss-mediumlm`, or `custom`. |
| `Embedding required` | `modelId: 'custom'` without an `embedding` | Supply an `embedding` array on every document and every `query()` call. |
| `custom model not supported` | `createIndexFromFiles` with `modelId: 'custom'` | Use `moss-minilm` or `moss-mediumlm`; parsing embeds server-side. |
| `Job failed` | Async mutation error | Inspect `JobStatusResponse.error` via `getJobStatus(jobId)`. |

**SDK error behaviour:** most methods throw if the target index does not exist; `createIndex()` throws if the index already exists; `loadIndex()` throws if the index doesn't exist in cloud storage or loading fails; `createIndexFromFiles()` throws if `files` is empty, exceeds 20 files, or `modelId` is `"custom"`. If a job reaches `"failed"`, its `JobStatusResponse.error` is non-null and `currentPhase` hints where it failed (stuck on `downloading` usually = network issue).

**Irrelevant search results?** Lower `alpha` for more keyword matching; check chunking (aim 200–500 tokens/chunk); try `moss-mediumlm` for higher accuracy.

---

# 7. SDK Method Map (Python + JS)

## Install

```bash
npm install @moss-dev/moss     # JS/TS  -> package: @moss-dev/moss (v1.0.2)
pip install moss               # Python -> package: moss (v1.4.0)
# Swift (iOS): add https://github.com/usemoss/moss as a Swift package
```

> **Cross-SDK compatible:** JavaScript, Python, and Swift read the same indexes — build in one, query from another.

## `MossClient` — construction

```ts
const client = new MossClient(projectId, projectKey)                 // server-side
const client = new MossClient(projectId, new MyBackendAuthenticator()) // browser
```

```python
client = MossClient(project_id, project_key)
# or MossClient(project_id=..., project_key=...)
```

## Operation → method equivalence

| Operation | HTTP action | JS (`@moss-dev/moss`) | Python (`moss`) | MCP tool | CLI |
| --- | --- | --- | --- | --- | --- |
| Create index from docs | `initUpload`+`startBuild` | `createIndex(indexName, docs, options?)` | `create_index(name, docs, model_id?)` | `create_index` | `moss index create <name> -f docs.json` |
| Create index from files (PDF) | (file parse pipeline) | `createIndexFromFiles(indexName, files, options?)` | `create_index_from_files(name, files, model_id?)` | — | — |
| Get index metadata | `getIndex` | `getIndex(indexName)` | `get_index(name)` | `get_index` | `moss index get <name>` |
| List indexes | `listIndexes` | `listIndexes()` | `list_indexes()` | `list_indexes` | `moss index list` |
| Delete index | `deleteIndex` | `deleteIndex(indexName)` | `delete_index(name)` | `delete_index` | `moss index delete <name>` |
| Add/upsert docs | `addDocs` | `addDocs(indexName, docs, options?)` | `add_docs(name, docs, options?)` | `add_docs` | `moss doc add <name> -f docs.json` |
| Delete docs | `deleteDocs` | `deleteDocs(indexName, docIds, options?)` | `delete_docs(name, doc_ids)` | `delete_docs` | `moss doc delete <name> --ids ...` |
| Get docs | `getDocs` | `getDocs(indexName, options?)` | `get_docs(name, options?)` | `get_docs` | `moss doc get <name>` |
| Job status | `getJobStatus` | `getJobStatus(jobId)` | `get_job_status(job_id)` | `get_job_status` | — |
| Load index into memory | (`getIndexUrl`) | `loadIndex(indexName, options?)` | `load_index(name, auto_refresh?, polling_interval_in_seconds?)` | `load_index` | (implicit) |
| Unload index | — | — | `unload_index(name)` | — | — |
| Bulk load | — | — | `load_indexes(names, auto_refresh?, polling_interval_in_seconds?)` | — | — |
| Bulk unload | — | — | `unload_indexes(names)` | — | — |
| Query (single) | (cloud `/query`) | `query(indexName, query, options?)` | `query(name, query, options?)` | `query` | `moss query <name> "<text>"` |
| Query (multi-index) | — | — | `query_multi_index(names, query, options?)` | — | — |
| Open real-time session | — | (coming) | `session(index_name, model_id?)` | — | — |
| Get short-lived token | — | `getAuthToken()` | — | — | — |

### Key method signatures & defaults

**JS:**

- `createIndex(indexName, docs: DocumentInfo[], options?: CreateIndexOptions): Promise<MutationResult>` — handles init→upload→build→poll, resolves when ready. When all docs have embeddings → serialized as raw float32 (custom flow); when none → server embeds (dimension=0 flow). **Mixed docs are rejected.**
- `createIndexFromFiles(indexName, files: ParseFileInput[], options?: CreateIndexFromFilesOptions): Promise<MutationResult>` — **max 20 files**, server parses + embeds, `modelId="custom"` not supported.
- `addDocs(indexName, docs, options?: MutationOptions): Promise<MutationResult>` — `options.upsert` default `true`.
- `deleteDocs(indexName, docIds: string[], options?): Promise<MutationResult>`
- `loadIndex(indexName, options?: LoadIndexOptions): Promise<string>` — `autoRefresh` default `false`; `pollingIntervalInSeconds` default `600`; `cachePath` to persist to disk.
- `query(indexName, query, options?: QueryOptions): Promise<SearchResult>` — `topK` default `5`, `alpha` default `0.8`.
- `getJobStatus(jobId): Promise<JobStatusResponse>`
- `getDocs(indexName, options?: GetDocumentsOptions): Promise<DocumentInfo[]>`
- `getAuthToken(): Promise<AuthToken>` — `{ token, expiresIn }`.

**Python:**

- `create_index(name, docs, model_id=None) -> MutationResult` — omitting `model_id` picks `"moss-minilm"` if no doc has an embedding, `"custom"` if every doc provides one; mixed rejected.
- `create_index_from_files(name, files, model_id=None) -> MutationResult` — default `"moss-minilm"`, max 20 files, no `"custom"`.
- `add_docs(name, docs, options=None) -> MutationResult`
- `delete_docs(name, doc_ids) -> MutationResult`
- `load_index(name, auto_refresh=False, polling_interval_in_seconds=600) -> str`
- `unload_index(name)`
- `load_indexes(names, auto_refresh=False, polling_interval_in_seconds=600) -> LoadIndexesResult`  (`.loaded: List[str]`, `.failed: Dict[str,str]`)
- `unload_indexes(names)` — idempotent.
- `query(name, query, options=None) -> SearchResult`
- `query_multi_index(names, query, options=None) -> SearchResult` — `top_k` is global; docs carry `index_name`.
- `get_job_status(job_id) -> JobStatusResponse`
- `get_index(name) -> IndexInfo`; `list_indexes() -> List[IndexInfo]`; `delete_index(name) -> bool`
- `get_docs(name, options=None) -> List[DocumentInfo]`
- `session(index_name, model_id=None) -> SessionIndex` — default model `"moss-minilm"`; raises `ValueError` if resuming a cloud index with a different model.

### `SessionIndex` (Python — local, real-time, ~1–10 ms, no cloud round trip)

> Sessions are available in **Python, Swift, Elixir, and C** SDKs today. **JavaScript (Node) session support is coming.**

Properties: `name: str`, `doc_count: int`.

| Method | Returns | Notes |
| --- | --- | --- |
| `add_docs(docs, options=None)` | `Tuple[int,int]` = `(added, updated)` | Embeds locally via Rust core, no network. With `custom`, each doc needs `.embedding`. |
| `delete_docs(doc_ids)` | `int` (number deleted) | |
| `get_docs(options=None)` | `List[DocumentInfo]` | |
| `query(query, options=None)` | `SearchResult` | In-memory; same filter syntax as `MossClient.query()`. |
| `push_index()` | `PushIndexResult` | Uploads docs + local embeddings to cloud; creates/replaces the cloud index of the same name; **no server re-embedding**. |

```python
session = await client.session(index_name="session-abc")        # auto-loads cloud index if exists, else empty
await session.add_docs([DocumentInfo(id="1", text="Customer asked about billing")])
results = await session.query("billing question")
result = await session.push_index()
# optionally: await client.get_job_status(result.job_id)
```

### Core data types

```
DocumentInfo            = { id: string; text: string (REQUIRED); metadata?: Record<string,string>; embedding?: number[] }
MutationOptions         = { upsert?: boolean (default true); onProgress?: (progress) => void }
MutationResult          = { jobId/job_id; indexName/index_name; docCount/doc_count }
GetDocumentsOptions     = { docIds?/doc_ids?: string[] }   // omit -> all docs
CreateIndexOptions      = { modelId?: string; onProgress?: (p) => void }
CreateIndexFromFilesOptions = { modelId?: "moss-minilm" | "moss-mediumlm"; onProgress?: (p) => void }
ParseFileInput          = { name; contentType/content_type; path?; data? }  // data takes precedence; only application/pdf supported
LoadIndexOptions (JS)   = { autoRefresh?: boolean (false); pollingIntervalInSeconds?: number (600); cachePath?: string }
LoadIndexesResult (Py)  = { loaded: List[str]; failed: Dict[str,str] }
PushIndexResult (Py)    = { job_id; index_name; doc_count; status }
IndexInfo               = { id; name; version; status; docCount/doc_count; createdAt; updatedAt; model: ModelRef }
ModelRef                = { id; version }
JobStatusResponse       = { jobId/job_id; status; progress; currentPhase/current_phase; error?; createdAt; updatedAt; completedAt }
SearchResult            = { docs: QueryResultDocumentInfo[]; query; indexName/index_name?; timeTakenInMs/time_taken_ms? }
QueryResultDocumentInfo = DocumentInfo + { score: number; index_name?: string }
```

### Storage, persistence & auto-refresh

Indexes live in the cloud (canonical). `loadIndex()` fetches an in-memory snapshot for fast local retrieval. The **JS SDK** can cache the download to disk via `cachePath` so subsequent loads skip the network when the cloud data hasn't changed. **Auto-refresh** periodically polls the cloud and **hot-swaps** the in-memory index when a newer version is detected — in-flight queries are not interrupted.

```ts
await client.loadIndex('my-index', { cachePath: '/var/cache/moss' })
await client.loadIndex('my-index', { autoRefresh: true, pollingIntervalInSeconds: 300 }) // every 5 min
```

```python
await client.load_index("my-index", auto_refresh=True, polling_interval_in_seconds=300)
```

---

# 8. Hackathon Recipes (compose Moss with the other sponsors)

> Sponsor stack: **Unsiloed** (PDF parsing/ingest), **Moss** (retrieval), **LiveKit** (voice transport + agents), **MiniMax** (TTS / voice-clone / multimodal), **TrueFoundry** (LLM gateway / govern), **AWS** (hosting).

### Recipe 1 — Support voice bot: LiveKit + Moss context-injection (grounded CS, zero hallucination)

This is the highest-leverage pattern. Instead of tool-calling (which adds an LLM "should I search?" round trip), inject Moss results into the chat context on **every** user turn. Lower latency, always grounded. Works perfectly for the **Support track**.

```python
from moss import MossClient, QueryOptions
from livekit.plugins import openai, deepgram, silero
from livekit.agents import JobContext, WorkerOptions, cli, ChatContext, ChatMessage, Agent, AgentSession

class MossSemanticRetrievalAgent(Agent):
    def __init__(self, moss_client: MossClient):
        super().__init__(instructions="You are a helpful support voice assistant. Answer ONLY from the provided context; if absent, say you don't know.")
        self.moss = moss_client

    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        results = await self.moss.query(INDEX_NAME, new_message.text_content, QueryOptions(top_k=5, alpha=0.8))
        if results.docs:
            context_str = "\n".join(f"- {d.text}" for d in results.docs)
            turn_ctx.add_message(role="system", content=f"Relevant context from knowledge base:\n{context_str}\n\nUse this to answer the user.")
        await super().on_user_turn_completed(turn_ctx, new_message)

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    moss_client = MossClient(project_id=MOSS_PROJECT_ID, project_key=MOSS_PROJECT_KEY)
    await moss_client.load_index(INDEX_NAME)                 # load once at start -> ~1-10ms per turn
    session = AgentSession(stt=deepgram.STT(), llm=openai.LLM(model="gpt-4o"), tts=openai.TTS(), vad=silero.VAD.load())
    await session.start(agent=MossSemanticRetrievalAgent(moss_client), room=ctx.room)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

Swap `openai.LLM(...)` to point at **TrueFoundry's LLM gateway** for governance/cost control; swap `openai.TTS()` for **MiniMax TTS** (or a cloned brand voice). Deploy the worker on **AWS**.

### Recipe 2 — PDF knowledge base: Unsiloed/`createIndexFromFiles` → Moss → voice

Two ways to ingest PDFs. (a) Let **Moss parse natively** — `createIndexFromFiles` handles parsing/chunking/embedding server-side, up to 20 PDFs/call, `application/pdf` only. (b) Use **Unsiloed** for richer parsing (tables, layout), then push the extracted text via `createIndex`.

```python
# (a) Moss native PDF ingest
from moss import MossClient, ParseFileInput
client = MossClient(os.getenv("MOSS_PROJECT_ID"), os.getenv("MOSS_PROJECT_KEY"))
result = await client.create_index_from_files('knowledge-base', [
    ParseFileInput(name='manual.pdf', content_type='application/pdf', path='/docs/manual.pdf'),
], model_id='moss-minilm')
print(f"Index ready - {result.doc_count} chunks created")
```

```python
# (b) Unsiloed-parsed text -> Moss (use when you need table/layout-aware chunks)
chunks = unsiloed_parse("/docs/complex_report.pdf")  # -> list of {id, text, metadata}
await client.create_index("report", [DocumentInfo(**c) for c in chunks], "moss-mediumlm")
```

Then `load_index` + `query` and wire into any voice transport (Recipe 1).

### Recipe 3 — Co-Pilot ambient agent: live-call context (session short-term + cloud long-term)

For the **Co-Pilot track**: index transcript turns into a local **session** in real time, while also querying a persistent knowledge index — both in-memory, queried per turn, then handed to the model.

```python
client = MossClient(MOSS_PROJECT_ID, MOSS_PROJECT_KEY)
await client.load_index("support-faqs")                          # long-term knowledge (load once)
session = await client.session(index_name=f"call-{call_id}")     # short-term, this call

# on each turn:
await session.add_docs([DocumentInfo(id="turn-7", text=transcript_turn)])   # local, no network
knowledge = await client.query("support-faqs", user_intent, QueryOptions(top_k=3))
recent    = await session.query(user_intent, QueryOptions(top_k=3))
# feed knowledge.docs + recent.docs into the LLM (e.g. via TrueFoundry gateway)

await session.push_index()  # at call end: persist the session for later resume / handoff
```

### Recipe 4 — Lead Gen: multi-index search across catalog + CRM + objections

For the **Lead Gen track**, keep distinct corpora and merge at query time. One call, global top-K, source-tagged — the agent can cite product specs, prior CRM notes, and objection-handling scripts in one breath.

```python
indexes = ["catalog", "crm-notes", "objection-playbook"]
await client.load_indexes(indexes)
res = await client.query_multi_index(indexes, prospect_question, QueryOptions(top_k=6))
for d in res.docs:
    print(f"[{d.index_name}] {d.text}")   # tagged by source so the agent knows what kind of fact it is
```

### Recipe 5 — ElevenLabs / VAPI client-tool retrieval (drop-in for those transports)

If your voice stack is ElevenLabs or VAPI instead of LiveKit, Moss ships first-class packages.

```python
# ElevenLabs: pip install elevenlabs-moss
from elevenlabs_moss import MossClientTool
moss_tool = MossClientTool(index_name="support-docs", tool_name="search_knowledge_base", top_k=3)
await moss_tool.load_index()
moss_tool.register(client_tools)   # register with ElevenLabs ClientTools
```

`MossClientTool` params: `index_name` (required), `tool_name` (default `"search_knowledge_base"`, must match the dashboard tool name, case-sensitive), `top_k` (default `5`), `alpha` (default `0.8`), `result_prefix`. VAPI connects via a Custom Knowledge Base webhook; Agora and Pipecat are wired over MCP / pipeline tools.

### Recipe 6 — Browser-only demo (private, on-device search)

The browser/WASM SDK (`@moss-dev/moss-web`, class `MossClient` backed by WebAssembly) runs indexing and queries in the browser — great for a privacy-flex demo where user data never leaves the device. Use the custom-authenticator pattern so `projectKey` never ships to the client. Browser file uploads accept `File`/`Blob` directly in `createIndexFromFiles`.

### Recipe 7 — Vibecode it with the Moss MCP server

Wire Moss tools directly into Claude Desktop / Cursor so your AI assistant creates indexes and runs queries without you writing wrapper code.

```json
{
  "mcpServers": {
    "moss": {
      "command": "npx",
      "args": ["-y", "@moss-tools/mcp-server"],
      "env": { "MOSS_PROJECT_ID": "your-project-id", "MOSS_PROJECT_KEY": "your-project-key" }
    }
  }
}
```

MCP tools exposed: `query`, `load_index`, `create_index`, `list_indexes`, `get_index`, `delete_index`, `add_docs`, `get_docs`, `delete_docs`, `get_job_status`. Optional `MOSS_CLOUD_API_BASE_URL` overrides the base URL (default `https://service.usemoss.dev`).

---

# 9. Gotchas / Latency Notes / What to Demo

### Latency — the whole pitch

- **`query()` requires a prior `loadIndex()`** or it falls back to the cloud `/query` endpoint (~100–500 ms — audible dead air in voice). After `loadIndex()`, queries are in-memory (~1–10 ms). **Load at agent/call start, never per-turn.** `SearchResult.timeTakenInMs` lets you prove the number on stage.
- **Sessions are sub-10 ms** because every op (`add_docs`, `query`) runs in-process via the Rust core — no network on any operation.
- **Context injection beats tool-calling for voice**: skipping the LLM "should I search?" decision removes a full round trip. Use `on_user_turn_completed` to inject.

### Async / correctness footguns

- **Mutations are async jobs.** Raw HTTP `addDocs`/`createIndex` return `{ jobId, status: "building" }` — you must poll `getJobStatus` until `completed`. SDK methods poll for you and only resolve when ready, so prefer the SDK during the hackathon.
- **Metadata values are strings.** Numeric filters must be quoted: `{"$lt": "100"}`, not `100`. Easy to lose 20 minutes here.
- **Filtering/hybrid only apply to locally loaded indexes** (or sessions). A `filter` on an unloaded index won't behave as expected — `loadIndex()` first.
- **`createIndex` rejects mixed docs**: either *all* docs have `embedding` (→ `custom`) or *none* do (→ server embeds). Don't half-populate embeddings.
- **`createIndexFromFiles`**: max **20 files**, `application/pdf` only, `modelId="custom"` not supported (server embeds). Provide `path` or `data` (data wins if both).
- **`custom` model**: every doc AND every query must carry an `embedding`, else `ValueError` / `Embedding required`. `createIndexFromFiles` can't use `custom`.
- **Index names are case-sensitive** and unique per project. `createIndex` on an existing name throws `Index already exists` → use `addDocs(..., upsert:true)` instead.
- **Sessions in JS are not available yet** (Python/Swift/Elixir/C only). If your voice agent needs short-term session context, write it in Python.
- **Multi-index** requires all indexes loaded *and* sharing the same embedding model; `top_k` is global, not per-index.

### Plan limits worth knowing (Developer/free tier)

- **Sessions are an Enterprise feature** in the pricing table (the headline real-time `session()` API). Free/Hobbyist/Startup tiers show `-` for Sessions. Confirm tier access early if your demo depends on `session()`; the live-call pattern can degrade to "load cloud index + per-turn query" if needed.
- Developer (free): **3 indexes**, 1 project, 500 MB storage, 50 MB/mo ingest, 60 voice-min/mo. **Local queries are unlimited and never metered** on every tier.
- `moss-litelm` is the on-device default on iOS; HQ/HP embedding models are Enterprise-only.

### Production checklist (if you keep building post-hackathon)

Configure keys via env vars; persist indexes to a durable path (`cachePath`); monitor index size + query latency (p50/p95); enable sync + test offline; add health checks; keep data local where possible; encrypt synced data; log index lifecycle events; establish backup/export cadence.

### What to demo (judge-bait)

1. **Print `timeTakenInMs`** on a loaded query next to a cloud-fallback query — the sub-10 ms vs hundreds-of-ms gap is the entire thesis, visualized.
2. **Live index update mid-demo**: `addDocs` a new fact, then ask the voice agent about it and watch it answer correctly (instant updates / hot-swap).
3. **Session recall**: tell the agent something, change topic, then reference it 60 s later — proves short-term session context with no DB.
4. **Multi-index citation**: have the agent answer one question with facts visibly tagged from 3 different corpora.

---

# 10. 2 a.m. Cheat-Sheet (the 10 things you'll copy-paste)

```bash
# 1. Install + auth
npm install @moss-dev/moss        # or: pip install moss
export MOSS_PROJECT_ID="..." MOSS_PROJECT_KEY="..."
```

```python
# 2. The whole core flow (Python)
from moss import MossClient, DocumentInfo, QueryOptions
client = MossClient(MOSS_PROJECT_ID, MOSS_PROJECT_KEY)
await client.create_index("faqs", [DocumentInfo(id="1", text="...", metadata={"cat":"a"})], "moss-minilm")
await client.load_index("faqs")                                   # REQUIRED before query
res = await client.query("faqs", "user question", QueryOptions(top_k=5, alpha=0.8))
```

```ts
// 3. Core flow (JS)
const client = new MossClient(process.env.MOSS_PROJECT_ID!, process.env.MOSS_PROJECT_KEY!)
await client.createIndex('faqs', [{ id:'1', text:'...' }], { modelId:'moss-minilm' })
await client.loadIndex('faqs')
const res = await client.query('faqs', 'user question', { topK: 5 })
```

```python
# 4. Hybrid knob:  alpha=0.0 keyword | 0.8 default | 1.0 semantic
QueryOptions(top_k=5, alpha=0.6)
```

```python
# 5. Metadata filter (values are STRINGS!)
QueryOptions(top_k=5, filter={"$and":[
  {"field":"category","condition":{"$eq":"shoes"}},
  {"field":"price","condition":{"$lt":"100"}}]})
```

```python
# 6. Real-time session (Python; index transcript turns, no network)
s = await client.session(index_name="call-123")
await s.add_docs([DocumentInfo(id="turn-1", text="...")])
hits = await s.query("...", QueryOptions(top_k=3))
await s.push_index()
```

```python
# 7. Multi-index (global top_k, source-tagged)
await client.load_indexes(["catalog","crm","faqs"])
r = await client.query_multi_index(["catalog","crm","faqs"], "q", QueryOptions(top_k=6))
```

```python
# 8. PDF -> index (max 20 files, application/pdf, no custom model)
from moss import ParseFileInput
await client.create_index_from_files("kb", [ParseFileInput(name="a.pdf", content_type="application/pdf", path="/a.pdf")])
```

```bash
# 9. Raw HTTP control plane (auth = 2 headers + projectId in body)
curl -X POST "https://service.usemoss.dev/v1/manage" \
  -H "Content-Type: application/json" -H "x-service-version: v1" -H "x-project-key: moss_access_key_xxxxx" \
  -d '{"action":"listIndexes","projectId":"project_123"}'
# addDocs/createIndex/deleteDocs return {jobId,status:"building"} -> poll getJobStatus until "completed"
```

```python
# 10. LiveKit per-turn grounding (the winning Support pattern)
async def on_user_turn_completed(self, turn_ctx, new_message):
    r = await self.moss.query(INDEX_NAME, new_message.text_content, QueryOptions(top_k=5, alpha=0.8))
    if r.docs:
        turn_ctx.add_message(role="system", content="Context:\n" + "\n".join(f"- {d.text}" for d in r.docs))
    await super().on_user_turn_completed(turn_ctx, new_message)
```

**Constants to memorize:** base URL `https://service.usemoss.dev/v1` · single endpoint `POST /v1/manage` · headers `x-project-key` + `x-service-version: v1` + `Content-Type: application/json` · default model `moss-minilm` (384-dim) · default `topK`=5, `alpha`=0.8 · models: `moss-minilm`/`moss-mediumlm`/`custom` · job statuses `pending_upload|uploading|building|completed|failed` · max 20 PDFs/call · packages `@moss-dev/moss` (JS), `moss` (Py), `@moss-tools/mcp-server` (MCP), `moss-cli` (CLI binary `moss`).
