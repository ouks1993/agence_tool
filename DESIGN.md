# Design System

This document defines the visual design system for the project. All new components and pages **must** follow these tokens, patterns, and conventions.

---

## Stack

- **Framework:** Next.js (App Router) + React + TypeScript
- **Styling:** Tailwind CSS v4 (CSS-first config via `@theme inline` in `globals.css` — no `tailwind.config.ts`)
- **Components:** shadcn/ui (new-york style, neutral base)
- **Icons:** Lucide React
- **Fonts:** Geist (sans) + Geist Mono (mono) via `next/font/google`
- **Dark mode:** next-themes (class-based, system default)
- **Utilities:** `cn()` from `@/lib/utils` (clsx + tailwind-merge)

---

## Colors

The app adopts the **Atlas marketing-deck identity** (`marketing/assets/atlas-ui.css`):
an Atlas Blue (`#2B59C3`) primary accent, a cool-paper canvas (`#F6F8FB`), white cards,
and a dark ink (`#0E1525`) sidebar rail — while keeping the Geist font.

Light-theme tokens are authored as exact deck **hex** values (hex is valid in CSS custom
properties; the deck values are matched verbatim rather than approximated in oklch). The
dark theme keeps a coherent neutral-oklch scaffold (Linear-like surfaces) and only swaps
the **accent family + sidebar** to the deck identity. All colors are defined as CSS custom
properties in `globals.css` and bridged to Tailwind via `@theme inline`.

### Semantic Tokens

| Token | Light | Dark | Usage |
|---|---|---|---|
| `background` | `#F6F8FB` | `oklch(0.141 0.005 285.823)` | Page background (deck canvas) |
| `foreground` | `#1B2333` | `oklch(0.985 0 0)` | Primary text |
| `primary` | `#2B59C3` | `#4F7BD9` | Buttons, links, accents (Atlas Blue) |
| `primary-foreground` | `#FFFFFF` | `#FFFFFF` | Text on primary |
| `secondary` | `#EEF1F6` | `oklch(0.274 0.006 286.033)` | Secondary buttons, subtle bg |
| `secondary-foreground` | `#1B2333` | `oklch(0.985 0 0)` | Text on secondary |
| `muted` | `#EEF1F6` | `oklch(0.274 0.006 286.033)` | Subdued backgrounds |
| `muted-foreground` | `#6B7385` | `oklch(0.705 0.015 286.067)` | Subdued text, placeholders |
| `accent` | `#EAF0FC` | `oklch(0.30 0.04 264)` | Hover backgrounds, highlights (brand tint) |
| `accent-foreground` | `#2249A6` | `#DCE6FA` | Text on accent |
| `destructive` | `#D14343` | `oklch(0.704 0.191 22.216)` | Error states, delete actions |
| `destructive-foreground` | `#FFFFFF` | `#FFFFFF` | Text on `destructive` (destructive Badge fill) |
| `surface-2` | `#FBFCFE` | `oklch(0.25 0.006 285.885)` | Raised neutral surface — nested panels, zebra rows, table-head fill. Tailwind: `bg-surface-2`. |
| `card` | `#FFFFFF` | `oklch(0.21 0.006 285.885)` | Card backgrounds |
| `card-foreground` | `#1B2333` | `oklch(0.985 0 0)` | Card text |
| `popover` | `#FFFFFF` | `oklch(0.21 0.006 285.885)` | Popover/dropdown bg |
| `popover-foreground` | `#1B2333` | `oklch(0.985 0 0)` | Popover/dropdown text |
| `border` | `#E6EAF1` | `oklch(1 0 0 / 10%)` | Borders, dividers (hairline) |
| `border-strong` | `#D4DAE6` | `oklch(1 0 0 / 18%)` | Heavier divider — input borders, dense tables where a hairline reads too faint. Tailwind: `border-border-strong`. |
| `input` | `#E1E6EF` | `oklch(1 0 0 / 15%)` | Input borders |
| `ring` | `#2B59C3` | `#4F7BD9` | Focus rings |

### Brand Accent

