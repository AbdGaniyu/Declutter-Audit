# DESIGN.md

The visual and interaction system for the app, **design system v2 ("Liquid Glass")**. Every screen uses these tokens and patterns. If something isn't covered here, add it here first, then build it.

Reference mockups: `docs/design/v2-screens.pdf`. Pages 1–5 and 14 are drawn in v2. Pages 6–13 and 15 (My bids, Sell, Pay, Verify, Orders, Admin) are still drawn in the old v1 style: use them for **layout and copy only**, and render them with v2 tokens. Where this file and the PDF disagree, this file wins.

## Design principles

1. **The clock is the hero.** On a lot page, price and time left are the two biggest things on screen. Everything else is secondary.
2. **Always say where you stand.** At any moment a bidder knows whether they're the top bidder, outbid, or out of time, without reading a sentence.
3. **Phone first, data-light.** Design for a 360px Android screen on mobile data. Desktop gets the same content with more room.
4. **Trust is visible.** Seller's area, verified phone, condition and real photos up front. Payment protection (the handover code) is explained where people pay.
5. **Urgency without panic.** One accent colour, kept for the last minute and the bid itself. Never flash, autoplay sound or shake hard.

## Two layers

- **Content layer:** lots sit on quiet, edge-to-edge neutral surfaces. No glass.
- **Control layer:** controls float above content in glass.

**Glass is on:** the top nav bar, the mobile tab bar, the sticky bid dock, the active filter pill, and photo controls (arrows, `1 / 3` counter). **Glass is never on:** lot cards, lists, text blocks.

### Material

| Property | Rule |
|---|---|
| Blur (thickness follows size) | chips 14px · nav bar and pills 24px · bid dock 36px |
| Fill | light `rgba(255,255,255,.58)` · dark `rgba(44,44,48,.55)` |
| Specular edge | `inset 0 1px 0` white (light: 100%, dark: 12%) |
| Sheen | top 46% of the element, a soft white-to-transparent gradient |
| Scroll edge | no divider lines under floating chrome; content fades under it with a soft blur |
| Reduced transparency | `prefers-reduced-transparency: reduce` → solid `--surface` fill, no blur |
| More contrast | `prefers-contrast: more` → solid fill plus a 1.5px `--label` rim at 30% |

## Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F5F5F7` | `#000000` | App background |
| `--surface` | `#FFFFFF` | `#1C1C1E` | Grouped lists, panels, sheets |
| `--label` | `#1D1D1F` | `#F5F5F7` | Primary text, primary (black) buttons |
| `--secondary` | `#6E6E73` | `#A1A1A6` | Secondary text, metadata, footnotes |
| `--fill` | `rgba(120,120,128,.12)` | `rgba(120,120,128,.24)` | Photo wells, neutral pills, secondary buttons, disabled tracks |
| `--hairline` | `rgba(60,60,67,.14)` | `rgba(84,84,88,.6)` | 0.5px inset list separators only |
| `--accent` | `#D70015` | `#D70015` | Accent **fill**: slide-to-bid track, ending-soon pill |
| `--accent-text` | `#D70015` | `#FF453A` | Accent **text**: ending-soon countdown numbers |
| `--focus` | `#0071E3` | `#0A84FF` | Focus rings only |

Dark mode follows the system (`prefers-color-scheme`). There's no in-app toggle in v1.

### One accent

Crimson is only for two things:
1. **Ending soon**: a countdown with 60 seconds or less.
2. **The bid action**: slide to bid, and the bid button in "Bid again" shortcuts.

Never for status, badges, links or decoration. Top bidder, outbid, won and lost are **monochrome**, told apart by icon and label.

### Contrast (checked)

| Pair | Ratio |
|---|---|
| White on `#D70015` (bid track, ending pill) | 5.38:1 |
| `#D70015` text on `#F5F5F7` | 4.94:1 |
| `#FF453A` text on black | 6.16:1 |
| `#6E6E73` secondary on `#F5F5F7` | 4.66:1 |

`#FF3B30` only reaches 3.55:1 under white text, so fills use `#D70015`.

## Typography

SF Pro on Apple devices, **Inter** everywhere else: `font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", var(--font-inter), system-ui, sans-serif`. Inter is self-hosted with `next/font`. Headings are bold and tight; body is plain.

| Role | Size / line | Weight | Tracking |
|---|---|---|---|
| Large title (drop title) | 56/60 desktop · 34/40 mobile | 700 | −2.5% |
| Title (section, screen) | 28/34 desktop · 24/30 mobile | 700 | −2% |
| Headline (lot title, row title) | 17/22 | 600 | 0 |
| Body | 17/25 | 400 | 0 |
| Subhead (meta lines) | 15/20 | 400 | 0 |
| Footnote | 13/18, `--secondary` | 400 | 0 |
| Eyebrow (`LOT 07 · YABA · GOOD`) | 12/16, uppercase | 600 | +6% |

