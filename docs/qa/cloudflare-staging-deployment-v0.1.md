# SM2010 Cloudflare staging deployment v0.1

## Deployment ownership

| Environment | Config | Worker | URL |
| --- | --- | --- | --- |
| Production | `wrangler.jsonc` | `social-media-2010` | https://social-media-2010.zetc.workers.dev/ |
| Staging | `wrangler.staging.jsonc` | `sm2010-hero-staging` | https://sm2010-hero-staging.vincentfinn.workers.dev/ |

`deploy:staging` targets the staging Worker only through an explicit config path.
`deploy:staging:dry-run` selects the same config and adds `--dry-run`; it does not
publish. Neither script falls back to the production config or depends on a shell
environment variable to select its target. No production deploy script is defined.
Any future production deploy script must explicitly select `wrangler.jsonc`.

The production config, Worker name, bindings, required secret names and routes
are unchanged. The separate staging config uses the same entry point,
compatibility date/flags, `dist` assets and API routing contract, with its own
Worker identity. It does not copy production secret values.

## Architecture

The existing React/Vite application remains the client build. Workers Static Assets uploads the normal Vite `dist` output and serves `index.html`, `hero.html`, hashed bundles, the iPhone GLB, and historical media. A module Worker handles `/api/flickr-mail*` and `/api/itunes-preview/resolve` before static routing and delegates other selected requests to the `ASSETS` binding.

The Cloudflare Vite plugin was evaluated but is not used in this staging path because its current build integration rejects this project's required multi-page `index.html` plus `hero.html` input. Direct Wrangler Static Assets deployment is the current supported fallback and avoids changing the application architecture.

The Worker imports the existing Flickr Mail validation, service, rate-limit, idempotency, and Resend transport implementation. `nodejs_compat` supplies the Node crypto and Buffer APIs used by that shared service. The Worker does not start a Node listener.

The closed-pilot service's documented quota and result maps remain in-memory and therefore isolate-local on Workers. Its stable HMAC-derived Resend idempotency key still protects same-request provider retries across isolate restarts. Durable, globally coordinated quotas are a separate requirement before any future public-recipient launch; staging remains restricted to the single approved recipient.

API responses and the `/` and `/hero.html` entry pages use `Cache-Control: no-store`. The Worker serves the canonical Hero asset body under the exact `/hero.html` entry path, avoiding Cloudflare's automatic `/hero` redirect. `public/_headers` also supplies the HTML header for direct static serving. Fingerprinted static assets retain Cloudflare's normal asset caching. Camera media remains browser-local.

## Local development

`npm run dev` remains the ordinary Vite server and retains the `/api/flickr-mail` proxy to the existing local backend on `127.0.0.1:8788`. `npm run mail:serve` remains unchanged. The staging build uses the same tested Vite output and adds deployment only through Wrangler.

## Required staging secrets

These required names belong to `sm2010-hero-staging`; never prefix them with `VITE_`:

- `MAIL_API_KEY`
- `MAIL_FROM`
- `MAIL_REPLY_TO`
- `MAIL_RECIPIENT_ALLOWLIST`
- `MAIL_LIMIT_SECRET`

Set `MAIL_RECIPIENT_ALLOWLIST` to the approved staging recipient. The deployed Worker derives its expected origin from the request URL and requires the browser `Origin` header to match exactly, so `MAIL_ORIGIN` is not required in Cloudflare. The local Node backend continues to use `MAIL_ORIGIN`.

Existing staging secrets may be reused if already present. This configuration
repair does not read, print, copy or change secret values, and does not modify
production secrets. Presence of the remote staging secrets is not verified by a
local dry run.

## Preparation and deployment

1. Authenticate Wrangler with the Cloudflare account owning the staging Worker and its `vincentfinn.workers.dev` subdomain.
2. If a staging secret is missing, configure it only in a separately authorized operation using `npx wrangler secret put NAME --config wrangler.staging.jsonc`; do not paste values into tracked files or shell history.
3. Validate the upload without publishing: `npm run deploy:staging:dry-run`.
4. After explicit deployment approval: `npm run deploy:staging`.

The package scripts expand to:

```sh
# Staging Worker only; publishes only when explicitly authorized.
npm run build:staging && wrangler deploy --config wrangler.staging.jsonc

# Staging validation only; no deployment.
npm run build:staging && wrangler deploy --config wrangler.staging.jsonc --dry-run
```

Staging root: https://sm2010-hero-staging.vincentfinn.workers.dev/
Staging alternate entry: https://sm2010-hero-staging.vincentfinn.workers.dev/hero.html
Production remains https://social-media-2010.zetc.workers.dev/.
The local config selects the Worker name; the account owning that existing Worker
determines its workers.dev subdomain. This repair does not change account routing.

## Staging verification checklist

Do not mark this checklist passed until the Worker is deployed and tested on the staging URL.

- [ ] `/hero.html` loads directly; `/` loads `index.html`.
- [ ] The iPhone GLB and historical images, icons, wallpapers, audio, and video assets load.
- [ ] Boot, ScreenPortal projection, passcode, and SpringBoard work.
- [ ] Same-origin `/api/itunes-preview/resolve` resolves Apple `country=US` metadata; preview audio plays directly from Apple without proxying audio bytes.
- [ ] `/api/flickr-mail/config` returns the expected enabled state with `Cache-Control: no-store`.
- [ ] Flickr Mail sends only to the staging allowlist recipient and a retry remains idempotent.
- [ ] Camera creates session-local synthetic video; Photos plays it without upload or persistent storage.
- [ ] T+900 ending and reset complete; Run 2 starts cleanly.
- [ ] DEV/query-gated diagnostics are absent by default and expose no mail configuration or secrets.

The current Vite build-size warning is recorded for real-device measurement. It does not justify speculative code splitting before Gate 3 results.
