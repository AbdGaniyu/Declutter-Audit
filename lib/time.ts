// The DB stores UTC. Everything shown to people is Africa/Lagos.
export const LAGOS_TZ = 'Africa/Lagos';

const timeFmt = new Intl.DateTimeFormat('en-NG', {
  timeZone: LAGOS_TZ,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const dayFmt = new Intl.DateTimeFormat('en-NG', {
  timeZone: LAGOS_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: LAGOS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "7:42pm" */
export function formatLagosTime(d: Date | string | number): string {
  return timeFmt.format(new Date(d)).replace(/\s/g, '').toLowerCase();
}

/** "Today 7:42pm", "Tomorrow 7:00pm" or "Fri 21 Nov 7:00pm" (relative to `now`). */
export function formatLagosDateTime(d: Date | string | number, now: number = Date.now()): string {
  const date = new Date(d);
  const key = dayKeyFmt.format(date);
  const todayKey = dayKeyFmt.format(new Date(now));
  const tomorrowKey = dayKeyFmt.format(new Date(now + 86_400_000));
  const prefix = key === todayKey ? 'Today' : key === tomorrowKey ? 'Tomorrow' : dayFmt.format(date);
  return `${prefix} ${formatLagosTime(date)}`;
}

/** Countdown text from milliseconds remaining: "4:05", "1:02:09", "0:00". */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}`;
  return `${m}:${ss}`;
}

export type LotPhase = 'upcoming' | 'live' | 'ended';

/** Time is the state: live iff starts_at <= now < ends_at. `now` must be server-synced. */
export function lotPhase(startsAt: string, endsAt: string, closedAt: string | null, now: number): LotPhase {
  if (closedAt) return 'ended';
  if (now < Date.parse(startsAt)) return 'upcoming';
  if (now < Date.parse(endsAt)) return 'live';
  return 'ended';
}

/** "2h 14m", "14m", "45s": for "Opens in …". */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

const goLiveFmt = new Intl.DateTimeFormat('en-NG', { timeZone: LAGOS_TZ, weekday: 'short' });
/** "Fri 7pm" or "Fri 7:30pm": for "Your lot goes live …". */
export function formatGoLive(d: Date | string | number): string {
  const t = formatLagosTime(d).replace(':00', '');
  return `${goLiveFmt.format(new Date(d))} ${t}`;
}
