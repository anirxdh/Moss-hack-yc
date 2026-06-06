# LiveKit — Pain Points, Limitations & Whitespace

> Research for the Conversational AI Hackathon 2026 (Moss / YC SF, June 6-7).
> Sources: (A) our docs report `docs/LIVEKIT.md` + raw `raw/livekit-llms-full.txt` (line cites below); (B) GitHub issues, LiveKit community forum, Reddit/HN-adjacent comparison blogs, vendor post-mortems (URLs below).
> Lens: where a **Moss-powered voice build** can exploit a gap LiveKit leaves open.

---

## What LiveKit itself can't (yet) do — product limits (cited from docs)

These are honest constraints pulled straight from LiveKit's own docs (`raw/livekit-llms-full.txt`).

**Retrieval / RAG pipeline coupling (the one that matters most for Moss):**
- **`on_user_turn_completed` only fires on STT-LLM-TTS pipelines.** The recommended low-latency "inject Moss on every turn" pattern *silently stops working* if you switch to a realtime (speech-to-speech) model, because realtime models don't expose the user turn as text before generating (raw L369, L687; docs report §8, §15). So you must choose: low-latency realtime voice **OR** the clean per-turn retrieval hook — not both out of the box.
- **Realtime models give no interim transcripts, and transcripts arrive *after* the agent's reply** — "user input transcriptions can be considerably delayed and often arrive after the agent's response" (raw L32281-32283). That breaks any retrieval/co-pilot logic that needs the user's words *before* the model responds.
- **Realtime models can't speak from a script** (`say()` not honored exactly) and **only load call history as text**, losing emotional/verbal cues; OpenAI Realtime even starts replying in text-only after loading long history (raw L32285-32291).

