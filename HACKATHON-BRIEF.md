# Conversational AI Hackathon 2026 — Master Brief

> **The single most important file in this folder.** Everything else (platform reports, ideas) is built to win *this specific event*. Read this first.

Source: https://events.ycombinator.com/conversational-ai-hackathon-2026 (scraped 2026-06-05)

---

## 1. The Facts (authoritative, from the event page)

| | |
|---|---|
| **Event** | Conversational AI Hackathon |
| **Host** | **Moss (F25)** — the company whose retrieval runtime is the star of the show |
| **Venue** | Y Combinator, **San Francisco, CA** |
| **Dates** | **June 6–7, 2026** (overnight hackathon) |
| **Format** | ~21 hours of build time (hacking starts 2:30 PM Jun 6, submissions due 11:00 AM Jun 7) |
| **Time zone** | America/Los_Angeles |

### Schedule
**June 6th**
- 1:00 PM — Doors open + lunch
- 2:00 PM — Opening ceremony & sponsor intros
- 2:30 PM — **Hacking begins**
- 4:00 PM — Sponsor workshops / office hours *(go to these — sponsor judges remember teams who showed up)*
- 6:30 PM — Dinner
- 8:00 PM — Overnight hacking continues

**June 7th**
- 7:30 AM — Breakfast & final sprint
- 11:00 AM — **Submissions due** + lunch
- 1:00 PM — Judging, finalist demos & closing ceremony

> **Build-time reality:** You effectively have one overnight. Scope must be demo-able in a 2–3 minute live voice demo. Pick something where Moss retrieval is visibly the magic, not plumbing.

---

## 2. The Thesis (read this 3 times — it is the rubric)

> *"We all know the pain of early voice AI: awkward pauses, hallucinations, and zero memory. We are past that. Voice models are now cheap and fast to the point where they are no longer the bottleneck, **retrieval is.** Now with Moss, the infrastructure for real-time semantic search has fully matured. Agents can finally hold a fluid conversation, instantly look up complex facts, and act on them without breaking a sweat. **The knowledge base is open. The latency is gone.**"*

**What this means for what wins:**
1. **Retrieval is the protagonist.** The judges (Moss is the host) want to see an agent that *instantly looks up complex facts mid-conversation* with no awkward pause. If your demo's "wow" is anything other than "it knew that, instantly, from a huge/private/changing knowledge base," you're building the wrong thing.
2. **Latency is the villain you've defeated.** Show a moment where a normal RAG agent would stall for 2–3 seconds and yours doesn't. The contrast is the demo.
3. **Memory / "zero memory" is called out as old pain.** Persistent, personal, cross-session memory that's retrieved in <10ms is on-thesis.
4. **"Act on them"** — retrieval that triggers an *action* (tool call, booking, escalation) beats retrieval that just talks.

---

## 3. The Three Tracks (build for one; nod to the others)

| Track | Official description | What judges imagine | Moss angle |
|---|---|---|---|
| **Lead Gen** | "Agents that nurture and convert the inbound leads." | Voice/chat agent that qualifies, follows up, books, and closes inbound demand 24/7 | Instantly retrieve the right case study, pricing, objection-handler, and this lead's full history mid-call |
| **Support** | "Customer service bots that instantly pull docs and user history." | Deflect tickets; resolve on first contact by pulling the exact doc + this user's account state | The literal Moss use case — pull docs **and** user history in <10ms while talking |
| **Co-Pilot** | "Ambient agents that listen in and display live context." | An agent listening to a live human conversation, surfacing the right fact/card on screen in real time | Sub-10ms retrieval is what makes "live context" feel live instead of laggy |

> The **Co-Pilot / ambient** track is the most under-served and most "wow"-able — an agent that *isn't* spoken to but *listens and surfaces* is novel, and latency is everything (Moss's whole pitch). Many of the strongest ideas in `IDEAS.md` lean here. Lead Gen is the most obviously fundable (YC loves revenue). Support is the safest/most relatable demo.

---

## 4. Sponsors & what each gives you (your toolbox)

**Official sponsor list (from the page):**

