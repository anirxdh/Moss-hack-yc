# 🎬 AI CPA — 2-Minute Demo Video Script

> **For review.** This is the timed storyboard for our hackathon demo video.
> Structure: **fireship-style intro → live product demo → sponsor outro.**
> Total runtime ≈ **2:03** (the brief allows 2–3 min).

**Pipeline:** ① approve this script → ② generate voiceover (ElevenLabs) → ③ render intro/outro (Remotion) + record the live demo → ④ stitch into the final cut.

**Product in one line:** Upload your tax documents → generate your 1040 → talk to a voice **AI CPA** that answers questions grounded in *your* real numbers, retrieved by **Moss in milliseconds** (no awkward pause). On-thesis for the hackathon: *the latency is gone.*

> ⏱️ **Note on timestamps:** Intro/outro times below are from the current render. They'll shift slightly once the final ElevenLabs voiceover is dropped in — exact timings get re-locked to the real audio. The wording + structure are what we're reviewing here.

---

## 🎬 ACT 1 — INTRO · fireship pain · 0:00–0:27

| Time | On screen | Voiceover / audio |
|------|-----------|-------------------|
| 0:00.4 | **"How long does it take you to do your taxes?"** builds in (`taxes?` cyan) | *"How long does it take you… to actually do your taxes?"* |
| 0:04.3 | a single **W-2** card pops center *(pop sfx)* | *"First, you need your W-2."* |
| 0:06.7 → 0:15 | **doc avalanche** — 14 cards rapid-pop & pile up, overlapping into chaos: `1099-INT · 1099-DIV · 1098 · 1098-T · K-1 · 1095-A · Schedule C · Schedule D · 5498 · 1099-NEC · 1099-B · 1099-R · Receipts · Last year's return` *(pop/tink per card)* | *"Then a 1099. And another. A 1098. A K-1. A 1095. Receipts. Last year's return. Wait — where did that one go?"* |
| 0:16 | the pile blurs / fades back | — |
| 0:17.8 | **"Weeks of this."** (`this.` red) + subline *"Or $400 for a CPA who replies in three business days."* | *"Weeks of this. Or four hundred dollars for a CPA who answers in three business days."* |
| 0:23.0 | *(deep boom)* **"What if it took 15 minutes?"** (`minutes?` cyan) + subline *"and the expert already read every page."* | *"What if it took fifteen minutes… and the expert had already read every page?"* |
| 0:27.5 | hard cut → demo | — |

## 🖥️ ACT 2 — LIVE DEMO · real screen recording · ~0:27–1:45 (target ~78s)

| Time (rel) | On screen / action | Spoken (live) | Optional overlay |
|-----------|--------------------|---------------|------------------|
| 0:00–0:05 | Landing page → **Enter** | — | label: *"upload anything"* |
| 0:05–0:16 | drag **W-2 + 1099** into dropzone → **Generate 1040** | — | — |
| 0:16–0:23 | **/return** — the 1040 preview renders | — | — |
| 0:23–0:31 | click **Talk to your CPA** → split-screen (PDF left, avatar right), "● live" | — | — |
| 0:31–0:44 | **the wow** — instant answer, no pause | **"What's my total income on my W-2?"** | ⚡ badge **`6 ms · Moss`** |
| 0:44–0:56 | grounded answer cites the doc | **"Can I deduct my home office?"** | — |
| 0:56–1:03 | memory setup | **"I'm married filing jointly."** | — |
| 1:03–1:15 | it remembers — no re-asking | **"So what's my standard deduction?"** | tag **`cross-session memory`** |
| 1:15–1:18 | hold on split-screen, stop | — | — |

*The single most important beat is **Q1 → instant answer with zero lag** — that's the whole pitch on camera.*

## 🏁 ACT 3 — OUTRO · sponsor flex + tagline + credits · ~1:45–2:03

| Time | On screen | Voiceover / audio |
|------|-----------|-------------------|
| 1:45.8 | **BUILT ON → Moss** (huge, cyan glow) — *"instant retrieval"* | *"Built on Moss for instant retrieval…"* |
| 1:47.2 | → **LiveKit** — *"real-time voice"* | *"…LiveKit for voice,"* |
| 1:48.5 | → **MiniMax** — *"expressive speech"* | *"…MiniMax for speech,"* |
| 1:49.9 | → **TrueFoundry** — *"model governance"* | *"…TrueFoundry to govern the model,"* |
| 1:51.3 | → **AWS** — *"cloud + scale"* | *"…AWS to run it."* |
| 1:53.3 | *(boom)* **"Taxes in 15 minutes. The latency is gone."** (`gone.` cyan) | *"Taxes in fifteen minutes. The latency… is gone."* |
| 1:57.5 | **Credits:** `AI CPA` · team names · `github.com/anirxdh/Moss-hack-yc` · MOSS · LIVEKIT · MINIMAX · TRUEFOUNDRY · AWS | *(music / quiet)* |

---

## 🎙️ Full narration (for the voiceover — review wording here)

**Intro**
1. "How long does it take you… to actually do your taxes?"
2. "First, you need your W-2."
3. "Then a 1099. And another. A 1098. A K-1. A 1095. Receipts. Last year's return. Wait — where did that one go?"
4. "Weeks of this. Or four hundred dollars for a CPA who answers in three business days."
5. "What if it took fifteen minutes… and the expert had already read every page?"

**Outro**
6. "Built on Moss for instant retrieval. LiveKit for voice. MiniMax for speech. TrueFoundry to govern the model. AWS to run it."
7. "Taxes in fifteen minutes. The latency… is gone."

*(The live demo middle uses our real voices + the CPA's answers — no scripted narration there.)*

---

## 🧰 Production notes
- **Intro + outro:** built in **Remotion** (code-driven motion graphics) — already rendering locally, no cloud setup.
- **Voice:** **ElevenLabs** (voice TBD — default "Adam"; open to a more energetic pick).
- **Demo:** real screen recording of the app (1080p / 30fps).
- **Assembly:** ffmpeg concat (intro + demo + outro), optional music bed.
- **Brand:** dark UI, accent blue `#002cf2` / cyan `#1fd5f9` (matches the app).

## ❓ Open questions for the reviewer
1. Any narration wording to change? (e.g. the `$400` figure, the tagline "The latency is gone.")
2. Voice: keep "Adam" or go younger/snappier?
3. Demo overlays (the `6 ms · Moss` badge, `cross-session memory` tag) — burn them onto the recording, or keep the demo clean?
4. Trim the credits hold to land at exactly **2:00**, or fine at ~2:03?
5. **Team names** for the credits card + confirm the GitHub repo is the submission link (and public).
