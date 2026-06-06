# MiniMax Coverage Audit — `docs/MINIMAX.md`

**Index:** `raw/mm-llms.txt` — **128 doc pages** (111 under `## Docs`, 14 OpenAPI specs, 1 AsyncAPI spec, 1 "Optional" contact link, 1 China openapi).
**Report audited:** `docs/MINIMAX.md` (424 lines).
**Scope policy:** IN-SCOPE = TTS, voice cloning/design, speech, LLM/chat (incl. Anthropic-compatible + caching), music, video, async/multimodal. Near-complete expected for audio + LLM. Out-of-scope = account/billing/legal, Mintlify doc-authoring meta pages, AI-coding-tool setup, China-only, marketing/research essays.

Buckets: **COVERED** / **PARTIAL** / **OMITTED-INTENTIONAL** (out of scope) / **MISSED-IN-SCOPE** (the gaps that matter).

---

## `## Docs` — API Reference: Caching, Overview, Errors, Files

| Page | Bucket | Note |
| :-- | :-- | :-- |
| Explicit Prompt Caching (Anthropic API) | COVERED | §4 prompt-caching: `cache_control` ephemeral, 5-min TTL refreshed on hit, ≤4 breakpoints, 20-block lookback, usage fields, P&P example all present. |
| API Overview | COVERED | Distributed across report (modalities, base URLs, models, limits). |
| Error Codes | COVERED | Gotchas list: 1002/1008/2049/1004/1042/1043/2037/2048/2039. Strong. |
| Delete File | COVERED | §8 Files API "list/delete" mentioned. |
| List Files | COVERED | §8 Files API "list/delete" mentioned. |
| Retrieve File | COVERED | `GET /v1/files/retrieve?file_id=` (metadata/download_url) present. |
| Retrieve Content | COVERED | `GET /v1/files/retrieve_content?file_id=` (raw bytes) present. |
| Upload File | COVERED | `POST /v1/files/upload` multipart + `purpose` enum present. |

## `## Docs` — Image

| Page | Bucket | Note |
| :-- | :-- | :-- |
| Image-to-Image Generation | COVERED | §7 (subject reference for people). |
| Text to Image Generation | COVERED | §7 (`image-01`, aspect_ratio, n 1–9, prompt_optimizer, $0.0035, 10 RPM). |
| Image Generation Guide | COVERED | Folded into §7. |

## `## Docs` — Music

| Page | Bucket | Note |
| :-- | :-- | :-- |
| Lyrics Generation | COVERED | §5: `POST /v1/lyrics_generation`, `mode:write_full_song`, $0.01/song. |
| Music Cover Preprocess | COVERED | §5: `/v1/music_cover_preprocess` → `cover_feature_id`+`formatted_lyrics`, 24h validity. |
| Music Generation (API ref) | COVERED | §5: `music-2.6`, prompt/lyrics/audio_setting, lyrics_optimizer, is_instrumental. |
| Music Generation (guide) | COVERED | §5 + recipe 5. One-step/two-step cover both present. |
| _CONN=20 concurrency for music_ | (minor) | Music RPM 120 covered; concurrent-connection cap 20 omitted (negligible). |

## `## Docs` — LLM text (Anthropic / OpenAI / Responses / SDKs)

| Page | Bucket | Note |
| :-- | :-- | :-- |
| List Models (Anthropic) | MISSED-IN-SCOPE | `GET /anthropic/v1/models` list endpoint not mentioned. Low importance (utility). |
| Retrieve Model (Anthropic) | MISSED-IN-SCOPE | `GET /anthropic/v1/models/{id}` not mentioned. Low. |
| List Models (OpenAI) | MISSED-IN-SCOPE | `GET /v1/models` not mentioned. Low. |
| Retrieve Model (OpenAI) | MISSED-IN-SCOPE | `GET /v1/models/{id}` not mentioned. Low. |
| Create Response (`/v1/responses`) | MISSED-IN-SCOPE | **OpenAI Responses API compat endpoint absent.** Report covers Chat Completions + Anthropic Messages but not Responses. `reasoning:{"effort":"none"}` control missing. Medium. |
| Estimate Input Tokens (`/v1/responses/input_tokens`) | MISSED-IN-SCOPE | Pre-flight token estimate endpoint absent. (Anthropic `count_tokens` IS covered.) Medium-low. |
| AI SDK (Vercel) | PARTIAL | Report lists "AI SDK" generically under MCP/SDKs but omits provider package `vercel-minimax-ai-provider`, `minimax`/`minimaxOpenAI` instances, and the key fact that **AI SDK supports M2.x only, not M3**. Low. |
| Anthropic SDK | COVERED | §4 Anthropic-compatible path, env vars, supported/ignored params, thinking control all present. |
| Messages API (Anthropic-compatible) | COVERED | `POST /anthropic/v1/messages`, params table, multimodal blocks. |
| Chat Completions API (OpenAI-compatible) | COVERED | §4 OpenAI path, multimodal, extra_body params. |
| OpenAI SDK | COVERED | Env vars + `/v1/chat/completions` + multimodal + thinking. |
| Text Generation (`text-post`) | COVERED | Chat completions creation covered in §4. |
| Prompt Caching (`text-prompt-caching`) | COVERED | §4 (duplicate of anthropic-cache page; both covered). |

