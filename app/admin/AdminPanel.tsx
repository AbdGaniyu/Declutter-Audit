'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/Button';
import { ErrorText, Input, Label } from '@/components/Field';
import { messageFor } from '@/lib/errors';
import { formatNaira } from '@/lib/money';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatLagosDateTime } from '@/lib/time';

export type Overview = {
  drops: { id: string; title: string; opens_at: string; first_close_at: string; status: string; max_lots: number; lots: number }[];
  disputes: { id: string; amount: number; dispute_reason: string; created_at: string; title: string;
    buyer_name: string | null; buyer_phone: string | null; seller_name: string | null; seller_phone: string | null }[];
  alerts: { id: string; kind: string; order_id: string | null; detail: Record<string, unknown>; created_at: string }[];
  struck_users: { id: string; display_name: string | null; phone: string | null; strikes: number; bidding_suspended: boolean }[];
  failed_payouts: { id: string; order_id: string; amount: number; status: string; failure_reason: string | null; attempts: number }[];
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-small font-semibold">{title}</h2>
      <div className="rounded-card border border-line bg-surface p-3">{children}</div>
    </section>
  );
}

/** datetime-local value (Lagos wall time) → ISO UTC. Lagos is UTC+1 all year. */
function lagosLocalToIso(v: string): string {
  return new Date(`${v}:00+01:00`).toISOString();
}

export function AdminPanel({ overview }: { overview: Overview }) {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drop, setDrop] = useState({ title: '', opens: '', closesAfter: '30', interval: '60', maxLots: '60' });
  const [cancelLot, setCancelLot] = useState('');

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    const { error: e } = await fn();
    setBusy(false);
    if (e) setError(messageFor(e.message) + ` (${e.message})`);
    else router.refresh();
  }

  async function refund(orderId: string) {
    if (!confirm('Refund the buyer in full through Paystack?')) return;
    setBusy(true);
    const { error: e } = await supabase.functions.invoke('admin-refund', { body: { order_id: orderId } });
    setBusy(false);
    if (e) setError('Refund failed. Check the Paystack dashboard.');
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-title">Admin</h1>
      <ErrorText>{error}</ErrorText>

      <Section title={`Disputes (${overview.disputes.length})`}>
        {overview.disputes.length === 0 ? <p className="text-small text-muted">None open.</p> : (
          <ul className="space-y-4">
            {overview.disputes.map((d) => (
              <li key={d.id} className="space-y-2">
                <p className="font-semibold">{d.title} · {formatNaira(d.amount)}</p>
                <p className="text-small">“{d.dispute_reason}”</p>
                <p className="text-small text-muted">
                  Buyer {d.buyer_name} (+{d.buyer_phone}) · Seller {d.seller_name} (+{d.seller_phone})
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={busy}
                    onClick={() => run(() => supabase.rpc('admin_release_order', { p_order_id: d.id }), 'Release payment to the seller?')}>
                    Release to seller
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={() => refund(d.id)}>Refund buyer</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Drops">
        <ul className="divide-y divide-line">
          {overview.drops.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-small">
              <span>
                <span className="font-semibold">{d.title}</span> · {formatLagosDateTime(d.opens_at)} · {d.lots}/{d.max_lots} lots
                {d.status !== 'published' && <span className="text-danger"> · {d.status}</span>}
              </span>
              {d.status === 'published' && Date.parse(d.opens_at) > Date.now() && (
                <button type="button" className="text-danger" disabled={busy}
                  onClick={() => run(() => supabase.rpc('admin_cancel_drop', { p_drop_id: d.id }), 'Cancel this drop and all its lots?')}>
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
        <form className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3" onSubmit={(e) => {
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
            <Input id="dc" inputMode="numeric" value={drop.closesAfter} onChange={(e) => setDrop({ ...drop, closesAfter: e.target.value })} /></div>
          <div><Label htmlFor="di">Lots close every (s)</Label>
            <Input id="di" inputMode="numeric" value={drop.interval} onChange={(e) => setDrop({ ...drop, interval: e.target.value })} /></div>
          <div><Label htmlFor="dm">Max lots</Label>
            <Input id="dm" inputMode="numeric" value={drop.maxLots} onChange={(e) => setDrop({ ...drop, maxLots: e.target.value })} /></div>
          <div className="flex items-end"><Button type="submit" block disabled={busy}>Create drop</Button></div>
        </form>
      </Section>

      <Section title={`Strikes & suspensions (${overview.struck_users.length})`}>
        {overview.struck_users.length === 0 ? <p className="text-small text-muted">Nobody has strikes.</p> : (
          <ul className="divide-y divide-line">
            {overview.struck_users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 py-2 text-small">
                <span>
                  {u.display_name ?? 'Unnamed'} (+{u.phone}) · {u.strikes} strike{u.strikes === 1 ? '' : 's'}
                  {u.bidding_suspended && <span className="text-danger"> · suspended</span>}
                </span>
                <button type="button" className="font-semibold text-brand" disabled={busy}
                  onClick={() => run(() => supabase.rpc('admin_review_user', { p_user_id: u.id, p_reset_strikes: true }),
                    'Clear strikes and restore bidding?')}>
                  Clear
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Failed payouts (${overview.failed_payouts.length})`}>
        {overview.failed_payouts.length === 0 ? <p className="text-small text-muted">None.</p> : (
          <ul className="divide-y divide-line">
            {overview.failed_payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-small">
                <span>{formatNaira(p.amount)} · {p.status} · {p.failure_reason ?? 'no reason'} · {p.attempts} tries</span>
                <button type="button" className="font-semibold text-brand" disabled={busy}
                  onClick={() => run(() => supabase.rpc('admin_retry_payout', { p_payout_id: p.id }))}>Retry</button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Alerts (${overview.alerts.length})`}>
        {overview.alerts.length === 0 ? <p className="text-small text-muted">All clear.</p> : (
          <ul className="divide-y divide-line">
            {overview.alerts.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-2 py-2 text-small">
                <span>
                  <span className="font-semibold">{a.kind}</span> · {formatLagosDateTime(a.created_at)}
                  <br /><span className="break-all text-muted">{JSON.stringify(a.detail)}</span>
                </span>
                <button type="button" className="text-brand" disabled={busy}
                  onClick={() => run(() => supabase.from('ops_alerts').update({ resolved_at: new Date().toISOString() }).eq('id', a.id))}>
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Pull a lot">
        <form className="flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          void run(() => supabase.rpc('admin_cancel_auction', { p_auction_id: cancelLot.trim() }), 'Cancel this lot now?');
        }}>
          <Input aria-label="Lot ID" placeholder="Lot ID (from its URL)" value={cancelLot} onChange={(e) => setCancelLot(e.target.value)} />
          <Button type="submit" variant="danger" disabled={busy || !cancelLot}>Cancel lot</Button>
        </form>
      </Section>
    </div>
  );
}
