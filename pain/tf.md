# TrueFoundry — Pain Points, Limitations & Whitespace

> For YC Mosshack 2026 (voice-AI hackathon) idea brainstorming. Two sources: (A) honest constraints transcribed from the local docs corpus `/Users/anirudh/Desktop/yc-mosshack/raw/tf-llms-full.txt` (line numbers cited), and (B) real-user complaints found on the web (URLs cited). TrueFoundry's role at the event = the **governed LLM/MCP/Agent gateway** behind a LiveKit voice agent.

---

## What TrueFoundry itself can't (yet) do  *(product limits, cited to the docs corpus)*

### Voice-relevant gateway limits (the ones that bite a live voice demo)

- **No streaming-aware guardrails.** The custom-guardrail contract is *buffered*: "the gateway holds the full assistant response before calling the output rail." So PII/safety on the *output* of a voice answer can only be decided after the whole reply is generated — you cannot redact mid-stream as the TTS is already speaking. (corpus lines 25431, 39271)
- **PII guardrail is mutate-only & built-in PII/PromptInjection/ContentModeration are SaaS-only.** The three managed guardrails (Content Moderation, PII/PHI, Prompt Injection) are "only available on TrueFoundry SaaS… not available on self-hosted deployments" — self-hosters must BYO-key Azure/Bedrock/Enkrypt. (corpus line 26204) PII Detection "only supports mutate mode" and Content Moderation / Prompt Injection "only support validate mode." (corpus lines 48530, 48660, 48757)
- **Custom guardrails have no mutation mode at all** ("All v1 validators run in `on_fail=exception`") and **validator accuracy is context-sensitive** — bare SSNs / adversarial-prose secrets slip through; "v1 is defense in depth, not perfect prevention." (corpus lines 25427-25435, 25372)
- **Latency-based routing is sticky for a fixed 10-min epoch**, and **explicit `sticky_routing` config "isn't supported for latency-based or priority-based routing."** A single caller won't immediately benefit from a faster target until the epoch rolls — fine for cache reuse, awkward for a one-caller live demo. (corpus lines 49608, 569 of TRUEFOUNDRY.md)
- **Audio model IDs must exactly match the provider account display name**, not the `provider/model` convention used for chat — a silent footgun for STT/TTS routing. (TRUEFOUNDRY.md line 571; corpus 40425: a `whisper-1` registered transcription-only returns 400 on translation)
- **Realtime/Live API not available on Bedrock** ("Not supported for Bedrock: … Realtime API"); TTS/STT/translation also unsupported there. So you can't fail a realtime voice session over to Bedrock. (corpus line 6723)
- **Batch API ignores virtual models** (no routing/retries/fallback inside a batch — must pass a real model). (corpus line 8535)
- **Routing config NOT supported on Google Gen AI SDK and boto3/langchain_aws** — if you need failover you must use the OpenAI/Anthropic SDK or raw `/chat/completions`. (corpus 38673; TRUEFOUNDRY.md 572)

### Agent Harness / MCP gaps (the "govern agents" story has holes)

- **No long-term agent memory** — "Long-term memory is not yet available in Agent Harness… on the roadmap." (corpus line 1780)
- **No custom/user-defined subagents** — "you cannot define your own specialized subagents with custom instructions, tools, or models"; subagents **can't nest** (one level deep) and **can't talk to the user / ask questions.** (corpus 2382, 2188-2189, 1103)
- **Sandbox is tiny and fixed:** 1 vCPU / 1 GB RAM / 1 GB disk, **2-minute per-command timeout**, **no custom sandbox images**, **no bring-your-own-sandbox** (both "not yet"), custom resources "not yet self-serve." (corpus 4317, 4501-4517)
- **MCP per-user credential templating is restricted** to exactly one placeholder per env var; "multiple placeholders or other template syntax… not supported." Several MCP auth modes (Shared-cred API key, OAuth2 client-credentials, IdP token) are still "Coming soon"; token passthrough "Not supported." (corpus 37269/37374, 34933-34951)
- **Agent Platform / Remote Agents are explicitly in beta.** (corpus 3083)
- **Automatic model selection per agent step is "coming soon"** — today you wire routing rules manually. (corpus 2953)

### Provider / API surface gotchas

