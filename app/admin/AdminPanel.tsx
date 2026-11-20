'use client';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { ErrorText, Input, Label } from '@/components/Field';
import { iconProps } from '@/components/icons';
import { Price } from '@/components/Price';
import { messageFor } from '@/lib/errors';
import { formatNaira } from '@/lib/money';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatLagosDateTime, formatLagosTime } from '@/lib/time';

export type Overview = {
  disputes: { id: string; amount: number; dispute_reason: string; created_at: string; title: string;
    buyer_name: string | null; buyer_phone: string | null; seller_name: string | null; seller_phone: string | null }[];
  alerts: { id: string; kind: string; order_id: string | null; detail: Record<string, unknown>; created_at: string }[];
  struck_users: { id: string; display_name: string | null; phone: string | null; strikes: number; bidding_suspended: boolean }[];
  failed_payouts: { id: string; order_id: string; amount: number; status: string; failure_reason: string | null; attempts: number }[];
};
export type CalendarDrop = { id: string; title: string; opens_at: string; first_close_at: string; status: string; max_lots: number; lots: number; live_bids: number };
type DropLot = { id: string; title: string; area: string; seller_name: string | null; start_price: number; current_bid: number | null;
  bid_count: number; ends_at: string; closed_at: string | null; outcome: string | null };

const dayFmt = new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', weekday: 'long', day: 'numeric', month: 'short' });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' });

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-heading">{title}{count !== undefined && <span className="font-num text-ink-muted"> {count}</span>}</h2>
      <div className="rounded-card bg-surface p-4 shadow-elev">{children}</div>
    </section>
  );
}

/** datetime-local value (Lagos wall time) → ISO UTC. Lagos is UTC+1 all year. */
function lagosLocalToIso(v: string): string {
  return new Date(`${v}:00+01:00`).toISOString();
}

