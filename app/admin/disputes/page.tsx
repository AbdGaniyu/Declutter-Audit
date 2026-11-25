import { DismissAlert, RefundButton, RpcButton } from '@/components/admin/AdminActions';
import { Price } from '@/components/Price';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatLagosDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

type Overview = {
  disputes: { id: string; amount: number; dispute_reason: string; created_at: string; title: string;
    buyer_name: string | null; buyer_phone: string | null; seller_name: string | null; seller_phone: string | null }[];
  alerts: { id: string; kind: string; detail: Record<string, unknown>; created_at: string }[];
  failed_payouts: { id: string; amount: number; status: string; failure_reason: string | null; attempts: number }[];
};

/** Admin › Disputes: release or refund held money, plus payouts and alerts that need a person. */
export default async function AdminDisputesPage() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.rpc('admin_overview');
  const o = (data ?? { disputes: [], alerts: [], failed_payouts: [] }) as unknown as Overview;

  return (
    <div className="space-y-8">
      <h1 className="text-title-sm md:text-title">Disputes</h1>
      <section className="space-y-3">
        {o.disputes.length === 0 && <p className="text-subhead text-secondary">No open disputes. Money is moving.</p>}
        {o.disputes.map((d) => (
          <article key={d.id} aria-label={d.title} className="squircle space-y-3 rounded-group bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-headline">{d.title}</h2>
              <Price kobo={d.amount} className="text-headline" />
            </div>
            <p className="squircle rounded-control bg-fill p-3 text-subhead">&ldquo;{d.dispute_reason}&rdquo;</p>
            <p className="text-footnote text-secondary">
              Reported {formatLagosDateTime(d.created_at)} · Buyer {d.buyer_name ?? '—'} (+{d.buyer_phone}) · Seller {d.seller_name ?? '—'} (+{d.seller_phone})
            </p>
            <div className="flex flex-wrap gap-2">
              <RpcButton rpc="admin_release_order" args={{ p_order_id: d.id }} variant="primary" confirm="Release payment to the seller?">Release to seller</RpcButton>
              <RefundButton orderId={d.id} />
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-title-sm">Failed payouts</h2>
        {o.failed_payouts.length === 0 ? <p className="text-subhead text-secondary">None.</p> : (
          <ul className="squircle overflow-hidden rounded-group bg-surface">
            {o.failed_payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 [&:not(:last-child)]:hairline-b">
                <span className="text-subhead"><Price kobo={p.amount} className="font-semibold" /> · {p.status} · {p.failure_reason ?? 'no reason'} · <span className="tnum">{p.attempts}</span> tries</span>
                <RpcButton rpc="admin_retry_payout" args={{ p_payout_id: p.id }} variant="text">Retry</RpcButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-title-sm">Alerts</h2>
        {o.alerts.length === 0 ? <p className="text-subhead text-secondary">All clear.</p> : (
          <ul className="squircle overflow-hidden rounded-group bg-surface">
            {o.alerts.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-3 [&:not(:last-child)]:hairline-b">
                <span className="min-w-0 text-subhead">
                  <span className="font-semibold">{a.kind}</span> · {formatLagosDateTime(a.created_at)}
                  <span className="block break-all text-footnote text-secondary">{JSON.stringify(a.detail)}</span>
                </span>
                <DismissAlert id={a.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
