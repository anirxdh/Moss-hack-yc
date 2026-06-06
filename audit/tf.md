# TrueFoundry Coverage Audit — `docs/TRUEFOUNDRY.md`

**Platform:** TrueFoundry AI Gateway
**Ground truth:** `raw/tf-llms.txt` — 651 doc pages + 2 OpenAPI specs (653 index entries)
**Report audited:** `docs/TRUEFOUNDRY.md` (604 lines, hackathon field guide)
**Scope policy:** IN-SCOPE = AI Gateway subset (unified OpenAI-compatible API, multi-provider routing, virtual keys/API key mgmt, rate/budget limits, observability/tracing/cost, guardrails/PII, prompt mgmt, fallbacks/load-balancing/latency routing, semantic cache, MCP integrations, LiveKit). OUT-OF-SCOPE = ML serving infra, K8s/cluster setup, workflows/notebooks/training, generic platform admin.

---

## Denominator breakdown (651 doc pages)

| Section (URL prefix) | Pages | Scope |
| --- | --- | --- |
| `ai-gateway/` core gateway (routing, guardrails, caching, limits, headers, observability, prompts, APIs, LiveKit) | ~95 | IN-SCOPE |
| `ai-gateway/` provider model integrations (OpenAI, Anthropic, Bedrock, Vertex, Gemini, Groq, Mistral, xAI, Together, Cohere, Cerebras, SambaNova, DeepInfra, Perplexity, TTS/STT vendors, etc.) | ~55 | IN-SCOPE (collectively summarized) |
| `ai-gateway/` observability exporters (Arize, Langfuse, LangSmith, Datadog, New Relic, Honeycomb, SigNoz, Dynatrace, Splunk, Elastic, Coralogix, Axiom, etc.) | ~30 | IN-SCOPE (collectively summarized) |
| `ai-gateway/` framework + IDE/tool integrations (LangChain, CrewAI, DSPy, Instructor, Cursor, Cline, Claude Code, Gemini CLI, Codex CLI, etc.) | ~40 | IN-SCOPE-adjacent (collectively summarized) |
| `ai-gateway/` guardrail vendor integrations (Azure CS, Bedrock, Model Armor, NeMo, Lasso, Pillar, Enkrypt, Patronus, TrojAI, CrowdStrike, etc.) | ~25 | IN-SCOPE (collectively summarized) |
| `ai-gateway/mcp/` (MCP gateway + 30+ server connectors) | 39 | IN-SCOPE (concept covered; per-connector omitted) |
| `ai-gateway/agent-harness/` + `ai-gateway/skills/` | 17 | BORDERLINE (agentic build; lightly covered) |
| `api-reference/` REST endpoints | 191 | MIXED (chat/embeddings/rerank/moderations/MCP/prompts/PAT/VAT in-scope; rest out) |
| `platform/` (SSO, SCIM, RBAC, control-plane, deploy) | 46 | OUT-OF-SCOPE (except API-key/VAT/team mgmt) |
| top-level infra/workflows/deploy/ML (`autoscaling`, `jobs`, `workflows`, `model-deployment`, `spark`, `volumes`, cloud control planes, etc.) | ~140 | OUT-OF-SCOPE |
| `change-announcements/` | 11 | MIXED (gateway-relevant deprecations partially relevant) |
| `agent-platform/`, `mcp-server-deployment/`, SDK refs | ~6 | BORDERLINE/OUT |

**In-scope estimate:** ~290 pages are in-scope or in-scope-adjacent (gateway core + all the per-provider/exporter/integration/guardrail reference pages + MCP + relevant API-reference endpoints). Of these, the gateway-core pages (~95) are the ones that carry unique load-bearing facts; the ~195 integration/exporter/connector/endpoint pages are highly repetitive reference material that the report covers **collectively by naming the vendors and the common pattern** rather than per-page.

---

## Section 1 — AI Gateway CORE (the load-bearing in-scope pages)

