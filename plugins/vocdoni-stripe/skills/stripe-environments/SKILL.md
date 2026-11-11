---
name: stripe-environments
description: Keeps every developer and agent on the same Stripe account conventions. Names Vocdoni's four Stripe environments (the Develop, Stage and "Auditore & CI" sandboxes, and live production), which backend each one feeds through its webhooks, the CLI profile names to log in with (develop, stage, ci, live), how to confirm the active account before any write, the agent-safe forms of `stripe login`, `stripe switch` and destructive commands, and running Stripe webhooks locally with `stripe listen` against saas-backend (backend only, or the full stack with vocdoni-app). Use whenever someone runs the Stripe CLI, logs in or switches Stripe accounts, sets VOCDONI_STRIPEAPISECRET, VOCDONI_STRIPEWEBHOOKSECRET or STRIPE_PUBLIC_KEY, starts saas-backend or vocdoni-app locally with payments, debugs a webhook that never arrives, fails signature checks or does not credit a wallet top-up, or asks which Stripe sandbox or key to use.
---

# Stripe environments for Vocdoni

Pin the Stripe account with a named CLI profile on every command, and confirm
it before writing anything. The CLI keeps one *default* account, and
`stripe login` or `stripe switch` in any terminal changes it for every other
terminal and agent. A command without `-p` runs against whatever was chosen
last, which is how agents end up writing to the wrong account.

## The environments

Every developer uses these profile names, so a command written by one person
or agent means the same thing for everyone:

| Profile   | Stripe account  | Webhooks deliver to                                  | Use it for                               |
| --------- | --------------- | ---------------------------------------------------- | ---------------------------------------- |
| `develop` | Develop Sandbox | the dev API (`saas-api-dev…/payments/webhook`)       | reproducing what happened on dev         |
| `stage`   | Stage Sandbox   | the staging API (`saas-api-stg…/subscriptions/webhook`) | reproducing what happened on staging  |
| `ci`      | Auditore & CI   | nothing                                              | local stacks, CI and automated tests     |
| `live`    | production      | the production API                                   | production operations only               |

- **`ci` is the default for local work.** It has no webhook endpoints, so the
  only backend that hears its events is the one your own `stripe listen`
  forwards to. Others share it, so a listener also receives their events,
  and the backend does not check that the organization exists: another
  developer's or CI's completed top-up credits a wallet for their
  organization in your local database, and their refunds debit it. Expect
  stray wallets there and do not read totals across organizations; when
  that matters, keep the listener running only while you test, or reset
  the local database afterwards.
- **`develop` and `stage` are not isolated.** A checkout, invoice, refund,
  product or subscription created there reaches the dev or staging API and
  changes real organizations, and deleting the object afterwards does not
  undo it. Read freely; write only with an organization the user has
  confirmed is disposable in that backend.
- **Staging still runs subscription plans.** Its endpoint is the old
  `/subscriptions/webhook` on an older API version, and staging and
  production keep the plan and subscription handling until the
  pay-per-process release reaches them. A product write in `stage` changes
  staging's plans.
- **`live` is real money.** Only people who operate production log in to it,
  and a local stack never gets a live key.

The endpoints change as releases move; check them instead of trusting the
table:

```bash
stripe -p stage webhook_endpoints list </dev/null 2>/dev/null | sed '/^[{[]/,$!d' \
  | jq '[.data[] | select(.status == "enabled") | {url, api_version}]'
```

## Log in, once per profile

Logging in needs a browser approval, so a person does it. Ask the user to run
it in their own terminal, choosing the matching account in the browser:

```bash
stripe login -p ci
stripe login -p develop
stripe login -p stage
stripe login -p live      # only for people who operate production
```

Not with the `!` prefix: inside an agent session the CLI switches to its
non-interactive flow and prints JSON whose `next_step` command has no `-p`,
so running it as printed saves the credentials to the **default** profile.
An agent can drive that flow itself, as long as it adds the profile:

1. `stripe login -p ci --non-interactive </dev/null` prints a `browser_url`,
   a `verification_code` and a `next_step` command.
2. Give the user the URL and code to approve in the browser.
3. Run `next_step` with `-p ci` appended (`stripe login --complete '<url>' -p ci`).
   It blocks until they approve.

Logins expire (`expires_at` in `stripe whoami`); the error says so. Log in
again with the same `-p`, never by pasting a key into a command line.

## Check before every write

Every command takes `-p <profile>`; never rely on the default profile. Before
the first write of a task, and again after a login or a long pause, confirm
the account:

```bash
test -z "${STRIPE_API_KEY:-}" || echo "STRIPE_API_KEY is set: -p is ignored"
stripe -p ci whoami --format json </dev/null | jq -r '.display_name, .mode'
# Auditore & CI
# test
```

`STRIPE_API_KEY` in the environment overrides `-p` without saying so, and the
banner and `whoami` still name the profile's account while requests go to the
key's. Unset it before using profiles.

If the name is not the environment the user asked for, stop and ask them to
log in to that profile again; do not fall back to another one. Sandboxes
report mode `test`. On `live`, add `--live` to every command: without it a
live login silently uses that account's test mode.

## Commands that hang or lie inside an agent

- **Prompts.** `stripe switch` without an account id and destructive commands
  (`delete`, `cancel`, `void_invoice`, `detach`, …) prompt on a terminal and
  hang without one. Pass `--confirm` to destructive commands, and do not
  `switch` at all: profiles replace it. Run Stripe commands with `</dev/null`
  so a missed prompt fails fast.
- **API errors exit 0.** The CLI prints `{"error": …}` and succeeds. Check
  for it: `| jq -e 'has("error") | not'`.
- **The banner pollutes output.** `▸ Running in <account> · sandbox` goes to
  stderr for most commands and to stdout for some. Strip anything before the
  first JSON line (`sed '/^[{[]/,$!d'`) before piping into `jq`.
- **`stripe listen` and `stripe logs tail` never exit.** Run them in the
  background and read their output, or ask the user to keep one open.

## Local webhooks for saas-backend

The backend does not start without both `VOCDONI_STRIPEAPISECRET` and
`VOCDONI_STRIPEWEBHOOKSECRET`, and it verifies every request to
`POST /payments/webhook` against the second one. Both must come from the
**same** sandbox as the `stripe listen` profile, normally `ci`; a key from one
account and a listener on another gives checkouts that never credit the
wallet. The full procedure, backend only and full stack, is in
`references/local-webhooks.md`. In short:

```bash
stripe -p ci listen --print-secret </dev/null   # whsec_… for VOCDONI_STRIPEWEBHOOKSECRET
# .env: VOCDONI_STRIPEAPISECRET=sk_test_… of the same sandbox, plus the whsec_…
docker compose --profile with-vocone --profile local-smtp up -d
stripe -p ci listen --forward-to localhost:8080/payments/webhook
```

Related: [[stripe-best-practices]] for Stripe API choices,
[[stripe-docs]] to look up a CLI flag or parameter this skill does not cover.
