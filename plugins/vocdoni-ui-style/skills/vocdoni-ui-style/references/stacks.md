# Wiring the look into a stack

Pick the mode first (see SKILL.md), then follow the section for the stack. All paths are relative to this skill directory; copy files into the project rather than importing from the skill.

## Contents

- [Tailwind v4 + shadcn/ui (React, Next.js, Vite, Vike)](#tailwind-v4--shadcnui)
- [Chakra UI v3](#chakra-ui-v3)
- [Plain CSS (any framework or none)](#plain-css)
- [Both modes in one codebase](#both-modes-in-one-codebase)
- [Class inventory (plain CSS)](#class-inventory-plain-css)
- [Email, PDF, slides, native](#email-pdf-slides-native)
- [Favicon, social images, print](#favicon-social-images-print)
- [Verify the result](#verify-the-result)

## Tailwind v4 + shadcn/ui

Editorial:

```sh
pnpm add tailwindcss @tailwindcss/vite tw-animate-css class-variance-authority clsx tailwind-merge @radix-ui/react-slot lucide-react
pnpm add @fontsource-variable/hanken-grotesk @fontsource-variable/fraunces @fontsource-variable/jetbrains-mono
```

```ts
// entry (main.tsx / layout.tsx), before the stylesheet
import '@fontsource-variable/hanken-grotesk/wght.css'
import '@fontsource-variable/fraunces/full.css' // NOT wght.css: the SOFT axis lives in "full"
import '@fontsource-variable/jetbrains-mono/wght.css'
import './globals.css'
```

1. Replace the project's global stylesheet with `assets/tokens/editorial.tailwind.css` (it starts with `@import 'tailwindcss'`). Mind the 5px spacing base noted at its top.
2. `npx shadcn@latest init` if shadcn is not set up (CSS variables on; the base color is irrelevant, the token file overrides it). shadcn primitives then pick up cream, ink and green automatically.
3. Copy `assets/components/shadcn/button.tsx` over `components/ui/button.tsx` (adds the `dark` variant, press scale, shadow-button) and `brand.tsx` to `components/brand.tsx` (Container, Section, Eyebrow, SectionHeader, Panel, IconTile, Badge, VocdoniLogo).
4. Shadcn `Card`: change its root classes to `rounded-card border bg-card text-card-foreground shadow-sm`.

Next.js with `next/font` instead of fontsource:

```ts
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
const serif = Fraunces({ subsets: ['latin'], axes: ['SOFT', 'WONK', 'opsz'], variable: '--font-fraunces' })
const sans = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-hanken' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })
// <html className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
```

Then in the token file set `--font-serif: var(--font-fraunces), Georgia, serif;` (same for sans and mono), because `next/font` renames the families.

Product:

```sh
pnpm add @fontsource/inter
```

```ts
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
```

Use `assets/tokens/product.tailwind.css` as the global stylesheet (default 4px spacing). Stock shadcn components work; then:

- Button: `rounded-sm` (6px), `h-10 px-4 text-sm font-normal`; variants `default` (bg-primary), `outline`, `secondary` (subtle gray), `ghost`, `destructive`.
- Input: `h-10 rounded-sm border-input bg-transparent text-base md:text-sm placeholder:text-placeholder`.
- Card / Dialog: `rounded-md` (8px), border, no shadow on cards, `shadow-lg` on dialogs.
- Labels: `text-sm font-light`.
- Status: `assets/components/shadcn/status-badge.tsx`.
- Color mode: `next-themes` with `attribute="class"`, `defaultTheme="system"`, `storageKey="theme-preference"`.
- White-label: `<html data-brand style={{ '--brand': org.color, '--brand-foreground': contrastColor(org.color) }}>` (use `contrastColor` from `product.chakra.ts`; it is plain TS).

## Chakra UI v3

```sh
pnpm add @chakra-ui/react @emotion/react next-themes
```

Product (the native stack of vocdoni-app):

```tsx
// theme/system.ts  <- copy assets/tokens/product.chakra.ts here
// Provider.tsx
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import { ChakraProvider } from '@chakra-ui/react'
import { ThemeProvider } from 'next-themes'
import { createVocdoniProductSystem } from './theme/system'

const system = createVocdoniProductSystem(import.meta.env.VITE_PRIMARY_COLOR) // undefined = monochrome

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange storageKey='theme-preference'>
      <ChakraProvider value={system}>{children}</ChakraProvider>
    </ThemeProvider>
  )
}
```

Memoize the system per color if the color can change at runtime (building one is not free). Copy `assets/components/chakra/product.tsx` for PageHeader, DashboardBox, DashboardSection, NavItem, DataListCard, StatusBadge, ResultsTag, ResultBar, SecurityLevel and ConfirmDialog; they use only built-in variant names, so they compile without typegen, and `Tabs.Root` already defaults to the settings rail. If you use the custom variant names directly (`variant='listmenu'`, `'settings'`, `'data-list-item'`), run `npx @chakra-ui/cli typegen ./theme/system.ts` first or `tsc` rejects them. A full page: `references/recipes.md`.

If the app renders `@vocdoni/react-components` (ballot, results, confirm modal), theme them through that package's component overrides with the recipes in `product.chakra.ts`; the vocdoni-integrator-sdk skill documents the component API.

Editorial on Chakra: copy `assets/tokens/editorial.chakra.ts`, wrap in `<ChakraProvider value={editorialSystem}>`, load Hanken Grotesk / Fraunces full / JetBrains Mono as above. Use `<Button variant='dark'>`, `textStyle='eyebrow'` with a `layerStyle='eyebrowDot'` span, `textStyle='display'` on headings, `<Card.Root surface='raised'>`.

## Plain CSS

For Vue, Svelte, Astro, Django/Rails templates, static HTML, or anything without Tailwind/Chakra:

```html
<!-- editorial -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,100..900,0..100,0..1&family=Hanken+Grotesk:wght@100..900&family=JetBrains+Mono:wght@400;500&display=swap" />
<link rel="stylesheet" href="/css/editorial.css" />

<!-- product -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" />
<link rel="stylesheet" href="/css/product.css" />
```

Classes: editorial `vd-*` (plus `.eyebrow`, `.eyebrow-dot`, `.press-scale`, `.card-hover`, `.image-outline`), product `vp-*`. The `examples/*.html` files show every class in context; start a page by copying the closest example. Self-host the fonts (fontsource or downloaded woff2) when the project forbids third-party requests or has a strict CSP.

With another component library (Vuetify, PrimeVue, Bootstrap, MUI): map its theme to the token values in `editorial.md` / `product.md` (surface, text, primary, border, radius, font), then override button/card/input shapes to match. Do not mix its default palette with these tokens.

## Both modes in one codebase

Typical when a marketing site and an app share a repo. Keep one mode per route tree:

- Separate global stylesheets per layout (Next.js route groups `(marketing)` / `(app)`, separate Vite entries, or Vike `+Layout` per section).
- If both must load on one page, scope the token blocks: replace `:root` with `[data-mode='editorial']` / `[data-mode='product']` and set the attribute on each layout root.
- Never mix within one screen: no Fraunces headings in the dashboard, no Inter-light zinc cards on the landing page. The shared pieces are the logo, copy rules, status mapping and icons.

## Class inventory (plain CSS)

What `editorial.css` and `product.css` provide, so a Vue/Svelte/Astro/template project can compose pages without reading the stylesheets. Modifiers use `--`, parts use `__`.

**Editorial** (`vd-*`, plus vocdoni.io's own utility names):

| Group | Classes |
| --- | --- |
| Layout | `vd-container` (`--narrow`), `vd-section` (`--muted`, `--tint`), `vd-section-header` (`--center`) |
| Type | `vd-hero-measure` + `vd-hero-title`, `vd-display`, `vd-h-section`, `vd-lede`, `vd-card-title`, `vd-label`, `vd-muted`, `vd-stat` |
| Eyebrow | `eyebrow`, `eyebrow-dot`, `eyebrow-dot-halo` |
| Buttons | `vd-btn` + `--dark`, `--primary`, `--outline`, `--secondary`, `--ghost`, `--link`, `--quiet`; sizes `--sm`, `--lg`, `--icon`; `--pill` |
| Surfaces | `vd-card` (`__body`), `vd-panel` + `--raised`, `--outline`, `--inset`, `--ledger`, `--pad`, `--pad-lg`; `vd-icon-tile` |
| Badges | `vd-badge` + `--primary`, `--secondary`, `--outline`, `--success`, `--warning`; `vd-chip` |
| Forms | `vd-field`, `vd-input`, `vd-textarea`, `vd-select`, `vd-field-error` |
| Navigation | `vd-navbar` (`__inner`, `__links`, `__link`, `__divider`), `vd-menu-panel` (`__intro`, `__intro-title`, `__items`), `vd-menu-item` (`__title`, `__desc`) |
| Other | `vd-faq` (on `<details>`), `vd-footer` (`__heading`, `__legal`), `vd-progress`, `vd-code`, `vd-sr-only`, `press-scale`, `card-hover`, `image-outline`, `mask-gradient-x` |

**Product** (`vp-*`):

| Group | Classes |
| --- | --- |
| Shell | `vp-shell`, `vp-sidebar` (`__section-title`), `vp-nav-item` (`aria-current="page"`), `vp-content`, `vp-page-header`, `vp-topbar` |
| Type | `vp-title-4xl`, `-2xl`, `-xl`, `-lg`, `vp-subtitle`, `vp-text-sm`, `vp-text-xs`, `vp-muted`, `vp-overline`, `vp-link` |
| Buttons | `vp-btn` + `--outline`, `--subtle`, `--ghost`, `--danger`, `--danger-outline`; sizes `--xs`, `--sm`, `--lg`, `--icon`, `--block` |
| Forms | `vp-field`, `vp-label`, `vp-input` (`--borderless`), `vp-select`, `vp-textarea`, `vp-helper`, `vp-field-error`, `vp-check`, `vp-switch`, `vp-radio-card`, `vp-dropzone`, `vp-step` (`data-state`), `vp-or` |
| Status | `vp-badge` + `--green`, `--teal`, `--yellow`, `--orange`, `--red`, `--purple`, `--blue`, `--md`; `vp-alert` + `--info`, `--success`, `--warning`, `--error` (`__title`) |
| Surfaces | `vp-card` (`__body`), `vp-box`, `vp-section`, `vp-table-wrap` + `vp-table`, `vp-tabs` + `vp-tab` (`aria-selected`), `vp-tabs-line` |
| Voting | `vp-choice` (`__label`, `__desc`), `vp-progress` (`--teal`, `--orange`, `--red`), `vp-security` (`data-level`, `data-active`) |
| Overlays | `vp-backdrop`, `vp-dialog` (`__header`, `__body`, `__footer`), `vp-toaster` + `vp-toast` (`--success`, `--error`, `__title`) |
| Auth | `vp-auth` (`__form`, `__showcase`, `__quote`, `__rule`) |
| Utility | `vp-sr-only` (skip links become visible on focus) |

## Email, PDF, slides, native

No OKLCH, no variable fonts. Use hex and fallbacks:

| Role | Editorial | Product |
| --- | --- | --- |
| Background | #fdfbf3 | #ffffff |
| Text | #202019 | #09090b |
| Muted text | #706f67 | #52525b |
| Border | #e7e5dd | #e4e4e7 |
| Accent | #296948 (green) / #1f1f18 (dark CTA) | #18181b |
| Tinted band | #f0ead2 | #f5f5f5 |
| Signal dot | #f6eb93 | - |

Fonts: Fraunces and Hanken Grotesk are Google Fonts and embed in PDFs and slides; in email use `Georgia, serif` for headings and `Helvetica, Arial, sans-serif` for body.

Email: start from `examples/email-vote-invitation.html` (600px table, inline styles, hex colors, preheader, bulletproof button, plain-text fallback, "uses the Vocdoni platform" footer line). Transactional mail (invitations, codes, receipts, reminders) is product mode and sent in the organization's name; marketing mail is editorial (cream band, serif headline in `Georgia` fallback, one green or dark button). Results PDFs and certificates follow the document spec in `product.md`. Logos: `assets/logo/*-ink.svg` / `*-white.svg` (rasterize for email clients that block SVG).

## Favicon, social images, print

- **Favicon**: the mark (`assets/logo/vocdoni-mark-ink.svg`) as SVG favicon plus a 32px PNG and a 180px apple-touch icon, ink on transparent (editorial) or black (product). White-label product pages use the organization's own icon.
- **Social images (Open Graph, 1200x630)**: editorial look. Cream background, eyebrow (dot + label) top left, the page's serif headline at 64-72px over at most three lines, logo bottom left, optional product screenshot right with `image-outline` and a 20px radius. vocdoni.io renders blog covers from a template script (`scripts/blog-cover/`); follow the same layout rather than designing per post.
- **Print** (results pages, receipts): white background, black text, hide navigation, sidebars and buttons (`@media print`), keep status labels and the verification link or process id visible, expand collapsed descriptions.

## Verify the result

1. Render the page and compare it with `assets/reference/*.webp` at 1440px and 390px.
2. Run `node scripts/check-style.mjs --mode editorial|product <src dirs>` and fix every error.
3. Check: one primary CTA per view, sentence case, no em dashes, focus ring visible on Tab, reduced motion respected, contrast AA, inputs 16px on mobile.
