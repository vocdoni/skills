#!/usr/bin/env bash
# Clone a template plan product ("Custom", "Integrator Starter") into a
# per-customer product, carrying over the plan metadata the SaaS backend reads
# (organization / features / votingTypes / integratorLimits) with optional
# overrides, and recreating its recurring prices.
#
# Usage:
#   clone-product.sh --template <prod_id|"Custom"|"Integrator Starter"> \
#                    --org-email <email> --org-address <0x...> --label <text> \
#                    [--override-file <json>] [--yearly <cents>] [--monthly <cents>] \
#                    [--dry-run]
#
#   --override-file  JSON object keyed by metadata block, deep-merged over the
#                    template, e.g. {"features": {"2FAemail": 10000}, "organization": {"maxCensus": 80000}}
#   --yearly/--monthly  unit_amount in the smallest currency unit (cents) for the
#                    cloned price; default = template amount.
#   --dry-run        print the exact stripe invocations and the metadata that
#                    would be written; write nothing.
#
# Environment: STRIPE_ENV=live|sandbox (required), passed through to stripe-json.sh.
#
# Output (stdout): one JSON object {product, prices: {year, month}, name}.
#
# What is deliberately NOT done, and why:
#  - default_price is not set: the backend's "default plan" marker lives on the
#    default price's metadata, and a per-customer copy must never become the
#    catalog default.
#  - customer metadata is not touched: the backend writes the customer's
#    `address` itself and errors if it is already set.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sj="$here/stripe-json.sh"

# jq does the metadata merging below; stripe-json.sh checks for it too, but
# this script uses it directly before the first Stripe call.
if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found on PATH; install it first (https://jqlang.org/download/), e.g. brew install jq / sudo apt install jq" >&2
  exit 2
fi

template="" org_email="" org_address="" label="" override_file="" yearly="" monthly="" dry_run=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --template) template="$2"; shift 2 ;;
    --org-email) org_email="$2"; shift 2 ;;
    --org-address) org_address="$2"; shift 2 ;;
    --label) label="$2"; shift 2 ;;
    --override-file) override_file="$2"; shift 2 ;;
    --yearly) yearly="$2"; shift 2 ;;
    --monthly) monthly="$2"; shift 2 ;;
    --dry-run) dry_run=1; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

for v in template org_email org_address label; do
  [[ -n "${!v}" ]] || { echo "--${v//_/-} is required" >&2; exit 2; }
done
[[ "$org_address" =~ ^0x[0-9a-fA-F]{40}$ ]] || { echo "--org-address must be 0x + 40 hex chars" >&2; exit 2; }
[[ "$org_email" == *@* ]] || { echo "--org-email does not look like an email" >&2; exit 2; }
if [[ -n "$override_file" ]]; then
  jq -e 'type == "object"' "$override_file" >/dev/null || { echo "--override-file must be a JSON object" >&2; exit 2; }
fi
for amt in "$yearly" "$monthly"; do
  [[ -z "$amt" || "$amt" =~ ^[0-9]+$ ]] || { echo "--yearly/--monthly must be integer cents" >&2; exit 2; }
done

# Resolve the template. Search is a substring match, so filter to the exact
# name; a per-customer copy is named "<Template> - <email>" and must not win.
if [[ "$template" == prod_* ]]; then
  tpl="$("$sj" products retrieve "$template")"
else
  tpl="$("$sj" products search --limit 100 --query "active:'true' AND name:'$template'" \
    | jq --arg n "$template" '[.data[] | select(.name == $n)]')"
  count="$(jq 'length' <<<"$tpl")"
  if [[ "$count" -ne 1 ]]; then
    echo "expected exactly one active product named '$template', found $count" >&2
    exit 1
  fi
  tpl="$(jq '.[0]' <<<"$tpl")"
fi

tpl_id="$(jq -r '.id' <<<"$tpl")"
tpl_name="$(jq -r '.name' <<<"$tpl")"
tpl_desc="$(jq -r '.description // ""' <<<"$tpl")"

# The three marker keys are what make a product a plan for the backend. A
# template without them is not a template.
for k in organization features votingTypes; do
  jq -e --arg k "$k" '.metadata[$k] | . != null and (fromjson | type == "object")' <<<"$tpl" >/dev/null \
    || { echo "template $tpl_id has no valid JSON metadata '$k'; not a plan product" >&2; exit 1; }
done

overrides='{}'
[[ -n "$override_file" ]] && overrides="$(cat "$override_file")"

