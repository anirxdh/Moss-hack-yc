# Tax It Easy — AI CPA

A voice **AI CPA** that walks a user through their prepared **Form 1040**. The
user signs in, sees their tax return rendered as a PDF, and presses **Talk to CPA
agent** to ask questions out loud. The agent answers using only the user's own
documents and the cited US tax code — never guesses — and the on-screen PDF
auto-scrolls to whatever page the agent is citing.

Built for the YC Conversational-AI hackathon. Two services:

| Service | Stack | Role |
| --- | --- | --- |
| `app/frontend` | Next.js 15 (App Router, pnpm), Clerk auth, LiveKit React SDK | Web UI: upload → S3, `/return` PDF viewer, mints LiveKit tokens |
| `app/agent-py` | Python (uv), LiveKit Agents, Moss SDK, Unsiloed | The voice agent worker **and** the document-ingestion tooling |

Grounding is powered by **[Moss](https://docs.moss.dev)** semantic search across
three indexes:

- **`knowledge`** — RAG corpus: each user's ingested 1040 (+ optional brokerage
  profile), tagged with `user_id` and queried with a per-user filter.
- **`taxcode`** — cited US tax-law corpus; the agent answers tax-law questions
  *only* from here, and refuses (rather than hallucinating) when it can't cite a
  match.
- **`memory`** — per-user agentic memory the agent can write to and recall.

---

## How it works

```
                        ┌──────────────────────── browser ────────────────────────┐
  sign in (Clerk) ─────►│ /upload  pick docs ──► S3 (presigned POST)               │
                        │          "Generate 1040" ─────────────────────► /return  │
                        │ /return  GET /api/return-doc ──► presigned S3 GET of      │
                        │          users/{userId}/return/1040.pdf ──► <iframe> PDF  │
                        │          "Talk to CPA agent" ──► POST /api/token          │
                        └───────────────────────────┬─────────────────────────────┘
                                                     │ LiveKit room + explicit
                                                     │ dispatch of agent "agent-py"
                                                     ▼
                          agent-py worker joins ──► search_knowledge (this user's 1040)
                                                    search_taxcode   (cited tax law)
                                                    moss_context event ──► PDF jumps to cited page
```

