'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface LandingViewProps {
  companyName?: string;
}

export function LandingView({ companyName = 'AI CPA' }: LandingViewProps) {
  const router = useRouter();

  return (
    <main className="grid h-svh place-content-center px-6 text-center">
      <p className="text-muted-foreground font-mono text-xs font-bold tracking-wider uppercase">
        {companyName}
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Your AI CPA</h1>
      <p className="text-muted-foreground mx-auto mt-4 max-w-md text-sm">
        Upload your tax documents, generate your 1040, and talk it through with a voice CPA.
      </p>
      <div className="mt-8 flex justify-center">
        <Button
          size="lg"
          onClick={() => router.push('/upload')}
          className="w-64 rounded-full font-mono text-xs font-bold tracking-wider uppercase"
        >
          Enter
        </Button>
      </div>
    </main>
  );
}
