# TrueFoundry AI Gateway — Hackathon Field Guide

> Source of truth: local raw docs at `/Users/anirudh/Desktop/yc-mosshack/raw/tf-llms.txt` (index) and `tf-llms-full.txt` (full corpus, ~4.1MB). All endpoints, headers, and code snippets below are transcribed verbatim from those docs.

---

## What is TrueFoundry (one paragraph)

TrueFoundry's **AI Gateway** is an enterprise-grade proxy that sits between your application and **1000+ LLMs / MCP servers / agents**, exposing **one OpenAI-compatible endpoint** for every model provider (OpenAI, Anthropic, Bedrock, Vertex, Gemini, Groq, Mistral, xAI, Together, Cohere, Cerebras, SambaNova, DeepInfra, Perplexity, plus TTS/STT vendors like ElevenLabs, Cartesia, Deepgram, Smallest AI, Resemble). You authenticate with a **single TrueFoundry API key** instead of juggling each provider's keys; the gateway centrally manages provider credentials and handles **load balancing, automatic fallbacks, retries, latency routing, rate limiting, budget caps, guardrails (PII / prompt-injection / content moderation), semantic & exact caching, prompt versioning, and OpenTelemetry observability** on every request before it reaches a provider. The base URL is OpenAI-API-compatible, so any SDK or tool that speaks OpenAI works by changing one line: `base_url`. It bundles three gateways — **LLM Gateway**, **MCP Gateway** (one key to reach every tool server, with OAuth managed for you), and **Agent Gateway / Agent Harness** (build, serve, and govern agents) — under one control plane.

## Why it matters for a voice-AI hackathon (and which of the 3 tracks)

For a voice agent, the LLM "brain" call is the part most likely to break under demo pressure: a provider 429s, a model goes down, latency spikes mid-sentence. TrueFoundry makes the LLM layer **invisible and bulletproof** — you point your LiveKit agent's `llm=` at `https://gateway.truefoundry.ai`, and behind that single URL you get hot failover to a second model, per-token timeouts that fall back before the user notices, semantic caching for repeated questions, and a **live cost/latency dashboard** you can put on screen for judges. It serves all three tracks:

- **Support track (CS bots that pull docs + history):** PII/PHI redaction guardrail on input *and* output (powered by Azure AI Language), MCP Gateway to pull user history from Zendesk / Salesforce / HubSpot / MongoDB through one governed key, prompt versioning for the support persona.
- **Co-Pilot track (ambient agents):** latency-based routing (sticky per-caller for prompt-cache reuse), session management for multi-turn context, and the Agent Harness for ambient tool-calling agents.
- **Lead Gen track:** budget caps per demo/customer, per-`customer_id` metadata dashboards, virtual models for A/B testing which model converts better.

The judge-facing story writes itself: **"voice models are cheap; we made the retrieval + model layer production-ready and governed in 21 hours."**

---

## Quickstart: hello world

The gateway is OpenAI-compatible. You need exactly **three** things (all copy-pasteable from the Playground's **Code Snippets** tab):

1. **Gateway Base URL** — SaaS: `https://gateway.truefoundry.ai` (self-hosted: shown in Playground Code Snippets)
2. **Model ID** — format `provider_account/model_name`, e.g. `openai-main/gpt-4o-mini`
3. **API Key** — a TrueFoundry **PAT** (dev) or **VAT** (prod), passed as `Authorization: Bearer ...`

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-truefoundry-api-key",
    base_url="https://gateway.truefoundry.ai",
)

response = client.chat.completions.create(
    model="openai-main/gpt-4o-mini",   # provider_account/model_name
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)
print(response.choices[0].message.content)
```

### Environment-variable form (drop-in for any OpenAI tool)

```bash
export OPENAI_BASE_URL="https://gateway.truefoundry.ai"
export OPENAI_API_KEY="your-truefoundry-api-key"
```

### cURL

```bash
curl -X POST "https://gateway.truefoundry.ai/chat/completions" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai-main/gpt-4o-mini",
    "messages": [
      {"role": "system", "content": "You are a helpful coding assistant."},
      {"role": "user", "content": "Say hi in one sentence."}
    ]
  }'
```

That's it — same request shape as OpenAI, but now governed, observable, and load-balanced.

---

## The Gateway endpoint, model IDs, and auth (exact details)

### Base URL

| Deployment | Base URL |
| --- | --- |
| **TrueFoundry SaaS** | `https://gateway.truefoundry.ai` |
| **Self-hosted** | Found in the Code Snippets section of the Playground |

The Gateway Base URL is **compatible with the OpenAI API format**, so any SDK/tool that supports the OpenAI API works by just changing the base URL.

### Model ID

Every model has a unique identifier `provider_account/model_name`. Example: `openai-main/gpt-4o-mini` = model `gpt-4o-mini` via the provider account `openai-main`. An org can have multiple accounts for the same provider (`openai-main` for prod, `openai-dev` for testing).

### Authentication

- Authenticate with a **TrueFoundry API key** — *not* the provider's key. The gateway manages provider credentials centrally.
- Pass it as a Bearer token: `Authorization: Bearer your-truefoundry-api-key`
- Two token types:

| Token type | Best for |
| --- | --- |
| **Personal Access Token (PAT)** | Development and testing (tied to your user) |
| **Virtual Account Token (VAT)** | Production apps, CI/CD, shared services (tied to a non-user identity) |

