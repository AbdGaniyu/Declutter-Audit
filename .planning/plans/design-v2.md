# Plan: design-v2 (Liquid Glass across the app)

**Spec**: none. Planned from the request; `DESIGN.md` (v2) acts as the spec, with mockups in `docs/design/v2-screens.pdf`.
**Epic**: none
**Created**: 2026-11-25
**Status**: draft
**Stack**: Next.js 15 App Router + Tailwind 3 (web) · Supabase Postgres functions + RLS (backend). Full-stack: DB first, then UI.

## Decisions already made (with the user)

| Decision | Choice |
|---|---|
| Style scope | v2 on every screen. PDF pages 6–13 and 15 guide layout and copy only. |
| Step tiers | ₦200 under ₦10k · ₦500 for ₦10k–₦19,999 · ₦1,000 for ₦20k–₦99,999 · ₦2,500 from ₦100k. CLAUDE.md updated. |
| Quick-bid chips | +1 / +2 / +5 of the lot's stored `step`. The "Opening" chip when there are no bids. |
| In scope | Slide to bid, dark mode (follows the system), search + category filters, admin Lots + Users. |

## Open questions for Gate 2

1. **What "Orders" in the nav means.** The PDF's Orders screen is the seller view. Proposal: `/me/orders` gets a top switch, **Buying | Selling**, shown only when the user has both. Selling uses the PDF segments (Awaiting payment / Ready for pickup / Paid out) and replaces `/me/sales` (which redirects there).
2. **Existing lots keep their step.** `auctions.step` is stored at listing time, so the new ₦200 tier applies to new listings and relists only. Live lots aren't recalculated.
3. **Drop number.** "DROP NO. 14" needs a stable number. Proposal: a new `drops.number` column, backfilled by `opens_at` order and assigned from a sequence on insert. Cancelled drops keep their number, leaving a gap.

## Architecture

The rules are unchanged: every bid goes through `place_bid`; slide to bid only calls the same RPC. The UI never computes money; chip amounts come from the stored `step` and `min_next`, and the server re-validates them.

### New and changed database objects (migration `20261125000100_design_v2.sql`)

| Object | Type | Purpose |
|---|---|---|
| `public.step_for` | function (replace) | Add the ₦200 tier under ₦10k |
| `drops.number` + `drops_number_seq` | column + sequence + default | Stable "Drop No." |
| `public.current_drops` | function (replace) | Also return `number`, `areas text[]`, `close_interval`, `total_bids` |
| `public.get_lot` | function (replace) | Also return `drop_number`, `slot`, `drop_lot_count` (for "Lot 07 of 38") |
| `public.search_lots(p_query text, p_limit int)` | function, security invoker | Lots in live and upcoming drops whose title or description matches (`ilike`, trigram index); same shape as the lot card |
| `pg_trgm` GIN index on `auctions(title, description)` | index | Search speed |
| `public.admin_drops_week(p_week_start date)` | function, admin only | The 7 day cells: drop, status, lots, unsold count, opens time |
| `public.admin_lots(p_query, p_status, p_offset, p_limit)` | function, admin only | All lots across drops, paginated |
| `public.admin_users(p_query, p_offset, p_limit)` | function, admin only | Search by phone or name: strikes, suspended, admin, joined |
| `public.admin_strikes_week()` | function, admin only | Strikes issued in the last 7 days, with masked bidder number or seller name and the reason |

Admin functions check `private.is_admin(auth.uid())` like the existing `admin_*` functions, and are revoked from `anon`.

### New frontend pieces

