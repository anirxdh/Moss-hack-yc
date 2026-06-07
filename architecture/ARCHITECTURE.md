# Tax It Easy — System Architecture

This document describes the full system design of **Tax It Easy**: a voice AI CPA that prepares
and explains a user's tax return. It is built as a **sponsor-stack sweep** — every layer of
the pipeline is owned by an official hackathon sponsor, wired together naturally rather than
bolted on.

> **The one-line thesis:** `Unsiloed (parse) → Moss (retrieve) → LiveKit (talk) →
> MiniMax (voice) → TrueFoundry (govern) → AWS (host)`, all keyed to a single Clerk identity
> so a user only ever reads or hears back **their own** documents.

---

## 1. Component / sponsor map

| # | Component | Sponsor / tech | Code |
|---|---|---|---|
| 1 | Auth & identity seam | **Clerk** | `frontend/middleware.ts`, `frontend/app/api/*` |
| 2 | Object storage + presigned upload/download | **AWS S3** | `frontend/lib/s3.ts`, `infra/s3-setup.sh` |
| 3 | Document parsing (PDF → chunks) | **Unsiloed** | `agent-py/src/ingest_tax.py` |
| 4 | Ingest orchestration (async) | FastAPI | `agent-py/src/ingest_service.py` |
| 5 | Retrieval brain (RAG + memory + tax code) | **Moss** | `agent-py/src/agent.py`, `create_index.py` |
| 6 | Voice transport + Agents runtime | **LiveKit** (+ Inference, Deepgram STT) | `agent-py/src/agent.py`, `frontend/app/api/token` |
| 7 | Expressive TTS | **MiniMax** (Cartesia fallback) | `build_tts()`, `src/minimax_patch.py` |
| 8 | LLM governance / PII guardrails | **TrueFoundry** gateway (optional) | `build_llm()` |
| 9 | Tax-extraction LLM | Qwen / Alibaba DashScope | `build_llm()`, frontend env |
| 10 | Optional talking head | Simli / Tavus | `build_avatar()` |

---

## 2. System diagram

```
                                        ┌──────────────────────────────────────────────────┐
                                        │                   BROWSER (user)                   │
                                        │   Next.js 15 App Router · LiveKit React · Clerk    │
                                        │   /  →  /upload  →  /return  →  /call               │
                                        └───────┬───────────────┬───────────────┬────────────┘
                          (1) Clerk auth on     │               │               │
                          every request; userId │ (2) presigned │ (4) presigned │ (6) WebRTC
                          is the ONE identity    │     POST      │     GET       │  mic/audio
                                ───────────────► │               │               │
            ┌───────────────────────────────────▼───┐   ┌───────▼────────┐   ┌──▼─────────────────────────┐
            │  Next.js API routes (server, Clerk-gated)│  │  AWS S3 bucket │   │   LiveKit Cloud (room)     │
            │  /api/uploads/presign  → presign POST    │  │ users/{userId}/│   │  + agent dispatch metadata │
            │  /api/return-doc       → presign GET     │◄─┤   uploads/     │   │  { "user_id": <clerk id> } │
            │  /api/token            → LiveKit JWT +    │  │   1040.pdf     │   └──────────┬─────────────────┘
            │                          dispatch metadata│  └───────┬────────┘              │ (6) explicit dispatch
            └───────────────────────────┬──────────────┘          │                       │     to "agent-py"
                                         │ (3) POST /ingest        │ get_object            ▼
                                         │     (X-Ingest-Secret)   │        ┌──────────────────────────────────────┐
                                         ▼                         │        │  PYTHON VOICE AGENT (LiveKit Agents)   │
                            ┌──────────────────────────┐           │        │  agent-py/src/agent.py · Assistant     │
                            │  FastAPI ingest service   │           │        │                                        │
                            │  agent-py/ingest_service  │───────────┘        │  pipeline:                             │
                            │  202 + job_id (async)     │                    │   Deepgram STT → LLM → MiniMax TTS      │
                            └────────────┬──────────────┘                    │   + Silero VAD + turn detection        │
                                         │ (3) Unsiloed /parse                │   + ai_coustics noise cancel           │
                                         ▼                                    │                                        │
                            ┌──────────────────────────┐                     │  tools (@function_tool):               │
                            │  Unsiloed Vision API      │                     │   search_knowledge ─► Moss knowledge   │
                            │  PDF → markdown chunks     │                     │   search_taxcode   ─► Moss taxcode     │
                            └────────────┬──────────────┘                     │   recall/remember  ─► Moss memory      │
                                         │  add_docs(metadata.user_id)         │   record_concern / sign_off            │
                                         ▼                                    └───────┬────────────────────┬───────────┘
            ┌────────────────────────────────────────────────┐                       │                    │
            │                    MOSS (retrieval)             │◄──────────────────────┘   (5) per-user      │ (7)/(8)
            │  index: knowledge  → per-user RAG (user_id tag) │   query w/ filter:          retrieval        │ LLM + TTS
            │  index: taxcode    → cited US tax law (shared)  │   {user_id == caller}                        ▼
            │  index: memory     → per-user agentic memory    │                            ┌─────────────────────────────┐
            └─────────────────────────────────────────────────┘                           │  MiniMax TTS  (voice)        │
                                                                                           │  TrueFoundry gateway (LLM)   │
                                                                                           │   └ PII/PHI guardrails in+out│
                                                                                           │  Qwen/DashScope (extraction) │
                                                                                           └─────────────────────────────┘
```

