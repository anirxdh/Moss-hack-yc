# Track Users: The Real Daily Pains (Idea Fuel)

Research for the Moss x YC Conversational AI Hackathon (Jun 6-7 2026). Each track below profiles the actual humans who'd use a voice+retrieval agent, with cited complaints, the specific saving moment, and idea seeds.

The through-line across all three tracks: a person is **on a live conversation** (or should be), but the relevant fact, the next action, and the record-keeping all live somewhere else. Today they either stall the human (hold music, "let me check"), drop presence (head-down typing), or pay later (after-hours catch-up). A voice agent that listens + retrieves + acts in real time collapses that gap.

---

## Track 1 — Lead Gen: inbound SDRs / AEs / RevOps

### Who they are & what wrecks their day

Inbound SDRs and AEs live and die by **speed-to-lead**, and the math is brutal. 82% of consumers expect a reply within 10 minutes, yet the average B2B team takes **42 hours** to respond to a new lead and **38% of leads never get a reply at all** ([LeadAngel](https://www.leadangel.com/blog/operations/speed-to-lead-statistics/)). Responding within 5 minutes makes a lead 9x more likely to engage, and 35-50% of sales go to whoever responds first ([SPOTIO](https://spotio.com/blog/sales-statistics/)). The odds of qualifying a lead drop 80% between a 5-minute and a 10-minute response ([Chili Piper](https://www.chilipiper.com/article/speed-to-lead-statistics)). So every minute a form-fill sits unworked is money walking to a competitor — and a huge share of those fills land **after hours / on weekends**, exactly when no human is watching the queue ([Voiso](https://voiso.com/articles/lead-response-time-metrics/)).

Then there's **follow-up persistence**, where reps quietly self-sabotage: 80% of sales require 5+ follow-ups, but **44% of reps give up after a single follow-up** and **92% quit after the 4th "no"** ([ZoomInfo](https://pipeline.zoominfo.com/sales/sales-follow-up-statistics)). The average closed deal takes 8-12 touchpoints. Reps know this and still drop leads, because manual cadence management is tedious and the quota clock is loud.

The third wrecker is **CRM hygiene and manual qualification**. SDRs "get stuck manually qualifying hundreds of leads, spending hours each day sorting requests and logging notes into CRM systems while their quota clock keeps ticking" ([UserGems](https://www.usergems.com/blog/ai-sdrs-for-managing-inbound-leads)). Marketing-qualified leads pile up from every source; the qualify-and-log loop is "extremely tedious," and reps want bidirectional CRM sync so every lead and activity logs automatically instead of by hand. RevOps owns the downstream mess: unrouted leads, no urgency signaling, and "most lead routing tools don't focus on urgency, so sales reps aren't alerted in real time" ([LeadAngel](https://www.leadangel.com/blog/operations/speed-to-lead-statistics/)).

### The specific moment a voice+retrieval agent saves them

A demo-request form is submitted at **9:47pm on a Saturday**. Within 60 seconds a voice agent calls the lead, greets them by name, pulls firmographic + enrichment data and prior-touch history mid-conversation, runs the qualification script (budget/authority/need/timeline), books a meeting on the right AE's calendar against routing rules, and writes a clean, structured CRM record with the call summary and disposition — all before a human ever logs in Monday. The 391% conversion lift from same-minute contact ([Chili Piper](https://www.chilipiper.com/article/speed-to-lead-statistics)) is captured automatically, and the rep wakes up to a qualified meeting instead of a cold 42-hour-old lead.

### → Idea seeds

1. **After-hours speed-to-lead voice closer.** Fires a qualifying + booking call within 60s of any inbound form, 24/7; hands warm-qualified meetings to the right AE by routing rules. Targets the 42-hour-gap and after-hours dead zone directly.
2. **Persistence engine that actually dials.** A voice agent that owns the 5-12 touch cadence the human gives up on after touch #1 — voicemails, callbacks, retries at proven windows (4-5pm, 11am-12pm) — so the 80%-needs-5-touches stat stops leaking.
3. **Zero-typing CRM scribe for reps.** Listens to live inbound/discovery calls and auto-writes structured CRM fields (BANT, next step, disposition) with bidirectional sync, killing the "hours/day logging notes" tax.
4. **Real-time qualification copilot for live AEs.** During a live inbound call, whispers enrichment, prior touches, and the next qualifying question so reps don't fumble for context or under-qualify.
5. **RevOps urgency router with a voice fallback.** Detects an unworked hot lead aging past N minutes and auto-launches the voice agent so no lead silently dies in the queue.
6. **Re-engagement agent for dead/never-replied leads.** Voice-calls the 38% who never replied and the closed-lost pile with a context-aware re-open, qualifying re-warmed ones back into pipeline.

---

## Track 2 — Support: CX agents / support leaders

### Who they are & what wrecks their day

Frontline support agents fight a constant **doc-hunt**: support agents spend ~20% of their time just searching for information, and a good knowledge-management setup can cut search time by ~35% — time currently lost "hunting through Slack threads and email chains" ([Brainfish](https://www.brainfishai.com/blog/help-doc-debt-knowledge-bases-are-out-of-date)). Knowledge is scattered across Slack, Google Docs/Drive, email, and "outdated Confluence pages," forcing swivel-chair searching across multiple tools. Worse, the docs themselves are **stale**: ~80% of knowledge bases are out of date because "teams prioritize clearing the ticket queue over maintaining documentation," and poor search causes ~40% of failed self-service attempts ([Brainfish](https://www.brainfishai.com/blog/help-doc-debt-knowledge-bases-are-out-of-date)). So agents either put customers on hold to dig, or answer from a stale source.

**Escalations and handoffs** are where customers feel the pain: when tickets get handed between teams "without proper documentation of interactions and troubleshooting steps already taken, customers have to repeat their concerns," and "each handoff feels like proof that no one is listening" ([Supportbench](https://www.supportbench.com/customer-facing-support-policies-reduce-escalations-templates/)). Frontline agents "often lack the authority to solve issues and become message-takers" ([Spur](https://www.spurnow.com/en/blogs/customer-service-escalation-process)). The agent re-explains, the customer re-explains, everyone loses.

**AHT pressure** sits on top of all of it. Global average handle time is ~6m10s, and managing to AHT "make[s] agents focus on speed of service rather than quality." Observed coping behaviors include "cutting off calls as they approach the AHT target," "not doing after-call work or following up," "transferring difficult calls to another department," and "rushing the caller off the phone" ([CallCentreHelper](https://www.callcentrehelper.com/how-to-measure-average-handling-time-52403.htm)). Wrap-up / after-call work "exposes tool usability and workflow friction" — heavy wrap time means agents are "duplicating work, navigating multiple screens, or performing post-call actions that could be automated" ([Calabrio](https://www.calabrio.com/wfo/quality-management/average-handle-time/)). Rushing backfires: one unresolved issue drives 2-3 additional contacts ([NiCE](https://www.nice.com/glossary/what-is-contact-center-average-handle-time/)).

In regulated industries, **compliance** adds dread: agents read "lengthy and complicated scripts," and "even experienced agents can make mistakes whether by not speaking clearly, skipping T&C sections, or misreading the script." Agents "with varying experience have to make decisions independently about which T&Cs are required — impacting speed and compliance" ([Lightico](https://www.lightico.com/blog/how-digital-legal-disclosures-can-slash-aht-and-boost-compliance/)). It's mind-numbing and high-stakes at once.

### The specific moment a voice+retrieval agent saves them

A customer asks a gnarly policy question. Instead of "let me put you on hold" + a 90-second swivel-chair dig through Confluence and Slack, the agent's copilot has already heard the question, retrieved the **current, source-verified** answer (with a freshness/version flag if the doc is stale), surfaced the exact disclosure to read for this product, and pre-drafted the wrap-up note. On escalation, it auto-packages the full interaction + steps-already-taken so the next tier never asks the customer to repeat themselves. AHT drops because the dig and the wrap-up both vanish, and the answer is right the first time — so the 2-3 follow-up contacts never happen.

### → Idea seeds

1. **Live answer-retrieval copilot with freshness flags.** Listens to the call, retrieves the verified answer in real time, and flags when the source doc is stale/conflicting — so agents stop reading from 80%-out-of-date KBs and stop putting customers on hold.
2. **Zero-repeat escalation packager.** Auto-generates a structured handoff (issue, steps tried, customer context) at the moment of escalation, killing the "customer repeats their story at every transfer" failure.
3. **After-call work autopilot.** Drafts the wrap-up note, updates the case, and triggers follow-up actions from the conversation — directly removing the wrap-time tax that inflates AHT.
4. **Real-time compliance guardrail.** Detects which disclosure/T&C applies to this product mid-call and cues the exact correct script, catching skips/misreads before they become violations.
5. **Stale-doc self-healing loop.** When agents repeatedly override or correct a KB answer on calls, auto-flag that doc for update — turning live calls into the maintenance signal teams never have time to generate.
6. **Deflection agent that hands off cleanly.** A front-line voice agent that resolves the easy 40% and, when it can't, escalates to a human **with full context attached** so the human starts at step 2, not step 0.

---

## Track 3 — Co-Pilot / ambient: reps, clinicians, recruiters, lawyers, dispatchers

### Who they are & what wrecks their day

This track is defined by one universal tension: **note-taking vs. presence**. "You cannot listen and write at the same time. The recruiter who looks the most composed in interviews is usually the one taking the worst notes. The one taking the best notes is barely making eye contact" ([Metaview](https://www.metaview.ai/resources/blog/interview-notes)). People retain only 10-20% of what they hear while taking notes, candidates "can tell when a recruiter isn't fully engaged," and excessive typing "makes interviews feel transactional" and harms rapport ([Loxo](https://www.loxo.co/blog/why-every-recruiter-should-be-using-an-ai-notetaker)).

**Clinicians** are the poster child for after-call work: physicians spend more than half the workday on EHR documentation rather than patients, ~70% report too much after-hours documentation ("pajama time"), and documentation is among the most-cited drivers of burnout ([AMA](https://www.ama-assn.org/practice-management/digital-health/ai-scribes-save-15000-hours-and-restore-human-side-medicine)). An ambient scribe pilot cut burnout from 51.9% to 38.8% in 30 days (74% lower odds) and reduced note-composition time 15%+ ([John Snow Labs](https://www.johnsnowlabs.com/ambient-ai-scribes-redefining-clinical-documentation-burnout/)).

**Lawyers** pay the after-the-fact tax in dollars: waiting one day to log time loses ~10% of billable hours, a week loses 25%+, and reconstructing from memory is "error-prone" with point-ones routinely slipping through. A $300/hr attorney can forfeit $20k-$40k/year to poor timekeeping — and reconstructing time after the fact "can easily cross the line into unethical territory" ([Aderant](https://www.aderant.com/think-tank/time-entry-law-firms/), [TimeMiner](https://www.timeminer.com/blog/time-tracking-challenges-law-firms-face-1)).

**911 dispatchers** are the extreme case of **missing the relevant fact in real time**: telecommunicators "assimilate information from five to six computer screens during a single 9-1-1 call," are "drowning in a deluge of disparate data," and face direct "pressure to quickly locate information while callers are waiting for help" — under life-or-death, flawless-performance conditions ([Simplesense](https://simplesense.io/blog/cognitive-workload-for-dispatchers-remains-at-dangerous-levels), [Peregrine](https://peregrine.io/resources/911-operator-wellness-challenges-solutions-and-how-agencies-can-prevent-burnout)). Sales reps and AEs face the milder version: fumbling for the right account fact, objection rebuttal, or competitor counter while the prospect is mid-sentence.

The shared wreckage: the human is either **head-down (lost presence)**, **stalling (caller waits)**, or **catching up after hours (burnout + lost revenue)** — because capture, recall, and record-keeping all happen at the wrong time relative to the live conversation.

### The specific moment a voice+retrieval agent saves them

The professional stays **fully present and eye-to-eye** through the entire conversation. Ambiently in the background, the agent: (a) captures everything and writes the structured record live — the SOAP note, the interview scorecard, the billable time entry, the CAD incident log — so there's no pajama-time / end-of-day reconstruction; and (b) surfaces the one relevant fact at the exact moment it's needed — the prior med interaction, the candidate's earlier contradictory answer, the address history on a 911 call, the competitor objection rebuttal — without the human breaking eye contact to dig across five screens. After-call work approaches zero; the relevant fact arrives in real time; the human is present.

### → Idea seeds

1. **Ambient billable-time scribe for lawyers.** Passively reconstructs accurate, defensible time entries from calls/meetings/work blocks in real time, recovering the $20k-$40k/yr/attorney lost to after-the-fact memory logging.
2. **Recruiter presence agent.** Captures the full interview into a structured scorecard live, so recruiters keep eye contact instead of typing — and every stakeholder gets the real transcript, not someone's 10-20% recall.
3. **Real-time fact-surfacer for live reps.** During the call, whispers the exact account fact / objection rebuttal / competitor counter the moment the prospect raises it, so the AE never says "let me get back to you."
4. **Dispatcher single-pane copilot.** Listens to the 911 call and auto-pulls address history, prior incidents, and protocol from the 5-6 screens into one surfaced answer, cutting the "locate-info-while-caller-waits" delay.
5. **Ambient clinical scribe + retrieval.** Writes the note live AND surfaces the relevant drug interaction / prior history mid-visit — pairing the proven burnout drop with real-time decision support, not just transcription.
6. **Universal "present-mode" capture layer.** One ambient agent that swaps the domain template (SOAP / scorecard / time entry / CAD log / CRM) so any conversation-heavy professional ends the call with the record already done and zero after-call work.

---

## Cross-track synthesis (one line)

Every one of these users is punished for the gap between **a live conversation** and **the system that holds the answer + the record** — a voice+retrieval agent that listens, retrieves the right fact in real time, and writes the record automatically erases the hold music, the head-down typing, and the after-hours catch-up in one move.
