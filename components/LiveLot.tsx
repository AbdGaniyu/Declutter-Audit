'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BidPanel, type HistoryRow } from '@/components/BidPanel';
import { GroupedList, GroupedRow, TrustCard } from '@/components/GroupedList';
import { SellerRow } from '@/components/LotCard';
import { PhoneVerify } from '@/components/PhoneVerify';
import { PhotoGallery } from '@/components/PhotoGallery';
import { Price } from '@/components/Price';
import { Sheet } from '@/components/Sheet';
import { TopBarBack } from '@/components/TopBarContext';
import { conditionLabel } from '@/lib/areas';
import { messageFor } from '@/lib/errors';
import { applyBroadcast, type AuctionBroadcast, type Lot } from '@/lib/lot';
import { formatNaira } from '@/lib/money';
import { subscribeTopic } from '@/lib/realtime';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { lotPhase } from '@/lib/time';
import { noteServerNow, syncServerClock, useServerNow } from '@/lib/time-sync';

/** DESIGN.md › Key screens › Lot page (PDF p.2 desktop, p.4 mobile). */
export function LiveLot({ initial, signedIn, preferAmount = null }: { initial: Lot; signedIn: boolean; preferAmount?: number | null }) {
  const supabase = getBrowserSupabase();
  const router = useRouter();
  const [lot, setLot] = useState<Lot>(initial);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejection, setRejection] = useState<{ key: number; message: string } | null>(null);
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
          setRejection(null);
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

  async function placeBid(amount: number) {
    setBusy(true);
    setRejection(null);
    const { data, error } = await supabase.rpc('place_bid', { p_auction_id: lot.id, p_amount: amount });
    setBusy(false);
    if (error || !data) {
      setRejection({ key: Date.now(), message: messageFor(error?.message) });
      return;
    }
    const r = data as Record<string, unknown>;
    noteServerNow(r.server_now as string);
    if (r.ok) {
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
    // Rejected: say why, and the slider resets to the new minimum.
    if (typeof r.min_next === 'number') {
      setLot((l) => ({ ...l, min_next: r.min_next as number, current_bid: (r.current_bid as number | null) ?? l.current_bid }));
    }
    const message = r.reason === 'too_low' && typeof r.current_bid === 'number'
      ? `Someone bid ${formatNaira(r.current_bid)} first. Slide again for ${formatNaira(r.min_next as number)}.`
      : messageFor(r.reason as string);
    setRejection({ key: Date.now(), message });
    if (r.reason === 'ended' || r.reason === 'already_leading' || r.reason === 'suspended') void refetch();
  }

  const lotNo = String(lot.lot_no).padStart(2, '0');

  return (
    <>
      <TopBarBack href="/" label={lot.drop_title} />
      <div className="pb-[300px] md:grid md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:items-start md:gap-8 md:pb-0 lg:gap-10">
        <div className="space-y-6 md:space-y-8">
          <PhotoGallery photos={lot.photos} title={lot.title} />

          {/* Mobile header; desktop shows it in the panel. */}
          <header className="md:hidden">
            <p className="text-eyebrow uppercase text-secondary">Lot <span className="tnum">{lotNo}</span> · {lot.drop_title}</p>
            <h1 className="mt-1 text-title-sm">{lot.title}</h1>
            <p className="mt-1 text-subhead text-secondary">{lot.area} · {conditionLabel(lot.condition)} · Sold by {lot.seller_name}</p>
          </header>

          {awaitingClose && <p className="text-subhead text-secondary" role="status">Confirming the final bid…</p>}

          <section>
            <h2 className="text-title-sm">About this lot</h2>
            {lot.description
              ? <p className="mt-2 whitespace-pre-line text-body">{lot.description}</p>
              : <p className="mt-2 text-body text-secondary">The seller didn&apos;t add a description. Check the photos.</p>}
          </section>

          <GroupedList>
            <GroupedRow label="Condition">{conditionLabel(lot.condition)}</GroupedRow>
            <GroupedRow label="Pickup">{lot.area}</GroupedRow>
            <GroupedRow label="Starting bid"><Price kobo={lot.start_price} /></GroupedRow>
            <GroupedRow label="Bids go up in"><Price kobo={lot.step} /></GroupedRow>
            <GroupedRow label="Lot"><span className="tnum">{lotNo} of {lot.drop_lot_count}</span></GroupedRow>
          </GroupedList>

          <SellerRow name={lot.seller_name} verified={lot.seller_verified} since={lot.seller_since} />

          <TrustCard>
            Pay in the app. {lot.seller_name} only gets paid when you hand over your 6-digit code at pickup.
          </TrustCard>
        </div>

        <BidPanel lot={lot} now={now} connected={connected} signedIn={signedIn} busy={busy} rejection={rejection}
          history={history} animateKeys={animateKeys} preferAmount={preferAmount}
          onBid={(a) => void placeBid(a)} onNeedVerify={() => setVerifyOpen(true)} />
      </div>

      <Sheet open={verifyOpen} onClose={() => setVerifyOpen(false)} title="Verify your phone to bid">
        <p className="mb-4 text-body text-secondary">Only verified numbers can bid. It takes a minute.</p>
        <PhoneVerify onDone={() => {
          setVerifyOpen(false);
          router.refresh();
          void refetch();
        }} />
      </Sheet>
    </>
  );
}
