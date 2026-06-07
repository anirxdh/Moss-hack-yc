# Roadmap: AI CPA

**Created:** 2026-06-06
**Phases:** 7 | **Granularity:** coarse

> V1 (ingest + retrieval + voice agent + CPA persona + frontend) is already built and
> validated. These phases extend it. Each phase is independently demo-able, so if time
> runs out the project still tells a complete story. Phases are ordered by hackathon
> priority: must-do first (voice + tests), the winner next (proactive V2), then the
> sponsor-sweep + wow + productization.

## Phases

### Phase 1: MiniMax Voice
**Goal:** The CPA speaks with a MiniMax voice (sponsor visible), no regression.
**Requirements:** VOICE-01, VOICE-02, VOICE-03
**Success criteria:**
1. The agent's spoken audio is produced by MiniMax TTS (livekit-plugins-minimax).
2. Voice/model selectable via env, with a warm professional default.
3. STT, turn detection, barge-in, and the moss_context panel still work.
4. A unit test for the TTS wiring passes and the agent boots clean.

### Phase 2: Test Hardening to ~100%
**Goal:** Lock the foundation — comprehensive tests, a coverage gate, reference docs.
**Requirements:** TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success criteria:**
1. ingest_tax.py unit-tested (submit/poll/chunk-mapping) with mocked HTTP.
2. Moss tools + MiniMax wiring unit-tested; evals (grounding/refusal/greeting) pass.
3. pytest-cov reports ~100% on our code; a threshold gates the suite.
4. TESTING.md + an AGENTS.md note document the suite and how to run it.

### Phase 3: Proactive Tax-Aware Second Opinion (V2 — the winner)
**Goal:** The agent opens with money you didn't know, and does after-tax math, grounded.
**Requirements:** PROA-01, PROA-02, PROA-03, PROA-04, PROA-05
**Success criteria:**
1. Read-only mock portfolio with cost basis + holding period.
2. "Should I sell?" returns correct short-vs-long-term after-tax math + a harvest idea.
3. On connect, the agent proactively surfaces N findings it "already found".
4. Answers draw on your docs x a full tax-code corpus in Moss (multi-index).
5. Multi-doc ingest (W-2 + 1099 + prior return) into the knowledge index.

### Phase 4: TrueFoundry Governance
**Goal:** Route the LLM through TrueFoundry with PII redaction (sponsor visible).
**Requirements:** GOV-01, GOV-02
**Success criteria:**
1. LLM calls go through the TrueFoundry gateway (one governed endpoint).
2. PII (SSN, etc.) is redacted/guarded on the financial-data path.
3. No latency or quality regression in the demo flow.

### Phase 5: Video Avatar
**Goal:** A talking-head avatar speaks the agent's responses (demo wow).
**Requirements:** AVTR-01, AVTR-02
**Success criteria:**
1. An avatar provider is chosen with rationale (latency/cost/quality).
2. The avatar video renders in the frontend and lip-syncs the agent.
3. Avatar is a toggle; voice-only still works if it fails (demo safety).

### Phase 6: Upload Endpoint
**Goal:** Anyone uploads a doc and gets their own per-user Moss index.
**Requirements:** PLAT-01, PLAT-02
**Success criteria:**
1. A FastAPI endpoint accepts a PDF upload and runs the parse->index pipeline.
2. Each upload builds a per-user-named Moss index (no collisions).
3. The endpoint is covered by tests (mocked Unsiloed + Moss).

### Phase 7: Deploy + Demo Polish
**Goal:** It runs live for the judges, end to end.
**Requirements:** DEPL-01
**Success criteria:**
1. Agent + frontend deployed (LiveKit Cloud / AWS) and reachable.
2. The 3-minute demo runs clean: proactive opener -> grounded Q -> refusal beat.
3. A recorded backup exists in case live fails.

## Coverage

All v1 requirements mapped to exactly one phase. See REQUIREMENTS.md traceability.

---
*Last updated: 2026-06-06 after initialization*
