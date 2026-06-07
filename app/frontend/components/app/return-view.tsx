'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { Button } from '@/components/ui/button';

interface ReturnViewProps {
  appConfig: AppConfig;
}

interface GeneratedReturn {
  summary: {
    taxYear: number;
    documentsRead: number;
    refundOrOwe: { type: 'refund' | 'owe' | 'even'; amount: number };
  };
  pdfUrl: string;
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
  const [generated, setGenerated] = useState<GeneratedReturn | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('generated1040');
    if (!raw) return;
    let url: string | null = null;
    try {
      const { summary, pdfBase64, warnings } = JSON.parse(raw);
      const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      setGenerated({ summary, pdfUrl: url, warnings: warnings ?? [] });
    } catch {
      /* ignore malformed payload */
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  const pdfSrc = generated?.pdfUrl ?? '/tax-return.pdf';

  // Once the call is live, keep the tax document beside the live AI CPA
  // (voice + Olivia avatar) instead of taking over the full screen.
  if (isConnected) {
    return (
      <main className="grid h-svh grid-cols-1 lg:grid-cols-2">
        {/* Your tax document — stays visible next to the CPA while you talk */}
        <section className="bg-muted relative hidden overflow-hidden border-r lg:block">
          <iframe
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

        {/* Generated 1040 (or, before generation, the locally-served uploaded PDF). */}
        <div className="bg-muted mt-4 overflow-hidden rounded-xl border p-2">
          <iframe
            src={pdfSrc}
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
