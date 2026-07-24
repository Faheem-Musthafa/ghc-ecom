# GHC Commerce UI System

## Visual thesis

Warm editorial restraint: tactile product photography, quiet paper surfaces, a deep heritage green, and a small clay accent make the catalogue feel considered without making routine commerce feel precious.

## Content and interaction thesis

- Storefront: full-bleed product-led opening, curated collection stories, complete catalogue, craft proof, and a focused final invitation.
- Account and checkout: calm forms, visible progress, explicit recovery paths, and secure-payment reassurance.
- Admin: dense but readable operational surfaces with plain tables, restrained status color, and action-oriented copy.
- Motion: one hero entrance, image crop transitions on product discovery, and spatial drawer/modal entrances. Respect `prefers-reduced-motion`.

## Tokens

| Role | Value |
|---|---|
| Ink | `#17211D` |
| Paper | `#F7F4EE` |
| White surface | `#FFFDF9` |
| Primary/action | `#173C31` |
| Primary hover | `#285A49` |
| Accent | `#A56535` |
| Border | `#DCD8CF` |
| Muted text | `#66706A` |
| Success | `#236747` |
| Warning | `#9A5B19` |
| Danger | `#A33B31` |

- Display type: Newsreader, with Iowan Old Style/Georgia fallback.
- Interface type: Manrope, with Avenir Next/sans-serif fallback.
- Spacing follows a 4/8px rhythm.
- Shopper surfaces are mostly cardless; borders and whitespace define groups.
- Admin uses compact bordered regions only when they are the working surface.

## Interaction rules

- Interactive targets are at least 44px.
- Every input has a visible label; native validation and inline recovery text are retained.
- Icon-only controls have accessible names.
- Focus uses a visible 3px warm-orange ring.
- Images reserve aspect ratio and below-fold product media is lazy loaded.
- Drawers/modals have a clear dismiss action, Escape support where applicable, and a 58% scrim.
- Color never carries status alone; every status includes text.
- Server pricing, inventory, and payment state remain authoritative.

## Responsive rules

- Verified breakpoints: 390px, 900px, 1180px, and 1440px.
- Storefront moves from four to two product columns while preserving readable names and prices.
- Customer account navigation becomes a horizontal destination strip on small screens.
- Admin navigation becomes horizontally scrollable; data tables keep their own horizontal overflow.
- No fixed element may cover primary content or actions.

## Anti-patterns

- No glass effects or decorative gradients on routine product UI.
- No purple/pink SaaS palette.
- No emoji as interface icons.
- No dashboard mosaic of ornamental cards.
- No client-trusted totals, secrets, or service-role keys.
