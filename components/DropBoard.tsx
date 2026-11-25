'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LiveDot } from '@/components/Badge';
import { FilterPills } from '@/components/FilterPills';
import { LotCard, type LotSummary } from '@/components/LotCard';
import { RemindMe } from '@/components/RemindMe';
import { dropLine, isEndingSoon, shortTitle } from '@/lib/drop';
import { LAGOS_TZ, formatClock, formatDuration, formatLagosTime } from '@/lib/time';
import { useServerNow } from '@/lib/time-sync';

export type DropInfo = {
  id: string;
  number: number;
  title: string;
  opens_at: string;
  last_close_at: string;
  close_interval_seconds: number;
  lot_count: number;
  areas: string[];
  total_bids: number;
  reminded: boolean;
};

const ALL = 'all';
const ENDING = 'ending';

function dayParts(iso: string) {
  const d = new Date(iso);
  return {
    weekday: new Intl.DateTimeFormat('en-NG', { weekday: 'short', timeZone: LAGOS_TZ }).format(d).toUpperCase(),
    day: new Intl.DateTimeFormat('en-NG', { day: 'numeric', timeZone: LAGOS_TZ }).format(d),
  };
}

/** DESIGN.md › Key screens › Drop page ("Tonight"). PDF p.1 and p.3. */
export function DropBoard({ hero, lots, upcoming, renderedAt, signedIn }: {
  hero: DropInfo | null;
  lots: LotSummary[];
  upcoming: DropInfo[];
  renderedAt: number;
  signedIn: boolean;
}) {
  const now = useServerNow(500, renderedAt);
  const router = useRouter();
  const [filter, setFilter] = useState(ALL);

  // The grid polls lightly; the lot page is the realtime view.
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && router.refresh();
    const id = setInterval(refresh, 20_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [router]);

  // Categories with lots in this drop, most lots first.
  const options = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lots) if (l.category) counts.set(l.category, (counts.get(l.category) ?? 0) + 1);
    const cats = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => ({ key: `c:${c}`, label: c }));
    return [{ key: ALL, label: 'All' }, ...cats, { key: ENDING, label: 'Ending soon' }];
  }, [lots]);

  if (!hero) {
    return (
      <section className="py-16 text-center">
        <h1 className="text-large-title-sm md:text-large-title">No drop tonight</h1>
        <p className="mt-2 text-body text-secondary">Drops run most evenings at 7pm. Check back soon.</p>
      </section>
    );
  }

  const opens = Date.parse(hero.opens_at);
  const lastClose = Date.parse(hero.last_close_at);
  const phase = now < opens ? 'upcoming' : now < lastClose ? 'live' : 'ended';
  const next = lots.find((l) => !l.closed_at && Date.parse(l.starts_at) <= now && Date.parse(l.ends_at) > now);
  const shown = lots.filter((l) =>
    filter === ALL ? true : filter === ENDING ? isEndingSoon(l, now) : l.category === filter.slice(2));

  const eyebrow = phase === 'live' ? 'Live now' : phase === 'upcoming' ? `Opens ${formatLagosTime(hero.opens_at)}` : 'Ended';

  return (
    <div className="space-y-8 md:space-y-10">
      <section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-eyebrow uppercase text-label">
            {phase === 'live' && <LiveDot />}
            {eyebrow} · Drop No. <span className="tnum">{hero.number}</span>
          </p>
          <h1 className="mt-2 text-large-title-sm md:text-large-title">{hero.title}</h1>
          <p className="mt-3 text-body text-secondary">{dropLine(hero)}</p>
          {phase === 'upcoming' && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-headline">Opens in <span className="tnum">{formatDuration(opens - now)}</span></p>
              <RemindMe dropId={hero.id} reminded={hero.reminded} signedIn={signedIn} />
            </div>
          )}
        </div>
        {next && (
          <div className="md:text-right">
            <p className="text-footnote font-semibold text-secondary">Next to close · {shortTitle(next.title)}</p>
            <p className={`tnum text-timer-hero ${Date.parse(next.ends_at) - now <= 60_000 ? 'text-accent-text' : 'text-label'}`}>
              {formatClock(Date.parse(next.ends_at) - now)}
            </p>
          </div>
        )}
      </section>

      {lots.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <FilterPills label="Filter lots" options={options} value={filter} onChange={setFilter} />
            <p className="hidden shrink-0 text-subhead text-secondary md:block">
              <span className="tnum">{hero.total_bids}</span> bid{hero.total_bids === 1 ? '' : 's'}
            </p>
          </div>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-body text-secondary">
              {filter === ENDING ? 'Nothing closes in the next 10 minutes.' : 'No lots in this category tonight.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-8 lg:grid-cols-4">
              {shown.map((lot) => <LotCard key={lot.id} lot={lot} now={now} />)}
            </div>
          )}
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-title-sm md:text-title">Up next</h2>
          <ul className="squircle mt-4 overflow-hidden rounded-group bg-surface">
            {upcoming.map((d) => {
              const { weekday, day } = dayParts(d.opens_at);
              return (
                <li key={d.id} className="flex items-center gap-4 px-4 py-3 [&:not(:last-child)]:hairline-b">
                  <div className="w-10 shrink-0 text-center" aria-hidden>
                    <p className="text-[11px] font-semibold leading-[13px] text-secondary">{weekday}</p>
                    <p className="tnum text-[22px] font-semibold leading-[26px]">{day}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-headline">{d.title}</p>
                    <p className="text-subhead text-secondary">
                      <span className="tnum">{d.lot_count}</span> lot{d.lot_count === 1 ? '' : 's'} · Opens {formatLagosTime(d.opens_at)}
                      <span className="sr-only"> on {weekday} {day}</span>
                    </p>
                  </div>
                  <RemindMe dropId={d.id} reminded={d.reminded} signedIn={signedIn} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
