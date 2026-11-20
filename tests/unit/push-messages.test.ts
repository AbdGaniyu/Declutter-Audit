import { describe, expect, it } from 'vitest';
import { pushMessage } from '@/supabase/functions/_shared/push-messages';

describe('pushMessage', () => {
  it('writes outbid copy with the new price', () => {
    const m = pushMessage({ id: 'n', type: 'outbid', payload: { auction_id: 'a1', title: 'Fan', current_bid: 1_550_000 } });
    expect(m.title).toBe("You've been outbid");
    expect(m.body).toContain('₦15,500');
    expect(m.url).toBe('/lot/a1');
  });
  it('tells winners the pay-by time in Lagos', () => {
    const m = pushMessage({ id: 'n', type: 'won', payload: { order_id: 'o1', title: 'Fan', amount: 2_500_000, pay_by: '2026-11-19T18:42:00Z' } });
    expect(m.body).toContain('Pay by 7:42pm');
    expect(m.url).toBe('/me/orders/o1');
  });
});