> Warning from docs: avoid PATs in production — if the creating user leaves the org, the token becomes invalid. Create tokens from the **Access** section of the platform.

### Model discovery (`/models`) — OpenAI-compatible

```bash
curl https://gateway.truefoundry.ai/models \
  -H "Authorization: Bearer your_truefoundry_api_key"
```

```python
models = client.models.list()
for model in models.data:
    print(model.id)
```

Returns only the models your key has access to:

```json
{
  "object": "list",
  "data": [
    { "id": "openai-main/gpt-4o-mini", "object": "model", "owned_by": "openai-main" },
    { "id": "anthropic-main/claude-4-sonnet", "object": "model", "owned_by": "anthropic-main" }
  ]
}
```

Great for building a dynamic model dropdown in your demo UI.

---

## Supported APIs (one gateway, many endpoints)

The gateway maps the OpenAI contract onto each provider. Endpoints exposed at the base URL:

| Endpoint | Purpose |
| --- | --- |
| `/chat/completions` | Unified chat (primary) — streaming + non-streaming, tools, JSON/schema mode, prompt caching, reasoning |
| `/embeddings` | Vector embeddings |
| `/responses` | OpenAI Responses API |
| `/messages` | Anthropic Messages API |
| `/v2/rerank` | Rerank API |
| `/moderations` | OpenAI Moderations |
| `/audio/speech` | **Text-to-Speech (TTS)** |
| `/audio/transcriptions` | **Speech-to-Text (STT)** |
| `/audio/translations` | Audio translation |
| `/images/generations`, `/images/edits`, `/images/variations` | Image gen/edit |
| `/batches` | Async batch jobs at batch pricing (does NOT support virtual models) |
| `/files`, `/fine_tuning` | File mgmt, fine-tuning |
| `/live` | Bidirectional **realtime streaming (Live API)** over WebSocket |
| `/proxy` | Pass-through to a provider's native endpoint while keeping gateway features |
| `/mcp-server` | MCP Gateway |
| `/agent/responses` | Agent responses |

**Chat Completions provider capability highlights (verbatim from docs):** OpenAI, Azure OpenAI, Anthropic, Bedrock, Vertex, Gemini, Groq, xAI, Together-AI, DeepInfra all support streaming + tools + prompt caching + reasoning. Structured Output is supported on Perplexity, Together-AI, xAI. JSON Mode is supported on most except Anthropic/Bedrock/Vertex (which use Schema Mode instead).

**Code-snippet formats the Playground generates:** `OpenAI SDK`, `Langchain`, `Langgraph`, `Google ADK`, `Stream API`, `Rest API`, `Go-OpenAI`, `Rust-OpenAI`, `cURL`, `Node.js`, `LlamaIndex`, `Langchain4j`.

---

## Native SDK support (use the provider's own SDK, pointed at the gateway)

Tracing, cost tracking, and rate/budget limits work for all of these.

| SDK | Models | Cost tracking | Rate/Budget | Routing config |
| --- | --- | --- | --- | --- |
| OpenAI | All models | Yes | Yes | Yes |
| Google Gen AI | Gemini, Vertex | Yes | Yes | No |
| Anthropic | Anthropic only | Yes | Yes | Yes |
| boto3 (Bedrock Runtime) | Bedrock | Yes | Yes | No |
| langchain_aws | Bedrock | Yes | Yes | No |

**Anthropic SDK** (note the duplicated bearer header pattern from docs):

```python
from anthropic import Anthropic

BASE_URL = "https://gateway.truefoundry.ai"
API_KEY = "your-truefoundry-api-key"

client = Anthropic(
    api_key=API_KEY,
    base_url=BASE_URL,
    default_headers={"Authorization": f"Bearer {API_KEY}"},
)

resp = client.messages.create(
    model="anthropic/claude-3-5",  # tfy model name
    max_tokens=1024,
    messages=[{"role": "user", "content": "Explain quantum computing simply."}],
)
print(resp.content)
```

**Google Gen AI SDK** (uses a proxy base URL; routing config NOT supported):

```python
from google import genai
from google.genai import types

client = genai.Client(
    api_key="TFY_API_KEY",
    http_options=types.HttpOptions(
        base_url="https://gateway.truefoundry.ai/gemini/{providerAccountName}/proxy"
    ),
)
resp = client.models.generate_content(model="gemini-2.5-flash", contents="How does AI work?")
print(resp.text)
```

**boto3 (Bedrock Runtime)** — pass the TFY key as `AWS_BEARER_TOKEN_BEDROCK`:

```python
import boto3, os
os.environ["AWS_BEARER_TOKEN_BEDROCK"] = "your_truefoundry_api_key"

bedrock_runtime = boto3.client(
    service_name="bedrock-runtime",
    region_name=os.environ.get("AWS_REGION", "dummy"),
    endpoint_url="https://gateway.truefoundry.ai/bedrock/proxy",
)
resp = bedrock_runtime.converse(
    modelId="tfy-ai-bedrock/global-anthropic-claude-opus-4-5-20251101-v1-0",
    messages=[{"role": "user", "content": [{"text": "Hello, how are you?"}]}],
    inferenceConfig={"maxTokens": 256, "temperature": 0.7},
)
```

---

## Plugging TrueFoundry in behind a LiveKit voice agent (the core hackathon move)

