# DESIGN.md

The visual and interaction system for the app. Every screen uses these tokens and patterns. If something isn't covered here, add it here first, then build it.

## Design principles

1. **The clock is the hero.** On a lot page, price and time left are the two biggest things on screen. Everything else is secondary.
2. **Always say where you stand.** At any moment a bidder should know whether they're winning, outbid, or out of time, without reading a sentence.
3. **Phone first, data-light.** Design for a 360px Android screen on mobile data. Desktop gets the same layout in a wider column.
4. **Trust is visible.** Show the seller's area, verified phone, item condition and real photos up front. Payment protection (the handover code) is explained right where people pay.
5. **Urgency without panic.** Use motion and color to mark the last seconds. Never flash, shake, or autoplay sound.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAF7F2` | App background (warm off-white) |
| `--surface` | `#FFFFFF` | Cards, sheets |
| `--ink` | `#14110F` | Primary text, primary buttons |
| `--ink-muted` | `#6B645C` | Secondary text, metadata |
| `--line` | `#E7E1D8` | Borders, dividers |
| `--live` | `#E4572E` | Live badge, countdown in final minute, main bid button |
| `--live-soft` | `#FDE9E2` | Live tint backgrounds |
| `--winning` | `#1F8A4C` | "You're winning" state |
| `--winning-soft` | `#E3F4EA` | Winning banner background |
| `--outbid` | `#C98A00` | "You've been outbid" state |
| `--outbid-soft` | `#FDF3DC` | Outbid banner background |
| `--ended` | `#8A847C` | Ended / unsold states |
| `--focus` | `#2E6BE4` | Focus rings, links |

Dark mode is v2. Text contrast must meet WCAG AA at minimum. White text on `--live` is only allowed at 16px semibold or larger.

## Typography

| Role | Font | Weight / size |
|---|---|---|
| Display (drop titles, big headings) | Bricolage Grotesque | 700, 28/32 |
| Heading | Bricolage Grotesque | 600, 20/26 |
| Body | Manrope | 400 / 500, 15/22 |
| Label / caption | Manrope | 600, 12/16, uppercase, +0.06em tracking |
| **Numbers (prices, timers, bid counts)** | Saira Semi Condensed | 500–600, `font-variant-numeric: tabular-nums` |

- Numbers always use the numeric font with tabular figures, so countdowns and prices don't jitter as digits change.
- Lot page price: 40px. Countdown: 32px. Card price: 20px.
- Money format: `₦45,500`. No kobo in the UI unless non-zero. Never "NGN" in body text.

## Spacing, shape, elevation

- Spacing scale: 4, 8, 12, 16, 24, 32, 48.
- Page padding: 16px on mobile, with content max-width 560px on lot pages and 1120px on browse grids.
- Radius: 12px cards, 999px pills and badges, 16px top corners on bottom sheets.
- Elevation: one shadow only (`0 1px 2px rgba(20,17,15,.06), 0 4px 16px rgba(20,17,15,.06)`) for cards and sheets. Everything else is flat with `--line` borders.
- Tap targets are at least 44×44px. The bid button is at least 56px tall.

## Core components

### Countdown

| State | Rule | Look |
|---|---|---|
| Upcoming | before `starts_at` | "Opens 7:00pm" in `--ink-muted` |
| Live | > 60s left | `mm:ss` in `--ink` |
| Final minute | ≤ 60s | `--live` color, `0:SS` |
| Soft-close | ≤ 30s | `--live`, a thin progress ring drains around the timer |
| Extended | `ends_at` moved by a bid | small "+30s" pill pops in for 1.5s |
| Ended | after `ends_at` | "Ended" in `--ended`, and the price label changes to "Sold for" or "Unsold" |

The countdown is driven by server-time offset (see CLAUDE.md). If the connection drops, show a small "Reconnecting…" pill and grey out the bid button. Never show a stale timer as live.

### Bid button and bid sheet

