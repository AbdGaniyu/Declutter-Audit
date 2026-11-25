import { describe, expect, it } from 'vitest';
import { formatClock, formatCountdown, formatLagosDateTime, formatLagosTime, lotPhase } from '@/lib/time';

describe('Lagos time formatting', () => {
  it('formats UTC as Lagos (UTC+1) 12-hour time', () => {
    expect(formatLagosTime('2026-11-19T18:42:00Z')).toBe('7:42pm');
    expect(formatLagosTime('2026-11-19T23:30:00Z')).toBe('12:30am');
  });
  it('labels today and tomorrow in Lagos', () => {
    const now = Date.parse('2026-11-19T10:00:00Z');
    expect(formatLagosDateTime('2026-11-19T18:00:00Z', now)).toBe('Today 7:00pm');
    expect(formatLagosDateTime('2026-11-20T18:00:00Z', now)).toBe('Tomorrow 7:00pm');
  });
});

describe('formatCountdown', () => {
  it('formats remaining time', () => {
    expect(formatCountdown(65_000)).toBe('1:05');
    expect(formatCountdown(3_725_000)).toBe('1:02:05');
    expect(formatCountdown(-5)).toBe('0:00');
    expect(formatCountdown(400)).toBe('0:01');
  });
});

describe('lotPhase', () => {
  const s = '2026-11-19T18:00:00Z';
  const e = '2026-11-19T18:30:00Z';
  it('is derived from time, not status', () => {
    expect(lotPhase(s, e, null, Date.parse('2026-11-19T17:59:59Z'))).toBe('upcoming');
    expect(lotPhase(s, e, null, Date.parse(s))).toBe('live');
    expect(lotPhase(s, e, null, Date.parse(e))).toBe('ended');
    expect(lotPhase(s, e, '2026-11-19T18:30:01Z', Date.parse(s))).toBe('ended');
  });
});

describe('formatClock (DESIGN.md v2 countdown)', () => {
  it('pads minutes above a minute, drops the pad in the last minute', () => {
    expect(formatClock(63_000)).toBe('01:03');
    expect(formatClock(190_000)).toBe('03:10');
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(42_000)).toBe('0:42');
    expect(formatClock(0)).toBe('0:00');
  });
  it('shows hours when needed', () => {
    expect(formatClock(3_723_000)).toBe('1:02:03');
  });
});
