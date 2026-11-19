// POST /functions/v1/paystack-webhook
// Verifies the HMAC signature, re-verifies charges with the Paystack API, and
// lets Postgres apply the result exactly once.
import { webhookDeps } from '../_shared/deps.ts';
import { json } from '../_shared/http.ts';
import { handleWebhook } from '../_shared/payments.ts';
import { serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const raw = await req.text();
  try {
    const out = await handleWebhook(raw, req.headers.get('x-paystack-signature'), webhookDeps(serviceClient()));
    return json(out.body, out.status);
  } catch (e) {
    // 5xx makes Paystack retry later; processing is idempotent.
    console.error('webhook error', (e as Error).message);
    return json({ error: 'processing_failed' }, 500);
  }
});
