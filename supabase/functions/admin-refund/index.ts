// POST /functions/v1/admin-refund { order_id }
// Admin-only: refund a paid or disputed order through Paystack, then mark it.
import { paystackClient } from '../_shared/deps.ts';
import { json, preflight } from '../_shared/http.ts';
import { PaystackError } from '../_shared/paystack.ts';
import { getUser, serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const user = await getUser(req);
  if (!user) return json({ error: 'not_authenticated' }, 401);

  const db = serviceClient();
  const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  if (!profile?.is_admin) return json({ error: 'forbidden' }, 403);

  const { order_id: orderId } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string') return json({ error: 'bad_request' }, 400);
  const { data: order } = await db.from('orders').select('id, status').eq('id', orderId).maybeSingle();
  if (!order) return json({ error: 'not_found' }, 404);
  if (order.status === 'refunded') return json({ status: 'refunded' });
  if (!['paid', 'disputed'].includes(order.status)) return json({ error: 'not_refundable' }, 409);

  try {
    await paystackClient().refund(order.id);
  } catch (e) {
    // Paystack rejects a second refund of the same transaction: treat as done.
    const msg = e instanceof PaystackError ? e.message : String(e);
    if (!/already.*refund|fully reversed/i.test(msg)) {
      console.error('refund failed', msg);
      return json({ error: 'payment_provider_error', detail: msg }, 502);
    }
  }
  const { error } = await db.rpc('mark_order_refunded', { p_order_id: order.id });
  if (error) return json({ error: 'server_error' }, 500);
  return json({ status: 'refunded' });
});
