# YükVinç — PRODUCTION FREEZE / OLD DESIGN RESTORATION

## Production source of truth (owner decision, 17 November 2026)
The owner expressly requested a **complete return of the previous website and administration interface**, including job listings, job requests, tenders and the İş Radarı admin experience. Preserve this state; do not substitute newer GitHub files or a redesigned landing page.

The approved live Cloudflare deployment for production Worker `yukbul` is:
- Worker version **V222**, ID **`e394c647-c942-4352-9f7f-1f46d88f558a`**, created 2026-11-07.
- Deployment allocation: **100%**.
- Custom domains: `yukvinc.com.tr`, `www.yukvinc.com.tr`.
- Production D1: existing `yukvinc-db` database. Do **not** roll back, drop, reset or alter user/listing/job/radar records.

Thirteen separate Cloudflare Worker routes that overlaid or rewrote old homepage, script, jobs, tender, profile, member login, and detail pages were removed on 2026-11-17. **Do not recreate** those routes without a new explicit owner request.

Leave only these existing ancillary routes, as needed:
- `yukvinc-radar-sanitizer`: `/assets/lead-radar-admin.js*`, `/api/radar*`, `/admin/radar/yayinla*`.
- `yukvinc-seo-settings`: `/robots.txt`, `/sitemaps/pages-1.xml`.

The `/admin/*` path has historically been protected by Cloudflare Access (independently of its own admin login). Do not weaken security just to bypass that access page.

## Critical repository mismatch
**GitHub `main` is NOT an exact copy of deployed V222.** It contains newer layouts and omits some V222 job/radar UI and Worker functionality. A new `wrangler deploy` of `main` to `yukbul` could overwrite the recovered live UI and make the dashboard, job pages or radar disappear again.

Therefore:
1. **Do not run `wrangler deploy` to production**, change `yukbul` Worker versions, add Cloudflare HTML/CSS/JS rewriting routes, or enable auto-deploy from this repository without a fresh explicit owner instruction.
2. Develop on isolated branches and previews, with a separate preview/staging database and no writes to production D1.
3. For any eventual production candidate, first reconstruct and compare the full V222 functionality (admin İş Radarı, tender review, business job requests, offers, listing discovery, Google login and registration). Visually test the homepage, job pages, login, listing detail and admin dashboard on desktop/mobile and verify API/data compatibility.
4. Require approval of the finished preview before promoting to production.
5. Never claim that passing CI tests proves that the **live** UI is preserved.

`tests/visual-lock.test.mjs` checks GitHub-main file hashes only; it **does not certify** that those files match V222. Never replace production V222 with this repository solely because the hash tests pass.

## Protected repository files
Do not casually change or auto-format `public/index.html`, `public/admin/index.html`, `public/assets/site.css`, `public/assets/admin-layout.css`, `public/assets/sidebar.js`, `public/assets/site.js`, `functions/_lib/public-styles.js`, or `functions/_lib/home-render.js`. But note: their current hash baseline is NOT the authoritative production V222 design.

## Maintenance
Monitor deployment drift and regressions hourly. Notify the owner if the live `yukbul` Worker differs from the V222 version ID above, if the removed overlay routes reappear, or if jobs/radar become inaccessible. Do not change Cloudflare deployment, admin auth, or D1 data as an automatic repair without explicit authorization.

Do not drop or override the D1 design-protection triggers `yukvinc_design_lock_update` and `yukvinc_design_lock_delete` without a separate owner request. Preserve all users, listings, jobs, offers and radar source data.
