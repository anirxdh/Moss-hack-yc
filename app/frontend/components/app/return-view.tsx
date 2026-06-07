'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import type { Form1040Summary } from '@/app/api/generate-1040/_lib/schema';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { Button } from '@/components/ui/button';
import { useMossContextEvents } from '@/hooks/useMossContextEvents';

interface ReturnViewProps {
  appConfig: AppConfig;
}

interface GeneratedReturn {
  summary: Form1040Summary;
  pdfUrl: string;
  // Redacted copy of the uploaded source doc (SSN/account/EIN greyed out) — what
  // we show beside the live CPA so the demo never displays raw PII. null if the
  // endpoint couldn't build one (then we fall back to the placeholder).
  redactedDocUrl: string | null;
  warnings: string[];
}

function headline(r: GeneratedReturn['summary']['refundOrOwe']): string {
  if (r.type === 'refund') return `Estimated refund: $${r.amount.toLocaleString('en-US')}`;
  if (r.type === 'owe') return `Estimated amount owed: $${r.amount.toLocaleString('en-US')}`;
  return 'Estimated balance: $0';
}

export function ReturnView({ appConfig }: ReturnViewProps) {
  const router = useRouter();
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();

  // Generated 1040 from the upload -> /api/generate-1040 flow, surfaced in the
  // /return preview below.
  const [generated, setGenerated] = useState<GeneratedReturn | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('generated1040');
    if (!raw) return;
    const urls: string[] = [];
    const toBlobUrl = (b64: string | null | undefined): string | null => {
      if (!b64) return null;
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const u = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      urls.push(u);
      return u;
    };
    try {
      const { summary, pdfBase64, redactedDocBase64, warnings } = JSON.parse(raw);
      const pdfUrl = toBlobUrl(pdfBase64);
      const redactedDocUrl = toBlobUrl(redactedDocBase64);
      if (pdfUrl) {
        setGenerated({ summary, pdfUrl, redactedDocUrl, warnings: warnings ?? [] });
      }
    } catch {
      /* ignore malformed payload */
    }
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, []);

  // Preview document: the generated 1040 if present, else the placeholder.
  const previewSrc = generated?.pdfUrl ?? '/tax-return.pdf';

  // Follow the agent: when it cites a chunk from the tax doc, jump the PDF to
  // that chunk's page. Moss stores the page per chunk and the agent publishes it
  // in the moss_context event, so the on-screen doc tracks what the CPA says.
  const mossEvents = useMossContextEvents();
  const citedPage = useMemo(() => {
    for (let i = mossEvents.length - 1; i >= 0; i--) {
      const md = mossEvents[i].matches?.[0]?.metadata as { page?: string | number } | undefined;
      const page = md?.page;
      if (page != null && /^\d+$/.test(String(page))) return String(page);
    }
    return null;
  }, [mossEvents]);
  // Show the redacted upload (PII greyed out) beside the live CPA; fall back to
  // the placeholder. Citation page-jumps still work on the blob URL.
  const docBase = generated?.redactedDocUrl ?? '/tax-return.pdf';
  const pdfSrc = citedPage ? `${docBase}#page=${citedPage}` : docBase;

  // Once the call is live, keep the tax document beside the live AI CPA
  // (voice + Olivia avatar) instead of taking over the full screen.
  if (isConnected) {
    return (
      <main className="grid h-svh grid-cols-2">
        {/* Your tax document — beside the CPA, auto-scrolls to the cited page */}
        <section className="bg-muted relative overflow-hidden border-r">
          {citedPage && (
            <div className="absolute top-3 left-3 z-10 rounded-full bg-black/75 px-3 py-1 text-xs font-medium text-white shadow">
              📄 Source · page {citedPage}
            </div>
          )}
          <iframe
            key={pdfSrc}
            src={pdfSrc}
            title="Your tax return"
            className="absolute inset-0 h-full w-full bg-white"
          />
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
        {generated ? (
          <div className="mt-1">
            <p className="text-sm font-medium">{headline(generated.summary.refundOrOwe)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Draft estimate (tax year {generated.summary.taxYear}) computed from{' '}
              {generated.summary.documentsRead} document
              {generated.summary.documentsRead === 1 ? '' : 's'}.
            </p>
            {generated.warnings.length > 0 && (
              <ul className="text-muted-foreground mt-2 list-disc pl-4 text-xs">
                {generated.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground mt-1 text-sm">
            Showing the document you uploaded. Your generated 1040 will replace this soon.
          </p>
        )}

        {/* Generated 1040 (or, before generation, the locally-served placeholder). */}
        <div className="bg-muted mt-4 overflow-hidden rounded-xl border p-2">
          <iframe
            src={previewSrc}
            title="Your tax return"
            className="h-[80vh] w-full rounded-md bg-white"
          />
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
            Talk it through with your AI CPA — grounded in your documents.
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
