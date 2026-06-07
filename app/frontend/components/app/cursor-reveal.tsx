'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Cursor reveal — two stacked layers. The `base` layer is always visible; the
 * `reveal` layer is clipped to a soft circular mask that follows the cursor, so
 * a second image "bleeds through" in a halo around the pointer. Pure CSS mask.
 * (Ported from the living-photos reference.)
 */
export function CursorReveal({
  base,
  reveal,
  radius = 260,
  className,
  ringColor = 'rgba(20,17,13,0.25)',
}: {
  base: React.ReactNode;
  reveal: React.ReactNode;
  radius?: number;
  className?: string;
  ringColor?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!window.matchMedia('(pointer: fine)').matches) return;

    function move(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pad = radius * 0.4;
      if (
        e.clientX < rect.left - pad ||
        e.clientX > rect.right + pad ||
        e.clientY < rect.top - pad ||
        e.clientY > rect.bottom + pad
      ) {
        setPos(null);
        return;
      }
      setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    function leave() {
      setPos(null);
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseleave', leave);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseleave', leave);
    };
  }, [radius]);

  const maskImage = pos
    ? `radial-gradient(circle ${radius}px at ${pos.x}px ${pos.y}px, black 0%, rgba(0,0,0,0.9) 45%, transparent 100%)`
    : 'radial-gradient(circle 0px at 50% 50%, black, transparent)';

  return (
    <div ref={ref} className={className} style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0 }}>{base}</div>

      {!reduced && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            maskImage,
            WebkitMaskImage: maskImage,
            transition: pos ? 'none' : 'opacity 0.4s ease',
            opacity: pos ? 1 : 0,
          }}
        >
          {reveal}
        </div>
      )}

      {!reduced && pos && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: pos.x - radius,
            top: pos.y - radius,
            width: radius * 2,
            height: radius * 2,
            borderRadius: '50%',
            pointerEvents: 'none',
            boxShadow: `inset 0 0 0 1px ${ringColor}`,
            mixBlendMode: 'multiply',
            opacity: 0.5,
          }}
        />
      )}
    </div>
  );
}