| Component | Type | Purpose |
|---|---|---|
| `lib/spring.ts` | util | Damped-spring solver (calm 1.0·0.35s, flick 0.77·0.32s), velocity handoff, reduced-motion check |
| `lib/slide.ts` | util | Pure slide-to-bid logic: 10px slop, 85% arm, flick projection, rubber band |
| `lib/bidding.ts` | util | `chipAmounts(lot)`, i.e. +1/+2/+5 steps or Opening (pure) |
| `components/Glass.tsx` | component | Glass surface (thickness: chip / nav / dock) |
| `components/TopBar.tsx` | component | Floating glass nav: logo + section, or back pill; desktop links; search, bell, avatar (replaces `Header`) |
| `components/TabBar.tsx` | component | Mobile glass tab bar (Drops · My bids · Sell · Orders) |
| `components/Segmented.tsx` | component | Segmented control with counts |
| `components/RollingPrice.tsx` | component | Per-digit spring roll + sheen |
| `components/CountdownPill.tsx` | component | Live / Ending soon / Extended / Ended / Upcoming / Paused |
| `components/SlideToBid.tsx` | component | Ready / Armed / Placing / Paused; tap and Enter bid |
| `components/QuickBidChips.tsx` | component | Three chips, controlled selection |
| `components/WhereYouStand.tsx` | component | Top bidder / Outbid / Won / Lost / Rejected (replaces `StatusBanner`) |
| `components/BidControls.tsx` | component | Price + time + standing + chips + slider, used by both containers below |
| `components/BidPanel.tsx` | component | Desktop floating panel with Bid history collapse |
| `components/BidDock.tsx` | component | Mobile glass dock with grabber drawer (flick spring) |
| `components/BidHistory.tsx` | component | Collapsible, masked, last 10 |
| `components/GroupedList.tsx` | component | Facts list rows with inset hairlines |
| `components/TrustCard.tsx` | component | Compact, and 3-step for Pay |
| `components/SellerRow.tsx` | component | Avatar initial, verified, member since |
| `components/SearchOverlay.tsx` | component | Glass search field + results grid, debounced `search_lots` |
| `components/FilterPills.tsx` | component | All / categories / Ending soon (client-side filter) |
| `app/admin/layout.tsx` + `components/admin/Sidebar.tsx` | layout | Admin shell |
| `app/admin/{lots,users,disputes,strikes}/page.tsx` | pages | New admin sections |

### Files to change

| File | What changes | Why |
|---|---|---|
| `app/globals.css` | v2 light/dark tokens, glass and squircle utilities, reduced-transparency and contrast media queries, spring keyframe fallbacks | Tokens |
| `tailwind.config.ts` | New colour, type, radius and spacing scales; **temporary aliases** for old names (`ink`, `line`, `live`, …) so the app keeps rendering mid-migration | Tokens |
| `app/layout.tsx` | Inter via `next/font`, system font stack, `themeColor` per colour scheme, TopBar + TabBar, bottom padding for the tab bar | Shell |
| `public/manifest.webmanifest` | `background_color` / `theme_color` | Tokens |
| `lib/money.ts` + `tests/unit/money.test.ts` | `previewStep` mirrors the new tier | Step rule |
| `lib/lot.ts`, `lib/database.types.ts` | New `get_lot` fields; regenerated types | DB changes |
| `components/{Button,Badge,Price,Countdown,LotCard,PhotoGallery,CodeInput,Field,NotificationBell,PhoneVerify,RemindMe,PushToggle,DisputeButton,SignOutButton}.tsx` | Restyle to v2 | Style |
| `components/DropBoard.tsx`, `app/(public)/page.tsx` | Hero (eyebrow, drop no., subtitle, next to close), filters, total bids, Up next list | Drop page |
| `components/LiveLot.tsx`, `app/(public)/lot/[id]/page.tsx` | Two-column desktop / dock mobile layout using the new bid components | Lot page |
| `app/me/bids/*`, `app/me/orders/**`, `app/me/sales/*`, `app/me/{page,bank,notifications}/*`, `app/login/*` | v2 layouts per PDF p.6, 8, 10, 13 | Account screens |
| `app/sell/SellForm.tsx`, `app/sell/page.tsx` | Steps with progress bar, camera panel, tips, condition segmented, counter, Check and list | Sell flow |
| `app/admin/AdminPanel.tsx`, `app/admin/page.tsx` | Split into the shell + Drops week view | Admin |
| `tests/e2e/*.spec.ts`, `tests/e2e/helpers.ts` | Selectors for the slider, tabs and admin routes | Tests |
| **Delete** at the end: `components/{Header,StatusBanner,BidSheet,Sheet}.tsx`, the old token aliases | | Cleanup |

