import { expect, test, type Page } from '@playwright/test';
import { db, seedLiveLot, seedSeller, signIn } from './helpers';

/** Drag the slide-to-bid thumb past 85% and release (the pointer path). */
async function slide(page: Page, amountLabel: string) {
  const slider = page.getByRole('button', { name: `Bid ${amountLabel}` });
  await expect(slider).toBeVisible();
  const box = await slider.boundingBox();
  if (!box) throw new Error('slider not laid out');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + 28, y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 28 + ((box.width - 36) * i) / 12, y);
  await expect(page.getByText(`Release to bid ${amountLabel}`)).toBeVisible();
  await page.mouse.up();
}

test('two bidders see each other live, and outbid is flagged', async ({ browser }) => {
  const seller = await seedSeller();
  const { lotId } = await seedLiveLot(seller);

  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();

  await signIn(a, '08000000001', 'Ada', `/lot/${lotId}`);
  await signIn(b, '08000000002', 'Bayo', `/lot/${lotId}`);

  await expect(a.getByRole('heading', { name: 'E2E standing fan' })).toBeVisible();
  await expect(b.getByText('Opening bid').first()).toBeVisible();

  // A bids the opening price from the keyboard (Enter on the slider).
  await a.getByRole('button', { name: 'Bid ₦10,000' }).press('Enter');
  await expect(a.getByRole('status').getByText("You're the top bidder")).toBeVisible();
  await expect(a.getByRole('button', { name: 'Bidding paused while you lead' })).toBeVisible();

  // B sees it via Realtime without reloading; the slider moves to the next step.
  await expect(b.getByText('Current bid')).toBeVisible({ timeout: 10_000 });
  await expect(b.getByRole('button', { name: 'Bid ₦10,500' })).toBeVisible();

  // B outbids by dragging the slider.
  await slide(b, '₦10,500');
  await expect(b.getByRole('status').getByText("You're the top bidder")).toBeVisible();

  // A's line flips to Outbid, and a tap on the slider bids the new minimum.
  await expect(a.getByText('₦10,500 now. Bid again?')).toBeVisible({ timeout: 10_000 });
  await expect(a.getByText('Outbid', { exact: true })).toBeVisible();
  await a.getByRole('button', { name: 'Bid ₦11,000' }).click();
  await expect(a.getByRole('status').getByText("You're the top bidder")).toBeVisible();

  // B opens the drawer and picks +5 steps (₦500 × 5) over ₦11,000.
  await b.getByRole('button', { name: 'Show bid amounts and history' }).click();
  await b.getByRole('radio', { name: 'Raise ₦2,500 to ₦13,500' }).click();
  await b.getByRole('button', { name: 'Bid ₦13,500' }).press('Enter');
  await expect(b.getByRole('status').getByText("You're the top bidder")).toBeVisible();
  await b.getByRole('button', { name: /Bid history/ }).click();
  await expect(b.getByRole('listitem').filter({ hasText: '₦13,500' }).getByText('You')).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test('signed-out bidders are asked to verify their phone in place', async ({ page }) => {
  const seller = await seedSeller();
  const { lotId } = await seedLiveLot(seller);
  await page.goto(`/lot/${lotId}`);
  await page.getByRole('button', { name: 'Bid ₦10,000' }).click();
  await expect(page.getByRole('dialog', { name: 'Verify your phone to bid' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/lot/${lotId}$`));
});

test('a "Bid ₦X" link preselects that amount on the lot page', async ({ browser }) => {
  const seller = await seedSeller();
  const { lotId } = await seedLiveLot(seller);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, '08000000001', 'Ada', `/lot/${lotId}?amount=1100000`);
  // Opening ₦10,000 with a ₦500 step: chips are Opening / +₦1,000 → ₦11,000 / +₦2,500 → ₦12,500.
  await expect(page.getByRole('button', { name: 'Bid ₦11,000' })).toBeVisible();
  await ctx.close();
});

test('a bid that loses the race is rejected and the slider moves to the new minimum', async ({ browser }) => {
  const seller = await seedSeller();
  const { lotId } = await seedLiveLot(seller);
  const ctx = await browser.newContext();
  const a = await ctx.newPage();
  await signIn(a, '08000000001', 'Ada', `/lot/${lotId}`);
  const [{ id: rival }] = await db<{ id: string }>(`select id from auth.users where phone = '2348000000002'`);

  // Someone else's ₦10,000 bid reaches Postgres just before A's.
  await a.route('**/rest/v1/rpc/place_bid', async (route) => {
    await db(`begin;
      select set_config('role', 'authenticated', true),
             set_config('request.jwt.claims', '{"sub":"${rival}","role":"authenticated"}', true);
      select public.place_bid('${lotId}', 1000000);
      commit;`);
    await route.continue();
  });
  await a.getByRole('button', { name: 'Bid ₦10,000' }).press('Enter');

  await expect(a.getByRole('alert').filter({ hasText: 'Someone bid ₦10,000 first. Slide again for ₦10,500.' })).toBeVisible();
  await expect(a.getByRole('button', { name: 'Bid ₦10,500' })).toBeVisible();
  await a.unroute('**/rest/v1/rpc/place_bid');
  await a.getByRole('button', { name: 'Bid ₦10,500' }).press('Enter');
  await expect(a.getByRole('status').getByText("You're the top bidder")).toBeVisible();
  await ctx.close();
});
