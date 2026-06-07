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
    <main className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-hidden px-6 py-24">
      <Branch side="left" />
      <Branch side="right" />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        <p className="eyebrow hero-fade-in" style={{ animationDelay: '0.1s' }}>
          {companyName} · AI CPA
        </p>

        <h1
          className="headline hero-fade-in mt-5 text-[clamp(44px,7vw,84px)]"
          style={{ animationDelay: '0.25s' }}
        >
          <span className="block">Not another tax form.</span>
          <span className="text-accent-warm block italic">A CPA you can talk to.</span>
        </h1>

        <p
          className="text-muted-foreground hero-fade-in mx-auto mt-6 max-w-lg text-base leading-relaxed"
          style={{ animationDelay: '0.5s' }}
        >
          Upload your documents, generate your 1040, and talk it through with a voice CPA — grounded
          in your real numbers.
        </p>

        <div className="hero-fade-in mt-8" style={{ animationDelay: '0.7s' }}>
          <Magnetic radius={140} strength={0.4}>
            <Button
              size="lg"
              onClick={() => router.push('/upload')}
              className="rounded-full px-12 font-mono text-xs font-bold tracking-wider uppercase"
            >
              Enter
            </Button>
          </Magnetic>
        </div>

        {/* Product showcase — drop your demo clip at public/images/app-demo.mp4 */}
        <div className="hero-fade-in relative mt-16 w-full" style={{ animationDelay: '0.9s' }}>
          <div className="glass absolute -top-5 -left-5 z-20 hidden rounded-2xl px-3.5 py-2.5 text-left sm:block">
            <p className="eyebrow !text-[9px]">Voice-first</p>
            <p className="text-foreground text-sm font-medium">
              &ldquo;What&apos;s my refund?&rdquo;
            </p>
          </div>
          <div className="glass absolute top-1/3 -right-5 z-20 hidden rounded-2xl px-3.5 py-2.5 text-left sm:block">
            <p className="eyebrow !text-[9px]">Grounded</p>
            <p className="text-foreground text-sm font-medium">In your documents</p>
          </div>

          <BrowserFrame url="moss · your ai cpa">
            <div className="bg-muted relative aspect-video w-full">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                autoPlay
                muted
                loop
                playsInline
                poster="/images/hero-video-poster.jpg"
                className="h-full w-full object-cover"
              >
                <source src="/images/app-demo.mp4" type="video/mp4" />
              </video>
            </div>
          </BrowserFrame>
        </div>
      </div>
    </main>
  );
}
