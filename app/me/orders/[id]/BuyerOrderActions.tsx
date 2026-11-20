'use client';
import { Phone, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { DisputeButton } from '@/components/DisputeButton';
import { Card, ErrorText } from '@/components/Field';
import { iconProps } from '@/components/icons';
import { messageFor } from '@/lib/errors';
import { statusLabel } from '@/lib/orders';
import { subscribeTopic } from '@/lib/realtime';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatCountdown, formatLagosTime } from '@/lib/time';
import { useServerNow } from '@/lib/time-sync';

type Props = {
  order: { id: string; status: string; pay_by: string; offer_round: number; seller_phone: string | null; refunded_at: string | null };
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
  useEffect(() => subscribeTopic(supabase, `user:${userId}`, { notification: () => router.refresh() }), [supabase, userId, router]);

  // Back from Paystack: ask the server to verify (the webhook may be slower), then poll.
  useEffect(() => {
    if (!confirming) return;
    let tries = 0;
    void supabase.functions.invoke('paystack-init', { body: { order_id: order.id, action: 'verify' } }).finally(() => router.refresh());
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
    setBusy(true);
    const { error: e } = await supabase.rpc('decline_second_chance', { p_order_id: order.id });
    setBusy(false);
    if (e) return setError(messageFor(e.message));
    router.refresh();
  }

  const explainer = (
    <div className="flex gap-3 rounded-card border border-line bg-surface p-4">
      <ShieldCheck {...iconProps} size={24} className="shrink-0 text-winning" />
      <div>
        <p className="font-semibold">Your money is held until you collect the item</p>
        <p className="mt-1 text-body text-ink-muted">
          We only pay the seller after you have the item and give them your 6-digit handover code. If something's wrong, report it and we'll step in.
        </p>
      </div>
    </div>
  );

  if (order.status === 'awaiting_payment') {
    const left = Date.parse(order.pay_by) - now;
    if (confirming) {
      return (
        <Card className="text-center">
          <p className="font-semibold">Confirming your payment…</p>
          <p className="mt-1 text-body text-ink-muted">This usually takes a few seconds. You can leave this page.</p>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        <Card>
          <p className="text-label uppercase text-ink-muted">Pay within</p>
          {left > 0 ? (
            <p className={`font-num text-countdown tabular-nums ${left <= 60_000 ? 'text-live' : 'text-ink'}`}>{formatCountdown(left)}</p>
          ) : (
            <p className="text-ink">Time is up. If you already paid, it will be confirmed or refunded.</p>
          )}
          <p className="mt-1 text-body text-ink-muted">
            By {formatLagosTime(order.pay_by)}, or it goes to the next bidder{order.offer_round === 1 ? ' and counts as a strike' : ''}.
          </p>
        </Card>
        {explainer}
        <ErrorText>{error}</ErrorText>
        <Button block tall busy={busy} disabled={left <= 0} onClick={pay}>Pay now</Button>
        <p className="text-center text-body text-ink-muted">Card, bank transfer or USSD, via Paystack.</p>
        {order.offer_round === 2 && (
          <Button block variant="link" disabled={busy} onClick={decline}>No thanks, decline this offer</Button>
        )}
      </div>
    );
  }

  if (order.status === 'paid') {
    return (
      <div className="space-y-4">
        <Card className="text-center">
          <p className="text-label uppercase text-ink-muted">Your handover code</p>
          <p className="my-3 font-num text-code tabular-nums" aria-label="Handover code">{code ?? '······'}</p>
          <p className="font-semibold">Give this code to the seller only when you have the item.</p>
        </Card>
        {order.seller_phone && (
          <a href={`tel:+${order.seller_phone}`} className="flex min-h-11 items-center justify-center gap-2 rounded-pill border border-line bg-surface font-semibold">
            <Phone {...iconProps} size={18} /> Call seller to arrange pickup
          </a>
        )}
        <DisputeButton orderId={order.id} />
      </div>
    );
  }

  return (
    <Card>
      <p className="font-semibold">{statusLabel(order.status)}</p>
      <p className="mt-1 text-body text-ink-muted">
        {order.status === 'expired' && (order.refunded_at
          ? 'Your payment arrived after the deadline, so it has been refunded.'
          : order.offer_round === 1 ? "The 30-minute window closed. This counts as a strike on your account." : 'The offer expired.')}
        {order.status === 'disputed' && 'Our team is reviewing this order and will call you.'}
        {(order.status === 'handed_over' || order.status === 'paid_out') && 'Collected. Enjoy it!'}
        {order.status === 'refunded' && 'Your money has been returned through Paystack.'}
        {order.status === 'declined' && 'You declined this offer.'}
      </p>
    </Card>
  );
}
