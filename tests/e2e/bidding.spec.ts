import { expect, test } from '@playwright/test';
import { seedLiveLot, seedSeller, signIn } from './helpers';

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
  await a.getByRole('button', { name: /Place bid/ }).click();
  await a.getByRole('button', { name: 'Bid ₦10,000' }).click();
  await expect(a.getByText("You're winning").first()).toBeVisible();

  // B sees it via Realtime without reloading.
  await expect(b.getByText('Bidder 1').first()).toBeVisible({ timeout: 10_000 });
  await expect(b.getByRole('button', { name: /Place bid · ₦10,500\+/ })).toBeVisible();

  // B outbids; A gets flagged.
  await b.getByRole('button', { name: /Place bid/ }).click();
  await b.getByRole('button', { name: 'Bid ₦10,500' }).click();
  await expect(b.getByText("You're winning").first()).toBeVisible();
  await expect(a.getByText("You've been outbid").first()).toBeVisible({ timeout: 10_000 });
  await expect(a.getByRole('button', { name: /Place bid · ₦11,000\+/ })).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test('seller cannot bid on own lot and anon is asked to sign in', async ({ page }) => {
  const seller = await seedSeller();
  const { lotId } = await seedLiveLot(seller);
  await page.goto(`/lot/${lotId}`);
  await expect(page.getByRole('link', { name: 'Sign in to bid' })).toBeVisible();
});
