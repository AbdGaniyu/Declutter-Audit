'use client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Supa } from '@/lib/supabase/client';

/**
 * Subscribe to a private Broadcast topic (auction:<id> or user:<id>).
 * Calls `onStatus(true)` once joined and `onStatus(false)` on errors/timeouts,
 * so callers can refetch on reconnect: mobile data drops often.
 */
export async function subscribeTopic(
  supabase: Supa,
  topic: string,
  handlers: Record<string, (payload: Record<string, unknown>) => void>,
  onStatus?: (joined: boolean) => void,
): Promise<RealtimeChannel> {
  await supabase.realtime.setAuth();
  const channel = supabase.channel(topic, { config: { private: true } });
  for (const [event, fn] of Object.entries(handlers)) {
    channel.on('broadcast', { event }, (msg) => fn((msg.payload ?? {}) as Record<string, unknown>));
  }
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') onStatus?.(true);
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') onStatus?.(false);
  });
  return channel;
}
