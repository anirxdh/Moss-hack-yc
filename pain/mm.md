# MiniMax — Pain Points, Limitations & Whitespace

> Research for Conversational AI Hackathon 2026 (Moss / YC SF, Jun 6–7). Two-source synthesis: (A) honest constraints from our report `docs/MINIMAX.md` + the raw doc dump `raw/mm-llms-full.txt`; (B) real-world user struggles from GitHub issues, forums, reviews, blogs. Cited throughout. The point: find gaps a Moss-powered voice build can exploit.

---

## What MiniMax itself can't (yet) do  (product limits, cited to docs)

### The big one for voice agents: no native STT, no realtime duplex
- **No native Speech-to-Text / ASR endpoint in the developer API.** The API surface is LLM + TTS (T2A) + voice clone/design + music + video + image + files — and *nothing else*. There is no transcription/ASR endpoint. (Confirmed against `platform.minimax.io/docs/api-reference/api-overview`; `raw/mm-llms-full.txt` lists only these capabilities, lines ~1091–1543.) Vendor/aggregator marketing pages claim "near-real-time STT," but that's the **consumer Hailuo/Audio app**, not the API you build on. → **You must bring your own STT (Deepgram/Whisper/AssemblyAI) for any voice agent.**
- **No realtime/duplex speech-to-speech API and no built-in barge-in/interruption.** T2A is one-directional (text in → audio out). Streaming exists (WebSocket `wss://api.minimax.io/ws/v1/t2a_v2`) but it's output-only; turn-taking, VAD, and interruption are entirely on you / your transport layer (LiveKit, Pipecat). (api-overview + `docs/MINIMAX.md` §1b.)

### Tight rate limits (brutal for a live demo or any scale)
- Video **5 RPM**, Image **10 RPM**, Voice Design **20 RPM**, T2A + Voice-Clone **60 RPM**, Music **120 RPM**; LLM M3 **200 RPM**, M2.x **500 RPM** (`raw/mm-llms-full.txt` §Rate Limits ~5923–5993; `docs/MINIMAX.md` §Gotchas). Async TTS query endpoint capped at **10 queries/sec** (raw ~1700). To raise limits you must **email api@minimax.io** — no self-serve tier bump.

### LLM "thinking" can't be turned off where you most need it
- **M2.x models cannot disable thinking.** `thinking:{"type":"disabled"}` and `reasoning:{"effort":"none"}` are *accepted but ignored* — reasoning still runs (raw ~1632, ~2183, ~2197, ~2475). Only **M3** can disable thinking. For tool-calling/agent loops this is a latency tax you cannot opt out of on the cheaper models.
- **Thinking blocks must be re-appended to history unchanged** in multi-turn/tool-use or you "break the reasoning chain" (`docs/MINIMAX.md` §4) — a footgun that silently degrades quality if you strip them.

### Ecosystem-adapter feature gaps
- **Vercel AI SDK provider supports only M2.x — not M3** (the 1M-context flagship). And via that provider, **image input and file input are "Not supported yet"** (raw ~1982–2015, ~2063). So the most popular TS agent framework can't reach MiniMax's best/multimodal model cleanly.
- **Anthropic-compat endpoint silently ignores** `top_k`, `stop_sequences`, `mcp_servers`, `context_management`, `container` (raw ~2184–2188). **OpenAI-compat ignores** `presence_penalty`, `frequency_penalty`, `logit_bias`, and the deprecated `function_call` (raw ~2558–2564). Drop-in "compatibility" leaks.

### Cloned/Designed voices are fragile and temporary
- **Clones auto-delete after 168h (7 days)** unless you synthesize with them at least once in that window; they start **inactive** and won't even list in `get_voice` until first used (`docs/MINIMAX.md` §2; raw ~1274–1311, ~3724). Previewing during clone does **not** activate the voice.
- **Billing is deferred and surprising:** clone is free at creation; the **$1.5/clone (and $3/voice-design)** fee hits on **first synthesis** — easy to misattribute (`docs/MINIMAX.md` §2–3).
- **Clone audio constraints:** source 10s–5min ≤20MB; **prompt audio must be <8s** (error 2048 if longer); strict `voice_id` naming rules (error 2039 on dup) (raw ~6553; `docs/MINIMAX.md` §Gotchas).

