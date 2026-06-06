# LiveKit — Voice Agent Infrastructure + Agents Framework

> Hackathon report for the Conversational AI Hackathon 2026 (Moss / YC SF, June 6-7).
> Source: local `raw/livekit-llms.txt` (index) + `raw/livekit-llms-full.txt` (~3.2MB full docs), rendered 2026-06-05.
> This is the **default way to ship a voice agent** at this hackathon. Pair it with Moss for retrieval.

---

## 1. What is LiveKit in one paragraph

**LiveKit** is an open-source framework + cloud platform for building realtime voice, video, and "physical AI" agents. It has three layers that matter here: (1) a global **WebRTC media server** (an SFU — Selective Forwarding Unit) that moves audio/video/data between participants in **rooms** with sub-second latency, plus realtime SDKs for Web, Swift, Android, Flutter, React Native, Python, Node, Rust, C++, and ESP32; (2) the **Agents framework** (Python + Node.js), a high-level orchestrator that wires together a voice pipeline — **STT → LLM → TTS** (or a single speech-to-speech realtime model) — with turn detection, VAD, interruption handling, function tools, and an extensive plugin ecosystem (Deepgram, ElevenLabs, MiniMax, OpenAI, Cartesia, Gemini, AWS, etc.); and (3) **LiveKit Cloud**, which adds hosted **Inference** (use top models with *no separate API keys*), one-command **agent deployment**, **telephony/SIP** (real inbound + outbound phone calls), and observability. The core object is the **`AgentSession`** — you give it `stt`, `llm`, `tts`, `vad`, and turn detection, call `session.start(room=..., agent=...)`, and you have a talking agent.

## 2. Why it matters for a voice-AI hackathon / which tracks

The event thesis is: *voice is cheap/fast now; retrieval is the bottleneck (Moss solves it)*. LiveKit is the **transport + agent runtime** that everyone's voice demo runs on. The judges reward fundable, real voice products — LiveKit is what makes a demo feel like a product (barge-in, natural turn-taking, phone numbers, a live frontend) instead of a request/response chatbot.

| Track | How LiveKit serves it |
| --- | --- |
| **Lead Gen** | **Outbound** SIP calls (`create_sip_participant`), answering-machine detection, warm transfer to a human, structured data capture (prebuilt `GetEmailTask`, `GetPhoneNumberTask`). The agent dials a list, qualifies, books. |
| **Support** | Inbound phone + web widget. Agent pulls docs (Moss / Unsiloed-parsed PDFs) + user history as a **function tool** or via context injection on every turn. Handoff to human on escalation. |
| **Co-Pilot (ambient)** | Agent subscribes to **room audio** (listens to a live human↔human call), runs STT + Moss retrieval on each turn, and pushes "live context" cards to a screen over the **data channel** (text streams / byte streams / RPC) — without ever speaking. This is the killer LiveKit-only demo. |

**The single most important integration to know:** Moss ships an official **Moss × LiveKit** pattern (see §10). You query Moss inside the agent's `on_user_turn_completed` hook or a function tool and inject sub-10ms results into the LLM context. That's the whole hackathon in one file.

## 3. Quickstart "hello world" — a talking agent in <10 minutes