| Token | Light | Dark | Usage |
|---|---|---|---|
| `brand` | `#2B59C3` | `#5B85DE` | Atlas Blue accent for marketing-grade highlights (charts, KPI emphasis). Exposed to Tailwind as `*-brand`. |
| `brand-foreground` | `#FFFFFF` | `#0E1525` | Text on `brand`. |
| `--brand-ring` | `rgba(43,89,195,0.35)` | `rgba(91,133,222,0.45)` | Canonical 3px keyboard-focus ring. Consumed by the `.focus-ring` / `.skip-link` utilities (raw CSS var, not a Tailwind color). |

### Functional / Status Palette

The deck's tuned, financial-grade status colors — each a **base** (solid fill / icon /
strong text), a **`-soft`** low-contrast tint (pill & row backgrounds), and a
**`-foreground`** (text on the solid base). Prefer these over raw Tailwind palette values
(`text-green-600`, `bg-amber-500/10`, …) so status color stays on-brand. All are bridged to
Tailwind, so `bg-success` / `text-success` / `bg-success-soft` / `text-success-foreground`
(and the `warning`/`danger`/`info` equivalents) all resolve.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `success` | `#1E9E6A` | `oklch(0.75 0.14 162)` | Paid, confirmed, positive delta |
| `success-soft` | `#E4F6EE` | `oklch(0.75 0.14 162 / 15%)` | Success pill / row bg |
| `success-foreground` | `#FFFFFF` | `#FFFFFF` | Text on `success` |
| `warning` | `#B45313` | `oklch(0.78 0.14 66)` | Amount-due, passport-expiry, at-risk |
| `warning-soft` | `#FBEEE2` | `oklch(0.78 0.14 66 / 15%)` | Warning pill / row bg |
| `warning-foreground` | `#FFFFFF` | `#0E1525` | Text on `warning` |
| `danger` | `#D14343` | `oklch(0.704 0.191 22.216)` | Overdue, error, cancelled (alias of `destructive`) |
| `danger-soft` | `#FBE9E9` | `oklch(0.704 0.191 22.216 / 15%)` | Danger pill / row bg |
| `danger-foreground` | `#FFFFFF` | `#FFFFFF` | Text on `danger` |
| `info` | `#2B59C3` | `#4F7BD9` | Neutral/informational status (Atlas Blue) |
| `info-soft` | `#EAF0FC` | `oklch(0.55 0.14 264 / 20%)` | Info pill / row bg |
| `info-foreground` | `#FFFFFF` | `#FFFFFF` | Text on `info` |

### Chart Colors

Aligned to the marketing-deck palette (blue · green · amber · violet · cyan · red).
Consumed by `src/components/charts/insight-charts.tsx`. The dark theme keeps the brighter
Phase-0 oklch values for legibility on dark surfaces.

| Token | Light | Dark |
|---|---|---|
| `chart-1` (blue) | `#2B59C3` | `oklch(0.7 0.14 264)` |
| `chart-2` (green) | `#1E9E6A` | `oklch(0.78 0.14 184)` |
| `chart-3` (amber) | `#B45313` | `oklch(0.8 0.15 70)` |
| `chart-4` (violet) | `#7C5CE6` | `oklch(0.72 0.17 295)` |
| `chart-5` (cyan) | `#1FA2C7` | `oklch(0.74 0.18 9)` |
| `chart-6` (red) | `#D14343` | `oklch(0.78 0.13 240)` |

### Sidebar Colors

The sidebar is a **dark ink rail in both light and dark themes** (deck identity). Every
element inside the rail must use sidebar-scoped tokens (`text-sidebar-foreground`,
`bg-sidebar-accent`, `bg-sidebar-primary`, `border-sidebar-border`, …) for legibility on
the dark surface.

| Token | Light | Dark |
|---|---|---|
| `sidebar` | `#0E1525` | `#0E1525` |
| `sidebar-foreground` | `#C7CEDC` | `#C7CEDC` |
| `sidebar-primary` | `#2B59C3` | `#4F7BD9` |
| `sidebar-primary-foreground` | `#FFFFFF` | `#FFFFFF` |
| `sidebar-accent` | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.07)` |
| `sidebar-accent-foreground` | `#FFFFFF` | `#FFFFFF` |
| `sidebar-border` | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.08)` |
| `sidebar-ring` | `#2B59C3` | `#4F7BD9` |