- A sticky bottom bar on the lot page shows the current price on the left and the **Bid ₦X** button on the right. X is always the next minimum bid (`current_bid + step`, or `start_price` if there are no bids yet).
- Tapping opens a bottom sheet with quick picks: **min**, **+1 step**, **+2 steps**, plus a custom amount field. Confirm with one tap. There's no second confirmation dialog, because speed matters.
- Button states: `ready` (`--live`), `submitting` (spinner, disabled), `rejected` (sheet shakes once, gently, with a reason such as "Someone bid ₦46,000 first" and the new minimum prefilled), `disabled` (not verified, own lot, suspended, ended, or reconnecting, each with a one-line reason).

### Status banner (lot page, under photos)

- **Winning**: `--winning-soft` background, check icon, "You're winning at ₦45,500".
- **Outbid**: `--outbid-soft` background, "You've been outbid — ₦46,000 now", with a one-tap "Bid ₦46,500".
- **Won**: "You won! Pay within 29:41". The timer counts down to `pay_by`, and there's a **Pay now** button.
- **Not bidding**: no banner.

### Lot card (browse grid)

Photo (4:3), title (2 lines max), area pill ("Yaba"), condition pill, current price (numeric font), bid count, and time left. Live lots get a small `--live` dot. Use two columns on mobile and four on desktop.

### Badges and pills

`LIVE`, `UPCOMING`, `ENDED`, `UNSOLD`, plus area and condition pills (`Like new`, `Good`, `Fair`, `For parts`). Badges are labels in uppercase. Pills are in sentence case.

### Handover code

The buyer sees six large digits (numeric font, 40px, letter-spaced) on a card, with "Give this code to the seller only when you have the item." The seller gets a six-box code input and a big **Confirm handover** button. If the code is wrong, there are 5 tries per hour.

## Key screens (v1)

1. **Home / Tonight's drop**: hero with the drop title and "Opens in 2h 14m" (or "Live now"), a "Remind me" button (push), then the lot grid sorted by close time. Upcoming drops are listed below.
2. **Lot page**: photo carousel (swipe, dots), title, area + condition, seller (first name, verified badge, member since), status banner, price + countdown block, description, bid history (masked bidders, last 10), and the sticky bid bar.
3. **Sell flow** (3 steps): photos (3–8, camera-first) → details (title, category, condition, area, asking price with the minimum step shown) → choose a drop → review. It ends on "Your lot goes live Fri 7pm".
4. **My bids**: tabs for Live / Won / Lost. Live rows show winning/outbid status at a glance.
5. **Pay**: order summary, the "Your money is held until you collect the item" explainer, then Paystack checkout.
6. **Seller orders**: awaiting payment / ready for pickup / paid out, with the handover code input on each ready order.
7. **Verify phone**: OTP screen, shown the first time someone tries to bid or sell. Don't block browsing.
8. **Admin**: drops calendar, lots per drop, disputes, strikes.

## Motion

- Price change: the number rolls up over 250ms, and the background flashes `--live-soft` for 400ms.
- New bid in history: slides in from the top over 200ms.
- "+30s" extension pill: scales in, holds 1.5s, fades out.
- Respect `prefers-reduced-motion`: no rolls or slides, only instant changes with a color flash.

## Copy tone

Short, warm and plain Nigerian English. Use the money and the time, not adjectives.
- Yes: "You've been outbid. ₦46,000 now."
- Yes: "Pay within 30 minutes or it goes to the next bidder."
- No: "Oops! Looks like someone swooped in! 😅"

## Accessibility

- The countdown has `aria-live="polite"` only at 60s, 30s, 10s and at the end. Don't announce every second.
- Never use color alone for status. Winning, outbid and ended each have an icon and a label too.
- Every focus state is visible (`--focus` 2px ring).

## Not decided yet (fill in before building)

- App name, logo and wordmark
- Final illustration/icon style (default for now: Lucide icons at 1.75 stroke)
- Dark mode palette
