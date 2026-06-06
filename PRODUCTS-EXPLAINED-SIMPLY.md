# PRODUCTS EXPLAINED SIMPLY 🧠🔊
### Read this BEFORE the ideas. No jargon. Just stories.

> Goal of this file: by the end you'll be able to explain Moss, LiveKit, MiniMax, Unsiloed, TrueFoundry, and AWS to your grandma — and you'll *feel* why this hackathon exists. Then go read `IDEAS.md` and everything will click.

---

## The one picture that explains everything: **a really good phone rep**

Imagine the best human customer-service rep you've ever called. What does that person actually need to do their job well?

1. **Ears** — to hear what you say.
2. **A sense of timing** — to know when you've stopped talking, and to shut up when you interrupt.
3. **A brain** — to understand you and decide what to say.
4. **A memory** — to remember what you said 30 seconds ago.
5. **A filing cabinet they can search *instantly*** — so when you ask "what's my warranty?" they don't say "ummm let me check…" for 20 seconds.
6. **A mouth + a voice** — to actually say the answer out loud.
7. **A phone line** — to be connected to you at all.
8. **A manager** — making sure they don't leak secrets, don't quote a wrong price, and don't go on break in the middle of your call.
9. **An office** — a building where all of this physically sits.

Now here's the trick: **we're building that rep out of software.** Each company at this hackathon builds *one body part*:

| Body part | The product | In one line |
|---|---|---|
| 👂 Ears + ⏱️ timing + ☎️ phone line + nervous system | **LiveKit** | Connects the call and handles hearing, turn-taking, and interruptions. |
| 🗣️ Voice (vocal cords) | **MiniMax** | Turns text into natural speech — and can even clone a real person's voice. |
| 🧠 Brain (the thinking) | **An LLM** (like GPT/Claude/MiniMax) | Reads what you said and decides what to say back. |
| 🗄️ Memory + instant filing cabinet | **MOSS** ⭐ | Looks up the right fact in **under 10 milliseconds** — the part that makes the rep actually *know things*. |
| 📚 The assistant who files the documents | **Unsiloed** | Takes a messy 400-page PDF and turns it into neat index cards Moss can store. |
| 🧑‍💼 The manager / switchboard | **TrueFoundry** | Routes to the best brain, blocks it from leaking secrets, keeps it from going down, tracks the bill. |
| 🏢 The office building | **AWS** | The cloud where everything runs. |

**Moss is the star of this hackathon.** The whole event's belief is: *the ears, mouth, and brain got cheap and fast — but the "instant filing cabinet" was always the slow part that made AI reps feel dumb. Moss fixes that.* More on this below.

---

## ⭐ MOSS — the instant memory & filing cabinet

**What it is in one sentence:** Moss is a super-fast librarian that finds the exact right fact from a giant pile of knowledge in **less time than it takes you to blink** (under 10 milliseconds — a blink is ~100ms, so Moss is ~10× faster than a blink).

### The story that makes it click

You call a support line. You ask: *"Does my plan cover a cracked screen?"*

A **bad** AI rep does this: it takes your question, sends it across the internet to a database, the database thinks for half a second, sends the answer back across the internet… and **2 seconds of dead silence** happen while you sit there going "…hello?". That pause is what makes AI on the phone feel broken and robotic. In a real conversation, 2 seconds of silence is *forever*.

A **Moss-powered** rep does this: the entire knowledge pile is *already sitting inside the rep's head* (loaded into memory, right next to the brain). So when you ask, it's not a phone-call-to-a-database — it's **a thought.** The answer comes back in 6 milliseconds. No pause. It feels like talking to a human who just *knows*.

> **The key idea, dumbed all the way down:** Most AI looks things up by making a slow phone call to a far-away filing cabinet. Moss keeps the filing cabinet *inside the rep's skull*, so looking something up is instant. That's the whole magic.

### Why is "instant" such a big deal? (The reason this entire hackathon exists)

Here's the event's core belief, in plain words:

- A few years ago, the *brain* (the AI) was slow and dumb. That got fixed — brains are now cheap and fast.
- The *voice* used to sound robotic. That got fixed — voices are now cheap and natural.
- **So what's left as the slow, dumb part? Looking stuff up.** Every time the AI needs a real fact (your account, a price, a policy, a manual), it stalls. That stall is the last thing making AI phone reps feel fake.
- **Moss kills that stall.** Now the rep can hold a smooth conversation AND look up complicated facts at the same time, with zero awkward pause.

