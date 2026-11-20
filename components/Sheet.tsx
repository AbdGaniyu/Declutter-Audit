'use client';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { iconProps } from '@/components/icons';

/** Bottom sheet: 16px top corners, the single elevation shadow. */
export function Sheet({ open, onClose, title, children, className = '' }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(20,17,15,0.4)]" role="dialog" aria-modal="true" aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full max-w-lot rounded-t-sheet bg-surface p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-elev ${className}`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-heading">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-pill text-ink-muted">
            <X {...iconProps} size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
