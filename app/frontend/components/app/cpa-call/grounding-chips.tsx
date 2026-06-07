import { ShieldCheck } from 'lucide-react';

const DEFAULT_DOCS = ['W-2', '1099-INT', '1099-DIV', '1098-T'];

/** Shows which uploaded documents are grounding the CPA's answers. */
export function GroundingChips({ docs = DEFAULT_DOCS }: { docs?: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
        <ShieldCheck className="text-accent-warm size-3.5" strokeWidth={2} aria-hidden="true" />
        Grounded in
      </span>
      {docs.map((d) => (
        <span
          key={d}
          className="border-border bg-card/60 text-foreground rounded-md border px-2 py-1 font-mono text-[11px]"
        >
          {d}
        </span>
      ))}
    </div>
  );
}
