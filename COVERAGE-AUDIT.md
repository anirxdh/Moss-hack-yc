# COVERAGE-AUDIT.md — Master Documentation Coverage Audit

**Project:** YC Mosshack 2026 battle-pack (`/Users/anirudh/Desktop/yc-mosshack`)
**Date:** 2026-06-05
**What this is:** A per-platform audit of the `docs/*.md` field guides against the raw documentation dumps in `raw/`, plus a record of which gaps were patched back in. Five platforms audited: Moss, LiveKit, TrueFoundry (AI Gateway), MiniMax, Unsiloed.

---

## 1. Executive Verdict

| Platform | Index pages | In-scope coverage % | Real gaps found | Gaps patched | Intentionally omitted | Final verdict |
| --- | --- | --- | --- | --- | --- | --- |
| **Moss** (host) | 117 | **98.3%** | 3 (1 MED, 2 LOW) | **1** (the MED) | 2 (nav/landing, trivial type alias) | Near-complete, high-fidelity. The host platform — every endpoint, SDK, integration, and the voice stack is covered. |
| **LiveKit** | 667 | **89%** | 37 in-scope (2 MED-High, ~11 MED, rest LOW) | **13** (all HIGH/MED) | ~335 (egress/video/component refs/mobile SDKs) | Strong voice-AI battle-pack. Owned the whole happy path; the two material gaps (Workflows/Tasks, Testing/Eval) are now patched. |
| **TrueFoundry** | 651 | **97.6%** | 7 (2 HIGH, 3 MED, 2 LOW) | **5** (2 HIGH + 3 MED) | ~361 (platform admin, ML serving, infra, most REST) | Accurate, high coverage of the AI Gateway subset. Cache + session-header gaps that blocked two demos are now patched. |
| **MiniMax** | 128 | **90%** | 8 (2 MED, 6 LOW/trivial) | **8** (both MED + cheap LOWs) | ~50 (Token Plan billing, Mintlify meta, legal, essays) | Audio + LLM core essentially complete. Both MED gaps (Responses API, prompting/TTS tip) patched. |
| **Unsiloed** | 30 (+5 specs) | **100%** | 5 (all LOW) | **0** (none met the HIGH/MED bar) | 6 (empty index + 5 JSON spec artifacts) | Effectively complete. All 30 doc pages represented; remaining items are depth nuances, intentionally left out. |

### Did we get literally everything? — Honest answer

**No — and that was the point.** We got everything that matters for building a voice-AI hackathon project at 2 AM, and we deliberately skipped the rest. Here's the straight version:

- **Moss and Unsiloed are essentially complete** (98–100%). For these two you can treat the docs as the source of truth — every endpoint, parameter, and SDK is captured. The only Moss miss was one pricing-table row, now filled. Unsiloed had zero HIGH/MEDIUM gaps at all.
- **TrueFoundry and MiniMax are near-complete on their in-scope subset** (~97% / ~90%). The "missing" pages are overwhelmingly out-of-scope by design: TrueFoundry's ~360 omitted pages are Kubernetes/ML-serving/SSO/platform-admin infra a voice team will never touch; MiniMax's ~50 omitted pages are subscription billing ("Token Plan"), legal, and research essays. The genuinely in-scope gaps that existed have been patched.
- **LiveKit is the one with real breadth left on the table** (89%), but for a defensible reason: of its 667 index pages, ~335 are out of scope (video egress/ingress recording, 121 React component reference pages, mobile SDK references, raw WebRTC internals). The voice-agent spine was fully covered, and the two genuinely material gaps — the structured **Workflows/Tasks** model and the entire **Testing/Evaluation** framework — have now been patched in.

**Bottom line:** Across all five platforms, every HIGH and MEDIUM in-scope gap the audit found has been patched. What remains uncovered is (a) low-importance depth nuances we judged not worth the bloat, and (b) large blocks of intentionally out-of-scope material (infra, billing, video recording, component-by-component SDK references). If you want any of that, it's all sitting in the `raw/*-llms-full.txt` dumps — see §8.

**Net patched this pass:** 27 in-scope HIGH/MEDIUM gaps filled across Moss (1), LiveKit (13), TrueFoundry (5), MiniMax (8). Unsiloed needed none.

