'use client';

import { useRef, useState } from 'react';
import { Check, Paperclip, Upload, X } from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';
import type { TaxDoc } from './tax-documents';

interface DocSlotProps {
  doc: TaxDoc;
  file?: File;
  onPick: (file: File) => void;
  onRemove: () => void;
  style?: React.CSSProperties;
}

export function DocSlot({ doc, file, onPick, onRemove, style }: DocSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const filled = Boolean(file);

  return (
    <div
      style={style}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onPick(f);
      }}
      className={cn(
        'fade-up group bg-card/40 relative flex flex-col rounded-xl border p-4 transition-all duration-300 ease-out',
        'hover:border-primary/40 hover:bg-card/70 hover:shadow-primary/40 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-24px]',
        filled && 'border-primary/50 bg-primary/[0.06]',
        drag && 'border-primary bg-primary/10'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-primary/90 font-mono text-[11px] font-bold tracking-[0.12em] uppercase">
          {doc.code}
        </span>
        <span
          aria-hidden={!filled}
          className={cn(
            'bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full transition-transform duration-300 ease-out',
            filled ? 'scale-100' : 'scale-0'
          )}
        >
          <Check className="size-3" strokeWidth={3.5} aria-hidden="true" />
        </span>
      </div>

      <h3 className="mt-2 text-sm font-semibold">{doc.name}</h3>
      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{doc.desc}</p>

      <div className="mt-3">
        {filled ? (
          <div className="bg-background/70 border-border flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
            <Paperclip
              className="text-muted-foreground size-3.5 shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-xs">{file?.name}</span>
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${doc.code} file`}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 -mr-1 shrink-0 rounded-md p-1 transition-colors"
            >
              <X className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="border-border bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:bg-secondary hover:text-foreground flex w-full items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium transition-all duration-200"
          >
            <Upload
              className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5"
              strokeWidth={2}
              aria-hidden="true"
            />
            Add file
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.heic,.tiff"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
    </div>
  );
}