That's why the host says: *"The knowledge base is open. The latency is gone."* ("Latency" = lag/delay. "Knowledge base" = the pile of facts.)

### The cool tricks Moss can do (each one is a potential "wow" in a demo)

Think of these as special librarian superpowers:

1. **Instant lookup (sub-10ms).** Already covered — the core trick. It even hands you the exact number ("found in 6ms") so you can show it on screen.

2. **It can search while it's inside the browser or even on your phone — with the WiFi off.** Normally your data has to fly to a company's servers to be searched. Moss can run the *whole* filing cabinet right on your laptop or phone. So you can literally turn off the internet and it still works.
   - 💡 *Why anyone cares:* hospitals and banks are legally **not allowed** to send private data to outside servers. Moss lets them search instantly *without the data ever leaving the room.* (See idea **Glasshouse** — "pull a patient's chart with the WiFi turned off.")

3. **You can change the knowledge mid-conversation, and it instantly knows the new answer.** Normally, if you update a document, you have to "rebuild" everything and restart — like reprinting a whole phone book. Moss can swap in the new fact *live, during a call*, with nobody noticing a hiccup. (This trick is called "auto-refresh / hot-swap.")
   - 💡 *Example:* In **PolicyPulse**, a support agent is on a call saying "30-day returns." You edit the policy document on screen to "14 days," and one sentence later the *same live call* says "14 days." The knowledge changed under its feet, no restart. Judges have never seen that.

4. **It remembers the conversation as it happens — with no database at all.** ("Sessions.") As you talk, every sentence gets filed instantly. So 5 minutes later the rep can recall "you mentioned you're diabetic earlier."
   - 💡 *Example:* **Candle911** — a 911 dispatcher's silent helper hears the caller say "he's diabetic" at second 5, and at second 40 flashes a reminder "DIABETIC — said 35s ago." No typing, no database, instant recall.

5. **It can look up TWO things at once: the big manual AND your personal info, in the same breath.** ("Dual-index.")
   - 💡 *Example:* **RxEcho** — an 78-year-old asks if two pills are safe together. Moss checks the giant drug-interaction book AND *her specific medication list* simultaneously, and answers in one go.

6. **It can hand the whole memory to another rep (or a human) instantly.** ("Cross-agent handoff.") The AI fills the cabinet, then a human teammate opens the *same* cabinet and already knows everything.
   - 💡 *Example:* **RepeatZero** — the AI says "let me get a specialist," and *before* the human even says hello, their screen already shows the customer's name and the 3 facts the AI looked up. The customer never has to repeat themselves.

7. **It can filter by rules — like "only within 5km" or "only the startup plan."** ("Metadata filters.") It's not just "find similar"; it's "find similar *that also matches these exact conditions.*"
   - 💡 *Example:* **LifelineLocal** — a crisis counselor's helper instantly finds shelters *within 5km, open right now, that accept this situation.*

8. **It can dial a knob between "exact word match" and "meaning match."** ("Hybrid alpha.") Sometimes you need the *exact* part number "BRK-7741-X-EU" (not something that *sounds* similar). Other times you want "things that mean roughly this." Moss lets you choose.
   - 💡 *Example:* **ExactMatch** — a parts distributor where guessing a *similar* SKU = shipping the wrong part = a lawsuit. Moss nails the exact one.

### How a product *uses Moss*, start to finish (the simplest version)

1. You give Moss a pile of knowledge (support docs, a manual, a product catalog). Moss organizes it into a searchable "index" (think: a filing cabinet).
2. Your voice app **loads that index into memory** when it starts up (this is important — if you forget, it falls back to the slow way!).
3. During a call, every time the customer asks something, your app **queries** Moss ("find the 3 most relevant facts about cracked screens"). Moss answers in ~6ms.
4. Your app hands those 3 facts to the brain (the LLM), which turns them into a friendly spoken sentence.

**What Moss is NOT:** It's not the brain (it doesn't *think* or *write* sentences — it *finds facts*). It's not the voice. It's not great at reading messy PDFs itself (that's Unsiloed's job — Moss even says "for complex documents, parse them with Unsiloed first"). One gotcha: its live-memory trick (sessions) doesn't work in plain JavaScript/Node yet — you write those parts in Python or Swift.