---

## 2. Moss — host platform

**Reports:** `docs/MOSS.md` (now incl. audit appendix) + `docs/MOSS-API-REFERENCE.md`
**Audit:** `audit/moss.md` · **Raw:** `raw/moss-llms.txt`, `raw/moss-llms-full.txt`

### Fully covered
All 12 Control Plane HTTP endpoints (addDocs/deleteDocs/getDocs, init-upload, start-build, job-status, index CRUD); all 11 integration adapters (LiveKit, VAPI, ElevenLabs, Agora, Pipecat, DSPy, LangChain, Vercel AI SDK, Next.js, VitePress, MCP server); all 6 SDKs (JS, Python, Swift, C, Elixir, Browser/WASM); the CLI; the managed Voice Agents stack (Agent SDK, Backend SDK, Agent CLI, 15-min JWT); every build/integrate concept guide (hybrid search, metadata filtering incl. `$near`, multi-index, sessions, storage/persistence, parsing, retrieval, custom embeddings); errors; and pricing. Endpoints, params, defaults, and runnable code were spot-checked against the raw dump and matched.

### Patched in (audit-driven)
- **Pricing — "Sync Engine" tier row (MEDIUM).** The one in-scope MEDIUM gap. Added the missing row to `docs/MOSS.md §13` (Developer –, Hobbyist Standard, Startup Standard, Enterprise Dedicated, PAYG –), quoted verbatim from `raw/moss-llms-full.txt` line 4393, with a note that it powers the §14 auto-refresh hot-swap demo. Added under a new `## Appendix — Coverage Completion` section.

### Intentionally omitted — and why
- **`RefreshResult` / `JobProgress` JS+Python interface stubs (LOW).** The auto-refresh *behavior* and the `onProgress` callback are both documented; only the field-level return-type structs are not enumerated. Per the HIGH/MEDIUM-only patch rule, left out.
- **Changelog per-version enumeration (LOW).** Load-bearing changelog facts (beta.14 2,300→10ms, multi-index v1.1.0) are cited; the exhaustive JS/Python/CLI/Portal version history is summarized, not enumerated.
- **Elixir/Swift `Types` reference pages (LOW).** Struct/enum listings shown implicitly via code examples rather than as standalone field tables (cross-SDK type identity is stated).
- **`Docs` index landing page, `ISODate` type alias** — no unique technical facts.

---

## 3. LiveKit — voice-AI agent framework

**Report:** `docs/LIVEKIT.md` (764 → 1094 lines after appendix)
**Audit:** `audit/livekit.md` · **Raw:** `raw/livekit-llms.txt`, `raw/livekit-llms-full.txt`

### Fully covered
The voice-AI spine: <10-min quickstart, a verbatim STT-LLM-TTS agent file (Python + Node), AgentSession lifecycle/events/userdata, turn detection / VAD / interruptions / tuning (incl. preemptive generation and realtime server-VAD knobs), function tools, the external-data/RAG context-injection pattern, the full Moss × LiveKit recipe, rooms/participants/data-channels (text/byte/RPC streams), end-to-end telephony/SIP (inbound trunk + dispatch, outbound `create_sip_participant`, AMD, warm/cold transfer), one-command deployment, LiveKit Inference + the plugin model, and a gotchas/cheat-sheet.

### Patched in (audit-driven) — all 13 in-scope HIGH/MEDIUM gaps
Added as a single `## Appendix — Coverage Completion` section (A1–A13), every fact quoted from the local raw dump:
- **A1** Workflows + Tasks + TaskGroup + Supervisor pattern (the canonical multi-step Lead-Gen/Support model) — *the #1 material gap*.
- **A2** Prebuilt tasks (full 8-task table + `InstructionParts`).
- **A3** Testing & evaluation (RunResult assertions, 8 LLM judges, `JudgeGroup`, `lk.judge.<name>` Cloud tagging, `mock_tools`) — *the #2 material gap*.
- **A4** Metrics/observability API (`MetricsCollectedEvent`/`session.usage`, EOU/LLM/STT/VAD metric fields).
- **A5** Fallback adapters (`stt/llm/tts.FallbackAdapter`) — corrects the report's earlier inline-fallback syntax.
- **A6** Pipeline nodes & hooks · **A7** Background audio (`BackgroundAudioPlayer`/`BuiltinAudioClip`) · **A8** Audio customization (`text_transforms.replace`, SSML, volume) · **A9** Text & transcriptions · **A10** Turn-handling options reference · **A11** Events & error handling (`ErrorEvent.recoverable`, `CloseEvent`) · **A12** MCP/Async tools/Toolsets · **A13** Server webhooks.

