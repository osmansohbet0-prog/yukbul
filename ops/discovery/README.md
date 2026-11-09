# YükVinç discovery release — 9 November 2026

## Outcome and scope

The production homepage now exposes search instead of hiding it in navigation. It retains the existing category, province/district, fee unit, comparison, contact and listing links; adds a declared-tonnage filter and minimum budget; fixes explicit price/newest ordering being overridden by promotional ranking; restores sharable filters from the URL; and keeps advanced fields collapsed on mobile. Styling is scoped to the marketplace. No dependencies were added.

The active production `yukbul` bundle is newer than repository main (`343f129`). It includes jobs, account features and isolated auth/radar/detail fixes absent from this checkout. **Do not deploy this checkout's top-level wrangler.jsonc to production to ship this feature.** This release changes the existing `yukvinc-sitejs-dedupe` presentation Worker only. Its YUKBUL service binding remains unchanged. No data, secrets, schemas, plans, AI settings or Cron frequencies changed. Existing fix Workers were retained because they serve working flows.

Production version: `81fda71c-81cc-45c5-9d61-64af23b2e6b5`. Deployment: `315be94c-2362-49eb-b6a6-52c5a1f85ef8`. Original rollback version: `071f23ba-04bc-4870-ada7-b9e470412083`; source preserved in baseline-worker.mjs.

The initial feature was released at 1%, 25%, then 100%, with targeted version-override HTTP checks between stages. The shared-link fix was canaried at 1% and then promoted after HTTP checks. This was a short smoke rollout, not a statistically significant conversion/error-rate experiment.

## Routing and rollback

The pre-existing routes are retained:

- `yukvinc.com.tr/`
- `yukvinc.com.tr/assets/site-optimized.js*`

One narrow route was added: `yukvinc.com.tr/assets/site.js*`, ID `3a8f878bbbcd487b85bc310f7e196db7`, zone `46c493a67dfdfff266d513de9704cf07`. Cloudflare exact root routes do not match query strings. Routing the original script supplies the same UI and scoped style on shared search URLs without adding a whole-site interceptor. The Worker fetches the source through a service binding, avoiding public-route recursion. Existing auth/radar/detail routes were read back and preserved.

Rollback order matters:

1. Remove **only this release's added route**, after verifying its ID, pattern and script still match the above. This restores the original asset path to the underlying application. Keep every pre-existing route.
2. Deploy the presentation Worker's original version `071f23ba-04bc-4870-ada7-b9e470412083` at 100% using Workers deployments API / dashboard. Do not roll back `yukbul`, auth or radar.
3. Verify homepage, a search URL, original/optimized script, login, posting, admin, radar and a canonical listing URL. Reload any open pages to discard their already-loaded script.

There is no database rollback or data cleanup. Revalidation headers on new assets and no-store on rewritten home HTML reduce stale new-version content. Browser-cached older assets may require a reload. Version-tagged legacy optimized assets continue to receive legacy behavior during rollout.

## Build and validation

```
node ops/discovery/build.mjs
node --check .discovery-build/worker.mjs
npm test
npx --no-install wrangler deploy --dry-run --config ops/discovery/wrangler.jsonc --outdir .discovery-build/package
```

The build emits a self-contained ES module. The text imports in worker.js are build inputs substituted by build.mjs; do not upload worker.js directly. Upload the generated worker.mjs as a new version, preserving the existing service binding. Use versions/deployments, not a top-level main-Worker deployment. The local config intentionally omits route ownership; API-managed existing routes are documented above.

Validation completed:

- 1,319 repository tests passed; all application JavaScript passed syntax checks.
- Locked npm install: 35 packages audited, zero vulnerabilities; no dependency changes.
- Both baseline application package and feature package passed Wrangler dry-run. The first baseline run reported a local log-file permission error but completed packaging; feature dry-run used a workspace log path and passed cleanly.
- Read-only browser preview with production public listings; mobile 390px and desktop 1440px; no horizontal overflow at mobile (375px client width = scroll width).
- Live combined province/district/tonnage search returned exactly one correct Gebze listing; reset restored all 18; shared query URL restored selected district and tonnage.
- No browser console errors on tested marketplace and login views. Google identity button loaded; registration toggle exposed password confirmation. No real account was created, no Google sign-in completed, no listing submitted, no admin change or radar job triggered. End-to-end authenticated writes require a designated test account/environment.
- Live health/home/listing/login/posting/admin responses were checked. Unauthenticated member and radar requests returned 401. Admin session endpoint returns 200 as a session-check response; this does not prove an authenticated admin flow.

