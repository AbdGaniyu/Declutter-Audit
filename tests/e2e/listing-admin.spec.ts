import { expect, test } from '@playwright/test';
import { db, signIn } from './helpers';

// 1x1 PNG, upscaled by the browser canvas path in compressImage().
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('seller lists an item with photos into an upcoming drop', async ({ page }) => {
  const dropTitle = `E2E listing drop ${Date.now().toString(36)}`;
  await db(`insert into public.drops (title, opens_at, first_close_at)
            values ($1, now() + interval '2 hours', now() + interval '150 minutes')`, [dropTitle]);
  await signIn(page, '08000000002', 'Bayo', '/sell');

  // Step 1: photos (at least 3).
  await page.getByLabel('Choose photos from gallery').setInputFiles(
    [1, 2, 3].map((n) => ({ name: `p${n}.png`, mimeType: 'image/png', buffer: PNG })));
  await expect(page.getByAltText('Photo 3')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 2: details.
  await page.getByLabel('Title').fill('E2E listed blender');
  await page.getByLabel('Pickup area').selectOption('Ikeja');
  await page.getByLabel('Asking price (₦)').fill('25,000');
  await expect(page.getByText(/goes up by at least/)).toContainText('₦1,000');
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Step 3: drop. Then review.
  await page.getByRole('radio', { name: new RegExp(dropTitle) }).check();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review your lot' })).toBeVisible();
  await page.getByRole('button', { name: 'List my lot' }).click();

  await expect(page.getByRole('heading', { name: /Your lot goes live/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'View your lot' }).click();
  await page.waitForURL(/\/lot\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'E2E listed blender' })).toBeVisible();
  await expect(page.getByText(/Bidding opens/)).toBeVisible();

  const lotId = page.url().split('/').pop()!;
  const [row] = await db<{ step: string; photos: number }>(
    `select a.step, (select count(*) from public.auction_photos p where p.auction_id = a.id)::int as photos
       from public.auctions a where a.id = $1`, [lotId]);
  expect(Number(row!.step)).toBe(100_000);
  expect(row!.photos).toBe(3);
  const img = page.getByAltText('E2E listed blender, photo 1 of 3');
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});

test('admin creates a drop; non-admins cannot open the panel', async ({ page }) => {
  await signIn(page, '08000000002', 'Bayo', '/me');
  await db(`update public.profiles set is_admin = false where phone = '2348000000002'`);
  const res = await page.goto('/admin');
  expect(res?.status()).toBe(404);

  await db(`update public.profiles set is_admin = true where phone = '2348000000002'`);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  const title = `E2E admin drop ${Date.now()}`;
  await page.getByLabel('New drop title').fill(title);
  await page.getByLabel('Opens (Lagos time)').fill('2030-01-05T19:00');
  await page.getByRole('button', { name: 'Create drop' }).click();
  await expect.poll(async () => (await db(`select 1 from public.drops where title = $1
      and opens_at = '2030-01-05T18:00:00Z' and first_close_at = '2030-01-05T18:30:00Z'`, [title])).length).toBe(1);
  await db(`update public.profiles set is_admin = false where phone = '2348000000002'`);
});