**Numerals** (prices, timers, bid counts, codes) always use `font-variant-numeric: tabular-nums`, so digits never shift as they tick.

| Number | Size |
|---|---|
| Lot price (panel / dock) | 48/52 desktop · 40/44 mobile, 700 |
| Lot countdown (panel / dock) | same as lot price |
| Next-to-close timer (drop hero) | 56/60, 700 |
| Card price | 20/24, 700 |
| Handover code | 40/44, 700, +0.3em tracking |

Money format: `₦45,500`. No kobo in the UI unless non-zero. Never "NGN" in body text.

## Shape

Continuous corners with `corner-shape: squircle` (Chromium 139+); other browsers fall back to plain rounded corners.

| Radius | Use |
|---|---|
| 14px | Thumbnails |
| 16px | Controls (inputs, segmented controls, chips) |
| 20px | Grouped lists and panels |
| 24px | Cards, media (lot photos) |
| 28px | Bid dock, sheets, floating panel |

Buttons and pills are true capsules (`999px`). **No 1px borders.** Groups separate by fill and space; rows in a list separate by 0.5px inset hairlines. The only shadow is on floating glass and the desktop bid panel: `0 8px 32px rgba(0,0,0,.08)` (dark: `rgba(0,0,0,.5)`).

## Spacing and layout

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 48, 64.
- Page padding: 16px mobile, 24px tablet, 32px desktop. Browse content max-width 1136px. Lot page: 2 columns on desktop (gallery ≈ 60%, bid panel ≈ 40%, panel sticky), 1 column on mobile.
- Lot grid: 2 columns under 768px, 3 at 768px, 4 from 1024px.
- Tap targets ≥ 44×44px. The slide-to-bid control is 56px tall.

## Navigation

- **Top bar (all sizes):** a floating glass capsule, 16px from the top on desktop and 8px on mobile.
  - Left: on top-level pages, the logo mark plus the section title ("Tonight" on the drop page). On detail pages, a glass back pill with the parent's name (e.g. "‹ Friday Night Clear-out").
  - Desktop centre: Drops · My bids · Sell · Orders (the current one is `--label` 600, the others `--secondary`).
  - Right: search, notifications (bell with an unread dot and count for screen readers), avatar (or "Sign in").
- **Mobile tab bar:** a floating glass bar at the bottom with Drops · My bids · Sell · Orders (icon above label). It's hidden on the lot page (the bid dock takes the bottom) and inside the sell flow.
- **Admin:** a left sidebar (Drops, Lots, Disputes with an open count, Strikes, Users) on a plain `--surface` background, no glass.

## Motion: springs

Use springs, described as damping ratio · response.

| Spring | Values | Use |
|---|---|---|
| **Calm** (default) | 1.0 · 0.35s | Taps, filters, digit roll, card → lot. No bounce. |
| **Flick** | 0.77 · 0.32s | Only after momentum: gallery swipe, bid handle release, dock drawer release. |

- **Interruptible:** grab mid-flight and motion restarts from where it is.
- **Velocity handoff:** release speed seeds the spring. No seam.
- **Press:** scale 0.97 in 100ms on pointer-down, then springs back.
- **Reduced motion:** cross-fades only. Drags still track 1:1.

## Core components

### Countdown pill

| State | Rule | Look |
|---|---|---|
| Live | more than 60s left | `--fill` capsule, clock icon, `mm:ss` in `--label` |
| Ending soon | 60s or less | `--accent` capsule, white clock and `0:SS` |
| Extended | a late bid moved `ends_at` | ending-soon pill plus a `+30s` accent pill that pops in, holds 1.5s and fades |
| Ended | after `ends_at` | `--fill` capsule, "Ended" in `--secondary`; the price label flips to "Sold for" or "Unsold" |
| Upcoming | before `starts_at` | `--fill` capsule, "Opens 7:00pm" |
| Paused | realtime connection dropped | `--fill` capsule, spinner, "Reconnecting…"; the bid control goes to Paused |

On the lot page the large countdown is plain numerals (no capsule): `--label` normally, `--accent-text` when ending soon, `--secondary` "Ended" after close.

The countdown runs on the server-time offset (see CLAUDE.md). Never show a stale timer as live.

### Live price

Large numerals. When the price changes, **each digit rolls on its own spring** (calm). A soft sheen crosses the panel when a new high bid lands or you're outbid. Reduced motion: an instant change with a brief `--fill` cross-fade.

