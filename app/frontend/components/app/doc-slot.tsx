'use client';

import { useRef, useState } from 'react';
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
          <svg
            viewBox="0 0 24 24"
            className="size-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
          >
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <h3 className="mt-2 text-sm font-semibold">{doc.name}</h3>
      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{doc.desc}</p>

      <div className="mt-3">
        {filled ? (
          <div className="bg-background/60 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5">
            <span className="truncate text-xs">{file?.name}</span>
            <button
              type="button"
              onClick={onRemove}
              className="text-muted-foreground hover:text-destructive shrink-0 text-[10px] font-medium tracking-wide uppercase transition-colors"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="border-foreground/20 text-muted-foreground hover:border-primary/50 hover:text-foreground flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-1.5 text-xs transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M12 16V4m0 0L8 8m4-4l4 4M5 20h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