## `## Docs` — Speech / TTS / Voice

| Page | Bucket | Note |
| :-- | :-- | :-- |
| Create Speech Generation Task (async) | COVERED | §1c: `/v1/t2a_async_v2`, txt/json/zip inputs, subtitles, 9h URL. |
| Query Speech Generation Task (async) | COVERED | §1c: `/v1/query/t2a_async_query_v2`, max 10 QPS. |
| Text to Speech (T2A) HTTP | COVERED | §1a: `POST /v1/t2a_v2`, `api-uw` low-TTFA host, 60 RPM. |
| Text to Speech (T2A) WebSocket | COVERED | §1b: full event protocol + verbatim Python streaming reference. Excellent. |
| Voice Clone (API) | COVERED | §2: `/v1/voice_clone`, 3-call workflow, constraints, $1.5/voice, 7-day rule. |
| Upload Audio for Voice Cloning | COVERED | §2: `purpose=voice_clone` upload. |
| Upload Prompt Audio | COVERED | §2: `purpose=prompt_audio`, <8s, clone_prompt. |
| Voice Design | COVERED | §3: `/v1/voice_design`, prompt+preview_text, speech-02-hd, $3/voice, 20 RPM. |
| Delete Voice | COVERED | §3: `POST /v1/delete_voice` (irreversible). |
| Get Voice | COVERED | §3: `POST /v1/get_voice` with category enum (system/voice_cloning/voice_generation/music_generation/all). |
| Async Long TTS Guide | COVERED | §1c + invalid-char 10% rule (error 1042). |
| Synchronous TTS Guide (WebSocket) | COVERED | §1b. |
| Voice Clone (guide) | COVERED | §2 workflow + recipe 2. |

## `## Docs` — Video

| Page | Bucket | Note |
| :-- | :-- | :-- |
| Create Video Agent Task | COVERED | §6: Video Agent template-based create mentioned. |
| Query Video Template Generation Task | PARTIAL | Video Agent query endpoint implied by "poll status" but agent-specific query path not spelled out. Low. |
| Video Download | COVERED | §6: `/v1/files/retrieve` → download_url. |
| Create First & Last Frame Video | COVERED | §6: `first_frame_image`+`last_frame_image`. |
| Image-to-Video Task | COVERED | §6: `first_frame_image`. |
| Query Video Generation Task Status | COVERED | §6: `GET /v1/query/video_generation?task_id=`, Success→file_id. |
| Subject-Reference to Video | COVERED | §6: `subject_reference` face photo, model `S2V-01`. |
| Create Text-to-Video | COVERED | §6: t2v payload + models + duration/resolution. |
| Video Generation with Templates Guide | COVERED | §6 Video Agent. |
| Video Generation (guide) | COVERED | §6 + recipe 5. |
| _Camera motion syntax `[pan]/[zoom]/[static]`_ | (minor) | Subject-ref camera control in prose; explicit prompt-tag syntax omitted. Low. |

## `## Docs` — Guides: Models / Quickstart / Pricing / Rate Limits / MCP

| Page | Bucket | Note |
| :-- | :-- | :-- |
| Models (`models-intro`) | COVERED | §4 model table (M3 1M ctx, M2.x 204,800, RPM/TPM). |
| Prerequisites (quickstart-preparation) | COVERED | Auth section: API key creation, shown-once. |
| Integrate via SDK (quickstart-sdk) | COVERED | Hello-world Anthropic SDK §"Hello world". |
| Rate Limits | COVERED | All RPM/TPM verified exact against source. |
| Pay as You Go (pricing-paygo) | COVERED | LLM/TTS/clone/design/music/video/image prices throughout. |
| Audio Subscription (pricing-speech) | OMITTED-INTENTIONAL | Subscription-tier audio pricing — out of scope (billing). |
| Product Pricing (pricing/overview) | PARTIAL | Pay-as-you-go side covered; subscription category not. Acceptable per policy. |
| Introduction to MCP (mcp-guide) | COVERED | §9 official MCP servers, tool list, config JSON. |
| Local Deployment Guide | MISSED-IN-SCOPE | vLLM / SGLang / MLX self-host of MiniMax-M2.7 not mentioned. In-scope (LLM deploy) but niche for a hosted-API hackathon. Low-medium. |
| Image Generation Guide | COVERED | §7. |
| Music Generation (guide) | COVERED | §5. |