## Tasks

Each task is one commit with at most 3 files (regenerated types excepted), and ends green on `typecheck`, `lint` and `npm test`.

### Phase 1: Database (sequential)

| # | Task | Files | Test |
|---|---|---|---|
| 1 | `step_for` ₦200 tier; pgTAP for all 4 tiers + boundaries (₦9,999 / ₦10,000 / ₦19,999 / ₦20,000) | `migrations/20261125000100_design_v2.sql`, `tests/010_design_v2_test.sql` | pgTAP |
| 2 | `previewStep` mirror + unit tests on the same boundaries | `lib/money.ts`, `tests/unit/money.test.ts` | Vitest |
| 3 | `drops.number` (backfill + sequence) and the new `current_drops` / `get_lot` fields | migration, pgTAP | numbers unique and ordered; get_lot returns slot/count |
| 4 | `search_lots` + trigram index | migration, pgTAP | matches title/description; excludes ended drops and cancelled lots; anon allowed; `%` and `_` in the query escaped |
| 5 | `admin_drops_week`, `admin_lots`, `admin_users`, `admin_strikes_week` | migration, pgTAP | non-admin gets `not_authorized`; pagination; search by phone |
| 6 | Regenerate `lib/database.types.ts`; extend the `Lot` type | `lib/database.types.ts`, `lib/lot.ts` | typecheck |

### Phase 2: Foundations (depends on nothing; can run alongside Phase 1)

| # | Task | Files | Test |
|---|---|---|---|
| 7 | v2 tokens light + dark, glass and squircle utilities, media queries; Tailwind scales + temporary aliases | `app/globals.css`, `tailwind.config.ts` | build; screenshots still render |
| 8 | Inter font, system stack, themeColor per scheme, manifest colours | `app/layout.tsx`, `public/manifest.webmanifest` | build |
| 9 | `lib/spring.ts` + tests (settles, no overshoot at damping 1.0, velocity handoff, reduced motion → instant) | `lib/spring.ts`, `tests/unit/spring.test.ts` | Vitest |
| 10 | `lib/slide.ts`, `lib/bidding.ts` + tests (slop, arm at 85%, flick projection, early release goes home; chips +1/+2/+5 and Opening) | `lib/slide.ts`, `lib/bidding.ts`, `tests/unit/bidding.test.ts` | Vitest |

### Phase 3: Shared components (depends on 7–9)

| # | Task | Files |
|---|---|---|
| 11 | `Glass`, `Button` (primary/secondary/text/disabled, press 0.97), `Badge` pills | `Glass.tsx`, `Button.tsx`, `Badge.tsx` |
| 12 | `Segmented`, `GroupedList`, `TrustCard` | 3 new files |
| 13 | `CountdownPill` (6 states, aria-live at 60/30/10/0) + the large countdown in `Countdown` | `CountdownPill.tsx`, `Countdown.tsx`, `tests/unit/time.test.ts` |
| 14 | `RollingPrice` (per-digit spring, sheen, reduced motion) replacing `Price` internals | `RollingPrice.tsx`, `Price.tsx` |
| 15 | `TopBar` + `TabBar` + `NotificationBell` restyle; wire into the layout | `TopBar.tsx`, `TabBar.tsx`, `app/layout.tsx` |
| 16 | `LotCard` v2 with hover chips; `SellerRow` | `LotCard.tsx`, `SellerRow.tsx` |

### Phase 4: Drop page and search (depends on 3, 4, 6, 11–16)

| # | Task | Files |
|---|---|---|
| 17 | Drop hero (eyebrow + drop no., areas/interval/end-time line, next to close) and Up next list | `DropBoard.tsx`, `app/(public)/page.tsx`, `RemindMe.tsx` |
| 18 | `FilterPills` (categories present + Ending soon ≤ 10 min) and the total bid count | `FilterPills.tsx`, `DropBoard.tsx` |
| 19 | `SearchOverlay` from the TopBar search icon (debounce 250ms, Esc to close, empty state) | `SearchOverlay.tsx`, `TopBar.tsx` |

