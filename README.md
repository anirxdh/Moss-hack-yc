# Tax It Easy — a voice AI CPA that prepares *and explains* your tax return

> **Write-up:** [Building a Voice CPA That Only Says What It Can Cite](https://anirudhvasudevan.com/blog/moss-voice-cpa-yc-hackathon/), the architecture, decisions and lessons. Built by [Anirudh Vasudevan](https://anirudhvasudevan.com/).

> Upload your tax documents, get a prepared 1040, then **talk to a voice agent** that
> walks you through every line — grounded in *your* filings and the actual US tax code,
> never hallucinated.

**Tax It Easy** is a full-stack conversational-AI app built for the **Moss × YC Conversational
AI Hackathon 2026**. A human-grade tax return is parsed, indexed, and served per-user;
a low-latency voice agent answers questions about it using retrieval-augmented
generation over [Moss](https://docs.moss.dev), with strict guardrails so it only ever
speaks numbers and tax-law citations it can actually source.

It is deliberately a **sponsor-stack sweep** — it uses Unsiloed → Moss → LiveKit →
MiniMax → TrueFoundry → AWS naturally, end to end (see [the sponsor map](#sponsor-stack)).

<img width="1044" height="736" alt="Screenshot 2026-06-07 at 11 33 26 AM" src="https://github.com/user-attachments/assets/076ec54c-6d21-4194-a2c6-4b0ab4a84b43" />


---

## Table of contents

- [What it does](#what-it-does)
- [Sponsor stack](#sponsor-stack)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Configuration (environment variables)](#configuration-environment-variables)
- [One-time setup](#one-time-setup)
- [Running locally](#running-locally)
- [The end-to-end user flow](#the-end-to-end-user-flow)
- [Testing & linting](#testing--linting)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## What it does

1. **Sign in** (Clerk). Your Clerk `userId` is the single identity used end-to-end — as
   the S3 key prefix, the Moss `user_id` metadata tag, and the LiveKit dispatch metadata.
2. **Upload** a tax document. The browser gets a short-lived presigned POST and uploads
   **directly to S3** under `users/{userId}/…` — it can never write outside its own prefix.
3. **Ingest.** A FastAPI service downloads the object, parses it with **Unsiloed**, and
   writes the resulting chunks into the **Moss** `knowledge` index, tagged with your `user_id`.
4. **View** your prepared 1040 — the `/return` page renders the PDF via a presigned GET
   that is derived server-side from your authenticated id (you only ever see your own return).
5. **Talk.** On `/call`, a **LiveKit** voice agent joins the room. It answers questions by
   retrieving from Moss (`search_knowledge`), cites tax law from a dedicated `taxcode` index
   (`search_taxcode`), remembers per-user facts (`remember_fact` / `recall_facts`), and
   refuses to invent numbers or uncited tax law — handing off concerns to a human CPA instead.

> **Privacy by design:** the return contains SSN/income, so no service ever logs document
> text — only counts, ids, and latency. The agent reads pre-verified numbers; it never does
> tax math live.

---

## Sponsor stack

| Layer | Sponsor | Where it lives |
|---|---|---|
| **Ingest** — parse messy tax PDFs into chunks | **Unsiloed** | `app/agent-py/src/ingest_tax.py` |
| **Retrieve** — semantic search / per-user memory / cited tax code | **Moss** | `app/agent-py/src/agent.py`, `create_index.py` |
| **Talk** — voice transport, turn detection, STT→LLM→TTS, agent dispatch | **LiveKit** (+ Inference, Deepgram STT) | `app/agent-py/src/agent.py`, `app/frontend/app/api/token` |
| **Voice** — expressive low-latency TTS | **MiniMax** (Cartesia fallback) | `build_tts()` + `src/minimax_patch.py` |
| **Govern** — LLM gateway, PII/PHI guardrails, observability | **TrueFoundry** (optional gateway) | `build_llm()` in `agent.py` |
| **Host / storage** — document storage, presigned upload/download | **AWS S3** | `app/frontend/lib/s3.ts`, `infra/s3-setup.sh` |
| Auth (identity seam) | Clerk | `app/frontend/middleware.ts`, `api/token` |
| Tax-extraction LLM | Qwen via Alibaba DashScope | `app/frontend/.env.example`, `build_llm()` |
| Optional talking head | Simli / Tavus | `build_avatar()` in `agent.py` |

A full system diagram and the design rationale live in
**[`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md)**.

---

## Architecture

```
Browser ──Clerk auth──┐
   │ presign+upload    │ LiveKit room (voice)
   ▼                   ▼
  S3  ──► Ingest svc ──► Unsiloed ──► Moss ◄── LiveKit voice agent (STT→LLM→TTS)
                                       ▲              │
                                  taxcode/knowledge   └─► MiniMax TTS / TrueFoundry LLM gateway
```

The detailed ASCII system design — every hop, trust boundary, and which sponsor owns each
edge — is in [`architecture/ARCHITECTURE.md`](architecture/ARCHITECTURE.md).

---

## Repository layout

```
.
├── app/                      # ← the product (everything you run lives here)
│   ├── frontend/             # Next.js 15 (App Router) + Clerk + LiveKit React
│   │   ├── app/              # routes: /, /upload, /return, /call, /api/*
│   │   ├── lib/s3.ts         # presigned upload/download helpers
│   │   └── package.json
│   ├── agent-py/             # Python LiveKit voice agent (uv-managed)
│   │   ├── src/agent.py      # the Assistant + tools + STT/LLM/TTS wiring
│   │   ├── src/ingest_service.py   # FastAPI: POST /ingest (S3 → Unsiloed → Moss)
│   │   ├── src/ingest_tax.py       # Unsiloed parse → Moss knowledge index
│   │   ├── src/create_index.py     # build the knowledge / memory / taxcode indexes
│   │   ├── knowledge.json    # seed RAG corpus
│   │   ├── taxcode.json      # cited US tax-law corpus
│   │   └── pyproject.toml
│   └── package.json          # root scripts: setup / dev / moss:index / test …
├── architecture/             # system-design docs + ASCII diagrams
├── infra/s3-setup.sh         # idempotent S3 bucket provisioner
└── docs/                     # per-sponsor deep-dives (MOSS, LIVEKIT, UNSILOED, …)
```

> Note: most top-level Markdown files (HACKATHON-BRIEF, PLATFORM-CAPABILITIES-DIGEST, etc.)
> are hackathon research notes. **The shippable code is entirely under `app/`.**

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| **Node.js** | ≥ 22 | frontend |
| **pnpm** | ≥ 10 | monorepo package manager (`corepack enable` or `npm i -g pnpm`) |
| **uv** | latest | Python env + runner for the agent (`curl -LsSf https://astral.sh/uv/install.sh \| sh`) |
| **AWS CLI** | v2 | configured with the `moss-hackathon` SSO profile for local S3 access |
| **LiveKit CLI** *(optional)* | ≥ 2.15 | `brew install livekit-cli` — docs + SIP management |

Accounts / keys you'll need: **LiveKit Cloud**, **Moss**, **Unsiloed**, **Clerk**, and
(optional) **MiniMax**, **Qwen/DashScope**, **TrueFoundry**, **Simli/Tavus**.

---

## Configuration (environment variables)

Two env files drive the app. `pnpm setup` copies the `.env.example` templates to
`.env.local`; fill in the blanks. **Never commit `.env.local`** (it's gitignored).

### `app/agent-py/.env.local` (the voice agent + ingest service)

| Variable | Required | Notes |
|---|---|---|
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | ✅ | LiveKit Cloud project |
| `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY` | ✅ | Moss auth |
| `MOSS_INDEX_NAME` / `MOSS_MEMORY_INDEX_NAME` / `MOSS_TAXCODE_INDEX_NAME` | – | default `knowledge` / `memory` / `taxcode` |
| `UNSILOED_API_KEY` | ✅ | PDF parsing |
| `AWS_PROFILE`, `AWS_REGION`, `S3_UPLOAD_BUCKET` | ✅ | local dev resolves creds from the SSO profile |
| `AGENT_INGEST_SECRET` | ✅ | shared secret guarding `POST /ingest` — **must match the frontend** |
| `TTS_PROVIDER` | – | `minimax` (default) or `cartesia` |
| `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID` | – | needed for the MiniMax voice; falls back to Cartesia if unset |
| `LLM_BASE_URL`, `LLM_API_KEY`, `TRUEFOUNDRY_GUARDRAILS` | – | route the LLM through the TrueFoundry gateway with PII/PHI redaction |
| `QWEN_API_KEY` / `QWEN_MODEL` | – | direct Qwen (Alibaba DashScope) LLM path |
| `SHOW_AVATAR`, `AVATAR_PROVIDER`, `SIMLI_*` / `TAVUS_*` | – | optional talking head (voice-only by default) |

### `app/frontend/.env.local` (the Next.js app)

| Variable | Required | Notes |
|---|---|---|
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | ✅ | mints the room access token |
| `AGENT_NAME` | ✅ | `agent-py` — explicit dispatch to the Python agent |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | ✅ | set by `clerk init`; lands in `.env.local` |
| `AWS_PROFILE`, `AWS_REGION`, `S3_UPLOAD_BUCKET` | ✅ | for presigned upload/download |
| `AGENT_INGEST_URL` | ✅ | where the FastAPI ingest service is reachable (`http://localhost:8000`) |
| `AGENT_INGEST_SECRET` | ✅ | **must match** `agent-py/.env.local` |
| `QWEN_API_KEY`, `QWEN_MODEL`, `QWEN_BASE_URL` | – | tax-extraction LLM |

---

## One-time setup

Run everything from the **`app/`** directory.

```bash
cd app

# 1. Install all deps (frontend via pnpm, agent via uv) and scaffold .env.local files
pnpm setup

# 2. Fill in app/agent-py/.env.local and app/frontend/.env.local (see tables above)

# 3. Provision the S3 bucket (idempotent — safe to re-run)
AWS_PROFILE=moss-hackathon ../infra/s3-setup.sh

# 4. Build the Moss indexes (knowledge + memory + taxcode) from the seed corpora
pnpm moss:index

# 5. (demo) Ingest the prepared 1040 so the agent has something to talk about.
#    Place the PDF at agent-py/data/tax_return.pdf (or set TAX_PDF_PATH), then:
uv --directory agent-py run src/ingest_tax.py
```

---

## Running locally

One command runs the **agent**, the **ingest service**, and the **frontend** together:

```bash
cd app
pnpm dev
```

| Process | Port | Command (if you want them separately) |
|---|---|---|
| Next.js frontend | `http://localhost:3000` | `pnpm dev:frontend` |
| FastAPI ingest service | `http://localhost:8000` | `pnpm dev:ingest` |
| LiveKit voice agent | connects out to LiveKit Cloud | `pnpm dev:agent-py` |

Then open **http://localhost:3000**, sign in, upload a document, and start a call.

**Test the agent without a browser** (text/voice in the terminal):

```bash
cd app
pnpm agent:py:console     # interactive console mode (uses DEFAULT_USER_ID = user_1)
```

---

## The end-to-end user flow

```
/ (landing) ──► sign-in (Clerk) ──► /upload ──► /return (view 1040) ──► /call (talk)
                                       │                                   │
                          presign + S3 upload                    LiveKit room + agent
                                       │                                   │
                          POST /ingest (FastAPI)              search_knowledge / search_taxcode
                                       │                          recall_facts / remember_fact
                          Unsiloed parse → Moss knowledge index
```

Identity is one Clerk `userId`, all the way through: it scopes the S3 prefix, the Moss
`user_id` filter, and the LiveKit dispatch metadata — so a user can only ever read or hear
back **their own** documents. Misconfigured dispatch metadata fails *closed* (the agent
retrieves nothing rather than another user's return). See `resolve_user_id()` in `agent.py`.

---

## Testing & linting

```bash
cd app

pnpm test                 # frontend (vitest) + agent (pytest)
pnpm test:frontend        # vitest only
pnpm test:agent-py        # pytest only
pnpm --dir frontend test:e2e   # Playwright e2e

pnpm lint                 # ruff (agent) + next lint (frontend)
pnpm format               # prettier + ruff format
```

The agent's offline unit suite covers ~96% of `src/` and is gated at 95%
(`uv --directory agent-py run pytest --cov=src`). Network-bound LLM evals are marked
`eval` and excluded by default — run them with `uv --directory agent-py run pytest -m eval`.
See [`app/agent-py/TESTING.md`](app/agent-py/TESTING.md).

> When changing agent behavior (instructions, tools, workflows), use **TDD** — write the
> test first. See [`app/agent-py/AGENTS.md`](app/agent-py/AGENTS.md).

---

## Deployment

- **Agent:** `app/agent-py/Dockerfile` builds the LiveKit worker (entrypoint `src/agent.py`).
  Deploy to LiveKit Cloud / any container host; provide the same env vars as `.env.local`.
- **Frontend:** standard Next.js build — `pnpm --dir frontend build` then `pnpm start:frontend`.
- **S3:** `infra/s3-setup.sh` prints a least-privilege IAM policy to attach for non-local deploys.
- **Ingest service:** run `src/ingest_service.py` as a long-lived FastAPI process reachable at
  `AGENT_INGEST_URL`.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Agent never joins the room | `AGENT_NAME` in the frontend must equal the agent's registered name (`agent-py`). |
| Agent uses a robotic voice | MiniMax creds missing → it fell back to Cartesia. Set `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID`. |
| `POST /ingest` returns 401 | `AGENT_INGEST_SECRET` differs between the two `.env.local` files. |
| `/return` shows 404 | No prepared 1040 ingested for this user yet — run the ingest step (or upload). |
| S3 access denied locally | Refresh the SSO session: `aws sso login --profile moss-hackathon`. |
| Agent "refuses to answer" a tax question | By design — `search_taxcode` found no citation above threshold, so it offers a CPA hand-off instead of inventing one. |

---

Built with Moss, LiveKit, Unsiloed, MiniMax, TrueFoundry, and AWS.
See `docs/` for per-sponsor deep-dives and `architecture/` for the full system design.
