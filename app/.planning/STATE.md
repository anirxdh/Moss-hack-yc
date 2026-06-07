# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-06)

**Core value:** Instant, cited answers from your own financial docs (sub-10ms Moss retrieval).
**Current focus:** TrueFoundry + Tavus avatar built (need creds + live test). Phase 3 (proactive V2) skipped for now per user.

## Status

| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| 1 | MiniMax Voice | ✓ Done | default voice, working; intl endpoint (api.minimaxi.chat) + single-segment patch; Cartesia fallback |
| 2 | Test Hardening (~100%) | ✓ Done | 59 offline tests, ~96.9% coverage, gate 95%, TESTING.md; CI on push & PR |
| 3 | Proactive Tax-Aware V2 | ○ Skipped | deferred per user (the demo "winner"; revisit later) |
| 4 | TrueFoundry Governance | ◑ Built | gateway + PII guardrail via build_llm (openai plugin); feature-flagged; needs TF key + live test |
| 5 | Video Avatar (Tavus) | ◑ Built | build_avatar toggle (AVATAR_PROVIDER=tavus); voice-only fallback; needs Tavus creds + live test |
| 6 | Upload Endpoint | ○ Pending | FastAPI + per-user index |
| 7 | Deploy + Demo | ○ Pending | needs AWS / LiveKit Cloud |

## Log

- 2026-06-06: Project initialized; V1 validated; 7-phase roadmap.
- 2026-06-06: Phase 1 — MiniMax TTS (build_tts, voice_id, MINIMAX_GROUP_ID); single-segment patch (minimax_patch.py) for the multi-sentence crash; Cartesia fallback via TTS_PROVIDER. build_llm env-configurable (Qwen via provider or gateway).
- 2026-06-06: Repo unified — app/ folded into Moss-hack-yc main (single branch).
- 2026-06-06: Phase 2 — test hardening: +pytest-cov; 46 offline tests; ~96.5% coverage (gate 95%); fast/eval split; integration glue pragma'd; TESTING.md + AGENTS.md note.
- 2026-06-06: MiniMax no-audio FIXED — root cause was the stock plugin's CHINA endpoint (api.minimax.chat returns HTTP 200 + zero audio for international accounts). Patch now targets api.minimaxi.chat (MINIMAX_BASE_URL override). MiniMax is now the DEFAULT voice (Cartesia fallback). Live eval added as a regression guard.
- 2026-06-06: CI — root-level .github/workflows/ci.yml (ruff + tests + 95% gate) on push to main AND every PR. First run green.
- 2026-06-06: Phase 4 (TrueFoundry) BUILT — build_llm gains an OpenAI-compatible gateway path (livekit-plugins-openai): LLM_BASE_URL + LLM_API_KEY + LLM_MODEL route every call through the gateway; TRUEFOUNDRY_GUARDRAILS sends X-TFY-GUARDRAILS for PII/PHI redaction (input+output); metadata + ttft headers optional. Same path serves the Qwen swap. Feature-flagged. Tests + skipped live eval. Needs TF creds for live test.
- 2026-06-06: Phase 5 (Tavus avatar) BUILT — build_avatar() toggle (AVATAR_PROVIDER=tavus) via livekit-plugins-tavus; avatar.start before session.start per LiveKit docs; degrades to voice-only if creds missing/unknown provider. 59 offline tests, 96.9% coverage. Needs TAVUS_API_KEY + replica/persona + live test.

---
*Last updated: 2026-06-06 — Phases 4 & 5 built (TrueFoundry + Tavus)*