### Phase 5: Lot page (depends on 6, 10–16)

| # | Task | Files |
|---|---|---|
| 20 | `SlideToBid` (pointer events, states, tap/Enter/Space, `aria-label`, vibrate tick) | `SlideToBid.tsx` |
| 21 | `QuickBidChips` + `WhereYouStand` | 2 new files |
| 22 | `BidControls` + `BidHistory` (place_bid call, reason → copy via `lib/errors.ts`, rejected → reset to new min) | `BidControls.tsx`, `BidHistory.tsx`, `lib/errors.ts` |
| 23 | `BidPanel` (desktop) + `BidDock` (mobile drawer, flick spring, Paused while reconnecting) | 2 new files |
| 24 | `PhotoGallery` v2 (arrows, `1 / 3`, thumbnails, swipe with flick) | `PhotoGallery.tsx` |
| 25 | `LiveLot` layout (2-column / dock), facts list, seller row, trust card; back pill to the drop; `?amount=` preselects a chip | `LiveLot.tsx`, `app/(public)/lot/[id]/page.tsx` |
| 26 | Update the bidding e2e for the slider (keyboard path + pointer drag path) | `tests/e2e/bidding.spec.ts`, `tests/e2e/helpers.ts` |

### Phase 6: Account screens (depends on 11–16; tasks 27–31 can run in parallel)

| # | Task | Files |
|---|---|---|
| 27 | My bids: segmented with counts, monochrome rows, outbid expansion "Bid ₦X" → `/lot/id?amount=` | `app/me/bids/page.tsx`, `BidTabs.tsx` |
| 28 | Pay screen (PDF p.8) + buyer handover code panel | `app/me/orders/[id]/page.tsx`, `BuyerOrderActions.tsx` |
| 29 | Orders: Buying / Selling switch; selling segments + ready card + `HandoverForm`/`CodeInput` (open question 1) | `app/me/orders/page.tsx`, `app/me/sales/*`, `CodeInput.tsx` |
| 30 | Verify phone (PDF p.10) + login | `PhoneVerify.tsx`, `app/login/*` |
| 31 | Me, Bank, Notifications restyle | `app/me/page.tsx`, `app/me/bank/BankForm.tsx`, `app/me/notifications/page.tsx` |
| 32 | Sell flow: progress bar + Photos step (camera panel, COVER, tips) | `app/sell/SellForm.tsx` (+ extracted `app/sell/steps/Photos.tsx`) |
| 33 | Sell flow: Details (counter, condition segmented, step hint from `previewStep`) + Drop + Check and list | `app/sell/steps/{Details,Drop,Review}.tsx` |

### Phase 7: Admin (depends on 5, 11–12)

| # | Task | Files |
|---|---|---|
| 34 | Admin shell: layout + sidebar (open-dispute count) | `app/admin/layout.tsx`, `components/admin/Sidebar.tsx`, `app/admin/page.tsx` |
| 35 | Drops: week calendar + lot table (All/Live/Closed) + side panels (disputes, strikes this week) | `app/admin/AdminPanel.tsx` → `components/admin/{WeekCalendar,DropLotsTable}.tsx` |
| 36 | Disputes and Strikes pages (reusing the existing release/refund/review actions) | `app/admin/disputes/page.tsx`, `app/admin/strikes/page.tsx` |
| 37 | Lots page (search, status filter, pagination, cancel) | `app/admin/lots/page.tsx` |
| 38 | Users page (search, review, suspend) | `app/admin/users/page.tsx` |
| 39 | Update the admin e2e for the new routes | `tests/e2e/listing-admin.spec.ts` |

### Phase 8: Cleanup and verification (depends on everything)