## `## Docs` — Guides: LLM behavior / agentic / M-series essays

| Page | Bucket | Note |
| :-- | :-- | :-- |
| M3 for AI Coding Tools (text-ai-coding-tools) | PARTIAL | M3 coding strength noted in §4 header; tool-specific setup recipes not transcribed (out-of-scope adjacent). Low. |
| Chat Model (text-chat) | PARTIAL | M2-her role-play/multi-turn chat model page; report covers M2.x generally but not the role-play/dialogue positioning. Low. |
| Model Invocation (text-generation) | COVERED | §4 generation overview. |
| Tool Use & Interleaved Thinking (text-m3-function-call) | COVERED | §4 thinking-control + "re-append full response.content" rule. Strong. |
| M-series Usage Tips (prompting-best-practices) | MISSED-IN-SCOPE | **Prompt-pattern guide absent** — incl. the directly-relevant "your response will be read aloud by TTS, use plain text" formatting tip, tool-use & long-context prompt patterns. Medium. |
| Aligning to What? (m2-agent-generalization) | OMITTED-INTENTIONAL | Research essay. |
| Why Full Attention (m2-full-attention) | OMITTED-INTENTIONAL | Research essay. |
| What makes good reasoning data (m2-reasoning) | OMITTED-INTENTIONAL | Research essay. |
| MiniMax Hailuo AI tutorial (video-prompt) | PARTIAL | Video prompt-craft tutorial; only camera-control hint surfaced. Low. |

## `## Docs` — Token Plan (subscription/coding-tool ecosystem)

| Page | Bucket | Note |
| :-- | :-- | :-- |
| Token Plan Overview / Quick Start / FAQ / Migration / Promotion / MCP / Mini-Agent / CLI / Claude Code / Codex / Cursor / TRAE / OpenClaw / Hermes / Other Tools / Token Plan MCP Guide / pricing-token-plan(-team) / token-plan-mcp-guide | OMITTED-INTENTIONAL | Token Plan = subscription billing + AI-coding-tool config ecosystem. Out of scope (not the pay-as-you-go API build path). Report correctly steers to the pay-as-you-go API Key. ~20 pages. |
| Web Search MCP / Token Plan MCP Guide (`web_search`, `understand_image`) | PARTIAL/OMITTED | Token-Plan-exclusive MCP tools (web_search, understand_image) not in report; tied to subscription tier, reasonably omitted. Low. |

## `## Docs` — Solutions / Cookbook

| Page | Bucket | Note |
| :-- | :-- | :-- |
| Cookbook (index) | OMITTED-INTENTIONAL | Tutorial index. Report supplies its own hackathon recipes. |
| Mini-Agent / Multi-Agent Cowork (Eigent) / OpenClaw / Robot Agent | OMITTED-INTENTIONAL | End-to-end tutorials; report's recipes cover the composition patterns. |

## `## Docs` — FAQ / Account / Legal

| Page | Bucket | Note |
| :-- | :-- | :-- |
| System Voice ID List | COVERED | §1 curated English subset + pointer to Get Voice API. (Full 300+ list not transcribed — acceptable, enumerated live.) |
| Video Agent Template List | PARTIAL | §6 names a few templates (Diving, Run for Life, Transformers); full template-ID catalog not transcribed. Low. |
| About Account | OMITTED-INTENTIONAL | Billing/balance FAQ. |
| About APIs | OMITTED-INTENTIONAL | Account-management FAQ (tps calc lives here — minor). |
| Contact Us | OMITTED-INTENTIONAL | Support channels. |
| Privacy Policy / Terms of Service | OMITTED-INTENTIONAL | Legal. |
| Release Notes — APIs / Models | OMITTED-INTENTIONAL | Changelogs. |

## `## Docs` — Doc-authoring meta (Mintlify) & AI-tool setup

| Page | Bucket | Note |
| :-- | :-- | :-- |
| Code blocks / Images and embeds / Markdown syntax / Navigation / Reusable snippets / Global Settings | OMITTED-INTENTIONAL | Mintlify doc-authoring meta — not product API. 6 pages. |
| Claude Code setup / Cursor setup / Windsurf setup (ai-tools) | OMITTED-INTENTIONAL | IDE config for doc workflow. 3 pages. |

## `## OpenAPI Specs` (14) + `## AsyncAPI Specs` (1) + `## Optional` (1)

