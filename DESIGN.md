# DESIGN.md

UI guide for Declutter Auction. CLAUDE.md says the UI follows this file: don't add colors or type styles that aren't listed here. (This is a first draft written alongside the v1 build. Change it freely, then update `app/globals.css` and `tailwind.config.ts` to match.)

## Principles

- **Mobile first, mobile data.** Design for a 360px-wide Android phone on a slow connection. No web fonts, no heavy libraries, lazy-load images.
- **Time and money are the content.** Prices and countdowns are the biggest, clearest things on a lot. Always use tabular numbers.
- **Pickup distance matters.** Show the lot's Lagos area everywhere a lot appears.
- **One primary action per screen.** On a lot page it's "Place bid".

## Color tokens

Defined as CSS variables in `app/globals.css` (light and dark), mapped to Tailwind names in `tailwind.config.ts`.

| Token | Tailwind | Light | Dark | Use |
|---|---|---|---|---|
| `--bg` | `bg-bg` | `#FBF7F0` | `#141210` | Page background |
| `--surface` | `bg-surface` | `#FFFFFF` | `#1E1B18` | Cards, sheets |
| `--ink` | `text-ink` | `#1A1612` | `#F3EEE7` | Primary text |
| `--muted` | `text-muted` | `#6B635A` | `#A69D92` | Secondary text |
| `--line` | `border-line` | `#E8E0D4` | `#332E29` | Borders, dividers |
| `--brand` | `bg-brand` / `text-brand` | `#0F7B4F` | `#3FB07D` | Primary actions, links |
| `--brand-ink` | `text-brand-ink` | `#FFFFFF` | `#0B1F16` | Text on brand |
| `--live` | `bg-live` / `text-live` | `#E8590C` | `#FF8A4C` | Live badge, final-seconds countdown |
| `--success` | `text-success` | `#1E8E3E` | `#5CC97B` | "You're winning", paid |
| `--danger` | `text-danger` | `#C62828` | `#FF6B6B` | Outbid, errors, strikes |
| `--warn` | `text-warn` | `#9A5B00` | `#F2B34C` | Pay-by deadlines |

## Type

System font stack only (`system-ui, -apple-system, Segoe UI, Roboto, sans-serif`). Numbers use `tabular-nums`.

| Style | Tailwind | Use |
|---|---|---|
| Display | `text-display` (28/32, 700) | Current bid on lot page |
| Title | `text-title` (20/26, 600) | Page and lot titles |
| Body | `text-body` (16/24, 400) | Default |
| Small | `text-small` (14/20, 400) | Meta: area, condition, timestamps |
| Micro | `text-micro` (12/16, 600, uppercase tracking-wide) | Badges |

## Shape and spacing

- Radius: `rounded-card` (14px) for cards and sheets, `rounded-pill` (999px) for badges and buttons.
- Spacing: 4px grid (Tailwind defaults). Page gutter is 16px (`px-4`).
- Tap targets are at least 44px tall.

## Components

All in `/components`.

- **Button**: `primary` (brand), `secondary` (surface + line), `ghost`, `danger`. Full width on mobile in forms and sheets.
- **Badge**: `live` (live color, pulsing dot), `upcoming` (muted), `sold` (success), `unsold` (muted), `leading` (success), `outbid` (danger).
- **LotCard**: square photo, title (1 line), area · condition, current bid or asking price, countdown.
- **Countdown**: `mm:ss` (or `h:mm:ss`). Turns `live` color under 60s and shows "Extended" briefly after a soft-close extension.
- **BidSheet**: bottom sheet with the minimum next bid preselected, quick +step buttons, and the confirm button.
- **Price**: always via `formatNaira(kobo)`, e.g. `₦25,000`.

## Copy

- Plain words. "You're winning", "You've been outbid", "Pay by 7:42pm".
- Times in Africa/Lagos, 12-hour clock (`7:42pm`).
- Bidders are "Bidder 4", never names or phone numbers.
