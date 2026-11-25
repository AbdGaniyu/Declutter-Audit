import { describe, expect, it } from 'vitest';
import { applyBroadcast, type Lot } from '@/lib/lot';

const base: Lot = {
  id: 'a', drop_id: 'd', drop_title: 'Drop', drop_number: 14, lot_no: 7, drop_lot_count: 38, title: 'Fan', description: '', condition: 'good',
  category: 'Home', area: 'Yaba', start_price: 1_500_000, step: 50_000, current_bid: 1_500_000,
  bid_count: 1, min_next: 1_550_000, starts_at: '2026-11-19T18:00:00Z', ends_at: '2026-11-19T18:30:00Z',
  closed_at: null, outcome: null, leader_no: 1, seller_name: 'Ada', seller_verified: true, seller_since: null, is_seller: false,
  my_suspended: false, my_verified: true, my_order: null,
  my_bidder_no: 1, you_are_leading: true, my_max_bid: 1_500_000, photos: [], server_now: '',
};

describe('applyBroadcast', () => {
  it('updates bid, min_next and leader status', () => {
    const next = applyBroadcast(base, {
      id: 'a', current_bid: 1_600_000, leader_no: 2, bid_count: 2,
      ends_at: '2026-11-19T18:30:10Z', closed_at: null, outcome: null, server_now: '',
    });
    expect(next.current_bid).toBe(1_600_000);
    expect(next.min_next).toBe(1_650_000);
    expect(next.you_are_leading).toBe(false);
    expect(next.ends_at).toBe('2026-11-19T18:30:10Z');
  });
  it('ignores stale bid events', () => {
    const lot = { ...base, bid_count: 5, current_bid: 2_000_000 };
    const next = applyBroadcast(lot, {
      id: 'a', current_bid: 1_600_000, leader_no: 2, bid_count: 2,
      ends_at: base.ends_at, closed_at: null, outcome: null, server_now: '',
    });
    expect(next).toBe(lot);
  });
  it('always applies a close', () => {
    const next = applyBroadcast(base, {
      id: 'a', current_bid: 1_500_000, leader_no: 1, bid_count: 1,
      ends_at: base.ends_at, closed_at: '2026-11-19T18:30:02Z', outcome: 'sold', server_now: '',
    });
    expect(next.outcome).toBe('sold');
    expect(next.you_are_leading).toBe(true);
  });
});