This is the single most important recipe for this event. LiveKit handles voice transport (STT → LLM → TTS, sub-100ms WebRTC); you swap LiveKit's LLM for the gateway so every "brain" call is governed, observable, and failover-protected.

### Install

```bash
pip install \
    "livekit-agents[deepgram,openai,cartesia,silero]~=1.0" \
    "python-dotenv"
```

### `.env`

```bash
# TrueFoundry Configuration
OPENAI_API_KEY=<Your TrueFoundry API Key>
TRUEFOUNDRY_BASE_URL=https://gateway.truefoundry.ai
TRUEFOUNDRY_MODEL_ID=openai-main/gpt-4o      # or a virtual model name

# Third-party voice services
DEEPGRAM_API_KEY=<Your Deepgram API Key>
CARTESIA_API_KEY=<Your Cartesia API Key>

# LiveKit
LIVEKIT_API_KEY=<Your LiveKit API Key>
LIVEKIT_API_SECRET=<Your LiveKit API Secret>
LIVEKIT_URL=<Your LiveKit Server URL>
```

### `livekit_agent.py` (verbatim from docs)

```python
import os
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import openai, cartesia, deepgram, silero

load_dotenv()

class TrueFoundryAssistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="You are a helpful AI assistant powered by TrueFoundry. "
                         "Keep your responses conversational and helpful."
        )

async def entrypoint(ctx: agents.JobContext):
    session = AgentSession(
        stt=deepgram.STT(model="nova-2", language="en"),
        llm=openai.LLM(
            model=os.getenv("TRUEFOUNDRY_MODEL_ID", "openai-main/gpt-4o"),
            api_key=os.getenv("OPENAI_API_KEY"),       # Your TrueFoundry API Key
            base_url=os.getenv("TRUEFOUNDRY_BASE_URL"),# Your TrueFoundry Gateway URL
            temperature=0.7,
        ),
        tts=cartesia.TTS(model="sonic-english",
                         voice="79a125e8-cd45-4c13-8a67-188112f4dd22"),
        vad=silero.VAD.load(min_speaking_duration=0.3, min_silence_duration=0.8),
    )
    await ctx.connect()
    await session.start(room=ctx.room, agent=TrueFoundryAssistant())
    await session.generate_reply(
        instructions="Welcome the user warmly and ask how you can help today."
    )

if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
```

### Run

```bash
python livekit_agent.py dev
```

**The whole governance upgrade is one line:** `TRUEFOUNDRY_MODEL_ID=my-group/production-chat` (a virtual model) instead of a raw provider model. Now the same agent gets failover, retries, latency routing, budgets, and dashboards — with zero code change.

---

## Virtual Models — load balancing, fallback, retries, latency routing

A **virtual model** is a named entry (e.g. `my-group/production-chat`) your app calls like a normal model. Behind it you configure ONE routing strategy + one-or-more real targets (`azure/gpt-4o`, `openai/gpt-4o`, `anthropic/claude-3`). The gateway does health-aware routing, retries, and fallback automatically — **no provider details hard-coded in your client, change targets without redeploying.**

> Virtual models apply only to **synchronous** calls (chat, embeddings, responses, rerank, image/audio). The Batch API (`/batches`) does NOT support them — pass a real catalog model there.

### Three routing strategies

| Strategy | How it works | Best for |
| --- | --- | --- |
| **Weight-based** | Splits traffic by weights (sum to 100). Supports **sticky routing** to pin a session to a target. | Canary rollouts, A/B splits |
| **Priority-based** | Routes to highest-priority healthy target (**0 = highest**), falls back on failure. Supports **SLA cutoff** (TPOT threshold marks a target unhealthy). | Primary + backup, cost optimization |
| **Latency-based** | Per-caller deterministic selection weighted by recent latency (TPOT over last 20 min), **sticky for 10-minute epochs** (great for prompt-cache reuse). No weights needed. | Chasing lowest latency across regions/providers — **ideal for voice** |

### YAML config (full shape, verbatim fields)

```yaml
routing_config:
  type: weight-based-routing | latency-based-routing | priority-based-routing

  # Sticky routing (weight-based only)
  sticky_routing:
    ttl_seconds: 3600
    session_identifiers:
      - key: x-user-id
        source: headers          # headers | metadata

  load_balance_targets:
    - target: azure/gpt-4o        # model id in the gateway
      weight: 70                  # weight-based only (0–100, sum 100)
      priority: 0                 # priority-based only (lower = higher)
      retry_config:
        attempts: 2               # retries on SAME target; default 2
        delay: 100                # ms between retries; default 100
        on_status_codes: ["429","500","502","503"]   # default
      fallback_status_codes: ["401","403","404","429","500","502","503"]  # try a DIFFERENT target
      fallback_candidate: true    # eligible to receive fallback traffic; default true
      sla_cutoff:
        time_per_output_token_ms: 50   # priority-based only
      metadata_match:             # only route here if request metadata matches (AND logic)
        env: production
      headers_override:
        set: { x-region: us-east-1 }
        remove: [x-internal-debug]
      override_params:
        temperature: 0.5
        max_tokens: 512
        prompt_version_fqn: chat_prompt:org/repo/name:3
```

**Defaults to remember:** retries = 2 attempts / 100ms / retry on `429,500,502,503`; fallback triggers on `401,403,404,429,500,502,503`. SLA cutoff monitors avg TPOT over a 3-minute rolling window (3–10 samples).