| Sponsor | One-liner (their words) | What you actually use it for | Deep report |
|---|---|---|---|
| **Moss (F25)** | Host. Real-time semantic search runtime. | The retrieval brain. Sub-10ms lookups, on-device/browser/cloud, metadata filtering, hybrid search, multi-index, cross-agent context handoff, instant index updates. **Use it or you lose.** | `docs/MOSS.md` |
| **LiveKit** | "Real-time audio and video infrastructure." | The voice transport + Agents framework: mic in, STT→LLM→TTS, turn detection, SIP/telephony, ambient room audio for Co-Pilot. The default way to ship a voice agent here. | `docs/LIVEKIT.md` |
| **TrueFoundry** | "AI gateway platform to control, govern, and scale AI agents." | One gateway/endpoint for many LLMs, rate-limiting, observability, guardrails, prompt/version control, cost governance. Great "production-ready" story for judges. | `docs/TRUEFOUNDRY.md` |
| **Unsiloed (F25)** | "API for parsing PDFs and unstructured documents." | Turn messy PDFs/contracts/manuals/forms into structured chunks → **feed straight into Moss**. The natural "ingest" half of any retrieval demo. | `docs/UNSILOED.md` |
| **AWS** | "Cloud computing platform." | Hosting, Bedrock models, Transcribe/Polly, Nova, storage. Credits. | `docs/MINIMAX.md` appendix / general |
| **MiniMax** | "Intelligence with everyone." | Cheap+fast TTS, **voice cloning**, speech, music, video, and LLMs. Your low-latency expressive voice + multimodal generation. | `docs/MINIMAX.md` |

**A note on the platforms you mentioned that are NOT official sponsors:** You mentioned **ElevenLabs, Agora, and "Profoundry."** ElevenLabs and Agora are **Moss *integrations*** (covered in `docs/MOSS.md`) and are great tech, but they are **not on the official sponsor list** for this event — so building your prize story around them is risky. "Profoundry" doesn't appear; possibly a mishear of "TrueFoundry" or "Profound." **Build your sponsor-prize narrative around the 5 official sponsors + Moss.** (You can still use ElevenLabs/Agora if you like the tech — just don't bank a sponsor prize on it.)

### The "sponsor-prize stack" strategy
Prizes are awarded **across multiple tracks** AND by sponsors. The highest-EV build touches **as many sponsors as plausibly natural**: **Unsiloed (ingest) → Moss (retrieve) → LiveKit (talk) → MiniMax (voice) → TrueFoundry (govern the LLM) → AWS (host)**. A project that legitimately uses 4–5 of these is eligible for multiple sponsor prizes from one build. Several ideas in `IDEAS.md` are designed as this "full-stack sweep."

---

## 5. Prizes & what they reveal about judging

- **1st:** YC interview + iPhones + sponsor credits + prizes across multiple tracks
- **2nd:** AirPods Max + sponsor credits + multi-track prizes
- **3rd:** AirPods Pro + sponsor credits + multi-track prizes
- Every attendee gets swag.

**The YC interview is the tell.** This isn't a "coolest tech demo" prize; it's a "would we fund this" prize. So the winning project must read as a **company**, not a toy:
- A real, painful, specific problem (ideally one a judge has personally felt).
- A wedge that's narrow enough to nail in a demo but implies a big market.
- A "why now" that's literally the event thesis: *retrieval just got fast enough.*
- A live demo where the magic is undeniable and happens in <3 minutes.

---

## 6. The winning formula (synthesized — see `WINNING-PATTERNS.md` for evidence)

A winning project at *this* event = **all five**:
1. **On-thesis:** Moss retrieval is the visible hero; you defeat latency/memory/hallucination on camera.
2. **One of the 3 tracks**, owned completely (don't straddle).
3. **A painful, specific problem** a judge recognizes in 5 seconds (the 15 "strong problem" ideas).
4. **A jaw-drop demo moment** — something that feels impossible without instant retrieval (the "wow" ideas).
5. **Fundable framing** — sounds like a YC company, uses 4–5 sponsors naturally for the prize sweep.

> Use `PLATFORM-CAPABILITIES-DIGEST.md` as the "lego brick" list, `WINNING-PATTERNS.md` for what historically wins, and `IDEAS.md` for 30 concrete builds (15 of them anchored on a strong, painful problem statement).
