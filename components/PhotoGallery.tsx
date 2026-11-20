'use client';
import { useRef, useState } from 'react';
import { photoUrl } from '@/lib/photos';

/** Swipeable 4:3 carousel with dots. Only the first photo loads eagerly. */
export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  if (photos.length === 0) {
    return <div className="flex aspect-[4/3] items-center justify-center rounded-card bg-surface text-ink-muted">No photo</div>;
  }
  return (
    <div className="relative">
      <div ref={scroller} className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto rounded-card bg-surface [scrollbar-width:none]"
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
      {photos.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 flex justify-center">
          {photos.map((p, i) => (
            <button key={p} type="button" aria-label={`Photo ${i + 1}`} aria-current={i === index}
              onClick={() => scroller.current?.scrollTo({ left: i * scroller.current.clientWidth, behavior: 'smooth' })}
              className="flex h-11 w-11 items-center justify-center">
              <span className={`h-2 w-2 rounded-pill border border-surface ${i === index ? 'bg-ink' : 'bg-surface'}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
