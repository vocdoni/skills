---
"@vocdoni/skills": minor
---

`vocdoni-stripe` 0.2.0: replaces the `stripe-subscription` skill with `stripe-environments`. The SaaS backend no longer has subscription plans, so the old skill described a flow that no longer exists. The new skill sets one named Stripe CLI profile per environment, checks the active account before any write, and covers running Stripe webhooks locally against saas-backend, alone or with vocdoni-app.
