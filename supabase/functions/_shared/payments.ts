// Pure payment logic with injected dependencies (DB + Paystack), so it can be
// unit-tested without Deno or a network.

export type MarkPaidResult = 'paid' | 'duplicate' | 'late' | 'amount_mismatch' | 'not_found';

export type PaymentDeps = {
  verify: (reference: string) => Promise<{ status: string; amount: number; currency: string; reference: string }>;
  refund: (reference: string) => Promise<unknown>;
  markOrderPaid: (reference: string, amount: number, currency: string) => Promise<MarkPaidResult>;
  recordLateRefund: (reference: string) => Promise<void>;
};

/**
 * Never trust the webhook body for money: re-verify with Paystack's API, then
 * let Postgres decide. Safe to run any number of times for the same reference.
 */
export async function settleCharge(reference: string, deps: PaymentDeps): Promise<MarkPaidResult | 'not_successful'> {
  const tx = await deps.verify(reference);
  if (tx.status !== 'success' || tx.reference !== reference) return 'not_successful';
  const result = await deps.markOrderPaid(reference, tx.amount, tx.currency);
  if (result === 'late') {
    await deps.refund(reference);
    await deps.recordLateRefund(reference);
  }
  return result;
}

export type TransferResult = 'success' | 'failed' | 'reversed';

export type WebhookDeps = PaymentDeps & {
  verifySignature: (raw: string, signature: string | null) => Promise<boolean>;
  logEvent: (event: string, dataId: string, reference: string | null, payload: unknown) => Promise<boolean>;
  transferResult: (reference: string, result: TransferResult, reason: string | null) => Promise<void>;
};

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

export async function handleWebhook(raw: string, signature: string | null, deps: WebhookDeps): Promise<WebhookOutcome> {
  if (!(await deps.verifySignature(raw, signature))) return { status: 401, body: { error: 'bad_signature' } };

  let evt: { event?: string; data?: Record<string, unknown> };
  try {
    evt = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: 'bad_json' } };
  }
  const event = String(evt.event ?? '');
  const data = evt.data ?? {};
  const reference = typeof data.reference === 'string' ? data.reference : null;
  const dataId = String(data.id ?? reference ?? '');

  // Audit log only. Processing below is idempotent, so a redelivery after a
  // failed attempt is still processed (we never skip on "seen before").
  await deps.logEvent(event, dataId, reference, evt);

  switch (event) {
    case 'charge.success': {
      if (!reference) return { status: 200, body: { ignored: 'no_reference' } };
      const result = await settleCharge(reference, deps);
      return { status: 200, body: { result } };
    }
    case 'transfer.success':
    case 'transfer.failed':
    case 'transfer.reversed': {
      if (!reference) return { status: 200, body: { ignored: 'no_reference' } };
      const result = event.split('.')[1] as TransferResult;
      const reason = typeof data.reason === 'string' ? data.reason
        : typeof data.gateway_response === 'string' ? data.gateway_response : null;
      await deps.transferResult(reference, result, reason);
      return { status: 200, body: { result } };
    }
    default:
      return { status: 200, body: { ignored: event } };
  }
}
