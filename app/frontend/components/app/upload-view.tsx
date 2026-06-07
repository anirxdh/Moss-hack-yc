'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DocCategorySection } from './doc-category';
import { DocSlot } from './doc-slot';
import { CORE_DOCS, OPTIONAL_CATEGORIES } from './tax-documents';

export function UploadView() {
  const router = useRouter();
  const [files, setFiles] = useState<Record<string, File>>({});
  const [busy, setBusy] = useState(false);

  const onGenerate = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      for (const [id, file] of Object.entries(files)) {
        fd.append('files', file);
        fd.append('docIds', id);
      }
      const res = await fetch('/api/generate-1040', { method: 'POST', body: fd });
      const data = await res.json();
      if (data?.bypassed || !data?.pdfBase64) {
        sessionStorage.removeItem('generated1040');
      } else {
        sessionStorage.setItem(
          'generated1040',
          JSON.stringify({
            summary: data.summary,
            pdfBase64: data.pdfBase64,
            warnings: data.warnings ?? [],
          })
        );
      }
    } catch {
      sessionStorage.removeItem('generated1040');
    } finally {
      router.push('/return');
    }
  };

  const onPick = (id: string, file: File) => setFiles((prev) => ({ ...prev, [id]: file }));
  const onRemove = (id: string) =>
    setFiles((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const coreDone = CORE_DOCS.filter((d) => files[d.id]).length;
  const totalFiles = Object.keys(files).length;
  const pct = Math.round((coreDone / CORE_DOCS.length) * 100);

  return (
    <main className="upload-atmosphere min-h-svh">
      <div className="mx-auto w-full max-w-4xl px-6 pt-20 pb-32">
        {/* Header */}
        <div className="fade-up">
          <p className="text-primary/80 font-mono text-[11px] font-bold tracking-[0.2em] uppercase">
            AI CPA — Step 1 of 2
          </p>
          <h1 className="font-display mt-3 text-4xl leading-[1.05] font-light tracking-tight sm:text-5xl">
            Bring in your documents
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-relaxed">
            Add what you have — we&apos;ll do the rest. Start with the common forms, then open a
            section below for anything else that applies to you.
          </p>
        </div>

        {/* Progress */}
        <div className="fade-up mt-8 flex items-center gap-4" style={{ animationDelay: '70ms' }}>
          <div className="bg-foreground/10 h-1.5 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
            {coreDone} / {CORE_DOCS.length} common
          </span>
        </div>

        {/* Common documents */}
        <section className="mt-12">
          <h2 className="text-muted-foreground font-mono text-xs font-bold tracking-[0.16em] uppercase">
            Common documents
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_DOCS.map((d, i) => (
              <DocSlot
                key={d.id}
                doc={d}
                file={files[d.id]}
                onPick={(f) => onPick(d.id, f)}
                onRemove={() => onRemove(d.id)}
                style={{ animationDelay: `${120 + i * 55}ms` }}
              />
            ))}
          </div>
        </section>

        {/* Optional categories */}
        <section className="mt-14">
          <h2 className="text-muted-foreground font-mono text-xs font-bold tracking-[0.16em] uppercase">
            Anything else?{' '}
            <span className="text-foreground/40 normal-case">— optional, tap to open</span>
          </h2>
          <div className="mt-4 flex flex-col gap-2.5">
            {OPTIONAL_CATEGORIES.map((c, i) => (
              <DocCategorySection
                key={c.id}
                category={c}
                files={files}
                onPick={onPick}
                onRemove={onRemove}
                style={{ animationDelay: `${440 + i * 55}ms` }}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Sticky action bar */}
      <div className="border-foreground/10 bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <span className="text-muted-foreground text-xs">
            {totalFiles === 0
              ? 'No documents yet — you can still continue'
              : `${totalFiles} document${totalFiles === 1 ? '' : 's'} added`}
          </span>
          <Button
            size="lg"
            onClick={onGenerate}
            disabled={busy}
            className="rounded-full font-mono text-xs font-bold tracking-wider uppercase"
          >
            {busy ? 'Generating…' : 'Generate 1040'}
          </Button>
        </div>
      </div>
    </main>
  );
}
