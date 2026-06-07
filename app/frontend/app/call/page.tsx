import { BackButton } from '@/components/app/back-button';
import { GroundingChips } from '@/components/app/cpa-call/grounding-chips';
import { ReturnSummary } from '@/components/app/cpa-call/return-summary';
import { SuggestedQuestions } from '@/components/app/cpa-call/suggested-questions';

/**
 * Live CPA call screen — composes the in-app add-ons (numbers at a glance,
 * suggested questions, grounding chips) around the agent presence. Self-contained
 * and conflict-free; the same components can be lifted into /return later.
 */
export default function CallPage() {
  return (
    <>
      <BackButton href="/return" />
      <main className="upload-atmosphere min-h-svh">
        <div className="mx-auto w-full max-w-5xl px-6 pt-24 pb-20">
          {/* Agent presence */}
          <div className="fade-up flex flex-col items-center text-center">
            <div className="relative flex size-28 items-center justify-center">
              <span className="bg-accent-warm/20 absolute inset-0 animate-ping rounded-full [animation-duration:2.4s]" />
              <span className="bg-accent-warm/15 absolute inset-3 rounded-full" />
              <span className="from-accent-warm relative size-16 rounded-full bg-gradient-to-br to-[#7d5536] shadow-[0_12px_32px_-8px_rgba(184,132,92,0.6)]" />
            </div>
            <p className="eyebrow mt-6">Live · Tax It Easy</p>
            <h1 className="headline mt-3 text-4xl sm:text-5xl">Talking through your return</h1>
            <p className="text-muted-foreground mt-3 text-sm">Listening&hellip;</p>
          </div>

          {/* Numbers at a glance */}
          <section className="fade-up mt-12" style={{ animationDelay: '120ms' }}>
            <ReturnSummary />
          </section>

          {/* Suggested questions + grounding */}
          <section
            className="fade-up mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]"
            style={{ animationDelay: '200ms' }}
          >
            <SuggestedQuestions />
            <div className="border-border bg-card/40 rounded-xl border p-5">
              <span className="eyebrow">Grounding</span>
              <p className="text-muted-foreground mt-2 mb-4 text-xs leading-relaxed">
                Every answer is drawn from the documents you uploaded — never guessed.
              </p>
              <GroundingChips />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
