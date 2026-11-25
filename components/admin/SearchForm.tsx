import { Search } from 'lucide-react';
import { iconProps } from '@/components/icons';

/** GET search form for admin lists: keeps other query params as hidden fields. */
export function SearchForm({ action, q, placeholder, keep = {} }: {
  action: string; q: string; placeholder: string; keep?: Record<string, string>;
}) {
  return (
    <form action={action} role="search" className="squircle flex min-h-12 items-center gap-2 rounded-control bg-surface pl-4 pr-1">
      <Search {...iconProps} size={18} className="shrink-0 text-secondary" />
      {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder}
        className="h-11 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-secondary" />
      <button type="submit" className="pressable min-h-11 rounded-pill bg-label px-4 text-subhead font-semibold text-on-label">Search</button>
    </form>
  );
}

export function Pager({ base, offset, limit, total }: { base: string; offset: number; limit: number; total: number }) {
  const sep = base.includes('?') ? '&' : '?';
  return (
    <div className="flex items-center justify-between text-subhead">
      <span className="tnum text-secondary">{total === 0 ? 'No results' : `${offset + 1}–${Math.min(offset + limit, total)} of ${total}`}</span>
      <span className="flex gap-2">
        {offset > 0 && <a href={`${base}${sep}offset=${Math.max(0, offset - limit)}`} className="pressable inline-flex min-h-11 items-center rounded-pill bg-surface px-4 font-semibold">Previous</a>}
        {offset + limit < total && <a href={`${base}${sep}offset=${offset + limit}`} className="pressable inline-flex min-h-11 items-center rounded-pill bg-surface px-4 font-semibold">Next</a>}
      </span>
    </div>
  );
}
