---
name: vocdoni-ui-style
description: Guides building UIs that look and behave like Vocdoni's own products, in its two visual modes - editorial (vocdoni.io marketing look - warm cream, one warm ink, Fraunces serif headings, deep green accent, yellow eyebrow dot) and product (vocdoni-app look - white, Inter at light weights, monochrome or white-label accent). Ships tokens for Tailwind v4 + shadcn/ui, Chakra UI v3 and plain CSS, React components, logos, reference screenshots, runnable HTML examples, copy rules, a style checker, and UX flows for voting (voter identification, ballot, confirmation, receipt, results), vote builders, dashboards, sign-up, member management, emails and result PDFs. Use it whenever a page, app, component, landing page, dashboard, email or document should match the Vocdoni brand, look and feel or UX, or for any voting or governance UI built by or for Vocdoni, even if the user only says "make it look like vocdoni.io", "our style" or "Vocdoni-like". Not for SDK or API usage questions (see vocdoni-sdk, davinci-sdk).
---

# Vocdoni UI style

Vocdoni has **two visual modes on one brand**. Decide the mode before writing any markup: they share a logo, copy rules, icons and status colors, and nothing else. Mixing them (a Fraunces heading in a dashboard, a zinc card on the landing page) breaks the brand.

| Build this | Mode | Looks like |
| --- | --- | --- |
| Marketing site, landing or vertical page, launch microsite, docs portal (`editorial.md`, Docs), blog, case study, pitch page, social/OG image | **Editorial** | vocdoni.io: `assets/reference/editorial-*.webp` |
| Dashboard, vote builder, voting page, voter auth, results, member management, settings, pricing and checkout (they live in the app at `/plans`), admin or internal tool, embedded widget | **Product** | app.vocdoni.io: `assets/reference/product-*.webp` |
| Email | Product for transactional (invitations, codes, receipts), editorial for marketing | `examples/email-vote-invitation.html` |
| PDF / certificate / results report | Document style of the product (`product.md`, Documents) | |

When the request is ambiguous ("a page for our new feature"), ask whether it is public-persuasive (editorial) or something people operate (product).

## Editorial mode in ten rules

Full spec: `references/editorial.md`.

