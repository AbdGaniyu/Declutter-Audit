'use client';
import { ArrowUp, CircleAlert, CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { iconProps } from '@/components/icons';
import type { BidChip } from '@/lib/bidding';
import type { Lot } from '@/lib/lot';
import { formatNaira } from '@/lib/money';
import { formatClock, lotPhase } from '@/lib/time';

/**
 * DESIGN.md › Where you stand: one line under the price, monochrome, always with
 * an icon or a word. Top bidder · Outbid · Won · Lost · Rejected · nothing.
 */
export function WhereYouStand({ lot, now, rejection }: { lot: Lot; now: number; rejection: string | null }) {
  const phase = lotPhase(lot.starts_at, lot.ends_at, lot.closed_at, now);
  const order = lot.my_order;

  if (order && order.status === 'awaiting_payment') {
    const left = Date.parse(order.pay_by) - now;
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-headline">{order.offer_round === 2 ? "It's yours if you want it" : 'You won this lot'}</p>
        {left > 0 ? (
          <Link href={`/me/orders/${order.id}`} className="pressable inline-flex min-h-11 items-center rounded-pill bg-label px-5 text-headline text-on-label">
            Pay within&nbsp;<span className="tnum">{formatClock(left)}</span>
          </Link>
        ) : <p className="text-subhead text-secondary">Payment time is up.</p>}
      </div>
    );
  }
  if (order && ['paid', 'handed_over', 'paid_out'].includes(order.status)) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-headline"><CircleCheck {...iconProps} size={20} /> You won this lot</p>
        {order.status === 'paid' && (
          <Link href={`/me/orders/${order.id}`} className="pressable inline-flex min-h-11 items-center rounded-pill bg-fill px-5 text-headline">
            Handover code
          </Link>
        )}
      </div>
    );
  }
  if (rejection) {
    return (
      <p role="alert" className="flex items-start gap-2 text-headline">
        <CircleAlert {...iconProps} size={20} className="mt-0.5 shrink-0" /> {rejection}
      </p>
    );
  }
  if (phase === 'live' && lot.you_are_leading) {
    return <p role="status" className="flex items-center gap-2 text-headline"><CircleCheck {...iconProps} size={20} /> You&apos;re the top bidder</p>;
  }
  if (phase === 'live' && lot.my_max_bid !== null) {
    return (
      <p role="status" className="flex flex-wrap items-center gap-2 text-headline">
        <span className="inline-flex items-center gap-1 rounded-pill bg-label px-3 py-0.5 text-subhead font-semibold text-on-label">
          <ArrowUp {...iconProps} size={14} /> Outbid
        </span>
        <span><span className="tnum">{formatNaira(lot.current_bid)}</span> now. Bid again?</span>
      </p>
    );
  }
  if (phase === 'ended' && lot.my_max_bid !== null && lot.current_bid) {
    return <p role="status" className="text-headline">Sold to another bidder</p>;
  }
  return null;
}

/** DESIGN.md › Quick bid chips: +1 / +2 / +5 steps, each with the total underneath. */
export function QuickBidChips({ chips, selected, onSelect, disabled }: {
  chips: BidChip[];
  selected: number;
  onSelect: (i: number) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Bid amount" className="grid grid-cols-3 gap-2">
      {chips.map((c, i) => {
        const on = i === selected;
        return (
          <button key={i} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onSelect(i)}
            aria-label={c.opening ? `Opening bid ${formatNaira(c.total)}` : `Raise ${formatNaira(c.increment)} to ${formatNaira(c.total)}`}
            className={`pressable squircle flex min-h-14 flex-col items-center justify-center rounded-control px-2 transition-colors duration-300 ease-spring
              disabled:opacity-50 ${on ? 'bg-label text-on-label' : 'bg-fill text-label'}`}>
            <span className="tnum text-headline">{c.opening ? 'Opening' : `+${formatNaira(c.increment)}`}</span>
            <span className={`tnum text-footnote ${on ? 'opacity-70' : 'text-secondary'}`}>{formatNaira(c.total)}</span>
          </button>
        );
      })}
    </div>
  );
}
