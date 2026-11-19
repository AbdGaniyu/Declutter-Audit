'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { subscribeTopic } from '@/lib/realtime';

export function NotificationBell({ userId }: { userId: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;
    const refresh = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null);
      if (!cancelled) setUnread(count ?? 0);
    };
    void refresh();
    const channelP = subscribeTopic(
      supabase,
      `user:${userId}`,
      { notification: () => setUnread((n) => n + 1) },
      (joined) => joined && void refresh(),
    );
    const onFocus = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onFocus);
      void channelP.then((c) => supabase.removeChannel(c));
    };
  }, [userId]);

  return (
    <Link href="/me/notifications" className="relative rounded-pill px-3 py-2 text-ink" aria-label={`Notifications (${unread} unread)`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute right-1 top-1 min-w-4 rounded-pill bg-danger px-1 text-center text-micro text-brand-ink">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
