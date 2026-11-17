# YükVinç — Production UI change policy

## Scope
This repository serves https://yukvinc.com.tr, its admin dashboard and Android application.
The owner has explicitly required the website and admin panel's established visual appearance to stay unchanged while backend and app development continues.

## Hard visual baseline
Do not edit, auto-format, regenerate, replace, rename, inject CSS into, or otherwise alter any of the following files unless the owner has specifically requested an appearance change for that surface:
- `public/index.html`
- `public/admin/index.html`
- `public/assets/site.css`
- `public/assets/admin-layout.css`
- `public/assets/sidebar.js`
- `public/assets/site.js`
- `functions/_lib/public-styles.js`
- `functions/_lib/home-render.js`

`tests/visual-lock.test.mjs` verifies the Git blob hashes for the underlying production visual baseline. Do not change hashes just to make tests pass. A genuine owner-approved visual update requires a documented before/after comparison and desktop/mobile/admin validation.

## Cloudflare routing state (17 November 2026)
- Custom domain `yukvinc.com.tr` is served by the `yukbul` Worker.
- The last known intended marketplace appearance uses the 9 November 2026 `yukvinc-sitejs-dedupe` Worker version `52e0cc28-486d-4bbf-b28e-1d6030e186a9`, deployed at 100%, on only these routes:
  - `yukvinc.com.tr/`
  - `yukvinc.com.tr/assets/site.js*`
  - `yukvinc.com.tr/assets/site-optimized.js*`
- Do not create or overwrite edge Workers/routes that rewrite homepage/admin HTML or JS, replace styles, or inject navigation.
- Do not change Cloudflare cache configuration or deploy alternate styles without a specific owner-approved UI change.

## Development constraints
- Backend, API, Android, new opportunities/notification processing and security improvements can continue on separate branches as long as the locked website visual surface remains unchanged.
- Run `npm test`, static syntax checks and Wrangler dry-run before proposing deployment. Verify all UI-critical CSS and JS assets are served with correct content types, and test desktop/mobile plus admin layouts when the necessary tools are available.
- Prefer reviewed pull requests, build artifacts and deployment approval; never claim that passing tests proves the rendered UI is correct.
- Do not remove the production D1 triggers `yukvinc_design_lock_update` and `yukvinc_design_lock_delete` without a new explicit owner request. Do not delete or reset users, listings, D1 data or authentication while fixing appearance.
- If the owner reports an appearance regression, diagnose routing/caching versus repository changes first, identify the last known working deployment, restore only the affected visual layer and re-check affected features.
