# LiveKit Coverage Audit

**Report audited:** `/Users/anirudh/Desktop/yc-mosshack/docs/LIVEKIT.md`
**Ground truth index:** `/Users/anirudh/Desktop/yc-mosshack/raw/livekit-llms.txt` (667 page lines)
**Depth source:** `/Users/anirudh/Desktop/yc-mosshack/raw/livekit-llms-full.txt`
**Date:** 2026-06-05

## Buckets
- **COVERED** — clearly represented with the key facts/code.
- **PARTIAL** — mentioned but missing a key detail, param, or example.
- **OMIT** — out of scope per policy (video/egress/ingress/recording, mobile/React/Swift/Android component reference, raw WebRTC, dashboards/billing). Noted + counted, not transcribed.
- **MISS** — in-scope but genuinely absent. These are the gaps that matter.

The report is a single 764-line battle-pack tightly focused on the voice-AI agent subset. It is excellent on the "happy path" (quickstart, AgentSession, turns/VAD/interruptions, tools, RAG/Moss, telephony, deploy, Inference, plugins). Gaps cluster in: structured workflows/tasks, the testing/eval framework, observability/metrics API, multimodality (text/vision), and a few reference pages.

---

## Introduction / Understanding LiveKit

| Page | Bucket | Note |
| --- | --- | --- |
| Overview / About LiveKit | COVERED | §1 one-paragraph + 3-layer model. |
| Coding agent support | PARTIAL | Docs MCP server mentioned in passing (§7); the `lk`/coding-agent doc-tooling angle not called out. Low value. |
| LiveKit 101 video / Community | OMIT | Marketing/community links. |
| Basics overview | COVERED | §1, §9. |
| LiveKit CLI (intro/basics/cli) | COVERED | §3, §13, §16 (`lk` commands). |
| LiveKit Cloud (intro/cloud) | COVERED | §1, §11, §13. |
| Connecting to LiveKit | COVERED | §9 (token, dispatch). |
| Rooms, participants & tracks (overview + rooms/participants/tracks mgmt) | COVERED | §9. |
| Webhooks & events (intro/basics) | MISS | Server-side room/participant webhooks (e.g. `room_started`, `participant_joined`) not covered. In-scope-adjacent (useful for call lifecycle/triggering). Medium. |
| Building AI agents (intro/basics/agents) | COVERED | §1, §9. |
| Recipes / Room service API | PARTIAL | Recipes referenced; Room service API mentioned via `RoomServiceClient` but no method list. |

---

## Build Agents — Get Started

