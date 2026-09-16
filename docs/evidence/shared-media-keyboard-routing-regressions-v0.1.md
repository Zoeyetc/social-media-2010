# Shared Media v0.1 — Safari keyboard / entry-point regressions

Scope: the three reported media-entry regressions only. No publishing, Hero,
ScreenPortal, lifecycle, notification policy, timeline, Foursquare or scene-selection changes.

## Audit and reproduced causes

1. **Facebook keyboard:** `IOS4KeyboardSystem` closed the registration once in a
   passive suspension effect, without blurring the input or preventing another
   registration. The input binding's every-render layout effect treated `autoFocus`
   as a perpetual instruction. Facebook could reopen the keyboard immediately while
   `media.visible` remained true. Focused Messages/Twitter inputs and queued key-edit
   animation frames could likewise reacquire ownership. The regression harness fails
   against the pre-fix keyboard with `facebook-status/source: true !== false`.
2. **Twitter taps:** Camera and Photo Library are already enabled `<button>` elements
   with `onRequestMedia("camera"/"library")`, forwarded by DeviceScreen with requester
   `twitter` and the current new/reply context. No missing handler or decorative-span
   replacement is needed. The App guard rejected *every* request while any previous
   request existed, including an unfinished request retained in a background app.
   Actual JSX-handler tests reproduce this cross-app blocker. No button artwork,
   dimensions, pointer-events or stacking CSS changed in this fix.
3. **Messages routing:** PhotoButton → `onOpenCameraPicker` → DeviceScreen action →
   App creates a `camera-or-library` request with the current conversation ID. The
   route does not exclude Messages and no cancellation effect clears a valid request.
   The same global guard prevented its creation after leaving another app's flow.
   The new test initially failed with requester `twitter` instead of `messages`.

These are source/controller reproductions of concrete causes, not an independent
Safari trace proving that every untappable state has the same cause. Fresh-session
Safari hit testing and any remaining clipped/occluded state still need acceptance.

## Minimal correction

- Shared keyboard suspension is now an ownership lock: open/refresh cannot acquire
  while suspended; close actually blurs; layout-time dismissal happens before paint.
  No keyboard subtree is rendered during suspension. Late key-edit refocus callbacks
  cannot steal focus back. This is not a CSS-only hide.
- Initial autofocus is consumed once. Explicit focus can reopen after return; retained
  `autoFocus` cannot force the keyboard back. Draft/caret are retained. The old Messages
  picker-specific automatic focus restoration is removed in favor of this shared rule.
- An explicit media action from a different foreground requester cancels only the old
  background request before beginning the new request. Drafts/pending attachments are
  not cleared. Home/sleep alone still retain a request. Same-requester duplicate actions
  remain rejected, and old capture IDs cannot resolve the replacement request.
- Existing `?mediaAttachmentDebug=1` adds foreground app, keyboard owner and actual
  keyboard visibility, read from the single keyboard provider's diagnostic attributes.

## Verification / confidence

`mediaKeyboardOwnership.test.mjs` executes the real provider and input binding with
deterministic hook ordering and focus events, including child layout effects before
parent layout/passive effects. Three owners × three media stages × two loops cover
suspension, blur, no automatic return focus, explicit refocus, draft/caret retention
and stale animation-frame cancellation. `MEDIA_KEYBOARD_BASELINE=1` runs the same
test against HEAD's pre-fix keyboard and fails as expected (until this fix is committed).

`mediaAttachmentFlow.test.mjs` now invokes the real rendered JSX button callbacks
through DeviceScreen/App rather than testing entry only through direct request calls.
It covers Twitter Camera/library, Facebook Camera/library, Mom/Dad source chooser,
cross-app retained-request blocking, cancel and the existing two-session Camera checks.

Historical confidence: preserves the project's existing reconstructed controls and
shared iOS 4 keyboard. Ownership correction is behavioral, not a new historical UI
claim. The source chooser/pending-image chrome remains RECONSTRUCTED.

Manual Safari acceptance is pending for the user's 20-step sequence, including
keyboard-free Camera controls, visible request transitions, returned drafts, and
transformed taps. No independent Safari paint/hit-test pass is claimed.


