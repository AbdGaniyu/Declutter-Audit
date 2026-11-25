'use client';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Countdown } from '@/components/Countdown';
import { iconProps } from '@/components/icons';
import { LivePrice, Price } from '@/components/Price';
import { SlideToBid, type SlideState } from '@/components/SlideToBid';
import { QuickBidChips, WhereYouStand } from '@/components/WhereYouStand';
import { conditionLabel } from '@/lib/areas';
import { chipAmounts } from '@/lib/bidding';
import type { Lot } from '@/lib/lot';
import { formatNaira } from '@/lib/money';
import { SPRINGS, settleTime, springEasing } from '@/lib/spring';
import { formatLagosTime, lotPhase } from '@/lib/time';

export type HistoryRow = { bidder_no: number; amount: number; created_at: string; is_me: boolean };

const DRAWER_EASE = `${settleTime(SPRINGS.flick)}ms ${springEasing(SPRINGS.flick, settleTime(SPRINGS.flick))}`;

/**
 * DESIGN.md › Lot page bid block. One instance, two shapes:
 *  - mobile: a glass dock fixed to the bottom; drag the grabber up (or tap it)
 *    to reveal the chips and bid history;
 *  - desktop: a floating panel, sticky beside the gallery, everything visible.
 */
export function BidPanel({
  lot, now, connected, signedIn, busy, rejection, history, animateKeys, preferAmount, onBid, onNeedVerify,
}: {
  lot: Lot;
  now: number;
  connected: boolean;
  signedIn: boolean;
  busy: boolean;
  rejection: { key: number; message: string } | null;
  history: HistoryRow[];
  animateKeys: Set<string>;
  preferAmount: number | null;
  onBid: (amount: number) => void;
  onNeedVerify: () => void;
}) {
  const phase = lotPhase(lot.starts_at, lot.ends_at, lot.closed_at, now);
  const chips = useMemo(() => chipAmounts(lot), [lot]);
  const [selected, setSelected] = useState(() => Math.max(0, chips.findIndex((c) => c.total === preferAmount)));
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // A new minimum (outbid, or a rejection) resets to the first chip.
  useEffect(() => setSelected(0), [lot.min_next, rejection?.key]);

  const ended = phase === 'ended';
  const cancelled = lot.outcome === 'cancelled';
  const priceLabel = cancelled ? 'Withdrawn' : ended ? (lot.current_bid ? 'Sold for' : 'Unsold')
    : lot.current_bid ? 'Current bid' : 'Opening bid';
  const timeLabel = ended ? 'Closed' : phase === 'upcoming' ? 'Opens' : 'Time left';

  // Why bidding is paused (one line), or null when the slider is live.
  const paused = (() => {
    if (cancelled || ended) return 'Bidding has ended';
    if (phase === 'upcoming') return `Bidding opens ${formatLagosTime(lot.starts_at)}`;
    if (!connected) return 'Bidding paused';
    if (!signedIn || !lot.my_verified) return null; // sliding opens Verify phone
    if (lot.is_seller) return 'This is your lot';
    if (lot.my_suspended) return 'Bidding paused on your account';
    if (lot.you_are_leading) return "You're the top bidder";
    return null;
  })();
  const slideState: SlideState = busy ? 'placing' : paused ? 'paused' : 'ready';
  const amount = chips[selected]?.total ?? lot.min_next;
  const showBidding = !ended && !cancelled;

  return (
    <aside aria-label="Bidding" className="glass-dock fixed inset-x-2 bottom-2 z-30 rounded-dock px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2
      md:sticky md:inset-auto md:top-24 md:z-auto md:bg-surface md:bg-none md:p-6 md:shadow-float md:backdrop-blur-none">
      {/* Grabber: mobile only. */}
      <button type="button" aria-expanded={expanded} aria-label={expanded ? 'Show less' : 'Show bid amounts and history'}
        onClick={() => setExpanded((e) => !e)}
        className="mx-auto mb-1 flex h-6 w-16 items-center justify-center md:hidden">
        <span className="h-1 w-8 rounded-pill [background:color-mix(in_srgb,var(--secondary)_45%,transparent)]" />
      </button>

      <div className="hidden md:block">
        <p className="text-eyebrow uppercase text-secondary">
          Lot <span className="tnum">{String(lot.lot_no).padStart(2, '0')}</span> · {lot.area} · {conditionLabel(lot.condition)}
        </p>
        <h1 className="mt-1 text-title-sm">{lot.title}</h1>
      </div>

      {/* The clock is the hero: price and time are the two biggest things. */}
      <div className="flex items-start justify-between gap-4 md:mt-5">
        <div className="min-w-0">
          <p className="text-footnote font-semibold text-secondary">{priceLabel}</p>
          {cancelled || (ended && !lot.current_bid)
            ? <Price kobo={lot.start_price} className="text-price-lot-sm text-secondary md:text-price-lot" />
            : <LivePrice kobo={lot.current_bid ?? lot.start_price} className="text-price-lot-sm font-bold md:text-price-lot" />}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-footnote font-semibold text-secondary">{timeLabel}</p>
          <Countdown startsAt={lot.starts_at} endsAt={lot.ends_at} closedAt={lot.closed_at} now={now} stale={!connected} announce />
        </div>
      </div>

      <div className="mt-3 min-h-0 empty:hidden">
        <WhereYouStand lot={lot} now={now} rejection={rejection?.message ?? null} />
      </div>

      {showBidding && (
        <>
          <div className={`grid md:!grid-rows-[1fr] ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            style={{ transition: `grid-template-rows ${DRAWER_EASE}` }}>
            <div className="overflow-hidden">
              <div className="pt-4">
                <QuickBidChips chips={chips} selected={selected} onSelect={setSelected} disabled={slideState !== 'ready'} />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <SlideToBid amount={amount} state={slideState} pausedLabel={paused ?? undefined}
              onBid={() => (!signedIn || !lot.my_verified ? onNeedVerify() : onBid(amount))} />
          </div>
          <p className="mt-2 text-center text-footnote text-secondary">
            Slide or tap. Bids are final; winners pay within 30 minutes.
          </p>
        </>
      )}
      {ended && !lot.my_order && (
        <Link href="/" className="pressable mt-4 flex min-h-12 items-center justify-center rounded-pill bg-fill text-headline">
          Back to the drop
        </Link>
      )}

      {/* Bid history: in the drawer on mobile, always on desktop. */}
      <div className={`grid md:!grid-rows-[1fr] ${expanded || !showBidding ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
        style={{ transition: `grid-template-rows ${DRAWER_EASE}` }}>
        <div className="overflow-hidden">
          <BidHistory history={history} bidCount={lot.bid_count} open={historyOpen} onToggle={() => setHistoryOpen((o) => !o)}
            animateKeys={animateKeys} startPrice={lot.start_price} step={lot.step} />
        </div>
      </div>
    </aside>
  );
}

function BidHistory({ history, bidCount, open, onToggle, animateKeys, startPrice, step }: {
  history: HistoryRow[];
  bidCount: number;
  open: boolean;
  onToggle: () => void;
  animateKeys: Set<string>;
  startPrice: number;
  step: number;
}) {
  const list = useRef<HTMLUListElement>(null);
  return (
    <section className="mt-4 [box-shadow:inset_0_0.5px_0_var(--hairline)]">
      <button type="button" aria-expanded={open} onClick={onToggle}
        className="flex min-h-12 w-full items-center justify-between text-headline">
        Bid history
        <span className="flex items-center gap-1 text-subhead text-secondary">
          <span className="tnum">{bidCount}</span> bid{bidCount === 1 ? '' : 's'}
          <ChevronDown {...iconProps} size={18} className={`transition-transform duration-300 ease-spring ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        history.length === 0 ? (
          <p className="pb-2 text-subhead text-secondary">No bids yet. The opening bid is {formatNaira(startPrice)}, then {formatNaira(step)} steps.</p>
        ) : (
          <ul ref={list} className="pb-2">
            {history.map((h) => {
              const key = `${h.bidder_no}-${h.amount}`;
              return (
                <li key={key} className={`flex min-h-11 items-center justify-between text-subhead [&:not(:last-child)]:hairline-b ${animateKeys.has(key) ? 'slide-in-top' : ''}`}>
                  <span className={h.is_me ? 'font-semibold' : 'text-secondary'}>{h.is_me ? 'You' : `Bidder ${h.bidder_no}`}</span>
                  <span className="text-secondary"><span className="tnum font-semibold text-label">{formatNaira(h.amount)}</span> · {formatLagosTime(h.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )
      )}
    </section>
  );
}