| Page | Bucket | Note |
| --- | --- | --- |
| Introduction to AI Gateway (`intro-to-llm-gateway`) | COVERED | "What is TrueFoundry" para + supported APIs table. |
| Making Your First Request (`making-llm-requests-via-gateway`) | COVERED | Base URL, model ID format, API key — all verbatim. |
| Quick Start Guide (`quick-start`) | COVERED | Quickstart hello-world section. |
| Authentication (`authentication`) | COVERED | PAT vs VAT table + Access section warning. |
| API Keys (`generating-truefoundry-api-keys`) | COVERED | PAT/VAT creation covered. |
| Model Discovery (`model-discovery`) | COVERED | `/models` curl + python + JSON response shape. |
| Native SDK Support (`native-sdk-support`) | COVERED | Full SDK table + Anthropic/Google/boto3 snippets verbatim. |
| Chat Completions Overview (`chat-completions-overview`) | COVERED | `/chat/completions` primary endpoint + capability highlights. |
| Chat Completions: Caching & Reasoning | PARTIAL | Mentioned in capability table; no dedicated prompt-cache snippet. |
| Chat Completions: Extended Thinking | PARTIAL | `x-tfy-strict-openai: false` for thinking tokens noted; no multi-turn signature detail. |
| Chat Completions: Multimodal | PARTIAL | Images/audio/PDF noted generically; no per-modality code. |
| Chat Completions: Structured Outputs | COVERED | JSON mode vs Schema mode per-provider noted. |
| Chat Completions: Tools & Signatures | PARTIAL | Tools mentioned; no function-calling code example. |
| Embeddings API (`embed`) | COVERED | `/embeddings` listed. |
| Responses API (`responses-api`) | COVERED | `/responses` + x-tfy-provider-name requirement. |
| Messages API (`messages-overview`) | COVERED | `/messages` Anthropic-format listed. |
| Rerank API (`rerank`) | COVERED | `/v2/rerank` exact path listed. |
| Moderation API (`moderation`) | COVERED | `/moderations` listed. |
| Batch API (`batch-predictions...`) | COVERED | `/batches`, async, NO virtual models — gotcha captured. |
| Files API (`file-endpoints`) | COVERED | `/files` listed. |
| Finetune API (`finetune`) | COVERED | `/fine_tuning` listed. |
| Compaction API (`compaction`) | MISSED-IN-SCOPE | `/responses/compact` endpoint not mentioned in report. |
| Speech to Text (`audio-transcription`) | COVERED | `/audio/transcriptions` + voice recipe. |
| Text to Speech (`text-to-speech`) | COVERED | `/audio/speech` + native TTS path. |
| Audio Translation (`audio-translation`) | COVERED | `/audio/translations` listed. |
| Image Gen/Edit/Variation | COVERED | `/images/*` listed. |
| Live / Realtime API (`live-api`) | PARTIAL | `/live` WebSocket listed; no WS code or tool-calling detail. |
| Live API: Code Snippets | MISSED-IN-SCOPE | Realtime WS code examples not included. |
| Live API: Tool Calling | MISSED-IN-SCOPE | Tool calling during Live sessions not covered. |
| Proxy API (`proxy-api`) | COVERED | `/proxy` pass-through listed. |
| Virtual Models (`virtual-model`) | COVERED | Full 3-strategy table + YAML config verbatim. |
| Create a Virtual Model (`virtual-model-advanced`) | PARTIAL | Concept covered; no UI step-by-step or "slugs" detail. |
| Routing Config (`load-balancing-overview`) | COVERED | YAML shape, defaults, first-match-wins all captured. |
| Sticky Routing (`sticky-routing`) | COVERED | Sticky weight-based + latency 10-min epoch covered. |
| Rate Limiting (`ratelimiting`) | COVERED | Config type, units, `rate_limit_applies_per`, first-match. |
| Budget Limiting (`budgetlimiting`) | COVERED | Caps, audit_mode, 75/90/95/100% alerts, gotcha. |
| Anthropic Stream Overload Fallback | COVERED | Mentioned as fallback-on-overloaded_error in gotchas/routing. |
| Caching (`caching`) | PARTIAL | Exact/semantic concept + zero-cost hit covered; **missing `x-tfy-cache-config` header, `similarity_threshold`/`ttl`/`namespace` params, cache isolation levels.** |
| Session Management (`session-management`) | PARTIAL | Referenced for multi-turn; **missing the actual `X-TFY-CONVERSATION-ID` header mechanism.** |
| Custom Metadata & Headers (`request-headers`) | COVERED | Full request+response header tables verbatim, incl. server-timing. |
| Request Logging (`request-logging`) | COVERED | `X-TFY-LOGGING-CONFIG` per-request toggle covered. |
| Prompt Management (`prompt-management`) | COVERED | FQN, versioning, server-side + client-side render snippets. |
| Metrics Dashboard (`analytics`) | COVERED | Overview + Model Metrics tabs, View-by pivots. |
| Cost Tracking (`cost-tracking`) | PARTIAL | Cost covered via dashboard; no public-pricing config detail. |
| Export OpenTelemetry Data (`export-opentelemetry-data`) | COVERED | OTEL export + long exporter list named. |
| Feedback for Traces (`feedback-for-traces`) | MISSED-IN-SCOPE | Feedback API on traces not mentioned. |
| API Access to Logs / Spans (`fetch-request-logs*`) | PARTIAL | Spans API mentioned; no query syntax/span-attribute reference. |
| API Access to Model Metrics (`fetch-model-metrics*`) | PARTIAL | Dashboard covered; programmatic metrics API not detailed. |
| API Access to MCP Metrics (`fetch-mcp-metrics`) | PARTIAL | MCP metrics dashboard noted; API not detailed. |
| Guardrails Overview / Getting Started / Configuration | COVERED | Operation modes, enforcement strategies, 4 hooks all captured. |
| PII/PHI Detection (`tfy-pii`) | COVERED | Azure AI Language, mutate-only, 4 hooks, redaction example. |
| Prompt Injection (`tfy-prompt-injection`) | COVERED | Azure Prompt Shield noted. |
| Content Moderation (`tfy-content-moderation`) | COVERED | Block-harmful-content noted. |
| Regex / Secrets / SQL Sanitizer / Code Safety / Metadata Validation | PARTIAL | All named in a list; no per-guardrail config detail. |
| Access Control (`gateway-access-control`) | PARTIAL | Auth covered; **Provider Account Manager/User permission levels not stated.** |
| Gateway Architecture / Plane Architecture | OMITTED-INTENTIONAL | Self-host plane architecture (infra). |
| Deployment Options / Modes of Deployment / Install-only LLM Gateway / Globally Distributed SAAS | OMITTED-INTENTIONAL | Self-host/deploy infra. |
| Setup AI Gateway in Org / Multiple Environments / Data Access / Data Routing | PARTIAL/OMITTED | Org SSO + data routing largely out; dev/staging/prod lightly touched. |
| Playground Overview (`playground-overview`) | COVERED | Referenced as source of code snippets. |
| Secret Manager in AI Gateway / Request Headers metadata | COVERED | Secret manager + metadata covered. |
| Connect Private Models & MCP Servers / Self-Hosted Models / Custom Endpoints | PARTIAL | Self-hosted + custom endpoints mentioned; no setup steps. |