**Requirements:** Python ≥ 3.10 (guide uses `uv`) **or** Node.js ≥ 20 (guide uses `pnpm` ≥ 10.15.0). A free [LiveKit Cloud](https://cloud.livekit.io/) account gives you Inference (no model keys needed) + deploy + media transport.

**Install the CLI and authenticate:**
```shell
brew install livekit-cli          # macOS  (Linux: curl -sSL https://get.livekit.io/cli | bash ; Windows: winget install LiveKit.LiveKitCLI)
lk cloud auth                      # opens browser, links your Cloud project to the CLI
```

**Scaffold, install, run (Python):**
```shell
lk agent init my-agent --template agent-starter-python   # clones template, writes .env.local with your keys
cd my-agent
uv sync                                                   # install deps
uv run --module livekit.agents download-files            # Silero VAD + turn-detector + noise-cancel models
uv run src/agent.py console                               # talk to it in your TERMINAL (Python only)
# or: uv run src/agent.py dev                             # connect to LiveKit + Agent Console (browser), reachable anywhere
```

**Node.js equivalent:**
```shell
lk agent init my-agent --template agent-starter-node
cd my-agent
pnpm install
npx livekit-agents download-files
pnpm dev
```

After `lk agent init`, the CLI prints a chat link (after `"To try your new agent in the web console, visit:"`) — open it and click **Start a session** to speak to your agent. The default starter pipeline is **Deepgram Nova-3 (STT) → OpenAI GPT (LLM) → Cartesia Sonic-3 (TTS)** running on LiveKit Inference, so you need **zero provider keys** to get talking.

---

## 4. The full agent file (STT-LLM-TTS pipeline) — verbatim

This is the canonical `agent.py` from the quickstart. Copy it, swap models, ship.

```python
from dotenv import load_dotenv

from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent, inference, room_io, TurnHandlingOptions
from livekit.plugins import ai_coustics, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a helpful voice AI assistant.
            You eagerly assist users with their questions by providing information from your extensive knowledge.
            Your responses are concise, to the point, and without any complex formatting or punctuation including emojis, asterisks, or other symbols.
            You are curious, friendly, and have a sense of humor.""",
        )

server = AgentServer()

@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        stt=inference.STT(model="deepgram/nova-3", language="multi"),
        llm=inference.LLM(model="openai/gpt-5.2-chat-latest"),
        tts=inference.TTS(
            model="cartesia/sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        ),
        vad=silero.VAD.load(),
        turn_handling=TurnHandlingOptions(
            turn_detection=MultilingualModel(),
        ),
    )

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(model=ai_coustics.EnhancerModel.QUAIL_VF_S),
            ),
        ),
    )

    await session.generate_reply(
        instructions="Greet the user and offer your assistance."
    )


if __name__ == "__main__":
    agents.cli.run_app(server)
```

**Node.js** splits into `main.ts` (server/session) + `agent.ts` (the `Agent` subclass):

```typescript
// main.ts
import {
  type JobContext, type JobProcess, ServerOptions, cli, defineAgent, inference, voice,
} from '@livekit/agents';
import * as livekit from '@livekit/agents-plugin-livekit';
import * as silero from '@livekit/agents-plugin-silero';
import * as aiCoustics from '@livekit/plugins-ai-coustics';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Agent } from './agent';

dotenv.config({ path: '.env.local' });

export default defineAgent({
  prewarm: async (proc: JobProcess) => { proc.userData.vad = await silero.VAD.load(); },
  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;
    const session = new voice.AgentSession({
      vad,
      stt: new inference.STT({ model: 'deepgram/nova-3', language: 'multi' }),
      llm: new inference.LLM({ model: 'openai/gpt-5.2-chat-latest' }),
      tts: new inference.TTS({ model: 'cartesia/sonic-3', voice: '9626c31c-bec5-4cca-baa8-f8ba9e84c8bc' }),
      turnHandling: { turnDetection: new livekit.turnDetector.MultilingualModel() },
    });
    await session.start({
      agent: new Agent(),
      room: ctx.room,
      inputOptions: { noiseCancellation: aiCoustics.audioEnhancement({ model: 'quailVfS' }) },
    });
    await ctx.connect();
    session.generateReply({ instructions: 'Greet the user and offer your assistance.' });
  },
});

cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: 'my-agent' }));
```
```typescript
// agent.ts
import { voice } from '@livekit/agents';
export class Agent extends voice.Agent {
  constructor() {
    super({ instructions: `You are a helpful voice AI assistant. ...` });
  }
}
```

### Realtime (speech-to-speech) variant
Swap the three models for one realtime model. Lower latency, more expressive, but you lose the text-pipeline hooks (e.g. `on_user_turn_completed` RAG injection — see Gotchas).
```python
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.plugins import openai, ai_coustics

@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(llm=openai.realtime.RealtimeModel(voice="coral"))
    await session.start(room=ctx.room, agent=Assistant(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(model=ai_coustics.EnhancerModel.QUAIL_VF_S))))
    await session.generate_reply(instructions="Greet the user and offer your assistance.")
```
The realtime variant only needs `OPENAI_API_KEY`. Default pipeline (above) needs **nothing** on Cloud.

> **Note on API surface:** newer docs use `AgentServer()` + `@server.rtc_session(agent_name=...)` + `agents.cli.run_app(server)`. The Moss sample and many existing examples use the slightly older but still-valid `WorkerOptions(entrypoint_fnc=entrypoint)` + `cli.run_app(...)` + `await ctx.connect()`. Both work in v1.x. Pick whichever your template ships with and stay consistent.

---

## 5. AgentSession — the orchestrator

`AgentSession` collects user input, runs the pipeline, invokes the LLM, plays output, and emits events. You can pass model IDs as **strings** (shorthand for Inference) instead of plugin objects:

```python
from livekit.agents import AgentSession, Agent, inference, room_io, TurnHandlingOptions
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

session = AgentSession(
    stt="deepgram/nova-3:en",                                  # string shorthand for Inference
    llm="openai/gpt-5.3-chat-latest",
    tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
    vad=silero.VAD.load(),
    turn_handling=TurnHandlingOptions(turn_detection=MultilingualModel()),
)
await session.start(
    room=ctx.room,
    agent=Agent(instructions="You are a helpful voice AI assistant."),
    room_options=room_io.RoomOptions(
        audio_input=room_io.AudioInputOptions(noise_cancellation=noise_cancellation.BVC())),
)
```

**Lifecycle states:** `initializing → listening → thinking → speaking → listening` (and `speaking → listening` on interruption). Monitor with the `agent_state_changed` event.

**Per-session state — `userdata`:** arbitrary per-session data accessible via `session.userdata` and on `RunContext.userdata` inside tools. Use a `dataclass` (Python) / typed interface (TS). Pass it at construction; you must also declare its type on the session:
```python
@dataclass
class MySessionInfo: user_name: str | None = None; age: int | None = None
session = AgentSession[MySessionInfo](userdata=MySessionInfo(), llm=...)
# inside a tool: context.userdata.user_name = name
```

### Speaking on demand
- **`session.say(text, allow_interruptions=False, add_to_chat_ctx=True)`** → synthesizes TTS, returns a `SpeechHandle`. Can also play **pre-synthesized `audio`** to skip TTS (cache fixed greetings for latency). Requires a TTS plugin (realtime models need TTS added or use `generate_reply`).
- **`session.generate_reply(instructions=...)`** → LLM generates a fresh reply (used for greetings, voicemail messages, status updates).

### Key session events (great for Co-Pilot screens / observability)
| Event | Fires when | Useful payload |
| --- | --- | --- |
| `user_input_transcribed` | user speech transcribed | `transcript`, `is_final`, `speaker_id`, `language` |
| `conversation_item_added` | a message hits chat history (user or agent) | `item` (ChatMessage, incl. per-turn `metrics`) |
| `agent_state_changed` | listening↔thinking↔speaking | new state |
| `user_state_changed` | user listening↔speaking | new state |
| `user_interruption_detected` / `agent_false_interruption` | barge-in detection | — |

```python
@session.on("user_input_transcribed")
def on_user_input_transcribed(event):
    print(f"{event.transcript} (final={event.is_final}, lang={event.language})")
```

---

## 6. Turn detection, VAD, and interruptions (the "feels natural" layer)

Turn detection decides when the **user finished** (agent may reply) and when the user **barged in** (agent yields). Modes:

| Mode | Use |
| --- | --- |
| **Turn detector model** (`MultilingualModel()` / `EnglishModel()`) | Recommended. Open-weights, context-aware model on top of VAD/STT. Listens while user speaks, replies after they finish a thought. |
| **Realtime model** | Set `turn_detection="realtime_llm"`; let OpenAI Realtime / Gemini Live handle it server-side (cheapest with realtime models). |
| **VAD only** | Silence-based, from Silero start/stop cues. |
| **STT endpointing** | Phrase endpoints from the STT provider. |
| **Manual** | Disable auto detection; control boundaries explicitly (push-to-talk). |

Recommended config (chained pipeline):
```python
from livekit.agents import AgentSession, TurnHandlingOptions
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from livekit.plugins import silero

session = AgentSession(
    turn_handling=TurnHandlingOptions(turn_detection=MultilingualModel()),
    vad=silero.VAD.load(),
    # ... stt, tts, llm
)
```

**Supporting knobs (tune for natural, low-latency turns):**
- **Endpointing delay** — `min_delay` / `max_delay` (how long to wait after speech stops before treating the turn as done). Dynamic endpointing (Python) adapts to the user's pause statistics.
- **Adaptive interruption handling** — distinguishes a true interruption from backchanneling ("mhm", "yeah").
- **`allow_interruptions`** (default `True`) — per-`say()`/per-session. Set `False` to make the agent un-interruptible while it speaks a critical line.
- **Preemptive generation** — start LLM (and optionally TTS) *before* the turn is confirmed, to cut latency:
  ```python
  session = AgentSession(turn_handling={"preemptive_generation": {
      "preemptive_tts": True, "max_speech_duration": 10.0, "max_retries": 3}})
  # disable: turn_handling={"preemptive_generation": {"enabled": False}}
  ```
- **Realtime-model turn detection** (telephony-friendly, noisy audio):
  ```python
  from openai.types.beta.realtime.session import TurnDetection
  session = AgentSession(llm=realtime.RealtimeModel(turn_detection=TurnDetection(
      type="server_vad", threshold=0.7, prefix_padding_ms=300, silence_duration_ms=400)))
  ```
  Gotcha: with a realtime model + server VAD, you **cannot** set `interruption.enabled=False` (raises `ValueError`); disable the model's `turn_detection=None` and add Silero VAD on the session instead.

**Noise cancellation:** `noise_cancellation.BVC()` (LiveKit's Background Voice Cancellation) or the `ai_coustics` enhancer improves both turn detection and STT. Remove it when self-hosting (it's a Cloud feature).

---

## 7. Function tools — call APIs, mutate state, retrieve data

Tools are how the LLM reaches the outside world (including **Moss**). Decorate methods on your `Agent`.

**Python:**
```python
from typing import Any
from livekit.agents import function_tool, Agent, RunContext

class MyAgent(Agent):
    @function_tool()
    async def lookup_weather(self, context: RunContext, location: str) -> dict[str, Any]:
        """Look up weather information for a given location.
        Args:
            location: The location to look up weather information for.
        """
        return {"weather": "sunny", "temperature_f": 70}
```

**Node.js** (Zod schema):
```typescript
import { voice, llm } from '@livekit/agents';
import { z } from 'zod';
class MyAgent extends voice.Agent {
  constructor() {
    super({ instructions: 'You are a helpful assistant.',
      tools: {
        lookupWeather: llm.tool({
          description: 'Look up weather information for a given location.',
          parameters: z.object({ location: z.string().describe('The location ...') }),
          execute: async ({ location }, { ctx }) => ({ weather: 'sunny', temperatureF: 70 }),
        }),
      },
    });
  }
}
```

**Calling an HTTP API from a tool** (the pattern you'll use for Moss-over-HTTP, your own backend, Unsiloed, etc.):
```python
import aiohttp
from livekit.agents import Agent, RunContext, function_tool
from livekit.agents.llm import ToolError

class StockAgent(Agent):
    @function_tool()
    async def get_stock_price(self, context: RunContext, symbol: str) -> dict:
        """Get the current stock price for a given ticker symbol.
        Args:
            symbol: The stock ticker symbol, for example AAPL or GOOGL.
        """
        url = f"https://livekit-stock-api.vercel.app/api/quote?symbol={symbol}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise ToolError(f"Could not fetch stock price for {symbol}.")
                data = await response.json()
                return {"symbol": data["symbol"], "price": data["price"]}
```

**Key tool facts (memorize):**
- **Docstring = LLM description; type hints = arg schema.** Be specific about when to use the tool.
- **Return value** is stringified and fed back to the LLM. Return `None` to complete silently.
- **Mutating tools:** call `context.disallow_interruptions()` (Python) / `ctx.speechHandle.allowInterruptions = false` (Node) at the start so a barge-in can't leave a half-finished write (order, charge, email).
- **`flags=ToolFlag.IGNORE_ON_ENTER`** excludes a tool from the greeting `generate_reply`.
- **Handoff:** return `(NewAgent(), "result")` (Python) / `llm.handoff({agent, returns})` (Node) to switch agents mid-session.
- **Verbal status updates:** for slow tools (>~0.5s), kick off a `session.generate_reply("tell the user you're searching")` so the user isn't left in silence. (Or use `AsyncToolset` which handles progress automatically.)
- **MCP:** the agent can be an MCP client — point it at an MCP server to expose its tools (Moss also ships an MCP server). **Forwarding:** tools can be fulfilled by the frontend over RPC (`registerRpcMethod`).

---

## 8. External data & RAG — two injection patterns

This is the heart of a Moss build. Two ways to get retrieved context into the LLM:

### Pattern A — Tool call (LLM decides when to search)
Define a `search_knowledge_base` function tool; the LLM calls it when it thinks it needs context. Flexible, but adds an LLM round-trip of latency and the LLM might not call it.

### Pattern B — Context injection on every turn (recommended for voice; lower latency)
Override **`on_user_turn_completed`** — runs **after** STT, **before** the LLM generates. Inject retrieved context directly. No extra LLM round-trip. **Only works on STT-LLM-TTS pipelines** (needs the user turn as text — realtime models don't expose it).
```python
from livekit.agents import ChatContext, ChatMessage

async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
    rag_content = await my_rag_lookup(new_message.text_content)   # e.g. Moss query
    turn_ctx.add_message(
        role="assistant",
        content=f"Additional information relevant to the user's next message: {rag_content}")
```

### Initial context at session start
Greet by name / preload a profile before connecting:
```python
initial_ctx = ChatContext()
initial_ctx.add_message(role="assistant", content=f"The user's name is {user_name}.")
await session.start(room=ctx.room, agent=Assistant(chat_ctx=initial_ctx))
```
**Load-time optimizations (don't make the user wait):** load static data in the **prewarm** function; pass user-specific data via **job metadata / room metadata / participant attributes** instead of fetching in the entrypoint; if you must fetch, do it **before `ctx.connect()`** so the frontend doesn't show the agent before it's listening.

---

## 9. Rooms, participants, tracks, data channels — the realtime primitives

A **room** holds **participants** (humans, agents, SIP callers, avatars), each publishing **tracks** (audio/video/data). The agent joins the room as a participant. Server-side management uses `RoomServiceClient` / `api.LiveKitAPI()` (reads `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` from env).

### Frontend connection token (with auto agent dispatch)
Your backend mints a JWT so a browser/mobile client can join. Embedding a `RoomConfiguration` auto-dispatches your named agent into the room on connect:
```python
from livekit.api import AccessToken, RoomAgentDispatch, RoomConfiguration, VideoGrants

token = (AccessToken()
    .with_identity("my_participant")
    .with_grants(VideoGrants(room_join=True, room="my-room"))
    .with_room_config(RoomConfiguration(
        agents=[RoomAgentDispatch(agent_name="my-agent", metadata='{"user_id":"12345"}')]))
    .to_jwt())
```
For zero-backend prototyping, use the LiveKit Cloud **sandbox token server**. Frontends: `agent-starter-react` (Next.js), SwiftUI, Android, Flutter, React Native, and a `<script>`-tag **Web Embed widget**. The React `useVoiceAssistant` / Agents-UI Shadcn components give you a transcript + audio visualizer + mic controls out of the box.

### Data channel → push live context to a screen (Co-Pilot's core move)
Three ways for the agent to send arbitrary data to frontends in the same room:

**Text streams** (chat, transcripts, JSON cards) — chunked & streamed, no size limit:
```python
# agent side
info = await ctx.room.local_participant.send_text(
    '{"type":"context_card","title":"Refund policy","body":"30 days w/ receipt"}',
    topic='copilot-context')
```
```typescript
// frontend (livekit-client)
room.registerTextStreamHandler('copilot-context', (reader, participantInfo) => {
  reader.readAll().then((text) => renderCard(JSON.parse(text)));
});
```

**Byte streams** — files/images. Agent can `room.local_participant.send_file(file_path=..., topic="agent-images")`; frontend registers a byte-stream handler. Use for diagrams/screenshots.

**RPC** — request/response between participants, and **tool-call forwarding** (LLM manipulates the UI). Register on one side, call from the other:
```python
@ctx.room.local_participant.register_rpc_method("greet")
async def handle_greet(data):       # data.caller_identity, data.payload
    return f"Hello, {data.caller_identity}!"
```
```typescript
const res = await room.localParticipant.performRpc({ destinationIdentity, method, payload });
```

**State sync:** **participant attributes** (per-participant key-value store) and **room metadata** (shared state for all). Great for passing the user's account ID / call state to the agent and for syncing UI.

---

## 10. ⭐ Moss × LiveKit — grounding a voice agent in your index (the winning recipe)

Moss ships an **official LiveKit sample** and an explicit "Voice Agent (LiveKit)" guide. This is the exact pattern judges will recognize as "retrieval done right." Two stages: build an index once, then inject Moss results on every user turn.

**Install + env:**
```bash
pip install moss python-dotenv
```
```bash
# .env
LIVEKIT_URL=ws://localhost:7880      # devkey/secret for local; use Cloud URL+keys for deploy
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
MOSS_PROJECT_ID=your-moss-id
MOSS_PROJECT_KEY=your-moss-key
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=your-deepgram-key
```

**Build the index once (`build_index.py`):**
```python
import asyncio, os
from dotenv import load_dotenv
from moss import MossClient, DocumentInfo
load_dotenv()

async def main():
    client = MossClient(project_id=os.environ["MOSS_PROJECT_ID"], project_key=os.environ["MOSS_PROJECT_KEY"])
    index_name = os.getenv("MOSS_INDEX_NAME", "product-knowledge")
    docs = [
        DocumentInfo(id="1", text="Our return policy allows returns within 30 days of purchase with a receipt."),
        DocumentInfo(id="2", text="Standard shipping takes 3-5 business days. Express shipping takes 1-2 days."),
        DocumentInfo(id="3", text="Technical support is available 24/7 via email at support@example.com."),
    ]
    await client.create_index(index_name, docs, model_id="moss-minilm")
asyncio.run(main())
```

**The agent — context-injection pattern (`agent.py`), verbatim from Moss docs:**
```python
import asyncio, logging, os
from dotenv import load_dotenv
from livekit.plugins import openai, deepgram, silero
from livekit.plugins.turn_detector.english import EnglishModel
from livekit.agents import (
    JobContext, WorkerOptions, cli, ChatContext, ChatMessage, Agent, AgentSession,
)
from moss import MossClient, QueryOptions          # <-- Moss

load_dotenv()
MOSS_PROJECT_ID = os.getenv("MOSS_PROJECT_ID")
MOSS_PROJECT_KEY = os.getenv("MOSS_PROJECT_KEY")
INDEX_NAME = os.getenv("MOSS_INDEX_NAME", "product-knowledge")
logger = logging.getLogger("moss-agent")

class MossSemanticRetrievalAgent(Agent):
    def __init__(self, moss_client: MossClient):
        super().__init__(instructions="""
            You are a helpful customer support voice assistant.
            You have access to a knowledge base which will be provided to you as context.
            Always answer the user's question based on the provided context.
            If the context doesn't contain the answer, politely say you don't know.
        """)
        self.moss = moss_client

    async def on_user_turn_completed(self, turn_ctx: ChatContext, new_message: ChatMessage) -> None:
        user_query = new_message.text_content
        try:
            results = await self.moss.query(INDEX_NAME, user_query, QueryOptions(top_k=5, alpha=0.8))  # sub-10ms
            if results.docs:
                context_str = "\n".join([f"- {d.text}" for d in results.docs])
                turn_ctx.add_message(role="system",
                    content=f"Relevant context from knowledge base:\n{context_str}\n\nUse this to answer the user.")
        except Exception as e:
            logger.error(f"Moss search failed: {e}", exc_info=True)
        await super().on_user_turn_completed(turn_ctx, new_message)

async def entrypoint(ctx: JobContext):
    await ctx.connect()
    moss_client = MossClient(project_id=MOSS_PROJECT_ID, project_key=MOSS_PROJECT_KEY)
    await moss_client.load_index(INDEX_NAME)          # load once into memory at call start
    session = AgentSession(
        stt=deepgram.STT(),
        llm=openai.LLM(model="gpt-4o"),
        tts=openai.TTS(),
        turn_detection=EnglishModel(),
        vad=silero.VAD.load(),
    )
    await session.start(agent=MossSemanticRetrievalAgent(moss_client), room=ctx.room)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```
**Run:**
```bash
livekit-server --dev          # terminal 1 (local LiveKit)
python build_index.py         # once
python agent.py download-files
python agent.py console       # terminal 2 — talk to it
```

**Why context-injection beats tool-calling for voice (Moss's own framing):** Moss is queried automatically on *every* user message; results are injected before the LLM generates — so the LLM **always** has relevant context with **no "should I search?" round-trip**, which is faster and more consistent. Because Moss returns in **sub-10ms**, this hides entirely under STT/LLM latency.

**Moss `query` signature you'll copy:** `await client.query(index_name, text, QueryOptions(top_k=5, alpha=0.8))` → returns `.docs` each with `.id`, `.text`, `.score`. `alpha` blends semantic vs keyword (hybrid). JS/Node: `new MossClient(PROJECT_ID, PROJECT_KEY); await client.query(index, q, { topK: 3 })`.

**Alternative — tool-call pattern with Moss** (when you want the LLM to choose, e.g. multiple indexes):
```python
@function_tool()
async def search_knowledge_base(self, context: RunContext, query: str) -> str:
    """Search the product knowledge base. Use for any question about policies, shipping, or support."""
    results = await self.moss.query(INDEX_NAME, query, QueryOptions(top_k=3, alpha=0.8))
    return "\n".join(d.text for d in results.docs) or "No relevant info found."
```

**Live-call context (perfect for Co-Pilot + Support memory):** Moss separates **long-term** context (persistent cloud index — FAQs, policies, profile; `load_index()` once) from **short-term** session context (the live transcript; `client.session(index_name=call_id)`, `session.add_docs([...turns...])`, `session.query(...)`, `session.push_index()` at call end). Inject transcript turns into a Moss session as they happen, then query **both** the knowledge index and the live session each turn for the model — true "remembers the whole call" behavior at sub-10ms.

---

## 11. Models — Inference (no keys) + plugins (your keys)

**LiveKit Inference** (Cloud) gives you OpenAI, Google, AssemblyAI, Deepgram, Cartesia, ElevenLabs, and more with **no separate API keys**, billed through Cloud, run on LiveKit infra to minimize latency. Reference by string `provider/model[:variant]` or via `inference.STT/LLM/TTS`.

**Default quickstart pipeline:** STT `deepgram/nova-3` · LLM `openai/gpt-5.x-chat-latest` · TTS `cartesia/sonic-3`. Other STT seen in docs: `deepgram/flux-general`, `assemblyai/universal-streaming`. LLMs include `google/gemini-3-flash-preview`, `google/gemini-2.5-flash-lite`, etc.

**Suggested Inference voice IDs (copy-paste):**
- Cartesia Jacqueline (en-US): `cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc`
- Cartesia Blake (en-US, energetic male): `cartesia/sonic-3:a167e0f3-df7e-4d52-a9c3-f949145efdab`
- Deepgram Athena (en-US female): `deepgram/aura-2:athena`
- ElevenLabs Chris (en-US male): `elevenlabs/eleven_turbo_v2_5:iP95p4xoKVk53GoZ742B`
- Rime Astra (en-US female): `rime/arcana:astra`

**Custom voices / voice clone:** upload or record a sample → LiveKit clones it across supported Inference TTS providers → use in any session (`tts/custom-voices`). Great for a branded demo voice.

**Plugins** (your own provider key; use for features not in Inference or to manage billing). Install Python: `uv add "livekit-agents[<provider>]~=1.5"`; Node: `pnpm add "@livekit/agents-plugin-<provider>@1.x"`.

### MiniMax TTS plugin (sponsor)
Python-only plugin. Good emotional/multilingual TTS.
```bash
pip install "livekit-agents[minimax]~=1.5"
```
```python
from livekit.plugins import minimax
session = AgentSession(tts=minimax.TTS(
    # model=..., voice=..., emotion="happy", speed=1.0, english_normalization=True
), llm=..., stt=...)
```
Set **`MINIMAX_API_KEY`** in `.env`. Params: `model`, `voice`, `emotion` (`happy|sad|angry|fearful|disgusted|surprised|neutral`), `speed` (0.5–2.0), `pronunciation_dict`, `english_normalization` (better numbers/dates, small latency cost). Package: `livekit-plugins-minimax-ai`.

### Other sponsor-relevant plugins
- **Deepgram** STT/TTS (`pip install "livekit-agents[deepgram]"`, `DEEPGRAM_API_KEY`) — Python + Node.
- **ElevenLabs** STT/TTS — Python + Node — high-quality voices, supports language switching.
- **OpenAI** — LLM + STT + TTS + **Realtime API** (`openai.realtime.RealtimeModel`).
- **AWS** — Bedrock LLM, Polly TTS, Transcribe STT, **Nova Sonic** realtime (`integrations/aws`).
- **Gemini Live API**, **xAI Grok Voice**, **Nova Sonic** — speech-to-speech realtime options.

**Fallbacks** (resilience for a 21-hour demo): `inference.STT(model="deepgram/nova-3", fallback=[{"model":"assemblyai/universal-streaming"}])`; same on TTS. Runs server-side — no retry code needed.

---

## 12. Telephony / SIP — real phone calls (Lead Gen + Support)

LiveKit bridges traditional phone networks (Twilio, Telnyx, Plivo, Wavix, Sinch) to rooms via SIP trunks. You can also **buy phone numbers directly** through LiveKit. Connectors exist for **WhatsApp** voice and Twilio.

**Inbound (Support):** create an **inbound trunk** + a **dispatch rule** that routes calls into a room and dispatches your named agent. The caller becomes a SIP participant; your normal `AgentSession` runs. Prebuilt telephony tasks: `GetDtmfTask` (keypad), `WarmTransferTask`, and tools like `EndCallTool` / `send_dtmf_events`.

**Outbound (Lead Gen):** create a SIP participant from the agent to dial out:
```python
from livekit.protocol.sip import SIPOutboundConfig
await ctx.api.sip.create_sip_participant(
    api.CreateSIPParticipantRequest(
        trunk=SIPOutboundConfig(
            hostname=os.getenv("SIP_TRUNK_HOSTNAME"),
            auth_username=os.getenv("SIP_AUTH_USERNAME"),
            auth_password=os.getenv("SIP_AUTH_PASSWORD")),
        sip_number="<SIP provider number>",
        room_name=ctx.room.name,
        sip_call_to=phone_number,
        participant_identity=participant_identity,
        wait_until_answered=True,
    ))
await ctx.wait_for_participant(identity=participant_identity)
```
(You can pass a stored `sip_trunk_id` / env `LIVEKIT_SIP_OUTBOUND_TRUNK` instead of inline config. Node: `new SipClient(url,key,secret).createSipParticipant(...)`.)

**Answering Machine Detection (AMD)** — classify human vs voicemail vs IVR, then branch (leave a voicemail, navigate IVR, or talk):
```python
from livekit.agents import AMD
async with AMD(session, participant_identity=participant_identity) as detector:
    # ... create_sip_participant(...) then:
    result = await detector.execute()
    if result.category in ("human", "uncertain"):  ...     # normal conversation
    elif result.category == "machine-vm":                  # leave a message, then ctx.shutdown(...)
```
**Warm transfer** to a human (with a spoken context summary), **cold transfer** via SIP REFER, **DTMF** send/receive, **HD voice**, region pinning. Recipes: IVR Navigator, Company Directory, Survey Caller, Recording Consent.

---

## 13. Deploy to LiveKit Cloud (Agents Cloud)

From your project root, one command:
```shell
lk agent create
```
This generates `Dockerfile`, `.dockerignore`, and `livekit.toml`, registers the agent with your Cloud project, and deploys it. Manage with `lk agent` commands (deployments, secrets, logs). Features: **secrets management**, **runtime logs** + **log drains** (Datadog, CloudWatch, Sentry, New Relic, Splunk, syslog), multi-region agent deployment, **Insights** (audio recordings, transcripts, traces, metrics in the Cloud console), and **data hooks** for collecting recordings/transcripts/metrics from the SDK.

**Startup modes:** `console` (Python, terminal), `dev` (testing, reachable anywhere via Agent Console), `start` (production: `uv run src/agent.py start` / `pnpm build && pnpm start`). **Dispatch:** automatic on room connect (named agent + RoomConfiguration), or explicit via `AgentDispatchService` (`lkapi.agent_dispatch.create_dispatch(...)`).

**Self-host alt:** run open-source LiveKit server (`livekit-server --dev` locally), set up a custom deployment, remove the Cloud-only noise-cancellation plugin, and bring your own provider plugins. **AWS hosting:** containerize and run on ECS/EKS/Fargate (it's a standard Docker image); or use the AWS model plugins (Bedrock/Polly/Transcribe/Nova Sonic) with Inference replaced.

---

## 14. Hackathon recipes (compose with sponsors)

Stack legend: **Unsiloed** = PDF parse/ingest · **Moss** = sub-10ms retrieval · **LiveKit** = voice transport + agents · **MiniMax/ElevenLabs** = TTS/voice-clone · **TrueFoundry** = LLM gateway/govern · **AWS** = hosting.

**R1 — Support bot that pulls docs + user history (Support).**
Unsiloed parses your help-center PDFs → chunks indexed into a Moss index (`product-knowledge`). LiveKit agent uses the §10 context-injection pattern: `on_user_turn_completed` → `moss.query(...)` (knowledge) **and** `session.query(...)` (this call's transcript) → inject both. LLM via TrueFoundry gateway (governed/observable); TTS via MiniMax or ElevenLabs. Deploy with `lk agent create`. Demo escalation: a `transfer_to_human` tool returns a `WarmTransferTask`/handoff.

**R2 — Outbound lead-gen caller (Lead Gen).**
A script dials a CSV of leads via `create_sip_participant` with AMD: on voicemail, `generate_reply` leaves a tailored message and `ctx.shutdown`; on human, qualify using prebuilt `GetEmailTask`/`GetPhoneNumberTask`, retrieve the prospect's company facts from Moss to personalize, and book via a `create_event` tool. Branded voice = MiniMax emotion or a LiveKit custom voice clone. Each call's outcome is `session.push_index()`-ed back to Moss for the next call.

**R3 — Ambient Co-Pilot for live calls (Co-Pilot) — the LiveKit-only flex.**
The agent joins a human↔human (or human↔customer) room but **never speaks** (no TTS / `allow_interruptions` irrelevant — it's a silent listener). It subscribes to room audio, runs STT, and on each `user_input_transcribed` / `on_user_turn_completed`: (a) `moss.query()` the knowledge base + a live `session` index of the running transcript, (b) push **context cards** to the rep's screen via `send_text(topic="copilot-context")`. The Next.js frontend registers a text-stream handler and renders cards in real time. Add `register_rpc_method` so the rep can click "insert into CRM." Sub-10ms Moss means cards appear before the rep finishes their sentence.

**R4 — Phone IVR replacement that actually understands (Support/Lead Gen).**
Inbound trunk + dispatch rule → agent answers, `GetDtmfTask` for keypad fallback, Moss retrieval for policy answers, `Company Directory` recipe (SIP REFER) to transfer to the right department by intent. Telephony-tuned realtime turn detection (`threshold=0.7`, `silence_duration_ms=400`) for noisy phone audio.

**R5 — Multilingual support with live language switch.**
STT `deepgram/nova-3` with `language="multi"` + `MultilingualModel()` turn detector. Moss `alpha` hybrid search keeps retrieval robust across languages. ElevenLabs/MiniMax TTS switches voice/language per detected `event.language`. One agent, any caller.

**R6 — Vision + voice co-pilot (Co-Pilot).**
Frontend shares screen/camera; agent samples video frames into chat context (or uses Gemini Live / Nova Sonic realtime vision). Agent retrieves doc context from Moss and sends annotated images back via byte streams (`send_file`). "Point your phone at the error and I'll walk you through it."

---

## 15. Gotchas / latency notes / what to demo

**Latency wins (most impactful first):**
- **Use Inference + string model IDs** → models run on LiveKit infra, no extra hop, no key juggling. Default Deepgram→OpenAI→Cartesia is already tuned.
- **Context injection > tool calls** for retrieval — Pattern B skips an LLM round-trip. Moss's sub-10ms hides under STT/LLM latency. Tool-call RAG adds a full LLM turn.
- **Preemptive generation** (`preemptive_tts: True`) starts thinking before the turn is confirmed.
- **Cache fixed phrases:** pre-synthesize greetings and play via `session.say(text, audio=...)`.
- **Fetch before `ctx.connect()`** and use **prewarm** for static data; pass user data via metadata/attributes, not entrypoint fetches.

**Footguns:**
- **`on_user_turn_completed` only fires on STT-LLM-TTS pipelines.** If you switch to a realtime model, your Moss-injection RAG silently stops working (no text turn). Either keep the chained pipeline or move retrieval to a function tool.
- **Realtime model + server VAD:** you can't disable interruptions via session config (raises `ValueError`); tune the model's own `turn_detection` instead.
- **Mutating tools without `disallow_interruptions()`** can half-execute on barge-in (double charge, double order). Always guard writes.
- **`download-files` is required** before first run (Silero VAD, turn detector, noise-cancel weights) or the agent errors on load.
- **Noise cancellation (`BVC` / ai_coustics) is a Cloud feature** — remove it when self-hosting or it won't load.
- **Agent name must match** between `@server.rtc_session(agent_name="my-agent")`, the Agent Console field, and any `RoomAgentDispatch` — mismatches = agent never joins.
- **Local dev** uses `LIVEKIT_URL=ws://localhost:7880`, `devkey`/`secret`. Don't ship those — swap to Cloud creds for the deployed demo.
- **Two API styles** (`AgentServer`/`@server.rtc_session` vs `WorkerOptions`/`entrypoint_fnc`) both work in v1.x; don't mix them in one file.

**What to demo (judges love these):**
1. **Barge-in** — interrupt the agent mid-sentence; it stops instantly and adapts. Proves real WebRTC turn-taking, not request/response.
2. **Sub-10ms retrieval visibly grounding the answer** — ask something only in your Moss index; agent answers with the exact policy, instantly. Show the injected context in logs/Insights.
3. **A real phone call** — dial your demo number live on stage (or have it call a judge). Telephony = "this is a product."
4. **The Co-Pilot screen** — context cards appearing on a second screen as someone talks, with zero spoken latency. Uniquely LiveKit.
5. **Voice clone** — clone a teammate's voice (MiniMax / custom voice) for a memorable brand moment.

---

## 16. Cheat-sheet — the 10 things you'll copy-paste at 2am

```bash
# 1. Install CLI + auth + scaffold (Python)
brew install livekit-cli && lk cloud auth
lk agent init my-agent --template agent-starter-python && cd my-agent
uv sync && uv run --module livekit.agents download-files
uv run src/agent.py console        # talk in terminal | dev = browser console | start = prod

# 2. Deploy
lk agent create                    # writes Dockerfile + livekit.toml, registers + deploys
```
```python
# 3. Minimal AgentSession (Inference, no keys)
session = AgentSession(
    stt="deepgram/nova-3:en", llm="openai/gpt-5.3-chat-latest",
    tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
    vad=silero.VAD.load(),
    turn_handling=TurnHandlingOptions(turn_detection=MultilingualModel()))
await session.start(room=ctx.room, agent=Assistant())

# 4. Moss RAG injected every turn (the winning pattern)
async def on_user_turn_completed(self, turn_ctx, new_message):
    r = await self.moss.query(INDEX_NAME, new_message.text_content, QueryOptions(top_k=5, alpha=0.8))
    if r.docs:
        turn_ctx.add_message(role="system",
            content="Context:\n" + "\n".join(f"- {d.text}" for d in r.docs))
    await super().on_user_turn_completed(turn_ctx, new_message)

# 5. Function tool (HTTP API / Moss / your backend)
@function_tool()
async def search_kb(self, ctx: RunContext, query: str) -> str:
    """Search the knowledge base for policies and product info."""
    r = await self.moss.query(INDEX_NAME, query, QueryOptions(top_k=3, alpha=0.8))
    return "\n".join(d.text for d in r.docs) or "No info found."

# 6. Speak / greet
await session.say("Hi, how can I help?", allow_interruptions=False)
await session.generate_reply(instructions="Greet the user by name.")

# 7. Push live context to a frontend screen (Co-Pilot)
await ctx.room.local_participant.send_text(json.dumps(card), topic="copilot-context")

# 8. Listen to transcripts (Co-Pilot / logging)
@session.on("user_input_transcribed")
def _(e): print(e.transcript, e.is_final, e.language)

# 9. Outbound phone call (Lead Gen)
await ctx.api.sip.create_sip_participant(api.CreateSIPParticipantRequest(
    sip_trunk_id=os.getenv("LIVEKIT_SIP_OUTBOUND_TRUNK"),
    room_name=ctx.room.name, sip_call_to=phone_number,
    participant_identity="caller", wait_until_answered=True))

# 10. Frontend join token w/ auto agent dispatch
token = (AccessToken().with_identity("user")
    .with_grants(VideoGrants(room_join=True, room="my-room"))
    .with_room_config(RoomConfiguration(agents=[RoomAgentDispatch(agent_name="my-agent")]))
    .to_jwt())
```
**Plugin installs:** `uv add "livekit-agents[deepgram,openai,silero,minimax]~=1.5"` (Python) · `pnpm add "@livekit/agents-plugin-openai@1.x"` (Node). **Env you'll set:** `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`, `MOSS_PROJECT_ID` / `MOSS_PROJECT_KEY`, plus any plugin keys (`DEEPGRAM_API_KEY`, `OPENAI_API_KEY`, `MINIMAX_API_KEY`). **Voice IDs:** Cartesia `cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc` · Deepgram `deepgram/aura-2:athena` · ElevenLabs `elevenlabs/eleven_turbo_v2_5:iP95p4xoKVk53GoZ742B`.

---

## Appendix — Coverage Completion (audit-driven, added 2026-06-05)

> Added to close the in-scope gaps the coverage audit flagged in `audit/livekit.md`. Values are quoted from `raw/livekit-llms-full.txt`. The body above is the battle-pack; this appendix is the reference depth for structured flows, testing, metrics, and the pipeline/turn-handling knobs.

### A1. Workflows + Tasks + TaskGroup + Supervisor pattern

The framework's structured-flow primitive. **`AgentTask`** is a focused, reusable unit that takes temporary control of the session, runs its own LLM loop + tools, and returns a **typed result** via `self.complete(result)`. Define one by subclassing `AgentTask[ResultType]` (Python generics) and starting its interaction in `on_enter`.

```python
from livekit.agents import AgentTask, function_tool

class CollectConsent(AgentTask[bool]):          # typed result: bool
    def __init__(self, chat_ctx=None):
        super().__init__(instructions="Ask for recording consent; get a clear yes or no.", chat_ctx=chat_ctx)

    async def on_enter(self) -> None:
        await self.session.generate_reply(instructions="Ask for permission to record; make clear they can decline.")

    @function_tool
    async def consent_given(self) -> None:
        """Use this when the user gives consent to record."""
        self.complete(True)

    @function_tool
    async def consent_denied(self) -> None:
        """Use this when the user denies consent."""
        self.complete(False)
```

A task may **only be awaited from one of three call sites**: `on_enter`, `on_exit`, or a **tool function body** (awaiting elsewhere raises `RuntimeError`). Await it to get the typed result:
```python
async def on_enter(self) -> None:
    if await CollectConsent(chat_ctx=self.chat_ctx):     # task runs, returns bool
        await self.session.generate_reply(instructions="Offer your assistance.")
    else:
        job_ctx = get_job_context()
        await job_ctx.api.room.delete_room(api.DeleteRoomRequest(room=job_ctx.room.name))
```

**`TaskGroup`** (Python, `livekit.agents.beta.workflows`; experimental) runs an **ordered sequence** of tasks that share one conversation context and supports **regression** (users can return to earlier steps to correct input). Add tasks via factories; `await` returns a `TaskGroupResult` keyed by task `id`:
```python
from livekit.agents.beta.workflows import GetEmailTask, TaskGroup

task_group = TaskGroup(chat_ctx=self.chat_ctx)
task_group.add(lambda: GetEmailTask(),   id="get_email_task",   description="Collects the user's email")
task_group.add(lambda: GetCommuteTask(), id="get_commute_task", description="Records commute flexibility")
results = await task_group                       # TaskGroupResult
print(results.task_results)
# {"get_email_task": GetEmailResult(email="john.doe@gmail.com"), "get_commute_task": CommuteResult(...)}
```
`TaskGroup` params: `summarize_chat_ctx` (default `True` — merges the group's exchange into one summary message back to the controlling agent), `chat_ctx` (pass the agent's context for continuity), `return_exceptions` (default `False` — `True` keeps going on a sub-task error), `on_task_completed` (async callback receiving `TaskCompletedEvent` with `agent_task`/`task_id`/`result`). The `description` is shown to the LLM so it knows when to regress to a prior task.

**Choosing a pattern** (from the Workflows guide — start with one agent + tools; split only on a concrete limitation):

| Pattern | Session control | Context | Best for |
| --- | --- | --- | --- |
| **Single agent + tools** | One agent for the whole session | Full context retained | Simple flows, few tools, no distinct phases |
| **Supervisor pattern** | One agent stays in control; tasks take temporary control, return typed result | Supervisor keeps full context; task gets a scoped copy | One agent coordinating reusable sub-ops (data collection, verification) |
| **Agent handoffs** | Control transfers fully to a new agent | Explicit: pass `chat_ctx`, summarize, or start fresh | Distinct roles / model specialization / permission boundaries |
| **Task groups** | TaskGroup orchestrates an ordered sequence | Shared in group, summarized on completion | Ordered multi-step collection where users revisit earlier steps |

**Supervisor pattern:** a long-lived `Agent` (the supervisor) routes discrete work to `AgentTask` specialists, most commonly via **one function tool per task** whose body instantiates and awaits the task, then returns the typed result to the LLM. The supervisor sets the conversational tone and stays aware of the whole call; specialists handle narrow work. Treat task results as **untrusted input** — validate before continuing. Split signals to watch for: instruction bloat, conflicting tool access, multi-turn data collection, backtracking.

*Why it matters for the hackathon:* this is the canonical, reliable way to build multi-step Lead-Gen qualification and Support intake flows — typed results mean structured data capture you can log to a CRM, and a supervisor handles mid-conversation intent changes without one giant prompt.

### A2. Prebuilt tasks — turnkey structured data capture (Python, BETA)

Ready-made `AgentTask`s in `livekit.agents.beta.workflows`. Await them from a function tool (or inside a `TaskGroup`); each returns a typed result dataclass.

| Task | Returns / purpose |
| --- | --- |
| `GetNameTask` | First/middle/last (configurable), `verify_spelling`, phonetic-alphabet handling → `GetNameResult(first_name, middle_name, last_name)` |
| `GetEmailTask` | Normalizes spoken email ("dot"→`.`, spelled-out words) → `GetEmailResult(email_address)` |
| `GetAddressTask` | Complete mailing address, international formats |
| `GetDOBTask` | Date of birth, optional time of birth |
| `GetPhoneNumberTask` | Normalizes spoken digits, international formats |
| `GetCreditCardTask` | Runs a task group: cardholder name, card number, CVC, expiration |
| `GetDtmfTask` | Keypad (DTMF) or spoken digits — IVR menus, PIN entry |
| `WarmTransferTask` | Dials a human via SIP, plays hold music, hands off context |

```python
from livekit.agents.beta.workflows import GetNameTask
name = await GetNameTask(first_name=True, last_name=True, verify_spelling=True,
                         chat_ctx=self.chat_ctx,
                         extra_instructions="This is for a medical record, accuracy is critical.")
```
**Customization:** every task accepts `extra_instructions` (appended to the built-in prompt), `chat_ctx` (pass the agent's so the task sees prior turns and summarizes back), `require_confirmation` (read value back; defaults `True` for audio / `False` for text), and often a `tools` list to add/substitute function tools. The beta **`InstructionParts(persona=..., extra=...)`** type customizes a task's default prompt without rewriting it (leave a field unset = keep default; empty string = remove that section):
```python
from livekit.agents.beta.workflows import GetEmailTask, InstructionParts
task = GetEmailTask(instructions=InstructionParts(persona="You are Aria from Acme Support.", extra="..."))
```

*Why it matters for the hackathon:* drop-in, voice-hardened collection for the Lead-Gen "qualify + book" and Support "verify identity" demos — they already handle the messy spoken-input edge cases (spelling, "dot"/"dash", confirmation) that otherwise eat your build time.

### A3. Testing & evaluation framework (pytest / Vitest + LLM judges)

Behavioral testing for agents. Install `pytest pytest-asyncio` (Python) or `vitest` (Node). Create an `AgentSession`, `await session.start(Assistant())`, then drive turns with `session.run(user_input=...)`, which returns a `RunResult` with a fluent assertion API.

```python
import pytest
from livekit.agents import AgentSession, inference

@pytest.mark.asyncio
async def test_greeting() -> None:
    async with (
        inference.LLM(model="openai/gpt-5.3-chat-latest") as llm,
        AgentSession(llm=llm) as session,
    ):
        await session.start(Assistant())
        result = await session.run(user_input="Hello")
        result.expect.next_event().is_message(role="assistant")        # sequential assertions
        result.expect.next_event().is_function_call(name="lookup_weather")
        result.expect.no_more_events()
```

**LLM judges** — eight built-in factories in `livekit.agents.evals`: `accuracy_judge`, `coherence_judge`, `conciseness_judge`, `handoff_judge`, `relevancy_judge`, `safety_judge`, `task_completion_judge`, `tool_use_judge`. Run a multi-turn conversation, then evaluate the whole `ChatContext` with `JudgeGroup` (the `llm` arg accepts an `LLM` or a model string like `"openai/gpt-4o-mini"`):
```python
from livekit.agents.evals import JudgeGroup, accuracy_judge, task_completion_judge, tool_use_judge
judges = JudgeGroup(llm="openai/gpt-4o-mini",
                    judges=[task_completion_judge(), accuracy_judge(), tool_use_judge()])
result = await judges.evaluate(session.history)
assert result.all_passed, f"Some judges failed: {result.judgments}"
```
`EvaluationResult` exposes `score` (pass=1, maybe=0.5, fail=0), `all_passed`, `any_passed`, `majority_passed`, `none_failed`, and `judgments[name]` (verdict `"pass"|"fail"|"maybe"`, `reasoning`). **Production wiring:** when `JudgeGroup.evaluate()` runs inside a job context (e.g. an `on_session_end` callback) it tags the session as **`lk.judge.<name>:<verdict>`** so verdicts surface in LiveKit Cloud; in pytest the tagging silently no-ops. **Mock tools** (Python, requires Agents ≥ 1.2.6):
```python
from livekit.agents import mock_tools
with mock_tools(Assistant, {"lookup_weather": lambda: RuntimeError("Weather service unavailable")}):
    result = await session.run(user_input="What's the weather in Tokyo?")
    await result.expect.next_event(type="message").judge(llm, intent="Should inform the user an error occurred.")
```

*Why it matters for the hackathon:* "we tested and measured it" is a credibility win — `task_completion_judge` + `tool_use_judge` give judges a concrete reliability story, and `mock_tools` lets you demo graceful failure (API down → agent apologizes) without flaky live calls.

### A4. Metrics / observability API (live latency + cost readout)

Per-plugin metrics fire as `MetricsCollectedEvent`; log them in one line. (The **session-level** `metrics_collected` event and `UsageCollector`/`UsageSummary` are **deprecated** — use `session_usage_updated` / `session.usage` for usage, and `MetricsCollectedEvent` per-plugin for latency.)

```python
from livekit.agents import metrics, MetricsCollectedEvent

@session.on("metrics_collected")
def _on_metrics(ev: MetricsCollectedEvent):
    metrics.log_metrics(ev.metrics)      # ev.metrics is STT/LLM/TTS/VAD/EOU/InterruptionMetrics
```
Cumulative per-model usage for cost/billing exports:
```python
from livekit.agents import SessionUsageUpdatedEvent

@session.on("session_usage_updated")
def _on_usage(ev: SessionUsageUpdatedEvent):
    for u in ev.usage.model_usage:       # also available any time via session.usage.model_usage
        print(f"{u.provider}/{u.model}: {u}")
```
**Key latency metrics** (the ones to put on a demo screen):
- `EOUMetrics.end_of_utterance_delay` — end-of-speech (VAD) → user turn considered complete (includes `transcription_delay`); `on_user_turn_completed_delay` — time spent in your RAG hook. *(Not emitted under server-side turn detection.)*
- `LLMMetrics.ttft` (time to first token), `duration`, `prompt_tokens` / `completion_tokens` / `prompt_cached_tokens` / `total_tokens`, `tokens_per_second`.
- `STTMetrics.audio_duration` / `duration` / `streamed`; `VADMetrics.inference_duration_total`; `InterruptionMetrics` (barge-in latency). For realtime models, `RealtimeModelMetrics` replaces `LLMMetrics` (`ttft` is time-to-first-audio-token, can be negative/`-1`).

*Why it matters for the hackathon:* a live "EOU delay 320ms · LLM TTFT 410ms" readout is the strongest proof that your barge-in and Moss-injection latency story is real, not vibes.

### A5. Fallback API — the documented adapter form

Two layers. **Inference Fallback** (server-side, list a primary + `fallback=[...]` on `inference.STT/TTS`, as in §11) restarts the request on the next provider on any error. For **LLM fallback or non-Inference providers**, use the **Agent Fallback Adapter** in your process — `stt.FallbackAdapter` / `llm.FallbackAdapter` / `tts.FallbackAdapter` (first instance is primary):
```python
from livekit.agents import llm, stt, tts
from livekit.plugins import assemblyai, cartesia, deepgram, inworld, openai

session = AgentSession(
    stt=stt.FallbackAdapter([deepgram.STT(), assemblyai.STT()]),
    llm=llm.FallbackAdapter([openai.responses.LLM(model="gpt-4o"), openai.LLM.with_azure(model="gpt-4o")]),
    tts=tts.FallbackAdapter([cartesia.TTS(...), inworld.TTS(...)]),
)
```
Node: `new stt.FallbackAdapter({ sttInstances: [...] })`, `new llm.FallbackAdapter({ llms: [...] })`, `new tts.FallbackAdapter({ ttsInstances: [...] })`. **Partial-output guards:** STT switches on any error; **TTS** won't switch mid-utterance once audio has played; **LLM** raises rather than restarting once text/tool-calls have streamed — set `retry_on_chunk_sent=True` to allow mid-stream fallback.

*Why it matters for the hackathon:* this is the correct API name (the report's inline `fallback=[{...}]` is the Inference variant; the adapter is what you need for LLM resilience during a 21-hour build).

### A6. Pipeline nodes & hooks — the override points

`Agent` exposes nodes you override (call `Agent.default.<node>()` to keep default behavior). **Lifecycle hooks:** `on_enter()`, `on_exit()`, `on_user_turn_completed()` (after STT, before LLM — the Moss-injection point), `on_user_turn_exceeded()`. **STT-LLM-TTS pipeline nodes:** `stt_node()` (transcribe; strip filler words), `llm_node()` (inference; structured-output parsing), `tts_node()` (synthesize; pronunciation, volume, CoT-stripping). **Realtime node:** `realtime_audio_output_node()` (adjust output audio). **Transcription:** `transcription_node()` (access word timestamps via `TimedString.start_time`/`end_time`, or adjust transcripts before they reach the user).
```python
async def stt_node(self, audio: AsyncIterable[rtc.AudioFrame], model_settings: ModelSettings):
    events = Agent.default.stt_node(self, audio, model_settings)   # default + your pre/post processing
    return events
```
Adjust agent **speech volume** by adding a processor to `tts_node` (pipeline) or `realtime_audio_output_node` (realtime).

*Why it matters for the hackathon:* `tts_node`/`llm_node` are where you strip a realtime model's chain-of-thought before TTS, cache LLM-generated speech, or do per-word UI highlighting — small overrides that make a demo feel polished.

### A7. Background audio — ambient + "thinking" sounds

`BackgroundAudioPlayer` plays on a separate audio track and can auto-sync ambient/thinking sounds to the session lifecycle. Built-in clips: `BuiltinAudioClip.OFFICE_AMBIENCE`, `KEYBOARD_TYPING`, `KEYBOARD_TYPING2`.
```python
from livekit.agents import BackgroundAudioPlayer, AudioConfig, BuiltinAudioClip

background_audio = BackgroundAudioPlayer(
    ambient_sound=AudioConfig(BuiltinAudioClip.OFFICE_AMBIENCE, volume=0.8),
    thinking_sound=[                                   # plays while agent is in "thinking" state
        AudioConfig(BuiltinAudioClip.KEYBOARD_TYPING, volume=0.8),
        AudioConfig(BuiltinAudioClip.KEYBOARD_TYPING2, volume=0.7),
    ],
)
await background_audio.start(room=ctx.room, agent_session=session)   # after connect + session start
background_audio.play("/path/to/sound.mp3", loop=False)             # on-demand
await background_audio.aclose()                                      # stop + clean up
```
A list with `probability` (sum < 1 allows silence) avoids repetitive effects. Node: `new voice.BackgroundAudioPlayer({ ambientSound, thinkingSound })` + `.start({ room, agentSession })` / `.close()`.

*Why it matters for the hackathon:* a "thinking" keyboard-typing sound during a slow Moss/RAG/tool call hides latency and reads as intentional product polish on stage.

### A8. Audio customization — pronunciation map, SSML, volume

Fix pronunciation of acronyms/proper nouns with the built-in **`text_transforms.replace()`** streaming transform on `AgentSession` (buffers across token boundaries, so it works even when a term is split across chunks):
```python
from livekit.agents import AgentSession, text_transforms

session = AgentSession(
    stt="deepgram/nova-3:en", llm="openai/gpt-5.3-chat-latest", tts="cartesia/sonic-3",
    tts_text_transforms=[
        "filter_emoji", "filter_markdown",          # both applied by default if unset; None disables all
        text_transforms.replace({"LiveKit": "Live Kit", "API": "A P I", "SQL": "sequel"}),
    ],
)
```
For regex/conditional/context-dependent pronunciation, override `tts_node`. Many TTS providers also accept **SSML** (`<break>` tags etc.) for pause/timing control. **Volume:** add a processor to `tts_node` (or `realtime_audio_output_node`), or adjust playback volume in the frontend SDK.

*Why it matters for the hackathon:* one `replace()` map keeps the agent from mangling your product name, "Moss", or domain acronyms — a small detail judges notice immediately.

### A9. Text & transcriptions — text-only and hybrid sessions

The agent monitors the **`lk.chat`** text-stream topic for inbound text; frontends send via `room.localParticipant.sendText(text, { topic: 'lk.chat' })`. Inject text and reply from the agent with **`session.generate_reply(user_input="...")`**. Disable text input with `text_input=False` in `RoomOptions` (Python) / `textEnabled: false` (Node). **Text-only session** (no audio tracks published):
```python
session.start(room_options=RoomOptions(audio_input=False, audio_output=False))
```
**Hybrid** (toggle live, e.g. a mic switch over RPC):
```python
session.input.set_audio_enabled(False)    # stop listening
session.output.set_audio_enabled(False)   # stop speaking
# re-enable later: session.input.set_audio_enabled(True)
```
For different system prompts per modality, see modality-aware instructions (`Instructions` object).

*Why it matters for the hackathon:* gives the Co-Pilot a text path and a chat fallback when audio is unavailable — and an accessibility story for judges.

### A10. Turn-handling options reference (the canonical knobs)

Consolidated `TurnHandlingOptions` field list (Python; Node uses camelCase + ms):

| Option | Controls | Default |
| --- | --- | --- |
| `turn_detection` | How the session decides the user is done (turn-detector model / VAD / STT endpointing / realtime LLM / manual) | Auto-selected |
| `endpointing.min_delay` | Min silence before closing the turn (VAD: `max(VAD silence, min_delay)`) | `0.5 s` |
| `endpointing.max_delay` | Max wait before forcing the turn closed | `3.0 s` |
| `endpointing.mode` | `"fixed"` vs `"dynamic"` (adapts to session pause stats) | `"fixed"` |
| `interruption.enabled` | Master toggle; `False` = uninterruptible | `True` |
| `interruption.mode` | `"adaptive"` (audio model distinguishes real interruptions from backchannel) vs `"vad"` | `"adaptive"` if available |
| `interruption.min_duration` | Min speech duration to count as an interruption | `0.5 s` |
| `interruption.min_words` | Min word count (requires STT) | `0` |
| `interruption.false_interruption_timeout` | Silence window before a detected interruption is classified false | `2.0 s` |
| `interruption.resume_false_interruption` | Resume interrupted speech after the false-interruption timeout | `True` |
| `preemptive_generation.enabled` | Start LLM as soon as a final transcript arrives | `True` |
| `preemptive_generation.preemptive_tts` | Also start TTS preemptively | `False` |
| `preemptive_generation.max_speech_duration` | Skip preemptive gen for utterances longer than this | `10.0 s` |
| `preemptive_generation.max_retries` | Cap on preemptive attempts per turn | `3` |

On a false VAD interruption with no transcript, the agent fires `agent_false_interruption` after `false_interruption_timeout` and (if `resume_false_interruption=True`) resumes from where it left off. With a realtime model + server VAD, `interruption.enabled` must stay `True`; tune the model's own `threshold`/`silence_duration_ms` instead.

*Why it matters for the hackathon:* this table is the tuning cheat-sheet for "feels natural" — telephony likes higher `min_words`/`silence_duration_ms`; preemptive generation is your biggest latency lever.

### A11. Events & error handling reference

Beyond the session events in §5: **`function_tools_executed`** (`FunctionToolsExecutedEvent`) fires after all tools run for a turn — `function_calls`, `function_call_outputs`, `has_tool_reply`, `has_agent_handoff`, plus `zipped()`, `cancel_tool_reply()`, `cancel_agent_handoff()`. **`speech_created`** (`SpeechCreatedEvent`) fires for new agent speech — `source` is `"say"` / `"generate_reply"` / `"tool_response"`, plus `speech_handle`. **`close`** (`CloseEvent`) fires when the session ends — `reason` is `error` / `job_shutdown` / `participant_disconnected` / `user_initiated` / `task_completed`, plus `error`.

**Error handling** — `AgentSession` emits `ErrorEvent` (`error` with a **`recoverable`** field, `source` = LLM/STT/TTS/RealtimeModel, `model_config`):
```python
@session.on("error")
def on_error(ev):
    if not ev.error.recoverable:                 # retries exhausted — intervene
        session.say("Sorry, I'm having trouble right now. Let me try again.")
```
If `recoverable=True` the event is informational; pair with the FallbackAdapter (A5) for automatic provider failover.

*Why it matters for the hackathon:* `ErrorEvent.recoverable=False` + a presynthesized "I'm having trouble" line is the difference between a demo that dies on a provider blip and one that recovers gracefully on stage.

### A12. MCP / Async tools / Toolsets

**MCP (agent as client):** use **`MCPToolset`** in the `tools` list (the older `mcp_servers=[...]` on `Agent`/`AgentSession` is deprecated — toolset IDs aren't stable across sessions). Connect over HTTP with `MCPServerHTTP` or to a local process with `MCPServerStdio`:
```python
from livekit.agents import Agent, mcp

agent = Agent(instructions="You are a helpful assistant.", tools=[
    mcp.MCPToolset(id="my-api",
        mcp_server=mcp.MCPServerHTTP("https://your-mcp-server.com/mcp")),   # /mcp → streamable HTTP, /sse → SSE
])
# local: mcp.MCPServerStdio(command="npx", args=["-y", "@modelcontextprotocol/server-filesystem", "/path"])
```
Pass `headers={...}` for auth; scope exposed tools with `allowed_tools=[...]`. **Async/background tools** (Python) run long work without blocking conversation — subclass `AsyncToolset`, use `AsyncRunContext`, and push progress with `ctx.update(...)` (the agent speaks each update). `on_duplicate_call` modes: `"confirm"` (default), `"allow"`, `"replace"`, `"reject"`.
```python
from livekit.agents.llm.async_toolset import AsyncRunContext, AsyncToolset

class BookingToolset(AsyncToolset):
    def __init__(self): super().__init__(id="booking")

    @function_tool()
    async def book_flight(self, ctx: AsyncRunContext, origin: str, destination: str, date: str) -> str:
        """Book a flight for the user."""
        await ctx.update(f"Searching flights from {origin} to {destination} on {date}.")  # agent narrates
        flights = await search_flights(origin, destination, date)
        return f"Booked! Confirmation: {(await confirm_booking(flights[0])).id}"
```

*Why it matters for the hackathon:* Moss ships an MCP server, so `MCPToolset` is the clean wiring to expose its tools; async tools keep the agent talking through slow bookings/searches instead of going silent.

### A13. Server webhooks & events (call-lifecycle triggers)

LiveKit Cloud / self-hosted servers POST **webhooks** to your backend on room/participant lifecycle events — use them to trigger CRM logging, start/stop side processes, or kick off outbound flows. Requests use `Content-Type: application/webhook+json` and carry a signed JWT in the `Authorization` header (sha256 of the body); validate with the server SDK's receiver:
```typescript
import { WebhookReceiver } from 'livekit-server-sdk';
const receiver = new WebhookReceiver('apikey', 'apisecret');
// express: app.use(express.raw({ type: 'application/webhook+json' }))
app.post('/webhook-endpoint', async (req, res) => {
  const event = await receiver.receive(req.body, req.get('Authorization'));  // WebhookEvent
});
```
**In-scope events:** `room_started` (first participant joins), `room_finished`, `participant_joined` (fires when state → `active`, i.e. media connected), `participant_left`, `participant_connection_aborted`, `track_published` / `track_unpublished`. Each payload includes `room` / `participant` plus `id`, `createdAt`, `event`. Self-host enables them via the `webhook:` config section; Cloud via **Settings → Webhooks**. *(`egress_*` / `ingress_*` events exist but are out of scope here.)*

*Why it matters for the hackathon:* `participant_joined` / `room_finished` are the hooks for "log every call to the CRM" and "trigger post-call summary push to Moss" — the lifecycle glue around a Lead-Gen or Support demo.
