---
name: stripe-subscription
description: Creates a Stripe subscription for an existing Vocdoni SaaS customer, including per-customer "Custom" and "Integrator Starter" plans cloned from template products, with the org-address metadata the backend needs, an optional discount, and a chosen payment-collection mode. Use this whenever the user wants to give an organization a plan, assign or create a subscription, make a subscription free or discounted, set up a custom or integrator plan for a client, or asks anything about creating subscriptions, coupons, or plan products in Stripe for Vocdoni, even if they only mention a customer email, a product name, or a 0x organization address.
---

# Stripe subscription for a Vocdoni org

You are about to move real money settings on a live billing account. The
workflow below is shaped by mistakes that already happened once: the CLI
silently pointing at a sandbox instead of live, a subscription created for a
customer without a card (it dies `incomplete` after 23 hours), a discount
applied after creation so the first invoice had to be patched by hand, and a
coupon left open for anyone to reuse. Every step exists to make one of those
impossible.

Work through the phases in order. Never write to Stripe before the user has
confirmed the table in Phase 3.

## Phase 0: preflight

**Tooling.** You need `jq` (the scripts and every cookbook command parse
JSON with it) and one of:

- The Stripe CLI, installed and with a started session. Check with
  `scripts/stripe-json.sh env` (without `STRIPE_ENV` it only reports the
  account and mode; the environment is chosen in Phase 1). If it fails it prints what is missing and how
  to fix it: install `jq`, install the CLI, `stripe login`, and
  `stripe agent setup` to install the Stripe CLI agent skill. Install what
  you can yourself (a package manager the user already uses is fine) and ask
  the user for anything that needs their credentials or privileges. Do not
  continue until it prints a mode.
- A connected Stripe MCP server (tools named `mcp__…stripe…`) with its skill.
  The phases are the same; `references/stripe-cli.md` maps every CLI call to
  the MCP equivalent and says which calls still need the CLI.

**Environment.** The environment is an input like any other, collected in
Phase 1 and shown in the confirmation table; do not infer it from what the CLI
happens to be pointing at. Once known, prefix every Stripe command with it and
with the account name `env` printed (`STRIPE_ENV=live STRIPE_ACCOUNT_NAME='…'
scripts/stripe-json.sh …`, same for `clone-product.sh`; the mode alone cannot
tell two live accounts apart):
agent shells usually do not keep an `export` between tool calls, and the
wrapper refuses to run without it rather than guess. Run every Stripe command
through `scripts/stripe-json.sh`, which reads the CLI's own banner to check
the mode and refuses on mismatch. If it reports a mismatch, compare against
the environment the user chose, not against whatever the error suggests. The CLI keeps one active account and a
`stripe switch` in another terminal changes it under you, so run
`scripts/stripe-json.sh env` again right before Phase 4. On mismatch tell the
user to run `! stripe switch` (it is interactive) and re-check.

**Sandbox is not isolated.** A sandbox account is wired to the dev and
staging backends through its webhook endpoints, so every write there changes
real org records in those backends. List them with
`webhook_endpoints list` and show the enabled URLs in the confirmation table.
When any is enabled, a subscription created for an org address moves that org
to the new plan in each of those backends at once, and canceling or deleting
it afterwards does not bring the previous plan back. Only use an org address
the user has confirmed is disposable in every listed backend, and do not
create "test" subscriptions to clean up later: there is no cleanup.

Read `references/stripe-cli.md` now for the command cookbook. Read
`references/backend-contract.md` if you need to know why a field matters.

## Phase 1: collect the minimum

Six things are required. Take what the user gave, then ask for the rest in a
single `AskUserQuestion` call (one question per missing item):

0. **Environment**: `live` or `sandbox`. Ask unless the user said it; offer
   `live` first since that is what a real customer request means, but never
   assume it silently. Whatever the answer, it is what `STRIPE_ENV` gets and
   what the confirmation table shows.
1. **Customer**: email (or `cus_…` id). The customer must already exist.
2. **Org type**: integrator or regular. The new subscription replaces the
   org's plan in the backend, and an integrator org is often on
   `Integrator Free`, which has no Stripe subscription, so Stripe cannot tell
   you. Take it from the user's wording ("integrator", "Integrator Free",
   "managed orgs") or from an existing subscription on a product with
   `integratorLimits.maxManagedOrgs > 0`; otherwise ask. Never guess regular.
3. **Product**: a catalog name (`Free`, `Starter`, `Professional`, `Custom`,
   `Integrator Starter`, `Integrator Free`) or a `prod_…` id. `Custom` and
   `Integrator Starter` are templates and go through Phase 2b. The product
   keeps the org's type unless the user explicitly asks to change it: for an
   integrator org, "upgrade", "custom plan" or no product at all means a copy
   of `Integrator Starter`, never plain `Custom`; for a regular org, `Custom`.
   A product of the other type is a type change: show it as such in the
   Phase 3 table and only proceed if the user named that product.