---

## Section 2 — Provider, Exporter, Framework & Guardrail INTEGRATIONS (~150 pages)

| Group | Bucket | Note |
| --- | --- | --- |
| Model providers (OpenAI, Anthropic, AWS Bedrock, Sagemaker, Azure OpenAI/Foundry, Vertex, Gemini, Groq, Mistral, xAI, Together, Cohere, Cerebras, SambaNova, DeepInfra, Perplexity, OpenRouter, Databricks, Snowflake Cortex, Cloudera, AI21) | COVERED (collective) | Report names the providers and the unified `provider_account/model` pattern; per-page model-add steps intentionally not transcribed. |
| TTS/STT vendors (ElevenLabs, Cartesia, Deepgram, Smallest AI, Resemble) | COVERED (collective) | Named + native TTS/STT path given. |
| Observability exporters (Arize, Langfuse, LangSmith, Datadog, New Relic, Honeycomb, SigNoz, Dynatrace, Splunk, Elastic, Coralogix, Axiom, Dash0, Last9, Middleware, Traceloop, HoneyHive, LangWatch, Laminar, PromptLayer, Pydantic Logfire, ClickStack, CoreWeave, Prometheus/Grafana, OpenLIT) | COVERED (collective) | Named as OTEL export targets; per-exporter setup omitted by design. |
| Guardrail vendors (Azure Content Safety, Azure PII, Azure Prompt Shield, Bedrock Guardrails, Google Model Armor, NeMo, Lasso, Pillar, Enkrypt, Patronus, TrojAI, CrowdStrike AIDR, GraySwan, Akto, Arthur, Fiddler, Guardrails AI, OPA, Cedar, OpenAI Moderations) | PARTIAL (collective) | ~12 named in report's guardrail list; ~8 not individually named but covered by "many vendor integrations". |
| Agent frameworks & IDE tools (LangChain, LangGraph, LlamaIndex, CrewAI, DSPy, Instructor, Pydantic AI, OpenAI Agents/Swarm, Strands, Phidata, Langroid, Agno, Flowise, Langflow, Dify, n8n, Cursor, Cline, Roo Code, Goose, Jan, Open WebUI, LibreChat, AnythingLLM, Claude Code/Desktop, Gemini CLI, Codex CLI, Qwen CLI, OpenCode, GitHub Copilot) | PARTIAL (collective) | A few named (LangChain, CrewAI); most are "any OpenAI-compatible tool works" — true but not enumerated. Low value for a voice hackathon. |