| # | Task | Files |
|---|---|---|
| 40 | Delete `Header`, `StatusBanner`, `BidSheet`, `Sheet` and the old token aliases; grep for green, amber and orange hexes | several deletions, `tailwind.config.ts` |
| 41 | New e2e: search, dark-mode smoke (`colorScheme: 'dark'`), filters | `tests/e2e/browse.spec.ts` |
| 42 | Visual QA: Playwright screenshots at 375 / 768 / 1440 in light and dark, compared by eye against the PDF; fix gaps | scratch only |
| 43 | Full suite: typecheck, lint, unit, `test:db`, `test:race`, `test:e2e`, `next build` | none |

### Parallel vs sequential

| Parallel group | Tasks | Why |
|---|---|---|
| A | Phase 1 (1–6) ∥ Phase 2 (7–10) | DB and CSS/util files don't overlap |
| B | 11, 12, 13, 14, 16 | Independent component files (15 touches the layout, run it alone) |
| C | 27–31 | Separate routes |
| D | 36, 37, 38 | Separate admin routes |

| Sequential | Depends on | Why |
|---|---|---|
| 17–19 | 3, 4, 6, 11–16 | Need drop number/search RPCs and shared components |
| 20–26 | 10, 13, 14 | Slider and chips use the pure logic and the price/countdown |
| 25 | 20–24 | Assembles the lot page |
| 35 | 5, 34 | Needs the admin RPCs and the shell |
| 40 | everything | Aliases removed last |

## Testing plan

| Layer | Tests | Ties to |
|---|---|---|
| Data (pgTAP `010_design_v2_test.sql`) | Step tiers at every boundary; `drops.number` unique + ordered, new drops get the next number; `get_lot` drop_number/slot/count; `search_lots` match, exclusions, wildcard escaping, anon access; admin RPCs reject non-admins, paginate, search phone/name; strikes-week window | Step rule, drop no., search, admin |
| Bidding invariants | Rerun `test:race` and the existing pgTAP bidding tests unchanged: slide to bid must not touch `place_bid` | Golden rule 1 |
| Logic (Vitest) | `previewStep` boundaries; spring (settle, no overshoot, handoff, reduced motion); slide (slop, arm, flick projection, early release); `chipAmounts` (+1/+2/+5, Opening, after broadcast) | Chips, slider, motion |
| E2E (Playwright) | Bidding via keyboard (Enter on slider) and pointer drag; outbid shows "Outbid · ₦X now"; rejected bid resets the slider; listing flow with new steps; Pay → handover → payout loop still passes; admin Drops/Lots/Users routes; non-admin blocked; search; dark-mode smoke | All screens |
| UI states | Each screen at 375/768/1440, light and dark; empty states (no drop tonight, no bids, no orders, no search results); loading skeletons; errors (upload failed, bid rejected, reconnecting) | DESIGN.md "Design all states" |
| Accessibility | Slider operable by keyboard and screen reader; focus rings visible on glass; countdown aria-live cadence; colour never the only status signal; reduced motion/transparency/contrast emulated in Playwright | DESIGN.md Accessibility |

## Gate 2

**Architecture**
- [x] Follows existing patterns: Postgres functions behind RPC, security-definer admin checks, server components fetching via `getServerSupabase`, client components for live state
- [x] Layering respected: UI → RPC → SQL; no money computed in the browser (chip amounts derive from server `step`/`min_next`, re-validated by `place_bid`)
- [x] Components in `components/`, utils in `lib/`, routes in `app/`, migrations and tests in `supabase/`

**Task breakdown**
- [x] All files to change are listed
- [x] All new files are listed with locations
- [x] Tasks are small (≤ 3 files each; regenerated types excepted)
- [x] Dependencies are clear
- [x] Parallel vs sequential marked

**Testing**
- [x] Data layer tests planned (pgTAP 010)
- [x] Business logic tests planned (Vitest: step, spring, slide, chips)
- [x] API/integration tests planned (RPC auth + e2e)
- [x] UI tests planned (e2e + screenshot QA, light/dark, 3 widths)
- [x] Edge cases covered (tier boundaries, wildcard search, rejected bid, reconnecting, empty states, reduced motion)

**Gate 2: passed**, pending answers to the 3 open questions above.
