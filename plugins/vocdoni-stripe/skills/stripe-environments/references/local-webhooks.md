# Local Stripe webhooks for saas-backend

How to run the SaaS backend locally with real Stripe test payments: the
backend alone, or the full stack with vocdoni-app. Everything here runs
against the `local` profile's sandbox.

## What the backend needs from Stripe

- `VOCDONI_STRIPEAPISECRET`: a `sk_test_…` secret key of the sandbox. Copy it
  from that sandbox's Dashboard (Developers → API keys); the restricted key
  `stripe login` stores is for the CLI.
- `VOCDONI_STRIPEWEBHOOKSECRET`: the `whsec_…` that `stripe listen` signs
  with. It is tied to the account and stays the same between runs, so set it
  once.
- A **tax origin address** in the sandbox (Dashboard → Settings → Tax). The
  backend creates checkout sessions with automatic tax, and Stripe refuses
  them until the account has one. A new sandbox has none.

The checkout sessions use inline `price_data`, so a new sandbox needs no
products or prices.

Check that the key and the listener point at the same account before
debugging anything else:

```bash
curl -s -u "$VOCDONI_STRIPEAPISECRET:" https://api.stripe.com/v1/account | jq -r .id
stripe -p local get /v1/account </dev/null 2>/dev/null | sed '/^[{[]/,$!d' | jq -r .id
```

The two ids must match.

## Backend only

From a saas-backend checkout:

```bash
cp example.env .env                     # once; .env is gitignored
stripe -p local listen --print-secret   # put the result in VOCDONI_STRIPEWEBHOOKSECRET
```

Set both Stripe variables in `.env`, then start the stack. The profiles add
the local chain (`with-vocone`) and the fake SMTP capture (`local-smtp`);
saas-backend's `docs/payg/payg-manual-testing.md` lists the other `.env`
values they need.

```bash
docker compose --profile with-vocone --profile local-smtp up -d
stripe -p local listen --forward-to localhost:8080/payments/webhook
```

Keep the listener running for as long as you test; it prints one line per
event with the backend's response code. `docker compose restart` does not
re-read `.env`: after changing it, run `docker compose up -d` again so the
`api` container is recreated.

Running the API outside Docker (`go run ./cmd/service`) works the same: the
variables come from the environment, and the listener forwards to whatever
port `VOCDONI_PORT` sets.

## Full stack (backend and vocdoni-app)

The app needs the **publishable** key of the same sandbox, as
`STRIPE_PUBLIC_KEY=pk_test_…`. Without it the app does not load Stripe.js and
the checkout cannot render.

- **App in the backend's compose** (`--profile with-ui`): the `ui` service
  reads the backend's `.env`, so add `STRIPE_PUBLIC_KEY` there. It builds
  vocdoni-app from GitHub at `VOCDONI_APP_REF` (default `develop`) and points
  it at the local API.

  ```bash
  docker compose --profile with-ui --profile with-vocone --profile local-smtp up -d
  ```

- **App from a local vocdoni-app checkout**: set `SAAS_URL=http://localhost:8080`
  and `STRIPE_PUBLIC_KEY` in its `.env`, and start it as usual.

Either way, the listener command is the same as for the backend alone.

## What the backend does with each event

`POST /payments/webhook` acts on:

| Event                                                                  | Effect                                   |
| ---------------------------------------------------------------------- | ---------------------------------------- |
| `checkout.session.completed`, `checkout.session.async_payment_succeeded` | credits the wallet top-up                |
| `checkout.session.async_payment_failed`, `checkout.session.expired`    | drops the pending top-up                 |
| `invoice.paid`                                                         | credits a manual top-up invoice          |
| `refund.created`, `refund.updated`                                     | records the refund                       |
| `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`    | records the dispute                      |

Every other event, subscription and product events included, is acknowledged
and ignored: the backend no longer has subscription plans. To keep the listener quiet, add
`--events` with the types above.

## When the wallet is not credited

Read the listener's line for the event first, then the API log
(`docker compose logs api`).

- **No line at all**: the listener is on another account than the key that
  created the checkout. Compare the account ids above.
- **500, and the API log says the signature validation failed**:
  `VOCDONI_STRIPEWEBHOOKSECRET` is not the listener's secret, or the
  container still runs with the old `.env`. Recreate it.
- **500, and the API log mentions the API version**: the backend accepts only
  events on its stripe-go release train. Align the sandbox's API version in Workbench with
  the one saas-backend pins (see `docs/payg/payg-manual-testing.md`).
- **200 but nothing changed**: the event lacked the metadata the backend
  needs (an organization it does not know, a session it did not create) and
  was dropped on purpose; the API log says why. `stripe trigger` events are
  like this: they carry no Vocdoni metadata, so they test delivery, not the
  wallet.

To replay a real event after fixing the cause:
`stripe -p local events resend evt_… </dev/null`. For a run without a
browser or a card, saas-backend ships `docs/payg/test-payg-flow.sh`, which
signs the webhook itself.
