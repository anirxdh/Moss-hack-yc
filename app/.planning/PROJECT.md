# AI CPA — Moss Conversational AI Hackathon

## What This Is

A voice-first "AI CPA": you upload your financial documents, an AI agent answers
anything about them out loud, grounded in your real numbers and the tax code,
retrieved in milliseconds. Built for the Moss Conversational AI Hackathon (YC SF,
June 2026), where Moss real-time semantic search is the host and the visible hero.

## Core Value

When you ask a money question, the agent answers instantly and correctly from YOUR
documents — cited, no hallucination, no awkward pause. That is the thing only
sub-10ms retrieval makes possible.

## Requirements

### Validated

<!-- Shipped and working (V1). -->

- ✓ Ingest: Unsiloed parses a tax PDF into chunks, indexed into Moss — V1
- ✓ Retrieval: Moss `knowledge` index returns grounded snippets in ~1ms — V1
- ✓ Voice agent: LiveKit pipeline (STT/LLM/TTS) talks to the user — V1
- ✓ Grounded CPA persona: answers from docs, cites source, refuses when not in docs — V1
- ✓ Per-user memory: remember_fact / recall_facts via Moss memory index — V1 (starter)
- ✓ Frontend: Next.js "Moss AI CPA" with live Knowledge Matches panel + latency badge — V1

### Active

<!-- Current scope being built toward. -->

- [ ] MiniMax voice: agent speaks via livekit-plugins-minimax (sponsor)
- [ ] Test coverage to ~100% of our code, documented in the reference
- [ ] V2 proactive: read-only portfolio + should-I-sell after-tax math + proactive opener
- [ ] Full tax code loaded into Moss (docs x tax code — kills "why not one LLM call?")
- [ ] Multi-doc ingest (W-2 + 1099s + last year's return)
- [ ] TrueFoundry LLM gateway + PII redaction (sponsor)
- [ ] Video avatar via LiveKit (demo wow factor)
- [ ] Upload endpoint: anyone uploads a doc -> their own per-user Moss index

### Out of Scope

- Clerk auth / full multi-tenant — deferred to the very end (overkill for the demo)
- Plaid / live bank + brokerage links — V3 pitch only, not built
- Filing / e-file / binding tax advice — we explain documents, we do not file
- Mobile app — web-first for the demo

## Context

- Hackathon: Moss Conversational AI Hackathon, YC SF, ~overnight build. Top prize is
  a YC interview. Judged on Moss retrieval as the visible hero plus fundable framing.
- Repo layout: build lives in `app/` (its own git repo); the parent `moss-hack` is a
  battle-pack reference repo (docs/, raw scrapes) that gitignores `app/`.
- Built on the official `moss-hacker-starter` (LiveKit agent-starter-python +
  agent-starter-react, adapted for Moss).
- Extensive platform research already exists in `../docs` and `../raw` (Moss, LiveKit,
  MiniMax, Unsiloed, TrueFoundry). Reuse it instead of re-researching.
- The user's real tax return is already parsed + indexed; PII stays local + gitignored.
- A prior design doc: ~/.gstack/projects/anirxdh-Moss-hack-yc/anirudh-main-design-20260606-170957.md

## Constraints

- **Timeline**: hackathon overnight — working-first beats ambitious; never regress V1.
- **Thesis**: Moss retrieval stays the visible hero (latency badge + matches panel).
- **Sponsors**: use as many as natural, each visible in the demo — Unsiloed, Moss,
  LiveKit, MiniMax, TrueFoundry, AWS.
- **Tech**: Python agent (uv) at app/agent-py; Next.js (pnpm) at app/frontend; LiveKit
  Inference for STT/LLM by default; Moss SDK; keys in app/agent-py/.env.local.
- **Ops**: long-running commands (parses, model downloads, coverage) run as BACKGROUND
  jobs; target ~100% test coverage; document testing in the reference.
- **Privacy**: financial PII is never committed and never printed to logs/transcripts.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build on moss-hacker-starter | Working LiveKit+Moss loop in minutes, not a rebuild | ✓ Good |
| `knowledge` index = the tax doc | Agent's search_knowledge retrieves tax data, zero agent change | ✓ Good |
| Unsiloed accurate (not agentic) parse | Clean 48-chunk result, faster; agentic only if a number is wrong | — Pending |
| MiniMax via official livekit plugin | ~3-line swap vs a custom TTS integration | — Pending |
| Planning lives in app/.planning | Keeps product planning with the product code | — Pending |

---
*Last updated: 2026-06-06 after initialization*
