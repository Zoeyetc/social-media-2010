# SM2010 — iOS 4.1 SpringBoard icon launch v0.1

Implementation/evidence record, 2026-10-18. Historical classifications below follow the supplied implementation brief; this pass did not collect new historical footage or authenticate Apple constants.

## Historical boundary

| Classification | Claim |
| --- | --- |
| EVIDENCE-BACKED | SpringBoard cold launch uses launch-image/snapshot zoom behavior, spatially related to the tapped icon, owned by the system. Destination takeover should have no blank flash. |
| EVIDENCE-BACKED BEST FIT | SpringBoard's icon field expands outward as the destination surface expands. |
| HISTORICALLY GROUNDED RECONSTRUCTION | 280 ms, cubic-bezier(.18,.7,.25,1), outward scale 1.18, and uniform aspect-preserving icon-to-viewport interpolation. These are project choices, not original Apple constants. |
| HOLD | Exact resume trajectory, differences between cold and resume, notification-auth destination motion, and Apple internal constants. |

## Ownership and geometry

`App` owns a separate `createSystemAppLaunch` owner through `useSystemAppLaunch`; `DeviceScreen` owns its presentation. Sequence: intent/preparing → frozen snapshot ready + live layout ready → animating → atomic live takeover/runtime running. App reducers and app content have no launch-specific changes. A synchronous claim rejects a second tap before React commits; token checks reject stale decode/completion callbacks.

`SpringBoard` measures the actual image inside the activated button, including dock, page two and Utilities children. Four temporary zero-size corner probes on the logical screen and four on the icon establish the rendered plane. Inverting the existing Hero screen homography converts perspective/scaled browser geometry into logical x/y/width/height/center. Probes are removed synchronously. No app-name coordinate table. A real event with unmeasurable projection stays on SpringBoard instead of silently using generic cold motion. Origin-less dev/internal calls retain compatibility.

The snapshot's final bounds are x=0, y=20, width=320, height=460, with the existing system status bar outside the zoom. Camera keeps its existing full-height app viewport (320×480); the stable system status layer stays above the animation and its existing Camera-specific ownership takes over atomically. Uniform scaling fits the destination aspect inside the measured icon bounds, centered on that icon, rather than distorting a portrait app into a square.

A full-screen SpringBoard field wrapper expands around the same logical origin, including grid, dock, page dots and an open folder. Wallpaper/dimming stay stationary behind it. No blur, white fade, overshoot or spring. The existing status bar remains one separate, unscaled layer; its values are unchanged.

## Frozen surface and readiness

Only the selected live app mounts, at its normal full size, hidden/inert behind SpringBoard and the snapshot. `SystemAppLaunchLayer` freezes its actual opening DOM using `cloneNode`, not a second React runtime. Thus all mapped destinations use their own existing opening content through one mechanism: Messages, Facebook, Twitter, Instagram, Foursquare, Flickr, Tumblr, Photos, Camera, iTunes, Notes, Weather, Stocks, Maps, Calendar, Settings, Safari, YouTube, App Store, Game Center, Clock, Compass, Calculator and Voice Memos (and the existing decorative WhatsApp/Skype destinations).

The clone retains form values and restored scroll positions, remaps SVG IDs/references, copies canvas frames and replaces video with a frozen canvas. Audio is removed. No cloned React handlers/effects/subscriptions; all snapshot descendants have animation/transition disabled and the whole layer is inert/aria-hidden.

Boot warmup and the existing core first-viewport gate remain in use. The snapshot's image/layout preparation shares the same 150 ms request budget (time already spent in the core gate is deducted). Once viewport images decode, two frames allow layout/scroll restoration before capture. At the deadline, the current fully laid-out opening chrome/text is frozen with fixed-size neutral artwork in unresolved image slots. The fallback retains content, rows and media geometry; it never substitutes an empty root. `fallbackUsed` records this path. Live readiness means the selected normal-size opening DOM has mounted and completed its layout boundary; it does not claim that every on-demand remote asset is decoded.

The snapshot alone animates. `.is-system-cold-launch` excludes the legacy `.94`/opacity animation and suppresses its completion handler. After the central 280 ms timeline, two frame boundaries retain final full coverage before a single batched update removes the frozen layer and makes the already-mounted live app interactive. The completion timer also handles missing animation-end events. No app remount at takeover.