---

## Rate limiting (YAML)

Limit tokens/requests per minute/hour/day for subsets of requests. Config type: `gateway-rate-limiting-config`. **Only the first matching rule applies** (put specific rules on top, generic at bottom).

Each rule has: `id` (static, no `{}` placeholders), `when` (`subjects` / `models` / `metadata`, AND'd), `limit_to`, `unit`, and optional `rate_limit_applies_per`.

- **units:** `requests_per_minute|hour|day`, `tokens_per_minute|hour|day`
- **`rate_limit_applies_per`** values: `user`, `virtualaccount`, `model`, `metadata.*` (max 2 per rule) — creates a *separate* limit per unique entity.

```yaml
name: ratelimiting-config
type: gateway-rate-limiting-config
rules:
  - id: "openai-gpt4-dev-bob"
    when:
      subjects: ["user:bob@email.com"]
      models: ["openai-main/gpt4"]
    limit_to: 1000
    unit: requests_per_day
  - id: "user-daily-limit"          # each user gets their own 1M tokens/day
    when: {}
    limit_to: 1000000
    unit: tokens_per_day
    rate_limit_applies_per: ['user']
```

Subjects are `user:john-doe`, `team:engineering-team`, or `virtualaccount:acct_123`. Metadata comes from the `X-TFY-METADATA` header.

---

## Budget limiting (cost caps)

Set $ caps per team/user/model/virtual account/metadata. Config in dashboard: **AI Gateway → Policies → Budget Limiting**. Like rate limits, **the first matching rule controls allow/block**, but **cost is tracked against EVERY matching rule** (enables layered budgets).

- **Filters (AND):** Subjects, Models, Metadata. Empty filters = matches every request (default budget).
- **Limit Unit:** Cost per day (resets UTC midnight) / week (Mon) / month (1st).
- **Apply budget per:** User / Model / Virtual Account / Metadata key (one per rule) → separate budget per individual.
- **Block If Usage Limit Exceeded** (YAML `audit_mode`, inverted): ON = enforce (reject over-limit); OFF = audit mode (allow through but still track + fire **milestone alerts at 75%, 90%, 95%, 100%**).
- Gotcha: budget tracking starts at $0 from **rule creation**, not the period start — don't compare it to overall monthly billing for a mid-period rule.

Recommended rollout: start in **audit mode** to calibrate, then flip to enforce.

---

## Guardrails (PII / prompt injection / content moderation / custom)

Guardrails sit between your app and the LLM/MCP tool, inspecting and optionally rewriting/blocking. Two settings per guardrail:

**Operation Mode**
| Mode | Behavior |
| --- | --- |
| **Validate** | Inspects + blocks if bad; doesn't change data. LLM-input validation can run *in parallel* with the model call; output/MCP validation runs synchronously. |
| **Mutate** | Inspects *and* rewrites (e.g. redacts PII); can also block. Runs sequentially by priority. |

**Enforcement Strategy**
| Strategy | On violation | On guardrail error |
| --- | --- | --- |
| **Enforce** | Block | Block |
| **Enforce But Ignore On Error** | Block | Let through (graceful degradation) |
| **Audit** | Let through (log only) | Let through |

**Four hooks:** LLM Input, LLM Output, MCP Pre Tool, MCP Post Tool. If input validation fails while the model is already running, the gateway **cancels the model request so you don't pay for it.**

### Built-in TrueFoundry-managed guardrails (no third-party keys needed; SaaS)

- **PII/PHI Detection** — powered by Azure AI Language; `mutate`-only (auto-redacts to asterisks). Applies to all 4 hooks. Configurable PII categories. Example: `"Call our office at 312-555-1234"` → `"Call our office at ************"`.
- **Prompt Injection** — powered by Azure Prompt Shield; detects jailbreaks/injections.
- **Content Moderation** — blocks harmful content.
- Also: Regex Pattern Match, Secrets Detection, SQL Sanitizer, Code Safety Linter, Metadata Validation, plus many vendor integrations (Bedrock Guardrails, Google Model Armor, NeMo, Lasso, Pillar, Enkrypt, Patronus, TrojAI, CrowdStrike AIDR, etc.).

Apply a guardrail group per-request via header:

```bash
-H 'X-TFY-GUARDRAILS: {"llm_input_guardrails":[],"llm_output_guardrails":["my-guardrail-group/code-safety-linter"]}'
```

---

## Observability: metrics dashboard, logs, OpenTelemetry

**Metrics Dashboard** (tabs, all with time-range + filters + live Refresh):

- **Overview:** Total Cost, Total LLM Calls, Total MCP Calls (with period-over-period deltas); incoming requests by endpoint; error breakdowns by status code; guardrails summary (blocked/flagged/mutated); top-usage leaderboards (top models, providers, users, virtual accounts, MCP servers, tools).
- **Model Metrics:** "View by" pivot — Models / Virtual Models / Users / Virtual Accounts / Teams / **Metadata** (e.g. per `customer_id`). Counters: total input/output tokens, request count, total cost USD. Charts: Requests Per Second, Failure Rate, Failures Breakdown, latency percentiles, cost of inference.

**Request logs / traces:** OpenTelemetry-compliant spans queryable via the spans API; per-trace inspection of span hierarchy; filter by time/user/trace-id/model/metadata. Export traces/metrics to **Arize, Langfuse, LangSmith, Datadog, New Relic, Honeycomb, SigNoz, Dynatrace, Splunk, Elastic, Coralogix, Grafana/Prometheus** and many more.

**Per-request perf via response headers:** `server-timing` (non-stream) breaks down middlewares/guardrails/model call durations; `x-tfy-resolved-model` tells you which target actually served (after failover); `x-tfy-applied-configurations` shows load-balancing/fallback/guardrails/rate-limit applied.

---

## Custom metadata & request/response headers (your dashboard slicing tool)

Tag every request with `X-TFY-METADATA` (stringified JSON, string keys/values, max value length 128) to slice cost/latency by `application`, `environment`, `customer_id`, etc.:

```python
stream = client.chat.completions.create(
    messages=[...],
    model="openai-main/gpt-4",
    stream=True,
    extra_headers={
        "X-TFY-METADATA": '{"application":"booking-bot","environment":"staging","customer_id":"123456"}',
    },
)
```

**Key request headers:**
| Header | Purpose |
| --- | --- |
| `Authorization: Bearer TFY_API_KEY` | Auth (PAT/VAT) |
| `x-tfy-metadata` | JSON tags for routing + metrics filtering |
| `x-tfy-provider-name` | Route to a provider account (required for Responses/Files/Batch) |
| `x-tfy-request-timeout` | Max ms to wait per model attempt (applies per fallback) — e.g. `60000` |
| `x-tfy-ttft-timeout-ms` | Max ms for **first token** in a stream; on miss returns 408 and **falls back to next model** even if 408 isn't in fallback codes — e.g. `30000` (critical for voice) |
| `x-tfy-logging-config` | `{"enabled": true}` per-request logging toggle |
| `x-tfy-guardrails` | Apply guardrail groups per request |
| `x-tfy-strict-openai` | `false` to expose Claude thinking/reasoning tokens |
| `x-tfy-mcp-headers` | Pass custom headers/auth to MCP servers |

---

## Prompt management (versioned prompts)

Define system/user messages, input variables, guardrails, and structured output once in the **Prompt Registry**, version it (auto new version on edit, GitHub-style diff, roll back, pin versions to envs), then call it by **FQN** like `chat_prompt:truefoundry/default/my-second-prompt:1`. Two ways to use:

**Server-side (gateway renders it):**
```python
stream = client.chat.completions.create(
    messages=[],
    model="",
    stream=True,
    extra_headers={"X-TFY-METADATA": '{"k":"v"}', "X-TFY-LOGGING-CONFIG": '{"enabled": true}'},
    extra_body={
        "prompt_version_fqn": "chat_prompt:truefoundry/default/my-second-prompt:1",
        "prompt_variables": {"name": "John Doe", "age": "30"},
    },
)
```

**Client-side (fetch + render locally with the TFY SDK):**
```python
from truefoundry import client, render_prompt
from openai import OpenAI

prompt_template = client.prompt_versions.get_by_fqn(
    fqn="chat_prompt:truefoundry/default/my-second-prompt:1",
).data.manifest
prompt = render_prompt(prompt_template, variables={})
response = OpenAI().chat.completions.create(
    messages=prompt["messages"],
    model=prompt.get("model") or "gpt-4o-mini",
    **(prompt.get("parameters") or {}),
)
```

Prompts can be bound to a **virtual model** for free load balancing/fallback.

---

## Caching (cut latency + cost)

Two gateway-level strategies (separate from provider prompt caching):
- **Exact-Match** — returns cached response only when the request hash is identical.
- **Semantic** — returns cached response when requests are *semantically similar* (embedding cosine similarity), even if worded differently.

A cache hit **eliminates the model call entirely** — response returns in milliseconds at **zero model cost**. You can combine gateway caching with provider prompt caching for max savings. For a voice FAQ bot, semantic caching means repeat questions answer instantly.

---

## MCP Gateway & Agent Harness (the "govern agents" story for judges)

**MCP Gateway:** one TrueFoundry key reaches every registered MCP server (Slack, Zendesk, Salesforce, HubSpot, GitHub, MongoDB, Snowflake, Databricks, Google Workspace, PagerDuty, and 30+ more), with **OAuth tokens stored and auto-refreshed per user**, full audit trail, guardrails on tool args/results, and a **Virtual MCP Server** that combines tools from multiple servers into one curated toolset. This is how a Support voice bot safely pulls user history.

**Agent Harness / Agent Registry:** build, register, serve, and govern agents on TrueFoundry — MCP tools, sandboxed code execution, subagents, human-in-the-loop pauses before sensitive tool calls, generative UI, session-managed multi-turn context, and built-in per-run traces (LLM + tool + sandbox + subagent steps with cost/tokens/latency). Inherits all gateway analytics.

For judging, the line is: **"Every model call, every tool call, and every agent step runs through one governed control plane with budgets, guardrails, and a cost/latency dashboard."**

---

## Hackathon recipes (compose with the other sponsors)

### Recipe 1 — Bulletproof voice brain (LiveKit + TrueFoundry virtual model)
Point LiveKit's `openai.LLM(base_url=...)` at the gateway and set `model` to a **latency-based or priority-based virtual model** with two targets (e.g. `groq/llama-3.3` primary, `openai-main/gpt-4o` fallback). Add `x-tfy-ttft-timeout-ms: 1500` so if the first token is slow, it instantly fails over — the user never hears dead air. **Demo flourish:** kill the primary provider's key mid-call; the agent keeps talking, and `x-tfy-resolved-model` proves the failover.

### Recipe 2 — Governed Support bot (Unsiloed + Moss + TrueFoundry + MCP)
Unsiloed parses your support PDFs/manuals → embeddings stored for **Moss** sub-10ms retrieval → retrieved chunks injected into the LLM call through the gateway. Add the **PII/PHI guardrail on LLM input AND output** so customer data is redacted in both directions. Pull the caller's ticket history via the **Zendesk/Salesforce MCP server** behind the MCP Gateway (one key, OAuth managed). Tag each call `X-TFY-METADATA: {"customer_id":"..."}` so the dashboard shows per-customer cost live.

### Recipe 3 — Voice TTS through the gateway (MiniMax / ElevenLabs / Cartesia)
Route TTS through `POST /audio/speech` (OpenAI-compatible for OpenAI/Azure/Groq) or `{GATEWAY_BASE_URL}/tts/{providerAccountName}` (native: ElevenLabs, Cartesia, Deepgram, Smallest AI, Resemble, Gemini, Vertex). STT goes through `/audio/transcriptions`. Now your entire STT→LLM→TTS pipeline is on one key with one cost dashboard — including the voice spend, not just the LLM.

### Recipe 4 — Cost/latency demo dashboard as the closing slide
Tag every request with `X-TFY-METADATA` (`environment`, `feature`, `customer_id`). Open **Model Metrics → View by: Metadata** and show RPS, p95 latency, token cost, and failure rate updating live during your demo. Pair with a **budget rule in audit mode** showing the 75/90/100% milestone alerts. This is the most credible "production-ready" signal you can put in front of YC judges in 30 seconds.

### Recipe 5 — A/B which model converts (Lead Gen, weight-based routing)
Create a virtual model splitting 50/50 between two models, run your lead-gen voice script, then compare conversion in the dashboard by virtual-account or metadata. Flip weights without redeploying.

### Recipe 6 — Multi-turn voice context (latency routing + sessions)
Use **latency-based routing** (sticky per-caller for 10-min epochs) so a single conversation stays on the same target — preserving prompt-cache and reducing jitter — and enable Session Management to track the multi-turn thread. Ideal for the Co-Pilot track's ambient agents.

---

## Gotchas / latency notes / what to demo

- **Voice TTFT is everything.** Use `x-tfy-ttft-timeout-ms` (e.g. 1000–2000ms) so a slow first token triggers failover; the gateway returns 408 and moves to the next model even if 408 isn't in your fallback codes. Set `x-tfy-request-timeout` per attempt too.
- **Latency-based routing is sticky for 10 minutes** per caller — good for cache reuse, but means a single caller won't immediately benefit from a faster target until the epoch rolls. For demos with one caller, prefer **priority-based** so failover is deterministic and visible.
- **Batch API ignores virtual models** — pass a real `provider_account/model` to `/batches`, never a virtual model name (it's rejected). Batch is async/single-provider so no fallback inside a batch.
- **Audio model IDs must match the provider account's display name** (STT/TTS), not the `provider/model` convention used for chat.
- **Google Gen AI SDK & boto3/langchain_aws don't support routing config** — if you need failover, use the OpenAI or Anthropic SDK path (or `/chat/completions` directly).
- **Budget rule usage starts at $0 on creation**, not at period start — don't expect it to match your monthly bill mid-period.
- **PAT vs VAT:** demo with a PAT, but if you'll keep the deploy alive, use a **VAT** (a PAT dies when its creator leaves the org).
- **Rate/budget rules: first match wins for allow/block.** Order matters — specific overrides on top, generic defaults at bottom.
- **Guardrail cost behavior:** input-validation failure cancels the in-flight model call (no charge); output-validation failure still incurred model cost. Roll out guardrails in **Audit → Enforce-but-ignore-on-error → Enforce**.
- **Demo the failover live:** start a call, revoke/break the primary provider, keep talking; show `x-tfy-resolved-model` flipping to the backup. Pair with the live cost dashboard. That combo is the winning "it's already production-grade" moment.

---

## 2 AM cheat-sheet (the 10 things you'll copy-paste)

1. **Base URL:** `https://gateway.truefoundry.ai`
2. **Auth header:** `Authorization: Bearer <TFY_API_KEY>` (PAT for dev, VAT for prod)
3. **Model ID format:** `provider_account/model_name` (e.g. `openai-main/gpt-4o-mini`)
4. **OpenAI SDK init:** `OpenAI(api_key="<tfy-key>", base_url="https://gateway.truefoundry.ai")`
5. **Env-var drop-in:** `export OPENAI_BASE_URL="https://gateway.truefoundry.ai"; export OPENAI_API_KEY="<tfy-key>"`
6. **LiveKit LLM swap:** `openai.LLM(model="<virtual-or-model-id>", api_key=os.getenv("OPENAI_API_KEY"), base_url=os.getenv("TRUEFOUNDRY_BASE_URL"))`
7. **List models:** `curl https://gateway.truefoundry.ai/models -H "Authorization: Bearer <tfy-key>"`
8. **Voice failover headers:** `x-tfy-ttft-timeout-ms: 1500` and `x-tfy-request-timeout: 60000`
9. **Dashboard tagging:** `extra_headers={"X-TFY-METADATA": '{"customer_id":"123","feature":"voice"}'}`
10. **Per-request guardrail:** `-H 'X-TFY-GUARDRAILS: {"llm_input_guardrails":["grp/tfy-pii"],"llm_output_guardrails":["grp/tfy-pii"]}'`

**Bonus YAML snippet — minimal priority-based virtual model with failover:**
```yaml
routing_config:
  type: priority-based-routing
  load_balance_targets:
    - target: groq/llama-3.3-70b
      priority: 0
      fallback_status_codes: ["429","500","502","503"]
    - target: openai-main/gpt-4o
      priority: 1
```

---

## Appendix — Coverage Completion (audit-driven, added 2026-06-05)

These sections fill in-scope gaps the coverage audit flagged. All values are transcribed verbatim from `raw/tf-llms-full.txt`.

### A1 — Turning caching ON: the `x-tfy-cache-config` header (HIGH)

The main Caching section explains exact vs. semantic and the zero-cost hit, but not *how to enable it*. You enable caching per-request with the **`x-tfy-cache-config`** header (a stringified JSON object). Fields:

- **`type`** — `"exact-match"` (request hash must be identical) or `"semantic"` (cosine similarity on the **last message** only; all other params — model, prior messages, temperature — are still hashed and must match exactly). Note: `semantic` is a *superset* of exact-match, so you don't need both.
- **`similarity_threshold`** — `0`–`1.0`, semantic only. **Start at `0.9`** and monitor hit rate. `0.95–1.0` = strict, `0.85–0.95` = balanced (good for chatbots/FAQ), `<0.85` = broad.
- **`ttl`** — cache lifetime in **seconds** (e.g. `600`).
- **`namespace`** — optional partition string for cache isolation. Omit (or `"default"`) for a shared pool; set to a tenant/end-user ID (e.g. `"tenant-123"`) or environment name (`"staging"`/`"production"`) to isolate. **Level 1 isolation is automatic** — every cache entry is already scoped to the user/virtual account that created it, so User A's cache is never visible to User B even on an identical request. `namespace` adds an optional Level 2 partition within that.

```bash
# Semantic cache with multi-tenant isolation
curl {GATEWAY_BASE_URL}/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-truefoundry-api-key" \
  -H "x-tfy-cache-config: {\"type\": \"semantic\", \"similarity_threshold\": 0.9, \"ttl\": 600, \"namespace\": \"tenant-123\"}" \
  -d '{"model": "openai-main/gpt-4o", "messages": [{"role": "user", "content": "How do I reset my password?"}]}'
```

Response headers confirm cache behavior: **`x-tfy-cache-status`** (`hit`/`miss`/`error`), **`x-tfy-cached-trace-id`** (trace that populated the cache, on hits), **`x-tfy-cache-similarity-score`** (e.g. `0.95`, semantic hits only).

**Why it matters for the hackathon:** Recipe 1's voice-FAQ bot was previously unactionable — this is the exact header to copy-paste so repeat questions answer in milliseconds at zero model cost, and `x-tfy-cache-status: hit` is a clean thing to show judges.

### A2 — Session Management: the `X-TFY-CONVERSATION-ID` header (HIGH)

Chat Completions is stateless — each call is independent, so multi-turn voice requests show up as unrelated logs. Pass the **`X-TFY-CONVERSATION-ID`** header on every chat-completions request in a conversation to group them into one logical session (filterable in the UI request logs). The value is any unique string per conversation (UUID, session ID); **the docs recommend UUID5**. Use a consistent ID across all turns of one conversation and generate a fresh one when a new conversation starts.

```python
stream = client.chat.completions.create(
    messages=[
        {"role": "system", "content": "You are an AI bot."},
        {"role": "user", "content": "Enter your prompt here"},
    ],
    model="test-groq-prod-key/deepseek-r1-distill-llama-70b",
    stream=True,
    extra_headers={
        "X-TFY-CONVERSATION-ID": "conv-12345",   # your unique conversation ID
        "X-TFY-LOGGING-CONFIG": '{"enabled": true}',
    },
)
```

**Why it matters for the hackathon:** This is the concrete mechanism behind Recipe 6's "Session Management" — a one-line add that makes every turn of a Co-Pilot/multi-turn voice call traceable as a single session for live debugging during the demo.

### A3 — Compaction & count-tokens endpoints for long voice sessions (MEDIUM)

Two in-scope gateway endpoints absent from the Supported-APIs table:

**`POST /responses/compact` (Compaction API)** — reduces context size while preserving state for the next turn, so quality/cost/latency stay manageable as a conversation grows. **OpenAI-only** (use the gateway's OpenAI inference base URL). Two modes:
- *Standalone:* send a full context window; it returns a compacted window containing an opaque, **encrypted compaction item** to pass as input to your next `/responses` call. Body: `model`, `input`, optionally `instructions`, `previous_response_id`. **Do not prune** the compact response — pass the full `output` into the next call as-is.
- *Server-side:* set `context_management: [{"type": "compaction", "compact_threshold": 200000}]` on `POST /responses`; the server compacts automatically when the rendered token count crosses the threshold and emits a compaction item in the stream — no separate call needed.

```python
compacted = client.responses.compact(
    model="openai-main/gpt-4o",
    input=long_input_items_array,
)
next_input = [*compacted.output, {"type": "message", "role": "user", "content": user_input_message()}]
next_response = client.responses.create(model="openai-main/gpt-4o", input=next_input, store=False)
```

**`POST /messages/count_tokens`** — counts the tokens a message would consume against the chosen model, in the **Anthropic Messages format**. Use it to budget context before a call.

**Why it matters for the hackathon:** Long ambient/Co-Pilot voice sessions blow past the context window; compaction keeps a multi-minute call coherent and cheap without you hand-rolling summarization, and count-tokens lets you guard the window proactively.

### A4 — Live / Realtime API depth: WebSocket URL + voice code (MEDIUM)

`/live` was listed but not shown. The **Realtime API** is a persistent **WebSocket** that streams text+audio bidirectionally — the native path for speech-to-speech voice assistants. The gateway proxies the WS to the provider using each provider's native SDK.

- **Connection URL:** `{GATEWAY_BASE_URL}/live/{providerAccountName}` using the **`wss://`** protocol (i.e. `wss://{GATEWAY_HOST}/live/{providerAccountName}`).
- **Providers (provider-proxy / native SDK):** Google Gemini, Google Vertex AI, OpenAI, Azure AI Foundry / Azure OpenAI. *(Bedrock does NOT support the Realtime API.)*
- **SDK to use:** `openai` SDK for OpenAI and Azure AI Foundry; `google-genai` SDK for Gemini/Vertex; `azure-ai-voicelive` as an Azure alternative.
- **Setup prerequisite:** add your realtime models to TrueFoundry via a provider account and select **Realtime** as the model type.
- Related docs pages: Live API **Code snippets** (`/docs/ai-gateway/live-api-code-snippets`) and Live API **Tool calling** (`/docs/ai-gateway/live-api-tool-calling`) — function calling *is* supported in live sessions (model returns a tool call mid-session, you send the result back to continue).

```python
# OpenAI Realtime via the gateway (pip install "openai[realtime]" numpy sounddevice)
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key="your-tfy-api-key",
    websocket_base_url="wss://{GATEWAY_HOST}/live/{openaiProviderAccountName}",
)

async with client.realtime.connect(model="gpt-4o-realtime-preview") as connection:
    await connection.session.update(session={
        "type": "realtime",
        "output_modalities": ["audio"],
        "audio": {
            "input": {
                "turn_detection": {"type": "server_vad"},
                "transcription": {"model": "gpt-4o-transcribe", "language": "en"},
            },
            "output": {"voice": "alloy"},
        },
    })
    async for event in connection:
        if event.type == "response.output_audio.delta":
            ...  # base64-decode event.delta and play it
```

**Why it matters for the hackathon:** For a *voice* event this is the lowest-latency speech-to-speech option — one governed `wss://` URL gives you OpenAI/Gemini realtime with server-side VAD and live transcription, an alternative to the STT→LLM→TTS LiveKit pipeline when you want a single realtime model.

### A5 — MCP server setup: upstream auth types & credential modes (MEDIUM)

The MCP Gateway section covered the concept; here is how you actually wire a server's **outbound** (upstream) auth when adding it. Pick by use case:

| Method | When to use | Example servers |
| --- | --- | --- |
| **OAuth2 (Authorization Code)** | Per-user access; each user authorizes their own account | Gmail, Slack, GitHub, Atlassian |
| **OAuth2 (Client Credentials)** | Server-to-server, no user interaction | Backend microservices, internal analytics |
| **API Key — Shared** | One credential serves all users | Hugging Face, DeepWiki |
| **API Key — Individual** | Each user supplies their own upstream key via Auth Overrides | Third-party per-user APIs |
| **No Auth** | Public APIs needing no auth | Calculator, public DeepWiki |
| **Token Passthrough** | Internal server validates your IdP token directly | Internal MCP server with IdP auth |
| **Token Forwarding** | Server has its own auth; client provides creds via `x-tfy-mcp-headers` | Internal MCP server from OpenAPI |

- **Shared vs. Individual credentials (API Key mode):** *Shared* = configure one key once; the Gateway injects it into every request regardless of caller. *Individual* = admin configures a `Bearer {{API_KEY}}` placeholder; each user supplies their own key through the **Auth Overrides** tab, and the Gateway injects the per-user key. (This is the concrete answer to "how do I wire per-user Zendesk/third-party auth.")
- **OAuth2 Authorization Code flow** (e.g. Slack/GitHub): user calls a tool → Gateway returns an auth error with an authorization URL → user completes consent on the third-party service → TrueFoundry stores + auto-rotates the OAuth token and injects it only when that user invokes the tool. End users authenticate **twice**: inbound to the Gateway, outbound to the third-party service.
- **MCP Server roles:** grant admins **MCP Server Manager** and normal consumers **MCP Server User**. Access control is enforced on the resolved TrueFoundry identity (user/team/virtual account) — both *which servers* and *which tools* a user may invoke.
- **Note for shared keys:** Virtual Account tokens give the same access for all requests; for servers needing user-specific access (e.g. a user's own GitHub repos) use **OAuth2 with individual user tokens** instead.

**Why it matters for the hackathon:** Recipe 2's Support bot pulls caller history through MCP — this tells you exactly which auth type to choose (OAuth2 Authorization Code for Slack/GitHub/Zendesk-style per-user data, API Key Shared for a single service account) and where users complete consent, so the integration actually works under demo pressure.
