---
name: stripe-subscription
description: Create a Stripe subscription for an existing Vocdoni SaaS customer, including per-customer "Custom" and "Integrator Starter" plans cloned from template products, with the org-address metadata the backend needs, an optional discount, and a chosen payment-collection mode. Use this whenever the user wants to give an organization a plan, assign or create a subscription, make a subscription free or discounted, set up a custom or integrator plan for a client, or asks anything about creating subscriptions, coupons, or plan products in Stripe for Vocdoni, even if they only mention a customer email, a product name, or a 0x organization address.
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
  `scripts/stripe-json.sh env`. If it fails it prints what is missing and how
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
happens to be pointing at. Once known, `export STRIPE_ENV=live|sandbox` for
the whole session and run every Stripe command through
`scripts/stripe-json.sh`, which reads the CLI's own banner to check the mode
and refuses on mismatch. The CLI keeps one active account and a
`stripe switch` in another terminal changes it under you, so run
`scripts/stripe-json.sh env` again right before Phase 4. On mismatch tell the
user to run `! stripe switch` (it is interactive) and re-check.

Read `references/stripe-cli.md` now for the command cookbook. Read
`references/backend-contract.md` if you need to know why a field matters.

## Phase 1: collect the minimum

Five things are required. Take what the user gave, then ask for the rest in a
single `AskUserQuestion` call (one question per missing item):

0. **Environment**: `live` or `sandbox`. Ask unless the user said it; offer
   `live` first since that is what a real customer request means, but never
   assume it silently. Whatever the answer, it is what `STRIPE_ENV` gets and
   what the confirmation table shows.
1. **Customer**: email (or `cus_…` id). The customer must already exist.
2. **Product**: a catalog name (`Free`, `Starter`, `Professional`, `Custom`,
   `Integrator Starter`, `Integrator Free`) or a `prod_…` id. `Custom` and
   `Integrator Starter` are templates and go through Phase 2b.
3. **Billing interval**: `yearly` or `monthly` (or a `price_…` id). If the user
   said nothing and the product's default price is yearly, propose yearly.
4. **Organization address**: `0x` + 40 hex chars. It becomes the subscription
   metadata key `address`, the only thing linking the subscription to the org
   in the backend. A missing or malformed value makes every webhook for that
   subscription fail forever, so validate the shape before doing anything
   else.

## Phase 2: resolve and validate (read-only)

- **Customer**: `customers list --email <email>`. Exactly one match, or stop
  and report what you found. Note name, currency, `invoice_settings.default_payment_method`
  and `payment_methods list --customer` (this decides the collection default).
- **Product and price**: search by name, then filter to the exact name because
  search is a substring match and `Custom - someone@…` copies would otherwise
  win. Then `prices list --product <id> --active` and pick the recurring price
  for the chosen interval. Show amount, currency, nickname.
- **One org, one subscription**: list active/trialing/past_due subscriptions
  and compare `metadata.address` case-insensitively (see the cookbook; use the
  list, not search, because search lags by up to a minute). If one exists,
  stop and name it: the user should update or cancel that one instead.
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
   creates one yearly and one monthly price, and never sets a default price.
5. Read the product back and check: all metadata blocks parse as JSON, visibility
   is private, two active recurring prices, and for integrator copies
   `integratorLimits.maxManagedOrgs > 0`. Then continue with its price.

## Phase 3: confirmation table

Render one table with everything chosen, then everything optional that is
still at its default, and ask a single `AskUserQuestion`: "Create it as shown?"
with options `Yes`, `Change something`. On `Change something`, collect the
change, re-render, ask again. Never proceed on silence or an implicit yes.

```
| Setting            | Value                                             |
|--------------------|---------------------------------------------------|
| Environment        | live                                              |
| Customer           | cus_xxx · Client Name · client@example.org        |
| Product            | prod_xxx · Professional                           |
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
  customer has no default payment method, else `charge_automatically`.
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
- **Trial**: `trial_period_days` or `trial_end`.
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
   (`invoices finalize_invoice`). A zero-total invoice becomes `paid` on the
   spot; a real one gets its `hosted_invoice_url`, which is what you hand to
   the customer.

Destructive CLI commands (`delete`, `cancel`, `void_invoice`) prompt
interactively and hang inside an agent; the wrapper refuses them without
`--confirm`, so always pass it.

## Phase 5: verify and report

Re-read from Stripe; never report from the create response.
`subscriptions retrieve <id> -d expand[0]=discounts -d expand[1]=latest_invoice`
(plus `products retrieve` and `prices list` for a cloned product) and print:

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

Follow with two or three sentences: what happens next (invoice emailed, link
to send, backend picks the product up on its `product.created` webhook or at
the next restart), and anything left at a default the user should know about
(for example, a free subscription still emits zero-value invoices in revenue
reports).

## When to stop instead of continuing

- The environment check fails or flips between phases.
- The customer is missing or ambiguous, the product name matches several
  active products, or the address is malformed.
- Another active subscription already carries that address.
- The user asked for something this skill does not do: changing an existing
  subscription, refunds, cancellations. Say so and offer the CLI command.
