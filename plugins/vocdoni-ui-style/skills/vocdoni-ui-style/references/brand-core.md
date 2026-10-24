# Brand core (both modes)

What stays the same whether a surface is editorial (vocdoni.io) or product (vocdoni-app). Read this before either mode reference.

## Contents

- [What the brand is](#what-the-brand-is)
- [Logo](#logo)
- [Voice and copy](#voice-and-copy)
- [Microcopy patterns](#microcopy-patterns)
- [Domain vocabulary](#domain-vocabulary)
- [Status semantics](#status-semantics)
- [Iconography](#iconography)
- [Accessibility](#accessibility)
- [Internationalization](#internationalization)
- [Imagery](#imagery)

## What the brand is

Vocdoni sells trust in a decision: that a vote was secret, counted correctly, and can be checked by anyone. Every visual and verbal choice serves that. The look is calm and precise rather than exciting; the voice explains consequences rather than selling. Proof beats claims: show a real product state, a number, a verification link, never a vague "military-grade security" badge.

Three consequences that hold in both modes:

- **Restraint.** One accent per surface, one primary action per view, no gradients on UI chrome, no decorative glassmorphism or neon. Emphasis comes from type size and whitespace.
- **Verifiability is a UI feature.** Receipts, explorer links, "results hidden until the end", census size, audit trails. Surface them; do not bury them in a footer.
- **Neutral toward the organization.** In product mode the organization voting is the protagonist (its name, logo, colors); Vocdoni recedes to the footer line "uses the Vocdoni platform".

## Logo

Files in `assets/logo/`:

| File | Use |
| --- | --- |
| `vocdoni-logo.svg` | Full lockup (mark + wordmark), `fill="currentColor"`. Inline it so it inherits text color. |
| `vocdoni-mark.svg` | Mark only: navbar below `xl`, collapsed sidebars, favicons, avatars. |
| `*-ink.svg` / `*-white.svg` | Fixed-color copies for `<img>`, email, PDF, where `currentColor` is unavailable. |

React: `VocdoniLogo` in `assets/components/shadcn/brand.tsx` (`minimal` prop for the mark).

Rules:

- Height 28px in navbars (`h-7`), 24-26px in product top bars and sidebars, 40px in footers. Width is always `auto`.
- Color is the text color of the surface: warm ink `#202019` on cream (editorial), `#09090b`/black on white and white on dark (product). Never green, never yellow, never a gradient, never outlined.
- Clear space: at least the height of the small mark block on every side. Do not place it on busy photography.
- The mark is two shapes: an open chevron (a ballot box seen from above) and a single bar (the ballot). Do not rotate, re-space or redraw them.
- Swap the full lockup for the mark when width is tight; do not shrink the wordmark below 20px height.
- In white-label product surfaces the organization's own logo replaces Vocdoni's in the top bar; Vocdoni appears as "Powered by" text or a small footer lockup.

## Voice and copy

Rules (enforced by `scripts/check-style.mjs` where mechanical):

1. **Sentence case everywhere.** Headings, buttons, menu items, tabs, dialog titles, table headers: only the first word, proper nouns, acronyms (GDPR, SDK, API, CSV) and "Vocdoni" are capitalized. "Configure voter authentication", not "Configure Voter Authentication". (Parts of vocdoni-app still use Title Case; that is legacy, not the rule.)
2. **No em dash (`—`) or en dash (`–`) as punctuation.** Use a spaced hyphen (` - `), a colon, or two sentences.
3. **Plain, concrete, calm.** Say what happens and what it means for the reader. Short sentences. No hype words ("revolutionary", "seamless", "cutting-edge", "unleash"), no exclamation marks except a rare success moment, no emoji in UI (the vocdoni.io footer line "Made with ❤️ in Barcelona" is the one exception).
4. **Explain consequences before irreversible actions.** Name the object and the effect: `Ending "General assembly 2026" is irreversible. Voters will no longer be able to vote.`
5. **Reassure with facts, not adjectives.** "Nobody, not even the organization, can see who voted what." (recommended wording) beats "Your vote is 100% secure."
6. **Second person, active voice.** "You can change your vote until polls close." The organization is "your organization"; voters are "members" or "voters".

Tone by surface (examples are live copy from vocdoni.io and vocdoni-app):

| Surface | Register | Example |
| --- | --- | --- |
| Editorial headline | Confident, editorial, a little literary | "Trust is not a promise. It is a structural property." |
| Editorial lede | Concrete benefit + proof | "Most digital voting tools ask you to trust their results. Vocdoni gives you proof." |
| Vertical page | Speaks the sector's language | "Assemblies that reach quorum, and decisions that hold" |
| Product heading | Literal noun phrase | "Voting processes", "Memberbase", "Account information" |
| Product helper | One instructive sentence | "Pick the member details voters must enter to vote, like their ID or member number." |
| Voter-facing | Simplest words, zero jargon | "Your vote is properly cast" |

Editorial hero lede pattern: a bold (`font-medium text-foreground`) lead sentence followed by muted explanation in the same paragraph. "**Take your voting processes online without taking on the risk.** Vocdoni combines legal compliance, voter privacy, and results that you and your members can check independently."

## Microcopy patterns

| Situation | Pattern | Examples |
| --- | --- | --- |
| Primary CTA | Verb + object, 1-3 words | "Start for free", "New vote", "Create organization", "Save changes", "Set up a test vote" |
| Secondary editorial CTA | Human, low-commitment | "Talk to an expert", "Talk to an election expert", "See use cases and success stories" |
| Voter auth CTA | "Identify", never "Log in" (voters have no account) | "Identify", "Receive code" |
| Success toast | Short past tense, no exclamation | "Draft saved", "Organization created", "Voter authentication configured" |
| Error toast | What failed + server message as description | "Couldn't load API keys" / description from API |
| Empty state | What is missing + how to fix it | "No voting processes found" / "Create a voting process to get started." |
| Disabled control | Visible hint saying why | "Select a group first to configure authentication." |
| Destructive confirm | Title = action; body = object + consequence; confirm label repeats the action | "End vote" / `Ending "X" is irreversible...` / [Cancel] [End vote] |
| Plan gate | Name the limit and the way out | "Your current Free plan does not include anonymous voting" / "Unlock anonymous voting" |
| Validation | Inline under the field, imperative | "This field is required", "Select between 1 and 2 options" |
| Closing CTA (editorial) | A question | "Ready to see it for yourself?" |

Numbers: tabular figures (`font-variant-numeric: tabular-nums`) for counts, percentages, prices. Format with the locale (`Intl.NumberFormat`, `Intl.DateTimeFormat`): "711 votes", "59.8%", "17 Oct 2026". Results read "425 · 59.8%" (votes, middle dot, percent).

## Domain vocabulary

| Use | Avoid | Notes |
| --- | --- | --- |
| vote, voting process | poll, survey, ballot campaign | "Process" alone in admin UI is fine ("Process paused"). |
| census | voter list, whitelist | Voter-facing copy may say "the list of eligible voters". |
| memberbase, members, groups | contacts, users (for voters) | |
| voter authentication, identify | login (for voters) | Organizers log in; voters identify. |
| anonymous vote / private vote | "encrypted" as a feature name | Anonymous = nobody can link vote to voter. |
| results hidden until the end / live results | secret results | |
| verify, receipt, explorer | blockchain (in voter-facing copy) | Say "public record" or "explorer"; reserve "blockchain" for technical pages. |
| organization | company, client, tenant | |

## Status semantics

Two independent badges, each with one mapping for every surface (lists, voting page, dashboard, cards, PDFs). Subtle style: tinted background, darker text of the same hue, always with a text label.

**Process status** (where the vote is in its lifecycle):

| Status | Hue | Label |
| --- | --- | --- |
| Upcoming | yellow | Upcoming |
| Ongoing | green | Ongoing |
| Paused | orange | Paused |
| Ended | gray | Ended |
| Results available | teal | Results available |
| Canceled | red | Canceled |

**Results disclosure** (shown beside the status, or on a results tab):

| State | Hue | Label |
| --- | --- | --- |
| Live results | blue | Live results |
| Hidden until the end | purple | Hidden until the end |
| Awaiting results (ended, not yet tallied) | orange | Awaiting results |
| Results available | teal | Results available |

This is the skill's normalization. vocdoni-app is not fully consistent: its archive view paints upcoming gray and labels ongoing "Active" (`Process/Archive/View.tsx`), its admin results tab paints "Results available" green (`Process/Dashboard/ProcessView.tsx`), and the public status badge from `@vocdoni/react-components` uses green/yellow/red tones and labels the final state "Results". New UIs should follow the tables above. When the process status is already "Results available", omit the disclosure tag: never show two identical teal badges side by side.

Other meanings: usage meters go orange at 80% and red at 100%; voter-authentication strength is weak red, mid orange, strong green, with only the active level colored.

Editorial mode has fewer statuses; it uses `success` (green) and `warning` (amber-red) at small scale only, e.g. "Eligible" / "Not eligible" chips in product mock cards.

## Iconography

- **Lucide** in both modes (`lucide-react` on the site, `react-icons/lu` in the app). Stroke 2, round caps and joins. Do not mix icon families on one surface.
- Sizes: 16px inline in buttons, menus and metadata; 14px in dense rows; 20px in feature icon tiles (inside a 44px tile); 24-32px only for empty or error states.
- Icons inherit `currentColor`. In editorial mode they sit in `text-muted-foreground` or `text-primary`; in product mode `fg` or `fg.muted`.
- Every icon-only button has an `aria-label`. Decorative icons get `aria-hidden="true"`.
- Recurring meanings: `ArrowRight` = go forward / CTA, `ArrowUpRight` = external, `Check`/`CircleCheck` = guaranteed / eligible, `CircleX` = missing / not provided, `ShieldCheck` = verified, `EyeOff` = secret ballot, `Lock` = anonymous / plan-locked, `Users` = census or members, `Vote` = voting processes.

## Accessibility

- Text contrast AA minimum. Editorial: ink 100% (15.8:1), muted 64% (4.9:1), faint 68% (5.6:1), green 6.3:1. `text-faint` is reserved for uppercase labels as a hierarchy convention (vocdoni.io's DESIGN.md still cites an older 55% / 3.7:1 value; the code uses 68%). Product: `fg` #09090b, `fg.muted` #52525b (7.7:1). A white-label brand color must reach 3:1 as a surface and its label 4.5:1; `product.chakra.ts` picks readable steps automatically.
- Visible focus on every interactive element: 2px ring in the accent color with 2px offset.
- Full `prefers-reduced-motion` support: all animation collapses to ~0ms; in-view reveals render static.
- Hit targets at least 40px tall (buttons 40-54px; inputs 40px).
- Inputs are 16px on mobile so iOS does not zoom on focus; 14px from 768px up.
- Ballot choices are real `<input type="radio|checkbox">` inside `<label>`; a question is a `<fieldset>` with the question as `<legend>`.
- Never rely on color alone: status badges carry text; results carry numbers; errors carry a message.
- Ballot, member data and receipts are excluded from session replay (`className="ph-no-capture"` in PostHog).

## Internationalization

- Every user-facing string goes through i18n (`react-i18next`): `t('process.status.ongoing', 'Ongoing')` with an English default. Keys are `snake_case`, nested by domain.
- Vocdoni ships in many locales (ca, es, en, de, el, eu, fr, gl, it, pt, pt-br, hi...). Design for 30-40% longer strings: no fixed-width buttons, wrap chip rows, `text-wrap: balance` on headings.
- Brand and product names are never translated: Vocdoni, Vocdoni App, Vocdoni SDK, DAVINCI, Decidim.
- Hindi needs a Devanagari fallback font (Noto Sans Devanagari) in both font stacks.

## Imagery

- Photography is warm and human: real assemblies, hands holding phones, community spaces. No stock handshakes, no glowing padlocks, no circuit-board "blockchain" art.
- Product screenshots and photos sit in rounded panels (16-20px radius) with a 1px inset hairline (`.image-outline`).
- Product mocks on marketing pages show real states (eligibility chips, participation bars, verified results), not abstract shapes.
- Customer logos appear as a quiet marquee or tile row; grayscale or low-contrast in editorial mode, on white tiles in product mode.
- Code is always a dark "terminal window" block (`#09090b`, JetBrains Mono) even on cream pages.
