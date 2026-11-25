import { describe, expect, it } from 'vitest';
import { dropLine, isEndingSoon, joinList, shortTitle } from '@/lib/drop';

describe('drop hero copy (DESIGN.md › Drop page)', () => {
  it('joins areas the way people say them', () => {
    expect(joinList(['Yaba'])).toBe('Yaba');
    expect(joinList(['Yaba', 'Lekki'])).toBe('Yaba and Lekki');
    expect(joinList(['Yaba', 'Surulere', 'Ikeja', 'Lekki'])).toBe('Yaba, Surulere, Ikeja and Lekki');
    expect(joinList(['A', 'B', 'C', 'D', 'E', 'F'])).toBe('A, B, C, D and 2 more areas');
  });

  it('builds the summary line', () => {
    // 21:00 Lagos = 20:00Z
    expect(dropLine({ lot_count: 38, areas: ['Yaba', 'Surulere', 'Ikeja', 'Lekki'], close_interval_seconds: 120,
      last_close_at: '2026-11-27T20:00:00Z' }))
      .toBe('38 lots from Yaba, Surulere, Ikeja and Lekki. One closes every 2 minutes until 9:00pm.');
    expect(dropLine({ lot_count: 12, areas: ['Yaba'], close_interval_seconds: 60, last_close_at: '2026-11-27T18:30:00Z' }))
      .toBe('12 lots from Yaba. One closes every minute until 7:30pm.');
    expect(dropLine({ lot_count: 1, areas: ['Yaba'], close_interval_seconds: 60, last_close_at: '2026-11-27T18:30:00Z' }))
      .toBe('1 lot from Yaba. It closes at 7:30pm.');
    expect(dropLine({ lot_count: 0, areas: [], close_interval_seconds: 60, last_close_at: '2026-11-27T18:30:00Z' }))
      .toBe('No lots yet. List something and it goes live with the drop.');
  });

  it('shortens a lot title to the part before the first comma', () => {
    expect(shortTitle('Mustard armchair, solid wood legs')).toBe('Mustard armchair');
    expect(shortTitle('26-inch road bicycle')).toBe('26-inch road bicycle');
  });

  it('flags lots that are live and close within 10 minutes', () => {
    const now = Date.parse('2026-11-27T18:00:00Z');
    const lot = (ends: string, closed: string | null = null) =>
      ({ starts_at: '2026-11-27T17:00:00Z', ends_at: ends, closed_at: closed });
    expect(isEndingSoon(lot('2026-11-27T18:09:00Z'), now)).toBe(true);
    expect(isEndingSoon(lot('2026-11-27T18:11:00Z'), now)).toBe(false);
    expect(isEndingSoon(lot('2026-11-27T17:59:00Z'), now)).toBe(false);
    expect(isEndingSoon(lot('2026-11-27T18:05:00Z', '2026-11-27T17:58:00Z'), now)).toBe(false);
  });
});