## Track B source record — ab4235d

The following records source-side software evidence. The Hero evidence above is retained; combined Hero validation is separate and is not implied by source passes. Later Flickr/Tumblr evidence supersedes earlier reserved-requester statements.

# Shared Media v0.1 — Safari keyboard / entry-point regressions

Scope: preserved evidence for the three media-entry regressions, now exercised
through the normal software App. See the publishing evidence for the final behavior.

## Audit and reproduced causes

1. **Facebook keyboard:** `IOS4KeyboardSystem` closed the registration once in a
   passive suspension effect, without blurring the input or preventing another
   registration. The input binding's every-render layout effect treated `autoFocus`
   as a perpetual instruction. Facebook could reopen the keyboard immediately while
   `media.visible` remained true. Focused Messages/Twitter inputs and queued key-edit
   animation frames could likewise reacquire ownership. The regression harness fails
   against the pre-fix keyboard with `facebook-status/source: true !== false`.
2. **Twitter taps:** Camera and Photo Library are already enabled `<button>` elements
   with `onRequestMedia("camera"/"library")`, forwarded by DeviceScreen with requester
   `twitter` and the current new/reply context. No missing handler or decorative-span
   replacement is needed. The App guard rejected *every* request while any previous
   request existed, including an unfinished request retained in a background app.
   Actual JSX-handler tests reproduce this cross-app blocker. No button artwork,
   dimensions, pointer-events or stacking CSS changed in this fix.
3. **Messages routing:** PhotoButton → `onOpenCameraPicker` → DeviceScreen action →
   App creates a `camera-or-library` request with the current conversation ID. The
   route does not exclude Messages and no cancellation effect clears a valid request.
   The same global guard prevented its creation after leaving another app's flow.
   The new test initially failed with requester `twitter` instead of `messages`.

These are source/controller reproductions of concrete causes, not an independent
Safari trace proving that every untappable state has the same cause. Fresh-session
Safari hit testing and any remaining clipped/occluded state still need acceptance.

## Minimal correction

- Shared keyboard suspension is now an ownership lock: open/refresh cannot acquire
  while suspended; close actually blurs; layout-time dismissal happens before paint.
  No keyboard subtree is rendered during suspension. Late key-edit refocus callbacks
  cannot steal focus back. This is not a CSS-only hide.
- Initial autofocus is consumed once. Explicit focus can reopen after return; retained
  `autoFocus` cannot force the keyboard back. Draft/caret are retained. The old Messages
  picker-specific automatic focus restoration is removed in favor of this shared rule.
- An explicit media action from a different foreground requester cancels only the old
  background request before beginning the new request. Drafts/pending attachments are
  not cleared. Home/sleep alone still retain a request. Same-requester duplicate actions
  remain rejected, and old capture IDs cannot resolve the replacement request.
- Existing `?mediaAttachmentDebug=1` adds foreground app, keyboard owner and actual
  keyboard visibility, read from the single keyboard provider's diagnostic attributes.

## Verification / confidence

`mediaKeyboardOwnership.test.mjs` executes the real provider and input binding with
deterministic hook ordering and focus events, including child layout effects before
parent layout/passive effects. Three owners × three media stages × two loops cover
suspension, blur, no automatic return focus, explicit refocus, draft/caret retention
and stale animation-frame cancellation. `MEDIA_KEYBOARD_BASELINE=1` runs the same
test against HEAD's pre-fix keyboard and fails as expected (until this fix is committed).

`mediaAttachmentFlow.test.mjs` now invokes the real rendered JSX button callbacks
through DeviceScreen/App rather than testing entry only through direct request calls.
It covers Twitter Camera/library, Facebook Camera/library, Mom/Dad source chooser,
cross-app retained-request blocking, cancel and the existing two-session Camera checks.

Historical confidence: preserves the project's existing reconstructed controls and
shared iOS 4 keyboard. Ownership correction is behavioral, not a new historical UI
claim. The source chooser/pending-image chrome remains RECONSTRUCTED.

Manual Safari acceptance is pending for the user's 20-step sequence, including
keyboard-free Camera controls, visible request transitions, returned drafts, and
software surface taps. No independent Safari paint/hit-test pass is claimed.
