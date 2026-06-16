# 🎬 Tax It Easy — 2-Minute Demo Video Script (v2)

> **For review.** Timed storyboard for our hackathon demo video.
> Flow: **fireship intro → brand reveal → live product demo → partner outro.**
> Total ≈ **2:05–2:10** (brief allows 2–3 min; can trim the demo to land 2:00).

**Pipeline:** ① approve this script → ② generate voiceover (**ElevenLabs**) → ③ render intro/reveal/outro (Remotion) + record the live demo → ④ stitch into the final cut.

**Product:** **Tax It Easy** — upload your tax docs → we parse + index them → generate your 1040 → talk to a voice **AI CPA** that answers from *your* real numbers, retrieved by **Moss in milliseconds**. On-thesis: *the latency is gone.*

> ⏱️ Intro/reveal/outro timestamps are from the current render; they re-lock to the final **ElevenLabs** audio. Wording + structure are what we're reviewing.

---

## 🎬 ACT 1 — INTRO · fireship pain · 0:00–0:27

| Time | On screen | Voiceover / audio |
|------|-----------|-------------------|
| 0:00.3 | **"Takes too long to do your taxes?"** (`taxes?` cyan) | *"Takes too long to do your taxes?"* |
| 0:03.3 | a single **W-2** card pops *(pop)* | *"First, you need your W-2."* |
| 0:06.5 → 0:10 | **1099 → 1098 → K-1** pop **one at a time**, deliberate *(tink each)* | *"Then a 1099… a 1098… a K-1…"* |
| 0:11 → 0:14 | 💥 **the flood** — 12 more forms erupt like **bubbles**, fast & overlapping, screen overwhelmed *(rapid pops)* | *"And then— whoa. Whoa! Wait— where did all of these come from?!"* |
| 0:15 | the pile blurs / fades back | — |
| 0:16.3 | **"Weeks of this."** (`this.` red) + *"Or $400 for a CPA who answers in three business days."* | *"Weeks of this. Or four hundred dollars for a CPA who answers in three business days."* |
| 0:21.5 | *(boom)* **"What if it took 15 minutes?"** (cyan) + *"with an expert who already read every page."* | *"What if it took fifteen minutes — with an expert who already read every page?"* |

## ✨ ACT 1.5 — REVEAL · 0:27–0:31
| Time | On screen | Voiceover |
|------|-----------|-----------|
| 0:27 | **MEET** → **`Tax`** (cyan) **`it easy`** — big brand drop *(hero sting)* + *"your AI CPA — grounded in your real numbers."* | *"Meet… Tax It Easy."* |

## 🖥️ ACT 2 — LIVE DEMO · your screen recording · ~0:31–1:50 (target ~78s)
*Narration plays over the setup steps; your live voice + the CPA carry the Q&A. Full click sheet: [DEMO-RECORDING.md](video/DEMO-RECORDING.md).*

| Time (rel) | On screen / action | Narration / spoken |
|-----------|--------------------|--------------------|
| 0:00–0:02 | homepage holds | — |
| 0:02 | click **Enter** | — |
| 0:02–0:10 | **Clerk** sign-in ("🔒 secured by Clerk") | *"We securely sign you in with Clerk."* |
| 0:10–0:24 | upload **W-2 + 1099 + K-1** → **"parsing & indexing with Unsiloed… ✓"** | *"Upload everything — parsed and indexed by Unsiloed."* |
| 0:24–0:32 | **Generate 1040** → preview *(takes a moment)* | *"We build your 1040."* |
| 0:32–0:40 | click **Talk to your CPA** → split-screen, "● live" | *"Then you just talk to your CPA."* |
| 0:40–0:52 | **Q1** → instant answer ⚡ | **you:** *"What's my total income on my W-2?"* · overlay `6 ms · Moss` |
| 0:52–1:04 | **Q2** → grounded answer | **you:** *"Can I deduct my home office?"* |
| 1:04–1:14 | **Q3** (memory) → it remembers | **you:** *"I'm married filing jointly… so what's my standard deduction?"* |
| 1:14–1:18 | hold on split-screen, stop | *"Answers from your real numbers — instantly."* |

## 🏁 ACT 3 — OUTRO · partner thank-you + sign-off · ~1:50–2:09
| Time | On screen | Voiceover |
|------|-----------|-----------|
| +0:00 | **"Thanks to our partners."** | *"Thanks to the partners who made this happen."* |
| +0:03 | **MOSS** blasts in with speed-streaks/motion-blur (the "speedster") — *"instant retrieval ⚡"* | *"Moss. Instant retrieval."* |
| +0:06 | **Unsiloed → Clerk → LiveKit → MiniMax → TrueFoundry → AWS** flash by, each with a one-word role | *"Unsiloed. Clerk. LiveKit. MiniMax. TrueFoundry. And AWS."* |
| +0:11 | **`Tax` it easy.** (the pun: *take*→*TAX*) | *"Tax it easy."* |
| +0:14 | **Built for the Conversational AI Hackathon 2026** + credits (team · github · partners) | *"Built for the Conversational AI Hackathon 2026."* |

---

## 🎙️ Full narration (review wording here)
**Intro**
1. "Takes too long to do your taxes?"
2. "First, you need your W-2."
3. "Then a 1099… a 1098… a K-1…"
4. "And then— whoa. Whoa! Wait— where did all of these come from?!"
5. "Weeks of this. Or four hundred dollars for a CPA who answers in three business days."
6. "What if it took fifteen minutes — with an expert who already read every page?"

**Reveal**
7. "Meet… Tax It Easy."

**Demo (over the recording)**
8. "We securely sign you in with Clerk."
9. "Upload everything — parsed and indexed by Unsiloed."
10. "We build your 1040."
11. "Then you just talk to your CPA."
12. "Answers from your real numbers — instantly."

**Outro**
13. "Thanks to the partners who made this happen."
14. "Moss. Instant retrieval."
15. "Unsiloed. Clerk. LiveKit. MiniMax. TrueFoundry. And AWS."
16. "Tax it easy."
17. "Built for the Conversational AI Hackathon 2026."

---

## 🧰 Production notes
- **Intro / reveal / outro:** Remotion motion-graphics (rendered locally).
- **Voice:** ElevenLabs (key pending). Current preview uses a scratch Mac voice.
- **Demo:** real screen recording; narration overlaid on setup steps, live audio for Q&A.
- **Partner montage (your idea):** the outro currently uses a **stylized "Moss speed reveal"** (motion-blur + streaks) and **wordmarks** for the rest, as placeholders. We can swap in:
  - your **edited speedster clip** (Quicksilver/Flash → face replaced with the **Moss** logo) for the Moss beat;
  - **metaphor images** for others (e.g. a literal **goat** with a partner logo on top for the "GOAT");
  - **real partner logos** instead of wordmarks (drop the files in `video/public/logos/`, or give me `FAL_KEY` to generate the metaphor images).
- **Brand:** dark UI, blue `#002cf2` / cyan `#1fd5f9`.

## ❓ Open questions for the reviewer
1. Hook wording: *"Takes too long to do your taxes?"* (you said "build" — I used "do" as it reads cleaner; say the word to switch).
2. Keep the partner montage stylized, or are you supplying the edited speedster clip + goat/logo images?
3. Demo overlays (`6 ms · Moss`, memory tag) — burn onto the recording or keep clean?
4. Trim demo to land exactly **2:00**, or fine at ~2:07?
5. **Team names** for credits + confirm the GitHub repo is the public submission link.