---

## Section 3 — MCP Gateway (`ai-gateway/mcp/`, 39 pages)

| Page | Bucket | Note |
| --- | --- | --- |
| TrueFoundry MCP Gateway (`mcp-overview`) | COVERED | One-key access, OAuth managed, audit, guardrails on tool args. |
| Getting Started (`mcp-server-getting-started`) | PARTIAL | Concept covered; **missing the Add-Server UI flow, 3 auth types (API Key / OAuth2 / Token Passthrough), shared vs individual credentials, MCP Server roles.** |
| Virtual MCP Server (`virtual-mcp-server`) | COVERED | Combine tools into curated toolset — captured. |
| Auth Overrides (`mcp-server-auth-overrides`) | PARTIAL | Per-user token override mentioned via `x-tfy-mcp-headers`; UI override flow not detailed. |
| Authentication & Security (`mcp-gateway-auth-security`) | PARTIAL | OAuth per-user covered; full auth/authz model not detailed. |
| OAuth MCP Server with Azure Entra / Okta | OMITTED-INTENTIONAL | Build-your-own-OAuth-server tutorials. |
| Calculator / OpenAPI-to-MCP / Stdio MCP server | PARTIAL | OpenAPI-to-MCP + stdio noted in Add-Server options list (via spot-check), light. |
| 30+ specific connectors (Slack, Zendesk, Salesforce, HubSpot, GitHub, MongoDB, Snowflake, Databricks, Google Workspace, PagerDuty, Airtable, Atlassian, Datadog, dbt, DX, Firebase, Gong, Honeycomb, incident.io, Ironclad, Looker, NetSuite, Omni, QuickBooks, Ramp, Smartsheet, Zendesk, Zoom, CrowdStrike Falcon) | PARTIAL (collective) | ~10 named in report; per-connector setup intentionally omitted — correct for a field guide. |
| Enterprise Security Claude (`enterprise-security-claude`) | OMITTED-INTENTIONAL | Admin governance guide. |

---

## Section 4 — Agent Harness / Skills (`ai-gateway/agent-harness/` + `skills/`, 17 pages) — BORDERLINE

| Page | Bucket | Note |
| --- | --- | --- |
| Agent Harness Overview / Getting Started / Reference / Models / MCP Servers | PARTIAL | Report gives a paragraph (build/serve/govern agents, sandbox, subagents, HITL, generative UI, session, traces). No SDK code. |
| Context Engineering (overview, code-mode, large-tool-response, preload-tools, subagents) | OMITTED-INTENTIONAL | Deep agentic internals — out of gateway-API scope for voice hackathon. |
| Ask User Questions / Generative UI / Human in the Loop / Sandbox / Skills | PARTIAL | Named in the one-paragraph harness summary. |
| Skills Registry + Getting Started | OMITTED-INTENTIONAL | Agent skills registry — niche. |
| Agent Registry / Remote Agents (`agent-platform/`) | OMITTED-INTENTIONAL | Agent registry infra. |

---

