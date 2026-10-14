# iOS 4.1 Passcode entry system transition v0.1

Post-RC1 historical-correction candidate, `hero-shell`, baseline
`sm2010-rc1 / b6f879166346a5e6d62399537a0033a4d7d07df8`.

## Evidence-backed sequence

The preceding motion evidence pass accepted only the normal Lock Screen → Passcode
entry segment in Macerkopf's period video,
[iOS 4.1 - Passcode Security Hole - iPhone 4](https://www.youtube.com/watch?v=8tth9EzTWAw).
The title identifies iPhone 4 / iOS 4.1; the device appearance and displayed October
26 lock date are compatible. No About/build screen independently authenticates
8B117. Indexed upload dates differed by one day (October 26/27, 2010).

Approximately 2.5–3.0 seconds in the examined player segment support:

- Continuously visible, stationary wallpaper.
- Continuous locked status-bar appearance and center lock indicator.
- Large clock/date and the localized Passcode title briefly coexist, then the
  title dominates as the clock/date recede.
- Numeric keypad enters upward from the bottom as a system surface.
- No SpringBoard or blank/black intermediate surface.

Those player positions locate the observations; they are **not** authenticated
source frame timing. The later Emergency Call bypass is not correct-code success
evidence. No successful-code, ordinary unlock, or notification destination motion
was established by this clip.

## Historically grounded reconstruction — timing unresolved

`PASSCODE_ENTRY_DURATION_MS = 280` is the one tunable primary duration, defined in
`src/device/usePasscodeEntryTransition.ts`. All entry CSS animations use the same
system-supplied duration and `ease-out`. Clock opacity runs 1 → 0 while incoming
title/content opacity runs 0 → 1 on that shared timeline; no relative delay is
used. This provides overlap without independent arbitrary timings.

**280ms, ease-out, and the opacity schedule are HISTORICALLY GROUNDED
RECONSTRUCTION, not evidence-backed Apple constants.** The precise cell trajectory
remains unresolved: cells only fade at their accepted geometry. The numeric
204px-high keypad translates by its own full height, placing its top at the 480px
DeviceScreen boundary initially, and finishes at its existing position.

Reduced motion replaces keypad travel with the incoming opacity treatment and a
1ms completion boundary. That accessibility value is not historical evidence.
State ordering still includes `passcodeEntering`.

## Implementation ownership

App accepts the existing successful pointer-up request and records
`locked → passcodeEntering`. DeviceScreen owns entry completion, CSS timing,
reduced-motion handling and timer cleanup; completion acknowledges `passcode`.
PasscodeScreen has no independent navigation/entry animation controller.

Locked, entering and stable Passcode share one system wallpaper DOM owner at a
fixed 320×480 crop. The outgoing LockScreen and incoming PasscodeScreen backgrounds
are transparent against that layer. The existing LockScreen shade remains an
outgoing decoration. The locked status-bar component keeps the same owner slot
and reads the existing canonical model throughout entry. LockScreen stays mounted
until completion, with only clock/date opacity animated.

Slider, digits and Cancel are blocked during entry, including guards against
direct auth/Cancel callbacks. Completion enables input in the same state change.
Short Power cancels presentation into sleep; Home remains a no-op. Long Power
cancels entry into the existing power confirmation, whose Cancel restores stable
Passcode. Leaving entry or changing session cancels its completion timer; late
completion cannot reveal Passcode over sleep/reset. No entry sound is added.

Notification slide-to-view uses the same entry path and leaves the existing
pending destination ref and notification reducer in charge. No destination opens
before correct-code authentication.

## HOLD paths preserved

- Slider threshold `.78`, pointer-up trigger, drag geometry, shimmer and partial
  drag behavior are unchanged. Slider/preview disappear without an invented exit
  trajectory once the accepted request starts entry; historical exit remains HOLD.
- Exact cell travel remains HOLD; no cell translation, scale or bounce is added.
- Correct-code → SpringBoard / pending app remains the existing hard switch.
- Ordinary no-passcode unlock and notification destination motion remain HOLD.
- Stable Passcode Cancel remains the existing hard switch to locked.
- Sound behavior and unlock-sound visual phase remain unchanged / HOLD.

## Automated validation

- `npm run build`.
- `node src/device/passcodeEntryTransition.test.mjs`: real controller and real
  component hook host; actual slider release, entry/completion timing, persistent
  React owner/type/key paths, coexisting layers, whole-keypad geometry contract,
  blocked inputs, immediate stable input, deferred notification route, success,
  Cancel, no-passcode branch, Power cleanup and reduced motion.
- `node src/state/passcode.test.mjs`.
- `node src/state/notificationState.test.mjs`.
- `node src/device/notificationPasscode.test.mjs`.
- `node src/device/experienceLifecycle.test.mjs` (also `--depletion`).
- `node src/device/softwareSession.test.mjs` (also `--production`).
- `git diff --check`.

Existing controller-only regression harnesses explicitly acknowledge the new
DeviceScreen completion boundary; the focused test exercises its real timer and
component projection. These are deterministic controller/component and CSS
contract checks, not rasterized browser or real-device motion verification.
No manual browser/Safari QA, commit, push or production deployment is performed.
