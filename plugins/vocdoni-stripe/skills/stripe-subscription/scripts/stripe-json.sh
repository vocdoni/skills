#!/usr/bin/env bash
# Thin wrapper around the Stripe CLI that (1) checks the CLI is installed and
# logged in, (2) enforces the environment you asked for (live vs sandbox) by
# reading the banner the CLI prints, and (3) strips that banner so the output
# is clean JSON you can pipe into jq.
#
# Usage:
#   stripe-json.sh env                      # print detected mode + account name
#   stripe-json.sh <stripe args...>         # e.g. stripe-json.sh customers list --email a@b.c
#
# Environment:
#   STRIPE_ENV=live|sandbox   which environment you intend to hit (required, no
#                             default: agent shells often do not keep exported
#                             variables between calls, and a silent fallback to
#                             live would turn a forgotten prefix into a live
#                             write)
#   STRIPE_ACCOUNT_NAME=<name>  optional: the account name the banner must show.
#                             The mode alone cannot tell two live accounts (or
#                             two sandboxes) apart.
#
# Why the banner matters: the CLI keeps ONE active account in its config. A
# `stripe switch` or `stripe login` in another terminal silently changes what
# every later command hits. `--live` is refused when the active account is a
# sandbox, but a sandbox command run while the live account is active would
# hit live test mode without complaint. So we never trust the flag alone: we
# read "▸ Running in <name> · <mode>" from the output and compare it with what
# STRIPE_ENV says you wanted.
set -euo pipefail

want="${STRIPE_ENV:-}"
want_name="${STRIPE_ACCOUNT_NAME:-}"
case "$want" in
  live|sandbox) ;;
  # `env` alone may run unset: it is the preflight, before the user has chosen.
  "")
    if [[ "${1:-}" != env ]]; then
      echo "STRIPE_ENV is not set; prefix every call with STRIPE_ENV=live or STRIPE_ENV=sandbox" >&2
      exit 2
    fi ;;
  *) echo "STRIPE_ENV must be 'live' or 'sandbox' (got '$want')" >&2; exit 2 ;;
esac

if ! command -v jq >/dev/null 2>&1; then
  cat >&2 <<'EOF'
jq not found on PATH. This wrapper and the skill's cookbook rely on it to
parse Stripe's JSON output.