## Section 5 — API Reference (`api-reference/`, 191 pages)

| Group | Bucket | Note |
| --- | --- | --- |
| chat, embeddings, rerank, moderations, audio, image, batch, files, fine-tuning, messages, responses | COVERED (as endpoints) | All surfaced in the Supported-APIs endpoint table; per-endpoint request schema not transcribed (acceptable — OpenAI-compatible). |
| messages/count-tokens, responses/compact | MISSED-IN-SCOPE | Count-tokens + compact endpoints not mentioned. |
| mcp-servers-v2 (create/get/list/auth-status/consent-url/overrides) | PARTIAL | MCP server mgmt concept covered; REST CRUD endpoints not listed. |
| prompts (CRUD/versions) | PARTIAL | Prompt registry covered conceptually; REST endpoints not listed. |
| personal-access-tokens, virtual-accounts (CRUD/token/JWT/sync) | PARTIAL | PAT/VAT concept covered; REST endpoints for managing them not listed. |
| provider-integrations/list | PARTIAL | Implied; endpoint not named. |
| traces/get-filtered-spans | PARTIAL | Spans API referenced; exact endpoint not named. |
| audit-logs, agent, agent-skills, applications, apply, artifacts, clusters, jobs, logs, mlrepos, model-deployments, models, mlrepos, scim-v2, secret-groups, secrets, teams, users, workspaces | OMITTED-INTENTIONAL | Platform/deployment/ML/identity REST APIs — out of scope. |

---

## Section 6 — Platform, Infra, Workflows, ML (OUT-OF-SCOPE, ~200 pages)

| Group | Bucket | Note |
| --- | --- | --- |
| `platform/` SSO (SAML/OIDC × Okta/Entra/Auth0/Google/JumpCloud/OneLogin/PingOne/Rippling/Keycloak/ADFS), SCIM, RBAC, control-plane architecture/upgrade/monitoring/multitenancy, deploy control+gateway plane (AWS/Azure/GCP/onprem/OpenShift), security & compliance, support | OMITTED-INTENTIONAL | Enterprise admin + self-host infra. Note: PAT/VAT/team/virtual-account mgmt pages here are conceptually covered. |
| Jobs, Services, Async Services, Workflows (Flyte), Spark, Snowflake/Databricks tasks, cron, map/conditional tasks, volumes, mounts, autoscaling, ports/domains, probes, ingress, load balancers, rollout, CI/CD, GitOps, `tfy apply/delete`, CLI setup | OMITTED-INTENTIONAL | Deployment/orchestration infra. |
| Model deployment & serving (LitServe, FastAPI, HuggingFace, MLflow, TFServe, TorchServe, MMS, sklearn/XGBoost, NVIDIA NIM, model catalogue, finetuning LLMs, model registry, ML repo, fractional GPUs, TPUs, benchmarking LLMs) | OMITTED-INTENTIONAL | ML serving/training infra. Note: `benchmarking-llms` (TTFT/throughput) is mildly relevant to voice but out of gateway scope. |
| Cloud control planes (AWS/Azure/GCP/Generic), integration providers, secret stores (Vault), git integrations (GitHub/GitLab/Bitbucket/Azure Repos), email/Slack/PagerDuty notification channels, alerts, cost monitoring | OMITTED-INTENTIONAL | Infra integrations. |
| `change-announcements/` (11) | OMITTED-INTENTIONAL | Version deprecations; one (`routing-config-header-removal-v0.133`) confirms the report's choice to use virtual-model YAML over the retired `x-tfy-routing-config` header — implicitly aligned. |
| `truefoundry_sdk/`, `truefoundry-ml-reference/`, `key-concepts`, `create-and-setup-your-account` | OMITTED-INTENTIONAL | SDK/ML refs + generic onboarding. |
| OpenAPI specs (gateway-openapi.json, openapi.json) | OMITTED-INTENTIONAL | Raw spec files. |

---

## Gaps to patch (specific missing facts, in priority order)

