'use client';
import { Search, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LotCard, type LotSummary } from '@/components/LotCard';
import { iconProps } from '@/components/icons';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { useServerNow } from '@/lib/time-sync';

const DEBOUNCE_MS = 250;

type State = { status: 'idle' | 'loading' | 'done' | 'error'; q: string; lots: LotSummary[] };

/** DESIGN.md › Key screens › Search: lots in live and upcoming drops. */
export function SearchButton() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <>
      <button ref={button} type="button" aria-label="Search lots" aria-expanded={open} onClick={() => setOpen(true)}
        className="pressable inline-flex h-11 w-11 items-center justify-center rounded-pill text-label">
        <Search {...iconProps} size={20} />
      </button>
      {open && <SearchOverlay onClose={() => { setOpen(false); button.current?.focus(); }} />}
    </>
  );
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ status: 'idle', q: '', lots: [] });
  const input = useRef<HTMLInputElement>(null);
  const now = useServerNow(1000);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState({ status: 'idle', q: '', lots: [] });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading', q }));
    const id = setTimeout(async () => {
      const { data, error } = await getBrowserSupabase().rpc('search_lots', { p_query: q, p_limit: 24 });
      if (cancelled) return;
      if (error) setState({ status: 'error', q, lots: [] });
      else setState({ status: 'done', q, lots: (data ?? []) as LotSummary[] });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Search lots" className="fade-in fixed inset-0 z-40 overflow-y-auto bg-bg">
      <div className="sticky top-2 z-10 mx-auto w-full max-w-content px-2 md:top-4 md:px-6">
        <div className="glass-nav flex h-14 items-center gap-2 rounded-pill pl-4 pr-2">
          <Search {...iconProps} size={20} className="shrink-0 text-secondary" />
          <input ref={input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100}
            placeholder="Search tonight's lots" aria-label="Search tonight's lots"
            className="h-11 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-secondary" />
          <button type="button" onClick={onClose} aria-label="Close search"
            className="pressable inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-fill">
            <X {...iconProps} size={18} />
          </button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-content px-4 pb-16 pt-8 md:px-8" aria-live="polite">
        {state.status === 'idle' && <p className="text-center text-body text-secondary">Search by what it is: lamp, fan, iPhone.</p>}
        {state.status === 'loading' && state.lots.length === 0 && <p className="text-center text-body text-secondary">Searching…</p>}
        {state.status === 'error' && <p className="text-center text-body text-secondary">Search isn&apos;t working right now. Try again.</p>}
        {state.status === 'done' && state.lots.length === 0 && (
          <p className="text-center text-body text-secondary">Nothing matches &ldquo;{state.q}&rdquo; tonight.</p>
        )}
        {state.lots.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-8 lg:grid-cols-4">
            {state.lots.map((lot) => <LotCard key={lot.id} lot={lot} now={now} />)}
          </div>
        )}
      </div>
    </div>
  );
}