---

## 3. The two pipelines

The system is two pipelines that meet at Moss.

### A. Ingest pipeline (write path) — "make the return searchable"

```
Browser ──presign──► S3 (users/{userId}/uploads/…) ──► FastAPI /ingest ──► Unsiloed parse
                                                              │                    │
                                                          202 + job_id        markdown chunks
                                                              │                    ▼
                                                  GET /ingest/status/{job_id}   Moss.add_docs(
                                                                                  index="knowledge",
                                                                                  metadata={"user_id": …})
```

- Upload is **direct browser → S3** via a presigned POST. The key is fixed server-side under
  `users/{userId}/…`, so the client can never write outside its own namespace (identity hop #1).
- `/ingest` is **async**: an Unsiloed parse can take up to ~30 min, so it returns `202` with a
  `job_id` immediately and runs the parse in a background task; the frontend polls
  `GET /ingest/status/{job_id}`.
- `/ingest` is callable **only** by a trusted server holding `AGENT_INGEST_SECRET`
  (`X-Ingest-Secret` header); `user_id` comes from that caller, never the browser — otherwise
  anyone could ingest into another user's namespace and defeat the per-user retrieval filter.

> For the demo, the prepared 1040 is ingested via the CLI (`ingest_tax.py main → ingest_pdf`)
> and the frontend simply renders it on `/return`.

### B. Conversation pipeline (read path) — "talk about the return"

```
Browser /call ──/api/token──► LiveKit room (dispatch metadata: {user_id})
                                   │
                          agent "agent-py" joins
                                   │
   mic audio ─► Deepgram STT ─► LLM (Inference or TrueFoundry gateway) ─► MiniMax TTS ─► speaker
                                   │
                          @function_tool calls ─► Moss (knowledge / taxcode / memory), filtered to user_id
```

- The LiveKit access token (`/api/token`) stamps `{ "user_id": <clerkId> }` as **agent dispatch
  metadata**. The agent reads it via `ctx.job.metadata` and resolves it through
  `resolve_user_id()`, which **fails closed**: malformed/missing metadata yields a sentinel
  (`__unverified__`) that matches no real user, so a misconfigured dispatch retrieves *nothing*
  rather than another user's return.
- Every Moss retrieval is scoped with a metadata filter
  `{"field": "user_id", "condition": {"$eq": <user_id>}}`.

---

## 4. The identity seam (why this is safe)

One Clerk `userId` is the join key across **four** otherwise-independent systems:

```
                         ┌─────────────► S3 key prefix:     users/{userId}/…
   Clerk userId ─────────┼─────────────► Moss metadata:     {"user_id": userId}
   (single source        ├─────────────► LiveKit dispatch:  metadata { "user_id": userId }
    of identity)         └─────────────► Ingest tag:        ingest_service user_id
```

Because the same id is used end-to-end, the agent's per-user retrieval filter matches exactly
the documents this user uploaded — and **only** those. Trust boundaries:

| Boundary | Control |
|---|---|
| Browser → S3 | presigned POST with server-fixed key under `users/{userId}/` |
| Browser → API routes | Clerk middleware gates every route; `auth()` resolves `userId` server-side |
| Frontend → ingest service | shared secret `AGENT_INGEST_SECRET` (`X-Ingest-Secret`); browser never calls it |
| Dispatch metadata → agent | `resolve_user_id()` fails closed to `__unverified__` on bad input |
| Agent → Moss | per-user metadata filter on every `knowledge`/`memory` query |

---

## 5. Moss index design

Three indexes, each with a distinct trust/lifecycle profile:

| Index | Contents | Read | Write | Filtering |
|---|---|---|---|---|
| `knowledge` | per-user parsed tax docs (RAG corpus) | runtime | ingest pipeline | filtered by `user_id` |
| `taxcode` | cited US tax-law corpus (60 chunks, `taxcode.json`) | runtime | build-time | shared (citations) |
| `memory` | per-user agentic memory (facts the user states) | runtime | runtime | filtered by `user_id` |

- `create_index.py` builds all three from the seed corpora (`knowledge.json`, `taxcode.json`,
  plus a placeholder seed for `memory`). Run via `pnpm moss:index`.
- **Citation gate:** `search_taxcode` only returns a chunk if its Moss similarity score clears
  `TAXCODE_MIN_SCORE` (default `0.90`, calibrated by `measure_taxcode_scores.py`). Below it, it
  returns `NO_CITATION_FOUND`, and the agent is instructed to refuse + offer a CPA hand-off via
  `record_concern` — so a tax-law answer can **never** come from the model's own training memory.

---

## 6. Agent guardrails (anti-hallucination)

The agent narrates a return a human CPA already prepared, so correctness > fluency:

1. **Numbers come from retrieval, not math.** The agent reads numbers from Moss
   (`search_knowledge`) / the verified `ReturnSummary` fixture (`return_summary.py`); it never
   recomputes tax. Year-over-year deltas are pre-computed at fixture time.
2. **Tax law requires a citation.** `search_taxcode` gates on similarity score; no citation →
   refuse and flag for a CPA.
3. **PII/PHI redaction at the gateway.** When routed through TrueFoundry (`LLM_BASE_URL` set),
   `TRUEFOUNDRY_GUARDRAILS` applies PII guardrails to **both** LLM input and output.
4. **No cross-user leakage.** Per-user metadata filters + fail-closed identity resolution.
5. **Privacy in logs.** Ingest and parsing log only counts, ids, page numbers, and latency —
   never document text (it contains SSN/income).

---

## 7. Latency & resilience choices

- **STT/LLM/TTS via LiveKit Inference** by default — no extra round-trips or keys; the
  TrueFoundry gateway is opt-in for governance.
- **MiniMax single-segment patch** (`minimax_patch.py`) targets the international endpoint and
  emits one audio segment per turn for lower latency; **auto-falls back to Cartesia** if MiniMax
  creds are missing, so a fresh clone degrades to a working voice instead of crashing.
- **Async ingest** keeps the slow Unsiloed parse off the request path (`202 + job_id`).
- **Avatar is optional and off-path** — voice-only by default to save credits; enabling Simli/
  Tavus degrades gracefully to voice-only if creds are absent.
- **Turn detection + VAD** (`MultilingualModel` + Silero) and `ai_coustics` noise cancellation
  keep the voice loop responsive in a noisy demo room.

---

## 8. Deployment topology

```
LiveKit Cloud ──dispatch──► Agent worker (Dockerfile, entrypoint src/agent.py)
                                   │ outbound only to Moss / MiniMax / TrueFoundry
Next.js (Vercel/host) ──► API routes ──► S3  +  FastAPI ingest service (long-lived)
                                          │
                                  IAM least-privilege policy (printed by infra/s3-setup.sh)
```

- **Agent:** containerized via `agent-py/Dockerfile`; same env as `.env.local`.
- **Frontend:** `pnpm --dir frontend build` → `pnpm start:frontend`.
- **Ingest service:** run `src/ingest_service.py` as a persistent process reachable at
  `AGENT_INGEST_URL` (its in-memory job store is fine for the hackathon; production would back
  it with a durable store).
- **S3:** `infra/s3-setup.sh` provisions the bucket (block-public-access, SSE, CORS for
  presigned POST/PUT, lifecycle expiry on raw uploads) and prints the IAM policy to attach.

---

## 9. Sequence: a full session

```
User            Frontend            S3         Ingest svc      Unsiloed     Moss        LiveKit/Agent
 │  sign in        │                  │             │              │          │              │
 │────────────────►│ Clerk userId     │             │              │          │              │
 │  upload doc     │                  │             │              │          │              │
 │────────────────►│ presign POST ───►│             │              │          │              │
 │  (browser PUT) ─────────────────►  │             │              │          │              │
 │                 │ POST /ingest ─────────────────►│ parse ──────►│          │              │
 │                 │◄── 202 job_id    │             │◄── chunks ───┘          │              │
 │                 │                  │             │ add_docs(user_id) ──────►│              │
 │  open /return   │ presign GET ────►│ (1040.pdf)  │              │          │              │
 │◄── view PDF ────│                  │             │              │          │              │
 │  open /call     │ /api/token (dispatch metadata) │              │          │              │
 │────────────────►│──────────────────────────────────────────────────────────────────────►│ agent joins
 │  "what's my refund?" (voice) ──────────────────────────────────────────────────────────►│ STT→LLM
 │                 │                  │             │              │  search_knowledge(filter)│
 │                 │                  │             │              │◄─────────────────────────│
 │◄── spoken answer (MiniMax TTS), grounded in the user's own return ────────────────────────│
```

---

*See [`../README.md`](../README.md) for setup/run instructions and the `docs/` directory for
per-sponsor deep-dives (`MOSS.md`, `LIVEKIT.md`, `UNSILOED.md`, `MINIMAX.md`, `TRUEFOUNDRY.md`).*