- **Files API: list & delete unsupported on Bedrock (S3) and Vertex (GCS) backends**; user-uploaded files can't be downloaded back. (corpus 7205, 24574, 5631)
- **Anthropic schema constraints (`ge/le/min/max`) silently break structured output** — must strip them. (corpus 5465, 10561)
- **Prompt caching min-prefix gotcha:** 1024 tokens (Sonnet/Opus) / 2048 (Haiku) — shorter prompts accept the `cache_control` hint but won't actually cache. (corpus 5507)
- **Cloudflare-tunnel private-network connectivity is enterprise-plan only.** (corpus 13564)
- **Self-hosted requires Kubernetes + Istio (mandatory ingress) + ArgoCD + Postgres + blob storage** — heavy. (corpus deployment overview; FutureAGI below)
- **`x-tfy-routing-config` header retired (v0.133+); common built-in tools deprecated, fully removed after 15 May 2026** — config churn between versions. (corpus 55028, 54284-54301)
- **AIDR guardrail can't handle 1 MiB+ payloads gracefully** (gateway issues a single synchronous call; HTTP 202 async responses are treated as failures). (corpus 14338)
- **OTel exporters: several backends accept traces but "Metrics not supported"** (PromptLayer, others); Dynatrace requires Proto-only, no gRPC/JSON. (corpus 43307, 13878, 16836-16841)

---

## What users struggle with / complain about  *(with URLs)*

