# What the SaaS backend reads from Stripe

Verified against `saas-backend` (`stripe/service.go`, `stripe/webhook.go`,
`stripe/client.go`, `db/plans.go`, `subscriptions/subscriptions.go`) in
September 2026. Re-check the line references if the backend has moved on.

## Products are plans

Stripe is the single source of truth for plans; Mongo `plans` is a cache.

| Product metadata key | Required     | Parsed as   | Effect                                                                                                                                           |
| -------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `organization`       | yes (marker) | JSON object | plan limits: `teamMembers`, `subOrgs`, `maxProcesses`, `maxCensus`, `maxVotes`, `maxDaysDuration`, `customURL`, `drafts`, `customPlan`           |
| `votingTypes`        | yes (marker) | JSON object | `single`, `multiple`, `approval`, `cumulative`, `ranked`, `weighted`                                                                             |
| `features`           | yes (marker) | JSON object | `anonymous`, `overwrite`, `liveResults`, `2FAsms`, `2FAemail`, `personalization`, `emailReminder`, `whiteLabel`, `liveStreaming`, `phoneSupport` |
| `integratorLimits`   | no           | JSON object | `maxManagedOrgs`; the plan is an integrator plan only when it is `> 0`                                                                           |
| `visibility`         | no           | string      | exactly `private` hides the plan from `GET /plans`. Nothing else: a private plan is still fetchable by id and usable at checkout                 |

- A product missing any of the three marker keys is silently not a plan
  (`service.go` `planProductMarkerKeys`, `isPlanProduct`).
- A marker present but not valid JSON makes the product skip with a warning.
- Only **active** products are listed (`client.go` `ListProducts`).
- `orgAddress`, `orgEmail`, `copiedFrom`, `copiedAt` (and the older
  `restoredFrom` / `restoredAt` from a one-off migration) are **not read**.
  They exist so a human can tell which customer a copy belongs to and where it
  came from. Keep writing them.

## Prices

`GetProductPrices` lists **active** prices of the product. In
`processProductToPlan`:

- recurring interval `year` becomes the yearly price and amount, `month` the
  monthly ones; other intervals and one-time prices are ignored;
- if several prices share an interval the last one listed wins, so keep one
  active price per interval on a plan product;
- yearly price metadata `freeTrialDays` (integer) is honoured;
- the catalog **default plan** marker is `Default=true` on the metadata of the
  product's `default_price`. Never set a default price on a per-customer copy.

Lookup keys are not used: the "lookup key" in the checkout endpoint is the
product id.

## Subscriptions

The only subscription metadata key read is **`address`**
(`webhook.go` `parseSubscriptionFromEvent`). It is parsed with
`common.HexToAddress`, so matching is case-insensitive and the `0x` prefix is
optional; garbage silently becomes the zero address.

On `customer.subscription.*` events:

- missing/zero address: error `subscription missing address metadata`;
- address with no organization: error `organization … not found`;
- product not in the plan cache: error `plan with Stripe ID … not found`.

Every error returns HTTP 500 to Stripe, the event is not marked processed, and
Stripe retries it for days. So a wrong address is not "no-op", it is a
permanently failing webhook.

On success the org gets `PlanID`, `StripeSubscriptionID`, `BillingPeriod`,
`StartDate`, `RenewalDate`, `Active` (only when status is `active`) and
`Email` (the Stripe customer email).

The previous plan is overwritten, not stacked or remembered. That includes a
plan the org holds with no Stripe subscription behind it (the free integrator
plan assigned at `integrator: true` creation), and a later cancel or delete of
the new subscription does not restore it. Every endpoint subscribed to the
account applies this, so a sandbox subscription rewrites the org in dev and
staging alike.

## Customers

The subscription metadata `address` is the only link between a subscription
and an org. The customer's metadata `address` is never read to route a
subscription; one Stripe customer may own subscriptions for several orgs.

After saving the org, the handler stamps the **customer** metadata `address`
with the org address, but only when it is empty. What happens when it is
already set depends on the backend version:

- `main` (since dd58581, #704; not in a release tag yet): it logs
  "customer metadata address mismatch" if the value differs and carries on.
  The webhook succeeds and the existing value is left untouched.
- v3.1.2 and older: it returns an error when the customer has any `address`,
  even the same one. The org was already saved, so the data is correct, but
  Stripe gets a 500 and retries the event. Noisy in webhook logs, harmless
  for data; mention it if the user wonders about failing webhooks.

Either way, do not set customer metadata `address` by hand, before or after
creating the subscription, and do not treat an existing value pointing to
another org as a sign of the wrong customer.

The org's subscription `Email` is always overwritten with the Stripe customer
email, so a customer email that differs from the org manager's replaces it.

## How a new product reaches the backend

- On startup the backend syncs every active plan product (`InitializeStripeService`);
  a failure is logged, not fatal.
- At runtime it reacts to `product.created`, `product.updated`,
  `product.deleted` webhooks (`handleProductUpsert`, `handleProductDelete`).
  It re-fetches the product to expand `default_price`. A product that goes
  inactive or loses a marker is removed from the cache.
- `price.*` events are **not** handled. Create prices before the last product
  update, or touch the product afterwards (`clone-product.sh` does this).

So a product created by hand shows up immediately only if the live webhook
endpoint subscribes to `product.*`; otherwise at the next backend restart.

## Integrator plans

`Subscriptions.IsIntegrator` is true when the org has its own
`IntegratorLimits.MaxManagedOrgs > 0`, or when its subscription is active and
the plan's `IntegratorLimits.MaxManagedOrgs > 0`. Name is irrelevant.

**The free integrator plan is found structurally**, nothing else:
`db/plans.go` `FreeIntegratorPlan` does a `FindOne` on
`integratorLimits.maxManagedOrgs > 0 AND monthlyPrice == 0 AND yearlyPrice == 0`.
No env var, config key or product id is involved at runtime (the
`STRIPE_FREE_INTEGRATOR_PRODUCT_ID` variable and the hardcoded id in
migration 0014 only rewrite old integer plan ids once, at migration time).
`Integrator Starter` and `Custom` are not referenced anywhere in code either;
every plan is generic.

Consequences:

- An org created with `integrator: true` (`POST /organizations`) fails with
  `404` code `40023` "subscription plan not found: free integrator plan not
  available" when no such plan exists, and nothing is persisted. Creating an
  active product with the three markers, `integratorLimits.maxManagedOrgs > 0`
  and either no recurring prices or zero-amount ones fixes it with no code
  change; `visibility=private` keeps it out of the catalog.
- `FindOne` has no ordering, so two matching plans make the choice random.
  Never put `integratorLimits` on the default `Free` plan, and never let an
  integrator product be active while it still has no prices (a paid
  `Integrator Starter` copy with zero prices matches the selector).
  `clone-product.sh` creates copies inactive and activates them after their
  prices exist for this reason.
- `DefaultPlan()` (the `Default=true` default-price marker on the `Free`
  product) is checked before the integrator branch for every org creation,
  so a broken default plan fails all signups with `400` code `40022`.
