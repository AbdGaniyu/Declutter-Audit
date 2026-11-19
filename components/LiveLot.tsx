'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/Badge';
import { BidSheet } from '@/components/BidSheet';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { PhotoGallery } from '@/components/PhotoGallery';
import { Price } from '@/components/Price';
import { conditionLabel } from '@/lib/areas';
import { messageFor } from '@/lib/errors';
import { applyBroadcast, type AuctionBroadcast, type Lot } from '@/lib/lot';
import { formatNaira } from '@/lib/money';
import { subscribeTopic } from '@/lib/realtime';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { formatLagosDateTime, formatLagosTime, lotPhase } from '@/lib/time';
import { noteServerNow, syncServerClock, useServerNow } from '@/lib/time-sync';

type HistoryRow = { bidder_no: number; amount: number; created_at: string; is_me: boolean };

export function LiveLot({ initial, signedIn }: { initial: Lot; signedIn: boolean }) {
  const supabase = getBrowserSupabase();
  const [lot, setLot] = useState<Lot>(initial);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const now = useServerNow(200, Date.parse(initial.server_now));
  const wasLeading = useRef(initial.you_are_leading);

  const refetch = useCallback(async () => {
    const [{ data }, { data: rows }] = await Promise.all([
      supabase.rpc('get_lot', { p_auction_id: initial.id }),
      supabase.rpc('get_bid_history', { p_auction_id: initial.id, p_limit: 10 }),
    ]);
    if (data) {
      const fresh = data as unknown as Lot;
      noteServerNow(fresh.server_now);
      setLot(fresh);
    }
    if (rows) setHistory(rows as HistoryRow[]);
  }, [supabase, initial.id]);

  // Realtime: auction:<id>. Refetch the row on (re)join, focus and reconnect.
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
          historyTimer = setTimeout(async () => {
            const { data } = await supabase.rpc('get_bid_history', { p_auction_id: initial.id, p_limit: 10 });
            if (data) setHistory(data as HistoryRow[]);
          }, 400);
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
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      clearTimeout(historyTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      unsubscribe();
    };
  }, [supabase, initial.id, refetch]);

  // "You've been outbid" in-page nudge.
  useEffect(() => {
    if (wasLeading.current && !lot.you_are_leading && !lot.closed_at) {
      setToast(`You've been outbid. New minimum ${formatNaira(lot.min_next)}.`);
    }
    wasLeading.current = lot.you_are_leading;
  }, [lot.you_are_leading, lot.closed_at, lot.min_next]);

  // Once the clock passes ends_at without a close event, resync after a moment.
  const phase = lotPhase(lot.starts_at, lot.ends_at, lot.closed_at, now);
  const awaitingClose = phase === 'ended' && !lot.closed_at;
  useEffect(() => {
    if (!awaitingClose) return;
    const id = setInterval(() => void refetch(), 4000);
    return () => clearInterval(id);
  }, [awaitingClose, refetch]);

  async function placeBid(amount: number) {
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('place_bid', { p_auction_id: lot.id, p_amount: amount });
    setBusy(false);
    if (rpcError || !data) {
      setError(messageFor(rpcError?.message));
      return;
    }
    const r = data as Record<string, unknown>;
    noteServerNow(r.server_now as string);
    if (r.ok) {
      setSheetOpen(false);
      setToast(null);
      wasLeading.current = true;
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
    } else {
      setError(messageFor(r.reason as string));
      if (typeof r.min_next === 'number') {
        setLot((l) => ({ ...l, min_next: r.min_next as number, current_bid: (r.current_bid as number) ?? l.current_bid }));
      }
      if (r.reason === 'ended' || r.reason === 'already_leading') void refetch();
    }
  }

  const leading = lot.you_are_leading;
  const outbid = !leading && lot.my_max_bid !== null;

  return (
    <div className="space-y-4 pb-24">
      <PhotoGallery photos={lot.photos} title={lot.title} />

      <div>
        <div className="flex flex-wrap items-center gap-2">
          {phase === 'live' && <Badge kind="live">Live</Badge>}
          {phase === 'upcoming' && <Badge kind="upcoming">Opens {formatLagosDateTime(lot.starts_at, now)}</Badge>}
          {lot.outcome === 'sold' && <Badge kind="sold">Sold</Badge>}
          {(lot.outcome === 'unsold' || lot.outcome === 'defaulted') && <Badge kind="unsold">Unsold</Badge>}
          {lot.outcome === 'cancelled' && <Badge kind="unsold">Withdrawn</Badge>}
          {!lot.closed_at && leading && <Badge kind="leading">You're winning</Badge>}
          {!lot.closed_at && outbid && <Badge kind="outbid">Outbid</Badge>}
          {!connected && <span className="text-small text-warn">Reconnecting…</span>}
        </div>
        <h1 className="mt-2 text-title">{lot.title}</h1>
        <p className="text-small text-muted">
          {lot.area} · {conditionLabel(lot.condition)} · {lot.category} · sold by {lot.seller_name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-card border border-line bg-surface p-4">
        <div>
          <p className="text-micro uppercase text-muted">
            {lot.current_bid ? `Current bid · ${lot.bid_count}` : 'Opening bid'}
          </p>
          <Price kobo={lot.current_bid ?? lot.start_price} className="text-display" />
          {lot.leader_no && !lot.closed_at && (
            <p className="text-small text-muted">{leading ? 'You' : `Bidder ${lot.leader_no}`}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-micro uppercase text-muted">
            {phase === 'upcoming' ? 'Closes at' : phase === 'live' ? 'Time left' : 'Closed'}
          </p>
          {phase === 'live' ? (
            <Countdown endsAt={lot.ends_at} now={now} className="text-display" />
          ) : (
            <p className="text-display tabular-nums">{formatLagosTime(lot.closed_at ?? lot.ends_at)}</p>
          )}
          {phase === 'live' && <p className="text-small text-muted">Bids in the last 30s add time</p>}
        </div>
      </div>

      {toast && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-card bg-danger p-3 text-small text-brand-ink">
          <span>{toast}</span>
          <button type="button" className="font-semibold" onClick={() => setToast(null)}>OK</button>
        </div>
      )}

      {lot.closed_at && (
        <div className="rounded-card border border-line bg-surface p-4">
          {lot.outcome === 'sold' && lot.you_are_leading && (
            <>
              <p className="text-title text-success">You won!</p>
              <p className="mt-1">Pay within 30 minutes to secure it.</p>
              <Link href="/me/orders" className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 font-semibold text-brand-ink">Pay now</Link>
            </>
          )}
          {lot.outcome === 'sold' && !lot.you_are_leading && <p>Sold for {formatNaira(lot.current_bid)}.</p>}
          {lot.outcome === 'unsold' && <p>No bids, so this lot didn't sell.</p>}
          {lot.outcome === 'cancelled' && <p>The seller withdrew this lot.</p>}
          {lot.outcome === 'defaulted' && <p>This sale fell through.</p>}
        </div>
      )}
      {awaitingClose && <p className="text-center text-small text-muted">Closing… confirming the final bid.</p>}

      {lot.description && (
        <section>
          <h2 className="text-small font-semibold">Description</h2>
          <p className="mt-1 whitespace-pre-line">{lot.description}</p>
        </section>
      )}

      <section>
        <h2 className="text-small font-semibold">Bids</h2>
        {history.length === 0 ? (
          <p className="mt-1 text-small text-muted">No bids yet. Opening bid is {formatNaira(lot.start_price)}.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line rounded-card border border-line bg-surface">
            {history.map((h) => (
              <li key={`${h.bidder_no}-${h.amount}`} className="flex justify-between px-3 py-2 text-small">
                <span>{h.is_me ? 'You' : `Bidder ${h.bidder_no}`}</span>
                <span className="tabular-nums">
                  {formatNaira(h.amount)} · {formatLagosTime(h.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-small text-muted">Minimum step {formatNaira(lot.step)}. Pickup in {lot.area}.</p>
      </section>

      {/* Sticky primary action */}
      {!lot.closed_at && phase !== 'ended' && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-3xl">
            {lot.is_seller ? (
              <p className="py-2 text-center text-small text-muted">This is your lot. You can't bid on it.</p>
            ) : !signedIn ? (
              <Link href={`/login?next=/lot/${lot.id}`} className="flex min-h-11 w-full items-center justify-center rounded-pill bg-brand font-semibold text-brand-ink">
                Sign in to bid
              </Link>
            ) : phase === 'upcoming' ? (
              <Button block disabled>Bidding opens {formatLagosTime(lot.starts_at)}</Button>
            ) : leading ? (
              <Button block variant="secondary" disabled>You're winning at {formatNaira(lot.current_bid)}</Button>
            ) : (
              <Button block onClick={() => { setError(null); setSheetOpen(true); }}>
                Place bid · {formatNaira(lot.min_next)}+
              </Button>
            )}
          </div>
        </div>
      )}

      <BidSheet open={sheetOpen} minNext={lot.min_next} step={lot.step} busy={busy} error={error}
        onClose={() => setSheetOpen(false)} onConfirm={placeBid} />
    </div>
  );
}
