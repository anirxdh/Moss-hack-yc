import { Coins, Percent, TrendingUp, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';

export interface SummaryStat {
  label: string;
  value: string;
  icon: LucideIcon;
  positive?: boolean;
}

// Placeholder figures — swap for parsed 1040 values once the parse is wired in.
const DEFAULT_STATS: SummaryStat[] = [
  { label: 'Estimated refund', value: '$3,420', icon: Wallet, positive: true },
  { label: 'Adjusted gross income', value: '$86,500', icon: TrendingUp },
  { label: 'Total income', value: '$92,100', icon: Coins },
  { label: 'Effective tax rate', value: '14.2%', icon: Percent },
];

/** "Numbers at a glance" — compact stat cards that ground the conversation. */
export function ReturnSummary({ stats = DEFAULT_STATS }: { stats?: SummaryStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className={cn(
            'rounded-xl border p-4 transition-colors',
            s.positive ? 'border-accent-warm/40 bg-accent-warm/[0.07]' : 'border-border bg-card/50'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="eyebrow !text-[9px]">{s.label}</span>
            <s.icon
              className={cn('size-3.5', s.positive ? 'text-accent-warm' : 'text-muted-foreground')}
              strokeWidth={2}
              aria-hidden="true"
            />
          </div>
          <p
            className={cn(
              'font-display mt-2 text-2xl leading-none',
              s.positive ? 'text-accent-warm' : 'text-foreground'
            )}
          >
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}
