'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Fixed back-nav pill, shown top-left just right of the header logo. Navigates
 * to an explicit `href` when given, otherwise falls back to browser history.
 */
export function BackButton({ href, label = 'Back' }: { href?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (href ? router.push(href) : router.back())}
      aria-label={label}
      className="glass text-muted-foreground hover:text-foreground fixed top-5 left-6 z-50 flex items-center gap-1.5 rounded-full py-2 pr-4 pl-3 text-xs font-medium transition-colors hover:-translate-x-0.5 md:left-16"
    >
      <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  );
}
