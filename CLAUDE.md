# CLAUDE.md

Project guide for Claude Code. Read this before touching the code.

## What we're building

A Lagos-first web app where people sell decluttered items through **short live auctions**.

- The seller sets an **asking price**. That price is the **opening bid**.
- Auctions are short and run in **scheduled drops** (e.g. 7pm daily). Lots close one minute apart.
- Highest valid bid at close wins. The winner pays through Paystack. The money is held until the buyer gives the seller a **handover code** at pickup. Then the seller is paid, minus our commission.

Working name: **Declutter Auction** (placeholder; rename freely).

## Stack

| Layer | Choice |
|---|---|
| Web | Next.js (App Router) + TypeScript + Tailwind |
| Backend | Supabase: Postgres, Auth (phone OTP), Realtime (Broadcast), Storage, Cron, Edge Functions |
| Payments | Paystack: checkout for buyers, Transfers for seller payouts, webhooks |
| Hosting | Vercel (web), Supabase (everything else) |
| PWA | Installable, with web push for "you've been outbid" / "you won" |

Use Python only if we need image or PDF work later. Don't add a separate API server unless there's a real need.

## Golden rules (do not break these)

1. **The database is the referee.** Every bid goes through the `place_bid` Postgres function, called via RPC. Nothing else may write to `auctions.current_bid`, `leader_id` or `ends_at`. Enforce this with RLS: no direct `insert`/`update` on `auctions` or `bids` from the client.
2. **Server time is the only time.** Bid validity is decided by `now()` inside Postgres. Clients never decide whether an auction is open. The UI counts down using a server-time offset (see Realtime below).
3. **Time is the state.** An auction is "live" when `starts_at <= now() < ends_at`. Don't rely on a cron job flipping a status to open or close bidding. Cron jobs only do bookkeeping *after* `ends_at` (choosing winners, creating orders, sending notifications).
4. **Everything after close is idempotent.** Closing, payment webhooks and payouts must be safe to run twice. Guard with `where closed_at is null`, unique Paystack references and similar checks.
5. **Use `auth.uid()`, never a user id sent by the client.** That applies inside every security-definer function.
6. **Money is integer kobo.** Store and compute all amounts as `bigint` kobo (₦1 = 100 kobo). Format to Naira only in the UI.
7. **Never trust the client for money.** Prices, fees and payout amounts are computed in Postgres or Edge Functions, never in the browser.

## Auction rules

