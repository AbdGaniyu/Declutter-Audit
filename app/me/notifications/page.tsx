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
    <div className="space-y-4">
      <MarkRead />
      <h1 className="text-title">Notifications</h1>
      {!rows?.length ? (
        <p className="text-muted">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {rows.map((n) => {
            const m = pushMessage({ id: n.id, type: n.type, payload: (n.payload ?? {}) as Record<string, unknown> });
            return (
              <li key={n.id}>
                <Link href={m.url} className="block px-4 py-3">
                  <p className={`font-semibold ${n.read_at ? '' : 'text-brand'}`}>{m.title}</p>
                  <p className="text-small">{m.body}</p>
                  <p className="text-small text-muted">{formatLagosDateTime(n.created_at, now)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
