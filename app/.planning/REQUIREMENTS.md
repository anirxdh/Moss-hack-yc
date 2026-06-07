# Requirements: AI CPA

**Defined:** 2026-06-06
**Core Value:** Instant, cited answers from your own financial documents (sub-10ms Moss retrieval).

> V1 (ingest, retrieval, voice agent, CPA persona, frontend) is already built and
> validated — see PROJECT.md "Validated". The requirements below are the remaining
> hackathon scope.

## v1 Requirements

### Voice (MiniMax)
- [ ] **VOICE-01**: Agent speaks responses via MiniMax TTS (livekit-plugins-minimax)
- [ ] **VOICE-02**: Voice and model are configurable via env, with a warm default
- [ ] **VOICE-03**: STT, turn detection, barge-in, and the matches panel still work

### Testing
- [ ] **TEST-01**: ingest_tax.py unit-tested (submit/poll/chunk-mapping, mocked HTTP)
- [ ] **TEST-02**: MiniMax TTS wiring unit-tested (mocked)
- [ ] **TEST-03**: Moss tool unit tests retained and extended
- [ ] **TEST-04**: LLM evals for grounding, refusal, harmful-refusal, CPA greeting
- [ ] **TEST-05**: pytest-cov reports ~100% on our code, gated by a threshold
- [ ] **TEST-06**: Testing documented in the reference (TESTING.md + AGENTS.md)

### Proactive (V2)
- [ ] **PROA-01**: Read-only mock portfolio with cost basis + holding period
- [ ] **PROA-02**: "Should I sell?" after-tax math (short vs long term, harvest)
- [ ] **PROA-03**: Proactive opener surfaces N findings on connect
- [ ] **PROA-04**: Full tax-code corpus loaded into Moss (multi-index)
- [ ] **PROA-05**: Multi-doc ingest (W-2 + 1099s + prior return)

### Governance (TrueFoundry)
- [ ] **GOV-01**: LLM routed through the TrueFoundry gateway
- [ ] **GOV-02**: PII redaction/guardrail on the financial data path

### Avatar
- [ ] **AVTR-01**: Choose a LiveKit avatar provider (latency/cost/quality)
- [ ] **AVTR-02**: Avatar video renders in the frontend and lip-syncs the agent

### Platform
- [ ] **PLAT-01**: FastAPI upload endpoint: PDF -> parse -> per-user Moss index
- [ ] **PLAT-02**: Per-user index naming (multi-tenant foundation)

### Deploy
- [ ] **DEPL-01**: Agent + frontend deployed for the live demo

## v2 Requirements (deferred)

### Auth
- **AUTH-01**: Clerk authentication, per-user data scoped to Clerk identity

### Integrations
- **INTG-01**: Plaid / brokerage live links (V3 pitch)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Clerk auth now | Overkill for the demo; only needed for real multi-tenant |
| Plaid live links | V3 vision; pitch it, do not build |
| Filing / e-file | Liability; we explain docs, not file returns |
| Mobile app | Web-first for the demo |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VOICE-01..03 | Phase 1 | Pending |
| TEST-01..06 | Phase 2 | Pending |
| PROA-01..05 | Phase 3 | Pending |
| GOV-01..02 | Phase 4 | Pending |
| AVTR-01..02 | Phase 5 | Pending |
| PLAT-01..02 | Phase 6 | Pending |
| DEPL-01 | Phase 7 | Pending |

**Coverage:** all v1 requirements mapped ✓

---
*Requirements defined: 2026-06-06*