| Page | Bucket | Note |
| --- | --- | --- |
| Introduction (agents.md) | COVERED | §1. |
| Voice AI quickstart | COVERED | §3, §4 verbatim agent file. Strong. |
| Agent Builder | PARTIAL | Named in §0-equiv? No — **not mentioned**. No-code browser builder absent. Low (you're coding). |
| Agent Console | COVERED | §3, §13 (console/dev modes). |
| Agent Embed Widget | PARTIAL | "Web Embed widget" named in §9; no script-tag snippet/embed detail. Low. |
| Prompting guide | PARTIAL | §4 instructions string shows the style; the dedicated prompting best-practices guide (voice formatting rules, goal/persona structure) not distilled. Medium. |

---

## Build Agents — Multimodality

| Page | Bucket | Note |
| --- | --- | --- |
| Multimodality overview | PARTIAL | Implied via vision recipe R6; no dedicated treatment. |
| Speech & audio overview | COVERED | §6 (audio pipeline). |
| Audio customization (TTS cache, pronunciation, volume) | PARTIAL | "Cache fixed phrases" in §15; pronunciation maps / `tts_node` SSML / volume control **not** covered. Medium. |
| Background audio | PARTIAL | Recipe R-level mention; `BackgroundAudioPlayer`, `BuiltinAudioClip.OFFICE_AMBIENCE/KEYBOARD_TYPING`, `ambient_sound`/`thinking_sound` API **absent**. Medium — great demo polish ("thinking sounds"). |
| Wakeword detection | MISS | `livekit-wakeword` lib, ONNX/openWakeWord, client-side trigger phrase — entirely absent. Low/Medium (hands-free + Pi demos). |
| Text & transcriptions | PARTIAL | Transcripts via events covered; text-only sessions, `text_input`/`transcription_node`, `text_transforms.replace()` not covered. Medium. |
| Modality-aware instructions | MISS | Different system prompts for voice vs text (`Instructions` object) — absent. Low. |
| Vision overview / Images / Video | PARTIAL | R6 covers screen-share + frame sampling + `send_file`; no `video_sampler`, image-in-context API, or per-turn frame injection code. Medium for vision co-pilot track. |

---

## Build Agents — Logic & Structure

| Page | Bucket | Note |
| --- | --- | --- |
| Logic overview | COVERED | §5–§8. |
| Agent sessions (logic/sessions) | COVERED | §5 thorough — lifecycle, userdata, say/generate_reply, events. Plus `session.interrupt()/clear_user_turn()/commit_user_turn()` partially (only interrupt in §6 footgun). |
| Chat context | COVERED | §8 (ChatContext, add_message, initial ctx). `update_chat_ctx` persist nuance only lightly noted. |
| Tasks & task groups | MISS | `AgentTask`, `TaskGroup`, inline tasks, typed results — **absent**. The report treats prebuilt tasks as objects but never explains the task/TaskGroup primitive. Medium-High (structured data capture is a core Lead-Gen/Support pattern). |
| Workflows | MISS | The multi-agent workflow model (handoffs + tasks for repeatable, accurate flows) — **absent** as a concept. Handoffs are mentioned in tools (§7) but the workflow framing/guide is missing. Medium-High. |
| Supervisor pattern | MISS | Central agent routing to specialist tasks while keeping control — absent. Medium. |
| Tools overview | COVERED | §7. |
| Function tools (definition) | COVERED | §7 Python + Node, docstring=desc, type hints=schema, ToolError. Strong. |
| Toolsets | MISS | `Toolset`, `MCPToolset`, `ToolSearchToolset`/`ToolProxyToolset`, dynamic tool discovery — absent. Low/Medium. |
| Async tools | PARTIAL | §7 mentions "AsyncToolset handles progress"; no `@function_tool` async/background API, progress updates detail. Medium. |
| MCP | PARTIAL | §7 one-liner (agent as MCP client + Moss MCP). No `mcp_servers=[...]` config, `MCPServerHTTP/Stdio`. Medium. |
| Forwarding to frontend | COVERED | §7 + §9 RPC forwarding. |
| Tool loop design | PARTIAL | §7 "be specific / keep fast" advice; the dedicated design guide not distilled. Low. |
| Pipeline nodes & hooks | PARTIAL | `on_user_turn_completed` covered deeply (§8); the full node set (`stt_node`, `llm_node`, `tts_node`, `transcription_node`, `realtime_audio_output_node`) **not** enumerated. Medium. |
| Turns overview | COVERED | §6. |
| Turn detector model | COVERED | §6 MultilingualModel/EnglishModel. |
| Adaptive interruption handling | COVERED | §6 (backchanneling). |
| Silero VAD plugin | COVERED | §6, §4 (`silero.VAD.load()`, download-files). |
| Turn-taking tuning | COVERED | §6 endpointing min/max, preemptive, server VAD knobs. Strong; `resume_false_interruption`/`false_interruption_timeout` only implied. |
| Agents & handoffs | PARTIAL | Handoff return-tuple covered (§7); the handoff guide (chat-ctx transfer, `on_enter`) not fully distilled. Medium. |
| External data & RAG | COVERED | §8 + §10 — the centerpiece. Excellent. |
| Fallback strategies | PARTIAL | §11 shows `fallback=[...]` inline on inference; the actual `stt/llm/tts.FallbackAdapter(...)` plugin API **not** shown by name. Medium (the report's snippet syntax may not match current API). |

---

## Build Agents — Testing & evaluation

| Page | Bucket | Note |
| --- | --- | --- |
| Testing overview | MISS | Behavioral testing / TDD for agents — **absent**. Medium. |
| Test framework | MISS | `AgentSession` test mode, assertions, `mock_tools`, multi-turn tests, **LLM judges** (`task_completion_judge`, `handoff_judge`, `JudgeGroup.evaluate`), pytest + CI — entirely absent. Medium (judges reward reliability; "we tested it" is a credibility win). |

---

## Build Agents — Prebuilt components

| Page | Bucket | Note |
| --- | --- | --- |
| Prebuilt tasks overview | PARTIAL | Tasks named as objects in §12/recipes; no usage pattern (`TaskGroup.add`, `InstructionParts` persona/extra customization). Medium. |
| GetName/GetEmail/GetAddress/GetDOB/GetPhoneNumber/GetCreditCard/GetDtmf/WarmTransfer | PARTIAL | GetEmailTask, GetPhoneNumberTask, GetDtmfTask, WarmTransferTask named in tracks/recipes. GetName/GetAddress/GetDOB/GetCreditCard not listed; no per-task signature/validation behavior. Medium — these are turnkey for Lead-Gen/Support data capture. |
| Prebuilt tools overview | COVERED | §7/§12. |
| EndCallTool | COVERED | §12. |
| send_dtmf_events | COVERED | §12. |

---

## Build Agents — Agent Server

| Page | Bucket | Note |
| --- | --- | --- |
| Server overview | COVERED | §13. |
| Startup modes | COVERED | §13 console/dev/start. |
| Server lifecycle | PARTIAL | Dispatch/register flow in §9/§13; job registration/request flow not detailed. Low. |
| Agent dispatch | COVERED | §9 (RoomAgentDispatch) + §13 (explicit AgentDispatchService). |
| Job lifecycle | PARTIAL | `ctx.connect()`, `ctx.shutdown()`, `wait_for_participant` used; entrypoint/JobContext lifecycle not formally explained. Low/Medium. |
| Server options | PARTIAL | `AgentServer`/`WorkerOptions`/`ServerOptions` shown in code; option fields (num_idle, load_fnc, prewarm) not enumerated except prewarm. Low. |

---

## Build Agents — Models

| Page | Bucket | Note |
| --- | --- | --- |
| Models overview | COVERED | §11. |
| Pipeline types | PARTIAL | STT-LLM-TTS vs realtime covered throughout; "half-cascade" architecture term and the explicit comparison table not surfaced. Low/Medium. |
| LiveKit Inference | COVERED | §11 (no-keys, string IDs, voice IDs). Strong. |
| LLM overview + 30 LLM plugin pages | PARTIAL | OpenAI/Gemini/AWS/xAI/Groq/Anthropic/etc named (§11); only the pattern (`inference.LLM`/plugin install) is shown, not per-provider params. Acceptable — long-tail provider pages are reference. Anthropic Claude plugin specifically only named generically. |
| STT overview + 34 STT plugin pages | PARTIAL | Deepgram/AssemblyAI/ElevenLabs/etc named; per-provider params not transcribed (reference long tail). |
| TTS overview + 42 TTS plugin pages | PARTIAL | Cartesia/ElevenLabs/MiniMax/Deepgram/Rime named with voice IDs; MiniMax has full param block (§11). Others pattern-only. |
| Custom voices | COVERED | §11 (voice clone across Inference TTS). |
| Realtime overview + plugins (OpenAI/Gemini Live/Nova Sonic/xAI/Azure/Phonic/Ultravox/PersonaPlex) | COVERED | §4 realtime variant + §6 + §11. OpenAI/Gemini/Nova Sonic/xAI covered; Phonic/Ultravox/PersonaPlex named only. |
| Virtual avatar overview + 14 avatar plugins | PARTIAL | Tavus/LemonSlice via recipes; avatar `AvatarSession`/`.start()` API not shown. Mostly OMIT-adjacent (video output). Low. |

---

## Build Agents — Partner spotlight (OpenAI/Google/Azure/AWS/xAI/Groq/Cerebras)

| Page | Bucket | Note |
| --- | --- | --- |
| All partner overview pages | COVERED | §11 covers the providers; partner "overview" pages are aggregations of model pages already addressed. |

---

## Build Agents — Reference

| Page | Bucket | Note |
| --- | --- | --- |
| Agents framework (Python/Node API ref) | OMIT | Auto-generated API reference index. |
| Turn handling options | PARTIAL | Many fields used in §6; full `EndpointingOptions`/`InterruptionOptions`/`PreemptiveGenerationOptions` field list not reproduced. Medium (it's the canonical knobs ref). |
| Events and error handling | PARTIAL | Key session events tabled in §5; full event catalog (`speech_created`, `function_tools_executed`, error events) and error-handling patterns not complete. Medium. |
| Agent dispatch service API | COVERED | §13 (`create_dispatch`). |
| LiveKit CLI (reference) | COVERED | §3/§13/§16. |
| Inference LLM parameters | MISS | Full param ref (temperature, max_tokens, parallel_tool_calls, extra_kwargs, etc.) — only `parallel_tool_calls` hinted in full docs; report has none. Low/Medium. |

---

## Agent Frontends

| Page | Bucket | Note |
| --- | --- | --- |
| Frontends intro / React quickstart | COVERED | §9 (frontends list, useVoiceAssistant). |
| Starter apps (React/SwiftUI/Android/Flutter/RN/Web embed) | PARTIAL | All named in §9; React/Next.js emphasized. Mobile starters OMIT-adjacent. |
| Building frontends overview | COVERED | §9. |
| Session management (frontends/build/sessions) | PARTIAL | Token/connect covered; frontend Session API lifecycle not detailed. Low. |
| Authentication (overview/token-server/endpoint/custom) | COVERED | §9 token mint + sandbox token server. |
| Agent state | COVERED | §5 agent_state_changed + §9. |
| Realtime media and data (frontend) | COVERED | §9 (text/byte/RPC handlers). |
| Virtual avatars (frontend) | PARTIAL | Named; OMIT-adjacent (video). |
| Agents UI Components (overview/media-controls/visualizers/chat) | PARTIAL | §9 "Agents-UI Shadcn components" one-liner; component list not detailed. Acceptable (mostly reference). |
| Tokens & grants reference | COVERED | §9 VideoGrants/AccessToken; full grant field list not exhaustive. |
| LiveKit/UI/Server API reference indexes | OMIT | Auto-gen reference indexes. |

---

## Telephony

| Page | Bucket | Note |
| --- | --- | --- |
| Telephony intro | COVERED | §12. |
| Phone numbers | COVERED | §12 ("buy numbers through LiveKit"). |
| SIP trunk setup | COVERED | §12. |
| Provider quickstarts (Twilio/Telnyx/Plivo/Wavix/Sinch) | PARTIAL | All 5 named; per-provider trunk config steps not transcribed (reference). |
| Connectors (overview/WhatsApp/Twilio) | COVERED | §12 (WhatsApp + Twilio connectors named). |
| Features overview | COVERED | §12. |
| DTMF | COVERED | §12 + prebuilt tools. |
| Answering machine detection | COVERED | §12 — `AMD` context manager, categories, branch. Strong. |
| Region pinning | COVERED | §12. |
| Transfers (overview/cold/warm) | COVERED | §12 warm + cold (SIP REFER). |
| HD voice / Secure trunking | COVERED | §12 named. |
| Accepting calls (overview/workflow/inbound-trunk/dispatch-rule/inbound-twilio) | COVERED | §12 inbound trunk + dispatch rule. |
| Making calls (overview/workflow/outbound-trunk/outbound-calls) | COVERED | §12 `create_sip_participant` full snippet. Strong. |
| Testing your setup | PARTIAL | §15 "dial your demo number"; the `lk sip` test-call flow not detailed. Low. |
| SIP reference (primer/participant/handshake/codecs/phone-numbers-api/sip-api/connectors-api/troubleshooting) | PARTIAL | Concepts covered functionally; SIP API method ref and codec negotiation specifics OMIT-adjacent reference. Low. |

---

## WebRTC Transport

| Page | Bucket | Note |
| --- | --- | --- |
| Transport intro / SDK platform quickstarts | OMIT (mostly) | Raw WebRTC + mobile SDK quickstarts out of scope. React quickstart covered in §9. |
| Media (camera/mic, screenshare, subscribe, raw tracks, noise/echo, codecs) | PARTIAL | Screen-share (R6) + noise cancellation (§6) covered; rest OMIT (video/media plumbing). |
| Egress / Ingress (all pages) | OMIT | Recording/streaming — explicitly out of scope. ~13 pages. |
| **Data overview** | COVERED | §9. |
| **Sending text (text-streams)** | COVERED | §9 `send_text` + `registerTextStreamHandler`. Core Co-Pilot move. |
| **Sending files & bytes (byte-streams)** | COVERED | §9 `send_file` + byte-stream handler. |
| **Remote method calls (RPC)** | COVERED | §9 `register_rpc_method` / `performRpc`. |
| Data tracks | MISS | Low-latency `publish_data`/data-track API (distinct from streams) — absent. The report uses streams; data tracks/packets not mentioned. Low/Medium for high-frequency context push. |
| Data packets | MISS | Low-level packet API — absent. Low. |
| State sync (participant attributes / room metadata) | COVERED | §9 (attributes + room metadata). |
| Encryption (overview/start/E2EE with agents) | MISS | E2EE for agents — absent. Low (nice-to-have for a regulated-data demo). |
| Self-hosting (all) | PARTIAL | §13 self-host alt (`livekit-server --dev`, remove Cloud-only plugins). Deeper k8s/VM/multi-region OMIT-adjacent. |
| Transport reference (SDKs/Egress API/Ingress API) | OMIT | Reference + out-of-scope services. |

---

## Manage & Deploy

| Page | Bucket | Note |
| --- | --- | --- |
| Deploy intro | COVERED | §13. |
| Agent deployment overview | COVERED | §13. |
| Quickstart (deploy) | COVERED | §13 `lk agent create`. |
| Deployment management | COVERED | §13 (`lk agent` commands). |
| Secrets management | COVERED | §13. |
| Logs | COVERED | §13. |
| Log drains | COVERED | §13 (Datadog/CloudWatch/Sentry/New Relic/Splunk/syslog). |
| Builds and Dockerfiles | PARTIAL | §13 says it generates Dockerfile; build-process/Dockerfile-template detail not deep. Low. |
| Self-hosted deployments | COVERED | §13 self-host + AWS ECS/EKS/Fargate. |
| Observability overview | COVERED | §13. |
| Insights in LiveKit Cloud | COVERED | §13 (recordings/transcripts/traces). |
| Data hooks | PARTIAL | §13 names "data hooks"; the **metrics API** (`MetricsCollectedEvent`, `metrics.log_metrics`, `session.usage`, EOU/STT/LLM/TTS/Interruption metrics) **absent**. Medium (metrics = a strong "we measured latency" demo proof). |
| Administration (admin/regions/region-pinning/agent-deployment/sandbox/firewall/quotas/billing/analytics-api) | PARTIAL/OMIT | Sandbox + multi-region agent deploy covered (§9/§13); quotas/billing/firewall/analytics-api OMIT (dashboards/billing). |
| Deploy reference (CLI/Server APIs/events/SFU) | PARTIAL | CLI covered; SFU internals OMIT. |

---

## Reference (Developer tools, framework, SDKs, internals, migrations, recipes)

| Page | Bucket | Note |
| --- | --- | --- |
| Reference overview / Recipes index | PARTIAL | Recipes woven into §12/§14; full recipe index not reproduced (fine). |
| Developer tools — LiveKit CLI (projects/agent/docs commands) | COVERED | §3/§13/§16. |
| Docs MCP server | PARTIAL | Mentioned via MCP (§7). Low. |
| Agents framework Python/Node API ref | OMIT | Auto-gen API ref. |
| Turn handling options / Events / Dispatch API / Inference LLM params | See "Build Agents — Reference" above | PARTIAL/MISS. |
| LiveKit SDKs (JS/Swift/Android/Flutter/RN/Unity/Node/Rust/C++/Python/Go) | OMIT | SDK reference indexes (mobile/native out of scope). |
| UI Components (Agents-UI/React/SwiftUI/Android/Flutter) | OMIT | Component reference indexes. |
| Server APIs (Go/Node/Ruby/Kotlin/Python/PHP) | OMIT | Server SDK reference indexes. |
| Internals (SFU / Signaling protocol) | OMIT | Raw WebRTC internals. |
| Telephony reference (primer/participant/handshake/codecs/sip-api/phone-numbers-api/troubleshooting) | PARTIAL | See Telephony section. |
| Migration guides (v0→v1 Node/Python, v1→v2 SDK) | PARTIAL | §4/§15 note the two API styles (AgentServer vs WorkerOptions) — the practical migration fact. Full migration guides not reproduced. Low. |
| Other — Room service API | PARTIAL | `RoomServiceClient`/`api.LiveKitAPI()` named (§9); method list absent. Low. |
| Egress/Ingress API & examples | OMIT | Out of scope. |

---

## Recipes (29 hosted `.md` recipes + ~30 GitHub examples)

| Page | Bucket | Note |
| --- | --- | --- |
| Quickstart voice agents (all platforms) | COVERED | §3/§9. |
| Advanced LLM (context vars, interrupt user, content filters, LLM output replacement, LLM/STT/TTS/VAD metrics, MCP agent, structured output, RPC+state) | PARTIAL | RAG/context-injection (§8/§10), RPC+state (§9), MCP (§7), content-filter pattern (R-level) touched; metrics recipes + LLM-output-replacement (strip chain-of-thought before TTS) not covered. Medium (CoT-strip is a real realtime gotcha). |
| Voice processing (push-to-talk, uninterruptable, change language, transcriber, keyword detection, pipeline/TTS translator, toggle audio, echo) | PARTIAL | Push-to-talk (manual turn), uninterruptable (`allow_interruptions=False`), multilingual (R5) covered; transcriber-only/translator recipes not. Medium. |
| Telephony recipes (IVR navigator, company directory, recording consent, make_call, sip_lifecycle, answer_call, survey_caller) | COVERED | §12/§14 reference IVR, Company Directory, Survey Caller, Recording Consent. Strong. |
| Audio recipes (background audio, TTS comparison, playing audio, repeater, speedup) | PARTIAL | Background audio + cache covered conceptually; `BackgroundAudioPlayer` API absent (see Multimodality). |
| Realtime data (LivePaint) | COVERED | R3 Co-Pilot is exactly this pattern. |
| Vision (Gemini vision assistant) | PARTIAL | R6. |
| Robotics / VR / C++ examples | OMIT | Out of scope (physical AI / niche). |
| Agent workflows (medical triage, healthcare, personal shopper, restaurant, drive-thru, front-desk) | PARTIAL | Conceptually echoed in §14 recipes; the multi-agent workflow examples themselves not walked through (ties to the Workflows/Tasks MISS). Medium. |
| Tool use (Moviefone) / RAG (LlamaIndex) | PARTIAL | RAG covered via Moss; LlamaIndex integration not. Low. |
| Metrics (realtime model metrics) | MISS | RealtimeModelMetrics capture/summary — absent (ties to metrics MISS). Low/Medium. |
| Virtual avatars (Tavus/LemonSlice) | PARTIAL | Named; video-output, low priority. |

---

## React Components / Android Components / Agents-UI component reference

| Page | Bucket | Note |
| --- | --- | --- |
| 77 React hooks + 44 React components | OMIT | Component API reference — out of scope (useVoiceAssistant/useDataChannel/useRpc functionally referenced in §9). ~121 pages. |
| 16 Agents-UI component pages | OMIT | Shadcn component reference — out of scope (overview referenced §9). |
| Android components (install/concepts/samples) | OMIT | Mobile component reference — out of scope. ~9 pages. |

---

# Gaps to patch (in-scope, ranked)

**High / Medium-High**
1. **Workflows + Tasks + TaskGroup + Supervisor pattern** (`agents/logic/workflows`, `tasks`, `supervisor-pattern`). The report has handoffs-via-tools but never explains the `AgentTask`/`TaskGroup` primitive or the workflow model. This is the canonical way to build reliable multi-step Lead-Gen/Support flows and underpins the prebuilt tasks. Add: inline task definition, `TaskGroup.add(...)`, typed task results, when to use supervisor vs handoff.
2. **Prebuilt tasks usage** (`prebuilt/tasks/*`). Report names a few task objects but not how to run them: `from livekit.agents.beta.workflows import GetEmailTask, TaskGroup`, `InstructionParts(persona=, extra=)` customization, and the full set (GetName/GetAddress/GetDOB/GetCreditCard in addition to Email/Phone/DTMF/WarmTransfer). These are turnkey structured-data capture — high demo ROI.
3. **Testing & evaluation framework** (`start/testing`, `testing/test-framework`). Entirely absent: `AgentSession` test mode, `mock_tools`, multi-turn assertions, and **LLM judges** (`task_completion_judge`, `handoff_judge`, `JudgeGroup.evaluate()` tagging sessions as `lk.judge.<name>` in Cloud), pytest/CI. "We tested + measured" is a credibility win with judges.

**Medium**
4. **Metrics / observability API** (`deploy/observability/data`, recipes/metrics_*). Missing `MetricsCollectedEvent`, `metrics.log_metrics(ev.metrics)`, `session.usage` (note: `UsageCollector`/`UsageSummary` deprecated), and EOU/STT/LLM/TTS/Interruption metrics. Enables a live latency/cost readout demo.
5. **Fallback API specifics** (`logic/fallback-strategies`). Report shows `inference.STT(..., fallback=[{...}])`; the documented API is `stt.FallbackAdapter([...])` / `llm.FallbackAdapter` / `tts.FallbackAdapter`. Verify which is current and show the adapter form (Python + Node).
6. **Pipeline nodes set** (`logic/nodes`). Only `on_user_turn_completed` is covered. Enumerate `stt_node`, `llm_node`, `tts_node`, `transcription_node`, `realtime_audio_output_node` (override points for caching, volume, content filtering, CoT-stripping).
7. **Background audio API** (`multimodality/audio/background-audio`). `BackgroundAudioPlayer(ambient_sound=AudioConfig(BuiltinAudioClip.OFFICE_AMBIENCE), thinking_sound=...)`, `.start(room, agent_session)`, `.play(...)`. Thinking-sound during slow RAG/tool calls is a strong UX/demo touch.
8. **Audio customization** (`multimodality/audio/customization`): pronunciation maps, SSML, `text_transforms.replace()`, agent speech volume via `tts_node`.
9. **Text & transcriptions** (`multimodality/text`): text-only sessions, `text_input`, modality-aware instructions — relevant for the Co-Pilot text path and chat fallback.
10. **Turn handling options reference** (`reference/agents/turn-handling-options`): the canonical `EndpointingOptions`/`InterruptionOptions`/`PreemptiveGenerationOptions` field lists, plus `resume_false_interruption`/`false_interruption_timeout`.
11. **Events & error handling reference** (`reference/agents/events`): full event catalog (`speech_created`, `function_tools_executed`, error events) for robust handling.
12. **MCP / Async tools / Toolsets** (`logic/tools/mcp`, `async`, `toolsets`): `MCPToolset`/`mcp_servers=[...]` config, true async/background tool API with progress, dynamic tool discovery. Moss ships an MCP server, so the MCP wiring is directly relevant.
13. **Webhooks & events (server)** (`intro/basics/rooms-participants-tracks/webhooks-events`): room/participant webhooks for call-lifecycle triggers and CRM logging.

**Low**
14. Vision API depth (`multimodality/vision/images`,`video`): `video_sampler`, image-in-context API.
15. Data tracks / data packets (`transport/data/data-tracks`,`packets`): low-latency alternative to streams for high-frequency context push.
16. Wakeword (`multimodality/audio/wakeword`): `livekit-wakeword`/openWakeWord for hands-free.
17. Inference LLM parameters reference (temperature/max_tokens/parallel_tool_calls/extra_kwargs).
18. E2EE with agents (`transport/encryption/agents`).
19. Agent Builder / Embed widget snippet, Prompting guide distillation.
20. Pipeline types "half-cascade" framing + comparison table.

---

# Intentionally omitted (out of scope per policy)

- **Egress / Ingress** (recording, composite/track/auto egress, outputs, custom templates, encoders, transcoding, Egress/Ingress APIs & examples) — ~16 pages.
- **Video/media plumbing** (camera & mic publish, subscribe, raw tracks, codecs & advanced, screenshare reference) — partial OMIT (screenshare + noise cancellation kept).
- **React component reference** — 77 hooks + 44 components = 121 pages.
- **Agents-UI component reference** — 16 pages.
- **Android components reference** — ~9 pages.
- **Native/mobile SDK quickstarts & reference** (Swift/Android/Flutter/RN/Unity/Expo/C++/Rust/Go/Ruby/Kotlin/PHP SDK index pages, SDK platform quickstarts) — ~25+ pages.
- **Self-hosting infra deep-dives** (k8s, VM, distributed multi-region, ports/firewall, benchmarks, self-hosted egress/ingress/sip-server) — kept the "self-host alt" summary, omitted infra reference.
- **Raw WebRTC internals** (SFU, signaling/client protocol).
- **Dashboards / billing / quotas / firewall / analytics API** (deploy/admin billing, quotas-and-limits, firewall, analytics-api).
- **Robotics / VR / physical-AI recipes** (rover teleop, pan-tilt, VR spatial video, C++ examples, Pi transcriber kept-ish via wakeword note).
- **Marketing/community** (LiveKit 101 video, community resources).

---

# Coverage summary (in-scope subset)

Approx in-scope distinct topics (collapsing the long-tail provider/recipe pages into their overview, since the report's strategy of "name the pattern, list providers" is the right altitude for those):

- The report **fully covers** the spine: quickstart, full agent file, AgentSession, turns/VAD/interruptions/tuning, function tools, external-data/RAG, Moss integration, rooms/participants/data-channels, telephony/SIP end-to-end, deployment, Inference + plugin model, and a strong gotchas/cheat-sheet.
- It **partially covers** multimodality, prebuilt tasks, nodes, fallback, the turn-handling/events references, and metrics.
- It **misses** the structured Workflows/Tasks/Supervisor model and the entire Testing/Eval framework — the two most material in-scope gaps.

The provider long-tail (30 LLM + 34 STT + 42 TTS + 13 realtime + 14 avatar = 133 plugin pages) is treated as PARTIAL-by-pattern, which is appropriate for a battle-pack; counting each as a full "miss" would be misleading.