> **Remember Moss as:** *the rep's brain-cabinet that finds any fact instantly — even offline, even while the facts are changing.*

---

## ☎️ LIVEKIT — the ears, the timing, and the phone line

**What it is in one sentence:** LiveKit is the plumbing that connects a live voice call and runs the "hear you → think → speak" loop, including the tricky art of knowing *when it's your turn to talk.*

### The story

Building a voice bot from scratch is shockingly hard — not the AI part, the *conversation* part. How does the software know you've *finished* your sentence vs. just paused to breathe? What happens when you interrupt it mid-word? How does it even get on a phone call? LiveKit handles all of that so you don't have to.

LiveKit gives you a ready-made "voice agent" assembly line:
- **Speech-to-text (STT):** turns your spoken words into written text. (LiveKit doesn't make this itself — it plugs into providers like Deepgram. Think of it as the ears.)
- **The brain (LLM):** decides the reply.
- **Text-to-speech (TTS):** turns the reply text back into audio (this is where **MiniMax** plugs in as the voice).
- **Turn-taking & interruptions:** the social skills — knowing when to talk, and stopping politely when you cut in.

### The two superpowers that matter most for this hackathon

1. **Real phone calls.** ("Telephony / SIP.") LiveKit can place and receive *actual phone calls* — your AI can call a real phone number, or people can call it. It can even detect voicemail and transfer to a human.
   - 💡 *Example:* **SixtySecond** — someone fills out a web form, and LiveKit makes the AI *call their phone within 60 seconds.*

2. **Silently listening to a conversation and pushing info to a screen.** ("Ambient + data channel.") LiveKit can join a call and *just listen* without ever speaking, while shooting helpful info onto a screen in real time.
   - 💡 *Example:* **Candle911** and **Undertow** — the AI never talks; it listens to a live human conversation and flashes the right card on a screen at the perfect moment.

### How a product *uses LiveKit*

When "Dwayne the HVAC tech" calls the support line in idea **GreaseHands**: LiveKit answers the phone, converts his speech to text, notices when he's done talking, sends the text to the brain (which secretly asked Moss for the answer), gets the reply, hands it to MiniMax to speak, and plays it back — all while handling the moment Dwayne interrupts to say "wait, I already tried that."

**What LiveKit is NOT:** It's not the brain and not the knowledge. It's the *connection and the conversation flow.* It's the body and the nervous system, not the thoughts.

> **Remember LiveKit as:** *the phone line + ears + sense of timing that makes a back-and-forth voice conversation actually work.*

---

## 🗣️ MINIMAX — the voice (and a cheap backup brain)

**What it is in one sentence:** MiniMax turns text into natural-sounding speech super cheaply, and can **clone a real person's voice** from a tiny sample — plus it offers cheap AI brains, music, and video.

### The story

Your rep has decided what to say (as text). Now it needs to actually *say it out loud* in a voice that doesn't sound like a 2005 GPS. That's MiniMax. It speaks in 40 languages, can sound emotional (even whisper), and streams the audio out fast so there's no delay.

### The jaw-dropping trick: voice cloning

Give MiniMax ~10–30 seconds of someone's recorded voice, and it can then speak *anything* in that person's voice.
- 💡 *Example (emotional):* **VoiceOfMine** — a man losing his voice to ALS banks 30 seconds of it, so his AI can keep answering his grandkids *in his own voice* forever.
- 💡 *Example (sales):* **Doppel** — you chat at a trade-show booth for 15 seconds; an hour later your phone rings and it's *your own voice* calling you back with a personalized follow-up. Uncanny — and unforgettable.

### How a product *uses MiniMax*

In almost every idea, the flow is: brain writes the reply text → **MiniMax speaks it** → LiveKit plays it on the call. In a few ideas (like a voice clone demo), MiniMax *is* the wow factor itself.

**What MiniMax is NOT — important boundary:** MiniMax has **no "ears"** — it does *not* turn speech into text (no STT) and doesn't handle turn-taking. That's LiveKit's job. MiniMax is the *mouth*, not the ears. (Its cheap brains can also "over-think" and get slow, so people often use it for the voice and a different brain for thinking.)

> **Remember MiniMax as:** *the vocal cords — the natural (or cloned) voice that speaks the answer.*

---

## 📚 UNSILOED — the assistant who reads the giant documents for you

**What it is in one sentence:** Unsiloed takes messy, ugly documents (scanned PDFs, contracts, manuals, forms with tables) and turns them into clean, organized index cards that Moss can store and search.

### The story

Real company knowledge lives in horrible 400-page PDFs: insurance policies, equipment manuals, contracts full of tables and fine print. You can't just dump that mess into a search system — it's full of weird columns, scanned pages, and footnotes. Unsiloed is the diligent intern who reads the whole thing and rewrites it as neat, labeled cards — *and* it tags each card with **what page it came from** and **exactly where on the page** (a box you can highlight). It even gives a confidence score ("I'm 95% sure I read this number right").

### How a product *uses Unsiloed* (this is the classic "ingest → retrieve" combo)

In idea **GreaseHands**, *before* the hackathon demo even starts:
1. **Unsiloed** reads the 600-page HVAC manual and turns it into clean cards (each tagged with its page number).
2. Those cards get loaded into **Moss**.
3. *Now* during the live call, when Dwayne says "error E4," Moss instantly finds the right card and the rep says **"Page 214 — high-pressure lockout."** — and can even show the exact spot on that page.

The pattern is always: **Unsiloed parses → Moss indexes → the voice agent answers.** Unsiloed is the *prep work*; Moss is the *live magic*.

**What Unsiloed is NOT:** It's *not* instant — reading a big document takes a few minutes, so you do it *ahead of time*, not during the call. It also doesn't store, search, or speak — it just turns mess into clean cards and hands them off.

> **Remember Unsiloed as:** *the assistant who reads the giant PDF beforehand and files it as neat, page-tagged cards.*

---

## 🧑‍💼 TRUEFOUNDRY — the manager / switchboard for the brain

**What it is in one sentence:** TrueFoundry sits between your app and all the AI brains, acting as a single switchboard that picks the best brain, blocks it from saying dangerous things, keeps it from going down, and tracks the bill.

### The story

There are hundreds of AI "brains" (GPT, Claude, Gemini, MiniMax, etc.). You don't want to wire up each one separately, and you *definitely* don't want your support bot to (a) leak a customer's social security number, (b) go silent because one brain provider had an outage, or (c) run up a surprise bill. TrueFoundry is the experienced manager standing behind the rep handling all of that.

What the manager does:
- **One door to every brain.** Talk to TrueFoundry; it routes to whichever AI you want. Swap brains without rewiring.
- **Failover.** If the main brain goes down *mid-call*, it instantly switches to a backup so the customer never hears dead air.
- **Guardrails.** It can automatically catch and hide private info (like an SSN) before it's spoken.
- **A live bill + speed dashboard.** It shows exactly what each call costs and how fast it was — great for proving "this is production-ready" to a judge.

### How a product *uses TrueFoundry*

In idea **Killswitch**, the demo literally *revokes the main brain's key live, mid-sentence* — and the rep keeps talking without a stutter because TrueFoundry instantly failed over to a backup brain. The screen shows it switch. It's a "we never go down" flex that makes a team look like a real company.

**What TrueFoundry is NOT:** It's not the brain itself — it's the *manager of* the brains. It doesn't hear, speak, or remember. It governs.

> **Remember TrueFoundry as:** *the switchboard + compliance manager that keeps the brain reliable, safe, and on-budget.*

---

## 🏢 AWS — the office building

**What it is in one sentence:** AWS is the cloud (giant rented computers) where all your software actually runs, plus free credits for the hackathon.

You don't "demo AWS" — it's the building everything sits inside. It also offers its own brains (Bedrock), ears (Transcribe), and voice (Polly) as backups if you want them. Mostly: it's where you host the thing so it's online.

> **Remember AWS as:** *the office building / power grid the whole rep runs on.*

---

## 🎬 The full story: one call, all six products working together

Let's watch **GreaseHands** (the HVAC field-tech support line) handle one real call, and name each product as it does its job. This is the whole stack in one scene:

> **The night before (prep):**
> 📚 **Unsiloed** reads the 600-page Carrier manual and turns it into 4,000 clean, page-tagged cards.
> ⭐ **Moss** loads those cards into a searchable cabinet and keeps it in memory.
> 🏢 **AWS** is the cloud server hosting all of this.
>
> **2:00 PM, a rooftop. Dwayne's hands are covered in grease. He calls the support number.**
>
> 1. ☎️ **LiveKit** answers the phone and turns his speech into text: *"I'm getting error E4 on a Carrier 48TC."*
> 2. ☎️ **LiveKit** notices he's finished talking and sends the text onward.
> 3. ⭐ **Moss** instantly (6ms) finds two things at once: the manual card for "error E4" **and** the live memory that *"Dwayne already power-cycled the board 90 seconds ago."*
> 4. 🧠 The **brain (LLM)** — reached safely through 🧑‍💼 **TrueFoundry**, which makes sure it stays online and on-budget — takes those facts and writes a helpful reply.
> 5. 🗣️ **MiniMax** speaks that reply in a calm, natural voice: *"Page 214 — high-pressure lockout. Since you already power-cycled the board, next check the condenser fan you mentioned was noisy."*
> 6. ☎️ **LiveKit** plays it down the phone line. Dwayne fixes it without ever touching a laptop.
>
> **The wow:** the rep cited an exact manual page AND remembered what Dwayne tried 90 seconds ago — *in one instant breath, with no awkward pause.* That "no pause, and it actually knew" feeling is **Moss.** Everything else is the body around it.

---

## 🗯️ Scary words, translated (mini-glossary)

| Buzzword | What it actually means |
|---|---|
| **Retrieval** | Looking up the right fact from a pile of knowledge. (Moss does this fast.) |
| **RAG** | "Retrieval-Augmented Generation" = let the AI *look stuff up* before it answers, so it doesn't make things up. Just "give the brain a cheat sheet before it talks." |
| **Latency** | Lag. The delay before you hear a response. Low latency = snappy. High latency = awkward silence. |
| **Index** | An organized, searchable filing cabinet of knowledge. |
| **Embedding / vector** | The math trick that lets a computer find things by *meaning*, not exact words. You don't need to care how — just know it powers "find similar." |
| **Semantic search** | Searching by *meaning* ("cracked screen" finds "shattered display"), not exact keywords. |
| **STT (speech-to-text)** | Ears: spoken words → written text. (LiveKit + a provider.) |
| **TTS (text-to-speech)** | Mouth: written text → spoken audio. (MiniMax.) |
| **LLM** | The "brain" — the AI that reads and writes language. (GPT, Claude, MiniMax, etc.) |
| **Token** | A chunk of text the brain reads/writes; brains are billed per token. Think "syllables you pay for." |
| **Turn detection** | Knowing when *you've* stopped talking so the AI can reply (and not cut you off). |
| **Barge-in / interruption** | You talking over the AI, and it politely stopping. |
| **On-device / WASM** | Running the software *on your own laptop/phone/browser* instead of a far-away server — so private data never leaves. |
| **Hot-swap / auto-refresh** | Updating the knowledge *live*, mid-conversation, with no restart. |
| **Session** | The AI's live memory of *this* conversation, built as you talk. |
| **Gateway** | A single front-door that routes to many AI brains (TrueFoundry). |
| **Guardrail** | An automatic rule that stops the AI from saying something dangerous (e.g., leaking private info). |
| **SIP / telephony** | The tech for real phone calls. |

---

## ✅ The 30-second recap (screenshot this)

- **MOSS** ⭐ = instant memory + fact-finder (under 10ms, even offline, even while facts change). **The hero.**
- **LiveKit** = the phone line + ears + sense of timing.
- **MiniMax** = the voice (and can clone a real person's voice).
- **Unsiloed** = reads giant PDFs beforehand and files them as clean cards.
- **TrueFoundry** = the manager keeping the brain safe, reliable, and on-budget.
- **AWS** = the building it all runs in.

**The whole point of the hackathon:** voice and brains got fast and cheap; *looking things up* was the last slow part. Moss makes looking-things-up instant — so an AI on the phone can finally hold a real conversation *and* know real facts at the same time, with no awkward pause.

**Now go read `IDEAS.md`** — every idea is just this same rep, pointed at one specific desperate person, with one Moss superpower as the "wow." It'll all make sense now. 🎙️
