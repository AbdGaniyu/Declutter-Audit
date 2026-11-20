import { expect, test, type Page } from '@playwright/test';
import { seedLiveLot, seedSeller, signIn } from './helpers';

/** Bid bar → sheet → confirm at the given amount. */
async function bid(page: Page, label: string) {
  await page.getByRole('button', { name: /^Bid ₦/ }).last().click();
  await page.getByRole('dialog', { name: 'Place your bid' }).getByRole('button', { name: label }).click();
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

  // A bids the opening price.
  await bid(a, 'Bid ₦10,000');
  await expect(a.getByText(/You're winning at/)).toBeVisible();

  // B sees it via Realtime without reloading.
  await expect(b.getByText('Bidder 1').first()).toBeVisible({ timeout: 10_000 });
  await expect(b.getByRole('button', { name: 'Bid ₦10,500' })).toBeVisible();

  // B outbids; A's banner flips to outbid with a one-tap bid at the new minimum.
  await bid(b, 'Bid ₦10,500');
  await expect(b.getByText(/You're winning at/)).toBeVisible();
  await expect(a.getByText(/You've been outbid/)).toBeVisible({ timeout: 10_000 });
  const oneTap = a.getByRole('status').getByRole('button', { name: 'Bid ₦11,000' });
  await expect(oneTap).toBeVisible();
  await oneTap.click();
  await expect(a.getByText(/You're winning at/)).toBeVisible();

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
