# UX flows

How Vocdoni products behave, step by step, distilled from vocdoni-app and vocdoni.io. Use these as the default shape of any voting, onboarding or admin flow; adapt copy and fields, keep the order and the safeguards. Visual specs live in `product.md` / `editorial.md`; copy rules in `brand-core.md`.

Quoted strings are vocdoni-app's English copy, normalized to the copy rules (sentence case, no exclamation marks, no em dashes). Where the app has no string, the quote is marked as a recommendation.

## Contents

- [Principles](#principles)
- [1. Voter: cast a vote](#1-voter-cast-a-vote)
- [2. Organizer: sign up and onboard](#2-organizer-sign-up-and-onboard)
- [3. Organizer: build and publish a vote](#3-organizer-build-and-publish-a-vote)
- [4. Organizer: run and close a vote](#4-organizer-run-and-close-a-vote)
- [5. Members and census](#5-members-and-census)
- [6. Plans and limits](#6-plans-and-limits)
- [7. Marketing to product handoff](#7-marketing-to-product-handoff)
- [Cross-cutting patterns](#cross-cutting-patterns)

## Principles

- **Voters have no account.** They open a link, prove they are in the census, vote, and leave with a receipt. Never ask a voter to sign up.
- **Confirm before cast, prove after cast.** Every vote goes through a summary confirmation and ends with a verifiable receipt.
- **Irreversible means confirmed.** Ending, canceling, deleting: dialog naming the object and the consequence, red confirm.
- **Nothing silently lost.** Drafts auto-save; leaving with unsaved changes asks; long jobs survive closing the tab.
- **Explain disabled things.** A disabled control comes with the reason and the way to unlock it.
- **One primary action per view**, placed where the eye ends: full width at the bottom of a form, top right of a dashboard page, sticky at the bottom of a ballot.

## 1. Voter: cast a vote

Public page `/processes/:id` (`examples/product-voting.html`).

1. **Land.** Header: optional 3:1 banner, status badge (+ results-visibility tag), title (36px, left), schedule line "Voting from {start} to {end}", markdown description collapsed at ~600px with a gradient fade and "Read more". Sidebar (xl+) or stacked block: relative time ("Ends in 3 days"), anonymity card ("Anonymous vote" / "Private vote" + one plain sentence), "Census: N people", organization, "Follow the process". Aside box: uppercase status overline, big count ("711 votes", hidden while results are secret), the **Identify** button.
2. **Identify** (dialog titled "Authentication"). Step A: one required input per field the organizer configured (member number, name, national ID, birth date...), plus the 2FA contact field when enabled with the helper "Important: must match the one registered in the system", and a terms checkbox. Submit reads "Receive code" with 2FA, "Identify" without. Step B (2FA): "Enter the verification code", 6-digit pin input that auto-submits, "Didn't receive the code? Resend it", "Wrong details? Start over", footer "If you experience any issues, contact your organization." Errors are toasts with the server reason ("The voter is not listed in the census, or the provided credentials are incorrect."). Success has **no toast**: the Vote button appearing is the confirmation. Not eligible: "You are not in the census".
3. **Choose.** Tabs "Questions | Results" (Results hidden when canceled, auto-selected when results exist). Each question is a fieldset: 18px semibold title, optional description, choice cards. Multi-choice shows the rule ("Select up to 2") and a live counter. Ranked: a select per option. Ballot DOM is excluded from session replay.
4. **Vote.** Sticky full-width 50px "Vote" button at the bottom of the questions (with "Your voting power is: N" for weighted votes). Invalid submit scrolls smoothly to the first invalid question and shows the rule inline ("Select at least one option", "Select between {min} and {max} options", "Rank all {count} options").
5. **Confirm** (dialog). Title: the election title (or "Confirm your vote", recommended); lead "Your vote will be recorded for:"; one bordered card per question with a check icon, the question in medium weight and the chosen answers muted. Footer: ghost "Cancel", primary "Confirm vote".
6. **Processing** (blocking dialog, no Escape, no backdrop close): spinner, "We are processing your vote. This takes a few seconds. Please do not close or refresh this page." Failure: "Your vote could not be cast" + Close. Partial: "Some answers were not registered. Vote again to send the remaining ones."
7. **Receipt** (dialog "Vote submitted"): "Your vote has been securely cast. You can verify it here." linking to the explorer by vote id. Anonymous votes add a warning: "Save this receipt now. The platform cannot show it to you again." Single "Close".
8. **After.** Sidebar shows green "Your vote is properly cast"; a success alert lists "Your vote id for {question} is {id}" with explorer links. If vote overwrite is allowed, the button becomes "Vote again" and copy states "only your last vote counts".
9. **Results.** When available: per question, choice label, "votes · percent", thin bar. While hidden: "The results will be made public when the process finishes on {date}." Summary page `/summary`: countdown badge (`3d : 04h : 12m`, "Time remaining to vote"), "Current participation" % with a blue striped bar, three stat cards (census, votes received, participation), results or the encrypted notice, and a dark "Voting guarantees" card (privacy, integrity, verifiability).

## 2. Organizer: sign up and onboard

1. **Sign up** (split auth card). Fields in order: first name, last name, email, password ("Min. 8 characters", eye toggle), optional marketing consent, required "I agree to the Terms of Service and Privacy Policy". Full-width primary "Create my account", "or continue with" divider, outline "Sign in with Google", footer "Already have an account? Log in". Invite links prefill and lock the email and skip verification.
2. **Verify email.** Title "Account created", subtitle "We sent a verification email to:", the address in medium weight, an info alert "Check your spam folder if you don't see the email in your inbox.", 6-cell code input (auto-submit), full-width "Verify" (disabled while empty), outline "Resend email". Magic links auto-verify behind a spinner. Success toast "Email verified", then onboarding.
3. **Tell us about your organization.** Minimal form inside the auth layout: name (required), membership size, organization type, country, default language (inferred from country until chosen). Primary "Create organization"; borderless secondary "Do it later" goes to the dashboard. Help line: "If your organization already has a profile, access the dashboard and contact the administrator to invite you."
4. **Dashboard home.** "Welcome to Vocdoni, {name}" card with plan summary, primary "+ New vote", a "talk to us" secondary and a tutorial video; usage meters; quick actions (outline, icon + label); recent processes list (title link, "Ends on {date}", status badge, vote count, "View all processes ↗").
5. **Sign in / recover.** Email, password, right-aligned small "Forgot your password?" link, full-width "Log in", Google option, "Don't have an account? Sign up". Recovery: one email field, "Email password reset link", toast "Recovery email sent", then reset form (email and code prefilled from the link, new + confirm password, "Reset password"). After sign-in return to the page that required it.

## 3. Organizer: build and publish a vote

The builder is **one document-style page, not a wizard** (`/admin/processes/create`). Writing the vote feels like writing a document; configuration lives in a side panel.

1. **Canvas.** Sticky top bar: "Draft" pill when editing a draft, reset icon (only when dirty), settings toggle, **Publish** (primary), **Save** (outline). Then a borderless 24px title input ("Voting process title"), optional "Attach video" accordion, borderless rich-text description ("Add a description...").
2. **Questions.** Each question is a bordered box labeled "Question {n} of {total}" with drag handle, borderless bold title, optional description, and a settings cluster (top right on desktop): type select (Single choice / Multiple choice) and an "Extended info" switch (turns options into image cards with descriptions). Options are choice cards with a preview radio/checkbox, placeholder "Option {n}", sortable, removable when more than two remain; ghost "+ Add option". Multiple choice adds a sentence with inline selects: "Voters must select at least [1] and at most [3] options." Full-width outline "+ Add question" at the end. Deleting a question asks first.
3. **Settings panel** (slides in from the right; full screen on mobile):
   - Basic: "Start immediately" switch (on by default; off reveals start date and time), end date and time (required). Inline validation ("End date must be greater than start date."), plan-limit alert with a contact link.
   - Extra: result visibility (Live results / Hidden until the end, default hidden), voting power (One person, one vote / Weighted), "Anonymous voting" switch (plan-gated), each with a help tooltip.
   - Census: badge "{n} steps left" (orange) or "Ready" (green). Step 1 "Select a group of members" (searchable select with member counts). Step 2 "Set how voters prove who they are", disabled until a group is picked, with the reason shown. Numbered circular step markers: gray idle, orange current, red error, green done with a check.
4. **Voter authentication** (dialog, three tabs, each unlocked by the previous; ghost "Back", primary "Next" then "Confirm"):
   - Credentials: checkboxes over member fields, max 3, counter "2/3 credentials selected", inline advice (info at 1: "For better security, select at least 2 credentials."; success at 2+).
   - Two-factor: switch, then radio cards Email / SMS / Voter's choice. Next validates the census server-side and lists duplicates or missing data with links to fix them.
   - Summary: chosen credentials with checks, 2FA method, the Weak/Mid/Strong security pills, and a matching alert (error with recommendations / warning / success). Strong = 2FA on; Mid = 3 credentials without 2FA; Weak otherwise.
   - On confirm: toast "Voter authentication configured"; the panel shows a summary card and "Edit voter authentication". Changing the group later resets authentication with an info toast that explains what was kept.
5. **Drafts and leaving.** Auto-save on blur, every 30s and before unload; manual Save toasts "Draft saved". Leaving with changes opens a dialog, "You have unsaved changes. Are you sure you want to leave?", with Cancel (left), red "Discard and leave", primary "Save and leave". The app titles it "Saving draft"; "Unsaved changes" reads better (recommended).
6. **Publish.** Invalid fields show inline; if any is in the settings panel the panel opens; census problems raise one updatable toast with an action ("Voter authentication isn't set up" / "Choose how voters will identify themselves, then publish again." [Set it up]). Publishing shows the button's loading state (no modal), then toast "Voting process successfully created" / "Redirecting you to the voting process page..." and navigates to the admin view.

## 4. Organizer: run and close a vote

Admin process view (`/admin/process/:id`):

- Main column: status badge, title, description; "Schedule" card (2x2 icon tiles: start date, start time, end date, end time); "Voting link" card (read-only input + copy + preview buttons); tabs "Questions | Results" with the results-disclosure badge (blue "Live results", orange "Awaiting results", teal "Results available"; the app currently paints the last one green, see `brand-core.md`).
- Sidebar "Vote information": control panel (outline buttons with colored icons: Pause orange, Resume green, End vote red, Cancel vote red), voting status (total votes, turnout bar, census size, voter lookup "Voted / Not voted"), voting settings tiles (results type, visibility, anonymity, overwrite), additional actions (explorer, PDF report).
- Destructive actions use the confirm dialog (title "End vote" / "Cancel vote", consequence sentence, ghost Cancel, red confirm). On-chain progress shows a persistent, non-closable toast ("Waiting for transaction confirmation...") until it settles.
- Process list (`/admin/processes/{all,ended,drafts}`): tab rail, table (Title, Start, End, Type, Status, Votes, Results, kebab: More info, Public voting page, Explorer, PDF report, Clone as draft), cards under 768px, pagination footer.

## 5. Members and census

- Memberbase page: heading + subtitle; tabs "Members (count)" / "Groups".
- Members toolbar (bordered box): search (debounced), bulk-action row that appears on selection ("Selected: 3 members" + Create group / Add to group / Add to census + red outline Delete), right side outline "Import" and primary "+ Add member". Table with checkbox column, column manager, kebab per row; cards on mobile.
- Add/edit member: end drawer with the form; toast "Member added".
- Import (end drawer, closes only by its buttons): A) choose columns and "Download template", or drop a file (.csv, .xlsx, .xls, .ods); B) map columns (one select per field, used columns removed from the others, warning that unmapped columns are not imported); C) data preview (first rows); footer "Reset import" (outline, left) / "Import data" (primary, right). Runs in the background with a banner "Import in progress. You can close this page; we will email you when it finishes." Ends as success, completed with errors (link to the errors), or error.
- Groups: card grid (title, kebab, "Created {date}", "{n} members", description, full-width `xs` primary "Create a vote"). "All members" is a read-only automatic group. Delete asks: "Are you sure you want to delete {title}? This cannot be undone."

## 6. Plans and limits

- Pricing: Monthly | Annual tabs (Annual tagged "Save 40%" in green), plan cards in a 1/2/4 grid (name, one-line audience, price "/month" or "Price on request", feature list with icons, CTA "Upgrade to {plan}" / disabled outline "Current plan" / "Schedule a call"), then a comparison table and FAQ.
- Checkout: back arrow, two columns: order summary (total due today, then price/period, promotion code) and the payment form with "Subscribe".
- Hitting a limit: dialog "Upgrade to increase your plan limits" / "Your current plan limits this action to {limit}. Upgrade your plan to continue and unlock advanced features." with Cancel / "See plans". Specific limits get specific titles ("Upgrade to add more members to your memberbase").
- Gated feature in place: the control is shown blurred under an overlay with a lock icon, "Your current {plan} plan does not include {feature}", "Available in:" plan tags, and "Unlock {feature}". Never hide a gated feature entirely.

## 7. Marketing to product handoff

- Editorial CTAs go to the app: "Start for free" / "Set up a test vote" to sign-up, navbar "Sign in" to sign-in. Vertical pages pass the sector (`?type=associations`) so the auth showcase and trust bar speak to that sector; the forms never change.
- Every vertical page offers a human path next to the self-serve one ("Talk to an election expert": booking dialog or WhatsApp), and a reassurance microline under the CTA ("Free account, no credit card.").
- Developer pages swap the navbar CTA to "API Dashboard".

## Cross-cutting patterns

| Pattern | Rule |
| --- | --- |
| Validation | Inline under the field, on submit; no browser popups (`noValidate`). If the error is off-screen, scroll to it and/or toast. |
| Toasts | Bottom center. Past-tense success titles. Errors: short title + server message. Fixed ids for repeatable ones. Persistent for connection loss ("Connection issues detected", then "Connection restored"). |
| Confirmation | Dialog for decisions, drawer for entity forms, toast for acknowledgment. Cancel left (ghost/outline), confirm right; red when destructive. |
| Loading | Button `loading` for mutations; thin indeterminate bar for lists; skeletons only for images; blocking dialog only for vote casting. |
| Empty | Icon, title, one sentence, one CTA. Different copy for "nothing yet" vs "no matches for this search". |
| Errors | Page level: icon, "Something went wrong", "Reload the page or go back to the dashboard.", outline "Reload" + primary "Go to dashboard". Section level: "This section could not be loaded" without breaking the page. 404: "404", "Page not found", one-line explanation, primary home button. |
| Responsive | Tables become cards below 768px; sidebars become drawers; voting sidebar stacks below 1280px; sticky primary actions on mobile. |
| Privacy | `ph-no-capture` on ballots, member data and receipts. Never log or replay vote content. |
| Copy | Sentence case; explain consequences; no em dashes. |
