# Per-customer plan products (Custom / Integrator Starter)

## Why a product per customization

The backend reads every plan limit from the product's metadata (see
`backend-contract.md`). Two customers with different limits therefore need two
products. The catalog keeps one **template** per family:

| Template name        | Family                                            | Distinguishing metadata                   |
| -------------------- | ------------------------------------------------- | ----------------------------------------- |
| `Custom`             | high-limit plan negotiated per client             | `customPlan: true` inside `organization`  |
| `Integrator Starter` | integrators managing orgs for their own customers | `integratorLimits: {"maxManagedOrgs": N}` |

A customer copy is a new product named `<Template> - <org email>`, private,
carrying the template's blocks with the agreed changes, plus these human-only
keys:

| Key          | Value                   | Purpose                                                    |
| ------------ | ----------------------- | ---------------------------------------------------------- |
| `visibility` | `private`               | keep it out of the public catalog (backend reads this one) |
| `orgAddress` | the org's `0x…` address | find the copy from the org                                 |
| `orgEmail`   | the org/customer email  | find the copy from the customer                            |
| `copiedFrom` | template `prod_…` id    | trace where the limits came from                           |
| `copiedAt`   | ISO-8601 UTC timestamp  | when it was cloned                                         |

Older copies may carry `restoredFrom` / `restoredAt` instead of
`copiedFrom` / `copiedAt`; those came from a one-off migration. Write the
`copied*` pair for new copies and leave old ones alone.

## Resolving the template

Search is a substring match, so `name:'Custom'` also returns every
`Custom - client@example.org`. Always filter to the exact name and require
exactly one active hit:

```bash
$sj products search --limit 100 --query "active:'true' AND name:'Custom'" \
  | jq '[.data[] | select(.name == "Custom")] | if length == 1 then .[0] else error("expected one template, got \(length)") end'
```

Show the user the template's blocks pretty-printed before asking for changes:

```bash
jq '.metadata | {organization: (.organization | fromjson), features: (.features | fromjson), votingTypes: (.votingTypes | fromjson), integratorLimits: ((.integratorLimits // "null") | fromjson)}'
```

## What to ask the user

- **Overrides** per block, as key/value changes (e.g. "2FAemail to 10000",
  "maxCensus 80000", "whiteLabel true"). Keys must exist on the template; the
  script refuses unknown block names, and you should refuse unknown keys
  inside a block too, since the backend would silently ignore them.
- **Prices**: yearly and monthly amounts in cents. Default is the template
  amount; custom plans are negotiated, so ask rather than assume.
- **Label**: short client name used in price nicknames
  (`Custom yearly (Client)`), so the price list stays readable.
- **Org email**: defaults to the customer email; it becomes part of the
  product name.

Write the overrides to a JSON file keyed by block:

```json
{ "features": { "2FAemail": 10000 }, "organization": { "maxCensus": 80000 } }
```

## Clone

```bash
scripts/clone-product.sh \
  --template "Custom" \
  --org-email client@example.org \
  --org-address 0x0000000000000000000000000000000000000000 \
  --label "Client" \
  --override-file overrides.json \
  --yearly 100000 --monthly 10000 \
  --dry-run          # first: paste the output into the confirmation table
```

Without `--dry-run` it prints `{"product": "prod_…", "name": "…", "prices": {"year": "price_…", "month": "price_…"}}`.

What the script does, in order, and why:

1. Reads the template and checks the three marker blocks parse as JSON.
2. Deep-merges the overrides into each block and re-serialises compactly.
3. `products create`, **inactive**, with name, description
   (`<template description> Custom copy of <template id> for <label> (<email>).`),
   the merged blocks and the keys above. No `default_price`: the catalog
   default marker lives on a default price's metadata and a copy must never
   become the default plan. Inactive because the backend syncs active
   products on `product.created`, and an integrator product synced before
   its prices exist has zero prices, which is exactly what the backend's
   free-integrator selector matches. An integrator signing up in that window
   would land on the client's plan.
4. One `prices create` per template interval (year, month), currency,
   amount and `tax_behavior` from the template unless overridden, nickname
   `<Template> yearly|monthly (<label>)`, and `freeTrialDays` copied if the
   template's price had it. It refuses a template with more than one active
   price per interval (the backend keeps the last one listed, so which to copy
   is ambiguous), a price with no `unit_amount` unless you pass the amount,
   and an integrator copy whose prices are all zero (it would compete with
   the free integrator plan).
5. `products update … active=true`: the product becomes visible to the
   backend only now, with both prices, through the `product.updated` webhook
   it listens to (`price.*` events are ignored).

## Verify the copy before using it

```bash
$sj products retrieve prod_xxx | jq '{
  name, active, visibility: .metadata.visibility, copiedFrom: .metadata.copiedFrom, copiedAt: .metadata.copiedAt,
  orgAddress: .metadata.orgAddress, default_price,
  blocks_ok: ([.metadata.organization, .metadata.features, .metadata.votingTypes] | map(fromjson | type == "object") | all),
  managedOrgs: ((.metadata.integratorLimits // "{}") | fromjson | .maxManagedOrgs)
}'
$sj prices list --product prod_xxx --active | jq '[.data[] | {id, nickname, unit_amount, currency, interval: .recurring.interval}]'
```

Expect: `active: true`, `visibility: "private"`, `default_price: null`,
`blocks_ok: true`, exactly one price per interval, and for an integrator copy
`managedOrgs > 0`.

## Undo

Archive rather than delete, so invoices that reference the prices stay valid:

```bash
$sj products update prod_xxx -d active=false
```

The backend drops an inactive product from its plan cache on the next
`product.updated` webhook or restart.
