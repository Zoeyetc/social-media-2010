# SM2010 Cloudflare staging deployment v0.1

## Architecture

The existing React/Vite application remains the client build. Workers Static Assets uploads the normal Vite `dist` output and serves `index.html`, `hero.html`, hashed bundles, the iPhone GLB, and historical media. A module Worker handles `/api/flickr-mail*` before static routing and delegates other selected requests to the `ASSETS` binding.

The Cloudflare Vite plugin was evaluated but is not used in this staging path because its current build integration rejects this project's required multi-page `index.html` plus `hero.html` input. Direct Wrangler Static Assets deployment is the current supported fallback and avoids changing the application architecture.

The Worker imports the existing Flickr Mail validation, service, rate-limit, idempotency, and Resend transport implementation. `nodejs_compat` supplies the Node crypto and Buffer APIs used by that shared service. The Worker does not start a Node listener.

The closed-pilot service's documented quota and result maps remain in-memory and therefore isolate-local on Workers. Its stable HMAC-derived Resend idempotency key still protects same-request provider retries across isolate restarts. Durable, globally coordinated quotas are a separate requirement before any future public-recipient launch; staging remains restricted to the single approved recipient.

API responses and the `/` and `/hero.html` entry pages use `Cache-Control: no-store`. The Worker serves the canonical Hero asset body under the exact `/hero.html` entry path, avoiding Cloudflare's automatic `/hero` redirect. `public/_headers` also supplies the HTML header for direct static serving. Fingerprinted static assets retain Cloudflare's normal asset caching. Camera media remains browser-local.

## Local development

`npm run dev` remains the ordinary Vite server and retains the `/api/flickr-mail` proxy to the existing local backend on `127.0.0.1:8788`. `npm run mail:serve` remains unchanged. The staging build uses the same tested Vite output and adds deployment only through Wrangler.

## Required staging secrets

Configure these on `sm2010-hero-staging`; never prefix them with `VITE_`:

- `MAIL_API_KEY`
- `MAIL_FROM`
- `MAIL_REPLY_TO`
- `MAIL_RECIPIENT_ALLOWLIST`
- `MAIL_LIMIT_SECRET`

Set `MAIL_RECIPIENT_ALLOWLIST` to the approved staging recipient. The deployed Worker derives its expected origin from the request URL and requires the browser `Origin` header to match exactly, so `MAIL_ORIGIN` is not required in Cloudflare. The local Node backend continues to use `MAIL_ORIGIN`.

## Preparation and deployment

1. Authenticate Wrangler with the intended Cloudflare account.
2. Set each staging secret interactively with `npx wrangler secret put NAME`; do not paste secrets into tracked files or shell history.
3. Validate the upload without publishing: `npm run deploy:staging:dry-run`.
4. After explicit deployment approval: `npm run deploy:staging`.

Expected default URL: `https://sm2010-hero-staging.<account-subdomain>.workers.dev/hero.html`. A custom domain may be attached later without changing the same-origin API contract.

## Staging verification checklist

Do not mark this checklist passed until the Worker is deployed and tested on the staging URL.

- [ ] `/hero.html` loads directly; `/` loads `index.html`.
- [ ] The iPhone GLB and historical images, icons, wallpapers, audio, and video assets load.
- [ ] Boot, ScreenPortal projection, passcode, and SpringBoard work.
- [ ] Direct Apple `country=US` preview resolution and playback work without a Cloudflare proxy.
- [ ] `/api/flickr-mail/config` returns the expected enabled state with `Cache-Control: no-store`.
- [ ] Flickr Mail sends only to the staging allowlist recipient and a retry remains idempotent.
- [ ] Camera creates session-local synthetic video; Photos plays it without upload or persistent storage.
- [ ] T+900 ending and reset complete; Run 2 starts cleanly.
- [ ] DEV/query-gated diagnostics are absent by default and expose no mail configuration or secrets.

The current Vite build-size warning is recorded for real-device measurement. It does not justify speculative code splitting before Gate 3 results.
