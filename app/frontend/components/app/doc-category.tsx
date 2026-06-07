'use client';

import { useState } from 'react';
import { cn } from '@/lib/shadcn/utils';
import { DocSlot } from './doc-slot';
import type { DocCategory } from './tax-documents';

interface DocCategorySectionProps {
  category: DocCategory;
  files: Record<string, File>;
  onPick: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  style?: React.CSSProperties;
}

export function DocCategorySection({
  category,
  files,
  onPick,
  onRemove,
  style,
}: DocCategorySectionProps) {
  const [open, setOpen] = useState(false);
  const count = category.docs.filter((d) => files[d.id]).length;

  return (
    <div
      style={style}
      className="fade-up border-foreground/10 bg-card/30 overflow-hidden rounded-xl border"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="hover:bg-card/60 flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors"
      >
        <span className="text-lg leading-none">{category.icon}</span>
        <span className="flex-1">
          <span className="block text-sm font-semibold">{category.name}</span>
          <span className="text-muted-foreground block text-xs">{category.blurb}</span>
        </span>
        {count > 0 && (
          <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 font-mono text-[10px] font-bold">
            {count}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform duration-300 ease-out',
            open && 'rotate-180'
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* grid-rows 0fr -> 1fr is a smooth, measure-free accordion */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="grid gap-2.5 px-4 pb-4 sm:grid-cols-2">
            {category.docs.map((d) => (
              <DocSlot
                key={d.id}
                doc={d}
                file={files[d.id]}
                onPick={(f) => onPick(d.id, f)}
                onRemove={() => onRemove(d.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
