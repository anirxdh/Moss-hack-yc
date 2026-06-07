# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-06)

**Core value:** Instant, cited answers from your own financial docs (sub-10ms Moss retrieval).
**Current focus:** Phase 3 — Proactive Tax-Aware V2 (next)

## Status

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| 1 | MiniMax Voice | ✓ Done | build_tts; MiniMax single-segment patch; Cartesia fallback; build_llm Qwen-ready |
| 2 | Test Hardening (~100%) | ✓ Done | 46 offline tests, ~96.5% coverage, gate 95%, TESTING.md + AGENTS.md note |
| 3 | Proactive Tax-Aware V2 | ○ Next | proactive opener + should-I-sell math + full tax code + multi-doc |
| 4 | TrueFoundry Governance | ○ Pending | LLM gateway + PII (build_llm ready) |
| 5 | Video Avatar | ○ Pending | needs avatar provider key |
| 6 | Upload Endpoint | ○ Pending | FastAPI + per-user index |
| 7 | Deploy + Demo | ○ Pending | needs AWS / LiveKit Cloud |

## Log

- 2026-06-06: Project initialized; V1 validated; 7-phase roadmap.
- 2026-06-06: Phase 1 — MiniMax TTS (build_tts, voice_id, MINIMAX_GROUP_ID); single-segment patch (minimax_patch.py) for the multi-sentence crash; Cartesia fallback via TTS_PROVIDER. build_llm env-configurable (Qwen via provider or gateway).
- 2026-06-06: Repo unified — app/ folded into Moss-hack-yc main (single branch).
- 2026-06-06: Phase 2 — test hardening: +pytest-cov; tests for ingest_tax, create_index, ingest_robinhood main, Moss tools, voice, llm; 46 offline tests; ~96.5% coverage (gate 95%); fast/eval split; integration glue pragma'd; TESTING.md + AGENTS.md note.

---
*Last updated: 2026-06-06 after Phase 2*
