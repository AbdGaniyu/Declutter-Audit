import { expect, type Page } from '@playwright/test';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export async function db<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

/** A verified seller created directly in auth.users. */
export async function seedSeller(): Promise<string> {
  const id = randomUUID();
  const phone = '23470' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  await db(`insert into auth.users (id, phone, phone_confirmed_at, aud, role)
            values ($1, $2, now(), 'authenticated', 'authenticated')`, [id, phone]);
  await db(`update public.profiles set display_name = 'Tolu', area = 'Yaba' where id = $1`, [id]);
  return id;
}

/** A live drop with one lot that closes in `closesInSec`. */
export async function seedLiveLot(sellerId: string, opts: { closesInSec?: number; startPrice?: number } = {}) {
  const closes = opts.closesInSec ?? 180;
  const price = opts.startPrice ?? 1_000_000;
  const [drop] = await db<{ id: string }>(
    `insert into public.drops (title, opens_at, first_close_at)
     values ('E2E drop', now() - interval '1 minute', now() + make_interval(secs => $1)) returning id`, [closes]);
  const [lot] = await db<{ id: string }>(
    `insert into public.auctions (drop_id, seller_id, slot, title, condition, category, area, start_price, step,
                                  starts_at, ends_at)
     values ($1, $2, 0, 'E2E standing fan', 'good', 'Home', 'Yaba', $3, public.step_for($3),
             now() - interval '1 minute', now() + make_interval(secs => $4)) returning id`,
    [drop!.id, sellerId, price, closes]);
  return { dropId: drop!.id, lotId: lot!.id };
}

/** Sign in through the real phone OTP UI (local test OTPs from supabase/config.toml). */
export async function signIn(page: Page, localPhone: string, name: string, next = '/') {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Phone number').fill(localPhone);
  // GoTrue throttles OTP requests per phone; tests reuse phones, so wait it out.
  const codeField = page.getByLabel('6-digit code digit 1');
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.getByRole('button', { name: 'Send code' }).click();
    const throttled = page.getByText(/only request this after/);
    await expect(codeField.or(throttled)).toBeVisible({ timeout: 10_000 });
    if (await codeField.isVisible()) break;
    await page.waitForTimeout(3000);
  }
  await codeField.fill('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  const nameField = page.getByLabel('First name');
  await expect.poll(async () => (await nameField.isVisible()) || new URL(page.url()).pathname === next.split('?')[0],
    { timeout: 15_000 }).toBe(true);
  if (await nameField.isVisible()) {
    await nameField.fill(name);
    await page.getByLabel('Your area').selectOption('Lekki');
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await page.waitForURL((u) => u.pathname === next.split('?')[0], { timeout: 15_000 });
}
