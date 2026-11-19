// Sends web push for notifications. Called by Postgres (pg_net) on insert, and
// by cron as a fallback drain. Notifications are claimed atomically, so each
// is pushed at most once even if this runs concurrently.
import webpush from 'npm:web-push@3.6.7';
import { env } from '../_shared/env.ts';
import { json } from '../_shared/http.ts';
import { pushMessage } from '../_shared/push-messages.ts';
import { isInternal, serviceClient } from '../_shared/supabase.ts';

webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!isInternal(req)) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const supabase = serviceClient();
  const { data: rows, error } = await supabase.rpc('claim_push_notifications', {
    p_notification_id: body.notification_id ?? null,
    p_limit: 100,
  });
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  let pruned = 0;
  for (const n of rows ?? []) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, keys')
      .eq('user_id', n.user_id);
    const message = JSON.stringify(pushMessage(n));
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, message, { TTL: 600, urgency: 'high' });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id);
          pruned++;
        } else {
          console.error('push failed', status, (e as Error).message);
        }
      }
    }
  }
  return json({ claimed: rows?.length ?? 0, sent, pruned });
});
