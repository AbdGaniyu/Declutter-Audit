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

## How the UI applies DESIGN.md

- **Tokens:** colors, type and shape are in `app/globals.css` and `tailwind.config.ts`. Fonts are self-hosted with `next/font`. Icons are Lucide at 1.75 stroke.
- **Contrast:** `--live`, `--winning`, `--outbid` and `--ended` don't reach WCAG AA (4.5:1) as small text on white. They're used for fills, icons, dots and the large countdown and price numbers (which only need 3:1). Small status text stays `--ink` on the matching `-soft` background, with an icon so status never relies on color.
- **Lot page order:** the price and countdown block sits right under the status banner, above the title. Following the key-screens order literally pushed the clock below the sticky bar on a 360×780 phone, which breaks principle #1 ("the clock is the hero").
- **Bid sheet shake:** principle #5 says "never shake", but the bid sheet spec asks for one gentle shake on rejection. It shakes once (4px, 280ms), and not at all with reduced motion.
- **Sell flow:** "3 steps" is read as Photos → Details → Drop, followed by a Review screen.
- **"+30s" pill:** shown whenever a bid extends `ends_at`, matching the copy in the doc, even when the extension is shorter than 30s.

## Decisions and additions beyond CLAUDE.md

- **Broadcast payload** sends `leader_no` rather than `leader_id`, to honour the masking rule.
- **`place_bid` reasons** add `not_authenticated`, `not_verified`, `invalid_amount` (whole naira, ≤ ₦50m), `not_found`, `cancelled` and `already_leading` (the leader can't raise their own bid) to the spec'd five.
- **Schema additions:** `profiles.is_admin`; `drops.max_lots`; `auctions.slot` and `relisted_from`; `orders.offer_round`, `handover_attempts`, `dispute_reason`, `refunded_at`, checkout fields and a `declined` status; `payouts.failure_reason` and `attempts`; `notifications.pushed_at`; `auction_bidders` (pseudonyms); `ops_alerts`; `private.paystack_events` (webhook audit log).
- **Paystack needs an email:** buyers sign in by phone, so checkout uses `buyer-<uid>@BUYER_EMAIL_DOMAIN`.
- **Handover code:** 5 wrong tries per rolling hour (from DESIGN.md), then locked until the hour is up, with an ops alert.
- **Drop reminders:** "Remind me" saves a reminder, and a cron job notifies and pushes when the drop opens.
- **Disputes:** buyer or seller can dispute a paid order (payout paused). Admins either release to the seller or refund via the `admin-refund` function.
