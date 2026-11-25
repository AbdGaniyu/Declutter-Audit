'use client';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import { iconProps } from '@/components/icons';

/** Bottom sheet (DESIGN.md › Shape: 28px). Centred card on wider screens. */
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
    <div className="fade-in fixed inset-0 z-40 flex items-end justify-center bg-[rgba(0,0,0,0.4)] md:items-center" role="dialog" aria-modal="true" aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`squircle w-full max-w-lot rounded-t-dock bg-surface p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-float md:rounded-dock ${className}`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-title-sm">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-pill bg-fill text-label pressable">
            <X {...iconProps} size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
