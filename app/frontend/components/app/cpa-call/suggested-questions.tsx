'use client';

import { useState } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';

const DEFAULT_QUESTIONS = [
  "What's my refund this year?",
  'Explain my biggest deductions',
  'Did I miss any deductions?',
  'How is my refund calculated?',
  'What changed from last year?',
];

/**
 * Tappable starter prompts for the voice CPA. `onAsk` fires the selected
 * question (wire to the agent); the chip shows a selected state meanwhile.
 */
export function SuggestedQuestions({
  questions = DEFAULT_QUESTIONS,
  onAsk,
}: {
  questions?: string[];
  onAsk?: (question: string) => void;
}) {
  const [asked, setAsked] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center gap-2">
        <Mic className="text-accent-warm size-3.5" strokeWidth={2} aria-hidden="true" />
        <span className="eyebrow">Ask your CPA</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {questions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setAsked(q);
              onAsk?.(q);
            }}
            className={cn(
              'rounded-full border px-3.5 py-2 text-xs font-medium transition-all duration-200',
              asked === q
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card/60 text-foreground hover:border-primary/40 hover:-translate-y-0.5'
            )}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
