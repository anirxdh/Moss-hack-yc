# PLATFORM-CAPABILITIES-DIGEST.md — The Lego-Brick Fuel for 30 Winning Ideas

> Working reference for the Conversational AI Hackathon 2026 (Moss / YC SF, Jun 6–7). Dense + scannable. Pair with `HACKATHON-BRIEF.md` (thesis + tracks), `WINNING-PATTERNS.md` (what wins), and the per-platform deep docs. The thesis in one line: **voice is cheap/fast now; retrieval is the bottleneck — Moss kills it at sub-10 ms, in-process.** Every idea should make that retrieval the *visible hero*.

---

## 1. Primitive Table — the most composable capability verbs per platform

> Read each cell as "a thing you can *do* in a demo." Moss is the protagonist; everything else is a limb.

| Platform | Powerful / unique / composable primitives (capability verbs) |
|---|---|
| **Moss** (retrieval) | • **Query a loaded index in ~1–10 ms, in-process** (no network hop — "retrieval is a function call, not a service") • **Metadata-filter retrieval locally** (`$eq/$ne/$gt/$lt/$in/$near/$and/$or`, geo radius) mid-query • **Hot-swap an index live mid-conversation** (`auto_refresh` → atomic update, zero dropped queries) • **Run a real-time session that indexes transcript turns on-device with no cloud round trip on any op** • **Hand off context across agents/processes/devices via one named index** (`push_index` → `session(name)`) • **Query long-term knowledge + short-term session in the same turn** (dual-index recall) • **Search N indexes in one call → global top-K, source-tagged** (`query_multi_index`) • **Run the exact same index in browser-WASM / iOS / cloud** — data never leaves the device • **Blend semantic↔keyword with one `alpha` knob** (0.0 BM25 → 1.0 vector; 0.8 default) |
| **MiniMax** (voice + multimodal) | • **Clone a voice from a 10s–5min sample → reusable `voice_id` in one call** • **Design a voice from a text description** ("gravelly late-night radio host") → `voice_id` • **Stream TTS over WebSocket with low TTFA** (`speech-2.8-turbo`, play chunks on arrival) • **Switch emotion/voice mid-sentence** (7 emotions incl. `whisper`, 40 languages, sound-tags) • **Reason over a 1M-token context for cents** (M3 $0.30/M in, **$0.06/M cached**) • **Cache the system prompt + retrieved KB once** (`cache_control` ephemeral, 5-min TTL) • **Generate a custom song / video / image live** (jingle with judges' names, Hailuo video) |
| **Unsiloed** (ingest) | • **Parse any messy PDF/scan/slide into embedding-ready Markdown chunks** (`chunks[].embed` drops straight into Moss) • **Carry a bbox + page_number + confidence on every segment** (source-highlight + audit) • **Extract typed fields from a doc via JSON Schema, each value scored + cited** (`/v2/extract`) • **Classify a doc into categories with per-page confidence** (route mailroom intake) • **Split one bundled PDF into one-doc-per-file** (`/splitter`) • **Survive tables/multi-column/formulas/handwriting** that generic OCR mangles • **Confidence-gate human-in-the-loop** (`min_confidence_score < 0.7` → agent asks to confirm) |
| **LiveKit** (transport + agents) | • **Ship an STT→LLM→TTS voice agent with natural turn-taking + barge-in** out of the box • **Inject retrieved context on every user turn before the LLM generates** (`on_user_turn_completed` — the winning RAG pattern, no tool-call round trip) • **Place + receive real phone calls** (SIP outbound/inbound, AMD voicemail detection, warm transfer) • **Subscribe to a live human↔human room and listen silently** (ambient Co-Pilot, never speaks) • **Push live context cards to a screen over the data channel** (`send_text(topic=...)`, byte streams, RPC) • **Hand off voice→web→human** mid-session (agent handoff, warm transfer w/ spoken summary) • **Use 1 voice clone live across providers** (LiveKit custom voices / MiniMax plugin) • **Run on Inference with zero provider keys** (Deepgram→GPT→Cartesia pre-tuned) |
| **TrueFoundry** (gateway / govern) | • **Point one OpenAI-compatible endpoint at 1000+ LLMs** (swap `base_url`, one key) • **Fail over to a backup model before the user hears dead air** (`x-tfy-ttft-timeout-ms` → 408 → next target) • **Redact PII/PHI on LLM input AND output** (Azure-powered guardrail, mutate-mode) • **Reach Zendesk/Salesforce/HubSpot/Mongo via one governed MCP key** (OAuth managed) • **Show a live per-customer cost/latency dashboard** (`X-TFY-METADATA` slicing — the "it's production-ready" close) • **A/B which model converts via weight-based virtual models** (flip weights, no redeploy) • **Semantic-cache repeated questions → 0 model cost, ms response** • **Cap spend per demo/user/model** (budget rules, 75/90/100% alerts) |
| **AWS** (host / models) | • **Host the agent worker + token backend** (ECS/EKS/Fargate, standard Docker) • **Bedrock LLMs / Nova Sonic realtime / Transcribe STT / Polly TTS** as fallbacks • **Credits + storage** for the corpus + audio assets |

---

## 2. Combo Recipes — 8–10 named multi-sponsor pipelines (idea seeds)

> Each is one line; each touches 3–6 sponsors for the prize sweep. Arrow = data flow.

1. **DocOracle** (flagship Support) — *Unsiloed → Moss → LiveKit → MiniMax → TrueFoundry → AWS*: drop a 400-page manual, parse to `embed` chunks, index in Moss, voice agent answers any question instantly **citing the page + bbox highlight**, LLM governed by TF gateway, spoken by a cloned brand voice.
2. **EchoHandoff** (Support memory) — *LiveKit → Moss session (long-term + short-term dual-query) → push_index → human/web resume*: agent remembers the whole call at sub-10 ms, then **hands the conversation to a human with full history intact** via one named index.
3. **WhisperDesk** (Co-Pilot ambient) — *LiveKit (silent room listener) → Moss multi-index (live transcript session + company KB) → send_text cards*: agent listens to a live sales/support call and **surfaces the exact fact/clause on the rep's screen before they finish the sentence**.
4. **CloneCloser** (Lead Gen wow) — *MiniMax voice-clone (30s of the AE) → LiveKit SIP outbound + AMD → Moss metadata-filtered CRM retrieval → TF A/B virtual model*: the lead gets a callback **in the AE's own voice**, personalized from their CRM history, model picked by conversion test.
5. **LiveBook** (instant-update demo) — *Moss `auto_refresh` index → LiveKit → MiniMax*: edit a doc/price mid-demo, the agent answers the **new** fact two turns later with no restart — the hot-swap is the wow.
6. **RFP-Qualifier** (Lead Gen) — *Unsiloed `/v2/extract` (schema: budget/timeline/decision-maker + citations) → Moss → LiveKit*: caller emails an RFP; the agent **reads back extracted fields, confidence-gates the shaky ones out loud**, writes structured JSON to CRM.
7. **PrivateVault** (privacy flex, any track) — *Browser drag-drop PDF → Moss-web (WASM) createIndexFromFiles → in-tab query*: "your data **never leaves the tab**, and it's still sub-10 ms" — search runs entirely on-device.
8. **MailroomBrain** (Support routing) — *Unsiloed `/splitter` + `/classify` → Moss per-category indexes → LiveKit*: a mixed PDF inbox auto-splits/classifies into invoice/contract/receipt indexes; agent answers "warranty on order #X" from **only the contract chunks**.
9. **BulletproofBrain** (production cred) — *LiveKit → TrueFoundry priority virtual model (Groq primary, GPT fallback) → Moss*: kill the primary provider key mid-call, the agent **keeps talking**, `x-tfy-resolved-model` proves the failover, live cost dashboard as the closing slide.
10. **ContractClause-CoPilot** (Co-Pilot + bbox) — *Unsiloed parse (bbox+page) → Moss → LiveKit ambient → byte-stream image crop*: during a legal call, a mentioned clause triggers a Moss lookup and the co-pilot **pops the exact cropped screenshot of that clause** on screen.

---

## 3. Unfair Moss advantages most teams will under-use (+ the 'wow' demo each enables)

> These are the non-obvious capabilities. Most teams will treat Moss as "a vector DB with a voice agent." The winners exploit one of these.

| Under-used capability | Why it's unfair | The 'wow' demo it enables |
|---|---|---|
| **Instant index hot-swap (`auto_refresh`)** | Most RAG demos have a *frozen* corpus. Moss updates a live in-memory index atomically, no restart, no dropped queries. | **Edit a doc / change a price mid-demo, then ask the agent — it answers the new fact instantly.** Judges have never seen live-mutable RAG in a voice call. |
| **On-device / browser-WASM retrieval** | Everyone runs retrieval server-side. Moss runs the *same index* in the browser, data never leaves the tab. | **Drag-drop a sensitive PDF into the browser; search it on WASM, sub-10 ms, "nothing left this device."** Privacy + speed in one line. |
| **Cross-agent context handoff (one named index)** | Teams build a single agent. Moss lets process A `push_index` and process B `session(name)` resume it. | **Hand the call voice→web→human with full history intact** — escalation that actually remembers everything. |
| **Dual-index per-turn (long-term KB + live session)** | Most bots either know docs OR remember the chat, not both at once, both local. | **Agent answers from the manual AND recalls what the caller said two turns ago — in the same turn, both sub-10 ms.** |
| **Local metadata filters mid-conversation** | Cloud query API can't filter; only the loaded local index can (`$near` geo, `$and/$or`, numeric-as-string). | **"Show me startup-plan, US-region objections within 5 km" answered live** — segmentation the judge can't fake-out. |
| **Multi-index global top-K, source-tagged** | One call across catalog + CRM + objections, each result tagged by source. | **Agent cites a product spec, a CRM note, and an objection script in one breath, visibly tagged from 3 corpora.** |
| **`timeTakenInMs` on the result** | The latency *is* the thesis, and Moss hands you the number. | **Put the sub-10 ms number on screen next to a fluid voice reply** (and a 300 ms cloud-fallback next to it for contrast). |
| **Sessions index turns with NO network on any op** | Ambient Co-Pilot needs to index transcript turns continuously; sessions do it in-process via Rust. | **An agent that has indexed 200 transcript turns and recalls turn #7 instantly, with no DB and no lag.** |

> **Two footguns that quietly disqualify these demos:** (1) you **must `loadIndex` / open a `session` before query** or you fall back to ~100–500 ms cloud — pre-load in the agent entrypoint, never per turn. (2) **Node has no sessions yet** — write the live-session agent in **Python or Swift**. (3) Sessions are an Enterprise-tier feature — confirm access early or degrade to "load cloud index + per-turn query."

---

## 4. Wedges by Track — sharp, painful, fundable problem-spaces

> Biased toward narrow workflows a judge recognizes in 5 seconds and a YC partner could imagine funding Monday. Each leans on a Moss advantage from §3.

### Lead Gen — *"convert the inbound lead, don't just chat"*
1. **Inbound demo-request qualifier** that retrieves the lead's company facts + the right case study mid-call and books the meeting (metadata-filter by industry/plan/region).
2. **Objection-handler in the rep's cloned voice** — pulls the exact rebuttal + competitor comparison for *this* prospect's stated concern, sub-10 ms.
3. **RFP/spec-sheet intake agent** — Unsiloed-extract budget/timeline/decision-maker, agent reads back + confidence-gates, writes structured JSON to CRM.
4. **Outbound "speed-to-lead" caller** — dials within 60s of form-fill (SIP + AMD), personalizes from CRM history, A/B's two LLMs for conversion.
5. **Pricing/SKU exactness bot** — low-`alpha` keyword retrieval for exact SKUs/tiers so the agent never hallucinates a price.
6. **Trade-show booth agent** — clones a visitor's voice at check-in, "calls back" with a personalized follow-up using their scanned badge data.
7. **Renewal/upsell whisper-agent** — retrieves the account's usage + contract terms and surfaces the right upsell at the right moment.
8. **Competitor-displacement scripts** — multi-index over battlecards + win/loss notes + objection playbook, source-tagged in one breath.

### Support — *"instantly pull docs AND user history"* (most direct Moss fit)
1. **"Talk to the 400-page manual"** — Unsiloed→Moss, answers with page citation + bbox highlight (the flagship).
2. **First-contact-resolution deflection bot** that queries policy KB + this user's account state in the same turn.
3. **Live-mutable policy agent** — ops edits a refund policy mid-shift, the agent answers the new policy instantly (hot-swap).
4. **Escalation with memory** — frontline agent `push_index`-es the conversation; the human specialist opens it with full history (no "can you repeat everything?").
5. **Field-tech hands-free support** (greasy hands, can't touch a laptop) — phone-in, retrieves the exact spec/step, speaks it.
6. **Emergency/triage intake** that retrieves protocol + caller history and auto-summarizes the case (Candling-style).
7. **Omni-channel continuity** — voice/chat/email handlers share one named index keyed by customer ID; pick up anywhere.
8. **Multilingual support with live language switch** — `language="multi"` STT + Moss hybrid retrieval robust across languages + MiniMax per-language TTS.

### Co-Pilot — *"listen ambiently, surface live context, never prompted"* (most under-served, most wow-able)
1. **Sales-call co-pilot** — silent room listener pushes the right battlecard/objection card to the rep's screen before they finish speaking.
2. **Legal/contract clause co-pilot** — mention a clause, it pops the exact cropped screenshot (Unsiloed bbox) on screen.
3. **Ambient meeting-memory** — indexes every transcript turn into a session, answers "what did we decide about X 40 min ago" instantly; `push_index` becomes the meeting memory.
4. **Clinician/scribe co-pilot** — surfaces the relevant guideline + this patient's history while the doctor talks (PII-redacted via TF guardrail).
5. **Interview/recruiting co-pilot** — retrieves the candidate's resume facts + role rubric, whispers the next probing question.
6. **Live debate/negotiation rebuttal engine** — retrieves + assembles counter-context in real time (AI✧Debate-style, the proven retrieval-as-product wedge).
7. **Onboarding/training shadow** — listens to a new hire on a call and surfaces the SOP step they're about to miss.
8. **Investor/diligence co-pilot** — ambient over a data-room corpus, surfaces the contradicting metric the second it's mentioned.

---

## 5. Wow-Factor Mechanics — demo moments that feel impossible without instant retrieval

> Raw material for jaw-drop ideas. Each one is *only* impressive because retrieval is sub-10 ms and in-process. Steal one and build the demo around it.

- **"It knew that — instantly."** Ask something only answerable from a huge/fresh/private corpus; the agent nails it with zero pause. Put `timeTakenInMs` on screen. (The whole thesis, made audible.)
- **The latency contrast shot.** Run the same query against a loaded index (~5 ms) and a cloud fallback (~300 ms) side by side — the gap *is* the pitch.
- **Edit-the-doc-mid-demo.** Change a fact/price live; the agent answers the new value two turns later, no restart (hot-swap). Nobody else's RAG does this.
- **Two-turns-ago recall.** Tell the agent something, change topic, reference it 60s later — it remembers, with no database (session).
- **Three-corpus citation in one breath.** Agent answers one question with facts visibly tagged from product specs + CRM + policy (multi-index global top-K).
- **Voice→web→human handoff with memory.** Escalate the call; the human picks up with the *entire* history already loaded (named-index handoff).
- **"Your data never left the tab."** Drag-drop a sensitive PDF into the browser, search on WASM, still sub-10 ms (on-device retrieval).
- **Cite the page, highlight the box.** "Per page 212 of the manual…" while the UI highlights the exact bbox crop (Unsiloed grounding) — proves it's not hallucinating.
- **The cloned-voice callback.** Record a teammate/judge for 30s, the agent calls back speaking in their voice (MiniMax clone) — sensory shock stacked on a real workflow.
- **Whisper-the-fact ambient.** The agent never speaks aloud but pushes the right card to a second screen the instant it's relevant (Co-Pilot data channel).
- **Kill-the-provider failover.** Revoke the primary LLM key mid-call; the agent keeps talking, `x-tfy-resolved-model` flips to the backup (production cred).
- **Confidence-gated human-in-the-loop.** Low-confidence extracted field → the agent asks the caller to confirm out loud (reads as production-ready, not a toy).
- **Geo/metadata-filtered live answer.** "Within 5 km, startup plan, US region" answered instantly via local `$near`/`$and` filters — segmentation that can't be faked.

---

### One-line build mantra
> **Pick one desperate user + one painful workflow in one track → make the wow moment a Moss retrieval the judge can't fake-out (instant update / on-device / dual-index / handoff) → keep total response < 300 ms (context-injection, pre-load, MiniMax streaming TTS) → compose 4–5 sponsors for the prize sweep → open on the pain, close on "why now + first 10 customers."**
