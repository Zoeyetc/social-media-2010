# Real-device QA fix set v0.1

Baseline: hero-shell `32e4220`. This supersedes the asset-budget/readiness
description in the earlier boot-window v0.2 checkpoint. Local implementation only; no push, deployment,
manual browser QA, or real-device acceptance claim.

## Mom

The existing case/punctuation normalizer now accepts exactly
`(yes|yeah|yep|yup) (mom|mami|mommy)` in addition to existing exact affirmatives.
Negative, ambiguous, Dad-addressed, and embedded affirmative text remain excluded.
The affirmative reply is still 30 seconds. Love intent retains its separate
20–60 second deterministic delay, and one-time claims/deletion/cutoff are unchanged.

## iTunes

DeviceAudio publishes per-track validated metadata readiness. Opening iTunes
starts metadata preparation immediately; selecting/next prepares that track too.
The selected-track readiness controls the actual disabled Play button, and App
rechecks readiness before accepting PLAY. DeviceAudio also rejects cold calls.
The first await in an actionable play path is the result of `audio.play()` itself.
No media element or audio bytes are created during metadata preparation.

Reopening retains the validated cache. Reset cancels old resolver generations;
valid 12-hour browser metadata can survive into Run 2. Existing 12-second lookup
bounds and 45-second failure cooldown remain. A media failure permits one metadata
refresh; recovered playback requires another explicit tap instead of asynchronous
autoplay. Mute, volume, pause and single-preview ownership remain centralized.

## First viewport and derivatives

`firstViewportAssets.ts` explicitly groups first-screen URLs by app. Its 54 unique
assets total 1,430,177 encoded bytes. The entire boot image inventory is 70 assets,
1,702,510 encoded bytes, below the 2,048 KiB/80-task guardrails.

Coverage: nine Facebook Home icons, feed micro-chrome and initial feed avatars/
first album media; Twitter character/default avatars; Instagram initial avatar,
IG04/IG03/IG01 first-photo variants and visible chrome; Foursquare friend avatars and tabs; all five Flickr
Home slideshow candidates. Tumblr's initial dashboard is text/chrome, Messages
has no initial avatars, and a fresh Photos Camera Roll has no static photo.

The generator produces 19 unique JPEG derivatives from 20 semantic records
(two June avatar roles share one source and derivative). Avatars fit within
192px; feed/slideshow photos fit within 640px. Originals remain untouched and
continue to serve detail viewers. Instagram covers the known T+200 deletion and T+210 replacement too, so
opening it for the first time during those events does not require an original. Run `node scripts/generate-first-viewport-assets.mjs` on macOS to regenerate
with sips at JPEG quality 85. Generated records include actual dimensions/bytes.

Render slots and boot import the same Vite URLs. The session cache retains Image
references, rechecks decode at first open, shares pending decodes with gates,
cancels unowned pending work,
and releases retained images on reset/unmount. Browser memory eviction cannot be
guaranteed away; this is stronger reuse than relying on temporary decodes alone.

## Boot and first-open bounds

Tier 0 remains critical. First-viewport images are the Tier 1A group; remaining
icons are opportunistic Tier 2. Metadata starts before image work and does not
hold up the image queue beyond its optional timeout.

Normal Hero boot still has its 20-second minimum. It waits for the first-viewport
group before that minimum; incomplete image work gets at most two additional
seconds, only while successful completions have occurred within the last 1.5s.
A stalled/offline group falls back after the minimum with an explicit incomplete
exit diagnostic. System-critical failure retains its separate 30-second bound.
Image tasks remain optional, have 1.5-second task bounds, and can continue after
handoff. No inactive app trees are mounted.

Idle callbacks have a 100ms timeout. A callback with less than 4ms budget schedules
one forced task after 32ms; async completions yield between serial tasks. Busy idle
time therefore cannot indefinitely reschedule every image without starting work.

First-open gates cover complete bounded groups for Messages, Facebook, Twitter,
Instagram, Foursquare and Flickr, including current first Twitter/Instagram
content where relevant. The existing 150ms fallback is retained. Fallback records
`firstViewportReady=false` and no successful `firstFrameReadyAt`.

## Diagnostics and automated validation

