import { expect, test } from '@playwright/test';
import { db, seedSeller } from './helpers';

// A live drop that opened a day ago, so it's the drop page hero while it runs.
async function seedBrowseDrop() {
  const seller = await seedSeller();
  const tag = Date.now().toString(36);
  const [drop] = await db<{ id: string }>(
    `insert into public.drops (title, opens_at, first_close_at)
     values ($1, now() - interval '1 day', now() + interval '3 minutes') returning id`, [`E2E browse ${tag}`]);
  await db(
    `insert into public.auctions (drop_id, seller_id, slot, title, condition, category, area, start_price, step, starts_at, ends_at)
     values ($1, $2, 0, $3, 'good', 'Kitchen', 'Yaba', 900000, public.step_for(900000), now() - interval '1 day', now() + interval '3 minutes'),
            ($1, $2, 1, $4, 'fair', 'Furniture', 'Lekki', 4000000, public.step_for(4000000), now() - interval '1 day', now() + interval '40 minutes')`,
    [drop!.id, seller, `E2E kettle ${tag}`, `E2E sofa ${tag}`]);
  return { dropId: drop!.id, title: `E2E browse ${tag}`, kettle: `E2E kettle ${tag}`, sofa: `E2E sofa ${tag}` };
}

async function cleanup(dropId: string) {
  await db(`delete from public.auctions where drop_id = $1`, [dropId]);
  await db(`delete from public.drops where id = $1`, [dropId]);
}

test('drop page: drop number, category and ending-soon filters', async ({ page }) => {
  const s = await seedBrowseDrop();
  try {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: s.title })).toBeVisible();
    await expect(page.getByText(/Live now · Drop No\./)).toBeVisible();
    await expect(page.getByText(/One closes every minute/)).toBeVisible();

    await page.getByRole('radio', { name: 'Kitchen' }).click();
    await expect(page.getByRole('link', { name: new RegExp(s.kettle) })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(s.sofa) })).toHaveCount(0);

    await page.getByRole('radio', { name: 'Ending soon' }).click();
    await expect(page.getByRole('link', { name: new RegExp(s.kettle) })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(s.sofa) })).toHaveCount(0);

    await page.getByRole('radio', { name: 'All' }).click();
    await expect(page.getByRole('link', { name: new RegExp(s.sofa) })).toBeVisible();
  } finally {
    await cleanup(s.dropId);
  }
});

test('search finds live lots and matches wildcards literally', async ({ page }) => {
  const s = await seedBrowseDrop();
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Search lots' }).click();
    const dialog = page.getByRole('dialog', { name: 'Search lots' });
    await dialog.getByLabel("Search tonight's lots").fill(s.sofa.toUpperCase());
    await expect(dialog.getByRole('link', { name: new RegExp(s.sofa) })).toBeVisible();
    await dialog.getByLabel("Search tonight's lots").fill('100%_off');
    await expect(dialog.getByText('Nothing matches “100%_off” tonight.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Search lots' })).toBeFocused();
  } finally {
    await cleanup(s.dropId);
  }
});

test('dark mode follows the system', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto('/');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(0, 0, 0)');
  await ctx.close();
});
