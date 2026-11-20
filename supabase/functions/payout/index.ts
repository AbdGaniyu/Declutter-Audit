// Internal: sends Paystack transfers for claimed payouts. Called by Postgres
// after confirm_handover / bank details saved, and by a cron sweep.
// Transfer reference = payout id, so Paystack rejects accidental duplicates.
import { paystackClient } from '../_shared/deps.ts';
import { json } from '../_shared/http.ts';
import { PaystackError } from '../_shared/paystack.ts';
import { isInternal, serviceClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!isInternal(req)) return json({ error: 'unauthorized' }, 401);

  const db = serviceClient();
  const ps = paystackClient();
  const { data: claimed, error } = await db.rpc('claim_payouts', { p_limit: 20 });
  if (error) return json({ error: error.message }, 500);

  const results: Record<string, string> = {};
  for (const p of claimed ?? []) {
    try {
      const t = await ps.transfer({
        amount: Number(p.amount),
        recipient: p.recipient_code,
        reference: p.payout_id,
        reason: `Declutter payout: ${String(p.title).slice(0, 60)}`,
      });
      await db.rpc('payout_transfer_started', { p_payout_id: p.payout_id, p_transfer_code: t.transfer_code });
      // Usually 'pending' until the transfer.* webhook; apply immediate outcomes now.
      if (t.status === 'success' || t.status === 'failed' || t.status === 'reversed') {
        await db.rpc('payout_transfer_result', { p_payout_id: p.payout_id, p_result: t.status, p_reason: null });
      }
      results[p.payout_id] = t.status;
    } catch (e) {
      const reason = e instanceof PaystackError ? e.message : 'network_error';
      console.error('transfer failed', p.payout_id, reason);
      await db.rpc('payout_transfer_result', { p_payout_id: p.payout_id, p_result: 'failed', p_reason: reason });
      results[p.payout_id] = 'failed';
    }
  }
  return json({ processed: Object.keys(results).length, results });
});