1. **Semantic cache config mechanism (HIGH).** Report explains exact vs semantic + zero-cost hit but omits *how to turn it on*: the **`x-tfy-cache-config`** request header, params **`type`** (`exact-match`|`semantic`), **`similarity_threshold`** (0–1.0, start at **0.9**), **`ttl`** (seconds), and **`namespace`** for multi-tenant cache isolation (plus the automatic per-user/virtual-account Level-1 isolation). This is directly demoable for the voice-FAQ recipe and currently unactionable.

2. **Session Management header (HIGH).** Report references "Session Management" for multi-turn but never gives the actual mechanism: pass **`X-TFY-CONVERSATION-ID`** (recommend UUID5) on each chat-completions request to group a conversation in request logs. One-line fix; high value for the Co-Pilot/multi-turn recipe.

3. **Compaction + count-tokens endpoints (MEDIUM).** `/responses/compact` (Compaction API) and `messages/count-tokens` are in-scope gateway endpoints absent from the Supported-APIs table. Compaction is useful for long voice sessions.

4. **Live/Realtime API depth (MEDIUM).** `/live` is listed but the WebSocket code snippets and Live-API tool-calling pages aren't represented. For a *voice* hackathon a realtime-streaming example is arguably high-value; consider at least a pointer + one WS snippet.

5. **MCP server setup specifics (MEDIUM).** Missing the three upstream auth types (**API Key / OAuth2 / Token Passthrough**), **shared vs individual credentials**, the **Auth Overrides** tab flow, and **MCP Server Manager/User** roles. The Support-bot recipe leans on MCP; the concrete "how do I wire Zendesk auth" answer is thin.

6. **Trace/metrics query APIs (LOW-MEDIUM).** `fetch-request-logs` (spans query API, span attributes, filtering), `fetch-model-metrics` (timeseries/distribution/filtering/response format), and `feedback-for-traces` are in-scope observability APIs only covered at dashboard level. Fine for a demo; note as a gap if programmatic export is needed.

7. **Access-control permission levels (LOW).** `Provider Account Manager` vs `Provider Account User` (and MCP Server Manager/User) roles not stated. Minor for a hackathon.

8. **Cost-tracking pricing config (LOW).** Public-pricing/custom-pricing setup on `cost-tracking` not detailed beyond the dashboard view.

---

## Intentionally omitted (out of scope per policy) — counted, not transcribed

- **~200 platform/infra/workflow/ML pages:** all `platform/` SSO+SCIM+RBAC+control-plane+self-host-deploy pages; all Jobs/Services/Async/Workflows/Spark/volumes/autoscaling/CI-CD/GitOps/CLI pages; all model-deployment & serving pages (LitServe/FastAPI/HF/MLflow/TFServe/TorchServe/NIM/registry/finetune/GPU/TPU); cloud control planes; git/secret/notification integrations; cost monitoring; changelog/change-announcements; SDK & ML-client references; OpenAPI spec files.
- **~120 of the 191 `api-reference/` endpoints:** applications, apply, artifacts, clusters, jobs, logs, mlrepos, model-deployments, models, scim-v2, secret-groups, secrets, teams, users, workspaces, audit-logs, agent, agent-skills.
- **Agent Harness deep internals:** context-engineering (code-mode, large-tool-response, preload-tools), skills registry, agent registry / remote agents — borderline-agentic, out of the gateway-API voice scope.
- **Per-page provider/exporter/framework/connector setup walkthroughs:** intentionally summarized collectively (the report names the vendors and the one shared integration pattern) rather than transcribing ~150 near-identical "add this integration" pages — correct editorial choice for a 2 AM hackathon field guide.

---

## Verdict

For the **load-bearing in-scope gateway-core pages** (~95), coverage is strong and accurate: every spot-check (LiveKit, routing config, request/response headers, request logging, PII guardrail, virtual models, rate/budget limiting, model discovery, native SDKs) matched the source docs verbatim or near-verbatim, including exact defaults, header names, and the LiveKit code block. The report's editorial decision to summarize the ~150 repetitive provider/exporter/connector/framework integration pages collectively is sound. The genuine, actionable gaps are narrow and concentrated: (1) the **semantic-cache config header + params**, (2) the **`X-TFY-CONVERSATION-ID`** session header, and to a lesser degree (3) the **Live/Realtime API** snippets and (4) **MCP upstream-auth specifics** — all four are voice-relevant and worth a short patch.
