// Wires the pure payment logic to Supabase (service role) and Paystack.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { optionalEnv, env } from './env.ts';
import type { MarkPaidResult, PaymentDeps, TransferResult, WebhookDeps } from './payments.ts';
import { paystack, verifySignature } from './paystack.ts';

export function paystackClient() {
  return paystack({ secretKey: env('PAYSTACK_SECRET_KEY'), baseUrl: optionalEnv('PAYSTACK_API_URL', 'https://api.paystack.co') });
}

export function paymentDeps(db: SupabaseClient): PaymentDeps {
  const ps = paystackClient();
  return {
    verify: (ref) => ps.verify(ref),
    refund: (ref) => ps.refund(ref),
    markOrderPaid: async (ref, amount, currency) => {
      const { data, error } = await db.rpc('mark_order_paid', { p_reference: ref, p_amount: amount, p_currency: currency });
      if (error) throw new Error(error.message);
      return data as MarkPaidResult;
    },
    recordLateRefund: async (ref) => {
      const { error } = await db.rpc('record_late_payment_refund', { p_reference: ref });
      if (error) throw new Error(error.message);
    },
  };
}

export function webhookDeps(db: SupabaseClient): WebhookDeps {
  const secret = env('PAYSTACK_SECRET_KEY');
  return {
    ...paymentDeps(db),
    verifySignature: (raw, sig) => verifySignature(raw, sig, secret),
    logEvent: async (event, dataId, reference, payload) => {
      const { data } = await db.rpc('log_paystack_event', {
        p_event: event, p_data_id: dataId, p_reference: reference, p_payload: payload,
      });
      return Boolean(data);
    },
    transferResult: async (reference: string, result: TransferResult, reason: string | null) => {
      const { error } = await db.rpc('payout_transfer_result', { p_payout_id: reference, p_result: result, p_reason: reason });
      if (error) throw new Error(error.message);
    },
  };
}