### Status Colors — functional tokens are the standard

For **any** status/semantic indicator (badges, pills, amount-due chips, deltas, alerts,
timeline dots, progress bars, verified/failed markers) the **functional palette tokens** are
the documented standard. Never author raw Tailwind palette values for status meaning.

| Meaning | Text | Soft bg / pill | Solid fill / dot | Border |
|---|---|---|---|---|
| **Success** — paid, confirmed, positive delta, verified | `text-success` | `bg-success-soft` | `bg-success` | `border-success/30` |
| **Warning** — amount-due, expiry, at-risk, pending money | `text-warning` | `bg-warning-soft` | `bg-warning` | `border-warning/30` |
| **Danger** — overdue, error, failed, cancelled | `text-danger` (or `text-destructive`) | `bg-danger-soft` | `bg-danger` | `border-danger/30` |
| **Info** — in-flight, acknowledged, mid-lifecycle | `text-info` | `bg-info-soft` | `bg-info` | `border-info/30` |
| **Neutral** — draft, inactive, not-started | `text-muted-foreground` | `bg-secondary` / `bg-muted` | `bg-muted-foreground/40` | `border` |

Prefer the shared primitives that already resolve to these tokens:
- **`<StatusBadge variant={…} />` / `<StatusPill domain status />`** with `statusTone(domain, status)`
  (`src/lib/status-tone.ts`) — the single source of truth for status → tone.
- **Soft-tint badges** (`bg-*-soft text-*`) for pills; **solid tokens** (`bg-*`) for dots and
  progress fills.

> **Deprecated / legacy:** raw Tailwind status utilities — `text-green-600`, `bg-green-500/15`,
> `text-amber-600`, `bg-amber-500/10`, `text-red-600`, `text-blue-500`, `dark:*` status variants,
> etc. — are **legacy and must not be used for new status meaning.** They are being removed in
> favour of the tokens above. (Raw palette colors remain acceptable **only** for genuinely
> decorative / categorical use — e.g. amber star-rating icons, brand gradients, chart series
> `chart-1..6`, and print-doc brand colors — which are *not* status.)

---

## Typography

### Font Families

| Token | Font | Usage |
|---|---|---|
| `--font-geist-sans` | Geist | All UI text (applied to body) |
| `--font-geist-mono` | Geist Mono | Code, monospace content |

Body has `font-feature-settings: "rlig" 1, "calt" 1` and `antialiased` enabled.

### Type Scale

| Class | Size | Usage |
|---|---|---|
| `text-xs` | 12px | Timestamps, shortcuts, helper text, code |
| `text-sm` | 14px | Descriptions, labels, body copy, card descriptions |
| `text-base` | 16px | Base text, inputs (mobile) |
| `text-lg` | 18px | Card titles, dialog/sheet titles, sub-headings |
| `text-xl` | 20px | Section titles, header logo |
| `text-2xl` | 24px | Page titles |
| `text-3xl` | 30px | Dashboard/profile headings |
| `text-4xl` | 36px | Large display text |
| `text-5xl` | 48px | Hero title |

### Font Weights

| Class | Weight | Usage |
|---|---|---|
| `font-medium` | 500 | Buttons, labels, nav items |
| `font-semibold` | 600 | Card titles, section headings, badges, dialog titles |
| `font-bold` | 700 | Page titles, hero heading |

### Line Heights & Tracking

| Class | Usage |
|---|---|
| `leading-none` | Labels, card titles |
| `leading-5` | Code blocks |
| `leading-6` | List items |
| `leading-7` | Paragraphs (markdown) |
| `tracking-tight` | Hero/display text |
| `tracking-widest` | Keyboard shortcuts |

---

## Spacing

### Container Pattern

```
container mx-auto px-4
```

Responsive overrides where needed:
- Header: `px-3 sm:px-4`
- Footer: `px-4 sm:px-6 lg:px-8`

### Max Widths