### Expiring URLs & data-loss traps
- Async long-TTS **download URL valid only 9 hours**, then "the generated data will be lost" (raw ~1218, ~6055). Music cover `cover_feature_id` valid 24h. Video file retrieval is multi-step async.
- **>10% "invalid characters" in async TTS → no audio at all**, just an error code (raw ~1216, ~6006). A stray control char can kill a long job.

### Self-host bar is high
- Local M2.7 needs serious GPUs (e.g. 96GB×4 for ~400K tokens), and **per-sequence context caps at 196K even when aggregate KV cache is larger** (raw ~4313–4317). Smallest MLX (3-bit) needs **~112GB unified memory** — most Macs can't run it (raw ~4474). So "cheap + open" still means cloud-API-dependent for almost everyone.

### Two key types that don't mix
- Pay-as-you-go **API Key** (all modalities) vs **Token Plan Subscription Key** — mixing them breaks calls; error codes `1004` not-authorized, `2049` invalid-key are common (`docs/MINIMAX.md` §Gotchas; raw ~1503).

---

## What users struggle with / complain about  (with URLs)

### Latency from over-thinking is the #1 developer complaint
- **M2.5 "thinking" makes agents catastrophically slow.** A detailed BadCase (evaluated by Claude Opus): **2.2s to say "hello"** (2.9× Qwen Plus), **195s to check disk space** (325× slower — "no more accurate, just vastly slower"), 15.1s on a file read (5.2×). It also **violated a 60-char voice-mode limit by producing 303 chars.** Proposed fix: a thinking-optional mode. → https://github.com/MiniMax-AI/MiniMax-M2/issues/77
- **Claude Code + MiniMax 2.1: >1 minute delay before a Bash permission prompt** appears — doesn't happen with Anthropic models. → https://github.com/MiniMax-AI/MiniMax-M2/issues/66
- **Verbosity / token bloat:** Reddit reports of 16,000+ thinking tokens for simple prompts; M2.7 generated ~87M output tokens in an eval vs a ~20M median for its price tier (4× more) — cheap per-token but you pay in tokens *and* latency. → https://thomas-wiegold.com/blog/minimax-m-2-7-review-is-it-worth-the-hype/ , https://artificialanalysis.ai/models/minimax-m2-7

### Reliability / timeouts / cooldowns
- **OpenClaw 2026.3.2: MiniMax provider returns "LLM request timed out" on every request** even though the key works via curl. → https://github.com/openclaw/openclaw/issues/34487
- **"Provider minimax is in cooldown (all profiles unavailable)" while account usage is at 2%** — false-positive rate-limit cooldowns. → https://www.answeroverflow.com/m/1473873531489226985
- **Hosted endpoints flaky:** model-specific failures for minimax-m2.5 (alongside glm5, kimi) on NVIDIA's OpenAI-compatible hosting; "temporary mitigations exist but a permanent fix is needed." → https://forums.developer.nvidia.com/t/reliability-issues-across-glm5-kimi-k2-5-and-minimax-m2-5-temporary-mitigations-exist-but-a-permanent-fix-is-needed/364808

### Billing, refunds, and customer service
- **Trustpilot ~1.4/5** across ~89+ reviews for the consumer side; refund requests for $80 plans going unanswered; **wrong support email addresses** listed in multiple places. → https://www.trustpilot.com/review/minimax.io
- **Duplicate charges:** a user charged 3× (US$100 total). → https://github.com/MiniMax-AI/MiniMax-M2/issues/125 ; **unused-balance refund + invoice requests** routed through GitHub issues because support is unresponsive → https://github.com/MiniMax-AI/MiniMax-M2/issues/97
- **Silent failures on low balance:** pay-as-you-go calls fail quietly when credit runs low; community guidance is "set a balance alert before production." → https://costbench.com/software/llm-api-providers/minimax-api/
- **Subscriptions silently switched monthly→yearly**, non-refundable once any credit is used. → https://www.trustpilot.com/review/minimax.io

### Voice / audio specifics
- **Preview text capped at 500 chars**; clone needs ≥10s audio and must be exercised within 7 days or it's gone. → https://fal.ai/models/fal-ai/minimax/voice-clone/api
- **Documented language confusion:** some integrators report the API's *declared* clone-language support narrows to EN/ZH/JA/KO, and the **China endpoint doesn't support voice cloning at all** — a regional gotcha vs the 40-language marketing. → https://docs.sillytavern.app/extensions/minimaxtts/ , https://aimlapi.com/blog/minimax-audio-chinese-text-to-speech-ai-model-voice-cloning

