import { formatLagosTime } from '@/lib/time';

const MAX_AREAS = 4;
export const ENDING_SOON_FILTER_MS = 10 * 60_000;

/** "Yaba, Surulere, Ikeja and Lekki"; past four: "…, D and 2 more areas". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length > MAX_AREAS) {
    return `${items.slice(0, MAX_AREAS).join(', ')} and ${items.length - MAX_AREAS} more areas`;
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function every(seconds: number): string {
  if (seconds === 60) return 'every minute';
  if (seconds % 60 === 0) return `every ${seconds / 60} minutes`;
  return `every ${seconds} seconds`;
}

/** The drop hero's line: lots, areas, close rhythm, last close. */
export function dropLine(d: { lot_count: number; areas: string[]; close_interval_seconds: number; last_close_at: string }): string {
  if (d.lot_count === 0) return 'No lots yet. List something and it goes live with the drop.';
  const from = d.areas.length ? ` from ${joinList(d.areas)}` : '';
  const end = formatLagosTime(d.last_close_at);
  if (d.lot_count === 1) return `1 lot${from}. It closes at ${end}.`;
  return `${d.lot_count} lots${from}. One closes ${every(d.close_interval_seconds)} until ${end}.`;
}

/** "Mustard armchair, solid wood legs" → "Mustard armchair" (for "Next to close · …"). */
export function shortTitle(title: string): string {
  return title.split(',')[0]!.trim();
}

export function isEndingSoon(lot: { starts_at: string; ends_at: string; closed_at: string | null }, now: number): boolean {
  if (lot.closed_at) return false;
  const left = Date.parse(lot.ends_at) - now;
  return Date.parse(lot.starts_at) <= now && left > 0 && left <= ENDING_SOON_FILTER_MS;
}