| Class | Value | Usage |
|---|---|---|
| `max-w-sm` | 24rem | Auth forms |
| `max-w-md` | 28rem | Login/register cards, error pages |
| `max-w-lg` | 32rem | Dialog content (sm+) |
| `max-w-2xl` | 42rem | Large dialogs |
| `max-w-3xl` | 48rem | Embeds, protected state |
| `max-w-4xl` | 56rem | Main content pages |

### Vertical Spacing (space-y)

| Class | Usage |
|---|---|
| `space-y-1` | Tight lists, inline stacks |
| `space-y-1.5` | Card header |
| `space-y-2` | Form field groups, small stacks |
| `space-y-3` | Footer stacks |
| `space-y-4` | Form sections, dialog content |
| `space-y-6` | Card content sections |
| `space-y-8` | Page-level sections |

### Padding

| Class | Usage |
|---|---|
| `p-1` | Dropdown content, icon buttons |
| `p-2` | Code blocks, muted backgrounds |
| `p-3` | Chat bubbles, inputs |
| `p-4` | Grid items, action buttons, list items |
| `p-6` | Cards, dialog content |

### Page Vertical Padding

| Class | Usage |
|---|---|
| `py-3 sm:py-4` | Header |
| `py-4 sm:py-6` | Footer |
| `py-8` | Standard content pages |
| `py-12` | Home page, dashboard |
| `py-16` | Error/not-found pages |

---

## Border Radius

Deck radius scale: cards/panels are **14px** (`--r-lg`), buttons/inputs 10px, chips 6px.
The base `--radius` is set to `0.875rem` (14px) so `rounded-lg` cards match the deck.

| Token | Value | Class |
|---|---|---|
| `--radius` | `0.875rem` (14px) | Base |
| `--radius-sm` | `calc(--radius - 4px)` = 10px | `rounded-sm` |
| `--radius-md` | `calc(--radius - 2px)` = 12px | `rounded-md` |
| `--radius-lg` | `var(--radius)` = 14px | `rounded-lg` |
| `--radius-xl` | `calc(--radius + 4px)` = 18px | `rounded-xl` |
| — | 9999px | `rounded-full` |

**Usage:**
- `rounded-md` — Buttons, inputs, textarea, code blocks, dropdowns
- `rounded-lg` — Cards, dialogs, feature cards, chat bubbles
- `rounded-xl` — Hero logo container
- `rounded-full` — Badges, avatars

---

## Shadows

| Class | Usage |
|---|---|
| `shadow-xs` | Inputs, textarea, secondary/outline buttons |
| `shadow-sm` | Card base |
| `shadow-md` | Card hover, dropdown content |
| `shadow-lg` | Dialogs, dropdown sub-content |

**Custom elevation tokens:** layered shadows for premium dashboard / KPI cards,
aligned to the marketing-deck `--shadow-sm` (resting) / `--shadow-md` (hover) values.