1. Cream surfaces `oklch(0.988 0.011 97)`; never white or gray. Alternate plain and `bg-muted` bands.
2. All text is one warm ink at alpha tiers: 100% headings, 64% ledes/body, 68% uppercase labels only, 10% hairlines, 7% hover fills.
3. Headings are Fraunces, weight 400, `font-variation-settings: 'SOFT' 100, 'WONK' 0`, tracking -0.03em, leading 1.02. Load `@fontsource-variable/fraunces/full.css` (the SOFT axis is not in `wght.css`).
4. Body and UI in Hanken Grotesk; card titles in the sans, 18px semibold.
5. Every section opens with eyebrow (10px yellow dot + uppercase label) then serif heading then muted lede capped at `max-w-2xl`. The yellow appears nowhere else.
6. One dark ink CTA per view (navbar "Sign in", hero "Start for free"); green (`--primary` #296948) for in-page CTAs, links and icons.
7. Cards and panels: 20px radius, 1px ink-10% border, `shadow-sm` only when raised on a tinted band.
8. Section padding 32/64/96px, container `max-w-7xl`, generous whitespace; hero headline sized by container query to land on three lines.
9. Show real product states (eligibility chips, participation bars, verified results), not decorative illustration; code in dark terminal blocks.
10. Motion is soft and scoped: in-view fade/slide, press to 0.96, card lift 4px, never `transition-all`, all off under reduced motion.

## Product mode in ten rules

Full spec: `references/product.md`.

1. White page, zinc neutrals (`#09090b` text, `#52525b` muted, `#e4e4e7` borders, `#f5f5f5` muted fills); dark mode near-black `#0a0a0a`.
2. Inter only. Headings and buttons weight 400, labels 300; 600 only for ballot question/choice labels and dialog titles. Hierarchy by size.
3. Monochrome accent `#18181b` on Vocdoni's own surfaces; an organization's color replaces it everywhere via one value (`createVocdoniProductSystem(color)` or `data-brand` + `--brand`). Surfaces are never tinted.
4. Controls 40px tall, 6px radius; cards, boxes and dialogs 8px radius, flat with a 1px border.
5. Status is a subtle badge with text: upcoming yellow, ongoing green, paused orange, ended gray, results available teal, canceled red; results disclosure beside it: live blue, hidden until the end purple, awaiting orange.
6. Dashboard: 255px sidebar (`#fbfbfb`) with "+ New vote" first, grouped nav, account card at the bottom; page = 24px heading + muted subtitle + gray pill tab rail + bordered boxes.
7. Tables become cards below 768px; sidebars become drawers.
8. Dialogs for decisions (ghost Cancel left, confirm right, red when destructive), end drawers for entity forms, bottom-center toasts for acknowledgments.
9. Auth: split card, form left, dark testimonial showcase right (hidden on mobile), customer logo tiles below.
10. Inputs are 16px on mobile (iOS zoom), 14px from `md`; every icon button has an `aria-label`.

## Always, in both modes

- **Sentence case** for every heading, button, tab, menu item and dialog title. Proper nouns, acronyms and "Vocdoni" keep capitals.
- **No em or en dashes** in copy. Use " - ", a colon, or two sentences.
- Plain, calm, concrete voice. Explain consequences before irreversible actions; reassure with facts ("Nobody, not even the organization, can see who voted what."), never hype. Details and the domain glossary: `references/brand-core.md`.
- Lucide icons (16px inline, 20px in feature tiles), `currentColor`.
- All copy through i18n with English defaults; layouts tolerate 40% longer strings.
- Visible 2px focus ring, AA contrast, reduced motion respected, ballots and member data marked `ph-no-capture`.
- Logo from `assets/logo/` (inline SVG, `currentColor`): ink on cream, black/white in product; never recolored or redrawn.

## UX flows

Voting, onboarding, building and running a vote, census and member import, plan gating: `references/ux-flows.md`. The non-negotiables:

- Voters never create accounts: open link, **Identify** (census fields, optional 6-digit code), choose, **Vote**, confirm the summary, wait on a blocking "processing" dialog, receive a verifiable receipt.
- The election builder is one document-style page with a settings side panel, not a wizard; drafts auto-save and leaving asks.
- Disabled controls always say why; destructive actions name the object and the consequence.

## Workflow

1. Pick the mode (table above) and read its reference plus `references/brand-core.md`.
2. Wire the stack with `references/stacks.md`: copy the token file and components for Tailwind v4 + shadcn, Chakra UI v3, or plain CSS. Load the right fonts.
3. In React, follow `references/recipes.md` (a Chakra admin page and a Tailwind/shadcn vertical page, both compiling and passing the checker). Otherwise start from the closest HTML example and adapt it rather than composing from scratch:
   - `examples/editorial-landing.html`: navbar, hero, trust band, panels, product washes, comparison, FAQ, footer
   - `examples/product-voting.html`: full voter flow, interactive (`?brand=%231a73e8` for white-label, moon button for dark)
   - `examples/product-dashboard.html`: sidebar shell, tab rail, process table, mobile cards, destructive confirm
   - `examples/product-auth.html`: split sign-in with showcase and trust bar
   - `examples/product-builder.html`: document-style vote builder with every form control in the settings panel
   - `examples/email-vote-invitation.html`: transactional email (table layout, inline styles)
4. Write copy last, against the rules above.
5. Verify: render at 1440px and 390px and compare with `assets/reference/`; run `node scripts/check-style.mjs --mode <editorial|product> <paths>` (add `--ignore '<glob>'`, relative to the working directory, for vendored code) and fix errors; warnings are prompts to look.

## Files

| Path | What |
| --- | --- |
| `references/brand-core.md` | Logo, voice, microcopy, vocabulary, status mapping, icons, a11y, i18n, imagery |
| `references/editorial.md` | Editorial tokens, type scale, layout, every component and page pattern |
| `references/product.md` | Product tokens, white-label math, type, layouts, components |
| `references/ux-flows.md` | Step-by-step flows and cross-cutting interaction rules |
| `references/recipes.md` | Worked compositions per mode in React (Chakra v3, Tailwind + shadcn), class translation table, common first-draft fixes |
| `references/stacks.md` | Setup for Tailwind/shadcn, Next.js fonts, Chakra, plain CSS (with class inventory), mixed codebases, email, favicon, OG images, print |
| `assets/tokens/editorial.{tailwind.css,css,chakra.ts}` | Editorial tokens per stack |
| `assets/tokens/product.{tailwind.css,css,chakra.ts}` | Product tokens per stack (Chakra file includes the palette generator) |
| `assets/components/shadcn/` | `button.tsx`, `brand.tsx` (Section, Container, Eyebrow, SectionHeader, Panel, IconTile, Badge, VocdoniLogo), `status-badge.tsx` (StatusBadge, ResultsTag, Tag) |
| `assets/components/chakra/product.tsx` | PageHeader, DashboardBox, DashboardSection, NavItem, DataListCard, StatusBadge, ResultsTag, ResultBar, SecurityLevel, ConfirmDialog (no custom variants, so no typegen needed) |
| `assets/logo/` | Full lockup and mark, `currentColor` / ink / white |
| `assets/reference/` | Screenshots of vocdoni.io and app.vocdoni.io |
| `scripts/check-style.mjs` | Brand linter (copy, tokens, weights, fonts); `--self-test` runs its fixtures |

Related skills: [[vocdoni-integrator-sdk]] (the React voting components and API behind product UIs), [[vocdoni-sdk]], [[davinci-sdk]].
