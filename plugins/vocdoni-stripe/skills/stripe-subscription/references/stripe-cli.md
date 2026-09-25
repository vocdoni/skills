# Stripe CLI cookbook

All commands below go through the wrapper, which refuses to run without
`STRIPE_ENV`. Agent shells usually drop variables between tool calls, so set
both at the start of every invocation, not once per session:

```bash
export STRIPE_ENV=live STRIPE_ACCOUNT_NAME='<account name>' sj=<skill dir>/scripts/stripe-json.sh   # or STRIPE_ENV=sandbox
```

`STRIPE_ACCOUNT_NAME` is the name `stripe-json.sh env` printed and the user
confirmed; with it set the wrapper also refuses a different account in the
same mode (a second live account, another sandbox).

The wrapper adds `--live` for live, checks the banner (before the command
too, for anything that is not a `list` / `retrieve` / `search`), strips it,
turns `{"error": …}` bodies into a non-zero exit, and refuses `delete` /
`delete_*` / `cancel` / `void_invoice` / `mark_uncollectible` / `detach`
without `--confirm`. Everything it prints on stdout is JSON, so
pipe straight into `jq`.

## Quirks worth knowing

- **One active account.** `stripe config --list` shows it. `stripe switch` and
  `stripe login` change it for every terminal. `--live` on a sandbox account
  errors out; a sandbox-style command on the live account silently hits live
  _test_ mode. The banner `▸ Running in <name> · live|sandbox` is the only
  reliable signal, which is why the wrapper reads it.
- **Banner placement.** It goes to stderr for most commands and to stdout for
  some. Never parse raw CLI output with `jq` directly.
- **API errors exit 0.** The CLI prints the error JSON and returns success.
- **Search is a substring match and lags.** `products search --query "name:'Custom'"`
  returns every `Custom - …` copy; filter with `jq 'select(.name == "Custom")'`.
  Search indexes update within about a minute, so use `list` for anything
  that must reflect what you just created.
- **Boolean flags take no value.** `prices list --active`, not `--active true`.
  Inside `-d` parameters they do: `-d active=false`.
- **Interactive prompts.** `subscriptions cancel`, `customers delete`,
  `coupons delete` ask "are you sure" on a TTY and hang without one. Pass
  `--confirm`.
- **Nested params** use bracket syntax: `-d "items[0][price]=price_xxx"`,
  `-d "metadata[address]=0x…"`, `-d "expand[0]=discounts"`.

## Lookups

```bash
# backends that will act on every write (sandbox usually reaches dev and staging)
$sj webhook_endpoints list | jq '[.data[] | select(.status == "enabled") | .url]'

# customer by email (expect exactly one)
$sj customers list --email client@example.org | jq '.data | length, (.[0] | {id, name, email, currency, default_pm: .invoice_settings.default_payment_method})'

# saved payment methods (decides the collection default)
$sj payment_methods list --customer cus_xxx | jq '[.data[] | {id, type}]'

# product by exact name (active only)
$sj products search --limit 100 --query "active:'true' AND name:'Professional'" \
  | jq '[.data[] | select(.name == "Professional")]'

# recurring prices of a product
$sj prices list --product prod_xxx --active --limit 100 \
  | jq '[.data[] | select(.recurring != null) | {id, nickname, currency, unit_amount, interval: .recurring.interval, trial: .metadata.freeTrialDays}]'

# one org, one subscription: list-based, case-insensitive (search lags),
# paginated (100 per page is a hard cap, and a missed page is a missed duplicate).
# No --status: the default already returns every non-canceled subscription,
# including unpaid and paused ones that still hold the org.
# Pages are collected first and the filter runs only if every page succeeded:
# a failed page must stop the check, not shrink it to an empty "no duplicate".
addr=0x0000000000000000000000000000000000000000
pages="$(
  after=()
  while :; do
    page="$($sj subscriptions list --limit 100 "${after[@]}")" || exit 1
    printf '%s\n' "$page"
    [[ "$(jq -r .has_more <<<"$page")" == true ]] || break
    after=(--starting-after "$(jq -r '.data[-1].id' <<<"$page")")
  done
)" && jq -s --arg a "$addr" '[.[].data[] | select(.status != "incomplete_expired") | select((.metadata.address // "" | ascii_downcase) == ($a | ascii_downcase)) | {id, status, customer}]' <<<"$pages" \
  || echo "duplicate check FAILED; do not continue" >&2

# customer's other subscriptions
$sj subscriptions list --customer cus_xxx | jq '[.data[] | {id, status, product: .items.data[0].price.product}]'
```

## Discounts

```bash
# existing coupons that could fit (valid, matching discount, redemptions left)
$sj coupons list --limit 100 | jq '[.data[] | select(.valid) | {id, name, percent_off, amount_off, currency, duration, duration_in_months, redeemed: .times_redeemed, max: .max_redemptions}]'

# a promotion code the user named. Since API 2025-09-30.clover the coupon sits
# at .promotion.coupon as a bare id; older versions embed it at .coupon.
$sj promotion_codes list --active --code SOMECODE \
  | jq '.data[] | {id, code, coupon: (.promotion.coupon // .coupon | if type == "object" then .id else . end)}'
# then `coupons retrieve <coupon>` for its percent/amount and duration

# new single-use coupon (only when nothing fits)
$sj coupons create -d percent_off=100 -d duration=forever -d max_redemptions=1 \
  -d "name=Client Name - free exception" | jq '{id, name, percent_off, duration, max_redemptions}'
# amount-based variant: -d amount_off=50000 -d currency=eur
# limited variant:      -d duration=repeating -d duration_in_months=6
```