| Token | Value | Usage |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgba(16,24,40,.05), 0 1px 1px rgba(16,24,40,.04)` | Resting elevation for KPI / dashboard cards (via `.card-elevated`) |
| `--shadow-card-hover` | `0 4px 12px rgba(16,24,40,.08), 0 2px 4px rgba(16,24,40,.04)` | Hover elevation for interactive cards (via `.card-interactive:hover`) |
| `--shadow-lg` | `0 12px 32px rgba(16,24,40,.12), 0 4px 8px rgba(16,24,40,.05)` | Dialogs, popovers, dropdowns (deck lg). Tailwind: `shadow-lg` → bridged to this token. |
| `--shadow-xl` | `0 24px 60px rgba(16,24,40,.16), 0 8px 16px rgba(16,24,40,.06)` | Device frames, hero / floating cards (deck xl). Tailwind: `shadow-xl`. |

Dark theme keeps a coherent scaffold: `--shadow-lg` → `0 12px 32px oklch(0 0 0 / 45%), 0 4px 8px oklch(0 0 0 / 35%)`; `--shadow-xl` → `0 24px 60px oklch(0 0 0 / 55%), 0 8px 16px oklch(0 0 0 / 40%)`.

---

## Animations

### Custom Keyframes

| Name | Effect | Duration | Easing |
|---|---|---|---|
| `fade-in` | Opacity 0 → 1 | 0.3s | ease-out |
| `fade-up` | Opacity 0 → 1 + translateY(8px → 0) | 0.4s | ease-out |
| `scale-in` | Opacity 0 → 1 + scale(0.97 → 1) | 0.2s | ease-out |

Use via: `animate-fade-in`, `animate-fade-up`, `animate-scale-in`

### tw-animate-css Animations

Used on dialogs and dropdowns:
- `animate-in` / `animate-out`
- `fade-in-0` / `fade-out-0`
- `zoom-in-95` / `zoom-out-95`
- `slide-in-from-{top|bottom|left|right}-2`

### Transition Classes

| Class | Usage |
|---|---|
| `transition-colors` | Links, hover color changes |
| `transition-opacity` | Avatar hover, reveal-on-hover |
| `transition-all duration-200` | Card interactive hover, buttons |
| `transition-[color,box-shadow]` | Input/textarea focus |

### Utility Classes

```css
.card-interactive {
  @apply transition-all duration-200 ease-out;
}
.card-interactive:hover {
  box-shadow: var(--shadow-card-hover);
  @apply -translate-y-0.5;
}
/* Premium resting elevation for dashboard / KPI cards. */
.card-elevated {
  box-shadow: var(--shadow-card);
}
```

```css
.auth-bg {
  background-image: radial-gradient(
    circle at 50% 0%,
    var(--accent) 0%,
    transparent 50%
  );
}
```

**Numeric alignment — `.tnum` / `.tabular-nums`:** opt-in `font-variant-numeric: tabular-nums`
for numeric columns, KPI values, and currency figures (DZD/EUR/USD) so digits align and
totals don't jitter. Apply to table cells and stat values.

```css
.tnum,
.tabular-nums {
  font-variant-numeric: tabular-nums;
}
```

**Brand focus ring — `.focus-ring`:** the canonical 3px Atlas-Blue focus affordance
(`box-shadow: 0 0 0 3px var(--brand-ring)`). Pair with `focus-visible`.

**Skip link — `.skip-link`:** visually hidden (`sr-only`) until focused, then fixed
top-left with the brand ring. Used by the app shell for skip-to-content.

**Reduced motion:** a global `@media (prefers-reduced-motion: reduce)` block collapses
animation/transition durations to ~0 and disables smooth scroll for users who opt out.

---

## Layout

### Root Structure

```
<body class="antialiased min-h-screen flex flex-col">
  <SiteHeader />
  <main id="main-content" class="flex-1">{children}</main>
  <SiteFooter />
  <Toaster />
</body>
```

### Page Layout Patterns

**Auth pages:**
```
flex min-h-[calc(100vh-4rem)] items-center justify-center p-4
  → Card w-full max-w-md
```

**Standard content pages:**
```
container mx-auto px-4 py-8
  → max-w-4xl mx-auto
```

**Error/not-found pages:**
```
container mx-auto px-4 py-16
  → max-w-md mx-auto text-center
