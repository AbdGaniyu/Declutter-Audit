'use client';
// Server time is the only time. The UI counts down with Date.now() + offset, where
// offset is learned from the server (RPC round trips, plus server_now on broadcasts).
import { useEffect, useState } from 'react';
import type { Supa } from '@/lib/supabase/client';

let offsetMs = 0;
let bestRttMs = Number.POSITIVE_INFINITY;
let syncing: Promise<void> | null = null;
let lastSyncAt = 0;

export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function getOffset(): number {
  return offsetMs;
}

/**
 * Compute offset from an RPC round trip. Takes a few samples and keeps the one
 * with the smallest round trip (least network noise), using its midpoint.
 */
export function syncServerClock(supabase: Supa, samples = 3): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    bestRttMs = Number.POSITIVE_INFINITY;
    for (let i = 0; i < samples; i++) {
      const t0 = Date.now();
      const { data, error } = await supabase.rpc('server_time');
      const t1 = Date.now();
      if (error || !data) continue;
      const rtt = t1 - t0;
      if (rtt < bestRttMs) {
        bestRttMs = rtt;
        offsetMs = Date.parse(data as string) - (t0 + t1) / 2;
      }
    }
    lastSyncAt = Date.now();
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

/**
 * A server_now from a broadcast or RPC result: offset = server_now - Date.now().
 * Only used if we have no round-trip sample, since delivery delay biases it.
 */
export function noteServerNow(serverNowIso: string | null | undefined): void {
  if (!serverNowIso) return;
  if (bestRttMs === Number.POSITIVE_INFINITY) offsetMs = Date.parse(serverNowIso) - Date.now();
}

export function needsResync(maxAgeMs = 60_000): boolean {
  return Date.now() - lastSyncAt > maxAgeMs;
}

/** Re-renders every `tickMs` with the server-synced current time. */
export function useServerNow(tickMs = 250): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return now;
}