Reduced motion uses a 1 ms full-geometry boundary, without icon zoom/outward motion. It still prepares the snapshot, blocks input and observes the same completion and cancellation ordering. This is an accessibility choice, not historical timing.

Home, short/long Power, sleep, reset, session exit and viewport resize/orientation cancel outstanding preparation/animation and invalidate tokens. Home/resize return to SpringBoard; sleep retains its normal lock/wake semantics. A notification destination supersedes any outstanding icon snapshot before following the existing destination route.

## Explicit exclusions and diagnostics

Retained apps reopened from SpringBoard use runtime `RESUME`, preserving app/scroll state and the existing 180 ms approximation. Its exact history stays HOLD. Direct slide-to-view and passcode-authenticated notification destinations never create the new icon-launch boundary; their existing routing/motion remains HOLD. Passcode success and Hero 3D code/assets are unchanged.

DEV + `?performanceDebug=1`: `window.__SM2010_PERFORMANCE_QA__?.snapshot().appLaunch` reports appId, originRect, requestedAt, snapshotReadyAt, animationStartedAt, animationCompletedAt, liveAppReadyAt, fallbackUsed and launchKind (cold/resume/notification). Canceled/session-reset intents clear their origins/records. No polling, per-frame logs or production-visible overlay. Core first-frame reveal is acknowledged when the frozen surface becomes visible, rather than when the hidden live app mounts.

## Automated validation

PASS on 2026-10-18: the commands below completed successfully. Native Chrome: **70** normal-motion component assertions, **58** reduced-motion assertions, and **168** assertions through **24** actual app destinations. The build retains its existing large-chunk advisory; it has no TypeScript/build failure. Some existing middleware test harnesses log a sandbox HMR-port `EPERM` while their assertions and process exit still pass; this is not a render/deployment result.


- `npm run build`
- `node src/device/systemAppLaunch.test.mjs`
- `node src/device/softwareSession.test.mjs --icon-launch` (real App owner, duplicate tap, handoff, preserved state, separate resume, Home/Power/resize and stale acknowledgements in both sessions)
- `node src/device/coreAppFirstFrame.test.mjs`
- `node src/device/interactionScrollPolish.test.mjs`
- `node src/device/softwareSession.test.mjs` and `--production`
- `node src/device/experienceLifecycle.test.mjs` and `--depletion` (stable DeviceScreen ownership)
- `node src/device/notificationPasscode.test.mjs`
- `node src/device/passcodeEntryTransition.test.mjs`
- `node src/device/mediaAttachmentFlow.test.mjs`
- `node src/state/finalDecorativeApps.test.mjs`
- `node src/device/releasePerformanceDiagnostics.test.mjs`
- Native Chrome fixture `/tests/system-app-launch.html`: start/middle/final geometry on a perspective-transformed surface, grid/dock/folder/page-two capture, contentful frozen clone, inert live surface, draft/scroll retention, one system status bar, atomic takeover and pending-capture cancellation. Repeat with `?reduced=1`.
- Native Chrome fixture `/tests/app-launch-apps.html`: real App/DeviceScreen, existing boot/readiness and all priority app destinations, with a test presenter instead of Hero 3D. Fixture HTML is not a production build input.
- `git diff --check`

No manual Safari QA, physical-device acceptance, authenticated Apple timing claim, push or deployment. Existing uncommitted staging configuration work is preserved byte-for-byte; production configuration is unchanged.

## Files in this change

- `src/device/App.tsx`
- `src/device/AppLaunchContainer.tsx`
- `src/device/DeviceScreen.tsx`
- `src/device/SpringBoard.tsx`
- `src/device/systemAppLaunch.ts`
- `src/device/useSystemAppLaunch.ts`
- `src/device/SystemAppLaunchLayer.tsx`
- `src/device/useReleasePerformanceDiagnostics.ts`
- `src/styles/device.css`
- `src/device/systemAppLaunch.test.mjs`
- `src/device/coreAppFirstFrame.test.mjs`
- `src/device/softwareSession.test.mjs`
- `tests/system-app-launch.html`
- `tests/system-app-launch.browser.tsx`
- `tests/app-launch-apps.html`
- `tests/app-launch-apps.browser.tsx`
- This evidence note.

The three pre-existing staging edits (`package.json`, `wrangler.staging.jsonc`, and `docs/qa/cloudflare-staging-deployment-v0.1.md`) were not changed by this launch work; SHA-256 comparison passed. `wrangler.jsonc` also matches its starting SHA-256. No commit was created.
