---
"@vocdoni/skills": minor
---

Removes the `vocdoni-stripe` plugin and its `stripe-subscription` skill. saas-backend has retired subscription plans in favour of pay-per-process wallet billing, and with only a couple of developers touching Stripe, a shared skill is not worth maintaining. If you installed skills with `npx @vocdoni/skills`, remove the old copy with `npx @vocdoni/skills uninstall stripe-subscription`; installing never removes a skill. Claude Code users can run `claude plugin uninstall vocdoni-stripe@vocdoni`.
