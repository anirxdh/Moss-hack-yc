'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shadcn/utils';

export function UploadView() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <main className="mx-auto grid min-h-svh w-full max-w-2xl content-start gap-6 px-6 py-16">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Upload your tax documents</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          W-2s, 1099s, 1098s, K-1s, receipts — anything related to your US tax filing. Add as many
          as you like.
        </p>
      </header>

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors',
          dragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-muted-foreground/60'
        )}
      >
        <p className="text-sm font-medium">Drag &amp; drop files here</p>
        <p className="text-muted-foreground mt-1 text-xs">or click to browse</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.heic,.tiff"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* Selected files */}
      {files.length > 0 && (
        <ul className="grid gap-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="text-muted-foreground hover:text-foreground ml-3 shrink-0 text-xs"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Generate 1040 */}
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">
          {files.length} file{files.length === 1 ? '' : 's'} selected
        </span>
        <Button
          size="lg"
          onClick={() => router.push('/return')}
          className="rounded-full font-mono text-xs font-bold tracking-wider uppercase"
        >
          Generate 1040
        </Button>
      </div>
    </main>
  );
}