### Intentionally omitted — and why (out-of-scope categories you can pull from raw)
- **Egress / Ingress** (recording, composite/track/auto egress, transcoding) — ~16 pages. Not voice-agent build path.
- **React component reference** — 77 hooks + 44 components = 121 pages. (The handful actually used — `useVoiceAssistant`, `useDataChannel` — are referenced functionally.)
- **Agents-UI Shadcn component reference** (~16 pages) and **Android components** (~9 pages).
- **Native/mobile SDK quickstarts & references** (Swift/Android/Flutter/RN/Unity/Expo/C++/Rust/Go/Ruby/Kotlin/PHP) — ~25+ pages.
- **Raw WebRTC internals** (SFU, signaling protocol), **self-host infra deep-dives** (k8s/VM/multi-region), **dashboards/billing/quotas/firewall/analytics**, **robotics/VR/physical-AI recipes**, marketing/community pages.
- **Provider long-tail** — 30 LLM + 34 STT + 42 TTS + 13 realtime + 14 avatar = 133 plugin reference pages, handled "name the pattern, list the providers" rather than per-page (the right altitude for a battle-pack).
- **Low-priority depth nuances intentionally not patched:** vision API depth (`video_sampler`), data tracks/packets, wakeword (`livekit-wakeword`), Inference LLM param reference, E2EE with agents, Agent Builder/Embed widget snippets, "half-cascade" pipeline framing.

---

## 4. TrueFoundry — AI Gateway

**Report:** `docs/TRUEFOUNDRY.md` (604 lines + appendix)
**Audit:** `audit/tf.md` · **Raw:** `raw/tf-llms.txt`, `raw/tf-llms-full.txt`
**Scope:** AI Gateway subset only (unified OpenAI-compatible API, routing, virtual keys, rate/budget limits, observability, guardrails/PII, prompt mgmt, fallbacks, semantic cache, MCP, LiveKit). The other ~360 pages are ML-serving/infra/admin.

### Fully covered
On the ~95 load-bearing gateway-core pages, coverage is excellent and verbatim-accurate: every spot-check (LiveKit code block, routing config YAML, request/response header tables, request logging, PII guardrail, virtual models, rate & budget limiting, model discovery, native SDKs, rerank path) matched the source — exact defaults, header names, and status-code lists. The ~150 near-identical provider/exporter/guardrail/framework integration pages are summarized collectively (name the vendors + the one shared `provider_account/model` pattern), which is the correct editorial call.

### Patched in (audit-driven) — 5 in-scope HIGH/MEDIUM gaps
Added as a single `## Appendix — Coverage Completion` section, all values verbatim from `raw/tf-llms-full.txt`:
- **A1 — Caching ON: `x-tfy-cache-config` header (HIGH).** `type`/`similarity_threshold` (start 0.9)/`ttl`/`namespace` params, isolation levels, curl, response headers. *Was unactionable; now demoable for the voice-FAQ recipe.*
- **A2 — Session Management: `X-TFY-CONVERSATION-ID` header (HIGH).** UUID5 recommendation + Python snippet. *Unblocks the multi-turn Co-Pilot recipe.*
- **A3 — Compaction + count-tokens endpoints (MEDIUM):** `POST /responses/compact`, `POST /messages/count_tokens`.
- **A4 — Live/Realtime API depth (MEDIUM):** `wss://{GATEWAY_HOST}/live/{providerAccountName}`, providers, OpenAI realtime voice code.
- **A5 — MCP server setup auth types (MEDIUM):** 7-method table, Shared vs Individual credentials, OAuth2 flow, Manager/User roles.