export function AdminPanel({ overview, calendar }: { overview: Overview; calendar: CalendarDrop[] }) {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drop, setDrop] = useState({ title: '', opens: '', closesAfter: '30', interval: '60', maxLots: '60' });
  const [openDrop, setOpenDrop] = useState<string | null>(null);
  const [lots, setLots] = useState<Record<string, DropLot[]>>({});

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const { error: e } = await fn();
    setBusy(false);
    if (e) setError(`${messageFor(e.message)} (${e.message})`);
    else {
      if (openDrop) void loadLots(openDrop);
      router.refresh();
    }
  }

  async function loadLots(dropId: string) {
    const { data } = await supabase.rpc('admin_drop_lots', { p_drop_id: dropId });
    setLots((l) => ({ ...l, [dropId]: (data ?? []) as DropLot[] }));
  }

  async function refund(orderId: string) {
    if (!confirm('Refund the buyer in full through Paystack?')) return;
    setBusy(true);
    const { error: e } = await supabase.functions.invoke('admin-refund', { body: { order_id: orderId } });
    setBusy(false);
    if (e) setError('Refund failed. Check the Paystack dashboard.');
    else router.refresh();
  }

  // Drops calendar: grouped by Lagos date.
  const days = new Map<string, CalendarDrop[]>();
  for (const d of calendar) {
    const k = dayKey.format(new Date(d.opens_at));
    days.set(k, [...(days.get(k) ?? []), d]);
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-display">Admin</h1>
      <ErrorText>{error}</ErrorText>

      <Section title="Disputes" count={overview.disputes.length}>
        {overview.disputes.length === 0 ? <p className="text-ink-muted">None open.</p> : (
          <ul className="space-y-4">
            {overview.disputes.map((d) => (
              <li key={d.id} className="space-y-2">
                <p className="font-semibold">{d.title} · <Price kobo={d.amount} /></p>
                <p>“{d.dispute_reason}”</p>
                <p className="text-body text-ink-muted">
                  Buyer {d.buyer_name} (+{d.buyer_phone}) · Seller {d.seller_name} (+{d.seller_phone})
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => run(() => supabase.rpc('admin_release_order', { p_order_id: d.id }), 'Release payment to the seller?')}>
                    Release to seller
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => refund(d.id)}>Refund buyer</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Drops calendar">
        {days.size === 0 && <p className="text-ink-muted">No drops in the next two weeks.</p>}
        <div className="space-y-4">
          {[...days.entries()].map(([k, ds]) => (
            <div key={k}>
              <p className="text-label uppercase text-ink-muted">{dayFmt.format(new Date(ds[0]!.opens_at))}</p>
              <ul className="mt-1 divide-y divide-line rounded-card border border-line">
                {ds.map((d) => {
                  const expanded = openDrop === d.id;
                  return (
                    <li key={d.id}>
                      <div className="flex items-center gap-2 p-2">
                        <button type="button" aria-expanded={expanded} className="flex min-h-11 flex-1 items-center gap-2 text-left"
                          onClick={() => {
                            setOpenDrop(expanded ? null : d.id);
                            if (!expanded) void loadLots(d.id);
                          }}>
                          {expanded ? <ChevronDown {...iconProps} size={18} /> : <ChevronRight {...iconProps} size={18} />}
                          <span>
                            <span className="block font-semibold">{d.title}{d.status !== 'published' && <span className="text-ink-muted"> · {d.status}</span>}</span>
                            <span className="block text-body text-ink-muted">
                              {formatLagosTime(d.opens_at)} · <span className="font-num tabular-nums">{d.lots}/{d.max_lots}</span> lots ·{' '}
                              <span className="font-num tabular-nums">{d.live_bids}</span> bids
                            </span>
                          </span>
                        </button>
                        {d.status === 'published' && Date.parse(d.opens_at) > Date.now() && (
                          <Button variant="link" disabled={busy}
                            onClick={() => run(() => supabase.rpc('admin_cancel_drop', { p_drop_id: d.id }), 'Cancel this drop and all its lots?')}>
                            Cancel
                          </Button>
                        )}
                      </div>
                      {expanded && (
                        <ul className="divide-y divide-line border-t border-line bg-bg">
                          {(lots[d.id] ?? []).length === 0 && <li className="p-3 text-ink-muted">No lots.</li>}
                          {(lots[d.id] ?? []).map((l) => (
                            <li key={l.id} className="flex items-center justify-between gap-2 p-3">
                              <a href={`/lot/${l.id}`} className="min-w-0">
                                <span className="block truncate font-semibold">{l.title}</span>
                                <span className="block text-body text-ink-muted">
                                  {l.seller_name ?? 'Seller'} · {l.area} · closes {formatLagosTime(l.ends_at)} · <span className="font-num">{l.bid_count}</span> bids
                                </span>
                              </a>
                              <span className="flex shrink-0 items-center gap-2">
                                <Price kobo={l.current_bid ?? l.start_price} />
                                {l.outcome ? <Badge kind={l.outcome === 'sold' ? 'sold' : 'ended'}>{l.outcome}</Badge> : (
                                  <Button variant="link" disabled={busy}
                                    onClick={() => run(() => supabase.rpc('admin_cancel_auction', { p_auction_id: l.id }), `Pull "${l.title}" now?`)}>
                                    Pull
                                  </Button>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <form className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4" onSubmit={(e) => {
          e.preventDefault();
          const opens = lagosLocalToIso(drop.opens);
          const firstClose = new Date(Date.parse(opens) + Number(drop.closesAfter) * 60_000).toISOString();
          void run(() => supabase.rpc('admin_create_drop', {
            p_title: drop.title, p_opens_at: opens, p_first_close_at: firstClose,
            p_close_interval_seconds: Number(drop.interval), p_max_lots: Number(drop.maxLots),
          }));
        }}>
          <div className="col-span-2"><Label htmlFor="dt">New drop title</Label>
            <Input id="dt" required value={drop.title} onChange={(e) => setDrop({ ...drop, title: e.target.value })} /></div>
          <div className="col-span-2"><Label htmlFor="do">Opens (Lagos time)</Label>
            <Input id="do" type="datetime-local" required value={drop.opens} onChange={(e) => setDrop({ ...drop, opens: e.target.value })} /></div>
          <div><Label htmlFor="dc">First close after (min)</Label>
            <Input id="dc" inputMode="numeric" className="font-num" value={drop.closesAfter} onChange={(e) => setDrop({ ...drop, closesAfter: e.target.value })} /></div>
          <div><Label htmlFor="di">Lots close every (s)</Label>
            <Input id="di" inputMode="numeric" className="font-num" value={drop.interval} onChange={(e) => setDrop({ ...drop, interval: e.target.value })} /></div>
          <div><Label htmlFor="dm">Max lots</Label>
            <Input id="dm" inputMode="numeric" className="font-num" value={drop.maxLots} onChange={(e) => setDrop({ ...drop, maxLots: e.target.value })} /></div>
          <div className="flex items-end"><Button type="submit" block disabled={busy}>Create drop</Button></div>
        </form>
      </Section>

      <Section title="Strikes" count={overview.struck_users.length}>
        {overview.struck_users.length === 0 ? <p className="text-ink-muted">Nobody has strikes.</p> : (
          <ul className="divide-y divide-line">
            {overview.struck_users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {u.display_name ?? 'Unnamed'} (+{u.phone}) · <span className="font-num">{u.strikes}</span> strike{u.strikes === 1 ? '' : 's'}
                  {u.bidding_suspended && <span className="font-semibold"> · suspended</span>}
                </span>
                <Button variant="link" disabled={busy}
                  onClick={() => run(() => supabase.rpc('admin_review_user', { p_user_id: u.id, p_reset_strikes: true }), 'Clear strikes and restore bidding?')}>
                  Clear
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Failed payouts" count={overview.failed_payouts.length}>
        {overview.failed_payouts.length === 0 ? <p className="text-ink-muted">None.</p> : (
          <ul className="divide-y divide-line">
            {overview.failed_payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <span><span className="font-num">{formatNaira(p.amount)}</span> · {p.status} · {p.failure_reason ?? 'no reason'} · {p.attempts} tries</span>
                <Button variant="link" disabled={busy} onClick={() => run(() => supabase.rpc('admin_retry_payout', { p_payout_id: p.id }))}>Retry</Button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Alerts" count={overview.alerts.length}>
        {overview.alerts.length === 0 ? <p className="text-ink-muted">All clear.</p> : (
          <ul className="divide-y divide-line">
            {overview.alerts.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{a.kind}</span> · {formatLagosDateTime(a.created_at)}
                  <br /><span className="break-all text-body text-ink-muted">{JSON.stringify(a.detail)}</span>
                </span>
                <Button variant="link" disabled={busy}
                  onClick={() => run(() => supabase.from('ops_alerts').update({ resolved_at: new Date().toISOString() }).eq('id', a.id))}>
                  Dismiss
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