- **Opening bid** = `start_price` (the seller's asking price). The first bid must be `>= start_price`.
- **Minimum step**: set at listing time from the asking price and stored in `auctions.step`:
  - under ₦10,000 → ₦200
  - ₦10,000 to ₦19,999 → ₦500
  - ₦20,000 to ₦99,999 → ₦1,000
  - ₦100,000 and above → ₦2,500
  - Each later bid must be `>= current_bid + step`.
- **Soft close**: a bid placed in the last 30 seconds sets `ends_at = now() + 30s` (`greatest(ends_at, now() + interval '30 seconds')`). There is no cap on extensions.
- **Sellers can't bid** on their own lots (`seller_id <> auth.uid()`).
- **Only phone-verified users** can bid or sell.
- **No bids at close** → the lot is `unsold`. The seller can relist it into a later drop.
- **Paying**: the winner has **30 minutes** to pay. If they don't, the lot is offered to the **runner-up at their highest bid** (second-chance offer, also 30 minutes). The defaulter gets a **strike**. With **2 strikes**, they can't bid until reviewed.
- **Handover**: after payment, the buyer sees a 6-digit code. The seller enters it at pickup, and that releases the payout. Disputes are handled manually in the admin panel for v1.

Paystack card preauthorization (holds) is South Africa only, so we **don't** hold bidders' funds. The pay window and strikes are how we get winners to pay.

## Data model (v1)

```
profiles      id (= auth.users.id), display_name, phone, area, strikes, bidding_suspended, created_at
drops         id, title, opens_at, first_close_at, close_interval (default 1 min), status
auctions      id, drop_id, seller_id, title, description, condition, category, area,
              start_price, step, current_bid, leader_id, bid_count,
              starts_at, ends_at, closed_at, outcome (null|sold|unsold|defaulted|cancelled),
              created_at
auction_photos id, auction_id, storage_path, position
bids          id, auction_id, bidder_id, amount, created_at
orders        id, auction_id, buyer_id, seller_id, amount, commission, payout_amount,
              status (awaiting_payment|paid|handed_over|paid_out|expired|refunded|disputed),
              pay_by, paystack_reference, handover_code_hash, paid_at, handed_over_at, paid_out_at
payouts       id, order_id, seller_id, amount, paystack_transfer_code, status, created_at
seller_bank   seller_id, bank_code, account_number, account_name, paystack_recipient_code
notifications id, user_id, type, payload, read_at, created_at
push_subscriptions id, user_id, endpoint, keys, created_at
```

Notes:
- `area` holds a Lagos area (Lekki, Yaba, Ikeja, Surulere, etc.). It's shown on every lot because pickup distance matters.
- Store the handover code **hashed**. Show it only to the buyer.
- Keep the `bids` row history forever. Never delete bids.

## Key database functions

- `place_bid(p_auction_id uuid, p_amount bigint)` does one conditional `update ... returning` on `auctions`, then inserts into `bids`. If no row is updated, it returns a reason (`ended`, `not_started`, `too_low`, `own_lot`, `suspended`) by re-reading the row.
- `close_due_auctions()` is called by Supabase Cron every ~5 seconds. It finds `ends_at < now() and closed_at is null`, sets the outcome, creates an `orders` row with `pay_by = now() + 30 min` and queues notifications.
- `expire_unpaid_orders()` is called by cron every ~30 seconds. It handles 30-minute timeouts, issues strikes, creates second-chance offers and suspends users at 2 strikes.
- `confirm_handover(p_order_id uuid, p_code text)` can only be called by the seller. It checks the hash, marks the order `handed_over` and queues the payout.

## Realtime

- Use **Broadcast from Database** (a trigger calling `realtime.broadcast_changes` / `realtime.send`) on topic `auction:<id>`. Don't use Postgres Changes.
- The payload is `{ current_bid, leader_id, bid_count, ends_at, server_now }`.
- Client: `offset = server_now - Date.now()`. The countdown uses `Date.now() + offset`.
- On reconnect or tab focus, **refetch the auction row**. Assume mobile data drops often.
- Mask bidder identities in public payloads (e.g. "Bidder 4"). Show "You're winning" only to the leader.

## Payments (Paystack)

- **Buyer pays**: an Edge Function initializes the transaction, with `reference = order id`, amount from `orders.amount`, and channels card, bank transfer and USSD.
- **Webhook** (`/functions/v1/paystack-webhook`): verify the signature, then verify the transaction via the API. The order moves to `paid` only once. Ignore duplicates.
- **Payout**: after `confirm_handover`, create a transfer to the seller's recipient code for `payout_amount`. Track it in `payouts`.
- Commission: a flat % stored in config (start at 8%). Compute it in Postgres at order creation.
- Keys: `PAYSTACK_SECRET_KEY` exists only in Edge Function secrets. It must never be in the Next.js client bundle.

## Repo layout

```
/app                  Next.js routes (App Router)
  /(public)           home / drop page, lot page
  /sell               listing flow
  /me                 my bids, wins, orders, handover
  /admin              drops, disputes, strikes
/components           UI components (see DESIGN.md)
/lib                  supabase clients, money formatting, time sync
/supabase
  /migrations         SQL migrations (all schema, RLS, functions, cron)
  /functions          Edge Functions (paystack-init, paystack-webhook, payout, push)
  /tests              pgTAP / SQL tests
/tests                Playwright e2e + bid-race load test
```

## Commands

```
npm run dev                 # Next.js locally
supabase start              # local Supabase stack
supabase db reset           # re-run all migrations + seed
supabase migration new <n>  # new migration
supabase functions serve    # Edge Functions locally
npm run test                # unit
npm run test:race           # fires concurrent bids at place_bid
npm run test:e2e            # Playwright
```

## Testing requirements

- **Bid race test (required before any merge that touches bidding)**: fire 50 concurrent bids at one auction. Assert that exactly one bid is accepted per price level, that `current_bid` equals the max accepted bid and that no bid is accepted after `ends_at`.
- **Soft-close test**: a bid at T-10s moves `ends_at` to about T+20s. A bid at T-60s leaves it unchanged.
- **Idempotency tests**: run `close_due_auctions()` twice and replay a webhook twice. Neither should create duplicate orders or payments.
- **RLS tests**: an anon user or a logged-in user can't update `auctions` or `bids` directly.

## Conventions

- TypeScript strict mode. Generate DB types with `supabase gen types`.
- Every schema change is a migration. Never edit the remote DB by hand.
- Format money with a single `formatNaira(kobo)` helper. Times show in **Africa/Lagos**, and the DB stores UTC.
- Keep pages light: compress images on upload (max ~1600px, WebP) and lazy-load galleries. Users are on mobile data.
- UI follows **DESIGN.md**. Don't invent new colors or type styles.

## Build order

1. Schema + RLS + `place_bid` + race test
2. Drops + listing flow (photos, asking price → step)
3. Live lot page (Realtime, countdown, bid sheet)
4. `close_due_auctions` + notifications (in-app, push)
5. Paystack pay flow + webhook
6. Handover code + payouts
7. Strikes, second-chance offers, admin panel

## Out of scope for v1

Proxy/auto-bidding, delivery integration, in-app chat, ratings, multiple currencies. Design for them, but don't build them yet.
