import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Badge, LiveDot } from '@/components/Badge';
import { NewDrop, RpcButton } from '@/components/admin/AdminActions';
import { iconProps } from '@/components/icons';
import { Price } from '@/components/Price';
import { Segmented } from '@/components/Segmented';
import { getServerSupabase } from '@/lib/supabase/server';
import { LAGOS_TZ, formatLagosTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

type Day = { day: string; drop_id: string | null; number: number | null; title: string | null; opens_at: string | null;
  last_close_at: string | null; state: string; lots: number; unsold: number };
type DropLot = { id: string; title: string; area: string; seller_name: string | null; start_price: number; current_bid: number | null;
  bid_count: number; ends_at: string; closed_at: string | null; outcome: string | null };
type Dispute = { id: string; amount: number; dispute_reason: string; created_at: string; title: string };
type Strike = { user_id: string; display_name: string | null; phone: string | null; strikes: number; lot_title: string | null; struck_at: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Monday of the Lagos week containing `d`, as YYYY-MM-DD. */
function mondayOf(d: Date): string {
  const local = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: LAGOS_TZ }).format(d) + 'T00:00:00Z');
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return iso(local);
}

function shiftWeek(week: string, days: number): string {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

const weekday = (day: string) => new Intl.DateTimeFormat('en-NG', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`)).toUpperCase();
const dayNum = (day: string) => Number(day.slice(8, 10));
const weekLabel = (week: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${week}T00:00:00Z`)).toUpperCase();

function ago(isoTime: string): string {
  const h = Math.round((Date.now() - Date.parse(isoTime)) / 3_600_000);
  return h < 1 ? 'Just now' : h < 24 ? `${h}h ago` : h < 48 ? 'Yesterday' : `${Math.round(h / 24)} days ago`;
}