```

### Grid Patterns

| Pattern | Usage |
|---|---|
| `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6` | Feature cards (4-col) |
| `grid grid-cols-1 md:grid-cols-2 gap-6` | Dashboard cards |
| `grid grid-cols-1 md:grid-cols-2 gap-4` | Profile info |
| `grid grid-cols-1 md:grid-cols-3 gap-4` | Quick actions |

### Responsive Breakpoints

Standard Tailwind breakpoints:
- `sm:` (640px) — Padding adjustments, text alignment, button sizing
- `md:` (768px) — Grid column changes (→ 2 col), input font size
- `lg:` (1024px) — Grid column changes (→ 4 col), wide padding

---

## Icons

**Library:** Lucide React

### Sizing Convention

| Size | Classes | Usage |
|---|---|---|
| XS | `h-3 w-3` | Inline badge icons |
| SM | `h-3.5 w-3.5` | Copy buttons |
| Default | `h-4 w-4` or `size-4` | Standard UI icons |
| MD | `h-5 w-5` | Header logo icon |
| LG | `h-7 w-7` | Hero logo icon |
| XL | `h-16 w-16` | Error/empty state illustrations |

### Commonly Used Icons

`Bot`, `User`, `Lock`, `Shield`, `Mail`, `Calendar`, `Copy`, `Check`, `Loader2`, `LogOut`, `Sun`, `Moon`, `Github`, `ArrowLeft`, `RefreshCw`, `AlertCircle`, `FileQuestion`, `Database`, `Palette`, `Video`

---

## Components (shadcn/ui)

All components live in `src/components/ui/`. They use `data-slot` attributes, accept `className` for overrides via `cn()`, and follow either `React.forwardRef` or functional component patterns.

### Button

6 variants, 4 sizes (CVA-based):

| Variant | Usage |
|---|---|
| `default` | Primary actions |
| `secondary` | Secondary actions |
| `outline` | Tertiary actions |
| `ghost` | Subtle/icon actions |
| `destructive` | Delete/danger actions |
| `link` | Inline text links |

| Size | Height | Padding |
|---|---|---|
| `sm` | h-8 | px-3 |
| `default` | h-9 | px-4 |
| `lg` | h-10 | px-6 |
| `icon` | size-9 | — |

### Card

6 sub-components: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

Base: `rounded-lg border bg-card text-card-foreground shadow-sm`

`CardTitle` is `text-lg font-semibold leading-none tracking-tight` (18px subhead scale —
matches `DialogTitle` / `SheetTitle`; reserve `text-2xl`/`text-3xl` for page-level headings).

**Elevation composition:** the base card sits at `shadow-sm`. To lift a card to the
premium dashboard/KPI resting elevation, add `className="card-elevated"` (applies
`--shadow-card`). For interactive cards that lift on hover, add `className="card-interactive"`
(200ms ease-out, `--shadow-card-hover` + `-translate-y-0.5`). Both are utility classes in
`globals.css` and compose cleanly via `cn()` — no wrapper or prop needed.

### Input / Textarea

- Height: `h-9` (input), `min-h-16` (textarea)
- Border: `border bg-transparent rounded-md shadow-xs`
- Focus: `focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]`
- Validation: `aria-invalid:border-destructive aria-invalid:ring-destructive/20`
- Responsive font: `text-base md:text-sm`

### Checkbox

Radix-based (`radix-ui` unified import; `data-slot="checkbox"`). A `size-4`,
`rounded-[4px]`, `border-input` box; checked state is `bg-primary` + `border-primary`
with a white Lucide `Check` (`size-3.5`, `strokeWidth={3}`) indicator. Shares the input
focus ring (`focus-visible:border-ring` + `ring-ring/50 ring-[3px]`), `aria-invalid`
(`border-destructive` + `ring-destructive/20`), and `disabled` (`opacity-50`,
`cursor-not-allowed`) treatments. Replaces native `<input type="checkbox">` (hotel-search,
flight-results, contacts). Exports `Checkbox`.

### Badge

7 variants: `default`, `secondary`, `destructive`, `outline`, plus the deck **status
variants** `success`, `warning`, `info`.

Base: `rounded-full border px-2.5 py-0.5 text-xs font-semibold` with the canonical brand
focus ring (`focus-visible:ring-ring/50 focus-visible:ring-[3px]`).

**Status variants** follow the deck's pill look — a soft tinted background + solid token
text — using the functional tokens:

| Variant | Background | Text |
|---|---|---|
| `success` | `bg-success-soft` | `text-success` |
| `warning` | `bg-warning-soft` | `text-warning` |
| `info` | `bg-info-soft` | `text-info` |

`destructive` now pairs the solid `bg-destructive` fill with the real
`text-destructive-foreground` (white) token.

**Leading status dot** — pass `dot` to render a small `size-1.5 rounded-full` span before
the label. It defaults to `bg-current`, inheriting the variant's solid text color (e.g. an
Atlas-green dot on a `success` badge). Override with `dotClassName` for a fixed hue. The
dot is `aria-hidden`. Example: `<Badge variant="success" dot>Confirmed</Badge>`.

### StatusBadge / StatusPill

App-level status pill (`src/components/app/status-badge.tsx`) used for domain statuses
(booking / payment / proposal / opportunity / supplier / commission / …). It is the
status-coloured counterpart to the shadcn `Badge` and shares its soft-tint-+-solid-text look.

**Colour it semantically.** Prefer the `variant` prop — one of the five **semantic tones**
backed by the Wave-1 functional tokens:

| `variant` | Background | Text | Meaning |
|---|---|---|---|
| `neutral` | `bg-secondary` | `text-secondary-foreground` | Draft / inactive / not-yet-started |
| `success` | `bg-success-soft` | `text-success` | Settled / active / won |
| `warning` | `bg-warning-soft` | `text-warning` | Needs attention / pending / part-paid |
| `info` | `bg-info-soft` | `text-info` | In-flight / acknowledged / mid-lifecycle |
| `danger` | `bg-danger-soft` | `text-danger` | Failed / cancelled / lost / overdue |

Never re-introduce a raw Tailwind colour string at the call site. Derive the tone from the
status via the shared helper `statusTone(domain, status)` in `src/lib/status-tone.ts`, which
maps every real status vocabulary (see `domain.ts`) to a tone. Domains:
`opportunity · client · product · booking · bookingItem · paymentRecord · paymentSummary ·
supplier · contract · commission · subscription · generic`. Unknown codes fall back to
`generic` then `neutral` (never crash).

- **`<StatusBadge variant={statusTone("booking", status)} label={meta.label} dot />`** —
  explicit tone.
- **`<StatusPill domain="booking" status={booking.status} label={meta.label} dot />`** —
  convenience wrapper that runs `statusTone` for you (`label` defaults to the raw code).

`dot` / `dotClassName` behave exactly as on `Badge`.

**Legacy `tone` escape hatch.** The original `tone?: string` prop (a raw Tailwind colour
string like `"bg-green-100 text-green-700"`) still works for backward compatibility with
existing callers; it overrides `variant` when both are set. Do not use it in new code —
existing callers are being migrated to `variant` / `StatusPill`.

### Dialog

Radix-based with overlay (`bg-black/50`), fade + zoom animations, optional close button.

### DropdownMenu

Radix-based. Content: `rounded-md border p-1 shadow-md min-w-[8rem]`. Items support a `destructive` variant.

### Table

The deck **data-table** treatment (`marketing/assets/atlas-ui.css .table`). Base exports
(`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`) keep their native
element signatures — the deck upgrades are **additive / opt-in** so existing markup is unchanged.

**Header band (default):** every `TableHead` now renders the deck header chrome —
`bg-surface-2`, `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`,
`h-10 px-4`, `whitespace-nowrap` — matching `.table thead th` verbatim. Body cells use
`px-4 py-3` for the deck's 16px horizontal rhythm.

**Opt-in props:**

| Prop | On | Effect |
|---|---|---|
| `zebra` | `Table` | Stripes even body rows (`bg-surface-2/60`) — deck `.table.zebra`. |
| `sticky` | `TableHeader` | Pins the header (`sticky top-0 z-10`, header cells keep `bg-surface-2`). Pair with a `max-h-*` / `overflow-auto` wrapper. |
| `numeric` | `TableHead` / `TableCell` | Right-aligns + applies `tabular-nums` for money/counts. |
| `align` | `TableHead` / `TableCell` | `"left" \| "center" \| "right"` — overrides `numeric`'s default right-align. |
| `sortable` | `TableHead` | Renders a direction-aware chevron and sets `aria-sort`; wire `onClick` to re-order. |
| `sortDirection` | `TableHead` | `"asc" \| "desc" \| false` — drives the chevron (`ChevronUp` / `ChevronDown` / faint `ArrowUpDown`) and `aria-sort` (`ascending`/`descending`/`none`). |

**`TableSortButton`** (exported helper) — a standalone sortable-header trigger for when a
`TableHead` must wrap a real `<button>` (router / server-action sorting). Renders the label + a
`SortDirection`-aware chevron, carries the `.focus-ring`, and auto-labels (`Sort by {label}`).
The `SortDirection` type (`"asc" | "desc" | false`) is also exported.

**Mobile card-reflow pattern:** tables don't reflow under ~640px — hide the table and render
list cards instead of horizontal-scrolling. Wrap the `<Table>` in `hidden sm:block` and render a
`sm:hidden` `<ul>` of `Card` items with the same data + links (documented as a comment in
`table.tsx`).

### Tabs

Radix-based (added in the UI-redesign Phase 1). `TabsList` is a `rounded-md bg-muted p-1`
segmented control; the active `TabsTrigger` gets `bg-background` + `shadow-sm`. Used for the
client-profile sections (Overview / Trips / Opportunities / Proposals / Contacts / Notes) and the
pipeline scope switcher (All / My deals / Closing soon).

### Breadcrumb

Markup-only (added in Phase 1). `Breadcrumb` → `BreadcrumbList` → `BreadcrumbItem` with
`BreadcrumbLink` / `BreadcrumbPage` and a `BreadcrumbSeparator` (`ChevronRight`). Used at the top
of detail/section pages (client profile, pipeline) for location context.

### Tooltip

Radix-based (added in Phase 1). `TooltipProvider` + `Tooltip` / `TooltipTrigger` /
`TooltipContent` (`bg-primary text-primary-foreground`, fade + zoom in). For terse hover hints on
icon-only affordances.

### Sheet

Radix-Dialog-based side drawer — the canonical drawer other screens compose. Slides from
any side (`side="right"` default, `left`/`top`/`bottom`), overlay `bg-black/50`, panel
`bg-background` with the deck's tuned `shadow-[var(--shadow-lg)]`. Motion is **ease-out only**
(`ease-out`, open 300ms / close 200ms — no ease-in or bounce, per the motion rule). Slots:
`Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`,
`SheetTitle` (`text-lg font-semibold`), `SheetDescription` (`text-sm text-muted-foreground`).
Built-in close button (top-right `XIcon`) uses the canonical `.focus-ring`.

### Skeleton

Neutral loading placeholder: `bg-muted animate-pulse` (muted grey — reads as absent content,
not a brand-tinted/selected block), `aria-hidden` so screen readers skip the decorative bars.
Optional `variant` prop (backward-compatible, defaults to `default`):

| Variant | Shape | Usage |
|---|---|---|
| `default` | `rounded-md` | Block placeholders (cards, thumbnails, buttons) |
| `text` | `h-4 w-full rounded-full` | Inline text-line placeholder |
| `circle` | `rounded-full` | Avatar / icon placeholder |

`className` still overrides sizing/shape as before. Exports `Skeleton` + `SkeletonVariant` type.

### Spinner

Sizes: `sm` (h-4 w-4), `md` (h-6 w-6), `lg` (h-8 w-8). Uses `Loader2` with `animate-spin`.

### Toast (Sonner)

Custom icons per state (success, info, warning, error, loading). Themed via CSS variable overrides.

---

## Focus & Interaction States

### Focus Ring (Global)

```css
outline-2 outline-offset-2 outline-ring/70
```

Component-level override:
```
focus-visible:ring-ring/50 focus-visible:ring-[3px]
```

**Canonical brand ring:** the `--brand-ring` token (`rgba(43,89,195,0.35)` light /
`rgba(91,133,222,0.45)` dark) backs the `.focus-ring` utility — a single 3px Atlas-Blue
ring for keyboard focus across interactive primitives. New focusable components should
converge on this rather than inventing a fourth focus treatment.

### Disabled

```
disabled:pointer-events-none disabled:opacity-50
```

### Interactive Card Hover

```
transition-all duration-200 ease-out
hover:shadow-md hover:-translate-y-0.5
```

---

## Dark Mode

- **Method:** Class-based via `next-themes` with `attribute="class"` and `disableTransitionOnChange`
- **Default:** System preference
- **Toggle:** 3-way dropdown — Light / Dark / System
- All semantic color tokens swap automatically via `.dark` CSS selector
- Use `dark:` prefix for component-specific overrides (e.g., `dark:bg-input/30`)

---

## Branding

### Logo Text

```
bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent
```

### Logo Icon Container

```
w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center
```

Hero variant: `w-12 h-12 rounded-xl`