### Video
- **Content-filter rejections are opaque** ("users have difficulty understanding why content is rejected") and **free users queue behind paid users**. → https://curiousrefuge.com/blog/minimax23-ai-video-generator-review

---

## Whitespace & unmet needs

1. **No first-party ASR / realtime duplex.** MiniMax sells "the ultimate voice agent" stack but ships **no STT and no turn-taking/barge-in** in the API. Whoever wires the missing front-half (STT + VAD + interruption + endpointing) into MiniMax TTS/LLM owns the actual product experience.
2. **No "fast path" for trivial tool turns.** Users are begging for thinking-off on tool calls (issue #77). An orchestration layer that routes file-reads/exec to a no-think path (M3 thinking-disabled or a different model) and reserves reasoning for planning is a clear, demanded gap.
3. **Clone lifecycle is a liability.** The 7-day auto-delete + "inactive until first synth" + deferred billing combo loses voices and surprises bills. A thin "voice vault" that auto-keeps-alive, tracks expiry, and pre-warms clones is missing.
4. **Cost/latency observability.** Token-bloat (87M tokens, 16K-token thinking) + cached-vs-uncached input + 5 RPM ceilings make spend and latency unpredictable. There's no native dashboard surfacing "thinking tokens burned per turn" or rate-limit headroom.
5. **Reliability shim.** Timeouts, false cooldowns, expiring URLs (9h/24h), and >10%-invalid-char job failures all argue for a resilience wrapper (retries, fallback provider, URL-fetch-on-complete, char sanitizer).
6. **Confusing key/endpoint matrix.** Two key types, China vs global hosts, clone-unsupported-on-China — a setup/config gap that bites every new builder.

---

## → Idea seeds for the hackathon  (Moss-powered voice builds that exploit the gap)

1. **"Full-mouth-and-ears" voice agent kit (fills MiniMax's STT/duplex hole).** LiveKit/Pipecat front-end does STT + VAD + barge-in; MiniMax M3 reasons; MiniMax TTS speaks; **Moss does <10ms retrieval** of the right KB chunk per turn so M3 stays short and cheap (cache the system prompt + docs at $0.06/M). The demo line writes itself: *"MiniMax gives you the brain and the mouth — we built the ears and the reflexes."* Directly answers the missing-ASR + missing-barge-in gaps.

2. **Thinking-router / latency killer (answers issue #77 directly).** A drop-in proxy in front of MiniMax: classify each turn — trivial tool call (read/exec) → M3 with `thinking:disabled`; complex plan/codegen → thinking on. Moss caches recent tool results so the model stops re-verifying ("don't check disk space for 195s"). Show a live before/after: 195s → sub-second. Judges feel the pain instantly because everyone's seen a slow agent.

3. **Voice Vault — clone lifecycle manager.** Solves the 7-day auto-delete + inactive-until-first-synth + deferred-billing footguns. Records a 30s sample at the booth, clones, **auto-synths a keep-alive once**, tracks the 168h expiry, and shows the true $1.5-on-first-use cost. Moss stores per-voice metadata/usage; a voice agent then "calls back the lead in their own voice" without the clone silently vanishing mid-demo — the cloned-callback wow without the landmine.

4. **Resilience + cost cockpit for MiniMax voice agents.** A sidecar that wraps every call: auto-retry on timeouts/false cooldowns, **immediately downloads async-TTS audio before the 9h URL dies**, sanitizes >10%-invalid-char text, and live-charts thinking-tokens-per-turn + RPM headroom (5 RPM video, 60 RPM TTS). Moss indexes the telemetry for instant "why was this turn slow/expensive?" voice Q&A over your own logs.

5. **Ambient meeting co-pilot that whispers, never interrupts.** Exploits TTS `emotion:"whisper"` + low `vol`; STT (BYO) transcribes the room, Moss retrieves the relevant fact in real time, M3 condenses it, MiniMax whispers it into one earpiece. The "no native barge-in" limitation becomes a *feature* (it's intentionally non-interrupting), and the STT gap is your value-add.

6. **One-command MiniMax voice setup ("create-minimax-voice-agent").** Collapses the key-type/endpoint/region confusion: detects API-Key vs Token-Plan, picks global vs China host (and warns clone-unsupported-on-China), wires Moss retrieval + LiveKit + MiniMax TTS/LLM, and ships a working barge-in voice agent in <2 min. DX-track bait that turns the messy onboarding complaints into the wedge.