Install it (https://jqlang.org/download/), for example:
  brew install jq              # macOS
  sudo apt install jq          # Debian / Ubuntu
  sudo pacman -S jq            # Arch
  winget install jqlang.jq     # Windows
EOF
  exit 2
fi

if ! command -v stripe >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Stripe CLI not found on PATH.

Install it (https://docs.stripe.com/stripe-cli), then:
  stripe login          # start a session on the account you need
  stripe agent setup    # install the Stripe CLI agent skill

Alternatively connect a Stripe MCP server and use its tools; see references/stripe-cli.md.
EOF
  exit 2
fi

if ! stripe config --list 2>/dev/null | grep -q '^account_id'; then
  cat >&2 <<'EOF'
Stripe CLI is installed but has no active session.

  stripe login          # start a session
  stripe agent setup    # install the Stripe CLI agent skill (once)
EOF
  exit 2
fi

if [[ $# -eq 0 ]]; then
  echo "usage: stripe-json.sh env | <stripe args...>" >&2
  exit 2
fi

# Refuse un-confirmed destructive commands: without --confirm the CLI opens an
# interactive prompt that eats stdin and looks like a hang from inside an
# agent (observed with `subscriptions cancel` and `coupons delete`).
# Match whole arguments, not the joined string, so a `-d "description=… cancel …"`
# value is not mistaken for the command word.
# `delete_*` covers the DELETE endpoints named after what they remove
# (`customers delete_discount`, `subscriptions delete_discount`), which prompt too.
confirmed=0 destructive="" read_only=0
for arg in "$@"; do
  case "$arg" in
    --confirm|-c) confirmed=1 ;;
    delete|delete_*|cancel|void_invoice|mark_uncollectible|detach) destructive="$arg" ;;
    list|retrieve|search) read_only=1 ;;
  esac
done
if [[ -n "$destructive" && $confirmed -eq 0 ]]; then
  echo "refusing '$destructive' without --confirm (the CLI would prompt interactively)" >&2
  exit 2
fi

run_stripe() {
  if [[ "$want" == live ]]; then
    stripe "$@" --live
  else
    stripe "$@"
  fi
}

# Detect the mode the CLI is actually in from its banner line.
detect() {
  local out
  out="$(printf '%s' "$1" | grep -m1 'Running in' || true)"
  if [[ -z "$out" ]]; then
    echo "unknown|unknown"
    return
  fi
  # "▸ Running in <name> · <mode> (acct_...)"
  local name mode
  name="$(printf '%s' "$out" | sed -E 's/.*Running in (.*) · .*/\1/')"
  mode="$(printf '%s' "$out" | sed -E 's/.* · ([a-z]+).*/\1/')"
  echo "${mode}|${name}"
}

matches() { [[ "$1" == "$want" && ( -z "$want_name" || "$2" == "$want_name" ) ]]; }

mismatch() {
  echo "wanted STRIPE_ENV=$want${want_name:+ on '$want_name'} but the CLI is in: $1 ($2)" >&2
  echo "run '! stripe switch' to change the active account, then retry" >&2
}

# Sets raw, rc, mode and name from a harmless read.
probe() {
  set +e
  raw="$(run_stripe balance retrieve 2>&1)"
  rc=$?
  set -e
  IFS='|' read -r mode name <<<"$(detect "$raw")"
}

# Exits 3 unless the probe succeeded in the wanted environment.
require_env() {
  if [[ $rc -ne 0 ]] || ! matches "$mode" "$name"; then
    mismatch "$mode" "$name"
    if [[ $rc -ne 0 ]]; then printf '%s\n' "$raw" | grep -v 'Running in' >&2 || true; fi
    exit 3
  fi
}

if [[ "$1" == "env" ]]; then
  probe
  if [[ -z "$want" && $rc -eq 0 ]]; then
    # Preflight only: tooling and session work. No environment was asked for,
    # so nothing is enforced (a live account shows its test mode here).
    echo "$mode ($name); set STRIPE_ENV before any real command"
    exit 0
  fi
  require_env
  echo "$mode ($name)"
  exit 0
fi

# The banner check below runs after the command. For a read that is enough;
# a write in the wrong environment has already happened by then, so check
# first for anything that is not a read.
if [[ $read_only -eq 0 ]]; then
  probe
  require_env
fi

tmp_err="$(mktemp)"
trap 'rm -f "$tmp_err"' EXIT
set +e
raw="$(run_stripe "$@" 2>"$tmp_err")"
rc=$?
set -e

# The banner lands on stderr for most commands and on stdout for a few, so
# look at both.
IFS='|' read -r mode name <<<"$(detect "$(cat "$tmp_err"; printf '%s' "$raw")")"
if [[ $rc -ne 0 && "$mode" == unknown ]]; then
  # Failed before reaching the API (usage error, bad flag): show that, not an
  # environment complaint.
  cat "$tmp_err" >&2
  printf '%s\n' "$raw" >&2
  exit "$rc"
fi
if ! matches "$mode" "$name"; then
  mismatch "$mode" "$name"
  grep -v 'Running in' "$tmp_err" >&2 || true
  exit 3
fi

if [[ $rc -ne 0 ]]; then
  grep -v 'Running in' "$tmp_err" >&2 || true
  printf '%s\n' "$raw" | sed '/^[{[]/,$!d' >&2
  exit "$rc"
fi

# Drop everything before the first line that starts a JSON document.
json="$(printf '%s\n' "$raw" | sed '/^[{[]/,$!d')"

# The CLI exits 0 on API errors and prints {"error": {...}}; turn that into a
# real failure so callers using `set -e` or `&&` stop instead of parsing junk.
if printf '%s' "$json" | jq -e 'type == "object" and has("error")' >/dev/null 2>&1; then
  printf '%s\n' "$json" | jq -r '"stripe api error: \(.error.type // "?"): \(.error.message // "?")"' >&2
  printf '%s\n' "$json" >&2
  exit 1
fi

printf '%s\n' "$json"