### Intentionally omitted — and why
- **3 LOW gaps not patched:** trace/metrics query APIs (`fetch-request-logs`/`fetch-model-metrics`/`feedback-for-traces` — dashboard-level is enough for a demo), access-control role names, cost-tracking public-pricing config.
- **~200 platform/infra/ML pages** (out of scope): all `platform/` SSO+SCIM+RBAC+control-plane+self-host-deploy; Jobs/Services/Workflows/Spark/autoscaling/CI-CD/GitOps; model deployment & serving (LitServe/FastAPI/HF/MLflow/NIM/registry/finetune/GPU/TPU); cloud control planes; git/secret/notification integrations.
- **~120 of 191 `api-reference/` endpoints** (applications, clusters, jobs, mlrepos, model-deployments, scim-v2, secrets, teams, users, workspaces, etc.).
- **Agent Harness deep internals** (context-engineering, skills/agent registry) and **per-page integration walkthroughs** (~150 repetitive "add this provider" pages).

---

## 5. MiniMax — TTS / voice / LLM / music / video

**Report:** `docs/MINIMAX.md` (424 lines + appendix)
**Audit:** `audit/mm.md` · **Raw:** `raw/mm-llms.txt`, `raw/mm-llms-full.txt`
**Scope:** TTS, voice cloning/design, speech, LLM/chat (incl. Anthropic-compatible + caching), music, video, async/multimodal.

### Fully covered
The entire audio stack is near-100%: TTS sync HTTP (`/v1/t2a_v2`), streaming WebSocket (with verbatim reference code), async long-form, voice cloning, voice design, voice management — all with correct endpoints, params, constraints, pricing, and rate limits (every RPM/TPM number verified exact). LLM coverage is strong: Anthropic-compatible + OpenAI-compatible chat, explicit prompt caching (`cache_control`), M3 multimodal, tool-use / interleaved thinking. Music, video (all four modes + Video Agent), image, and files all covered.

### Patched in (audit-driven) — 8 gaps (both MEDIUM + cheap LOW/trivial)
Added as a single `## Appendix — Coverage Completion` section, verbatim from `raw/mm-llms-full.txt`:
- **A1 — OpenAI Responses API (MEDIUM):** `POST /v1/responses` + `/v1/responses/input_tokens`, `input` shorthand, `reasoning:{"effort":"none"}` M3-disable.
- **A2 — M-series prompting best practices (MEDIUM):** incl. the verbatim **"your response will be read aloud by a text-to-speech model… plain text only, short sentences"** tip — directly useful for voice agents — and the "task at the end" long-context rule.
- **A3** model-discovery endpoints · **A4** Vercel AI SDK provider (M2.x-only; `minimax` vs `minimaxOpenAI`) · **A5** local self-host (vLLM/SGLang/MLX) · **A6** image-token `detail` heuristic · **A7** Video Agent template query · **A8** Music CONN=20 concurrency cap.

### Intentionally omitted — and why
- **Audit gap #7 (camera-motion `[pan]/[zoom]/[static]` syntax) — not patched:** genuinely absent from the local dump and only LOW importance, so not fabricated. (8 of 9 listed gaps patched; both MEDIUMs fully covered.)
- **Token Plan ecosystem (~20 pages):** subscription billing + AI-coding-tool config (Claude Code/Cursor/TRAE/Codex/etc.). The report uses the pay-as-you-go API path.
- **Mintlify doc-authoring meta (6), AI-tool doc setup (3), account/legal/FAQ (8), research essays (3), solutions/cookbook tutorials (5), China spec (1).**

---

## 6. Unsiloed — document parsing / extraction / classification

**Report:** `docs/UNSILOED.md`
**Audit:** `audit/uns.md` · **Raw:** `raw/uns-llms.txt`, `raw/uns-llms-full.txt`

### Fully covered
All 30 human-readable doc pages represented — 29 fully, 1 (Element Types) partially. Every endpoint (`/parse` v1/v2/v3, `/v2/extract`, `/classify`, `/splitter`, `/org/get_usage`), the dual auth scheme (`api-key` vs `X-API-Key`), the non-uniform status vocabularies, request/response JSON shapes, the ~25-field parse param table, JSON-schema strict-mode rules, processing-mode presets, and the Claude tool schemas are all transcribed accurately, with raw spot-checks confirming fidelity (no fabricated facts).