Existing DEV/query-gated `snapshot()` now exposes `warmupFirstViewport` with task/
byte completion, per-app status, grace use and incomplete-at-exit status. `iTunes`
contains selected metadata readiness, Play availability and URL presence. No
polling or production diagnostic UI is added.

Focused checks cover bounded Mom phrases and claims; real Play controls and
synchronous actionable playback; resolver/cache/failure paths; actual initial
app markup's warm URL coverage; asset sizes and original exclusion; retained
image reuse; busy-idle progress; progress-only grace and hard maximum; six-app
first-frame grouping; two-session software/Hero lifecycle; mute/volume; existing
notification/passcode routing and passcode-entry behavior. The older shared-media
harness now acknowledges that already-existing entry completion before typing;
no passcode runtime or animation changed. Build and diff checks
are part of final validation. These checks do not establish Safari audibility,
network performance, or real-device rendering.

Passcode sounds/animation, battery sound/depletion policy, historical HOLD items,
main, and production are unchanged.

## File inventory

- `src/audio/deviceAudio.ts`
- `src/audio/itunesPreview.test.mjs`
- `src/audio/itunesPreviewReliability.test.mjs`
- `src/data/twitterAvatarRegistry.ts`
- `src/device/App.tsx`
- `src/device/AppLaunchContainer.tsx`
- `src/device/DeviceScreen.tsx`
- `src/device/FacebookContainer.tsx`
- `src/device/FinalDecorativeApps.tsx`
- `src/device/FlickrContainer.tsx`
- `src/device/FoursquareAvatar.tsx`
- `src/device/InstagramContainer.tsx`
- `src/device/bootWarmup.test.mjs`
- `src/device/bootWarmup.ts`
- `src/device/bootWarmupImages.test.mjs`
- `src/device/bootWarmupImages.ts`
- `src/device/coreAppFirstFrame.test.mjs`
- `src/device/coreAppFirstFrame.ts`
- `src/device/coreAppFirstView.ts`
- `src/device/mediaAttachmentFlow.test.mjs`
- `src/device/releasePerformanceDiagnostics.test.mjs`
- `src/device/softwareSession.test.mjs`
- `src/device/useBootWarmup.ts`
- `src/device/useReleasePerformanceDiagnostics.ts`
- `src/hero/heroMuteReset.test.mjs`
- `src/state/finalDecorativeApps.test.mjs`
- `src/state/messagesState.ts`
- `docs/qa/real-device-qa-fix-set-v0.1.md`
- `scripts/generate-first-viewport-assets.mjs`
- `src/assets/first-viewport/alex-dog-golden-2007.jpg`
- `src/assets/first-viewport/alex-dogs-wangcai-bb-2009.jpg`
- `src/assets/first-viewport/alex-profile-picture.jpg`
- `src/assets/first-viewport/ben-profile-current.jpg`
- `src/assets/first-viewport/chris-profile-picture.jpg`
- `src/assets/first-viewport/jack-profile-picture.jpg`
- `src/assets/first-viewport/jay-band-performance.jpg`
- `src/assets/first-viewport/jay-guitar-may.jpg`
- `src/assets/first-viewport/jay-guitar.jpg`
- `src/assets/first-viewport/june-fb-10-18-01.jpg`
- `src/assets/first-viewport/june-fb-10-18-02.jpg`
- `src/assets/first-viewport/june-fb-F.jpg`
- `src/assets/first-viewport/june-ig-01.jpg`
- `src/assets/first-viewport/june-ig-03.jpg`
- `src/assets/first-viewport/june-ig-04.jpg`
- `src/assets/first-viewport/june-profile-avatar.jpg`
- `src/assets/first-viewport/katie-profile-picture.jpg`
- `src/assets/first-viewport/luca-profile-picture.jpg`
- `src/assets/first-viewport/matt-profile-current.jpg`
- `src/audio/itunesReadiness.test.mjs`
- `src/data/displayImageDerivatives.ts`
- `src/data/firstViewportAssets.ts`
- `src/device/firstViewportCoverage.test.mjs`
- `src/device/imageReadiness.ts`
- `src/state/momAffirmativeMatcher.test.mjs`
