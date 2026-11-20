// Full money loop against the local stack + mock Paystack (tests/mocks/paystack-mock.mjs).
// Requires Edge Functions served with PAYSTACK_API_URL pointing at the mock.
import { expect, test } from '@playwright/test';
import { db, signIn } from './helpers';

const MOCK = process.env.PAYSTACK_MOCK_URL ?? 'http://localhost:4010';

test('win → pay → handover code → payout, with webhook replay', async ({ browser }) => {
  test.setTimeout(150_000);
  const sellerCtx = await browser.newContext();
  const buyerCtx = await browser.newContext();
  const seller = await sellerCtx.newPage();
  const buyer = await buyerCtx.newPage();

  await signIn(seller, '08000000003', 'Sade', '/me');
  await signIn(buyer, '08000000001', 'Ada', '/me');
  const [{ id: sellerId }] = await db<{ id: string }>(`select id from auth.users where phone = '2348000000003'`);

  const title = `E2E rice cooker ${Date.now().toString(36)}`;
  // A lot that closes ~20s from now.
  const [drop] = await db<{ id: string }>(
    `insert into public.drops (title, opens_at, first_close_at)
     values ('E2E pay drop', now() - interval '1 minute', now() + interval '20 seconds') returning id`);
  const [lot] = await db<{ id: string }>(
    `insert into public.auctions (drop_id, seller_id, slot, title, condition, category, area, start_price, step, starts_at, ends_at)
     values ($1, $2, 0, $3, 'good', 'Kitchen', 'Surulere', 2500000, public.step_for(2500000),
             now() - interval '1 minute', now() + interval '20 seconds') returning id`, [drop!.id, sellerId, title]);

  // Buyer bids, then waits for the close (cron runs every 5s; soft close adds 30s).
  await buyer.goto(`/lot/${lot!.id}`);
  await buyer.getByRole('button', { name: /^Bid ₦/ }).last().click();
  await buyer.getByRole('dialog', { name: 'Place your bid' }).getByRole('button', { name: 'Bid ₦25,000' }).click();
  await expect(buyer.getByText(/You're winning at/)).toBeVisible();
  // Won banner counts down to pay_by and links straight to the pay screen.
  await expect(buyer.getByText(/You won! Pay within/)).toBeVisible({ timeout: 60_000 });

  // Pay through the (mock) Paystack checkout.
  await buyer.getByRole('link', { name: 'Pay now' }).click();
  await expect(buyer.getByText('Your money is held until you collect the item')).toBeVisible();
  await buyer.getByRole('button', { name: 'Pay now' }).click();
  await buyer.waitForURL(/localhost:4010\/checkout\//);
  await buyer.getByRole('button', { name: 'Pay now' }).click();
  await buyer.waitForURL(/\/me\/orders\/.+paid=1/);
  const codeEl = buyer.getByLabel('Handover code');
  await expect(codeEl).toHaveText(/^\d{6}$/, { timeout: 30_000 });
  const code = (await codeEl.textContent())!.trim();

  const [order] = await db<{ id: string; status: string }>(
    `select id, status from public.orders where auction_id = $1`, [lot!.id]);
  expect(order!.status).toBe('paid');

  // Replaying the charge webhook changes nothing.
  const replay = await fetch(`${MOCK}/__replay/charge/${order!.id}`, { method: 'POST' }).then((r) => r.json());
  expect(replay.webhook_status).toBe(200);
  const [counts] = await db<{ paid: number; notes: number }>(
    `select (select count(*) from public.orders where auction_id = $1 and status = 'paid')::int as paid,
            (select count(*) from public.notifications where type = 'buyer_paid' and payload->>'order_id' = $2)::int as notes`,
    [lot!.id, order!.id]);
  expect(counts).toEqual({ paid: 1, notes: 1 });

  // Seller adds a bank account, then confirms handover with the buyer's code.
  await seller.goto('/me/bank');
  await seller.getByLabel('Bank').selectOption({ label: 'Guaranty Trust Bank' });
  await seller.getByLabel('Account number (NUBAN)').fill('0123456789');
  await seller.getByRole('button', { name: /Verify and save|Update account/ }).click();
  await expect(seller.getByText('Saved: ADAEZE TEST OKAFOR')).toBeVisible();

  await seller.goto('/me/sales');
  await expect(seller.getByRole('heading', { name: 'Ready for pickup' })).toBeVisible();
  const card = seller.getByRole('article', { name: title });
  const firstBox = card.getByLabel("Buyer's handover code digit 1");
  await firstBox.fill(code === '000000' ? '111111' : '000000'); // fills all six boxes
  await card.getByRole('button', { name: 'Confirm handover' }).click();
  await expect(card.getByText("That code doesn't match. 4 tries left this hour.")).toBeVisible();
  await firstBox.fill(code);
  await card.getByRole('button', { name: 'Confirm handover' }).click();

  // Payout: pg_net → payout function → mock transfer → transfer.success webhook.
  await expect.poll(async () => {
    const [r] = await db<{ o: string; p: string | null }>(
      `select o.status as o, p.status as p from public.orders o left join public.payouts p on p.order_id = o.id where o.id = $1`,
      [order!.id]);
    return `${r!.o}/${r!.p}`;
  }, { timeout: 30_000 }).toBe('paid_out/success');

  const [payout] = await db<{ amount: string }>(`select amount from public.payouts where order_id = $1`, [order!.id]);
  expect(Number(payout!.amount)).toBe(2_300_000); // ₦25,000 − 8%

  await sellerCtx.close();
  await buyerCtx.close();
});