## SEO inventory

Existing production SEO was retained rather than replaced by the older repository implementation. The sitemap index has four child maps and 35 URLs. All 18 public API listings had exactly one sitemap URL and a 200 listing page with description, canonical and JSON-LD; none returned a noindex header. A listing sample includes WebPage, Service, BreadcrumbList, Organization and WebSite entities, with real publication/modification dates and server-rendered content. Canonical remains the unfiltered homepage for query variants. No search-engine inclusion or ranking is guaranteed, and Google Search Console was not available to confirm actual indexing.

Public metadata, full SSR listing content and the live sitemap are therefore already automatic for published listings. New parallel SEO pages or speculative city/tonnage doorway pages would duplicate working functionality and were not added.

## Product research and decisions

- [Sahibinden filtering](https://yardim.sahibinden.com/hc/tr/articles/115004846274): supports both explicit submission and update-on-selection. Explicit submit was chosen to avoid requests on every keystroke; selection chips and fee sorting stay familiar.
- [Sahibinden search](https://yardim.sahibinden.com/hc/tr/articles/115004846554): promotional/recommended order should not silently override a user's explicit numeric/date choice. The filter tests cover this distinction.
- [Machineryline crane rentals](https://machineryline.com.tr/-/kira/mobil-vincler--a8c120): category, location and capacity are prominent. YükVinç now exposes these with fewer mobile fields.
- [Armut crane rentals](https://armut.com/vinc-kiralama): request/offer discovery complements browsing. Existing YükVinç job/request links were preserved, without inventing guarantees, response times or customer reviews.

Tonnage is a text-derived aid using declared capacity or an explicit range, not engineering verification. Missing capacity does not match a tonnage filter; metre values are not treated as tons. For multiple discrete numbers the first declared capacity is used conservatively, without inventing a continuous range. A future structured capacity field needs a separately reviewed data model/backfill. Prices with different fee periods are grouped instead of converted with invented assumptions. Unknown prices stay last.

## Performance and remaining work

Removed automatic search requests on every input and the redundant district-initialization load in the enhanced script. Explicit submission has one fetch; sort/fee-unit changes reuse loaded results. SSR cards survive a failed refresh. No new application framework, SDK, third-party scripts, paid resources or service plans were added. Existing application scripts and fix Workers were not deleted without establishing that they were unused. No Lighthouse/Core Web Vitals improvement is claimed; field measurements remain necessary. Temporary rollout revalidation favors reliable rollback over maximum repeat-visit script caching.

Client filters operate on the public listing API's returned inventory. All 18 current public listings were covered. At larger inventory sizes, server-side capacity/budget filtering, pagination, totals and facet counts must be implemented in the actual current backend; do not imply global completeness beyond that API's response. Reconciling current production source back into Git is the highest-priority follow-up before deeper backend changes.

## Sustainable one-hour work

The production scheduler already runs each minute (`* * * * *`) plus a weekly review. Live bundle inspection confirmed the minute handler calls inbox synchronization and processListingAgent; the agent selects at most two pending listings, limits review starts to three attempts and respects the moderation enable setting. It records review evidence and requires an admin decision for publication. Existing automation was not enabled or increased.

An HTTP-triggered Worker has no fixed wall-clock duration while its client remains connected, but CPU budgets, disconnects and runtime updates make a guaranteed uninterrupted hour unsuitable. Cron and Queue invocations have 15-minute wall-time limits; waitUntil after response/disconnect provides only up to 30 seconds. See [Worker limits](https://developers.cloudflare.com/workers/platform/limits/).

For a future explicit one-hour maintenance session, use a persisted run record (id, deadline, cursor, processed count, attempt count, lease, budget, state). The existing minute Cron can claim a bounded batch, checkpoint and exit; the next tick resumes until the deadline/budget or completion. A conditional lease prevents overlap; retries use backoff and a maximum attempt count. Each action needs an idempotency key, and a pause switch stops new batches. Limit jobs to defined maintenance checks/reviews; deployments remain reviewed/tested releases. Never schedule an agent to rewrite and publish arbitrary production code each minute.

For longer external calls or higher volume, Queues can retry per-item work and isolate a dead-letter queue; Workflows can persist multi-step execution across waits/retries. These alternatives were proposed, not provisioned, because they can add usage/cost and require isolated resource validation. A Worker is an application runtime, not an autonomous software developer. See [Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/), [gradual releases](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/) and [version overrides](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/).
