import { describe, expect, it } from 'vitest';
import { chipAmounts } from '@/lib/bidding';
import { ARM_AT, SLOP_PX, isDragging, releaseOutcome, slideProgress } from '@/lib/slide';

describe('slide to bid gesture (DESIGN.md › Slide to bid)', () => {
  it('ignores movement under the 10px slop', () => {
    expect(SLOP_PX).toBe(10);
    expect(isDragging(9)).toBe(false);
    expect(isDragging(10)).toBe(true);
    expect(isDragging(-12)).toBe(true);
  });

  it('tracks 1:1 inside the track', () => {
    expect(slideProgress(150, 300)).toBeCloseTo(0.5);
  });

  it('rubber-bands past both ends, bounded and monotonic', () => {
    const past = [310, 400, 1000, 10_000].map((dx) => slideProgress(dx, 300));
    past.forEach((p, i) => {
      expect(p).toBeGreaterThan(1);
      expect(p).toBeLessThan(1.2);
      if (i > 0) expect(p).toBeGreaterThan(past[i - 1]!);
    });
    expect(slideProgress(-200, 300)).toBeLessThan(0);
    expect(slideProgress(-200, 300)).toBeGreaterThan(-0.2);
  });

  it('arms at 85%', () => {
    expect(ARM_AT).toBe(0.85);
    expect(releaseOutcome({ progress: 0.86, velocity: 0, trackWidth: 300 })).toBe('bid');
    expect(releaseOutcome({ progress: 0.84, velocity: 0, trackWidth: 300 })).toBe('home');
  });

  it('a flick that would carry past the end also bids', () => {
    // 0.5 + projected travel of a fast flick (px/ms) passes the end.
    expect(releaseOutcome({ progress: 0.5, velocity: 1.2, trackWidth: 300 })).toBe('bid');
    // The same position with a slow drift springs home.
    expect(releaseOutcome({ progress: 0.5, velocity: 0.05, trackWidth: 300 })).toBe('home');
    // A flick backwards never bids.
    expect(releaseOutcome({ progress: 0.8, velocity: -2, trackWidth: 300 })).toBe('home');
  });
});

describe('quick bid chips: +1 / +2 / +5 steps', () => {
  it('with bids: increments over the current bid, first chip = min_next', () => {
    const chips = chipAmounts({ current_bid: 4_550_000, start_price: 3_800_000, step: 50_000, min_next: 4_600_000 });
    expect(chips.map((c) => c.total)).toEqual([4_600_000, 4_650_000, 4_800_000]);
    expect(chips.map((c) => c.increment)).toEqual([50_000, 100_000, 250_000]);
    expect(chips[0]!.opening).toBe(false);
  });

  it('with no bids: the first chip is the opening bid', () => {
    const chips = chipAmounts({ current_bid: null, start_price: 3_800_000, step: 100_000, min_next: 3_800_000 });
    expect(chips[0]).toMatchObject({ opening: true, total: 3_800_000, increment: 0 });
    expect(chips.map((c) => c.total)).toEqual([3_800_000, 4_000_000, 4_300_000]);
  });

  it('uses the lot\'s own stored step (₦200 tier)', () => {
    const chips = chipAmounts({ current_bid: 700_000, start_price: 700_000, step: 20_000, min_next: 720_000 });
    expect(chips.map((c) => c.total)).toEqual([720_000, 740_000, 800_000]);
  });
});