### Quick bid chips

Three segmented chips above the slider: **+1 step, +2 steps, +5 steps** of the lot's own `step`. Each chip shows the increment (`+₦500`) and the resulting total underneath (`₦46,000`). The selected chip is `--label` fill with white text; the others are `--fill`. The first chip is selected by default and the slider's amount follows the selection. With no bids yet, the first chip is the opening bid: "Opening" over `₦38,000`.

### Slide to bid

A 56px capsule: an `--accent` track, a white thumb with an arrow, and the label "Slide to bid ₦46,000".

| State | Look |
|---|---|
| Ready | thumb at the start, label "Slide to bid ₦X" |
| Armed | thumb past 85%, label "Release to bid ₦X", one haptic tick (`navigator.vibrate(8)` where supported) |
| Placing | thumb at the end with a spinner, label "Placing bid…", input locked |
| Paused | `--fill` track, grey thumb, "Bidding paused" (reconnecting) or the reason (verify phone, own lot, suspended, ended) |

Behaviour: the thumb lifts on touch. After 10px it tracks 1:1 and rubber-bands past the ends. Releasing past 85% bids. A flick whose projected end passes 85% also bids. Letting go early springs it home at your speed (flick spring). **Tap or Enter also bids** (the footnote says "Slide or tap. Bids are final."). It's a single focusable `button` with `aria-label="Bid ₦46,000"`, so keyboard and screen-reader users never have to drag.

### Where you stand

A single line under the price, always with an icon or a word, never colour alone.

| State | Look |
|---|---|
| Top bidder | check-circle icon, "You're the top bidder" |
| Outbid | `--label` capsule with an up-arrow and "Outbid", then "₦46,000 now. Bid again?" |
| Won | "You won this lot", then a `--label` capsule button "Pay within 29:41" (counts down to `pay_by`) |
| Lost | "Sold to another bidder"; the price label flips to "Sold for" |
| Rejected | alert-circle icon, "Someone bid ₦46,000 first. Slide again for ₦46,500." The slider resets with the new minimum. |
| Not bidding | nothing |

### Lot card

The photo sits in a `--fill` well (24px radius, 4:3, object-fit contain or cover). Under it: the title (headline, 2 lines max), then the price (card numerals) on the left and the countdown pill on the right. No border, no shadow. Hover (pointer devices only): the photo eases up 4px, and the area, condition and bid-count pills rise in over the bottom of the photo as small glass chips. Live lots don't need a dot: the pill says it.

### Lists and grouped panels

`--surface` panels with a 20px radius. Rows are 44px or more, label in `--secondary` on the left, value in `--label` 600 on the right, separated by 0.5px inset hairlines (used on the lot facts, pay summary and settings).

### Buttons

| Kind | Look |
|---|---|
| Primary | `--label` fill, `--bg` text, capsule, 50px (56px for page-level CTAs) |
| Secondary | `--fill` fill, `--label` text, capsule |
| Bid | the slide-to-bid control (crimson). The only crimson button. |
| Text | `--label` 600, no fill |
| Disabled | `--fill` fill, `--secondary` text |

### Segmented control and filter pills

Tabs (My bids: Live / Won / Lost; Orders: Awaiting payment / Ready for pickup / Paid out; Admin: All / Live / Closed) use a `--fill` track with a `--surface` (light) or `--label` (dark contrast) selected segment, and a count after the label. Drop-page filter pills: plain text pills, and the active one is a glass capsule.

### Badges and status

Status words in lists (`READY FOR PICKUP`, `ENDED`, `UNSOLD`, `LIVE`, `UPCOMING`) are eyebrow text: a `--fill` capsule, or a `--label` capsule for the one that needs action. Area, condition and category pills are sentence-case `--fill` capsules. No green, amber or orange anywhere.

### Handover code

The buyer sees six large digits (numerals, 40px, letter-spaced) on a `--surface` panel, with "Give this code to the seller only when you have the item." The seller gets a six-box code input (16px-radius boxes, `--fill`, focused box with a 2px `--label` ring) and a big **Confirm handover** primary button. 5 tries per rolling hour: "Five tries an hour keeps the money safe."

### Trust card

A `--fill` panel with a shield icon: "Your money is held until you collect" and one plain line. On Pay it expands into the three numbered steps.

## Key screens