- **Claude Code through the gateway throws `400: This model does not support the effort parameter`** — a real, widely-hit class of bugs when routing Claude Code/Anthropic traffic through a third-party gateway. Claude Code string-matches the model id to detect capabilities (effort/ToolSearch/beta blocks); a TrueFoundry virtual-model name that doesn't *contain* a recognizable Anthropic id makes it attach unsupported params → 400. Anthropic shipped CLI fixes (2.1.70) and there are multiple open issues. Workaround buried in docs: name the virtual model to contain the real id, or set `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`. ([anthropics/claude-code#30010](https://github.com/anthropics/claude-code/issues/30010), [#30795](https://github.com/anthropics/claude-code/issues/30795), [#30760](https://github.com/anthropics/claude-code/issues/30760), [Claude Code changelog 2.1.70](https://x.com/ClaudeCodeLog/status/2029729187574002039), [TrueFoundry Claude Code docs](https://www.truefoundry.com/docs/ai-gateway/claude-code)). *This is the single most demo-relevant footgun — gateway integration silently breaks on a model-naming mismatch.*
- **Cursor "Override Base URL" breaks against custom gateways** — Chat Completions can't surface thinking/reasoning tokens; a known Cursor-side issue when pointing at a proxy. ([TrueFoundry Cursor docs / corpus 14360-14413](https://forum.cursor.com/t/cursor-agent-sends-responses-api-format-to-chat-completions-endpoint/153019))
- **Kubernetes-ops burden & no free tier (third-party review):** TrueFoundry is "K8s-native only… K8s ops cost is too high"; "no free public tier," "enterprise quote only," which "makes prototypes and pilots harder to justify." Also flagged: **closed-source data plane** (fails procurement that requires OSI-approved OSS) and **no integrated eval loop** — "ship[s] gateway capabilities; none of them close the loop back into the next release." ([FutureAGI: TrueFoundry Alternatives 2026](https://futureagi.com/blog/truefoundry-alternatives-2026/))
- **Learning curve & pricing for small teams (G2):** reviewers say "advanced features require additional learning," "pricing can be a concern for smaller teams," "setting up highly customised pipelines can require a bit of effort," and request "more robust RBAC… and approval-based workflows for deployment rollouts." Pricing model = 1-month free then **15% markup on top of cloud spend**, else enterprise custom. ([G2 reviews](https://www.g2.com/products/truefoundry/reviews), [G2 pros/cons](https://www.g2.com/products/truefoundry/reviews?qs=pros-and-cons), [G2 pricing](https://www.g2.com/products/truefoundry/pricing))
- **Setup/onboarding friction in their own OSS repo (Cognita):** open/closed issues show real install pain — "Ingestion Timeout Error," "container cognita-postgres is unhealthy," "Unable to finish the docker compose deployment without using `TFY_API_KEY`," "backend API stop responding: upstream request timeout," "openai.APIConnectionError: Connection error." Maintainers repeatedly redirect users to Slack to debug. ([cognita issues](https://github.com/truefoundry/cognita/issues) — #426, #421, #382, #305, #351)
- **No published pricing / opacity** repeatedly noted across review aggregators ("custom pricing only, no published tiers"), vs Portkey ($99/mo) and Helicone ($79/mo) which publish tiers. ([definitive-guide blog](https://www.truefoundry.com/blog/a-definitive-guide-to-ai-gateways-in-2026-competitive-landscape-comparison), comparison search above)

> Caveat: G2 and Gartner review bodies were 403-blocked to direct fetch; the dislikes above are from G2's surfaced pros/cons snippets and the third-party FutureAGI analysis. Public Reddit/HN threads specifically dunking on TrueFoundry are thin — it's enterprise-sold, so most friction lives in private Slack (their support funnel) rather than public forums. That *absence of a public troubleshooting community* is itself a whitespace signal.

---

## Whitespace & unmet needs

1. **Mid-stream / token-level voice guardrails.** Output guardrails are buffered — there is no way to redact PII or block a hallucination *while the TTS is already speaking*. Voice is the worst case: by the time the full response exists, the caller has heard it.
2. **No "does my voice config actually fail over?" preflight.** All the failover/TTFT/timeout magic is invisible until something breaks live. There's no tool that *proves* your virtual model, `x-tfy-ttft-timeout-ms`, and audio-model-id naming are wired correctly before a demo.
3. **Model-id / capability mismatch is a silent killer.** The Claude-Code-400 saga shows that gateway virtual-model naming vs downstream capability detection is fragile and under-tooled. No linter/validator exists for "will this virtual model behave like the underlying model expects?"
4. **No public, self-serve voice quickstart that exercises governance.** The LiveKit recipe is in the docs but the proof-of-governance (dashboard, failover, per-customer cost) requires manual setup; onboarding friction (K8s, Slack-driven debugging, no free tier) means few people see the "wow" live.
5. **Per-caller latency stickiness fights single-caller demos.** Latency routing's 10-min epoch is great in production, bad on stage; no easy "show me the failover flipping in real time" mode beyond manually killing a key.
6. **Voice-cost observability gap.** TTS/STT spend can route through the gateway, but the headline dashboards/metrics are model-token-centric (`timeToFirstTokenMs`, `interTokenLatencyMs` "do not apply to MCP metrics"). End-to-end *spoken-turn* cost/latency (STT+LLM+TTS as one unit) isn't a first-class view.

---

## → Idea seeds for the hackathon  *(Moss-powered voice builds that exploit these gaps)*

1. **"Streaming guardrail sidecar for voice."** Since TrueFoundry's output guardrails are buffered (can't redact mid-speech), build a thin LiveKit-side interceptor that runs PII/safety checks on the LLM token stream *before* it hits TTS, using **Moss for sub-10ms lookups** of a redaction/blocklist. Demo: caller's SSN gets bleeped *as the agent speaks*, something the gateway alone provably can't do (cite the buffered-guardrail limitation). Pairs the gateway for governance + Moss for the realtime layer it's missing.

2. **"Gateway preflight doctor" for voice agents.** A one-command CLI/voice-bot that, given a TrueFoundry key, validates the whole voice path: virtual-model exists, audio model id matches the provider display name, `x-tfy-ttft-timeout-ms`/`request-timeout` set, fallback targets healthy, and — crucially — **catches the Claude-Code-style model-id/capability mismatch before it 400s on stage.** Returns a green/red checklist. Directly attacks the #1 real-world footgun.

3. **"Failover theater" live dashboard.** A voice demo where you *narrate* the gateway killing a provider mid-call: a Moss-backed event log captures every `x-tfy-resolved-model` flip and per-turn STT+LLM+TTS cost, rendering the end-to-end *spoken-turn* cost/latency view the native dashboard lacks. Turns the invisible (epoch-sticky, model-token-centric) telemetry into a judge-facing "it's already production-grade" moment.

4. **"Semantic voice-FAQ cache that beats the 10-min epoch."** Use **Moss** as a fast semantic cache *in front of* the gateway for repeated caller questions (gateway semantic cache exists but caching + epoch stickiness are coarse). Sub-10ms cache hits skip the model call entirely for FAQ-style voice support, and you control freshness per-caller rather than per-epoch.

5. **"Voice agent memory layer"** to fill the Agent-Harness "no long-term memory yet" gap: a Moss-backed per-caller memory store the voice agent reads/writes each turn (preferences, prior tickets), injected into the gateway call via `X-TFY-METADATA`. Demos the multi-turn continuity the harness explicitly says is on the roadmap, not shipped.

6. **"Self-serve voice quickstart in a box."** Counter the no-free-tier / K8s-onboarding friction: a hosted, voice-driven walkthrough that spins up a LiveKit + TrueFoundry-gateway demo in <2 min with zero Kubernetes, so first-timers hit the governed-failover "wow" without the setup tax that drives them to LiteLLM/Portkey.
