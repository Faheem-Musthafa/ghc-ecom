# Glockery Commerce — Design System

This file is the source of truth for storefront, account, checkout, and admin UI.

## Direction

Restrained editorial commerce. Product photography, typography, proportion, and useful information create the premium character. Avoid glass cards, glow effects, gold gradients, decorative blobs, fake urgency, fabricated social proof, and excessive pills.

## Color

| Role | Value | Token |
|---|---:|---|
| Page | `#080807` | `--color-obsidian` |
| Surface | `#11110F` | `--color-carbon` |
| Raised surface | `#171714` | `--color-panel` |
| Divider | `#2B2924` | `--color-line` |
| Brand gold | `#C9A35B` | `--color-gold-400` |
| Gold text | `#DBC184` | `--color-gold-300` |
| Primary text | `#F1EDE4` | `--color-cream` |

Gold is an accent, not a fill for entire sections. Semantic red, amber, blue, and green are reserved for operational states.

## Typography

- Display: Cormorant Garamond, 500–700. Use for editorial headings and product names.
- Interface/body: Plus Jakarta Sans, 400–700. Use for navigation, forms, tables, prices, and body copy.
- Eyebrows: 11px, 700, uppercase, 0.22em tracking.
- Body: at least 14px on dense admin surfaces and 16px for customer-facing reading copy where space permits.
- Prices, IDs, dates, and metrics use tabular figures.

## Shape and depth

- Default corner radius: 0. Subtle `rounded-sm` is permitted on dense legacy controls only.
- Cards use a 1px divider, not a floating shadow.
- Shadows are reserved for drawers, modals, and other layered UI.
- Blur is reserved for sticky-header legibility and modal scrims.

## Layout

- Storefront max width: 1440px with 16/32/48px responsive gutters.
- Customer flows prioritize one clear primary action per screen.
- Admin uses a 244px adaptive sidebar, dense tables, and 12px–14px interface text.
- Mobile targets start at 320px; verify 375, 768, 1024, and 1440px.
- Interactive targets are at least 44×44px.

## Components

- `.surface`: solid carbon background with a line border.
- `.surface-raised`: raised panel with a restrained shadow.
- `.eyebrow`: shared section label.
- `.button-primary`: solid gold, dark text, 48px minimum height.
- `.button-secondary`: transparent, gold border/text, 48px minimum height.
- `.field`: solid obsidian input with a visible gold focus border.

## Content principles

- Describe materials and policies only when supported by product or backend data.
- Never invent reviews, store names, stock counts, delivery events, timers, or performance trends.
- Use direct labels: “Shopping bag”, “Customer care”, “Orders”, “Inventory”.
- Do not use “VIP”, “private circle”, “executive console”, or similar status theatre.

## Interaction and accessibility

- Preserve visible `:focus-visible` rings.
- Icon-only controls require accessible labels.
- Forms use visible labels, semantic input types, autocomplete, and inline error regions.
- Statuses include text; color is never the only signal.
- Motion uses transform/opacity in the 150–300ms range and respects `prefers-reduced-motion`.
- Images declare intrinsic dimensions where practical and below-fold media loads lazily.

## Pre-delivery checks

- No horizontal overflow at 375px.
- Header, drawers, and sticky summaries do not cover content.
- Storefront and admin keyboard navigation is complete.
- Empty, loading, success, and error states are explicit.
- Build, typecheck, and UI tests pass.
