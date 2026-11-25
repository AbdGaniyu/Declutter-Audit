# Declutter Auction

Lagos-first short live auctions for decluttered items. Sellers list into scheduled evening drops, lots close one minute apart, the winner pays through Paystack, and the seller is paid when the buyer hands over a 6-digit code at pickup.

Read **CLAUDE.md** (product rules) and **DESIGN.md** (UI tokens) first.

## Quick start

> **Use the project's Supabase CLI (`npx supabase …`), not a global install.** The repo pins CLI v3.x in `package.json`. An older global CLI (e.g. Homebrew v2.x) starts Auth with phone sign-in disabled ("Unsupported phone provider") and builds a `storage` schema that newer Storage images can't upload into. If the stack was ever started with another CLI version, recreate it: `npx supabase stop --no-backup && npx supabase start`.

```bash
npm install
cp .env.example .env.local                       # fill NEXT_PUBLIC_SUPABASE_ANON_KEY from `npx supabase start`
cp supabase/functions/.env.example supabase/functions/.env
npx web-push generate-vapid-keys                 # put keys in functions/.env, public key in .env.local
npx supabase start                               # Postgres, Auth, Realtime, Storage, Edge Runtime
npx supabase db reset                            # migrations + seed (a week of 7pm drops)
npx supabase functions serve --env-file supabase/functions/.env
npm run mock:paystack                            # optional: local Paystack stand-in on :4010
npm run dev
```

Local phone sign-in uses test OTPs from `supabase/config.toml`: `0800 000 0001`, `0800 000 0002` and `0800 000 0003`, code `123456`.

Make yourself an admin:

```sql
update public.profiles set is_admin = true where phone = '2348000000001';
```

## Tests

| Command | What it covers |
|---|---|
| `npm test` | Unit (Vitest): money/time/phone helpers, broadcast merge, webhook signature + replay idempotency, push copy |
| `npm run test:db` | pgTAP (`supabase test db`): bidding rules, soft close, RLS, listing, closing idempotency, payments, handover/payouts, strikes, hardening |
| `npm run test:race` | 50 concurrent bids: one accepted per price level, `current_bid` = max accepted, nothing accepted after `ends_at` |
| `npm run test:e2e` | Playwright: live bidding between two users, listing with photo upload, admin, and the full win → pay → handover → payout loop against the mock Paystack |

Before the first e2e run, install the browser: `npx playwright install chromium`.

The e2e payment test needs the Edge Functions running with `PAYSTACK_API_URL` pointing at the mock (`http://host.docker.internal:4010` from the edge-runtime container).

## How the golden rules are enforced

| Rule | Where |
|---|---|
| DB is the referee | `place_bid` is one conditional `UPDATE … RETURNING`. Clients have no `insert/update/delete` grant on `auctions`, `bids` or `orders` (`20261119000200_rls.sql`), and `bids` has an append-only trigger. |
| Server time only | Bid validity uses `clock_timestamp()` inside the `UPDATE` (re-evaluated after waiting for the row lock). The UI offsets its clock from `server_time()` round trips (`lib/time-sync.ts`). |
| Time is the state | Live = `starts_at <= now < ends_at`. Cron (`close_due_auctions`, every 5s) only does bookkeeping after `ends_at`. |
| Idempotent after close | `closed_at is null` guards, `unique (auction_id, offer_round)` on orders, `mark_order_paid` status guard, payouts `unique (order_id)`, transfer reference = payout id. |
| `auth.uid()` only | Every security-definer RPC reads `auth.uid()`. Service-only functions are revoked from `anon`/`authenticated`. |
| Integer kobo | All money columns are `bigint`. `formatNaira()` in `lib/money.ts` is the only formatter. |
| Never trust the client for money | Step, commission (8%, `private.settings.commission_bps`) and payout are computed in Postgres; the checkout amount comes from `orders.amount`. |

## Architecture notes

- **Realtime:** a trigger on `bids` calls `realtime.send` on the **private** topic `auction:<id>`. Clients may receive but not send (no insert policy on `realtime.messages`), so nobody can forge bid broadcasts. Per-user notifications go to `user:<id>`, which only that user can receive.
- **Masking:** the payload carries `leader_no` ("Bidder 4", from `auction_bidders`) instead of `leader_id`. `auctions.leader_id` is excluded from the client column grant. The client shows "You're winning" when `leader_no` equals its own `my_bidder_no`.
- **Handover code:** derived as HMAC(secret, order id), so nothing is stored in plaintext. A bcrypt hash is stored on the order and the hash column isn't readable by clients. 5 wrong attempts lock the order and raise an ops alert.
- **Second chance:** `expire_unpaid_orders` (every 30s, 2-minute grace for in-flight checkouts) expires the order, adds a strike (suspended at 2), and offers the lot to the highest other non-suspended bidder at their own highest bid (`offer_round = 2`). A lapsed or declined second-chance offer carries no strike, and the lot becomes `defaulted` (relistable).
- **Late payments:** a charge that lands after the order expired is refunded automatically through Paystack.
- **Push:** a notifications insert trigger calls the `push` Edge Function via `pg_net`, and a cron drain catches misses. Notifications are claimed atomically so each is pushed once. Endpoints are restricted to the browser push services.

