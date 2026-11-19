'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { ErrorText } from '@/components/Field';
import { messageFor } from '@/lib/errors';
import { statusLabel } from '@/lib/orders';
import { subscribeTopic } from '@/lib/realtime';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatLagosTime } from '@/lib/time';
import { useServerNow } from '@/lib/time-sync';
import { DisputeButton } from '@/components/DisputeButton';

type Props = {
  order: {
    id: string;
    auction_id: string;
    status: string;
    pay_by: string;
    offer_round: number;
    seller_phone: string | null;
    refunded_at: string | null;
  };
  userId: string;
};

export function BuyerOrderActions({ order, userId }: Props) {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const params = useSearchParams();
  const now = useServerNow(500);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(params.get('paid') === '1' && order.status === 'awaiting_payment');

  // Order updates arrive as notifications on user:<id>.
  useEffect(() => {
    return subscribeTopic(supabase, `user:${userId}`, { notification: () => router.refresh() });
  }, [supabase, userId, router]);

  // Back from Paystack: ask the server to verify (webhook may be slower), then poll.
  useEffect(() => {
    if (!confirming) return;
    let tries = 0;
    void supabase.functions.invoke('paystack-init', { body: { order_id: order.id, action: 'verify' } })
      .finally(() => router.refresh());
    const id = setInterval(() => {
      tries++;
      router.refresh();
      if (tries > 20) {
        clearInterval(id);
        setConfirming(false);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [confirming, order.id, supabase, router]);

  useEffect(() => {
    if (order.status !== 'awaiting_payment') setConfirming(false);
  }, [order.status]);

  const loadCode = useCallback(async () => {
    const { data } = await supabase.rpc('get_handover_code', { p_order_id: order.id });
    setCode((data as string | null) ?? null);
  }, [supabase, order.id]);

  useEffect(() => {
    if (order.status === 'paid') void loadCode();
  }, [order.status, loadCode]);

  async function pay() {
    setBusy(true);
    setError(null);
    const { data, error: fnError } = await supabase.functions.invoke('paystack-init', { body: { order_id: order.id } });
    if (fnError || !data?.authorization_url) {
      setBusy(false);
      const body = await (fnError as { context?: Response } | null)?.context?.json?.().catch(() => null);
      return setError(messageFor(body?.error ?? 'payment_provider_error'));
    }
    window.location.href = data.authorization_url as string;
  }

  async function decline() {
    if (!confirm('Decline this offer? It will not count as a strike.')) return;
    setBusy(true);
    const { error: e } = await supabase.rpc('decline_second_chance', { p_order_id: order.id });
    setBusy(false);
    if (e) return setError(messageFor(e.message));
    router.refresh();
  }

  if (order.status === 'awaiting_payment') {
    const left = Date.parse(order.pay_by) - now;
    if (confirming) {
      return (
        <div className="rounded-card border border-line bg-surface p-4 text-center">
          <p className="font-semibold">Confirming your payment…</p>
          <p className="mt-1 text-small text-muted">This usually takes a few seconds. You can leave this page.</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <div className="rounded-card border border-line bg-surface p-4">
          <p className="text-small text-muted">Pay by {formatLagosTime(order.pay_by)}</p>
          {left > 0 ? (
            <Countdown endsAt={order.pay_by} now={now} className="text-display" />
          ) : (
            <p className="text-small text-warn">Time is up. If you already paid, it will be confirmed or refunded.</p>
          )}
          <p className="mt-2 text-small text-muted">
            Card, bank transfer or USSD via Paystack. Your money is held until you collect the item and give the seller
            your handover code.
          </p>
        </div>
        <ErrorText>{error}</ErrorText>
        <Button block onClick={pay} disabled={busy || left <= 0}>{busy ? 'Opening Paystack…' : 'Pay now'}</Button>
        {order.offer_round === 2 && (
          <Button block variant="ghost" onClick={decline} disabled={busy}>No thanks, decline offer</Button>
        )}
      </div>
    );
  }

  if (order.status === 'paid') {
    return (
      <div className="space-y-3">
        <div className="rounded-card border border-line bg-surface p-4 text-center">
          <p className="text-small text-muted">Your handover code</p>
          <p className="my-2 font-mono text-display tracking-[0.3em]" aria-label="Handover code">{code ?? '······'}</p>
          <p className="text-small">
            Give this code to the seller <strong>only once you have the item</strong>. It releases your payment to them.
          </p>
        </div>
        {order.seller_phone && (
          <a href={`tel:+${order.seller_phone}`} className="flex min-h-11 items-center justify-center rounded-pill border border-line bg-surface font-semibold">
            Call seller to arrange pickup
          </a>
        )}
        <DisputeButton orderId={order.id} />
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="font-semibold">{statusLabel(order.status)}</p>
      {order.status === 'expired' && (
        <p className="mt-1 text-small text-muted">
          {order.refunded_at
            ? 'Your payment arrived after the deadline and has been refunded.'
            : order.offer_round === 1
              ? "The 30-minute payment window closed. This counts as a strike on your account."
              : 'The offer has expired.'}
        </p>
      )}
      {order.status === 'disputed' && <p className="mt-1 text-small text-muted">Our team is reviewing this order and will contact you.</p>}
      {(order.status === 'handed_over' || order.status === 'paid_out') && <p className="mt-1 text-small text-muted">Enjoy your item!</p>}
      {order.status === 'refunded' && <p className="mt-1 text-small text-muted">Your money has been returned via Paystack.</p>}
    </div>
  );
}
