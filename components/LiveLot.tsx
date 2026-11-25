'use client';
import { BadgeCheck, Wifi } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Pill } from '@/components/Badge';
import { BidSheet, type Rejection } from '@/components/BidSheet';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { iconProps } from '@/components/icons';
import { PhoneVerify } from '@/components/PhoneVerify';
import { PhotoGallery } from '@/components/PhotoGallery';
import { LivePrice, Price } from '@/components/Price';
import { Sheet } from '@/components/Sheet';
import { StatusBanner } from '@/components/StatusBanner';
import { conditionLabel } from '@/lib/areas';
import { messageFor } from '@/lib/errors';
import { applyBroadcast, type AuctionBroadcast, type Lot } from '@/lib/lot';
import { formatNaira } from '@/lib/money';
import { subscribeTopic } from '@/lib/realtime';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatLagosTime, lotPhase } from '@/lib/time';
import { noteServerNow, syncServerClock, useServerNow } from '@/lib/time-sync';

type HistoryRow = { bidder_no: number; amount: number; created_at: string; is_me: boolean };

const memberSince = new Intl.DateTimeFormat('en-NG', { month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });

export function LiveLot({ initial, signedIn }: { initial: Lot; signedIn: boolean }) {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const [lot, setLot] = useState<Lot>(initial);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejection, setRejection] = useState<Rejection>(null);
  const [connected, setConnected] = useState(true);
  const now = useServerNow(200, Date.parse(initial.server_now));
  const seenBids = useRef<Set<string> | null>(null);

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.rpc('get_bid_history', { p_auction_id: initial.id, p_limit: 10 });
    if (data) setHistory(data as HistoryRow[]);
  }, [supabase, initial.id]);

  const refetch = useCallback(async () => {
    const { data } = await supabase.rpc('get_lot', { p_auction_id: initial.id });
    if (data) {
      const fresh = data as unknown as Lot;
      noteServerNow(fresh.server_now);
      setLot(fresh);
    }
    void loadHistory();
  }, [supabase, initial.id, loadHistory]);

  // Realtime on auction:<id>. Refetch the row on (re)join, focus and reconnect.
  useEffect(() => {
    void refetch();
    let historyTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeTopic(
      supabase,
      `auction:${initial.id}`,
      {
        bid: (p) => {
          const payload = p as unknown as AuctionBroadcast;
          noteServerNow(payload.server_now);
          setLot((l) => applyBroadcast(l, payload));
          clearTimeout(historyTimer);
          historyTimer = setTimeout(() => void loadHistory(), 300);
        },
        closed: (p) => {
          setLot((l) => applyBroadcast(l, p as unknown as AuctionBroadcast));
          void refetch();
        },
      },
      (joined) => {
        setConnected(joined);
        if (joined) void refetch();
      },
    );
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncServerClock(supabase);
        void refetch();
      }
    };
    const onOnline = () => void refetch();
    const onOffline = () => setConnected(false);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearTimeout(historyTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsubscribe();
    };
  }, [supabase, initial.id, refetch, loadHistory]);

  // Past ends_at without a close event yet: resync until the close lands.
  const phase = lotPhase(lot.starts_at, lot.ends_at, lot.closed_at, now);
  const awaitingClose = phase === 'ended' && !lot.closed_at;
  useEffect(() => {
    if (!awaitingClose) return;
    const id = setInterval(() => void refetch(), 4000);
    return () => clearInterval(id);
  }, [awaitingClose, refetch]);

  // New history rows slide in; the first load doesn't animate.
  const keyOf = (h: HistoryRow) => `${h.bidder_no}-${h.amount}`;
  const animateKeys = new Set<string>();
  if (seenBids.current) for (const h of history) if (!seenBids.current.has(keyOf(h))) animateKeys.add(keyOf(h));
  useEffect(() => {
    seenBids.current = new Set(history.map(keyOf));
  }, [history]);

  // Why the bid button can't be used right now (one line), or null.
  const disabledReason = (() => {
    if (lot.outcome === 'cancelled') return 'The seller withdrew this lot';
    if (phase === 'ended') return 'Bidding has ended';
    if (phase === 'upcoming') return `Bidding opens ${formatLagosTime(lot.starts_at)}`;
    if (!connected) return 'Reconnecting…';
    if (!signedIn) return null; // tapping opens Verify phone
    if (!lot.my_verified) return null;
    if (lot.is_seller) return "This is your lot, so you can't bid";
    if (lot.my_suspended) return 'Bidding is paused on your account until review';
    if (lot.you_are_leading) return "You're the highest bidder";
    return null;
  })();
  const canBid = disabledReason === null && signedIn && lot.my_verified;

  async function placeBid(amount: number) {
    setBusy(true);
    const { data, error } = await supabase.rpc('place_bid', { p_auction_id: lot.id, p_amount: amount });
    setBusy(false);
    if (error || !data) {
      setSheetOpen(true);
      setRejection({ key: Date.now(), message: messageFor(error?.message) });
      return;
    }
    const r = data as Record<string, unknown>;
    noteServerNow(r.server_now as string);
    if (r.ok) {
      setSheetOpen(false);
      setRejection(null);
      setLot((l) => ({
        ...l,
        current_bid: r.current_bid as number,
        min_next: r.min_next as number,
        bid_count: Math.max(l.bid_count, r.bid_count as number),
        ends_at: r.ends_at as string,
        my_bidder_no: r.bidder_no as number,
        leader_no: r.bidder_no as number,
        you_are_leading: true,
        my_max_bid: amount,
      }));
      void loadHistory();
      return;
    }
    // Rejected: reason + new minimum prefilled (sheet shakes once).
    if (typeof r.min_next === 'number') {
      setLot((l) => ({ ...l, min_next: r.min_next as number, current_bid: (r.current_bid as number | null) ?? l.current_bid }));
    }
    const message = r.reason === 'too_low' && typeof r.current_bid === 'number'
      ? `Someone bid ${formatNaira(r.current_bid)} first. New minimum ${formatNaira(r.min_next as number)}.`
      : messageFor(r.reason as string);
    setSheetOpen(true);
    setRejection({ key: Date.now(), message });
    if (r.reason === 'ended' || r.reason === 'already_leading' || r.reason === 'suspended') void refetch();
  }

  function onBidTap() {
    if (!signedIn || !lot.my_verified) return setVerifyOpen(true);
    setRejection(null);
    setSheetOpen(true);
  }

  const ended = phase === 'ended';
  const priceLabel = lot.outcome === 'cancelled'
    ? 'Withdrawn'
    : ended
      ? (lot.current_bid ? 'Sold for' : 'Unsold')
      : lot.current_bid ? `Current bid · ${lot.bid_count} bid${lot.bid_count === 1 ? '' : 's'}` : 'Opening bid';

  return (
    <div className="mx-auto max-w-lot space-y-4">
      <PhotoGallery photos={lot.photos} title={lot.title} />

      <StatusBanner lot={lot} now={now} canBid={canBid} busy={busy} onQuickBid={(a) => void placeBid(a)} />

      {/* The clock is the hero: price and time left are the biggest things on screen. */}
      <div className="flex items-end justify-between gap-4 rounded-card bg-surface p-4 shadow-elev">
        <div className="min-w-0">
          <p className="text-eyebrow uppercase text-ink-muted">{priceLabel}</p>
          {lot.outcome === 'cancelled' || (ended && !lot.current_bid)
            ? <Price kobo={lot.start_price} className="text-price-lot text-ended" />
            : <LivePrice kobo={lot.current_bid ?? lot.start_price} className="text-price-lot" />}
          {lot.leader_no && !ended && (
            <p className="text-body text-ink-muted">{lot.you_are_leading ? 'You' : `Bidder ${lot.leader_no}`}</p>
          )}
        </div>
        <div className="flex min-h-20 flex-col items-end justify-end text-right">
          {phase === 'live' && <p className="text-eyebrow uppercase text-ink-muted">Time left</p>}
          <Countdown startsAt={lot.starts_at} endsAt={lot.ends_at} closedAt={lot.closed_at} now={now}
            stale={!connected} announce />
        </div>
      </div>
      {phase === 'live' && <p className="-mt-2 text-body text-ink-muted">A bid in the last 30 seconds adds 30 seconds.</p>}
      {awaitingClose && <p className="text-body text-ink-muted">Confirming the final bid…</p>}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {phase === 'live' && <Badge kind="live" />}
          {phase === 'upcoming' && <Badge kind="upcoming" />}
          {ended && (lot.current_bid ? <Badge kind="ended" /> : <Badge kind="unsold" />)}
          {!connected && (
            <span className="inline-flex items-center gap-1 rounded-pill border border-line bg-surface px-2 py-0.5 text-[12px] font-semibold text-ink-muted">
              <Wifi {...iconProps} size={12} /> Reconnecting…
            </span>
          )}
        </div>
        <h1 className="font-display text-heading">{lot.title}</h1>
        <div className="flex flex-wrap gap-1">
          <Pill>{lot.area}</Pill>
          <Pill>{conditionLabel(lot.condition)}</Pill>
          <Pill>{lot.category}</Pill>
        </div>
        <div className="text-body text-ink-muted">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">Sold by {lot.seller_name}</span>
            {lot.seller_verified && (
              <span className="inline-flex items-center gap-1">
                <BadgeCheck {...iconProps} size={16} className="text-focus" /> Verified phone
              </span>
            )}
          </p>
          {lot.seller_since && <p>Member since {memberSince.format(new Date(lot.seller_since))}</p>}
        </div>
      </div>

      {lot.description && (
        <section>
          <h2 className="text-eyebrow uppercase text-ink-muted">Description</h2>
          <p className="mt-1 whitespace-pre-line">{lot.description}</p>
        </section>
      )}

      <section>
        <h2 className="text-eyebrow uppercase text-ink-muted">Bids</h2>
        {history.length === 0 ? (
          <p className="mt-1 text-ink-muted">No bids yet. Opening bid is {formatNaira(lot.start_price)}.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
            {history.map((h) => (
              <li key={keyOf(h)} className={`flex justify-between px-3 py-2 ${animateKeys.has(keyOf(h)) ? 'slide-in-top' : ''}`}>
                <span className={h.is_me ? 'font-semibold' : ''}>{h.is_me ? 'You' : `Bidder ${h.bidder_no}`}</span>
                <span className="text-ink-muted">
                  <span className="font-num tabular-nums text-ink">{formatNaira(h.amount)}</span> · {formatLagosTime(h.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-body text-ink-muted">Minimum step {formatNaira(lot.step)}. Pickup in {lot.area}.</p>
      </section>

      {/* Sticky bid bar: current price left, Bid ₦X right. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lot items-center gap-3 px-4 py-2">
          <div className="min-w-0">
            <p className="text-eyebrow uppercase text-ink-muted">{lot.current_bid ? 'Current' : 'Opening'}</p>
            <Price kobo={lot.current_bid ?? lot.start_price} className="text-price-card" />
          </div>
          <div className="ml-auto flex min-w-0 flex-col items-end">
            <Button variant="live" tall className="min-w-[160px]" onClick={onBidTap}
              disabled={disabledReason !== null} busy={busy && !sheetOpen}>
              Bid {formatNaira(lot.min_next)}
            </Button>
          </div>
        </div>
        {disabledReason && <p className="mx-auto max-w-lot px-4 pb-2 text-right text-body text-ink-muted">{disabledReason}</p>}
      </div>

      <BidSheet open={sheetOpen} minNext={lot.min_next} step={lot.step} busy={busy} rejection={rejection}
        onClose={() => setSheetOpen(false)} onConfirm={(a) => void placeBid(a)} />

      <Sheet open={verifyOpen} onClose={() => setVerifyOpen(false)} title="Verify your phone to bid">
        <p className="mb-3 text-body text-ink-muted">Only verified numbers can bid. It takes a minute.</p>
        <PhoneVerify onDone={() => {
          setVerifyOpen(false);
          router.refresh();
          void refetch();
        }} />
      </Sheet>
    </div>
  );
}
