---
name: stripe-environments
description: Sets up and checks which Stripe account and mode the Stripe CLI, an agent and the Vocdoni SaaS stack are using, so every developer and agent works the same way. It covers logging in with one named CLI profile per environment (local, develop, live), confirming the active account before any write, the agent-safe and non-interactive forms of `stripe login`, `stripe switch` and destructive commands, and running Stripe webhooks locally with `stripe listen` against saas-backend (backend only, or the full stack with vocdoni-app). Use whenever someone runs the Stripe CLI, logs in or switches Stripe accounts, sets VOCDONI_STRIPEAPISECRET, VOCDONI_STRIPEWEBHOOKSECRET or STRIPE_PUBLIC_KEY, starts saas-backend or vocdoni-app locally with payments, debugs a webhook that never arrives, fails signature checks or does not credit a wallet top-up, or asks which Stripe sandbox to use, even if they only say "stripe isn't working locally".
---

# Stripe environments for Vocdoni

Pin the Stripe account with a named CLI profile on every command, and confirm
it from the CLI's banner before writing anything. The CLI keeps one *default*
account, and `stripe login` or `stripe switch` in any terminal changes it for
every other terminal and agent. A command without `-p` runs against whatever
was chosen last, which is how agents end up writing to the wrong account or
waiting on an interactive prompt.

## The environments

| Profile   | Account                                                  | Used by                                         |
| --------- | -------------------------------------------------------- | ----------------------------------------------- |
| `local`   | your own sandbox, no webhook endpoints                   | a local saas-backend (`stripe listen`)          |
| `develop` | the shared team sandbox                                  | the dev and staging APIs, through its webhooks  |
| `live`    | the live account                                         | production only; operators, never local stacks |

The shared sandbox is **not isolated**: its webhook endpoints deliver to the
dev and staging APIs, so a checkout, invoice or refund created there changes
real organizations in both, and deleting the object afterwards does not undo
the webhook. Confirm what a sandbox is wired to before writing to it:

```bash
stripe -p develop webhook_endpoints list | sed '/^[{[]/,$!d' \
  | jq '[.data[] | select(.status == "enabled") | .url]'
```

Local work goes to `local`. Use `develop` only to inspect what the dev and
staging APIs did, and write to it only with organizations confirmed
disposable in both backends. A local stack never gets a live key.

## Log in, once per profile

`stripe login` opens a browser and waits, so a person runs it, not an agent.
Ask the user to run it with the `!` prefix, one profile at a time, and pick
the matching account in the browser:

```bash
! stripe login -p local
! stripe login -p develop
! stripe login -p live      # only for people who operate production
```

An agent without a terminal can use the two-step flow: `stripe login -p local
--non-interactive` prints a `browser_url`, a `verification_code` and a
`next_step` command. Hand the URL and code to the user, then run `next_step`;
it blocks until they approve.

A CLI session expires after a while; the error says so. Log in again with the
same `-p`, never by pasting a key into the command line.

## Check before every write

Every command takes `-p <profile>`; never rely on the default profile. The
CLI prints a banner naming the account and mode it used:

```bash
stripe -p local balance retrieve 2>&1 | grep -m1 'Running in'
# ▸ Running in My Sandbox · sandbox (acct_…)
```

Read it before the first write of a task and again after anything that could
have changed it (a login, a long pause). If it names the wrong account, stop
and ask the user to fix the profile (`! stripe login -p local`); do not fall
back to another profile. Sandboxes always show `sandbox`; `--live` on a
sandbox profile errors out, and a live profile without `--live` silently uses
that account's test mode.

## Commands that hang or lie inside an agent

- **Interactive commands.** `stripe login`, `stripe switch` without an
  account id, and destructive commands (`delete`, `cancel`, `void_invoice`,
  `detach`, …) prompt on a terminal and hang without one. Pass `--confirm` to
  destructive commands, give `switch` an account id, and leave `login` to the
  user. Run Stripe commands with `</dev/null` so a missed prompt fails fast.
- **API errors exit 0.** The CLI prints `{"error": …}` and succeeds. Check
  for it: `| jq -e 'has("error") | not'`.
- **The banner pollutes output.** It goes to stderr for most commands and to
  stdout for some. Strip anything before the first JSON line
  (`sed '/^[{[]/,$!d'`) before piping into `jq`.
- **`stripe listen` and `stripe logs tail` never exit.** Run them in the
  background and read their output, or ask the user to keep one open.

## Local webhooks for saas-backend

The backend does not start without both `VOCDONI_STRIPEAPISECRET` and
`VOCDONI_STRIPEWEBHOOKSECRET`, and it verifies
every request to `POST /payments/webhook` against the second one. Both must
come from the **same** sandbox as the `stripe listen` profile; a key from one
account and a listener on another gives checkouts that never credit the
wallet. The full procedure, backend-only and full stack, is in
`references/local-webhooks.md`. In short:

```bash
stripe -p local listen --print-secret          # whsec_… for VOCDONI_STRIPEWEBHOOKSECRET
# .env: VOCDONI_STRIPEAPISECRET=sk_test_… (same sandbox), VOCDONI_STRIPEWEBHOOKSECRET=whsec_…
docker compose up -d                            # recreate, not restart, after editing .env
stripe -p local listen --forward-to localhost:8080/payments/webhook
```

Related: [[stripe-best-practices]] for Stripe API choices,
[[stripe-docs]] to look up a CLI flag or parameter this skill does not cover.