`max_redemptions` cannot be changed after creation. If you ever need to close
a coupon that was created without it, `coupons delete <id> --confirm` blocks
new redemptions and leaves existing discounts untouched.

## Create the subscription

```bash
# send_invoice (customer has no card, or you want an invoice emailed)
$sj subscriptions create \
  -d customer=cus_xxx \
  -d "items[0][price]=price_xxx" \
  -d "metadata[address]=0x0000000000000000000000000000000000000000" \
  -d collection_method=send_invoice -d days_until_due=30 \
  -d "discounts[0][coupon]=COUPONID"          # only if a discount was chosen
  # -d "discounts[0][promotion_code]=promo_xxx"   # promotion code instead
  # -d trial_period_days=14
  # -d backdate_start_date=1760000000 -d billing_cycle_anchor=1762000000
  # -d cancel_at=1790000000
  # -d "description=…"

# charge_automatically with the customer's default payment method
$sj subscriptions create -d customer=cus_xxx -d "items[0][price]=price_xxx" \
  -d "metadata[address]=0x…" -d collection_method=charge_automatically
# a saved card that is NOT the customer's default is never picked up on its own:
#   add: -d default_payment_method=pm_xxx

# charge_automatically WITHOUT a card: created incomplete, expires in 23h unless paid
#   add: -d payment_behavior=default_incomplete
#   then hand over: latest_invoice.hosted_invoice_url

# finalize the first invoice of a send_invoice subscription, only while it is
# still a draft (a trial invoice is already paid; a future anchor may have none)
$sj invoices retrieve in_xxx | jq -r .status          # expect: draft
$sj invoices finalize_invoice in_xxx | jq '{id, status, total, amount_due, amount_paid, hosted_invoice_url}'

# a manually finalized invoice is not emailed; send it if the customer should get the email
$sj invoices send_invoice in_xxx | jq '{id, status, hosted_invoice_url}'
```

## Checkout link instead of a direct subscription

Mirrors what the app's own checkout does (tax, tax id collection, promotion
codes), but hosted so the link can be sent by hand. Stripe creates the
subscription when the customer pays; `subscription_data[metadata][address]`
is what makes the backend recognise it.

```bash
$sj checkout sessions create \
  -d mode=subscription \
  -d customer=cus_xxx \
  -d "customer_update[name]=auto" -d "customer_update[address]=auto" \
  -d "line_items[0][price]=price_xxx" -d "line_items[0][quantity]=1" \
  -d "subscription_data[metadata][address]=0x0000000000000000000000000000000000000000" \
  -d "automatic_tax[enabled]=true" -d "tax_id_collection[enabled]=true" \
  -d allow_promotion_codes=true \
  -d success_url="https://app.vocdoni.io/" -d cancel_url="https://app.vocdoni.io/" \
  | jq '{id, url, expires_at: (.expires_at | todate)}'
# discount on the session instead of promotion codes: -d "discounts[0][coupon]=…" (then drop allow_promotion_codes)
# trial: -d "subscription_data[trial_period_days]=14"
```

Verify later with `checkout sessions retrieve cs_xxx | jq '{status, payment_status, subscription}'`.

## Read back for the final table

```bash
$sj subscriptions retrieve sub_xxx -d "expand[0]=discounts" -d "expand[1]=latest_invoice" | jq '{
  id, status, customer, collection_method, days_until_due, metadata,
  price: .items.data[0].price.id, amount: .items.data[0].price.unit_amount, currency,
  period_end: (.items.data[0].current_period_end | todate),
  discount: (.discounts[0] | if . then {id, coupon: (.source.coupon // .coupon | if type == "object" then .id else . end)} else null end),
  invoice: (.latest_invoice | {id, status, total, amount_paid, hosted_invoice_url})
}'

# the Discount row: since API 2025-09-30.clover a discount no longer embeds its
# coupon (it is a bare id at .source.coupon), so read the coupon itself
$sj coupons retrieve COUPONID | jq '{id, percent_off, amount_off, currency, duration, duration_in_months, redeemed: "\(.times_redeemed)/\(.max_redemptions)"}'
```

## Undo (only if the user asks)

```bash
$sj subscriptions cancel sub_xxx --confirm          # cancels now; invoices stay
$sj invoices void_invoice in_xxx --confirm          # open invoice you do not want paid
$sj products update prod_xxx -d active=false        # archive a cloned product (backend drops the plan)
$sj coupons delete COUPONID --confirm
```

## Stripe MCP equivalents

When the Stripe MCP server is connected instead of the CLI, use its tools for
the same phases. Names vary by server version; the usual mapping is:

| Cookbook call                           | MCP tool                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `customers list --email`                | `list_customers` (email filter)                                                        |
| `products search` / `products retrieve` | `list_products` / `search_stripe_resources`                                            |
| `prices list --product`                 | `list_prices` (product filter)                                                         |
| `subscriptions list`                    | `list_subscriptions`                                                                   |
| `coupons list` / `coupons create`       | `list_coupons` / `create_coupon`                                                       |
| `subscriptions create`                  | `create_subscription` (check it accepts `metadata`, `collection_method`, `discounts`)  |
| `products create` / `prices create`     | `create_product` / `create_price`                                                      |
| `checkout sessions create`              | `create_payment_link` is the closest (no `subscription_data.metadata`); prefer the CLI |
| `invoices finalize_invoice`             | usually absent; use the CLI                                                            |

The environment guard with MCP is the `livemode` field on any object you read
back. If a call the workflow needs has no MCP tool, fall back to the CLI for
that call rather than skipping it.
