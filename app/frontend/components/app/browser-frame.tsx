import { Lock } from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';

/**
 * Fake macOS Safari window chrome — wraps a child so a screenshot/video reads
 * as a "real product window." Pure CSS. (Ported from the living-photos reference,
 * retargeted to our theme tokens.)
 */
export function BrowserFrame({
  children,
  url = 'app.moss.cpa',
  className,
}: {
  children: React.ReactNode;
  url?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-card border-border overflow-hidden rounded-2xl border shadow-[0_40px_120px_-30px_rgba(20,17,13,0.25)]',
        className
      )}
    >
      <div className="bg-muted border-border flex items-center gap-2 border-b px-4 py-3">
        <span className="size-3 rounded-full bg-[#FF5F57]" />
        <span className="size-3 rounded-full bg-[#FEBC2E]" />
        <span className="size-3 rounded-full bg-[#28C840]" />
        <div className="bg-background text-muted-foreground ml-4 flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs">
          <Lock className="size-3 shrink-0 opacity-50" strokeWidth={2.5} aria-hidden="true" />
          <span className="font-mono tracking-tight">{url}</span>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
