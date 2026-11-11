---
"@vocdoni/skills": minor
---

`vocdoni-stripe` 0.2.0: replaces the `stripe-subscription` skill with `stripe-environments`. saas-backend has retired subscription plans in favour of pay-per-process wallet billing, so the subscription workflow is going away. The new skill names Vocdoni's four Stripe environments (Develop, Stage and "Auditore & CI" sandboxes, and live) with shared CLI profile names, checks the active account before any write, and covers running Stripe webhooks locally against saas-backend, alone or with vocdoni-app. If you installed skills with `npx @vocdoni/skills`, remove the old copy with `npx @vocdoni/skills uninstall stripe-subscription`; installing never removes a skill.