The prepared 1040 is produced **out-of-band** (a CPA prepares it) and placed in
S3 + ingested into Moss by the scripts below — the app does not compute it. The
upload step is real (documents land in S3 under the user's prefix) but is not
parsed by the app; it exists so the experience reads as "bring in your docs."

**Identity seam.** One Clerk `userId` threads through everything: the S3 key
prefix `users/{userId}/…`, the Moss `user_id` metadata, the per-user retrieval
filter, and the LiveKit dispatch metadata. A user can only ever see their own
documents and return.

---

## Prerequisites

- **[pnpm](https://pnpm.io)** and **[uv](https://docs.astral.sh/uv/)**.
- **AWS CLI** configured with a profile named `moss-hackathon` that resolves to
  account **`563683519291`** (owner of the `moss-yc-hackathon-docs` bucket,
  region `us-west-2`).
  - ⚠️ Don't run the frontend in a shell that has other AWS creds exported
    (e.g. SSO) — exported `AWS_ACCESS_KEY_ID`/`SESSION_TOKEN` override
    `AWS_PROFILE` and S3 signing fails. See [Troubleshooting](#troubleshooting).
- Accounts/keys: **Clerk**, **LiveKit Cloud**, **Moss**, **Unsiloed** (ingest only).

### Environment files

Both are gitignored. Copy the examples and fill them in:

```bash
cp app/frontend/.env.example app/frontend/.env.local
cp app/agent-py/.env.example app/agent-py/.env.local
```

**`app/frontend/.env.local`**

```ini
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_…
CLERK_SECRET_KEY=sk_…

# AWS / S3 (the Next server signs presigned URLs with this profile)
AWS_PROFILE=moss-hackathon
AWS_REGION=us-west-2
S3_UPLOAD_BUCKET=moss-yc-hackathon-docs

# LiveKit (same project as the agent)
LIVEKIT_URL=wss://<project>.livekit.cloud
LIVEKIT_API_KEY=API…
LIVEKIT_API_SECRET=…
AGENT_NAME=agent-py            # MUST equal the worker's rtc_session(agent_name=…)

# Optional — where each user's prepared 1040 lives (default shown)
# RETURN_DOC_KEY_SUFFIX=return/1040.pdf
```

**`app/agent-py/.env.local`**

```ini
# LiveKit (same project as the frontend)
LIVEKIT_URL=wss://<project>.livekit.cloud
LIVEKIT_API_KEY=API…
LIVEKIT_API_SECRET=…

# Moss
MOSS_PROJECT_ID=…
MOSS_PROJECT_KEY=…
# optional: MOSS_INDEX_NAME=knowledge  MOSS_TAXCODE_INDEX_NAME=taxcode  MOSS_MEMORY_INDEX_NAME=memory

# Unsiloed (PDF parsing — only needed when ingesting documents)
UNSILOED_API_KEY=…
```

### One-time install + index build

```bash
# install deps
pnpm --dir app/frontend install
uv --directory app/agent-py sync

# build the Moss indexes (knowledge + memory + taxcode) — run ONCE
uv --directory app/agent-py run src/create_index.py
```

`create_index.py` seeds `knowledge` and `memory` from `app/agent-py/knowledge.json`
and the static `taxcode` corpus from `app/agent-py/taxcode.json`. Per-user 1040s
are appended to `knowledge` later by the ingest step below.

---

## Uploading artifacts to S3

The `/return` viewer loads a per-user object at
**`users/{clerkUserId}/return/1040.pdf`** (key derived server-side from the
signed-in user). So the prepared 1040 must be uploaded under that exact prefix.

**Find the user's Clerk id** (the one they sign in as) — Clerk dashboard → Users,
or via the API:

```bash
SK=$(grep ^CLERK_SECRET_KEY= app/frontend/.env.local | cut -d= -f2-)
curl -s "https://api.clerk.com/v1/users?order_by=-created_at&limit=5" \
  -H "Authorization: Bearer $SK" | python3 -m json.tool | grep -E '"id"|email_address'
```

**Upload the 1040** to that user's prefix (set `--content-type` so it renders
inline in the viewer):

```bash
aws s3 cp "/path/to/their-1040.pdf" \
  "s3://moss-yc-hackathon-docs/users/<clerkUserId>/return/1040.pdf" \
  --content-type application/pdf \
  --profile moss-hackathon
```

> The `/api/return-doc` route HEAD-checks the object and returns a short-lived,
> inline presigned GET URL; if the object is missing it returns 404 and the
> viewer shows "Could not load your tax document."

---

## Ingesting to Moss

So the **agent** can ground on the 1040 (and the PDF can auto-scroll to cited
pages), ingest the *same* file into the `knowledge` index under the *same* user.
`INGEST_USER_ID` must equal the signed-in Clerk id.

```bash
INGEST_USER_ID=<clerkUserId> \
uv --directory app/agent-py run src/ingest_tax.py "/path/to/their-1040.pdf"
```

This runs **Unsiloed** (OCR + table extraction) → markdown chunks →
`knowledge` index, each chunk tagged with `user_id` and carrying its page number
(which powers the cited-page auto-scroll). It prints **counts only**, never
document text. On success:

```
DONE. upserted=N chunks=M smoke_hits=K — index 'knowledge' now holds user '<id>' doc 'tax_return'.
```

Re-running is safe — chunk ids are namespaced by `(user_id, doc_id)` and upsert
in place rather than duplicating.

**Optional — brokerage profile** (adds portfolio context to the same user's
`knowledge`):

```bash
INGEST_USER_ID=<clerkUserId> \
uv --directory app/agent-py run src/ingest_robinhood.py [path/to/portfolio.json]
```

---

## Launch (frontend + agent)

Two terminals.

**1. Frontend (Next.js)** — start in a shell with no stray AWS creds so the S3
presign uses `moss-hackathon`:

```bash
cd app/frontend
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
aws sts get-caller-identity            # must print Account 563683519291
node_modules/.bin/next dev --turbopack # or: pnpm dev
```

**2. Agent worker (LiveKit)**:

```bash
uv --directory app/agent-py run src/agent.py dev   # use `start` for non-reloading
```

Then open **http://localhost:3000**, sign in, and go to **`/return`**. Press
**Talk to CPA agent**; the `agent-py` worker joins the room within a second or two.

> One-shot alternative from `app/` (also boots the optional ingest HTTP service):
> `pnpm install && pnpm dev`.

### Try these questions

- Easy: *"What's my total income?"*, *"Do I owe or get a refund?"*, *"What was my standard deduction?"*
- Harder: *"Walk me through how my tax on line 16 was calculated."*, *"Do I owe the Net Investment Income Tax? Cite the rule."*
- Refusal test (won't hallucinate): *"What's the tax treatment of a like-kind crypto exchange?"* → it should decline to cite.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| **"Could not load your tax document"** | Next server's AWS creds resolve to the wrong account (exported SSO creds overriding `AWS_PROFILE`) → per-user `HeadObject` fails → 404 | `unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN`; `aws sts get-caller-identity` must show `563683519291`; restart `next dev`. Confirm the object exists at `users/{signedInUserId}/return/1040.pdf`. |
| **"Session ended · Agent did not join the room"** | `AGENT_NAME` missing/mismatched → the frontend dispatches an empty agent name, but the worker only answers to `agent-py` | Set `AGENT_NAME=agent-py` in `frontend/.env.local`, restart `next dev`. Ensure the worker is running and on the **same** `LIVEKIT_URL`. |
| **PDF downloads instead of displaying** | object lacks an inline disposition | The presign forces `inline` + `application/pdf`; re-upload with `--content-type application/pdf`. |
| **Agent answers generically / no citations** | the 1040 wasn't ingested for this user, or `INGEST_USER_ID` ≠ the signed-in id, or indexes weren't created | Run `create_index.py` once, then re-ingest with the correct `INGEST_USER_ID`. |
| **Ingest fails: `UNSILOED_API_KEY missing` / `MOSS_… missing`** | agent `.env.local` incomplete | Fill `UNSILOED_API_KEY`, `MOSS_PROJECT_ID`, `MOSS_PROJECT_KEY`. |

---

## Tests

```bash
# frontend — typecheck + unit tests
cd app/frontend && node_modules/.bin/tsc --noEmit && node_modules/.bin/vitest run

# agent-py — pytest with a 95% coverage gate
uv --directory app/agent-py run pytest --cov=src

# lint / format
pnpm --dir app/frontend lint
uv --directory app/agent-py run ruff check .
```
