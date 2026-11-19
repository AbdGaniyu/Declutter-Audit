// Shape returned by public.get_lot().
export type Lot = {
  id: string;
  drop_id: string;
  drop_title: string;
  title: string;
  description: string;
  condition: string;
  category: string;
  area: string;
  start_price: number;
  step: number;
  current_bid: number | null;
  bid_count: number;
  min_next: number;
  starts_at: string;
  ends_at: string;
  closed_at: string | null;
  outcome: 'sold' | 'unsold' | 'defaulted' | 'cancelled' | null;
  leader_no: number | null;
  seller_name: string;
  is_seller: boolean;
  my_bidder_no: number | null;
  you_are_leading: boolean;
  my_max_bid: number | null;
  photos: string[];
  server_now: string;
};

// Realtime payload on topic auction:<id>.
export type AuctionBroadcast = {
  id: string;
  current_bid: number | null;
  leader_no: number | null;
  bid_count: number;
  ends_at: string;
  closed_at: string | null;
  outcome: Lot['outcome'];
  server_now: string;
};

/** Merge a broadcast into the lot. Stale bid events (lower bid_count) are ignored. */
export function applyBroadcast(lot: Lot, p: AuctionBroadcast): Lot {
  if (p.bid_count < lot.bid_count && !p.closed_at) return lot;
  const next: Lot = {
    ...lot,
    current_bid: p.current_bid,
    leader_no: p.leader_no,
    bid_count: p.bid_count,
    ends_at: p.ends_at,
    closed_at: p.closed_at,
    outcome: p.outcome,
    min_next: p.current_bid === null ? lot.start_price : p.current_bid + lot.step,
  };
  next.you_are_leading = next.my_bidder_no !== null && next.leader_no === next.my_bidder_no;
  return next;
}
