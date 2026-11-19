// Money is integer kobo everywhere. Format to Naira only for display.
// ₦1 = 100 kobo.

const nairaFormatter = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });
const nairaFormatterKobo = new Intl.NumberFormat('en-NG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** The single money formatter. 2500000 → "₦25,000". Shows kobo only if non-zero. */
export function formatNaira(kobo: number | bigint | null | undefined): string {
  if (kobo === null || kobo === undefined) return '—';
  const k = typeof kobo === 'bigint' ? Number(kobo) : kobo;
  if (!Number.isFinite(k)) return '—';
  const sign = k < 0 ? '-' : '';
  const abs = Math.abs(k);
  const body = abs % 100 === 0 ? nairaFormatter.format(abs / 100) : nairaFormatterKobo.format(abs / 100);
  return `${sign}₦${body}`;
}

/**
 * Parse what a user typed ("25,000", "₦25000", "25000.00") into kobo.
 * Only whole naira are accepted (the DB rejects fractional naira anyway).
 * Returns null for anything that isn't a positive whole-naira amount.
 */
export function parseNairaInput(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, '').replace(/\.0+$/, '');
  if (!/^\d{1,9}$/.test(cleaned)) return null;
  const naira = Number(cleaned);
  if (naira <= 0) return null;
  return naira * 100;
}

/**
 * Display-only mirror of public.step_for(). The database decides the real step
 * (stored in auctions.step); this is only for previewing it in the listing form.
 */
export function previewStep(startPriceKobo: number): number {
  if (startPriceKobo < 2_000_000) return 50_000;
  if (startPriceKobo < 10_000_000) return 100_000;
  return 250_000;
}

export const MIN_START_PRICE_KOBO = 50_000; // ₦500
