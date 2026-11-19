'use client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Supa } from '@/lib/supabase/client';

type Listener = (payload: Record<string, unknown>) => void;
type StatusListener = (joined: boolean) => void;

type Entry = {
  channel: RealtimeChannel;
  listeners: Map<string, Set<Listener>>;
  statusListeners: Set<StatusListener>;
  refs: number;
  joined: boolean;
  removeTimer?: ReturnType<typeof setTimeout>;
};

// supabase-js returns the SAME channel object for the same topic, and removal is
// async. A ref-counted registry keeps one channel per topic, so remounts (React
// StrictMode, route changes) never tear down a channel someone still uses.
const registry = new Map<string, Entry>();

function createEntry(supabase: Supa, topic: string): Entry {
  const channel = supabase.channel(topic, { config: { private: true } });
  const entry: Entry = { channel, listeners: new Map(), statusListeners: new Set(), refs: 0, joined: false };
  channel.on('broadcast', { event: '*' }, (msg) => {
    const set = entry.listeners.get(msg.event);
    const payload = (msg.payload ?? {}) as Record<string, unknown>;
    set?.forEach((fn) => fn(payload));
  });
  // Private channels authorize with the user's JWT (or the anon key).
  void supabase.realtime.setAuth().then(() => {
    channel.subscribe((status) => {
      const joined = status === 'SUBSCRIBED';
      if (joined || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        entry.joined = joined;
        entry.statusListeners.forEach((fn) => fn(joined));
      }
    });
  });
  return entry;
}

/**
 * Subscribe to a private Broadcast topic (auction:<id> or user:<id>).
 * `onStatus(true)` fires on every (re)join, so callers can refetch: mobile data
 * drops often. Returns an unsubscribe function.
 */
export function subscribeTopic(
  supabase: Supa,
  topic: string,
  handlers: Record<string, Listener>,
  onStatus?: StatusListener,
): () => void {
  let entry = registry.get(topic);
  if (!entry) {
    entry = createEntry(supabase, topic);
    registry.set(topic, entry);
  }
  const e = entry;
  clearTimeout(e.removeTimer);
  e.refs++;

  for (const [event, fn] of Object.entries(handlers)) {
    if (!e.listeners.has(event)) e.listeners.set(event, new Set());
    e.listeners.get(event)!.add(fn);
  }
  if (onStatus) {
    e.statusListeners.add(onStatus);
    if (e.joined) queueMicrotask(() => onStatus(true));
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const [event, fn] of Object.entries(handlers)) e.listeners.get(event)?.delete(fn);
    if (onStatus) e.statusListeners.delete(onStatus);
    e.refs--;
    if (e.refs === 0) {
      e.removeTimer = setTimeout(() => {
        if (e.refs === 0 && registry.get(topic) === e) {
          registry.delete(topic);
          void supabase.removeChannel(e.channel);
        }
      }, 1000);
    }
  };
}