**Memory / persistence:**
- **No built-in memory across calls.** Every `AgentSession` starts with an empty chat context; cross-session memory is "implement your own DB or bolt on Zep/Mem0" (community: <https://community.livekit.io/t/how-to-implement-message-persistence-and-resume-conversations-with-a-livekit-agent/62>; docs <https://docs.livekit.io/agents/build/persistence/>). LiveKit gives you the *transcript stream*, not the *memory layer*.

**Realtime-model footguns:**
- Realtime model + server VAD → **can't disable interruptions via session config** (raises `ValueError`); you must tune the model's own `turn_detection` instead (raw L284, docs report §6).
- **`gemini-3.1-flash-live-preview` has known compatibility limits**: `update_instructions()` unsupported mid-session, so **agent handoffs via `session.update_agent()` don't work**; affective dialog, proactive audio, and async function calling all unsupported (raw L32404-32417). Multi-agent architectures break on this model.
- **PersonaPlex realtime**: no function calling/tools, no conversation history, audio-only (no vision) (raw L33468-33472).

**Agent Builder (the no-code on-ramp) is heavily limited:**
- No workflows/handoffs/tasks, **no virtual avatars, no vision, no realtime models, no model plugins, no tests** (raw L3579-3590). It's a POC tool you must "graduate" out of into code.

**Web Embed widget limits:**
- Only **one widget per page**; can't override dashboard capabilities/room/dispatch; LiveKit-Cloud-only; domain allowlist has **no full-wildcard and no `https://example.com` bare-domain match** under leading-subdomain wildcards (raw L3727-3742, L3797-3805).

**Node.js is a second-class citizen:**
- **`FallbackAdapter` (auto failover for LLM/STT/TTS) is missing in Node.js** — Python-only (issue <https://github.com/livekit/agents-js/issues/868>). The doc-touted "resilience for a 21-hour demo" fallback feature is a Python privilege.
- `collect()` on streams "**is not yet available in Node.js**" (raw L15405).

**Self-hosting strips features:**
- **Noise cancellation (`BVC` / ai_coustics) is a Cloud-only feature** — remove it when self-hosting or it won't load (raw L286, L691).
- **`load_fnc`/`load_threshold` worker tuning params can't be changed on LiveKit Cloud** (raw L19355) — you trade control for managed hosting.
- Adaptive interruption handling: full/unlimited only on Cloud; local dev is capped (40k free inference req/mo) (raw L14302, L20833).

**Telephony gaps:**
- **DTMF / warm-transfer / prebuilt intake tasks (`GetEmailTask`, `GetCreditCardTask`, `WarmTransferTask`, etc.) are all BETA** (raw L17133-17895) — "API might change."
- Many SIP failure categories (`USER_REJECTED`, `SIP_TRUNK_FAILURE`) only surface at dial time, not after answer (<https://docs.livekit.io/sip/making-calls/>).

**Tool-loop & misc constraints:**
- `max_tool_steps` default **3** consecutive tool calls per turn, then a forced final reply (raw L7904) — long agentic chains get truncated.
- Turn-detector model needs a **compute-optimized CPU instance** (<500MB RAM, but burstable t3/t4g instances cause "inference timeouts due to CPU credit limits") (raw L13995).
- `mcp_servers` param on AgentSession/Agent is **deprecated** in favor of `MCPToolset` (raw L11514).
- v0.x → v1.0 was a **hard breaking migration**: `VoicePipelineAgent`/`MultimodalAgent` deprecated, `@llm.ai_callable` → `@function_tool`, transcription protocol replaced, `user_started/stopped_speaking` events removed (<https://docs.livekit.io/agents/v1/start/v0-migration/>). And the report itself flags **two coexisting API styles** (`AgentServer`/`@server.rtc_session` vs `WorkerOptions`/`entrypoint_fnc`) you "must not mix" (docs report §4, §15).

---

## What users struggle with / complain about (with URLs)

**1. Turn detection / interruptions are *the* recurring pain.**
- Agent **starts speaking before the user finishes**, especially for slow speakers, mid-thought pauses, and filler words ("emmm", "uhh"). Devs tried Silero VAD + parameter tuning + `MultilingualModel` and still couldn't fix it; issue closed as "question" with **no resolution** (<https://github.com/livekit/agents/issues/3373>).
- **Interruption logic is shared across thinking + speaking states and can't be tuned independently** — you can't make an agent "hard to interrupt but still friendly to slow speakers" (<https://github.com/livekit/agents/issues/3427>; LiveKit's own framing: <https://livekit.com/blog/adaptive-interruption-handling>).
- Agent gets stuck **marked "speaking" while producing no audio**, causing long unnatural silences (<https://github.com/livekit/agents/issues/3418>).

**2. Latency — much worse in the real world than the demo.**
- **Cloud deployment (EU) ~doubles latency**: ~2s local → 4s+ deployed (<https://github.com/livekit/agents/issues/4053>).
- **Telephony doubles latency again** — "unbearable" in phone contexts (<https://github.com/livekit/agents/issues/3685>).
- **Google STT (Chirp 3) ~2.4s latency on short utterances** ("hi"/"yes") because the plugin doesn't expose `voice_activity_timeout` (<https://github.com/livekit/agents/issues/4053> thread / related STT issues).
- **Measuring latency is itself broken**: metrics collapse to the endpointing floor without VAD in `turn_detection="stt"` mode (<https://github.com/livekit/agents/issues/5669>); `on_user_turn_completed_delay` (where your Moss/RAG call lives) is **excluded from the reported e2e latency** (<https://github.com/livekit/agents/issues/3236>).

**3. Multi-participant rooms degrade hard.**
- A second participant joining causes **severe latency + a "queueing" effect** where the agent answers the *previous* question, not the current one (search-surfaced agents issue; corroborated downstream by Pipecat <https://github.com/pipecat-ai/pipecat/issues/3218>). LiveKit's primitives are tuned for 1:1 agent↔user, not multi-human rooms with an ambient agent — exactly the Co-Pilot scenario.

**4. Outbound SIP is fragile.**
- **Agent greeting never reaches the callee until they speak first** on self-hosted outbound SIP — `session.say()`/`generate_reply()` audio shows in transcript but is silent on the phone until the human says "hello." Kills welfare-check/healthcare use cases where the agent must speak first. Open, unresolved (<https://github.com/livekit/livekit/issues/4378>).
- **Audio artifacts (clipping, high-pitch) on T-Mobile** via the SIP bridge transcoding — clean on direct carrier API, broken through LiveKit. No roadmap answer; **native LiveKit outbound phone numbers not yet available** (<https://community.livekit.io/t/outbound-sip-audio-artifacts-on-carrier-phones-t-mobile-is-livekit-phone-numbers-outbound-on-the-roadmap-soon/512>).

**5. RAG latency in voice is a known, unsolved bottleneck.**
- LiveKit ships a whole "Handling RAG Delays" recipe full of *stall tactics* (play a "let me check" filler) because retrieval lookups visibly stall the conversation (<https://docs.livekit.io/recipes/rag-delay/>). A practitioner write-up details how naive RAG makes a LiveKit agent feel laggy (<https://medium.com/@jorge.jarne/lessons-from-implementing-rag-in-a-real-time-voice-agent-livekit-43f0689bf565>). There's even a research paper proposing a dual-agent "Slow Thinker / Fast Talker" + semantic cache to hide the latency (<https://arxiv.org/html/2603.02206v2>). **This is precisely the gap Moss's sub-10ms retrieval erases** — and almost nobody knows it yet.

**6. "You must use the whole stack" + steep learning curve.**
- LiveKit "works best when you use the entire LiveKit stack; mixing transport layers is cumbersome" and demands a networking mental model, vs Pipecat being "extremely intuitive for Python devs" and Vapi being plug-and-play (<https://www.assemblyai.com/blog/vapi-vs-pipecat-vs-livekit>, <https://www.f22labs.com/blogs/difference-between-livekit-vs-pipecat-voice-ai-platforms/>). You write more code for a working agent than with competitors.

**7. Pricing is consumption-based and unpredictable.**
- "Usage charges often exceed base subscription costs"; agent-session minute + participant minute + per-model inference stack up and are hard to budget (<https://checkthat.ai/brands/livekit/pricing>, <https://www.forasoft.com/blog/article/livekit-vs-agora-cost-analysis>).

**8. Debugging is a black box without heavy instrumentation.**
- "The hard part is pinpointing root cause: model, transcription, network, or turn detection — usually meant stitching data together by hand." A small ASR error cascades through the pipeline and is hard to trace (<https://blog.livekit.io/streamline-troubleshooting-with-agent-observability/>; third-party tooling has sprung up: Hamming, Cekura, f22labs guides). LiveKit's own Observability is **beta**.

---

## Whitespace & unmet needs

1. **A drop-in memory layer for voice agents.** LiveKit has no cross-call memory; the market answer today is "go integrate Zep/Mem0 yourself." A Moss-backed session+long-term memory module that *just works* per phone number / per user is open space. Moss already separates long-term index from short-term live-session context — that's literally the missing primitive.

2. **Retrieval that doesn't stall the conversation.** Everyone is writing filler-phrase hacks and dual-agent caching papers to hide RAG latency. Sub-10ms Moss retrieval injected at `on_user_turn_completed` removes the stall entirely — the recipe LiveKit wrote to *cope* with the problem becomes unnecessary.

3. **The realtime-model retrieval blind spot.** Speech-to-speech models are the future for latency/expressiveness but they kill the text-turn RAG hook. A side-channel that runs STT-only-for-retrieval in parallel with a realtime model (feeding Moss results in via instructions/context) is genuinely missing.

4. **Ambient / multi-party co-pilot reliability.** LiveKit's 1:1 tuning degrades with multiple humans in a room. A purpose-built "silent listener that retrieves and pushes context cards" — robust to multi-participant queueing — is wide open (and it's the LiveKit-only flex the report calls out).

5. **Turn-taking that respects slow speakers and domain pacing.** The single most-complained-about issue. A retrieval-aware endpointing layer (use Moss to predict whether the user's utterance is a complete, answerable intent before committing to reply) is unexplored.

6. **Outbound voice that's actually reliable + observable.** Greeting-doesn't-play and carrier audio artifacts are unsolved; native outbound numbers don't exist. A thin reliability/observability wrapper around outbound campaigns has real demand.

---

## → Idea seeds for the hackathon (Moss-powered openings)

1. **"Memory dial-tone" — persistent voice memory keyed to a phone number.**
   A LiveKit agent that, on every inbound/outbound call, loads a per-caller Moss long-term index (past calls, preferences, open issues) *before `ctx.connect()`*, and `push_index()`-es the new transcript at hangup. Fills the #1 whitespace (no built-in cross-call memory) with the exact primitive Moss ships. Demo: call twice, second call it remembers everything — instantly, sub-10ms.

2. **"No-stall RAG" support bot that kills the filler-phrase hack.**
   Take LiveKit's own "Handling RAG Delays" recipe and *delete the stall tactics* — inject Moss at `on_user_turn_completed` so answers are grounded with zero perceptible lag. Side-by-side demo against a vanilla vector-DB agent that has to say "let me check…" Judges immediately feel the difference. This is the single sharpest "voice is cheap, retrieval is the bottleneck — solved" narrative.

3. **Ambient Co-Pilot hardened for the multi-party failure.**
   A silent agent in a human↔human room that runs STT + Moss retrieval and pushes context cards via `send_text(topic="copilot-context")` — explicitly engineered around the multi-participant queueing degradation (per-speaker `speaker_id` routing, no TTS contention). Turns a known LiveKit weakness into the demo's spine.

4. **Realtime-voice + retrieval bridge.**
   Run a speech-to-speech realtime model for expressiveness/latency, *plus* a parallel STT-only tap whose transcripts hit Moss; feed results back via `generate_reply(instructions=...)`/context. Solves the documented "realtime models break the RAG hook" footgun that everyone hits — a genuinely novel architecture that maps to a research-paper-shaped problem.

5. **Retrieval-aware turn detection ("is this a complete intent?").**
   Before the agent commits to replying, query Moss with the partial utterance: if it maps cleanly to a known intent/answer, respond; if it's ambiguous/incomplete, wait. Directly attacks the most-complained-about pain (premature interruption of slow speakers) using retrieval, not just VAD timing.

6. **Outbound lead-gen caller with a Moss "objection brain" + reliability guardrails.**
   AMD-gated outbound dialer that, on a live human, retrieves the prospect's company facts + the best rebuttal for each objection from Moss in real time, and logs every call back into Moss for the next attempt. Bonus: build in a greeting-confirmation handshake to dodge the known "agent greeting not heard until callee speaks" SIP bug.

---

### 5-line summary + 2 sharpest seeds

1. **Turn detection / interruptions** are the #1 unresolved user pain — agents talk over slow speakers and filler words, and the interruption logic can't be tuned independently (issues #3373, #3427, #3418).
2. **Real-world latency is far worse than the demo** — Cloud deploy ~doubles it, telephony doubles it again, and LiveKit's own latency metrics exclude the RAG hook (issues #4053, #3685, #3236).
3. **RAG visibly stalls voice** — LiveKit ships filler-phrase "stall tactic" recipes and there are research papers just to hide retrieval latency; this is exactly what Moss's sub-10ms erases.
4. **No built-in cross-call memory** and **realtime models silently break the per-turn retrieval hook** — both leave a clean primitive-shaped hole Moss fits.
5. **Outbound SIP is fragile** (greeting not heard until callee speaks; T-Mobile audio artifacts; no native outbound numbers) and **Node.js lacks Python's FallbackAdapter**.

**Sharpest seed #1 — "No-stall RAG" bot:** delete LiveKit's own RAG-delay filler hacks by injecting Moss at `on_user_turn_completed`; demo side-by-side vs a "let me check…" vanilla agent. Cleanest embodiment of the event thesis.
**Sharpest seed #2 — "Memory dial-tone":** per-phone-number persistent voice memory via Moss long-term index + per-call session push — fills LiveKit's missing cross-call memory primitive; "call back and it remembers everything, instantly."