# Merge each JSON block: template * overrides, then re-serialise compactly.
merged="$(jq -c --argjson o "$overrides" '
  .metadata as $m
  | ["organization","features","votingTypes","integratorLimits"]
  | map(select($m[.] != null and $m[.] != ""))
  | map({key: ., value: (($m[.] | fromjson) * ($o[.] // {}) | tojson)})
  | from_entries' <<<"$tpl")"

# Refuse override keys that do not exist on the template (typo guard).
unknown="$(jq -r --argjson m "$merged" 'keys - ($m | keys) | .[]' <<<"$overrides")"
[[ -z "$unknown" ]] || { echo "override block(s) not present on template: $unknown" >&2; exit 2; }

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
new_name="$tpl_name - $org_email"
new_desc="${tpl_desc:+$tpl_desc }Custom copy of $tpl_id for $label ($org_email)."

# Created INACTIVE on purpose. The backend only syncs active products, and an
# integrator product that is synced before its prices exist has zero prices,
# which is exactly what the backend's "free integrator plan" selector matches.
# Activating only after the prices exist closes that window.
product_args=(products create
  -d "name=$new_name"
  -d "description=$new_desc"
  -d "active=false"
  -d "metadata[visibility]=private"
  -d "metadata[orgAddress]=$org_address"
  -d "metadata[orgEmail]=$org_email"
  -d "metadata[copiedFrom]=$tpl_id"
  -d "metadata[copiedAt]=$now")
# NUL-delimited so the JSON values go through verbatim (@tsv would double any
# backslash and corrupt an escaped quote inside a block).
while IFS= read -r -d '' kv; do
  product_args+=(-d "$kv")
done < <(jq -j 'to_entries[] | "metadata[\(.key)]=\(.value)\u0000"' <<<"$merged")

# Recurring prices of the template. The backend keeps the LAST active price it
# lists per interval, so a template with several is ambiguous: refuse rather
# than copy a price the backend does not actually use for the template.
prices="$("$sj" prices list --product "$tpl_id" --active --limit 100 \
  | jq -c '[.data[] | select(.recurring != null and (.recurring.interval == "year" or .recurring.interval == "month"))]')"
[[ "$(jq 'length' <<<"$prices")" -gt 0 ]] || { echo "template $tpl_id has no active recurring prices" >&2; exit 1; }
dup="$(jq -r 'group_by(.recurring.interval) | map(select(length > 1) | "\(.[0].recurring.interval): \(map(.id) | join(", "))") | .[]' <<<"$prices")"
[[ -z "$dup" ]] || { echo "template $tpl_id has more than one active price per interval ($dup); archive the extras first" >&2; exit 1; }
for pair in "year:$yearly" "month:$monthly"; do
  [[ -z "${pair#*:}" ]] || jq -e --arg i "${pair%%:*}" 'any(.recurring.interval == $i)' <<<"$prices" >/dev/null \
    || { echo "template $tpl_id has no active ${pair%%:*} price to override" >&2; exit 2; }
done

# One row per price, \x1f-separated: unlike tab it is not IFS whitespace, so
# empty fields (no trial, no tax behavior) do not shift the ones after them.
price_rows=() paid=0
while IFS=$'\x1f' read -r interval currency amount trial tax; do
  case "$interval" in
    year)  [[ -n "$yearly" ]] && amount="$yearly" ;;
    month) [[ -n "$monthly" ]] && amount="$monthly" ;;
  esac
  [[ "$amount" =~ ^[0-9]+$ ]] \
    || { echo "template $interval price has no unit_amount (tiered or decimal pricing); pass --${interval}ly explicitly" >&2; exit 1; }
  (( 10#$amount > 0 )) && paid=1
  price_rows+=("$interval"$'\x1f'"$currency"$'\x1f'"$amount"$'\x1f'"$trial"$'\x1f'"$tax")
done < <(jq -r '.[] | [.recurring.interval, .currency, (.unit_amount // ""), (.metadata.freeTrialDays // ""), (.tax_behavior // "")]
                 | map(tostring) | join("\u001f")' <<<"$prices")

# The backend picks THE free integrator plan with an unordered FindOne on
# maxManagedOrgs > 0 and zero prices; an all-zero integrator copy would make
# that choice random for every integrator signup.
if [[ $paid -eq 0 ]] && jq -e '(.integratorLimits // "{}" | fromjson | .maxManagedOrgs // 0) > 0' <<<"$merged" >/dev/null; then
  echo "refusing an integrator copy whose prices are all zero: it would compete with the free integrator plan (see references/backend-contract.md)" >&2
  exit 2
fi

# Sets `args` to the prices create invocation for one row.
price_args() {
  local product="$1" interval currency amount trial tax
  IFS=$'\x1f' read -r interval currency amount trial tax <<<"$2"
  args=(prices create
    -d "product=$product"
    -d "currency=$currency"
    -d "unit_amount=$amount"
    -d "recurring[interval]=$interval"
    -d "nickname=$tpl_name ${interval}ly ($label)")
  [[ -n "$trial" ]] && args+=(-d "metadata[freeTrialDays]=$trial")
  [[ -n "$tax" && "$tax" != unspecified ]] && args+=(-d "tax_behavior=$tax")
  return 0
}

if [[ $dry_run -eq 1 ]]; then
  echo "# template: $tpl_id ($tpl_name)"
  echo "# metadata blocks after overrides:"
  jq '.' <<<"$merged" | sed 's/^/#   /'
  echo "stripe-json.sh $(printf '%q ' "${product_args[@]}")"
  for row in "${price_rows[@]}"; do
    price_args "<new product id>" "$row"
    echo "stripe-json.sh $(printf '%q ' "${args[@]}")"
  done
  echo "stripe-json.sh products update <new product id> -d active=true"
  exit 0
fi

product="$("$sj" "${product_args[@]}")"
product_id="$(jq -r '.id' <<<"$product")"

result="$(jq -n --arg p "$product_id" --arg n "$new_name" '{product: $p, name: $n, prices: {}}')"
for row in "${price_rows[@]}"; do
  price_args "$product_id" "$row"
  price="$("$sj" "${args[@]}")"
  interval="$(jq -r '.recurring.interval' <<<"$price")"
  result="$(jq --arg i "$interval" --arg id "$(jq -r .id <<<"$price")" '.prices[$i] = $id' <<<"$result")"
done

# Activate now that the prices exist. This is also the product.updated event
# the backend syncs on (it ignores price.* events), so the plan it caches
# already carries both prices.
"$sj" products update "$product_id" -d active=true >/dev/null

jq -c '.' <<<"$result"