### Patched in
**Nothing — and that's correct.** The auditor rated **all 5 gaps as LOW importance** with **zero HIGH/MEDIUM in-scope gaps**. Per the HIGH/MEDIUM-only patch rule, the right action was to append nothing. Two representative gaps (`Cancelled` parse status at raw lines 1823/2131; `Page` segment type at 2234/2975) were verified real but left out as below the bar. Patching LOW-importance depth nuances would have violated the stay-focused guidance.

### Intentionally omitted — and why
- **5 LOW depth nuances** (none a missing endpoint or page): the `Page` segment type, the `Cancelled` parse status, per-segment field quirks (Signature has no `content`/`image`; Formula returns LaTeX in `$...$`; Picture/Signature md/html are AI descriptions), two v3 batch response fields (`source_url`/`pdf_count`), and the Splitting industry-category crib.
- **6 machine artifacts:** the empty `index.md` landing entry + 5 JSON spec/fixture files (`openapi-v1/v2/v3.json`, `openapi.json`, `sample_spec.json`) — their substance is reflected narratively through the endpoint sections.

---

## 7. Patch ledger (what changed this pass)

| Platform | File edited | Gaps filled | Section added |
| --- | --- | --- | --- |
| Moss | `docs/MOSS.md` | 1 (Sync Engine pricing row, MED) | `## Appendix — Coverage Completion` |
| LiveKit | `docs/LIVEKIT.md` | 13 (all HIGH/MED) | `## Appendix — Coverage Completion` (A1–A13) |
| TrueFoundry | `docs/TRUEFOUNDRY.md` | 5 (2 HIGH + 3 MED) | `## Appendix — Coverage Completion` (A1–A5) |
| MiniMax | `docs/MINIMAX.md` | 8 (2 MED + 6 LOW/trivial) | `## Appendix — Coverage Completion` (A1–A8) |
| Unsiloed | none | 0 (no HIGH/MED gaps) | none — report already complete |

---

## 8. If you want even more

Everything intentionally omitted above lives in the raw `llms-full` dumps. If a track needs one of these areas, pull the page directly:

- **LiveKit video / recording / mobile / components** → `raw/livekit-llms-full.txt`. Search for: `egress`, `ingress`, React hooks (`useTrackToggle`, etc.), `swift`/`android`/`flutter` SDK pages, `e2ee`/encryption, `wakeword`, `video_sampler` (vision depth), data-tracks/data-packets, raw WebRTC/SFU internals.
- **TrueFoundry platform / infra / ML serving** → `raw/tf-llms-full.txt`. Search for: `platform/` (SSO/SCIM/RBAC/control-plane/self-host), `jobs`/`workflows`/`spark`/`autoscaling`, `model-deployment`/`litserve`/`finetune`, the ~120 unlisted `api-reference/` endpoints, `fetch-request-logs`/`fetch-model-metrics`/`feedback-for-traces` query APIs, access-control role names, cost-tracking pricing config.
- **MiniMax subscription / coding-tool ecosystem** → `raw/mm-llms-full.txt`. Search for: `token-plan/*` (billing + Claude Code/Cursor/TRAE/Codex setup), `web_search`/`understand_image` MCP tools, research essays (`m2-full-attention`, `m2-reasoning`), the `[pan]/[zoom]/[static]` camera syntax (note: not present in this dump — check live docs), full Video Agent template catalog.
- **Moss low-priority type stubs** → `raw/moss-llms-full.txt`. Search for: `RefreshResult`, `JobProgress`, the per-version changelog history, and the Elixir/Swift `Types` reference pages.
- **Unsiloed depth nuances** → `raw/uns-llms-full.txt`. Search for: `Page` segment type (line ~2234), `Cancelled` status (line ~1823), Signature/Formula/Picture per-segment quirks, v3 batch `source_url`/`pdf_count`, the Splitting "Common Categories" industry taxonomy.

The per-platform audit files in `audit/` (`moss.md`, `livekit.md`, `tf.md`, `mm.md`, `uns.md`) contain the full page-by-page COVERED/PARTIAL/MISSED/OMITTED tables if you want the exhaustive accounting behind any number above.
