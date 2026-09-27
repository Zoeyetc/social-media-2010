# Boot window staged initialization v0.2

The Apple-logo boot remains the only visible presentation. Successful boot requires
both the existing 20,000 ms minimum and `bootCriticalReady`. The narrative clock
and event delivery start at handoff, not while resources are warming.

## Ownership and tiers

- Tier 0: App/DeviceScreen, Lock Screen, Passcode and SpringBoard modules/styles are
  already in the initial device bundle. App owns the already initialized canonical
  reducers and notification controller. The queue is prepared once for the new
  experience session; the real keyboard structure mounts under the committed
  DeviceScreen and acknowledges its canonical 216px layout before readiness.
- Tier 1: Messages/Facebook/Twitter/Instagram module code and reducer data are
  already loaded. No fake dynamic imports or duplicate reducer initialization.
  Prime selected existing icons, small avatars and Instagram navigation artwork.
- Tier 2: Small icon decodes for Foursquare, Flickr, Tumblr, Photos, Weather,
  Notes, Stocks, Settings, Maps and Calendar. Their modules/data are also eager.
- Tier 3: Recorder/media APIs, video blobs/URLs, iTunes audio, Flickr Mail network
  work, historical albums, rare detail routes and full-resolution photographs
  remain on demand. Existing session/media namespace initialization is preserved.

The current manifest is capped at 20 images, 384 KiB encoded bytes and 512px raster
edges (enforced by the focused asset test). Character and first-feed originals
are often megabyte photographs, so they are deliberately excluded. No images
are changed or resized by this pass.

## Scheduling and reuse

One task runs per requestIdleCallback with at least 4ms budget; browsers without
that API use a 32ms timeout between tasks. Async completions also yield before
the next task. Optional tasks have a 1500ms timeout and never gate boot exit;
unfinished tasks are marked deferred at handoff and may continue while idle.

The keyboard is the sole IOS4KeyboardSystem under a retained, inert, invisible
app shell. No inactive app children are mounted. One layout read warms the key
tree; it neither claims input ownership nor focuses, scrolls or animates. The
first app uses that same tree. The former SpringBoard prewarm copy is removed.

Critical failure never means ready. A failure or 30-second critical deadline
uses the existing power-loss/return/reset sequence, with no technical screen and
no indefinite logo wait. The diagnostic snapshot records the failure until reset.
Reset cancels idle callbacks, timers and pending image work, clears the canonical
queue and acknowledgement, and unmounts the session keyboard shell. Run 2 has a
new schedule, queue and keyboard ownership; browser code/image caches may survive.

## Diagnostics and automated coverage

With DEV `?performanceDebug=1`, read
`window.__SM2010_PERFORMANCE_QA__?.snapshot().warmup`. It includes start/tier,
completed/deferred task IDs, critical readiness, keyboard/Tier 0/Tier 1/exit timing
and failure. No polling or per-task logging is added. Performance marks use the
requested `sm2010:` names for start, readiness, exit and first app/keyboard use;
duration measures are relative to warm-up start and cleared on the next run.

Focused tests cover budget yielding, serial work, critical acknowledgement, the
20-second minimum, optional failures, cancellation, two runs, hidden keyboard
ownership/structure, image bounds and the existing session lifecycle. These are
headless checks. Real-device first-use latency (target under roughly 300–500ms)
and visual continuity remain measurements for a subsequent authorized Gate 3 run.

## Changed files

- Added: `src/device/bootWarmup.ts`, `useBootWarmup.ts`, `bootWarmupImages.ts`,
  `bootWarmup.test.mjs`, `bootWarmupImages.test.mjs`, and this document.
- Device integration: `src/device/App.tsx`, `AppLaunchContainer.tsx`,
  `DevicePresentation.ts`, `DeviceScreen.tsx`, `IOS4KeyboardSystem.tsx`,
  `useReleasePerformanceDiagnostics.ts`, and `src/styles/device.css`.
- Hero boot gate/presentation: `src/hero/HeroController.ts`, `HeroPhone.tsx`,
  `HeroSandbox.tsx`, `HeroScene.tsx`, and `ScreenPortal.tsx`.
- Removed redundant prewarm: `src/device/KeyboardPrewarm.tsx` and
  `keyboardPrewarmState.ts`.
- Updated focused harnesses: `src/device/keyboardPrewarm.test.mjs`,
  `experienceLifecycle.test.mjs`, `softwareSession.test.mjs`,
  `notificationPasscode.test.mjs`, `mediaAttachmentFlow.test.mjs`,
  `releasePerformanceDiagnostics.test.mjs`, `src/hero/HeroController.test.mjs`,
  and `heroMuteReset.test.mjs`.
