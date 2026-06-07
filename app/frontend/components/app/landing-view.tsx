'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BrowserFrame } from './browser-frame';
import { CursorReveal } from './cursor-reveal';
import { Magnetic } from './magnetic';

interface LandingViewProps {
  companyName?: string;
}

// Hover "comes alive" — warm the autumn branch toward gold under the cursor.
const REVEAL_FILTER = 'hue-rotate(-12deg) saturate(1.5) brightness(1.06)';

function Branch({ side }: { side: 'left' | 'right' }) {
  const img = side === 'left' ? '/images/branch-left.jpg' : '/images/branch-right.jpg';
  const fade = side === 'left' ? 'to right' : 'to left';
  const mask = `linear-gradient(${fade}, black 48%, transparent 100%)`;
  const layer = (filter?: string): React.CSSProperties => ({
    backgroundImage: `url('${img}')`,
    maskImage: mask,
    WebkitMaskImage: mask,
    ...(filter ? { filter } : { opacity: 0.5 }),
  });
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-1/2 z-0 hidden h-[118%] w-[40vw] max-w-[560px] -translate-y-1/2 lg:block ${
        side === 'left' ? '-left-24' : '-right-24'
      }`}
    >
      <CursorReveal
        radius={300}
        className="pointer-events-auto h-full w-full"
        base={<div className="h-full w-full bg-cover bg-center" style={layer()} />}
        reveal={<div className="h-full w-full bg-cover bg-center" style={layer(REVEAL_FILTER)} />}
      />
    </div>
  );
}

export function LandingView({ companyName = 'Moss' }: LandingViewProps) {
  const router = useRouter();

  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden px-6 py-20">
      <Branch side="left" />
      <Branch side="right" />

      {/* Hackathon announcement */}
      <div className="glass hero-fade-in text-muted-foreground absolute top-6 left-1/2 z-30 hidden -translate-x-1/2 rounded-full px-4 py-2 text-[10px] font-medium tracking-[0.12em] whitespace-nowrap uppercase md:block">
        Conversational AI Hackathon · Moss F25 &times; Y Combinator · SF · Jun 6&ndash;7
      </div>

      {/* The hero lives inside the browser-frame card. */}
      <div className="hero-fade-in relative z-10 w-full max-w-2xl">
        <div className="glass absolute -top-5 -left-5 z-20 hidden rounded-2xl px-3.5 py-2.5 text-left sm:block">
          <p className="eyebrow !text-[9px]">Voice-first</p>
          <p className="text-foreground text-sm font-medium">
            &ldquo;What&apos;s my refund?&rdquo;
          </p>
        </div>
        <div className="glass absolute -right-5 -bottom-5 z-20 hidden rounded-2xl px-3.5 py-2.5 text-left sm:block">
          <p className="eyebrow !text-[9px]">Grounded</p>
          <p className="text-foreground text-sm font-medium">In your documents</p>
        </div>

        <BrowserFrame url="app.moss.cpa">
          <div className="flex flex-col items-center px-8 py-16 text-center sm:px-16 sm:py-20">
            <p className="eyebrow">{companyName} · AI CPA</p>

            <h1 className="headline mt-5 text-[clamp(38px,5.4vw,66px)] text-balance">
              <span className="block">Not another tax form.</span>
              <span className="text-accent-warm block italic">A CPA you can talk to.</span>
            </h1>

            <p className="text-muted-foreground mx-auto mt-6 max-w-md text-base leading-relaxed">
              Upload your documents, generate your 1040, and talk it through with a voice CPA —
              grounded in your real numbers.
            </p>

            <Magnetic radius={140} strength={0.4} className="mt-9">
              <Button
                size="lg"
                onClick={() => router.push('/upload')}
                className="rounded-full px-12 font-mono text-xs font-bold tracking-wider uppercase"
              >
                Enter
              </Button>
            </Magnetic>
          </div>
        </BrowserFrame>
      </div>
    </main>
  );
}