| Page | Bucket | Note |
| :-- | :-- | :-- |
| openapi-responses.json | MISSED-IN-SCOPE | Backs the uncovered Responses API. |
| openapi-chat-openai / openapi-chat-anthropic / openapi-chat.json | COVERED | Chat endpoints covered narratively. |
| text/sub-ref/start-end/image-to-video.json | COVERED | Video modes covered narratively. |
| upload-prompt / upload-file.json | COVERED | Files + clone upload covered. |
| retrieve-model / list-models (openai).json | MISSED-IN-SCOPE | Backs the uncovered models endpoints. |
| text-to-image / image-to-image.json | COVERED | §7. |
| asyncapi.json (T2A) | COVERED | WebSocket protocol §1b. |
| zh/openapi.json | OMITTED-INTENTIONAL | China spec. |
| Developer Program (Optional) | OMITTED-INTENTIONAL | Contact link. |

---

## Gaps to patch (specific, in-scope)

1. **OpenAI Responses API** — `POST /v1/responses` and `POST /v1/responses/input_tokens`. Report covers Chat Completions + Anthropic Messages but never the Responses endpoint. Add: the `reasoning:{"effort":"none"}` disable (vs `minimal/low/medium/high` accepted-but-no-op), `input` field shorthand, and the pre-flight token-estimate endpoint. _(Medium)_
2. **M-series prompting best practices** (`token-plan/prompting-best-practices`) — prompt patterns for coding/tool-use/long-context, and crucially the **"your response will be read aloud by a TTS model — plain text only, short sentences"** formatting pattern (directly relevant to voice agents). _(Medium)_
3. **Models discovery endpoints** — `GET /v1/models` + `/v1/models/{id}` (OpenAI) and `GET /anthropic/v1/models` + `/{id}` (Anthropic). Useful for enumerating available model IDs at runtime. _(Low)_
4. **Vercel AI SDK provider** — `vercel-minimax-ai-provider` npm package, `minimax` (Anthropic-format) vs `minimaxOpenAI` (OpenAI-format) instances, and the constraint that **the AI SDK path supports M2.x only — not M3** (and no image/file input). _(Low)_
5. **Local/self-host deployment** — MiniMax-M2.7 via vLLM, SGLang (Linux GPU), or MLX (Mac Studio). Niche for a hosted-API hackathon but in-scope LLM. _(Low-medium)_
6. **OpenAI multimodal image-token-cost heuristic** — `detail` low ≈ up to ~600 tok, default ≈ ~1k–5k, high ≈ several-thousand–15k+. Affects cost estimates when sending images to M3. _(Low)_
7. **Video camera-motion prompt syntax** — explicit `[pan] / [zoom] / [static]` tags appendable after key descriptions (some models). _(Low)_
8. **Music concurrency** — Music API CONN cap = 20 concurrent connections (in addition to 120 RPM). _(Trivial)_
9. **Video Agent template catalog** — full template-ID list (FAQ `video-agent-templates`) only partially named. _(Low)_

## Intentionally omitted (out of scope per policy)

- **Token Plan ecosystem (~20 pages):** intro, quickstart, faq, migration, promotion, mcp-guide, mini-agent, minimax-cli, claude-code, codex, cursor, trae, openclaw, hermes-agent, other-tools, pricing-token-plan(+team), token-plan-mcp-guide. (Subscription billing + AI-coding-tool config; report uses pay-as-you-go API path.)
- **Mintlify doc-authoring meta (6):** code, images, markdown, navigation, reusable-snippets, settings.
- **AI-tool doc setup (3):** ai-tools/claude-code, ai-tools/cursor, ai-tools/windsurf.
- **Account/legal/FAQ (8):** about-account, about-apis, contact-us, privacy-policy, terms-of-service, release-notes/apis, release-notes/models, pricing-speech (audio subscription).
- **Research essays (3):** m2-agent-generalization, m2-full-attention, m2-reasoning.
- **Solutions/Cookbook tutorials (5):** index, eigent, mini-agent, openclaw, robot-agent. (Report substitutes its own hackathon recipes.)
- **China spec (1):** zh/openapi.json. **Optional (1):** Developer Program contact link.

---

## Tally

- Total index pages: **128**
- In-scope pages (audio + LLM + music + video + image + files + caching + core guides/specs): **~78**
- Out-of-scope (Token Plan, Mintlify meta, AI-tool setup, account/legal/FAQ, essays, solutions, China): **~50**
- COVERED (in-scope): **~64**
- PARTIAL (in-scope): **~6**
- MISSED-IN-SCOPE: **~8** (Responses create, Responses input_tokens, 4× model-list/retrieve, prompting-best-practices, local-deploy)
- **Coverage of in-scope = (64+6)/78 ≈ 90%.**

The report is excellent on the audio stack (TTS HTTP/WS/async, clone, design, voice mgmt — near-100%) and the LLM Anthropic/OpenAI chat + caching + multimodal + tool-use paths. The real gaps are the **OpenAI Responses API**, the **prompting-best-practices** patterns (with the TTS-formatting tip), and minor model-discovery/local-deploy/AI-SDK-provider omissions.
