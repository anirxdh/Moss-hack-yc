'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface LandingViewProps {
  companyName?: string;
}

export function LandingView({ companyName = 'Moss' }: LandingViewProps) {
  const router = useRouter();

  return (
    <main className="relative grid h-svh place-content-center overflow-hidden px-6">
      {/* Background: 4K nature video, with a forest-gradient fallback behind it.
          Drop a clip at public/nature.mp4 (or swap the source for a hosted URL). */}
      <div className="landing-fallback absolute inset-0 -z-20" />
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 -z-20 h-full w-full object-cover"
      >
        <source src="/nature.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/40 via-black/35 to-black/65" />

      {/* Enter card — a living-photos-style window over the scene. */}
      <div className="fade-up relative mx-auto w-full max-w-md">
        {/* floating annotation chips */}
        <div className="absolute top-10 right-full mr-4 hidden -rotate-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-md md:block">
          <p className="font-mono text-[9px] tracking-[0.18em] text-white/55 uppercase">
            Voice-first
          </p>
          <p className="text-xs font-medium text-white">Talk to a CPA</p>
        </div>
        <div className="absolute bottom-12 left-full ml-4 hidden rotate-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-md md:block">
          <p className="font-mono text-[9px] tracking-[0.18em] text-white/55 uppercase">Grounded</p>
          <p className="text-xs font-medium text-white">In your documents</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-2xl shadow-black/40 backdrop-blur-xl transition duration-500 ease-out hover:-translate-y-1 hover:bg-white/[0.13]">
          {/* browser chrome */}
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
            <span className="size-2.5 rounded-full bg-red-400/70" />
            <span className="size-2.5 rounded-full bg-amber-400/70" />
            <span className="size-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-3 font-mono text-[10px] tracking-wider text-white/45 lowercase">
              moss · your ai cpa
            </span>
          </div>

          {/* body */}
          <div className="px-8 py-10 text-center sm:px-10">
            <p className="text-primary font-mono text-[11px] font-bold tracking-[0.22em] uppercase">
              {companyName}
            </p>
            <h1 className="font-display mt-3 text-4xl leading-[1.05] font-light tracking-tight text-white sm:text-5xl">
              Your AI CPA
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/75">
              Upload your tax documents, generate your 1040, and talk it through with a voice CPA —
              grounded in your real numbers.
            </p>
            <Button
              size="lg"
              onClick={() => router.push('/upload')}
              className="mt-8 w-56 rounded-full font-mono text-xs font-bold tracking-wider uppercase"
            >
              Enter
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
