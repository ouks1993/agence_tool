# Atlas Travel Desk — Presentation & Brand Design Guide

**Deliverable 4 · The visual language for the sales deck, mockups, and brand surface**

> *"The Operating System for Modern Travel Agencies."*

This is the design bible for everything a prospect sees: the pitch deck, the live product mockups, the one-pagers, the proposal PDFs, the website hero. It exists to make Atlas feel **inevitable** — a category-defining product built by people who sweat every pixel. Our north star for craft is the company a CEO already trusts: **Stripe** (restraint + density done right), **Linear** (speed, precision, dark surfaces), **Notion** (warmth, approachability), **Apple** (confidence through whitespace and typographic hierarchy).

A travel-agency CEO should look at one slide and think: *"This is more serious software than what my agency runs on today."* That feeling is the entire job of this document.

The tokens below are already implemented in `marketing/assets/atlas-ui.css` and the deck shell in `marketing/index.html`. This guide explains **how to wield them** — the rules, the rhythm, and the do/don't lines a designer can pick up and run with immediately.

---

## Table of contents

1. [Brand principles](#1-brand-principles)
2. [Color palette](#2-color-palette)
3. [Typography](#3-typography)
4. [Iconography (Lucide)](#4-iconography-lucide)
5. [Illustration & hero graphics](#5-illustration--hero-graphics)
6. [Chart & data-visualization style](#6-chart--data-visualization-style)
7. [Photography & destination imagery](#7-photography--destination-imagery)
8. [Motion & transition system](#8-motion--transition-system)
9. [Slide layout grid](#9-slide-layout-grid)
10. [Do / Don't quick reference](#10-do--dont-quick-reference)
11. [Designer checklist](#11-designer-checklist)

---

## 1. Brand principles

Five principles govern every decision. When in doubt, return here.

| Principle | What it means in practice |
|---|---|
| **Calm confidence** | We don't shout. No exclamation marks, no neon, no "🚀". Authority comes from restraint, precision, and whitespace — the Apple/Stripe move. |
| **Density with air** | Travel agencies live in dense operational screens. We show that density proudly, then frame it in generous margins so it reads as *organized*, not *cluttered*. Linear does this. |
| **One accent, used sparingly** | Atlas Blue is the only loud color. Everything else is ink, slate, and paper. A single accent makes the product feel designed, not decorated. |
| **Real software, real data** | Every mockup uses the demo agency (Atlas Travel Demo, agents Yasmine/Karim/Lina/Omar, DZD pricing, real routes like Algiers→Dubai). Never lorem ipsum. Realism is the proof. |
| **Outcome over feature** | Headlines speak the CEO's language — *time to booking, conversion, retention* — not the engineer's. The UI shows the feature; the words sell the result. |

**The brand voice in three words:** *precise, warm, operational.*

---

## 2. Color palette

Atlas runs a **light-first** system (paper canvas, dark ink for emphasis surfaces). The palette is intentionally narrow: one brand blue, a disciplined neutral ramp, and a small functional set. Dark navy is reserved for moments of gravity — hero, section breaks, the closing slide.

### 2.1 Core palette

| Token | Hex | Role & usage |
|---|---|---|
| **Ink** | `#0E1525` | The darkest surface. Sidebar, dark slides, hero gradients, table headers. The "weight" color. |
| **Navy** | `#1B2239` | Deep navy surfaces and hero backdrops; the second stop in the navy gradient. |
| **Canvas** | `#F6F8FB` | The default page/slide background. Cool paper — never pure white for large fields. |
| **Surface** | `#FFFFFF` | Cards, panels, table bodies, browser frames. The thing that floats on canvas. |
| **Surface-2** | `#FBFCFE` | Nested/zebra surfaces, table-head fill — a barely-there step down. |
| **Border** | `#E6EAF1` | Hairline borders and dividers. **The most important neutral** — it does the structural work so shadows can stay subtle. |
| **Border-strong** | `#D4DAE6` | Input borders, heavier dividers where a hairline reads too faint. |
| **Text** | `#1B2333` | Primary text. Near-black with a hint of blue so it sits in the same family as ink. |
| **Muted** | `#6B7385` | Secondary text, labels, descriptions, captions. |
| **Faint** | `#9AA1B2` | Tertiary text, placeholders, axis labels, disabled glyphs. |

### 2.2 Brand & accent

| Token | Hex | Role & usage |
|---|---|---|
| **Brand (Atlas Blue)** | `#2B59C3` | The one accent. Primary buttons, active nav, links, key chart series, focus rings, the logo mark. Use it *deliberately* — if everything is blue, nothing is. |
| **Brand hover** | `#2249A6` | Hover/pressed state for primary actions. |
| **Brand soft** | `#EAF0FC` | Brand-tinted backgrounds: icon chips, info panels, selection highlight, soft chart bars. |
| **Brand ring** | `rgba(43,89,195,0.35)` | The 3px focus ring (`--ring`). Accessibility and "this is interactive" cue. |
| **Hero accent (deck)** | `#F0A35E` | Warm amber, used **only** on dark/navy slides for the eyebrow label — a single warm spark against deep blue. Echoes a horizon/sunset without being literal. |

> **Atlas Blue is a confident, slightly desaturated cobalt** — not a Facebook blue, not a Tailwind `blue-500`. It reads as "financial-grade software," adjacent to Stripe's indigo and Linear's accent. Do not brighten it for "energy." The restraint *is* the brand.

### 2.3 Functional / status colors

Each has a solid and a `-soft` tint. Soft tint is the background, solid is the text/icon — that pairing is how every badge and pill is built.

| Meaning | Solid | Soft tint | Usage |
|---|---|---|---|
| **Success** | `#1E9E6A` | `#E4F6EE` | Confirmed bookings, paid invoices, positive deltas, won deals. |
| **Warning** | `#C77800` | `#FBF1DF` | Pending action, expiring holds, attention-needed. |
| **Danger** | `#D14343` | `#FBE9E9` | Errors, cancellations, overdue, destructive actions. |
| **Amber** | `#B45313` | `#FBEEE2` | Secondary emphasis, deadlines, "time" framing (ties to the travel/horizon motif). |
| **Info** | `#2B59C3` | `#EAF0FC` | Neutral informational notes (shares the brand hue intentionally). |

### 2.4 Chart & avatar palette

A six-color categorical ramp. Brand blue always leads (the "hero" series); the rest are tuned to sit in harmony and stay distinguishable for color-blind viewers and in grayscale print.

| Token | Hex | Notes |
|---|---|---|
| `--c1` | `#2B59C3` | Brand blue — the primary/hero series, always first. |
| `--c2` | `#1E9E6A` | Green — second series, revenue/positive. |
| `--c3` | `#B45313` | Amber — third series. |
| `--c4` | `#7C5CE6` | Violet — fourth series. |
| `--c5` | `#1FA2C7` | Cyan — fifth series. |
| `--c6` | `#D14343` | Red — sixth / "churn or negative" series. |

Avatars use a deterministic six-color set (`--av1`…`--av6`, sharing the chart hues plus a magenta `#C2477F`). Assign by hashing the person's name so Yasmine is *always* the same color across every screen — consistency reads as a real system.

### 2.5 Usage rules

- **60 / 30 / 10.** ~60% canvas + surface (paper/white), ~30% ink + neutrals (text, borders, the occasional dark surface), ~10% brand blue + functional color. If brand exceeds ~10% of a surface, pull it back.
- **Dark surfaces are punctuation, not paragraphs.** Use `ink`/`navy` for the hero, section dividers, and the close — moments that need gravity. A deck that is mostly dark feels heavy and "agency-template." Mostly light with dark accents feels like product.
- **Borders carry structure; shadows whisper.** Lean on `--border` for separation. Shadows are soft and low (see §2.6) — they lift cards a millimeter, never a centimeter.
- **Never invent a color.** If a hue isn't in this table, it doesn't ship. New need → propose a token, don't one-off a hex.
- **Contrast floor: WCAG AA.** Body text (`text` on `canvas/surface`) and `muted` on white both clear AA. Never put `faint` on anything but white/canvas, and never use it for anything a reader must read — it's for placeholders and axis ticks only.

### 2.6 Elevation (shadows & radii)

Shadows are part of the palette — they define "floating" without color.

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(16,24,40,.05), 0 1px 1px rgba(16,24,40,.04)` | Resting cards, inputs, badges. |
| `--shadow-md` | `0 4px 12px …/.08` | Card hover, dropdowns, kanban lift. |
| `--shadow-lg` | `0 12px 32px …/.12` | Dialogs, popovers. |
| `--shadow-xl` | `0 24px 60px …/.16` | Device frames in the deck (the browser/phone mockups) — the one place a big shadow is earned. |

**Radius scale:** `--r-sm` 6px (tags, small chips) · `--r` 10px (buttons, inputs) · `--r-lg` 14px (cards, panels) · `--r-xl` 20px (hero containers, device frames) · `--r-full` (pills, avatars, dots). Keep radii consistent per element class — a card is always 14px; mixing 10/14/20 on sibling cards looks broken.

---

## 3. Typography

**One typeface: Inter.** It is the connective tissue between the product UI and the marketing surface — what the prospect sees in the deck is literally the font in the app. Inter at the marketing scale should feel like Stripe's and Linear's type: tight tracking on big sizes, generous line-height on body, tabular numerals on every figure.

```
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

Load the variable/optical-size axis and enable Inter's stylistic features for the polished look:
`font-feature-settings: 'cv02','cv03','cv04','cv11';` (single-story a, open digits) and `tabular-nums` on all numeric data.

Monospace (`ui-monospace, SF Mono, Menlo…`) appears **only** in code, API snippets, IDs, and `kbd` chips — never for prose or numbers in a chart.

### 3.1 The type scale

A single ramp serves both deck and mockups. Bigger sizes get tighter tracking — that inverse relationship is the whole secret to "expensive" type.

| Role | Size | Weight | Tracking | Line-height | Where |
|---|---|---|---|---|---|
| **Hero display** | 54px (deck) / 48px (web) | 800 / 720 | −0.02 to −0.03em | 1.04–1.05 | Slide 1 title, web hero |
| **Slide title (h2)** | 34px | 800 | −0.02em | 1.08 | Section/feature slide headlines |
| **Page title (h1)** | 30px | 650 | −0.022em | 1.15 | Mockup page headers, report titles |
| **Section h2** | 24px | 650 | −0.02em | 1.2 | Card-cluster headings |
| **Subhead h3** | 18px | 650 | −0.014em | 1.3 | Card titles, dialog titles |
| **Lede / lead** | 17–20px | 400 | 0 | 1.5–1.55 | The sentence under a headline |
| **Body** | 14px | 400 | 0 | 1.5 | Default UI/prose text |
| **Body-sm** | 13–13.5px | 400–500 | 0 | 1.45 | Card body, table cells, descriptions |
| **Label / caption** | 12.5px | 500–580 | 0 | 1.4 | Form labels, stat labels |
| **Eyebrow** | 12–13px | 600–700 | +0.06 to +0.16em | 1 | UPPERCASE kicker above a title |
| **Micro / kbd** | 11–11.5px | 600 | +0.05em | — | Table heads (uppercase), axis text, shortcuts |

### 3.2 Weight discipline

Inter ships nine weights. We use **four**:

- **400 Regular** — body, ledes, descriptions.
- **500–550 Medium** — labels, buttons, nav items, table primary cells. (The CSS uses fractional weights like 550/580; round to the nearest available weight if a static font is used.)
- **650 Semibold** — headings, card titles, section labels, badges, the `.strong` emphasis.
- **800 Bold/Extrabold** — hero and slide titles, KPI numbers, the logo wordmark.

Never use 300 (too thin, breaks on projectors) or 900 (too heavy, looks like a discount banner). Two weights per screen is the target; three is the ceiling.

### 3.3 Typographic rules

- **Tracking is a function of size.** Display/title: negative tracking (`−0.02em`). Body: 0. UPPERCASE eyebrows and table heads: positive tracking (`+0.06` to `+0.16em`) or they look cramped. This single rule separates amateur from professional type.
- **Numbers are tabular, always.** Every stat, price, table figure, and chart label uses `font-variant-numeric: tabular-nums` so columns align and KPIs don't jitter. DZD/EUR/USD amounts especially.
- **One eyebrow, one title, one lede.** The canonical headline stack is: UPPERCASE amber/brand eyebrow → big tight title → muted lede. Don't stack two titles or two ledes.
- **Measure (line length) caps at ~70ch.** Ledes use `max-width: 780px`; body prose `max-w-2xl`. Long full-width lines read as a wall.
- **Sentence case for everything except eyebrows.** Titles and buttons are sentence case ("Close the booking," not "Close The Booking"). Only the eyebrow and table-head/section labels are uppercase.
- **No italics for emphasis** — use weight (`.strong`) or the brand color (`.text-brand`). Italic is reserved for the occasional quote.

---

## 4. Iconography (Lucide)

**Lucide React is the sole icon library** — same set as the product, so deck and app stay identical. Lucide's 1.5–2px stroke, rounded joins, and 24px grid match Inter's geometry perfectly.

### 4.1 Sizing

| Context | Size | Notes |
|---|---|---|
| Inline in badges / tags | 12–13px (`h-3 w-3`) | Tiny status glyphs. |
| Buttons, nav, table actions | 15–17px (`h-4 w-4`) | The default. Nav icons 17px, button icons 15px. |
| Stat / card icon chip | 19–21px inside a 38–40px chip | The "feature icon" — glyph in a soft-brand rounded square. |
| Hero / section mark | 21–34px | The compass mark, slide section icons. |
| Empty-state illustration | 44px | Single faint glyph centered above empty-state copy. |

### 4.2 Usage rules

- **Stroke icons only, never filled.** Keep Lucide's default outline style. A filled icon next to outline icons looks like a bug.
- **Consistent stroke weight.** Lucide default is `stroke-width: 2`. Don't mix in 1px or 3px icons; at small sizes 2px holds, at 21px+ you may drop to 1.75 for elegance — but be consistent within a screen.
- **Icons clarify, never decorate.** Every icon must name a real thing (a flight = `Plane`, a client = `User`, money = `Wallet`/`CreditCard`). No icon "for visual interest." If you can't name what it means in one word, remove it.
- **The icon-chip pattern.** Feature/stat icons live in a rounded square chip: 38–40px, `--r` to `--r-lg` radius, `brand-soft` background, `brand` glyph. On dark slides the chip becomes `rgba(91,123,180,.18)` background with `#9FC0FF` glyph. This is the single most-repeated component in the deck — keep it pixel-identical everywhere.
- **One metaphor per concept, forever.** Pick the icon for "proposal," "booking," "supplier," "commission" once and never swap. A stable icon vocabulary is what makes a product feel like a system.
- **Align to the optical center**, not the bounding box — Lucide glyphs are drawn on a 24px grid with ~2px padding; center the chip on the glyph's visual weight.

### 4.3 Canonical icon vocabulary (Atlas domain)

| Concept | Lucide icon | Concept | Lucide icon |
|---|---|---|---|
| Dashboard | `LayoutDashboard` | Flights | `Plane` |
| Hotels / stays | `BedDouble` / `Building2` | Clients / CRM | `Users` / `UserRound` |
| Opportunities / pipeline | `Kanban` / `Target` | Proposals | `FileText` / `ScrollText` |
| Bookings | `Ticket` / `CalendarCheck` | Suppliers | `Plug` / `Network` |
| Finance / commission | `Wallet` / `Receipt` | Reports / analytics | `BarChart3` / `TrendingUp` |
| AI assistant | `Sparkles` / `Bot` | Search | `Search` |
| Destinations / map | `MapPin` / `Globe` | Time-to-booking | `Timer` / `Clock` |
| Confirmation / success | `CheckCircle2` | Warning / hold | `AlertTriangle` |

Lead with the first option; the alternate is for when two related concepts share a screen and need to be told apart.

---

## 5. Illustration & hero graphics

Atlas does **not** use cartoon/character illustration (no Stripe-style blobby people, no Notion doodles for the sales deck). The "illustration" is the **product itself, framed beautifully** — the Linear/Vercel move. This is deliberate: for a B2B operational tool, the screenshot *is* the most persuasive graphic.

### 5.1 The hero graphic = the product in a device frame

The repeating hero element is a **live mockup inside a browser frame** (`.browser-frame`), shown at a slight tilt or straight-on, floating on a navy gradient with a soft `--shadow-xl`. The frame includes the macOS traffic-light dots and a real URL bar (`app.atlastraveldesk.com/...`). Rules:

- **Always real screens.** Pull from the eleven mockups in `marketing/mockups/` (dashboard, crm, flight-search, proposal-builder, reports, etc.). Never a fake wireframe.
- **One frame, one focus.** A hero shows a single screen, not a collage of twelve. If you must show breadth, use a 2×2 small-multiple of frames at reduced opacity behind a lead frame.
- **Float on navy, glow softly.** On the hero/section slides, the frame sits on the `navy` gradient with a large soft shadow and an optional 1px inner light border. The contrast of crisp light UI on deep navy is the signature shot.
- **Phone frame for the mobile story.** Use `.phone-frame` (notch, 9:19.5 screen) only when the narrative is "agents work from anywhere." One phone, optionally beside a browser frame.

### 5.2 The brand mark

The Atlas mark is a **compass / horizon glyph** in a rounded-square chip (the `.hero-mark` / `.logo-mark`): `linear-gradient(150deg, #2B59C3, #3B5B9A)`, white glyph, `--r-xl` radius, soft brand-blue glow. It evokes *navigation* and *operating system* without being a literal airplane or globe (those are clichés every travel tool already uses). Wordmark "Atlas Travel Desk" in Inter 800, −0.01em tracking, ink on light / white on dark.

- **Clear space:** keep a margin of at least the mark's height around the logo lockup.
- **Minimum size:** 22px mark in chrome, never smaller than 18px.
- **Don't** stretch, recolor, add a drop shadow beyond the defined glow, or place the mark on a busy photo without a scrim.

### 5.3 Abstract accents (use sparingly)

When a slide needs visual energy without a screenshot, use **geometric, on-brand accents**, never stock vector art:

- **Dotted-grid / faint guide lines** behind a hero (low-opacity, brand or border color) — the "blueprint of an operating system" motif.
- **Route lines:** a thin brand-blue arc connecting two `MapPin`s (Algiers → Dubai) as a recurring decorative motif. Dashed `2 4`, rounded caps. This is the *only* travel-literal flourish we allow, and it ties to the product (real routes).
- **Soft radial glow** (`auth-bg`-style radial of `accent`) behind cards on light slides for depth.

Never: gradients-as-decoration overload, glassmorphism blur stacks, 3D isometric icon scenes, or AI-art textures. Restraint reads as expensive.

---

## 6. Chart & data-visualization style

Charts are a core selling surface — the Reports and Dashboard screens *are* the pitch for "Atlas runs your numbers." They must look like Stripe's dashboard: clean, honest, tabular, never a marketing infographic.

### 6.1 Style rules

- **Brand blue leads, every time.** The primary series is `--c1` Atlas Blue; secondary series step through `--c2…--c6` in order. Don't randomize series colors between charts.
- **Bars:** flat fill, **4px corner radius on top**, ~60–70% category width. Resting `--brand`; a single highlighted bar may use solid brand while the rest go `soft` (`#DCE6FA`) to direct the eye. Never gradient-fill bars in a data chart (gradients are for hero decoration only).
- **Lines:** 2.5px stroke, rounded caps/joins. Pair with a subtle **area fill** (brand at ~10–12% opacity, or a top-down gradient `id="atlasAreaGrad"`). Data points are white dots with a 2.5px colored ring — only on hover or for the latest point, not every node.
- **Donuts:** 16px stroke, rounded segment caps, a faint `--border` track behind. Center shows the total in 22px/700 ink with a 10px muted label. Max 4–5 segments; everything else is "Other."
- **Sparklines:** 2px brand stroke, no axis, no fill — inline trend beside a KPI.
- **Grid & axes:** horizontal gridlines only, `--border` color, dashed `2 4`. Axis labels in `faint`, 10.5px, Inter, tabular. Drop the chart border/box — let whitespace contain it. No vertical gridlines, no chart-junk, no 3D, no shadows on data.
- **Legends** are inline chips: a 10px rounded swatch + muted label, optionally with the value in `text`/600. Place above or to the right, never a floating box over data.

### 6.2 KPI / stat cards

The dashboard's stat card is a recurring hero of its own: a small icon chip + muted label, a **27px/700 tabular value** (with a smaller muted unit, e.g. `1.2M` `DZD`), and a colored delta (`▲ 12% ` success / `▼ 4%` danger) with a faint "vs last month." Keep four across on desktop, two on tablet. This is the first thing a CEO's eye lands on — make the number the loudest thing on the card.

### 6.3 Honesty rules

- **Y-axes start at zero** for bar charts. No truncated axes to exaggerate growth — a CEO will catch it and you lose all trust.
- **Round sensibly:** `DZD 1.24M`, not `DZD 1,243,887.42` in a headline KPI. Full precision lives in the table below.
- **Label currency explicitly** (DZD / EUR / USD) — the demo agency is multi-currency; never show a bare number where the unit is ambiguous.

---

## 7. Photography & destination imagery

Photography is the **emotional counterweight** to the operational UI — used sparingly, at high quality, to remind the buyer *what business they're in*. The default deck is screenshot-driven; photography appears on the hero, section dividers, the "destinations" story, and the close.

### 7.1 Subject & selection

- **Editorial travel, not stock-travel.** Think a premium airline's brand film or Apple's "Shot on iPhone" — architectural, atmospheric, human-but-not-posed. The Atlas destination list is the shot list: **Algiers, Paris, Dubai, Istanbul, Casablanca, Marrakesh, Cairo, Hurghada, Sharm El Sheikh, Rome, Barcelona, Madrid, Antalya, Doha, Jeddah, Tunis, Maldives.**
- **Lead with our home market.** Algiers, Casablanca, Marrakesh, Tunis, Cairo first — this is a North-Africa-rooted product; showing the Casbah, Hassan II Mosque, or Jemaa el-Fnaa signals "built for agencies like yours," which beats a generic Eiffel Tower.
- **Avoid clichés:** no smiling-headset call-center stock, no thumbs-up tourists, no passport-on-a-map flat-lay, no airplane-window-wing selfie. These scream "template."

### 7.2 Treatment

- **Cool, slightly desaturated grade** that harmonizes with the navy/blue palette — pull warmth down a touch so a Dubai-gold shot doesn't fight Atlas Blue. Consistent grade across all photos so the deck feels authored, not assembled.
- **Always with a scrim when text overlays.** A navy gradient scrim (`linear-gradient(160deg, rgba(14,21,37,.85), rgba(36,48,86,.55))`) keeps white type AA-legible on any image. Text on the dark side, image breathing on the light side.
- **Generous crop, rule-of-thirds, room for type.** Shoot/crop wide; leave a quiet zone for the headline. Full-bleed on section slides; card-cropped (16:9 or 3:2, `--r-lg` corners) inside content.
- **Resolution & format:** 2× for retina, WebP/AVIF, never upscaled or visibly compressed. One soft, blurry, or watermarked photo undoes the whole premium impression.

### 7.3 When NOT to use photography

Inside product mockups, on KPI/data slides, and on dense feature slides — **no photos**. Mixing destination beauty with operational density muddies both. Photography sets the scene; the product closes the deal. Keep them on separate slides.

---

## 8. Motion & transition system

Motion is **calm, fast, and purposeful** — Linear-grade. It confirms state and guides the eye; it never performs. If an animation makes the audience wait, it's wrong.

### 8.1 Timing & easing

| Token | Value | Use |
|---|---|---|
| **Micro** | 120–150ms, `ease` | Hover color, nav background, table-row tint, button states. |
| **Standard** | 200ms, `ease-out` | Card lift, dropdown/scale-in, switch toggle. |
| **Slide transition** | 500ms, `ease` | Deck slide change (opacity + 14px rise + subtle 0.995→1 scale). |
| **Reveal** | 300–400ms, `ease-out` | `fade-in`, `fade-up` (8px), `scale-in` (0.97→1) for entering content. |

**Easing language:** default to `ease-out` (decelerate — content "arrives" and settles, the premium feel). Use a custom `cubic-bezier(0.16, 1, 0.3, 1)` ("ease-out-expo") for the slide transition if you want the signature Linear glide. Avoid `ease-in` (feels sluggish) and bouncy/elastic easings entirely — they read as toy-like.

### 8.2 The deck transition

Slides cross-fade with a gentle vertical rise and micro-scale (already in `index.html`): `opacity 0→1`, `translateY(14px)→0`, `scale(.995)→1`, 500ms. The top **progress bar** (`--brand`, 3px) and bottom **dot rail** (active dot widens to a 22px brand pill) animate in lockstep. This trio — fade-rise + progress + dots — is the entire deck motion vocabulary. Don't add slide-from-side, flips, or cube rotations.

### 8.3 In-slide choreography (build-ins)

When a slide has multiple elements (e.g. four feature cards), stagger their entrance: `fade-up` with **60–80ms stagger** between siblings, left-to-right / top-to-bottom. The eye lands where you intend, in order. Cap a stagger group at ~6 items; beyond that, fade the whole group as one.

### 8.4 Component motion

- **Cards:** `hover:translateY(-1px) + shadow-md`, 200ms. A 1px lift — felt, not seen.
- **Buttons:** background/border transition only, 150ms. No scale-on-press in marketing (save tactile press for the real app).
- **Kanban / draggable:** `translateY(-1px)` + `shadow-md` on hover to signal grabbability.
- **Charts:** animate the *draw* on first view — bars grow from baseline, lines stroke left-to-right (~600ms ease-out) — once. Never loop chart animations.

### 8.5 Rules

- **One thing moves at a time** in the viewer's focal area. Simultaneous unrelated motion = chaos.
- **Respect `prefers-reduced-motion`:** drop transforms, keep opacity-only fades. Accessibility is part of premium.
- **No autoplay loops, no infinite spinners as decoration, no parallax-on-scroll** in the deck. The only persistent motion allowed is a one-time chart draw and the loading `Spinner` in live mockups.

---

## 9. Slide layout grid

Every slide is a **16:9 canvas** with a strict, generous frame. The discipline of the grid is what makes a 30-slide deck feel like one object.

### 9.1 The canvas & margins

- **Aspect:** 16:9 (1920×1080 design space; the live deck is fluid/fullscreen).
- **Outer padding:** `48px top · 70px sides · 60px bottom` (from `.slide`). This wide side margin is non-negotiable — it's where the "Apple confidence" lives. Content never touches the edge.
- **Footer chrome:** a persistent bottom strip (`left/right: 88px, bottom: 30px`) with the brandmark on the left and slide context/page number on the right, in 12.5px muted. It anchors every slide and signals "this is a system."
- **Counter & progress:** top-right page counter (`N / 18`) and a full-width 3px brand progress bar; bottom-center dot rail. These frame the content without intruding.

### 9.2 The content grid

Inside the margins, lay out on a **12-column grid** with a 24px gutter (use the `gap-6`/24px rhythm). Common slide archetypes:

| Archetype | Layout | When |
|---|---|---|
| **Hero** | Centered stack, navy bg, compass mark → eyebrow → 54px title → lede → button. | Slide 1, close. |
| **Section divider** | Big number/eyebrow + title, dark or navy, minimal. | Chapter breaks. |
| **Statement** | Left: headline stack (5–6 cols). Right: device frame or single big visual (6–7 cols). | Most feature slides. |
| **Split feature** | Headline + `.flist` (3 feature items) on one side, browser-frame mockup on the other. | "Here's how it works" slides. |
| **Card grid** | Headline head + 3- or 4-up `.cards` row. | "Everything in one place" / capability slides. |
| **Comparison** | Headline + `.cmp` table (Old way vs Atlas). | The wedge slide. |
| **Data** | Headline + KPI row + one chart, on light canvas. | Proof/ROI slides. |
| **Journey / roadmap** | Horizontal step rail (`.journey` / `.road`) full width. | Workflow & timeline. |

### 9.3 Vertical rhythm

Each slide reads top-to-bottom in three zones: **head** (eyebrow + title + lede, `flex: 0 0 auto`), **body** (the content, `flex: 1`, vertically centered), and **foot** (chrome). Keep the head consistent in height across consecutive slides so titles don't jump as you advance — alignment across slides is a hallmark of a designed deck.

### 9.4 Layout rules

- **One idea per slide.** If a slide needs two headlines, it's two slides. The deck is free; confusion is expensive.
- **Left-align by default.** Center only the hero and the close. Left-aligned headline stacks scan faster and look more editorial.
- **Optical alignment over mathematical.** Align to the visual edge of glyphs and icons (icon chips, big numbers) — nudge a few px so it *looks* aligned, even if the bounding boxes don't match.
- **Max one device frame per slide** (or a deliberate small-multiple set). Two competing frames split focus.
- **Whitespace is content.** A slide with one sentence and a lot of air is a *strong* slide, not an empty one. Resist the urge to fill.
- **Consistent foot, counter, and progress on every slide** — never hide the chrome on "special" slides; consistency is the point.

---

## 10. Do / Don't quick reference

### Color
- ✅ Use Atlas Blue as the single accent; let neutrals carry the layout. ❌ Don't add a second bright accent "for variety."
- ✅ Keep dark navy for hero/section/close. ❌ Don't make the deck mostly dark — it reads heavy and template-y.
- ✅ Build badges as `soft tint background + solid text`. ❌ Don't put solid status colors as large fills.
- ✅ Stay inside the token table. ❌ Don't one-off a hex because "it's close enough."

### Typography
- ✅ Tighten tracking as size grows; loosen it on uppercase eyebrows. ❌ Don't ship default-tracked 54px titles — they look unfinished.
- ✅ Use tabular numerals on every figure. ❌ Don't let KPI digits jitter between frames.
- ✅ Two weights per screen, max three. ❌ Don't mix 300/900 or four+ weights.
- ✅ Sentence case for titles/buttons. ❌ Don't Title-Case Everything Like A Banner.

### Icons
- ✅ Lucide outline, consistent 2px stroke, in soft-brand chips. ❌ Don't mix filled + outline, or icons from another set.
- ✅ One stable icon per concept, forever. ❌ Don't swap the "booking" icon between slides.
- ✅ Every icon names a real thing. ❌ Don't add icons "for decoration."

### Imagery & illustration
- ✅ Frame the real product in a browser/phone frame on navy. ❌ Don't use fake wireframes or cartoon characters.
- ✅ Editorial destination photography, cool-graded, with a scrim. ❌ Don't use headset call-center stock or passport-on-map flat-lays.
- ✅ Lead destination shots with our home market (Algiers, Casablanca, Marrakesh). ❌ Don't default to a generic Eiffel/Big-Ben establishing shot.
- ✅ Photos OR data on a slide, never both. ❌ Don't overlay a chart on a sunset.

### Charts
- ✅ Brand-blue lead series, flat bars (4px top radius), zero-based axes. ❌ Don't gradient-fill data bars or truncate the y-axis.
- ✅ Horizontal dashed gridlines only, no box. ❌ Don't add 3D, shadows on data, or vertical grid clutter.

### Motion
- ✅ 150ms micro / 200ms standard / 500ms slide, all ease-out. ❌ Don't use bounce/elastic or `ease-in`.
- ✅ Stagger build-ins 60–80ms; draw charts once. ❌ Don't loop animations or autoplay parallax.
- ✅ Honor `prefers-reduced-motion`. ❌ Don't make motion mandatory to understand a slide.

### Layout
- ✅ One idea per slide, left-aligned, wide margins, consistent chrome. ❌ Don't cram two headlines or kill the side margins to fit more.
- ✅ Let whitespace breathe. ❌ Don't treat empty space as wasted space.

---

## 11. Designer checklist

Before any deck, mockup, or asset ships, confirm:

- [ ] **Font:** Inter everywhere; mono only in code/IDs; tabular-nums on all figures.
- [ ] **Color:** ≤10% brand blue per surface; only tokenized hexes; AA contrast on all text.
- [ ] **Type:** eyebrow → title → lede stack; negative tracking on titles, positive on eyebrows; ≤3 weights.
- [ ] **Icons:** Lucide outline, 2px stroke, soft-brand chips, one-concept-one-icon.
- [ ] **Product shots:** real mockups in a device frame on navy; never wireframes; one frame focus.
- [ ] **Charts:** brand-led series, flat bars, zero-based axes, dashed horizontal grid, no chart-junk.
- [ ] **Photos:** editorial + cool-graded + scrimmed; home-market-first; no clichés; not on data/feature slides.
- [ ] **Motion:** ease-out, 150/200/500ms; staggered build-ins; reduced-motion fallback; no loops.
- [ ] **Layout:** 16:9, wide margins, one idea/slide, left-aligned, persistent footer/counter/progress.
- [ ] **Data realism:** Atlas Travel Demo agency, real agents (Yasmine, Karim, Lina, Omar, Nadia, Sofiane), DZD/EUR/USD with explicit currency, real routes — never lorem ipsum.
- [ ] **Voice:** outcome-led headlines (time to booking / conversion / retention); calm, no exclamation marks, no emoji in the artifact.

---

*Source of truth: this file plus `marketing/assets/atlas-ui.css` (implemented tokens) and the product `DESIGN.md`. When the product and marketing systems diverge, reconcile here first — the deck must always look like it was cut from the same cloth as the app, because it was.*
