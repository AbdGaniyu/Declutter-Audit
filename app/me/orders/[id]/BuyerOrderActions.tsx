'use client';
import { Clock, Lock, Phone } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/Button';
import { DisputeButton } from '@/components/DisputeButton';
import { Card, ErrorText } from '@/components/Field';
import { TrustCard } from '@/components/GroupedList';
import { iconProps } from '@/components/icons';
import { messageFor } from '@/lib/errors';
import { statusLabel } from '@/lib/orders';
import { subscribeTopic } from '@/lib/realtime';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatNaira } from '@/lib/money';
import { shortTitle } from '@/lib/drop';
import { formatClock } from '@/lib/time';
import { useServerNow } from '@/lib/time-sync';

type Props = {
  order: {
    id: string; status: string; pay_by: string; offer_round: number; amount: number; title: string; area: string;
    seller_name: string; seller_phone: string | null; refunded_at: string | null;
  };
  /** Order summary card, rendered between the pay-by banner and the explainer. */
  summary: React.ReactNode;
  userId: string;
};

export function BuyerOrderActions({ order, summary, userId }: Props) {
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

  const item = shortTitle(order.title).toLowerCase();
  const explainer = (
    <TrustCard title="Your money is held until you collect the item"
      steps={[
        <>Pay now. We hold the {formatNaira(order.amount)}. {order.seller_name} can&apos;t touch it yet.</>,
        <>Meet {order.seller_name} in {order.area} and check the {item}.</>,
        <>Happy with it? Give {order.seller_name} your 6-digit code. That releases the money.</>,
      ]}
      footer="Not what was described? Keep the code and tap Report a problem. We'll step in." />
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
      <div className="space-y-4 pb-28">
        <p role="status" className="squircle flex items-start gap-3 rounded-group bg-fill p-4 text-headline">
          <Clock {...iconProps} size={20} className="mt-0.5 shrink-0" />
          {left > 0 ? (
            <span>
              Pay within <span className={`tnum ${left <= 60_000 ? 'text-accent-text' : ''}`}>{formatClock(left)}</span> or it goes to the next bidder
              {order.offer_round === 1 ? ', and it counts as a strike.' : '.'}
            </span>
          ) : <span>Time is up. If you already paid, it will be confirmed or refunded.</span>}
        </p>
        {summary}
        {explainer}
        <ErrorText>{error}</ErrorText>
        {order.offer_round === 2 && (
          <Button block variant="text" disabled={busy} onClick={decline}>No thanks, decline this offer</Button>
        )}
        <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 [background:linear-gradient(to_top,var(--bg)_70%,transparent)]">
          <div className="mx-auto max-w-lot">
            <Button block tall busy={busy} disabled={left <= 0} onClick={pay}>
              <Lock {...iconProps} size={18} /> Pay {formatNaira(order.amount)}
            </Button>
            <p className="mt-2 text-center text-footnote text-secondary">Secure checkout by Paystack · card, transfer or USSD</p>
          </div>
        </div>
      </div>
    );
  }

  if (order.status === 'paid') {
    return (
      <div className="space-y-4">
        <section className="squircle rounded-group bg-surface p-6 text-center">
          <p className="text-eyebrow uppercase text-secondary">Your handover code</p>
          <p className="tnum my-3 text-code" aria-label="Handover code">{code ?? '······'}</p>
          <p className="text-headline">Give this code to {order.seller_name} only when you have the item.</p>
        </section>
        {summary}
        {order.seller_phone && (
          <a href={`tel:+${order.seller_phone}`} className="pressable flex min-h-12 items-center justify-center gap-2 rounded-pill bg-fill text-headline">
            <Phone {...iconProps} size={18} /> Call {order.seller_name} to arrange pickup
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
