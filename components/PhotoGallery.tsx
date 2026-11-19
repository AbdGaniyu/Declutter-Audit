'use client';
import { useState } from 'react';
import { photoUrl } from '@/lib/photos';

export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  if (photos.length === 0) {
    return <div className="flex aspect-square items-center justify-center rounded-card bg-surface text-muted">No photo</div>;
  }
  return (
    <div>
      <div className="flex aspect-square snap-x snap-mandatory overflow-x-auto rounded-card bg-surface"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}>
        {photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p} src={photoUrl(p)!} alt={`${title}, photo ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'}
            decoding="async" className="h-full w-full flex-none snap-center object-contain" />
        ))}
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {photos.map((p, i) => (
            <span key={p} className={`h-1.5 w-1.5 rounded-pill ${i === index ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
      )}
    </div>
  );
}
