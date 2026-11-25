'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { iconProps } from '@/components/icons';
import { photoUrl } from '@/lib/photos';

/**
 * DESIGN.md › Lot page gallery: swipe (native momentum + snap), glass arrows and
 * a "1 / 3" counter, thumbnails underneath. Full-bleed on mobile. Only the first
 * photo loads eagerly.
 */
export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const go = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.max(0, Math.min(photos.length - 1, i));
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: next * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  };

  if (photos.length === 0) {
    return (
      <div className="-mx-4 flex aspect-[4/3] items-center justify-center bg-fill text-footnote text-secondary md:mx-0 md:rounded-card">
        No photo
      </div>
    );
  }
  const many = photos.length > 1;
  return (
    <div>
      <div className="relative -mx-4 md:mx-0">
        <div ref={scroller} aria-roledescription="carousel" aria-label={`${title} photos`}
          className="squircle flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto bg-fill [scrollbar-width:none] md:rounded-card"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}>
          {photos.map((p, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={photoUrl(p)!} alt={`${title}, photo ${i + 1} of ${photos.length}`} loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async" className="h-full w-full flex-none snap-center object-cover" />
          ))}
        </div>
        {many && (
          <>
            <button type="button" aria-label="Previous photo" onClick={() => go(index - 1)} disabled={index === 0}
              className="glass-chip pressable absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-pill disabled:opacity-0">
              <ChevronLeft {...iconProps} size={20} />
            </button>
            <button type="button" aria-label="Next photo" onClick={() => go(index + 1)} disabled={index === photos.length - 1}
              className="glass-chip pressable absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-pill disabled:opacity-0">
              <ChevronRight {...iconProps} size={20} />
            </button>
            <span className="glass-chip tnum absolute bottom-3 left-3 rounded-pill px-3 py-1 text-footnote font-semibold" aria-live="polite">
              {index + 1} / {photos.length}
            </span>
          </>
        )}
      </div>
      {many && (
        <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
          {photos.map((p, i) => (
            <button key={p} type="button" onClick={() => go(i)} aria-label={`Photo ${i + 1}`} aria-current={i === index}
              className={`squircle h-14 w-20 shrink-0 overflow-hidden rounded-thumb bg-fill p-0.5 transition-shadow duration-300
                ${i === index ? 'shadow-[0_0_0_2px_var(--label)]' : 'opacity-70'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(p)!} alt="" loading="lazy" decoding="async" className="h-full w-full rounded-[12px] object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
