# Third-Party Integration

Load the `third-party-provider` lens inside `开发执行` when the chosen design depends on an external provider, API, SDK, webhook, OAuth flow, payment provider, map provider, AI provider, storage provider, messaging provider, analytics provider, social platform, app store, or cloud service.

For payment, subscription, membership, paid credits, quota, refund, invoice, or paid-access changes, also load the `monetization-entitlement` lens. Payment providers are not only API integrations; they change business entitlement and data truth.

## Core Rule

Do not design third-party integration from memory.

Before implementation, actively check the provider's official documentation or official SDK repository when network access and tools allow it. Prefer primary sources:

- Official API docs.
- Official SDK docs.
- Official quickstart.
- Official webhook docs.
- Official OAuth/auth docs.
- Official changelog or migration guide.
- Official status, quota, pricing, or rate-limit docs when relevant.

Blogs, forum posts, and old examples are supporting clues only. They cannot replace official docs.

If live lookup is unavailable, blocked, or the user has not allowed network access, say so and mark the doc check `未验证`. Ask the user to provide docs, screenshots, provider name, app console settings, or API examples.

## What To Extract

Record a third-party evidence pack:

| Item | Evidence |
| --- | --- |
| Provider and product | Official name and service |
| Docs source | URL or local doc path |
| Checked date | Current date |
| API version | Version, endpoint version, SDK version, or `未找到` |
| Auth method | API key, OAuth, JWT, signature, session, app secret, etc. |
| Required app console setup | callback URL, redirect URI, webhook URL, domain verification, scopes |
| Endpoints or SDK methods | names and purpose |
| Required parameters | user-facing meaning and source |
| Response fields | what the app needs and what it ignores |
| Webhook/callback events | event names, retry behavior, signature verification |
| Error codes | user-visible handling and retry handling |
| Rate limits/quotas | limits and fallback |
| Idempotency | required keys or duplicate handling |
| Pagination | cursor/page rules when relevant |
| Sandbox/test mode | how to test safely |
| Pricing or billing impact | if relevant |
| Data/privacy/compliance | sensitive data, storage, deletion, consent |
| Secrets/config | env vars, example placeholders, rotation |
| License/reuse limits | SDK or sample code constraints |

## Business Fit

The goal is not "connect the API because it exists." The goal is to make the user's product better.

Before choosing an integration path, answer:

- What user problem does this provider solve?
- Which provider capability maps to the user's core flow?
- Which provider capability should not be used because it adds complexity or conflicts with the user's business?
- What can the project do better than the provider's default demo?
- What is the simplest integration that delivers the business result?
- What failure state must the user understand in plain language?

Do not copy official sample code blindly. Use docs to understand contracts, then fit the integration into this project's owner layers, truth docs, security rules, and user flow.

## Architecture Requirements

Write the integration truth before coding:

- Provider owner module.
- API boundary.
- Config and secret source.
- Request and response contracts.
- Webhook/callback owner.
- Data persistence owner.
- User-visible states: loading, success, failure, retry, permission denied, provider unavailable.
- Security checks: signature, scopes, ownership, replay protection, idempotency, sensitive logs.
- Test/sandbox plan.
- Fallback and manual recovery when provider fails.

## Existing SDK Or Integration Route

For inherited projects, check how the provider is already integrated before recommending changes:

- Official SDK.
- Non-official SDK.
- Outdated SDK.
- Raw HTTP calls.
- Custom wrapper.
- Mixed direct calls and wrapper calls.

If the current SDK or integration route is not the best current route, do not replace it automatically. Compare:

- Official documentation and SDK status.
- Current project owner module.
- Risk of staying.
- Risk of switching.
- Required code, config, secret, webhook, test, and data changes.

The AI must recommend one route with evidence, rejected alternatives, and migration scope:

- Keep current integration and document it.
- Keep current integration but repair version, wrapper, error handling, or security.
- Replace only the SDK/provider adapter.
- Plan a staged provider integration migration.

Ask the user only to confirm effects they can meaningfully judge: capability changes, account or service cost, downtime, data migration, user-visible disruption, or irreversible provider actions. Do not hand the SDK/provider architecture menu to a non-technical user.

Do not hide an SDK replacement inside an unrelated feature task.

## Required Questions

Ask or derive:

- Which provider is intended?
- Does the user already have an account/app/client ID/API key?
- Is this for test mode, private use, public launch, or production?
- Is the current project already using an SDK, raw API calls, or a custom wrapper for this provider?
- If the current SDK/integration is risky, what capability change, cost, downtime, data migration, or user-visible disruption can the user accept?
- What user action triggers the third-party call?
- What data leaves the project?
- What data returns and must be stored?
- Does the provider call back through webhook or redirect?
- What happens if the provider is down, slow, or rejects the request?
- What costs money or consumes quota?

## Validation

Before marking done, collect:

- Official docs checked and date.
- Config variables documented with placeholders only.
- Sandbox/test account setup if applicable.
- API request/response example or SDK call evidence.
- Webhook/callback verification evidence when applicable.
- Error case evidence.
- Logs with sensitive data redacted.
- Database before/after evidence when data is stored.
- Unverified items.

If a real provider call cannot be made, document the reason and mark it `未验证`.
