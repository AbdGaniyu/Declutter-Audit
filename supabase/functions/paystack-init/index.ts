// POST /functions/v1/paystack-init  { order_id, action?: 'init' | 'verify' }
// init:   start (or resume) Paystack checkout for the caller's unpaid order.
// verify: after the redirect back, confirm with Paystack's API (a fallback in
//         case the webhook is slow). Both paths are idempotent.
import { paymentDeps, paystackClient } from '../_shared/deps.ts';
import { env, optionalEnv } from '../_shared/env.ts';
import { json, preflight } from '../_shared/http.ts';
import { settleCharge } from '../_shared/payments.ts';
import { PaystackError } from '../_shared/paystack.ts';
import { getUser, serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await getUser(req);
  if (!user) return json({ error: 'not_authenticated' }, 401);
  const { order_id: orderId, action = 'init' } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string') return json({ error: 'bad_request' }, 400);

  const db = serviceClient();
  const { data: rows, error } = await db.rpc('order_for_checkout', { p_order_id: orderId, p_buyer_id: user.id });
  if (error) return json({ error: 'server_error' }, 500);
  const order = rows?.[0];
  if (!order) return json({ error: 'not_found' }, 404);

  try {
    if (action === 'verify') {
      if (order.status !== 'awaiting_payment') return json({ status: order.status });
      const result = await settleCharge(order.id, paymentDeps(db));
      return json({ result });
    }

    if (order.status !== 'awaiting_payment' || Date.parse(order.pay_by) <= Date.now()) {
      return json({ error: 'not_payable', status: order.status }, 409);
    }
    // Resume an existing checkout: a reference can only be initialised once.
    if (order.paystack_authorization_url) {
      return json({ authorization_url: order.paystack_authorization_url, access_code: order.paystack_access_code });
    }

    const ps = paystackClient();
    const appUrl = env('APP_URL').replace(/\/$/, '');
    const tx = await ps.initialize({
      // Buyers sign in by phone; Paystack needs an email, so synthesise one.
      email: `buyer-${user.id}@${optionalEnv('BUYER_EMAIL_DOMAIN', 'buyers.declutter.ng')}`,
      amount: Number(order.amount), // from orders.amount, never from the client
      reference: order.id,
      callback_url: `${appUrl}/me/orders/${order.id}?paid=1`,
      channels: ['card', 'bank_transfer', 'ussd'],
      metadata: { order_id: order.id, title: order.title },
    });
    await db.rpc('set_order_checkout', {
      p_order_id: order.id, p_access_code: tx.access_code, p_authorization_url: tx.authorization_url,
    });
    return json({ authorization_url: tx.authorization_url, access_code: tx.access_code });
  } catch (e) {
    console.error('paystack-init', (e as Error).message);
    const status = e instanceof PaystackError ? 502 : 500;
    return json({ error: 'payment_provider_error' }, status);
  }
});
