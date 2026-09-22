# SM2010 Release Gate 3 — Real-Device Performance Checklist

Use an iPhone capable of running the supported Safari build. Serve the development build on the local network and open `hero.html?performanceDebug=1`. Connect Safari Remote Web Inspector and capture diagnostics with:

```js
window.__SM2010_PERFORMANCE_QA__?.snapshot()
```

The snapshot is generated only when requested. Save one at initial load, after media use, immediately before T+900, after reset, and at the end of Run 2. Do not enable unrelated visual debug overlays during the performance run.

## Run 1

1. Load Hero and capture the initial snapshot.
2. Complete the note, NAME/CODE handoff, physical Power boot, Lock Screen, and passcode.
3. Open several representative apps. Include one long social feed and one composer.
4. Page SpringBoard in both directions, beginning at least one swipe over an icon.
5. Scroll a long feed, open a detail, return, and confirm its position restores.
6. Open Camera, take one photo, record one short video, then open Camera Roll and play the video.
7. Play and pause one iTunes preview.
8. Open and close the shared keyboard in a composer, switch fields, submit or cancel, and return to the app.
9. Allow scheduled notifications and runtime events to arrive while switching between SpringBoard, an app, sleep, and wake.
10. Capture the post-media snapshot and continue until T+900 and the complete ending/reset flow. Capture the pre-terminal and post-reset snapshots.

During the run, record any frame drop, touch latency, sustained scroll jank, unusual phone heat, Safari memory reload, audio glitch or duplicate playback, ScreenPortal drift, camera failure, or video playback problem.

## Run 2

1. Start the second session and repeat onboarding, Power boot, unlock, and passcode.
2. Page SpringBoard, scroll one long feed, open and close two apps, use one composer, take one photo, play one iTunes preview, and sleep/wake once.
3. Capture the final snapshot.
4. Compare Run 2 with Run 1 for startup speed, app-launch response, scrolling, Camera/video response, audio behavior, heat, DeviceScreen instance count, media/object-URL counts, notification and scheduler counts, ScreenPortal mount state, DOM-node count, and known RAF owners.

## Release-risk thresholds

### Blocker

- Safari reloads or crashes.
- Touch, keyboard, passcode, or physical-button input breaks.
- ScreenPortal drift persists rather than correcting during a transition.
- Run 2 is materially slower or less responsive than Run 1.
- Camera media, video object URLs, audio channels, notifications, or scheduler events leak across reset.
- Audio or video plays twice, overlaps unexpectedly, or survives reset.
- Photo capture, video recording, or recorded-video playback fails on supported Safari.

### Must fix

- A severe frame hitch is repeatable at the same interaction.
- Feed scrolling has sustained lag rather than an isolated dropped frame.
- The phone becomes excessively hot during one 15-minute run.
- Reset leaves stale Camera media, audio/preview state, notification queue entries, scheduler entries, or extra DeviceScreen instances.

### Acceptable

- An occasional small frame drop during a heavy transition.
- A minor first-use decode or asset-loading delay that does not repeat throughout the run.
- Reconstructed animation timing that is coherent but not pixel-perfect UIKit physics.
