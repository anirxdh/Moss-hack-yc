'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { Button } from '@/components/ui/button';
import { useMossContextEvents } from '@/hooks/useMossContextEvents';

interface ReturnViewProps {
  appConfig: AppConfig;
}

export function ReturnView({ appConfig }: ReturnViewProps) {
  const router = useRouter();
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();

  // The CPA-prepared 1040 lives in S3 (manually placed, ingested into Moss by the
  // local script). Fetch a short-lived presigned GET URL so the browser can load
  // it into the PDF viewer — the same document the voice agent grounds on.
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docError, setDocError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/return-doc')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => !cancelled && setDocUrl(typeof d?.url === 'string' ? d.url : null))
      .catch(() => !cancelled && setDocError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Follow the agent: when it cites a chunk from the 1040, jump the PDF to that
  // chunk's page. Moss stores the page per chunk and the agent publishes it in
  // the moss_context event, so the on-screen doc tracks what the CPA says.
  const mossEvents = useMossContextEvents();
  const citedPage = useMemo(() => {
    for (let i = mossEvents.length - 1; i >= 0; i--) {
      const md = mossEvents[i].matches?.[0]?.metadata as { page?: string | number } | undefined;
      const page = md?.page;
      if (page != null && /^\d+$/.test(String(page))) return String(page);
    }
    return null;
  }, [mossEvents]);

  // Presigned URLs already carry a query string; the #page fragment is read by
  // the browser PDF viewer and appends cleanly after it.
  const pdfSrc = docUrl ? `${docUrl}${citedPage ? `#page=${citedPage}` : ''}` : null;

  // Once the call is live, keep the 1040 beside the live AI CPA (voice + Olivia
  // avatar) instead of taking over the full screen.
  if (isConnected) {
    return (
      <main className="grid h-svh grid-cols-1 lg:grid-cols-2">
        {/* The 1040 — beside the CPA, auto-scrolls to the cited page */}
        <section className="bg-muted relative overflow-hidden border-r">
          {citedPage && (
            <div className="absolute top-3 left-3 z-10 rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white shadow">
              📄 Source · page {citedPage}
            </div>
          )}
          {pdfSrc ? (
            <iframe
              key={pdfSrc}
              src={pdfSrc}
              title="Your 2025 tax return"
              className="absolute inset-0 h-full w-full bg-white"
            />
          ) : (
            <div className="text-muted-foreground absolute inset-0 grid place-items-center p-6 text-center text-sm">
              {docError ? 'Could not load your tax document.' : 'Loading your tax document…'}
            </div>
          )}
        </section>
        {/* Live AI CPA: voice + Olivia avatar */}
        <AgentSessionView_01
          supportsChatInput={appConfig.supportsChatInput}
          supportsVideoInput={appConfig.supportsVideoInput}
          supportsScreenShare={appConfig.supportsScreenShare}
          isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
          audioVisualizerType={appConfig.audioVisualizerType}
          audioVisualizerColor={
            resolvedTheme === 'dark'
              ? appConfig.audioVisualizerColorDark
              : appConfig.audioVisualizerColor
          }
          audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
          audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
          audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
          audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
          audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
          audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
          audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
          className="relative h-full w-full"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-5xl gap-6 px-6 py-12 lg:grid-cols-[1fr_280px]">
      {/* 1040 preview */}
      <section className="order-2 lg:order-1">
        <h1 className="text-2xl font-bold tracking-tight">Your 2025 tax return</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your prepared Form 1040. Talk it through with your AI CPA on the right.
        </p>

        <div className="bg-muted mt-4 overflow-hidden rounded-xl border p-2">
          {pdfSrc ? (
            <iframe
              key={pdfSrc}
              src={pdfSrc}
              title="Your 2025 tax return"
              className="h-[80vh] w-full rounded-md bg-white"
            />
          ) : (
            <div className="text-muted-foreground grid h-[80vh] w-full place-items-center rounded-md text-center text-sm">
              {docError ? 'Could not load your tax document.' : 'Loading your tax document…'}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => router.push('/upload')}
          className="text-muted-foreground hover:text-foreground mt-4 text-xs underline underline-offset-4"
        >
          ← Back to upload
        </button>
      </section>

      {/* Side: talk to CPA */}
      <aside className="order-1 lg:order-2 lg:pt-20">
        <div className="bg-card sticky top-24 rounded-xl border p-5 text-center">
          <h2 className="text-sm font-bold tracking-tight">Questions about your return?</h2>
          <p className="text-muted-foreground mt-1 text-xs">
            Talk it through with your AI CPA — grounded in your documents and the tax code.
          </p>
          <Button
            size="lg"
            onClick={() => start()}
            className="mt-4 w-full rounded-full font-mono text-xs font-bold tracking-wider uppercase"
          >
            Talk to CPA agent
          </Button>
        </div>
      </aside>
    </main>
  );
}