## Production checklist

1. **Supabase project:** `supabase link`, then `supabase db push`. Enable the phone provider with a real SMS provider (Twilio/Termii/etc.) and remove `test_otp`.
2. **Vault secrets** (so Postgres can call Edge Functions):
   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1', 'edge_functions_url');
   select vault.create_secret('<long random string>', 'internal_fn_secret');
   ```
3. **Edge Function secrets:** `supabase secrets set PAYSTACK_SECRET_KEY=sk_live_… INTERNAL_FN_SECRET=<same as vault> VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:… APP_URL=https://… BUYER_EMAIL_DOMAIN=…`, then `supabase functions deploy`.
4. **Paystack dashboard:** set the webhook URL to `https://<ref>.supabase.co/functions/v1/paystack-webhook`. Disable the OTP requirement for transfers (needed for API payouts), and keep the balance funded for transfers.
5. **Vercel:** set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` only. No secret key ever goes to Next.js.
6. **Settings** live in `private.settings` (commission, pay window, grace, strikes, drop hour). Change them with a migration.

## How the UI applies DESIGN.md (v2, "Liquid Glass")

- **Tokens:** light and dark values live in `app/globals.css` (dark follows `prefers-color-scheme`) and are mapped in `tailwind.config.ts`. Type is SF Pro on Apple devices and self-hosted Inter elsewhere. Icons are Lucide at 1.75 stroke. Reference mockups: `docs/design/v2-screens.pdf`.
- **Glass** (`.glass-chip`, `.glass-nav`, `.glass-dock`) is only on the top bar, the mobile tab bar, the bid dock, the active filter pill and photo controls. It falls back to solid with `prefers-reduced-transparency` and gains a rim with `prefers-contrast: more`.
- **One accent:** crimson (`--accent`) is only on slide to bid, "Bid ₦X" shortcuts and countdowns at 60 seconds or less. Every other status is monochrome with an icon or a word.
- **Motion:** `lib/spring.ts` solves the calm (1.0 · 0.35s) and flick (0.77 · 0.32s) springs in closed form. CSS transitions use the same curves via generated `linear()` easings. Reduced motion jumps or cross-fades.
- **Slide to bid** (`components/SlideToBid.tsx`, logic in `lib/slide.ts`) is one focusable button: drag past 85%, flick, tap, or press Enter or Space. It only changes how a bid is triggered. Every bid still goes through `place_bid`.
- **Quick bid chips** are +1, +2 and +5 of the lot's stored `step` (`lib/bidding.ts`). The first chip always equals the server's `min_next`.
- **Lot page:** one bid panel renders as a glass dock with a drag-up drawer on phones and as a sticky floating panel on desktop, so there's only ever one slider in the page.
- **Orders:** `/me/orders` has Buying and Selling. Selling has the seller segments (Awaiting payment, Ready for pickup, Paid out), and `/me/sales` redirects there.
- **Admin:** `/admin` (week calendar of drops), `/admin/lots`, `/admin/users`, `/admin/disputes` and `/admin/strikes`, behind an `is_admin` check in `app/admin/layout.tsx`.
- **Not decided yet:** the app name and logo. The nav (`LogoMark`) and the PWA icons (`public/icons/icon.svg`, PNGs rendered from it) use an interim monochrome ring mark. Swap both when the real logo exists.

## Decisions and additions beyond CLAUDE.md

- **Broadcast payload** sends `leader_no` rather than `leader_id`, to honour the masking rule.
- **`place_bid` reasons** add `not_authenticated`, `not_verified`, `invalid_amount` (whole naira, ≤ ₦50m), `not_found`, `cancelled` and `already_leading` (the leader can't raise their own bid) to the spec'd five.
- **Schema additions:** `drops.number` (Drop No., stable once assigned); `profiles.is_admin`; `drops.max_lots`; `auctions.slot` and `relisted_from`; `orders.offer_round`, `handover_attempts`, `dispute_reason`, `refunded_at`, checkout fields and a `declined` status; `payouts.failure_reason` and `attempts`; `notifications.pushed_at`; `auction_bidders` (pseudonyms); `ops_alerts`; `private.paystack_events` (webhook audit log).
- **Paystack needs an email:** buyers sign in by phone, so checkout uses `buyer-<uid>@BUYER_EMAIL_DOMAIN`.
- **Handover code:** 5 wrong tries per rolling hour (from DESIGN.md), then locked until the hour is up, with an ops alert.
- **Drop reminders:** "Remind me" saves a reminder, and a cron job notifies and pushes when the drop opens.
- **Disputes:** buyer or seller can dispute a paid order (payout paused). Admins either release to the seller or refund via the `admin-refund` function.
