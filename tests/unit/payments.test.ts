import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { handleWebhook, type MarkPaidResult, type WebhookDeps } from '@/supabase/functions/_shared/payments';
import { verifySignature } from '@/supabase/functions/_shared/paystack';

const SECRET = 'sk_test_unit';
const sign = (raw: string) => createHmac('sha512', SECRET).update(raw).digest('hex');

type Order = { status: string; amount: number; refunded?: boolean };

/** Fake Postgres with the same state rules as mark_order_paid. */
function fakeDeps(orders: Record<string, Order>, paystackAmount: Record<string, number> = {}) {
  const paid: string[] = [];
  const deps: WebhookDeps = {
    verifySignature: (raw, sig) => verifySignature(raw, sig, SECRET),
    logEvent: vi.fn(async () => true),
    verify: vi.fn(async (ref: string) => ({
      status: 'success', reference: ref, currency: 'NGN', amount: paystackAmount[ref] ?? orders[ref]?.amount ?? 0,
    })),
    refund: vi.fn(async () => ({})),
    recordLateRefund: vi.fn(async (ref: string) => { orders[ref]!.refunded = true; }),
    transferResult: vi.fn(async () => {}),
    markOrderPaid: async (ref, amount, currency): Promise<MarkPaidResult> => {
      const o = orders[ref];
      if (!o) return 'not_found';
      if (['paid', 'handed_over', 'paid_out'].includes(o.status) || o.refunded) return 'duplicate';
      if (currency !== 'NGN' || amount !== o.amount) return 'amount_mismatch';
      if (o.status !== 'awaiting_payment') return 'late';
      o.status = 'paid';
      paid.push(ref);
      return 'paid';
    },
  };
  return { deps, paid };
}

const charge = (reference: string, amount = 2_500_000) =>
  JSON.stringify({ event: 'charge.success', data: { id: 123, reference, amount, currency: 'NGN' } });

describe('verifySignature', () => {
  it('accepts the Paystack HMAC-SHA512 signature and rejects others', async () => {
    const raw = '{"event":"charge.success"}';
    expect(await verifySignature(raw, sign(raw), SECRET)).toBe(true);
    expect(await verifySignature(raw, sign(raw + ' '), SECRET)).toBe(false);
    expect(await verifySignature(raw, null, SECRET)).toBe(false);
  });
});

describe('handleWebhook', () => {
  it('rejects a bad signature without touching anything', async () => {
    const { deps, paid } = fakeDeps({ o1: { status: 'awaiting_payment', amount: 2_500_000 } });
    const out = await handleWebhook(charge('o1'), 'nope', deps);
    expect(out.status).toBe(401);
    expect(paid).toEqual([]);
    expect(deps.verify).not.toHaveBeenCalled();
  });

  it('replaying the same webhook twice pays exactly once', async () => {
    const { deps, paid } = fakeDeps({ o1: { status: 'awaiting_payment', amount: 2_500_000 } });
    const raw = charge('o1');
    const first = await handleWebhook(raw, sign(raw), deps);
    const second = await handleWebhook(raw, sign(raw), deps);
    expect(first.body.result).toBe('paid');
    expect(second.body.result).toBe('duplicate');
    expect(paid).toEqual(['o1']);
    expect(deps.refund).not.toHaveBeenCalled();
  });

  it('uses the verified API amount, not the webhook body', async () => {
    const { deps, paid } = fakeDeps({ o1: { status: 'awaiting_payment', amount: 2_500_000 } }, { o1: 100 });
    const raw = charge('o1', 2_500_000); // body claims full amount; API says 100 kobo
    const out = await handleWebhook(raw, sign(raw), deps);
    expect(out.body.result).toBe('amount_mismatch');
    expect(paid).toEqual([]);
  });

  it('refunds a payment that lands after the order expired, once', async () => {
    const orders = { o1: { status: 'expired', amount: 2_500_000 } as Order };
    const { deps } = fakeDeps(orders);
    const raw = charge('o1');
    expect((await handleWebhook(raw, sign(raw), deps)).body.result).toBe('late');
    expect((await handleWebhook(raw, sign(raw), deps)).body.result).toBe('duplicate');
    expect(deps.refund).toHaveBeenCalledTimes(1);
  });

  it('routes transfer events to payouts', async () => {
    const { deps } = fakeDeps({});
    const raw = JSON.stringify({ event: 'transfer.failed', data: { id: 9, reference: 'p1', reason: 'Account closed' } });
    const out = await handleWebhook(raw, sign(raw), deps);
    expect(out.status).toBe(200);
    expect(deps.transferResult).toHaveBeenCalledWith('p1', 'failed', 'Account closed');
  });

  it('ignores unrelated events', async () => {
    const { deps } = fakeDeps({});
    const raw = JSON.stringify({ event: 'subscription.create', data: { id: 1 } });
    expect((await handleWebhook(raw, sign(raw), deps)).body.ignored).toBe('subscription.create');
  });
});
