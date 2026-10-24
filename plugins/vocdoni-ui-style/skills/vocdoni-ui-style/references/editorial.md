# Editorial mode (vocdoni.io)

Warm, editorial, book-like. For marketing sites, landing and vertical pages, product launch pages, docs portals, blogs, case studies, pitch microsites, and any public page whose job is to persuade or explain. Source: vocdoni.io (`layouts/tailwind.css`, `DESIGN.md`, `components/`), values confirmed in the browser. Reference screenshots: `assets/reference/editorial-*.webp`.

## Contents

- [The five pillars](#the-five-pillars)
- [Color](#color)
- [Typography](#typography)
- [Layout and spacing](#layout-and-spacing)
- [Radius and elevation](#radius-and-elevation)
- [Components](#components)
- [Page patterns](#page-patterns)
- [Motion](#motion)
- [Anti-patterns](#anti-patterns)

## The five pillars

1. **Cream, not white.** Every surface is warm cream `oklch(0.988 0.011 97)` (#fdfbf3). Pure white and neutral grays never appear.
2. **One ink, many alphas.** All text and lines are one warm ink `oklch(0.24 0.013 106)` (#202019) at fixed opacity tiers. There is no gray ramp.
3. **A single-weight display serif.** Headings are Fraunces at weight 400 with the SOFT axis at 100: rounded, warm, editorial. Never bold at display sizes.
4. **Deep green accent.** Vocdoni green `oklch(0.47 0.085 158)` (#296948) marks links, icons, chips, in-page CTAs. The top-level CTA is a dark ink button instead.
5. **Signal yellow as punctuation.** A butter-yellow dot (10px as rendered) precedes every section label (the eyebrow). That dot is the only place yellow exists.

## Color

Tokens (light; `.dark` values exist in the token files but vocdoni.io ships light-only):

| Token | OKLCH | Hex | Use |
| --- | --- | --- | --- |
| `--background` | `0.988 0.011 97` | #fdfbf3 | Page and card surfaces |
| `--foreground` | `0.24 0.013 106` | #202019 | Headings, primary copy |
| `--secondary` | `0.962 0.022 97` | #f6f3e2 | Tinted panels: dropdown intro columns, sidebars |
| `--muted` | `0.936 0.033 97` | #f0ead2 | Alternate section bands (often at 50%: `bg-muted/50`) |
| `--primary` | `0.47 0.085 158` | #296948 | Links, icons, chips, green CTAs, focus ring |
| `--surface-dark` | `0.235 0.012 107` | #1f1f18 | Dark CTA, dark panels |
| `--signal` | `0.93 0.11 102` | #f6eb93 | Eyebrow dots ONLY |
| `--success` | `0.45 0.12 152` | #006731 | Small status text/icons |
| `--warning` | `0.48 0.17 45` | #a52e00 | Small status text/icons |
| `--destructive` | `0.637 0.208 25.3` | #ef4444 | Errors, negative comparison marks |

Ink alpha tiers (text and lines on cream):

| Tier | Utility | Contrast | Use |
| --- | --- | --- | --- |
| 100% | `text-foreground` | 15.8:1 | Headings, primary copy, bold lead sentences |
| 65% | `text-foreground/65` | ~5.0:1 | Navbar links |
| 64% | `text-muted-foreground` | 4.9:1 | Ledes, descriptions, body on marketing pages |
| 68% | `text-faint` | 5.6:1 | Uppercase group labels, meta. A hierarchy convention: labels only, never paragraphs |
| 15% | `bg-foreground/15` | - | 1x12px navbar dividers |
| 10% | `border-border` | - | Every hairline |
| 7% | `bg-accent` | - | Hover fills (menu items, ghost buttons) |

Product washes: each Vocdoni product card gets one hue at 10% opacity, 20% on hover, with a round solid button of the same hue: green-600 (App), sky-600 (SDK), amber-600 (custom projects), red-600 (Petitions). These Tailwind hues appear nowhere else.

Data viz: `--chart-1..5` (muted blue/peach ramp). Hero mock results use `purple-500/80` bars; keep that to illustrations.

Code surfaces: `zinc-950` (#09090b) background, `zinc-100` text, JetBrains Mono, highlight.js colors (purple-400 keywords, emerald-400 strings, amber-400 types, blue-400 titles, zinc-500 italic comments).

## Typography

| Role | Face | Load |
| --- | --- | --- |
| Body, UI, labels, card titles | Hanken Grotesk Variable | `@fontsource-variable/hanken-grotesk/wght.css` |
| Headings h1-h6 | Fraunces Variable | `@fontsource-variable/fraunces/full.css` (full = SOFT/WONK axes) |
| Code | JetBrains Mono Variable | `@fontsource-variable/jetbrains-mono/wght.css` |

Google Fonts equivalent: `family=Fraunces:opsz,wght,SOFT,WONK@9..144,100..900,0..100,0..1&family=Hanken+Grotesk:wght@100..900&family=JetBrains+Mono:wght@400;500`. Without the SOFT axis the serif renders sharp and generic instead of rounded.

Headings (global base layer): `font-family: serif; font-weight: 400; font-variation-settings: 'SOFT' 100, 'WONK' 0; letter-spacing: -0.03em; line-height: 1.02; text-wrap: balance`.

Scale (as rendered):

| Element | Size | Notes |
| --- | --- | --- |
| Hero h1 | `clamp(1.5rem, 9cqw, 4.75rem)`, leading 0.95 | Sized from its own container (`@container`, max-w-3xl) so it lands on three lines at every width (8.4cqw under a 20rem container). ~56px at 1440. The ratio is tuned for headlines of about 50-55 characters; a longer headline wraps to four lines on phones, so shorten the copy rather than shrinking the type. |
| Section h2, `display` | `text-4xl sm:text-5xl lg:text-6xl` (36/48/60px) | Page-opening sections |
| Section h2, `section` | `text-3xl sm:text-4xl lg:text-[2.75rem]` (30/36/44px) | Long pages with many sections |
| Dropdown intro title | 30px serif, leading 1.05, tracking -0.01em | |
| FAQ question / small serif heading | 16-18px serif, `font-medium` | Accordion triggers, panel headings |
| Card title | 18px sans `font-semibold`, leading snug | Feature cards, panels (sans, not serif) |
| Lede | 18px, `leading-relaxed`, `text-muted-foreground`, `max-w-2xl` | |
| Body | 16px (`text-base`), `leading-relaxed` | |
| UI text | 14-15px | Buttons 14px (the hero CTA adds `text-base`, 16px), nav 15px |
| Eyebrow | 14px `font-medium uppercase tracking-[0.11em] text-muted-foreground` | |
| Group label | 11-12px `font-semibold uppercase tracking-wider text-faint` | Panel group headers, "Built for", footer headings |

Weight rule: display headings (text-3xl and up) are always 400. At card-title and accordion sizes the site uses `font-medium`/`font-semibold`, mostly in the sans. Never `font-bold` or `font-black` on serif display text.

Globals: `text-wrap: pretty` on body, `balance` on headings, antialiasing, `optimizeLegibility`.

## Layout and spacing

- **Container**: `max-w-7xl` (1280px) centered, `px-4 sm:px-6 lg:px-8`. Navbar inner caps at 1408px. Narrow reading columns: `max-w-4xl`/`max-w-5xl`.
- **Section rhythm**: `py-section sm:py-section-md lg:py-section-lg` = 32 / 64 / 96px. Bands alternate `bg-background` with `bg-muted` or `bg-muted/50`, separated by color only (sometimes a hairline). Header-to-content gap: `mt-12 sm:mt-16`.
- **Spacing base**: Tailwind `--spacing: 0.3125rem` (5px), so `p-4` = 20px, `gap-6` = 30px, `h-9` = 45px, `size-2` = 10px, with explicit overrides (`1.5` = 8px, `3` = 14px, `3.5` = 17px, `5` = 26px, `7` = 34px, `11` = 54px, so `h-11` = 54px). vocdoni.io's own comment calls the base 6px; the value is 5px. Class strings copied from vocdoni.io assume this base; `editorial.tailwind.css` sets it.
- **Grids**: features `md:grid-cols-3 gap-4`; product washes `lg:grid-cols-2 gap-6`; hero `lg:grid-cols-2` with copy left, visual right.
- Overflow is clipped at `body` (`overflow-x: clip`, which keeps `position: sticky`); anchors offset by `scroll-padding-top: 5.5rem`.

## Radius and elevation

Radius: `--radius` 16px. `rounded-sm` 10px, `rounded-md` 12px (buttons, inputs), `rounded-lg` 16px (icon tiles, images), `rounded-xl`/`rounded-card` 20px (cards, panels), `rounded-3xl` 24px (FAQ shell, closing CTA box), `rounded-full` (chips, badges, icon buttons, closing pill CTA).

Shadows (restrained, ink-tinted):

| Token | Use |
| --- | --- |
| `shadow-sm` (0 1px 2px / 8%) | Resting cards and raised panels |
| `shadow-lg` / `shadow-xl` | Hover lift (`.card-hover`), the featured mock card |
| `shadow-panel` | Dropdowns, popovers, cookie banner |
| `shadow-button` | Green primary button (ink ring + drop) |
| `shadow-inset-top` | 1px inner top highlight on the dark CTA |

Panel vocabulary (one card treatment per page, from `VerticalPanel`):

| Surface | Classes | Where |
| --- | --- | --- |
| `raised` | `bg-background border shadow-sm rounded-card` | Only on a tinted (`bg-muted`) section |
| `outline` | `border rounded-card` | Only on a plain section |
| `inset` | `bg-muted/50 border rounded-card` | Plain section, secondary grouping |
| `ledger` | `bg-border border grid gap-px overflow-hidden` | Many rows that read as one document; the 1px gaps draw the hairlines |

A panel never carries a shadow it cannot cast (no shadow on a transparent box). Interactive panels: `hover:border-primary/40` or `.card-hover`.

## Components

Implementations: `assets/components/shadcn/` (Tailwind + shadcn), `assets/tokens/editorial.css` (`vd-*` classes, no framework), `assets/tokens/editorial.chakra.ts` (Chakra v3).

**Buttons**

| Variant | Look | Use |
| --- | --- | --- |
| `dark` | `bg-surface-dark`, cream text, `font-semibold`, inset top highlight, 12px radius. Navbar: 45px tall (`size='sm'`, px-5 = 26px). Hero: 54px (`size='lg'` + `text-base`; px-6 = 30px because it carries an arrow icon, plain `lg` is px-8 = 40px). | The one top-level CTA per surface: navbar "Sign in", hero "Start for free". |
| `default` (green) | `bg-primary`, `shadow-button` | In-page CTAs, form submits, "Set up a test vote". As a closing CTA: `rounded-full h-12 px-8`. |
| `outline` | cream bg, 10% ink border, hover `bg-accent` | Secondary actions ("Talk to an election expert") |
| `ghost` / `secondary` / `link` | hover tints only / `bg-secondary` / green text, underline on hover | Tertiary |
| quiet text link | `text-sm font-medium text-muted-foreground hover:text-foreground`, min-h 44px, optional leading icon | Secondary hero action beside the dark CTA |

All buttons press to `scale(0.96)` on `:active` (150ms, `cubic-bezier(0.2,0,0,1)`); transitions list properties, never `all`. Trailing `ArrowRight` nudges `translate-x-0.5` on hover. Note: vocdoni.io's `DESIGN.md` calls the dark CTA a pill, but it renders with a 12px radius: the variant lists `rounded-full`, the size lists `rounded-md`, and tailwind-merge keeps the last one. Reproduce what renders; pass `rounded-full` explicitly for a real pill (as the closing CTA does).

**Eyebrow and section header**: `<SectionHeader eyebrow title lede align size />`. Eyebrow = `bg-signal` dot (`size-2`, 10px rendered) + uppercase label (`gap-2`), optional halo ring `0 0 0 4px signal/18%`. Then the serif heading, then the muted lede capped at `max-w-2xl`. Center-aligned by default; left-aligned when content follows in columns. A vertical page may put a lucide icon between dot and label ("FOR ASSOCIATIONS AND FEDERATIONS").

**Badges and chips**: badges `rounded-full px-2.5 py-0.5 text-xs font-semibold`; `secondary` (cream) for step labels, `success` (green 10% bg, 30% border, green text) for "Active election". Chips (hero "Built for" row): outlined pills 38px tall, 16px muted icon + 14px medium label, hover `bg-accent`.

**Cards**: `rounded-card border bg-card shadow-sm`; header `p-6`; title 18px sans semibold; description `text-sm text-muted-foreground`. Feature card = icon tile (`size-11 rounded-lg bg-primary/10 text-primary`, icon `size-5`) + title + description. Stat card = big green number (24px semibold `text-primary`) + two-line label.

**Inputs**: `h-10 rounded-md border border-input bg-background px-3`, 16px on mobile, 14px from `md`, placeholder `text-muted-foreground`, focus `ring-2 ring-ring ring-offset-2`.

**Navbar**: sticky, `bg-background/75 backdrop-blur-[14px] border-b`. Logo left (mark below `xl`, full lockup from `xl`). Centered links 15px at `text-foreground/65`, pill hover areas, separated by 1x12px dividers at ink 15%. Right: language switcher (globe + code), dark CTA. Mobile: ghost icon button opens a right `Sheet`; menu/close icons cross-fade with blur and scale.

**Dropdown panel** (MenuPanel): `rounded-2xl border bg-popover shadow-panel`, fades and rises in ~200ms. Left 264px `bg-secondary` intro column with a 30px serif title and a 14px (`text-sm`) muted description. Right: items `rounded-[10px] px-3 py-2 hover:bg-accent` with 15px medium title and 13px muted description; group labels 12px uppercase faint; optional hairline-topped "View all" footer with arrow.

**FAQ**: accordion inside `rounded-3xl border bg-background shadow-sm px-6 sm:px-8`; triggers 16-18px serif medium, `py-5`; answers `text-base leading-7 text-muted-foreground`; hairlines between items.

**Comparison table**: column heads in the serif (22px, muted), the Vocdoni column tinted `primary/8` with its head in green; cells pair a 20px `CircleCheck` (green) or `CircleX` (destructive) with 15px text; row labels muted; hairline rows.

**Footer**: cream, top hairline. Logo + 14px muted mission paragraph + social icons (muted, 24px). Three link columns with 12px uppercase faint headings; links 15px muted, hover ink; one "View all" link in ink medium. Centered uppercase legal row (12px, tracking 0.2em). Bottom row: "© 2026 Vocdoni. Made with ❤️ in Barcelona." (the one emoji on the site) and a GDPR badge.

**Marquee**: client logos scroll horizontally, edges faded with `.mask-gradient-x` (8%/92%), paused on hover.

## Page patterns

**Home hero** (`assets/reference/editorial-home-hero.webp`): left column = serif h1 (3 lines), lede with bold lead sentence, dark CTA with arrow + quiet secondary link (WhatsApp icon allowed), "Built for" group label + chip row ending in a green "All solutions →" link, "Trusted by" label + logo marquee. Right column (lg+) = three product-state cards on a vertical green gradient line with dashed connectors and ringed dots: census (eligible / not eligible rows), active election (participation bar, avatars), verified results (bars, "Legally valid" chip, hash). Cards enter with a spring from the right, staggered 0.3s.

**Vertical page** (e.g. associations, `editorial-vertical-hero.webp`): eyebrow with sector icon, sector-specific headline, sector lede, green CTA "Set up a test vote" + text link "Talk to an election expert", reassurance microline "Free account, no credit card.". Then a tinted trust band (sector logos, check row, three figures), problem section ("The position you are actually in"), guarantees as raised panels, numbered "how it runs" ledger (`01` in JetBrains Mono, serif row title, muted body, check list on the right), comparison table, legal section, FAQ, closing CTA pair.

**Section order for a landing**: hero, trust band, value/guarantees, product or how-it-works, comparison, testimonials/case studies, FAQ, closing CTA, footer. Alternate plain and muted bands.

**Docs** (vocdoni.io/developers):

- Grid: `lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10`, adding a 14rem right TOC column at `xl` (`xl:grid-cols-[15rem_minmax(0,1fr)_14rem] xl:gap-12`). Below `lg` the sidebar moves into a sheet opened from a `PanelLeft` button.
- Sidebar: sticky `top-20 pb-10`, deliberately without its own scroll (the full section list always renders); group labels `text-xs font-semibold uppercase tracking-wide text-muted-foreground/80`; items `rounded-md px-3 py-1.5 text-sm`, idle `text-muted-foreground hover:bg-accent`, active `bg-primary/10 font-medium text-primary` with `aria-current="page"`.
- Article: breadcrumbs (`text-sm text-muted-foreground`, chevrons), serif h1, prose at `text-[15px] leading-7 text-muted-foreground`; h2 serif `text-2xl text-foreground mt-12 mb-4`; h3 `text-lg font-semibold`; strong in ink; links green `font-medium`, underline on hover; inline code `rounded-md border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[0.85em]`; `hr` `my-10`.
- Code blocks: `rounded-xl border border-border/60 bg-zinc-950 shadow-sm`, optional tab strip (`bg-zinc-900/60`, `text-xs text-white/60`, active `bg-white/10 text-white`), body `p-4 font-mono text-[13px] leading-6 text-zinc-100`, copy button top right (`size-8 rounded-md border-white/10 bg-white/5`).
- TOC: sticky, scrolls on its own (`max-h-[calc(100vh-6rem)] overflow-y-auto`); "On this page" label, list with a left hairline; items `text-sm`, `pl-4` (h3 `pl-6`), active `border-l-2 border-primary font-medium text-primary`.
- Pager: two bordered cards (`rounded-xl border-border/60 p-4 hover:border-primary/40`), label `text-xs text-muted-foreground`, title `font-medium` turning green on hover.

## Motion

- Section reveals (`MotionPreset`): fade + slide (or blur) in when 240px from the viewport, once; springs (`stiffness 200, damping 20`), durations ~0.3-0.5s, small stagger (max 0.18s).
- Micro: `.press-scale` (0.96, 150ms), `.card-hover` (-4px + `shadow-xl`, 300ms), arrow nudge, rotating hero word (0.25s ease-out), shimmer for loading accents.
- Page transitions: content cross-fades 300ms.
- All of it disappears under `prefers-reduced-motion: reduce`; smooth scrolling only under `no-preference`.
- Transitions name their properties. Never `transition: all`.

## Anti-patterns

- White (`#fff`, `bg-white`) or neutral gray (`text-gray-*`, `bg-slate-*`) anywhere: use cream and ink alphas. The one exception is a small white tile behind a third-party logo that needs it.
- Hex literals in components instead of tokens.
- Yellow on anything larger than a dot.
- `text-faint` on paragraphs.
- Bold or black serif display headings; sans display headings where the serif belongs.
- Fraunces without the SOFT axis (loading `wght.css` instead of `full.css`).
- More than one dark CTA per view; green and dark competing as co-primaries.
- Gradient buttons, glass cards, glows, drop shadows on transparent boxes.
- Title Case, em dashes.
- `transition-all`, animations that ignore reduced motion.
- Version-suffixed components (`HeroV2`, `new-*`): extend variants instead.
