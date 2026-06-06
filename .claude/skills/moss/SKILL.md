---
name: moss
description: Use when building anything with Moss (the real-time semantic-search retrieval runtime hosting the YC Conversational AI Hackathon 2026) — creating/loading/querying indexes, sessions, metadata filters, hybrid alpha, auto-refresh hot-swap, cross-agent handoff, PDF ingest, browser/on-device/Node/Python SDKs, or wiring Moss into a LiveKit / VAPI / ElevenLabs / Agora / Pipecat voice agent. Triggers on "moss", "@moss-dev/moss", "loadIndex", "createIndex", "MossClient", "moss session", or "retrieval for the voice agent".
---

# Moss — the retrieval hero (hackathon quick-skill)

Moss = sub-10ms **in-process** semantic search. Give it `{id, text, metadata}` docs → it builds an index → you `load` it into your process → `query` is a **local function call (~1–10ms)**, no network hop. Same API in cloud / Node / Python / browser-WASM / iOS / C / Elixir. **This is the host platform — retrieval must be the visible hero of your demo.**

> Deep references in this repo: [`docs/MOSS.md`](../../../docs/MOSS.md) (exhaustive guide + recipes) and [`docs/MOSS-API-REFERENCE.md`](../../../docs/MOSS-API-REFERENCE.md) (raw HTTP/control-plane). Strategy: [`HACKATHON-BRIEF.md`](../../../HACKATHON-BRIEF.md), [`PLATFORM-CAPABILITIES-DIGEST.md`](../../../PLATFORM-CAPABILITIES-DIGEST.md). Read those for anything not covered here.

## The one rule that breaks everyone's demo
**You MUST `loadIndex` / `load_index` (or open a `session`) BEFORE `query`.** A query runs against an *in-memory* index. Skip the load and JS/Python silently fall back to the cloud `/query` HTTP endpoint (~100–500ms) — fine for a test, **fatal for a voice latency budget**. Browser/C/Elixir/Swift throw. **Pre-load once in the agent entrypoint, never per turn.**

## Core loop (copy-paste)
```bash
npm install @moss-dev/moss     # or: pip install moss
export MOSS_PROJECT_ID=...  MOSS_PROJECT_KEY=...     # from portal.usemoss.dev
```
```python
from moss import MossClient, DocumentInfo, QueryOptions
client = MossClient(os.getenv("MOSS_PROJECT_ID"), os.getenv("MOSS_PROJECT_KEY"))
await client.create_index("faqs", docs, "moss-minilm")   # async build; SDK polls to done
await client.load_index("faqs")                          # LOAD ONCE before query
res = await client.query("faqs", "return a damaged product", QueryOptions(top_k=5, alpha=0.8))
# res.docs[i] -> {id, text, score 0-1, metadata, index_name}; res.timeTakenInMs  <-- put this on screen
```
- `createIndex` throws if the name exists → use `addDocs(..., upsert=True)` to update. Names are case-sensitive.
- Models: `moss-minilm` (fast default, 384-dim, use for voice) · `moss-mediumlm` (accuracy) · `moss-litelm` (iOS) · `custom` (BYO vectors on every doc AND query).