/** DESIGN.md › Key screens › Admin › Drops (PDF p.15, drawn in v2). */
export default async function AdminDropsPage({ searchParams }: { searchParams: Promise<{ week?: string; drop?: string; show?: string }> }) {
  const sp = await searchParams;
  const week = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? mondayOf(new Date(`${sp.week}T12:00:00Z`)) : mondayOf(new Date());
  const supabase = await getServerSupabase();
  const [{ data: daysData }, { data: overview }, { data: strikesData }] = await Promise.all([
    supabase.rpc('admin_drops_week', { p_week_start: week }),
    supabase.rpc('admin_overview'),
    supabase.rpc('admin_strikes_week'),
  ]);
  const days = (daysData ?? []) as Day[];
  const disputes = ((overview as { disputes?: Dispute[] } | null)?.disputes ?? []);
  const strikes = (strikesData ?? []) as Strike[];
  const dropDays = days.filter((d) => d.drop_id);
  const selected = dropDays.find((d) => d.drop_id === sp.drop)
    ?? dropDays.find((d) => d.state === 'live') ?? dropDays.find((d) => d.state === 'upcoming') ?? dropDays[0];

  let lots: DropLot[] = [];
  if (selected?.drop_id) {
    const { data } = await supabase.rpc('admin_drop_lots', { p_drop_id: selected.drop_id });
    lots = (data ?? []) as DropLot[];
  }
  const now = Date.now();
  const isClosed = (l: DropLot) => Boolean(l.closed_at || l.outcome) || Date.parse(l.ends_at) <= now;
  const show = sp.show === 'live' || sp.show === 'closed' ? sp.show : 'all';
  const shown = lots.map((l, i) => ({ ...l, no: i + 1 })).filter((l) => show === 'all' ? true : show === 'closed' ? isClosed(l) : !isClosed(l));
  const href = (q: Record<string, string | undefined>) =>
    `/admin?${new URLSearchParams(Object.entries({ week, drop: selected?.drop_id ?? undefined, ...q }).filter(([, v]) => v) as [string, string][])}`;

  // One cell per day; a day with two drops shows both.
  const byDay = new Map<string, Day[]>();
  for (const d of days) byDay.set(d.day, [...(byDay.get(d.day) ?? []), d]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-eyebrow uppercase text-secondary">Week of {weekLabel(week)}</p>
          <h1 className="text-title-sm md:text-title">Drops</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin?week=${shiftWeek(week, -7)}`} aria-label="Previous week" className="pressable flex h-11 w-11 items-center justify-center rounded-pill bg-surface">
            <ChevronLeft {...iconProps} size={20} />
          </Link>
          <Link href={`/admin?week=${shiftWeek(week, 7)}`} aria-label="Next week" className="pressable flex h-11 w-11 items-center justify-center rounded-pill bg-surface">
            <ChevronRight {...iconProps} size={20} />
          </Link>
          <NewDrop />
        </div>
      </div>

      <ol className="-mx-4 grid auto-cols-[minmax(120px,1fr)] grid-flow-col gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid-flow-row md:grid-cols-7 md:px-0">
        {[...byDay.entries()].map(([day, ds]) => (
          <li key={day} className="squircle flex min-h-28 flex-col gap-2 rounded-group bg-surface p-3">
            <p className="flex items-baseline justify-between"><span className="text-eyebrow text-secondary">{weekday(day)}</span><span className="tnum text-headline">{dayNum(day)}</span></p>
            {ds.slice(0, 2).map((d) => d.drop_id ? (
              <Link key={d.drop_id} href={href({ drop: d.drop_id, show: undefined })}
                aria-current={selected?.drop_id === d.drop_id ? 'true' : undefined}
                className={`squircle block rounded-control p-2 text-footnote transition-shadow
                  ${d.state === 'live' ? 'bg-label text-on-label' : 'bg-fill'} ${selected?.drop_id === d.drop_id ? 'shadow-[0_0_0_2px_var(--label)]' : ''}`}>
                <span className="flex items-center gap-1 text-eyebrow uppercase">{d.state === 'live' && <LiveDot />}{d.state}</span>
                <span className="mt-0.5 block font-semibold leading-4">{d.title}</span>
                <span className="tnum mt-0.5 block opacity-70">
                  {d.lots} lots{d.unsold ? ` · ${d.unsold} unsold` : ''}{d.opens_at ? ` · ${formatLagosTime(d.opens_at)}` : ''}
                </span>
              </Link>
            ) : <p key="none" className="text-footnote text-secondary">No drop</p>)}
            {ds.length > 2 && (
              <Link href={`/admin/lots`} className="text-footnote font-semibold text-secondary hover:text-label">+{ds.length - 2} more</Link>
            )}
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-3">
          {selected?.drop_id ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-title-sm">{selected.title}</h2>
                  <p className="text-subhead text-secondary">
                    Drop No. <span className="tnum">{selected.number}</span> · <span className="tnum">{selected.lots}</span> lots
                    {selected.opens_at ? ` · opens ${formatLagosTime(selected.opens_at)}` : ''}
                  </p>
                </div>
                <Segmented label="Show lots" value={show} className="w-full sm:w-auto" segments={[
                  { key: 'all', label: 'All', href: href({ show: undefined }) },
                  { key: 'live', label: 'Live', href: href({ show: 'live' }) },
                  { key: 'closed', label: 'Closed', href: href({ show: 'closed' }) },
                ]} />
              </div>
              <div className="squircle overflow-x-auto rounded-group bg-surface">
                <table className="w-full min-w-[640px] text-left text-subhead">
                  <thead className="text-eyebrow uppercase text-secondary">
                    <tr className="hairline-b">
                      <th className="px-4 py-3 font-semibold">Lot</th><th className="py-3 font-semibold">Item</th>
                      <th className="py-3 text-right font-semibold">Current</th><th className="py-3 text-right font-semibold">Bids</th>
                      <th className="py-3 text-right font-semibold">Closes</th><th className="px-4 py-3 text-right font-semibold"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-secondary">No lots here.</td></tr>}
                    {shown.map((l) => (
                      <tr key={l.id} className="[&:not(:last-child)]:hairline-b">
                        <td className="tnum px-4 py-3 text-secondary">{String(l.no).padStart(2, '0')}</td>
                        <td className="py-3"><a href={`/lot/${l.id}`} className="font-semibold hover:underline">{l.title}</a>
                          <span className="block text-footnote text-secondary">{l.seller_name ?? 'Seller'} · {l.area}</span></td>
                        <td className="py-3 text-right font-semibold">{l.current_bid ? <Price kobo={l.current_bid} /> : <span className="text-secondary">—</span>}</td>
                        <td className="tnum py-3 text-right">{l.bid_count}</td>
                        <td className="tnum py-3 text-right">{isClosed(l) ? <span className="text-secondary">Closed</span> : formatLagosTime(l.ends_at)}</td>
                        <td className="px-4 py-3 text-right">
                          {l.outcome ? <Badge kind={l.outcome === 'sold' ? 'sold' : 'ended'}>{l.outcome}</Badge>
                            : !isClosed(l) && <RpcButton rpc="admin_cancel_auction" args={{ p_auction_id: l.id }} variant="text" confirm={`Pull "${l.title}" now?`}>Pull</RpcButton>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selected.state === 'upcoming' && (
                <RpcButton rpc="admin_cancel_drop" args={{ p_drop_id: selected.drop_id }} variant="text" confirm="Cancel this drop and all its lots?">
                  Cancel this drop
                </RpcButton>
              )}
            </>
          ) : <p className="py-10 text-center text-subhead text-secondary">No drops this week. Create one with New drop.</p>}
        </section>

        <div className="space-y-4">
          <section className="squircle rounded-group bg-surface p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-headline">Disputes</h2>
              <span className="tnum text-footnote text-secondary">{disputes.length} open</span>
            </div>
            {disputes.length === 0 ? <p className="mt-2 text-subhead text-secondary">None open.</p> : (
              <ul className="mt-3 space-y-2">
                {disputes.slice(0, 3).map((d) => (
                  <li key={d.id} className="squircle rounded-control bg-fill p-3">
                    <p className="flex justify-between text-eyebrow uppercase text-secondary"><span>Reported</span><span className="normal-case tracking-normal">{ago(d.created_at)}</span></p>
                    <p className="mt-1 text-headline">{d.title}</p>
                    <p className="line-clamp-2 text-footnote text-secondary">{d.dispute_reason}</p>
                    <Link href="/admin/disputes" className="pressable mt-2 inline-flex min-h-11 items-center rounded-pill bg-label px-4 text-subhead font-semibold text-on-label">Review</Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="squircle rounded-group bg-surface p-4">
            <h2 className="text-headline">Strikes this week</h2>
            {strikes.length === 0 ? <p className="mt-2 text-subhead text-secondary">No strikes.</p> : (
              <ul className="mt-2">
                {strikes.slice(0, 6).map((s) => (
                  <li key={`${s.user_id}-${s.struck_at}`} className="flex items-center gap-3 py-2 [&:not(:last-child)]:hairline-b">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-fill text-footnote font-semibold">
                      {(s.display_name ?? '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-subhead font-semibold">{s.display_name ?? 'Unnamed'} <span className="tnum font-normal text-secondary">••{(s.phone ?? '').slice(-2)}</span></span>
                      <span className="block truncate text-footnote text-secondary">Won {s.lot_title ?? 'a lot'}, didn&apos;t pay</span>
                    </span>
                    <span className="tnum shrink-0 text-footnote font-semibold">{s.strikes} strike{s.strikes === 1 ? '' : 's'}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/admin/strikes" className="mt-2 inline-flex min-h-11 items-center text-subhead font-semibold underline underline-offset-2">All strikes</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