1. **Drop page ("Tonight")** (PDF p.1, p.3): eyebrow `● LIVE NOW · DROP NO. 14` (or `OPENS 7:00PM · DROP NO. 15`), the drop title as a large title, the line "38 lots from Yaba, Surulere, Ikeja and Lekki. One closes every 2 minutes until 9:00pm.", and on the right (below on mobile) "Next to close · Armchair" with a big timer. Then filter pills (All, each category with live lots, Ending soon) and a total bid count on the right, the lot grid sorted by close time, and an **Up next** grouped list (date block, title, "24 lots · Opens 7:00pm", Remind me).
2. **Search:** the nav search icon opens a glass search field over the page. It searches lot titles and descriptions in the current and upcoming drops, and results use the lot card grid. Empty state: "Nothing matches "lamp" tonight."
3. **Lot page** (p.2, p.4): gallery (swipe, arrows, `1 / 3`, thumbnails), then on desktop a floating panel on the right with eyebrow, title, price + time, where-you-stand, chips + slide to bid, and collapsible **Bid history** ("13 bids ˅", masked bidders, last 10). On mobile the title sits under the gallery and the bid block is a **glass dock** at the bottom with a grabber: collapsed it shows price, time, standing and the slider; dragged up it reveals the chips and bid history. Below: About this lot, the facts list (Condition, Pickup, Starting bid, Lot 07 of 38), the seller row (initial avatar, name, verified icon, "Phone verified · Member since March 2024") and the trust card.
4. **Sell flow** (p.7, p.9, p.11, p.12): the top bar is "✕ Sell an item … Step 1 of 3" with a 3-segment progress bar. Photos (3–8, camera-first "Take photos" panel, gallery tile, COVER tag on the first photo, a tips panel) → Details (title with a 60-character counter and hint, category, pickup area, condition segmented control with a one-line meaning, asking price with "Bidding starts at your price. Bids then go up in ₦200 steps.", optional description) → Drop (choose a drop) → **Check and list** (photo collage, title, pills, starting bid, bid steps, drop with Change, trust card) → "Your lot goes live Fri 7pm". A sticky primary Continue / List my lot at the bottom.
5. **My bids** (p.6): segmented Live / Won / Lost with counts. Rows: thumbnail, status (Top bidder / Outbid / Won / Lost, monochrome with icon), time pill, title, "Your bid ₦45,500". Outbid rows expand with "Top bid now ₦32,000" and a **Bid ₦32,500** button that opens the lot with that amount preselected.
6. **Pay** (p.8): "Pay within 24:20 or it goes to the next bidder." (the timer turns accent in the last 60s), the order summary (thumbnail, "LOT 07 · YOU WON", title, "From Tolu · Yaba", winning bid, **You pay**), the three-step trust card, and a sticky **Pay ₦46,500** primary button with a lock icon. Footnote: "Secure checkout by Paystack · card, transfer or USSD".
7. **Orders, for sellers** (p.13): segmented Awaiting payment / Ready for pickup / Paid out. A ready order card shows the buyer row ("Chidi · Paid 7:51pm · money held"), a meet-up note, the handover code input and Confirm handover.
8. **Verify phone** (p.10): "Verify your phone", "Enter the 6-digit code we sent to 0803 ••• 2211.", "Change number", six code boxes. Shown the first time someone bids or sells. Don't block browsing.
9. **Admin** (p.15): sidebar; **Drops** is a week calendar (‹ › to move weeks, "+ New drop"; day cards show No drop / ENDED / LIVE (a `--label` card) / UPCOMING with lots, unsold count and time), then the selected drop's lot table (Lot, Item with thumb + seller · area, Current, Bids, Closes, Status) with All / Live / Closed, and on the right the **Disputes** list (type eyebrow, lot, summary, Review) and **Strikes this week**. **Lots:** a searchable table of all lots across drops, with cancel. **Users:** search by phone or name; shows strikes, suspended state and role, with Review (reset strikes) and Suspend.

## Copy tone

Short, warm, plain Nigerian English. Use the money and the time, not adjectives.
- Yes: "Outbid. ₦46,000 now. Bid again?"
- Yes: "Pay within 30 minutes or it goes to the next bidder."
- No: "Oops! Looks like someone swooped in! 😅"

## Accessibility

- The countdown has `aria-live="polite"` only at 60s, 30s, 10s and the end. Don't announce every second.
- Never use colour alone for status. Every state has an icon or a word.
- Every focus state is visible: a 2px `--focus` ring, 2px offset.
- Slide to bid is a real button: Tap, Enter and Space bid.
- Honour `prefers-reduced-motion`, `prefers-reduced-transparency` and `prefers-contrast` (see Material and Motion).

## Not decided yet

- The app name and logo. The nav shows the mark plus the section name ("Tonight"). The PWA name stays "Declutter Auction" until this is decided.
- The illustration style for empty states. Default for now: Lucide icons at 1.75 stroke.
