'use client';
import { CircleAlert, CircleCheck, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { iconProps } from '@/components/icons';
import type { Lot } from '@/lib/lot';
import { formatNaira } from '@/lib/money';
import { formatCountdown, lotPhase } from '@/lib/time';

/**
 * DESIGN.md › Status banner (under photos): winning / outbid / won, or nothing.
 * Every state has an icon and a label, never color alone.
 */
export function StatusBanner({ lot, now, canBid, busy, onQuickBid }: {
  lot: Lot;
  now: number;
  canBid: boolean;
  busy: boolean;
  onQuickBid: (amount: number) => void;
}) {
  const phase = lotPhase(lot.starts_at, lot.ends_at, lot.closed_at, now);
  const order = lot.my_order;

  if (order && order.status === 'awaiting_payment') {
    const left = Date.parse(order.pay_by) - now;
    return (
      <Banner tone="winning" icon={<Trophy {...iconProps} size={20} className="text-winning" />}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">
            {order.offer_round === 2 ? "It's yours if you want it. " : 'You won! '}
            {left > 0 ? <>Pay within <span className="font-num tabular-nums">{formatCountdown(left)}</span></> : 'Payment time is up.'}
          </p>
          {left > 0 && (
            <Link href={`/me/orders/${order.id}`} className="inline-flex min-h-11 items-center rounded-pill bg-ink px-4 font-semibold text-white">
              Pay now
            </Link>
          )}
        </div>
      </Banner>
    );
  }
  if (order && ['paid', 'handed_over', 'paid_out'].includes(order.status)) {
    return (
      <Banner tone="winning" icon={<CircleCheck {...iconProps} size={20} className="text-winning" />}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">{order.status === 'paid' ? "You won and you've paid." : 'You won this lot.'}</p>
          {order.status === 'paid' && (
            <Link href={`/me/orders/${order.id}`} className="inline-flex min-h-11 items-center font-semibold text-focus">Handover code</Link>
          )}
        </div>
      </Banner>
    );
  }
  if (phase !== 'live') return null;

  if (lot.you_are_leading) {
    return (
      <Banner tone="winning" icon={<CircleCheck {...iconProps} size={20} className="text-winning" />}>
        <p className="font-semibold">You're winning at <span className="font-num tabular-nums">{formatNaira(lot.current_bid)}</span></p>
      </Banner>
    );
  }
  if (lot.my_max_bid !== null) {
    return (
      <Banner tone="outbid" icon={<CircleAlert {...iconProps} size={20} className="text-outbid" />}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">
            You've been outbid — <span className="font-num tabular-nums">{formatNaira(lot.current_bid)}</span> now
          </p>
          <Button variant="live" busy={busy} disabled={!canBid} onClick={() => onQuickBid(lot.min_next)}>
            Bid {formatNaira(lot.min_next)}
          </Button>
        </div>
      </Banner>
    );
  }
  return null;
}

function Banner({ tone, icon, children }: { tone: 'winning' | 'outbid'; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div role="status" className={`flex items-start gap-3 rounded-card p-3 text-ink ${tone === 'winning' ? 'bg-winning-soft' : 'bg-outbid-soft'}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
