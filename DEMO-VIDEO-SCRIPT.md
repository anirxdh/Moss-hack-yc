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

| Time (rel) | On screen / action | Spoken (live) | Burn-in caption / overlay |
|-----------|--------------------|---------------|---------------------------|
| 0:00–0:05 | Landing page → **Enter** | — | label: *"upload anything"* |
| 0:05–0:16 | drag **W-2 + 1099** into dropzone → **Generate 1040** | — | caption: *"Upload your real docs"* |
| 0:16–0:23 | **/return** — the 1040 preview renders | — | caption: *"Your 1040, auto-filled"* |
| 0:23–0:31 | click **Talk to your CPA** → split-screen (PDF left, avatar right), "● live" | — | caption: *"Now ask it anything"* |
| 0:31–0:44 | **the wow** — instant answer, no pause | **"What's my total income on my W-2?"** | **REQUIRED:** lower-third caption of the question + ⚡ badge **`6 ms · Moss`** (hero-sized, animates in on the answer) |
| 0:44–0:54 | grounded answer cites the doc | **"Can I deduct my home office?"** | caption: question text + tag **`cited from your W-2`** |
| 0:54–1:08 | memory + recall in one beat | **"I'm married filing jointly — so what's my standard deduction?"** | caption: question text + tag **`cross-session memory`** |
| 1:08–1:12 | hold on split-screen, stop | — | — |

*The single most important beat is **Q1 → instant answer with zero lag** — that's the whole pitch on camera. The `6 ms · Moss` badge is NOT optional; it is the protagonist of the entire video.*

> **Captions are mandatory, not decorative.** Judges scrub demo videos on mute. Every spoken question gets a burn-in lower-third so the wow lands silently. Style: bottom-third, semi-opaque dark plate, white text, accent underline on the key noun.

### 🎥 Live-demo recording protocol (do NOT skip — the demo is the pitch)
- **Fixed inputs:** record with the SAME two docs every take — one **W-2** and one **1099-INT** with known-clean numbers you've verified produce a correct 1040. Write the expected total income on a sticky note so you can confirm the on-screen answer is *correct*, not just fast.
- **Warm the cache first:** run the full flow once before recording so the Moss index is loaded — a cold first query is the one place latency could leak in.
- **Money-beat insurance:** record Q1 (the instant-answer beat) **at least 5 times** and keep the cleanest. The answer must be visibly correct AND visibly instant.
- **Safety take:** capture one complete clean run end-to-end as a fallback, so the final cut never depends on a single fragile take.
- **If lag appears on camera:** stop, re-warm, re-take. Never ship a take where the protagonist beat stutters — a 2s pause on Q1 silently refutes the entire thesis.
- **Network:** record on a stable connection (or local) — a wifi hiccup reads on camera as "the product is slow."
- **Capture:** 1080p / 30fps, hide bookmarks bar + notifications, clean browser profile, cursor visible.

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
- **Voice:** **ElevenLabs** — use an *energetic/snappy* voice (not the default "Adam"); fireship pacing needs drive. Pick something punchy with clear consonants for the rapid intro.
- **Demo:** real screen recording of the app (1080p / 30fps). See **Live-demo recording protocol** in Act 2.
- **Captions:** burn-in lower-thirds on every spoken question + key claim (mandatory — video must read on mute). Style: bottom-third, semi-opaque dark plate, white text, accent underline on the key noun.
- **Aspect ratio:** **16:9 / 1920×1080** (YouTube/judge-scrub default). If also posting to social, export a 9:16 crop separately — do not record vertical.
- **Assembly:** ffmpeg concat (intro + demo + outro), optional music bed (duck under VO).
- **Brand:** dark UI, accent blue `#002cf2` / cyan `#1fd5f9`. ✅ **Now matches the app** — `app/frontend/app-config.ts` accent set to blue/cyan + blue audio visualizer enabled. ⚠️ **Eyeball the running app before recording** — the accent now drives every accented element; if anything reads wrong, `git checkout app/frontend/app-config.ts` reverts.

## ✅ Resolved decisions (from design review)
1. **Wording:** keep `$400 for a CPA` (concrete pain anchor) and the tagline "The latency is gone."
2. **Voice:** energetic/snappy ElevenLabs voice (not Adam).
3. **Overlays:** **burn them in** — the `6 ms · Moss` badge is the protagonist, not optional; `cross-session memory` tag stays.
4. **Pacing:** demo middle tightened from 4 → 3 spoken questions (memory beat merged); net demo ≈ 72s.
5. **Brand:** app recolored to match the video (blue/cyan).

## ❓ Still open for the team
1. Trim the credits hold to land at exactly **2:00**, or fine at ~2:03?
2. **Team names** for the credits card + confirm `github.com/anirxdh/Moss-hack-yc` is the submission link **and public**.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL) | score: 7/10 → 9/10, 5 decisions |

- **UNRESOLVED:** 2 (credits timing to 2:00; team names + public repo confirm)
- **VERDICT:** DESIGN REVIEW CLEARED — script is recording-ready once the live app brand is eyeballed. Eng review N/A (no app architecture change beyond the one-line brand config).
