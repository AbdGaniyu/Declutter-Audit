import Link from 'next/link';
import { MarkRead } from './MarkRead';
import { pushMessage } from '@/supabase/functions/_shared/push-messages';
import { getServerSupabase } from '@/lib/supabase/server';
import { formatLagosDateTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const supabase = await getServerSupabase();
  const { data: rows } = await supabase
    .from('notifications')
    .select('id, type, payload, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  const now = Date.now();

  return (
    <div className="mx-auto max-w-lot space-y-4">
      <MarkRead />
      <h1 className="font-display text-display">Notifications</h1>
      {!rows?.length ? (
        <p className="text-ink-muted">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-elev">
          {rows.map((n) => {
            const m = pushMessage({ id: n.id, type: n.type, payload: (n.payload ?? {}) as Record<string, unknown> });
            return (
              <li key={n.id}>
                <Link href={m.url} className="flex gap-3 px-4 py-3">
                  <span className={`mt-2 h-2 w-2 shrink-0 rounded-pill ${n.read_at ? 'bg-transparent' : 'bg-focus'}`} aria-label={n.read_at ? undefined : 'Unread'} />
                  <span>
                    <span className="block font-semibold">{m.title}</span>
                    <span className="block">{m.body}</span>
                    <span className="block text-body text-ink-muted">{formatLagosDateTime(n.created_at, now)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
