'use client';

import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { Button } from '@/components/ui/button';

const FORM_1040_ROWS = [
  'Total income',
  'Adjusted gross income',
  'Taxable income',
  'Total tax',
  'Federal tax withheld',
  'Refund',
];

interface ReturnViewProps {
  appConfig: AppConfig;
}

export function ReturnView({ appConfig }: ReturnViewProps) {
  const router = useRouter();
  const { isConnected, start } = useSessionContext();
  const { resolvedTheme } = useTheme();

  // Once the call is live, hand over to the existing full-screen agent session UI.
  if (isConnected) {
    return (
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
        className="fixed inset-0"
      />
    );
  }

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-5xl gap-6 px-6 py-12 lg:grid-cols-[1fr_280px]">
      {/* 1040 preview */}
      <section className="order-2 lg:order-1">
        <h1 className="text-2xl font-bold tracking-tight">Your 2025 Form 1040</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Generated from your uploaded documents.
        </p>

        {/* Placeholder document — the real parsed 1040 PDF will render here */}
        <div className="bg-muted mt-4 rounded-xl border p-4">
          <div className="mx-auto aspect-[8.5/11] w-full max-w-xl rounded-md bg-white p-8 text-black shadow-sm">
            <div className="border-b border-black/20 pb-2 text-center">
              <p className="text-xs tracking-widest uppercase">Form</p>
              <p className="text-3xl font-bold">1040</p>
              <p className="text-xs">U.S. Individual Income Tax Return — 2025</p>
            </div>
            <dl className="mt-6 space-y-3 text-sm">
              {FORM_1040_ROWS.map((label) => (
                <div
                  key={label}
                  className="flex justify-between border-b border-dashed border-black/20 pb-1"
                >
                  <dt>{label}</dt>
                  <dd className="text-gray-400">— pending —</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 text-center text-[10px] text-gray-400">
              Placeholder preview. The parsed 1040 from your uploaded documents will render here.
            </p>
          </div>
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
