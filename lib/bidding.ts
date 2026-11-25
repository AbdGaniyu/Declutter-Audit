// Quick bid chips (DESIGN.md › Quick bid chips): +1, +2 and +5 of the lot's stored step.
// Display only: place_bid re-validates every amount in Postgres.

export type ChipLot = { current_bid: number | null; start_price: number; step: number; min_next: number };

export type BidChip = {
  /** Amount over the price currently shown (0 for the opening chip). */
  increment: number;
  /** What a bid with this chip offers, in kobo. */
  total: number;
  /** No bids yet: this chip is the opening bid at the asking price. */
  opening: boolean;
};

export const CHIP_STEPS = [1, 2, 5] as const;

export function chipAmounts(lot: ChipLot): BidChip[] {
  if (lot.current_bid === null) {
    return CHIP_STEPS.map((n, i) => {
      const increment = i === 0 ? 0 : n * lot.step;
      return { increment, total: lot.start_price + increment, opening: i === 0 };
    });
  }
  const base = lot.current_bid;
  return CHIP_STEPS.map((n, i) => ({
    increment: n * lot.step,
    // The first chip is exactly the server's minimum next bid.
    total: i === 0 ? lot.min_next : base + n * lot.step,
    opening: false,
  }));
}