4. **Billing interval**: `yearly` or `monthly` (or a `price_…` id). If the user
   said nothing and the product's default price is yearly, propose yearly.
5. **Organization address**: `0x` + 40 hex chars. It becomes the subscription
   metadata key `address`, the only thing linking the subscription to the org
   in the backend. A missing or malformed value makes every webhook for that
   subscription fail forever, so validate the shape before doing anything
   else.

## Phase 2: resolve and validate (read-only)

- **Customer**: `customers list --email <email>`. Exactly one match, or stop
  and report what you found. Note name, currency, `invoice_settings.default_payment_method`
  and `payment_methods list --customer` (together they decide the collection
  default: a card that is attached but not the customer's default is only
  charged if you pass it as the subscription's `default_payment_method`).
- **Product and price**: search by name, then filter to the exact name because
  search is a substring match and `Custom - someone@…` copies would otherwise
  win. Then `prices list --product <id> --active` and pick the recurring price
  for the chosen interval. Show amount, currency, nickname.
- **One org, one subscription**: list every non-canceled subscription
  (active, trialing, past_due, unpaid, paused, incomplete), every page, and compare `metadata.address` case-insensitively
  (see the cookbook; use the list, not search, because search lags by up to a
  minute). If one exists,
  stop and name it: the user should update or cancel that one instead.
- **Org type matches the product**: read the resolved product's
  `integratorLimits`. An integrator org given a product without
  `integratorLimits.maxManagedOrgs > 0` (plain `Custom`, `Starter`,
  `Professional`) stops being an integrator, and a regular org given an
  integrator product becomes one. If that does not match the Phase 1 type
  and the user did not name the product explicitly, switch to the matching
  template before going further.
- **Customer's other subscriptions**: warn, do not block.
- **Currency**: the price currency must match the customer's currency when the
  customer already has one, or Stripe rejects the create.

## Phase 2b: template flow (Custom / Integrator Starter)

The backend reads plan limits from the product's metadata, so a customized
plan needs its own product. Read `references/product-templates.md` and:

1. Resolve the template by exact name and show its `organization`, `features`,
   `votingTypes` (and `integratorLimits`) blocks as pretty JSON.
2. Ask what to change: per-block overrides (for example `2FAemail: 10000`), the
   yearly/monthly amounts (custom plans are negotiated; default is the template
   amount), a short client label for names, and the org email (defaults to the
   customer email). Show a before/after of every block you change.
3. Run `scripts/clone-product.sh … --dry-run` and include its output in the
   Phase 3 table so the user sees the exact product and prices to be created.
4. After confirmation, run it without `--dry-run`. It writes the copy with
   `visibility=private`, `orgAddress`, `orgEmail`, `copiedFrom`, `copiedAt`,
   creates one price per interval the template has (yearly and/or monthly),
   and never sets a default price.
5. Read the product back and check: all metadata blocks parse as JSON, visibility
   is private, one active recurring price per template interval, and for integrator copies
   `integratorLimits.maxManagedOrgs > 0`. Then continue with its price.

## Phase 3: confirmation table

Render one table with everything chosen, then everything optional that is
still at its default, and ask a single `AskUserQuestion`: "Create it as shown?"
with options `Yes`, `Change something`. On `Change something`, collect the
change, re-render, ask again. Never proceed on silence or an implicit yes.

```
| Setting            | Value                                             |
|--------------------|---------------------------------------------------|
| Environment        | live · Account Name                               |
| Backends notified  | every enabled webhook endpoint URL                |
| Customer           | cus_xxx · Client Name · client@example.org        |
| Product            | prod_xxx · Professional                           |
| Org plan change    | Integrator Free → Professional (not integrator)   |
| Price              | price_xxx · yearly · 1 890,00 EUR                 |
| metadata.address   | 0x0000000000000000000000000000000000000000        |
| --- not defined (defaults) ---                                          |
| Collection         | send_invoice, due in 30 days  (no card on file)   |
| Discount           | none                                              |
| Trial              | none                                              |
| Start / anchor     | now                                               |
| Scheduled cancel   | none                                              |
| Description / meta | none                                              |
```

What each optional row means and its alternatives:

- **Collection**. Default `send_invoice` with `days_until_due=30` when the
  customer has no default payment method, else `charge_automatically`. If
  the customer has saved payment methods but none is the default, ask which
  one to charge and pass it as `default_payment_method`; without it Stripe
  has nothing to charge and the subscription is left `incomplete`.
  Alternatives: the other one, or a **checkout link** (a hosted Checkout
  Session the customer pays; Stripe then creates the subscription itself, so
  Phase 5 verifies the session instead). `charge_automatically` with no card
  needs `payment_behavior=default_incomplete` and the user must know the
  subscription expires in 23 hours unless the invoice gets paid.
- **Discount**. Only when the user asks for one. Before creating anything,
  look for an existing fit: `coupons list` (valid, same percent/amount and
  duration, redemptions left) and, if the user named a code,
  `promotion_codes list --active`. Show matches in a small table and let the
  user pick one or "create new". Otherwise create a single-use coupon
  (`max_redemptions=1`, name tied to the client and reason). Either way it is
  passed on the create call through `discounts[0][coupon]` so the first invoice
  is already discounted; there is nothing to patch afterwards and nothing to
  delete later. If the user does not want a discount, skip the lookup.
- **Trial**: `trial_period_days` or `trial_end`. If the chosen price carries
  `freeTrialDays` metadata (copied onto a cloned price from its template),
  that metadata alone does not create a Stripe trial — it is read by other
  parts of the Vocdoni stack, not by `subscriptions create`. Ask the user
  whether this subscription should also get that many days as a real Stripe
  trial, or the customer is billed immediately.
- **Start / anchor**: `backdate_start_date`, `billing_cycle_anchor`.
- **Scheduled cancel**: `cancel_at` or `cancel_at_period_end`.
- **Description / extra metadata**: `description`, extra `metadata[...]`.
  Never add customer metadata; the backend writes the customer's `address`
  itself and errors if it is already there.

## Phase 4: execute

1. `scripts/stripe-json.sh env` again. Stop on mismatch.
2. Template flow: `clone-product.sh` for real, then the read-back checks.
3. Discount: create the coupon now if a new one was chosen; capture its id.
4. `subscriptions create` with every chosen flag in one call (or
   `checkout sessions create` for the link mode). See the cookbook for the
   exact flags.
5. `send_invoice`: finalize the first invoice right away
   (`invoices finalize_invoice`), but only if the create response's
   `latest_invoice` exists and is still `draft`. A trial's zero invoice is
   already `paid`, and a future `billing_cycle_anchor` may leave no invoice
   at all; finalizing those fails after the subscription already exists, so
   skip this step instead. A zero-total invoice becomes `paid` on the
   spot; a real one gets a `hosted_invoice_url`. Finalizing by hand does not
   email it: run `invoices send_invoice` too if the customer should get
   Stripe's email. `finalize_invoice` and `send_invoice` each return a
   different token in that URL for the same invoice; hand the customer the
   one from whichever call you made last (or from the Phase 5 read-back),
   not the finalize-time one if you also sent it.

Destructive CLI commands (`delete`, `delete_*`, `cancel`, `void_invoice`,
`mark_uncollectible`, `detach`) can prompt interactively and hang inside an
agent; the wrapper refuses them without `--confirm`, so always pass it.

## Phase 5: verify and report

Re-read from Stripe; never report from the create response.
`subscriptions retrieve <id> -d expand[0]=discounts -d expand[1]=latest_invoice`
(plus `coupons retrieve` for the discount row, since the discount only
carries the coupon id, and `products retrieve` and `prices list` for a cloned
product) and print:

```
| Item              | Value                                                   |
|-------------------|---------------------------------------------------------|
| Subscription      | sub_xxx · active                                        |
| Customer          | cus_xxx · Client Name · client@example.org              |
| Product           | prod_xxx · Professional  (or: copy of Custom, private)  |
| Price             | price_xxx · yearly · 1 890,00 EUR                       |
| metadata.address  | 0x0000000000000000000000000000000000000000              |
| Discount          | coupon_xxx · 100% · forever · redeemed 1/1  (or none)   |
| First invoice     | in_xxx · paid · total 0,00 EUR · hosted URL             |
| Collection        | send_invoice · due in 30 days                           |
| Current period    | until 2027-01-01                                        |
| Environment       | live                                                    |
```

Follow with two or three sentences: what happens next (invoice emailed if you
sent it, link to hand over, backend picks a cloned product up on the
`product.updated` webhook fired by its activation, or at the next restart), and anything left at a default the user should know about
(for example, a free subscription still emits zero-value invoices in revenue
reports).

## When to stop instead of continuing

- The environment check fails or flips between phases.
- The customer is missing or ambiguous, the product name matches several
  active products, or the address is malformed.
- Another active subscription already carries that address.
- The environment is sandbox, it has enabled webhook endpoints, and the user
  has not confirmed the org address is disposable in those backends.
- The org is an integrator and the chosen product is not, and the user has
  not confirmed the downgrade.
- The user asked for something this skill does not do: changing an existing
  subscription, refunds, cancellations. Say so and offer the CLI command.

Related: [[stripe-best-practices]] for general Stripe API choices,
[[stripe-docs]] to look up a parameter this skill does not cover.
