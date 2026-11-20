'use client';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { iconProps } from '@/components/icons';
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
    const unsubscribe = subscribeTopic(
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
      unsubscribe();
    };
  }, [userId]);

  return (
    <Link href="/me/notifications" className="relative inline-flex h-11 w-11 items-center justify-center rounded-pill text-ink"
      aria-label={`Notifications (${unread} unread)`}>
      <Bell {...iconProps} size={20} />
      {unread > 0 && (
        <span className="absolute right-1 top-1 min-w-4 rounded-pill bg-ink px-1 text-center font-num text-[11px] leading-4 text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
