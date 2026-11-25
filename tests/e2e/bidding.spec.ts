import { expect, test, type Page } from '@playwright/test';
import { seedLiveLot, seedSeller, signIn } from './helpers';

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
