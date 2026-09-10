# Monetization And Entitlements

Load this reference as the `monetization-entitlement` lens inside `开发执行` whenever money changes what a user can access, including payments, subscriptions, memberships, paid credits, paid reports, paid downloads, paid usage quotas, upgrades, trials, refunds, invoices, or coupons.

## Contents

- Core Rule
- What Must Be Designed First
- Required Questions
- Payment Provider Gate
- Entitlement Truth
- Lifecycle Rules
- Security And Data Rules
- Validation

## Core Rule

Paid features are not a button and not a payment page. They are a business state machine.

Do not implement monetization until the project has:

- Product scope and target user.
- Clear paid value.
- Entitlement model.
- Payment/provider route.
- Backend-owned source of truth.
- Webhook or server verification plan.
- Failure/refund/cancel/expire handling.
- Security and data validation.

If the project is still proving its core product flow, recommend deferring complex monetization and only documenting future paid boundaries.

## What Must Be Designed First

Write a monetization truth document before coding:

- Paid product: what the user is paying for.
- Pricing unit: subscription, one-time purchase, credits, quota, seat, report, download, project, or usage.
- Entitlement: what access is granted after payment.
- Owner of entitlement truth: database table, backend service, provider webhook, or billing adapter.
- Access checks: where the app decides whether the user can use the paid capability.
- State lifecycle: unpaid, trial, active, past_due, canceled, expired, refunded, disputed, manually granted, blocked.
- Provider: payment platform, app store, manual invoice, bank transfer, or internal admin grant.
- User-visible states: paywall, checkout pending, paid active, payment failed, subscription expired, refund processing.
- Admin/support actions: grant, revoke, refund note, resync provider status, handle failed webhook.
- Data model: user, plan, order, payment, subscription, invoice, entitlement, usage, quota, audit log.
- Non-goals for the current stage.

## Required Questions

Ask or derive:

- Is payment needed in the first usable version, or can the first stage prove value before charging?
- What exactly becomes available after payment?
- Is this one-time payment, subscription, credits, usage quota, membership level, seat billing, or manual approval?
- Which provider or channel is intended?
- Does the user already have a merchant account, app store account, Stripe/LemonSqueezy/Paddle/WeChat/Alipay account, or local payment route?
- Which countries/currencies/tax/invoice requirements matter now?
- What happens when payment succeeds but the app fails to update entitlement?
- What happens when payment fails, is canceled, refunded, disputed, expired, or renewed?
- Can an admin manually grant or remove access?
- What is the simplest paid boundary that still matches the user's business?

Do not ask the non-technical user to design a billing architecture from scratch. Recommend one simplest route, explain risks, and ask for business confirmation.

## Payment Provider Gate

When the chosen payment design uses an external provider, also load the `third-party-provider` lens and verify official provider documentation before implementation.

Extract:

- Official checkout/payment/subscription docs.
- Webhook docs and event names.
- Signature verification method.
- Idempotency key rules.
- Sandbox/test mode.
- Production switch.
- Refund/cancel/dispute docs.
- Currency/country constraints.
- Fees, payout, tax, invoice, and compliance notes when relevant.
- Required env vars and dashboard settings.

Never trust client-side success URL, frontend state, or local storage as paid truth. Payment success must be verified by backend/provider evidence.

## Entitlement Truth

Entitlement is the app's answer to "what can this user access right now?"

Rules:

- Backend owns entitlement checks for paid capabilities.
- Frontend can show paywalls and disabled buttons, but it cannot be the source of truth.
- Store provider IDs needed for reconciliation.
- Store enough local state to make the product usable when provider APIs are slow or unavailable.
- Record audit events for paid access changes.
- Usage quotas must be counted server-side.
- Refund, cancel, and expiry must remove or downgrade access according to product rules.
- Manual grants must be visible in admin/audit truth.

## Lifecycle Rules

For each paid route, define:

- Start state.
- Trigger event.
- Provider event or admin action.
- Database change.
- User-visible result.
- Retry/idempotency rule.
- Failure state.
- Support/manual recovery path.

Common lifecycle traps:

- Success page says paid, but webhook failed.
- Webhook runs twice and grants duplicate credits.
- Refund happens but access remains active.
- Subscription expires but cached frontend still allows access.
- User changes plan and quota is not recalculated.
- Payment provider succeeds but local database transaction fails.
- Test keys or sandbox webhooks are used in production.

## Security And Data Rules

Check:

- Provider secrets are server-side only.
- Webhook signature verification is implemented.
- Idempotency protects duplicate events.
- Paid access checks cannot be bypassed by changing user ID, plan ID, URL, or frontend state.
- Logs do not expose card, token, secret, customer PII, or full provider payloads when not needed.
- Admin grant/revoke requires strong authorization.
- Money, credit, quota, invoice, refund, and subscription changes have audit evidence.

## Validation

Before marking a paid feature done, prove:

- Sandbox/test payment success path.
- Payment failure/cancel path.
- Webhook signature verification.
- Duplicate webhook/idempotency behavior.
- Entitlement granted only after verified provider/server event.
- Unauthorized user cannot access paid feature.
- Refund/cancel/expiry behavior when in scope.
- Database before/after evidence.
- Redacted logs.
- No real secret in repo or frontend bundle.
- User-visible states for pending/success/failure/expired.

If provider calls cannot be made, mark payment validation `未验证` and do not present monetization as ready for real users.