## The Moss wow-mechanics (pick one as your demo's "impossible-to-fake" moment)
| Mechanic | Code | The demo moment |
|---|---|---|
| **Hybrid alpha** | `QueryOptions(alpha=0.0..1.0)` (0=keyword/BM25, 1=semantic, **0.8 default**) | Never hallucinate a SKU/price (low alpha for exact IDs) |
| **Metadata filter** (local-loaded index only; **numbers as strings**) | `filter={"$and":[{"field":"plan","condition":{"$eq":"startup"}},{"field":"price","condition":{"$lt":"100"}}]}` — ops: `$eq $ne $gt $lt $in $nin $near(lat,lng,meters) $and $or` | "Within 5km, startup plan, US region" answered live — can't be faked |
| **Auto-refresh hot-swap** | `load_index("kb", auto_refresh=True, polling_interval_in_seconds=120)` | **Edit a doc/price mid-demo → agent answers the NEW fact, no restart, no dropped queries** |
| **Sessions** (real-time local memory; Python/Swift/C/Elixir — **NOT Node yet**) | `s = await client.session("call-123"); await s.add_docs([...]); await s.query(...); await s.push_index()` | Recall what the caller said 2 turns ago, instantly, no DB |
| **Dual-index per turn** | `know = await client.query("support-kb", q, ...)` + `recent = await s.query(q, ...)` → pass BOTH to LLM | Answer from the manual AND remember the conversation, both sub-10ms |
| **Multi-index** (Python; all loaded, same model) | `await client.query_multi_index(["products","crm","faqs"], q, QueryOptions(top_k=6))` → `doc.index_name` tags source | Cite 3 corpora in one breath, visibly source-tagged |
| **Cross-agent handoff** | Agent A `session(name).push_index()` → Agent B `session(name)` resumes latest | voice→web→human escalation with FULL history intact |
| **On-device / browser** | `@moss-dev/moss-web` MossClient → `createIndex`/`loadIndex`/`query` run on WASM | "Your data never left the tab" + still sub-10ms |

## Lowest-latency voice pattern (LiveKit context injection — beats tool-calling)
Inject retrieved context on **every** user turn before the LLM generates (no "should I search?" round trip):
```python
async def on_user_turn_completed(self, turn_ctx, msg):
    r = await self.moss.query(INDEX, msg.text_content, QueryOptions(top_k=5, alpha=0.8))
    if r.docs:
        turn_ctx.add_message(role="system", content="Context:\n" + "\n".join(f"- {d.text}" for d in r.docs))
    await super().on_user_turn_completed(turn_ctx, msg)
# pre-load in entrypoint: moss = MossClient(...); await moss.load_index(INDEX)
```
Drop-in adapters (each fires per user turn, answers in <10ms): `pip install vapi-moss | elevenlabs-moss | agora-moss | pipecat-moss`. MCP server: `npx @moss-tools/mcp-server`. CLI: `pip install moss-cli; moss init`.

## PDF ingest
`create_index_from_files("kb", [ParseFileInput(name="manual.pdf", content_type="application/pdf", path=...)])` — server parses+chunks+embeds. **PDF only, ≤20 files/call, no `custom` model.** Complex PDFs (tables/scans/forms) → parse with **Unsiloed** first, then `createIndex` the cleaned chunks.

## Recipes by track (full versions in docs/MOSS.md §11)
- **Support** ⭐ — Unsiloed→Moss `support-kb` (auto_refresh) + per-user `session("user-{id}")`; dual-query both per turn; `push_index` for human handoff.
- **Lead Gen** — index product/pricing/objections with `metadata` (plan/region/industry); filter per prospect; low alpha for pricing exactness; MiniMax cloned voice.
- **Co-Pilot** — LiveKit ambient room audio → `session.add_docs` every transcript turn (on-device) + `load_index` company KB → `query_multi_index` → push cards to a screen over LiveKit data channel.

## Footguns (the 2am list)
- `query` before `loadIndex` → cloud fallback (~100–500ms) or throw. **Always load first.**
- Metadata is **string→string**; write `"100"` not `100`. Filters only apply on a **loaded local** index (silently skipped otherwise).
- Mutations (`createIndex`/`addDocs`/`deleteDocs`) are **async jobs** — SDK polls; `status` must be `Ready`.
- **Node has no sessions yet** → write the live-session/handoff agent in **Python or Swift**.
- Sessions are an **Enterprise-tier** feature — confirm access early or degrade to "load cloud index + per-turn query".
- **Never ship `projectKey` to browser/mobile** — use the custom authenticator + a backend token endpoint (JS header includes `Bearer `; Swift returns the raw token).

## Vibecode it fast
Feed your AI coding tool `https://docs.moss.dev/llms.txt` at session start, or wire the Moss MCP server (`npx @moss-tools/mcp-server` with `MOSS_PROJECT_ID`/`MOSS_PROJECT_KEY`) so it can create/query indexes while coding. Portal: portal.usemoss.dev · Samples: github.com/usemoss/moss-samples · Discord: discord.gg/eMXExuafBR.
