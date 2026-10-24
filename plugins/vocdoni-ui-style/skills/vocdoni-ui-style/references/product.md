# Product mode (vocdoni-app)

Neutral, light, white-label. For anything people use rather than read: organization dashboards, the election builder, public voting pages, voter authentication, results, member management, settings, pricing and checkout inside the app, admin and internal tools, embedded voting widgets. Source: vocdoni-app (`src/theme/*`, Chakra UI v3), values confirmed against computed styles on app.vocdoni.io. Reference screenshots: `assets/reference/product-*.webp`.

## Contents

- [Principles](#principles)
- [Color](#color)
- [White-label accent](#white-label-accent)
- [Typography](#typography)
- [Radius, elevation, sizing](#radius-elevation-sizing)
- [Layouts](#layouts)
- [Components](#components)
- [Documents (results report PDF)](#documents-results-report-pdf)
- [Anti-patterns](#anti-patterns)

## Principles

1. **The organization is the protagonist.** Surfaces are white and neutral so an organization's logo, name and (optional) color carry the identity. Vocdoni's own presence is the logo in the top bar or a footer line.
2. **Light type, quiet chrome.** Inter at 300-400. Headings and buttons are weight 400; hierarchy comes from size, not weight. Borders are 1px zinc-200 hairlines; shadows are rare.
3. **Monochrome by default.** With no brand color the accent is near-black (#18181b): black buttons, black checked states, gray tints. Color is reserved for status (green/teal/yellow/red badges) and, on auth pages, the dark testimonial showcase.
4. **Dark mode is first-class.** Light, dark, and system preference (next-themes, `class` attribute, storage key `theme-preference`). Dark surfaces are near-black neutrals that are never tinted by the brand color.

## Color

Light (Chakra v3 defaults plus vocdoni-app overrides):

| Token (Chakra) | CSS var (`product.css`) | Value | Use |
| --- | --- | --- | --- |
| `bg` | `--bg` | #ffffff | Page, cards, dialogs |
| `bg.subtle` | `--bg-subtle` | #fcfcfc | Table headers, row hover |
| `bg.muted` | `--bg-muted` | #f5f5f5 | Tab rail, subtle buttons, filled sections |
| `bg.emphasized` | `--bg-emphasized` | #e4e4e7 | Pressed, active nav item (monochrome) |
| `fg` | `--fg` | #09090b | Text |
| `fg.muted` | `--fg-muted` | #52525b | Subtitles, descriptions, meta |
| `fg.subtle` | `--fg-subtle` | #b2b2b2 | Disabled text, faint icons |
| `border` | `--border` | #e4e4e7 | All hairlines, inputs, cards |
| `input.placeholder` | `--placeholder` | #737373 | Placeholders |
| `gray.solid` | `--brand-solid` | #18181b | Primary buttons, checked controls (monochrome) |
| `dashboard.menu` | `--dashboard-menu` | #fbfbfb | Sidebar background |
| `auth.bg` | `--auth-bg` | #fcfcfc | Auth page background |

Dark: page #0a0a0a (`ink.650`), panels #111111, `bg.muted` #3f3f3f, `fg` #fcfcfc, `fg.muted` #b2b2b2, `border` #27272a, sidebar #18181b, primary buttons white with black text.

Status palettes use Chakra's subtle pairs (palette.100 bg / palette.700 text in light; palette.900 / palette.300 in dark): green #dcfce7/#116932, teal #ccfbf1/#0c5d56, yellow #fef9c3/#845209, red #fee2e2/#991919, purple #f3e8ff/#641ba3, blue #dbeafe/#173da6, orange #ffedd5/#92310a. Mapping in `brand-core.md`.

## White-label accent

vocdoni-app reads one runtime value, `PRIMARY_COLOR` (`#rgb`/`#rrggbb`), and derives everything from it:

- A 50-950 scale by mixing toward white (tints 95/90/80/60/30%) and black (shades 15/30/45/60/75%) in OKLab; 500 is the color verbatim.
- Semantic slots per color mode: `solid` (500, or the first step reaching 3:1 against the page), `contrast` (white if it reaches 4.5:1 on solid, else black), `fg` 700/300, `muted` 200/800, `subtle` 100/900, `emphasized` 300/700, `focusRing` and `border` = solid. `product.chakra.ts` goes one step further than the app for `fg`: it walks 700→950 (300→50 in dark) until the text reaches 4.5:1, which only changes the result for pale brands such as white or yellow.
- The brand becomes the global `colorPalette`, so buttons, checkboxes, radios, switches, tabs, focus rings and the active nav item follow it. Surfaces never do.

Implementations: `createVocdoniProductSystem('#1a73e8')` in `assets/tokens/product.chakra.ts` (port with contrast picking); `<html data-brand style="--brand:#1a73e8">` with `product.css` / `product.tailwind.css` (OKLab `color-mix`, same tints). CSS cannot measure contrast: for very light or very dark brands also set `--brand-on` (label color), and in `product.css` `--brand-solid-light`/`--brand-solid-dark` and `--brand-fg-light`/`--brand-fg-dark`; compute them with `generatePaletteScale` and `contrastColor` from `product.chakra.ts`.

Leave the brand unset for Vocdoni's own surfaces. Set it only when the UI represents a specific organization.

## Typography

Inter everywhere (`body` and `heading` fonts), Menlo for code. Load 300, 400, 500 and 600 (`@fontsource/inter/{300,400,500,600}.css`); the app only loads up to 500, so its 600/800 spots render as faux bold, which you should not copy.

The weight tokens are shifted one step lighter: `normal` = 300, `medium` = 300, `bold` = 400, `bolder` = 500. As rendered:

| Element | Size / weight | Notes |
| --- | --- | --- |
| Body | 16px / 400, line-height 1.5 | |
| Page heading (dashboard) | 24px (`2xl`) / 400 | With a 16px muted subtitle under it |
| Voting page title | 36px (`4xl`) / 400, left-aligned | |
| Section / auth title | 18-20px / 400, letter-spacing ~-0.03em | "Welcome" (sign-in), "Sign up" |
| Question title | 18px / 600 | Ballot questions |
| Choice label | 16px / 600 | Ballot options |
| Form label | 14px / 300 | Light labels are part of the look |
| Input, button text | 14px / 400 (16px inputs on mobile) | |
| Badge / tag | 12px / 300 | |
| Helper, meta | 12-14px / 400, `fg.muted` | |
| Overline | 12px uppercase, letter-spacing 0.1-0.16em, `fg.muted` | "VOTING IN PROGRESS", "SUCCESS STORIES" |
| Dialog title | 18px / 600 | The skill's normalization: the app asks for `extrabold` but loads Inter only up to 500, so it renders faux bold |

Text sizes (`text` recipe): xs 12/1.5, sm 14/1.43, md 16/1.5, lg 18/1.56, xl 20/1.5, 2xl 24/1.3. Links are underlined at rest (`from-font` thickness, 0.15em offset), gray-800, hover gray-500.

## Radius, elevation, sizing

Radii: `xs` 4px, `sm` 6px (buttons, inputs, tags, badges, tab triggers, nav items), `md` 8px (cards, boxes, dialogs, choice cards, results cards), `lg` 10px, `xl` 12px, `2xl` 16px, `full` (avatars, progress bars).

Elevation: almost none. Cards are flat with a 1px border. `shadow-xs` on the active tab, `shadow-md` on menus and popovers, `shadow-lg` on dialogs and toasts.

Sizes: control height 40px (`md`), 36px (`sm`), 32px (`xs`, sidebar CTA and table actions), 50px (sticky Vote button); sidebar 255px (48px collapsed); voting sidebar 320px; content max 1200px; voting page contents max 1560px (min 960px with the sidebar); top bar max 1920px; auth card max ~1152px.

## Layouts

**Dashboard shell** (`examples/product-dashboard.html`): sticky full-height left sidebar (255px, `#fbfbfb`, right border). Top to bottom: logo (mark when collapsed), full-width `xs` primary "+ New vote", section titles ("Platform", "Help") in small medium muted text, nav items (`listmenu`: 32px, 6px radius, 16px lucide icon + 14px label, hover `bg.muted`, active `colorPalette.200` + `aria-current="page"`), a dismissible "First steps" help card, and the user card (avatar, first name, organization, `ChevronsUpDown`) opening a popover with switch organization, account, theme, language, log out. Collapse toggle appears on hover; collapsed state persists in localStorage; collapsed items get right-side tooltips. Below 768px the sidebar becomes a start drawer behind a slim top bar (`PanelLeft` icon button, page action on the right). No global desktop top bar.

**Dashboard page**: `p-6`; heading 24px + muted subtitle; primary page action top right; sub-sections as the `settings` tab rail (gray `bg.muted` rail, p-1, white raised active tab with `shadow-xs`, 14px light labels, route-driven); content in bordered `DashboardBox`es (8px radius, p-4) or filled `DashboardSection`s.

**Public pages** (voting page, organization page): sticky blurred top bar (logo or the organization's logo left; language menu and color-mode toggle as `subtle` buttons right), content centered, footer with logo, "The global voting protocol"-style tagline, link columns, terms/privacy and social icon buttons. Voting page: main column + 320px sidebar from `xl`; below `xl` one column with the sidebar content after the header.

**Auth** (`examples/product-auth.html`): back link ("← Home" on sign-in, "← Back" elsewhere) and language menu above a bordered split card. Form column 52% (md) / 46% (lg); showcase 48% / 54%, hidden below `md`, min height 34rem/38rem. Showcase: deep desaturated tone derived from the quoted organization's logo (e.g. #302415, #251a42), white text at ~13:1, overline sector label, 24px quote, 16% white rule, author row with a white logo tile, logo watermark at ~9% bleeding off the bottom-right. Under the card: a trust sentence ending in a colon and a row of 48-52px logo tiles.

## Components

Implementations: `assets/tokens/product.chakra.ts` (system + recipes), `assets/components/chakra/product.tsx` (PageHeader, DashboardBox, DashboardSection, NavItem, DataListCard, StatusBadge, ResultsTag, ResultBar, SecurityLevel, ConfirmDialog), `assets/components/shadcn/status-badge.tsx`, `assets/tokens/product.css` (`vp-*` classes).

**Buttons**: 40px, 6px radius, 14px weight 400, px 16. `solid` (brand-solid bg, contrast text) for the primary; `outline` (zinc border, transparent) for secondary; `subtle` (#f5f5f5 bg, zinc-800 text) for chrome like language/theme toggles; `ghost` for Cancel/Back and icon buttons; `colorPalette="red"` solid for destructive confirms; red outline for "Delete" in toolbars. Full-width primaries in auth forms and voter flows. Buttons show Chakra `loading` during mutations and stay disabled until prerequisites resolve, with a visible hint.

**Inputs**: 40px, 6px radius, 1px zinc-200 border, transparent bg, 14px (16px under `md`), placeholder #737373, labels 14px light above with 6px gap, errors 12px red under the field. Password fields have an eye toggle. Builder titles use borderless inputs (24px, no border, no padding). OTP: 6-cell pin input, autofocus, auto-submit when complete.

**Badges / tags**: subtle palette pairs, 6px radius, 12px light text, `px-1 py-0.5` (xs). Count pills beside tab labels.

**Choice cards** (ballot): full-width `label` cards, 8px radius, 1px border, p-3, 12px gap between, native radio/checkbox, semibold label + muted description. Checked = border `fg` (black/white). Optional image cards in a 1/2/3-column grid with the control top-right; images 4:3 with a skeleton until loaded, opening a lightbox.

**Results**: per question a bordered card; for each choice the label left, "votes · percent" right (muted, tabular), a thin full-width bar under it (teal in the public view, gray in the SDK default). Hidden results: "The results will be made public when the process finishes on {date}."

**Alerts**: subtle palette backgrounds (info blue, success green, warning orange, error red), 8px radius, 20px icon, medium title + body.

**Toasts**: bottom center, `fit-content` up to 384px, indicator + short title + optional description and action. 3-5s for confirmations, 8-10s for actionable errors, persistent for connection loss and on-chain progress. Fixed ids so repeated triggers update one toast.

**Dialogs**: centered, 8px radius, 18px semibold title, muted 14px body, footer right-aligned with ghost Cancel then the confirm. Destructive confirms use red. Entity forms (add member, edit group, import) use end-placement drawers instead; short decisions use dialogs.

**Tables**: bordered wrapper (8px radius), `outline` variant, 12px medium muted headers on `bg.subtle`, 14px cells, numbers right-aligned tabular, last column a kebab (`EllipsisVertical`) menu with icon + label items. Pagination in the footer: rows-per-page select, "Page X of Y", `xs` outline buttons. Below 768px each row becomes a `data-list-item` card: title + kebab, badge row, "Label: value" lines.

**Security level**: three equal uppercase pills (Weak / Mid / Strong) with white text and a 2px border; only the current one colored (red-800/600, orange-800/600, green-800/600 bg/border), the others `gray.900`.

**Progress**: 8px rounded bar on `bg.muted`; indeterminate `xs` bar for loading lists. Usage meters orange at 80%, red at 100%.

**Empty states**: icon or illustration (48px), bold-ish 18px title, muted description, one CTA. For lists, an info alert above the list ("No voting processes found" / "Create a voting process to get started.").

**Loading**: thin indeterminate progress bar or small spinner with "Loading..."; skeletons only for images.

**Form controls** (`examples/product-builder.html` shows each one):

| Control | Spec |
| --- | --- |
| Text input / textarea | 40px, 6px radius, zinc-200 border, transparent bg, 14px (16px under `md`); focus = accent border + 1px ring; invalid = red border + 12px red message under the field (`aria-invalid`, `aria-describedby`). |
| Select | Same box as inputs with a chevron; react-select / Chakra `Select` for searchable lists (member groups) with counts in each option. |
| Checkbox / radio | 18px, accent-colored when checked, label 14px to the right; in ballots they live inside choice cards. |
| Switch | Track 36x20px, gray-200 off, accent on, white thumb; label left, control right, help text under the label. Used for "Start immediately", "Anonymous voting", "Extended info". |
| Radio cards | Bordered 8px cards with a title and one-line description; checked = `fg` border. Used for 2FA method and result visibility. |
| Date and time | Native `date` + `time` inputs side by side (two 40px fields), opening the picker on focus; validation messages under the pair. |
| Code (OTP) | One field, `inputmode="numeric"`, `autocomplete="one-time-code"`, letter-spaced 20px digits, auto-submit at 6 digits. The app renders six boxes (Chakra `PinInput`), which is fine only if each box is labeled and paste works. |
| Dropzone | Dashed 1px zinc-300 border, 8px radius, icon + "Drop a file or browse" + accepted types; drag-over state tints `bg.muted`. |
| Step marker | 24px circle with the step number: gray idle, orange current, red error, green done with a check. |
| Sentence with inline selects | "Voters must select at least [1] and at most [3] options." for min/max rules, instead of two labeled fields. |

**Charts and results**: result bars are thin (6-8px) rounded bars on `bg.muted`, one hue per question (teal in the public results, the brand color is fine in dashboards), label left, "votes · percent" right in tabular figures. Participation on the summary page is a blue striped bar. Avoid pies and donuts; for weighted votes show both "share of votes" and "share of voting power". Dark mode keeps the same hues one step lighter.

**Mobile voting**: one column; header, then the info block, then the ballot; the Vote button is sticky at the bottom with `padding-bottom: env(safe-area-inset-bottom)` and a white/`bg` backing so choices never hide behind it; dialogs go full width with 16px margins; banner images keep 3:1 and crop, never letterbox; choice cards keep a 48px minimum height.

## Documents (results report PDF)

The results certificate (vocdoni-app `Process/VotingReportPdf`, `@react-pdf/renderer`) has its own document look, closer to a legal report than to the app:

- A4 portrait; page padding 56pt sides, 36pt top, 56pt bottom; cover 62/52pt.
- Helvetica, 9.25pt body, 1.3 line height; ink `#172033` on paper `#fbfcfe`; secondary text `#4b5563`/`#5f6b7a`; hairlines `#d8dee8`/`#dde3eb`.
- One accent, teal `#18a3a8`: a 52x3pt hairline above the cover title, the underline of each section title, bullet markers; links `#0f7f86`.
- Cover: logo (128x28pt), uppercase document title ("TECHNICAL CERTIFICATION OF THE DIGITAL VOTING PROCESS"), process name in 24pt bold teal, "Process ID: …" subtitle above a hairline, an index, and the issue line.
- Running header on inner pages: small mark (18pt) over a bottom hairline.
- Numbered sections, 12.5pt bold with a teal underline: 1. Technical framework, 2. General information, 3. Authentication, 4. Census and participation, 5. Questions and results, 6. Verification, 7. Issuer.
- Key-value tables: white, 1pt `#dfe5ee` border, 2pt radius, 8pt labels, 9.25pt values. Results tables: option, votes, share of votes (and share of voting power / eligible power when weighted) with an inline bar.
- Close with the verification procedure (explorer link, process id) and the issuer statement and disclaimer.

Build other documents (minutes, invitations, receipts) on the same skeleton: white paper, one accent, numbered sections, key-value tables, a verification block.

## Anti-patterns

- Cream backgrounds, Fraunces, the yellow eyebrow dot or green brand CTAs in product mode (that is editorial mode).
- Semibold/bold headings and buttons: the product reads light (400).
- Tinting surfaces, sidebars or dark mode with the brand color.
- Colored primary buttons on Vocdoni's own surfaces (it is monochrome until an organization brand applies).
- Large radii (16px+) on controls; heavy shadows on cards.
- Title Case labels ("Add Member", "Confirm Vote"), even though older app strings use them.
- Status without text (color-only dots), or new status colors outside the mapping.
- Toasts for things that need a decision; dialogs for things that only need acknowledgment.
