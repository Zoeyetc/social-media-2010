# Shared Media Attachment Flow v0.1

Implementation and controller tests complete; manual Safari acceptance pending.
Target: iPhone 4 / iOS 4.1, October 20, 2010. No network upload/MMS service is simulated.

This records the v0.1 stage. Its Facebook/Twitter publishing blocks and associated
test expectations are superseded by `media-publishing-v0.2-mms-visual-v0.1.md`.

## Entry-point audit

| Surface | Previous handler/behavior | v0.1 |
| --- | --- | --- |
| `MobileSMSContainer.tsx`, conversation PhotoButton | `onOpenCameraPicker` → App `LAUNCH cameraPicker`; black placeholder with Cancel, no preview/capture bridge | Same button requests camera-or-library with the active conversation ID |
| `FacebookContainer.tsx`, Feed composer camera | Disabled button, no handler; `SUBMIT_STATUS` creates text-only status records | Opens existing status composer and shared source chooser; draft retained |
| `TwitterContainer.tsx`, compose Camera | Decorative span, no handler | Shared Camera request with new/reply context |
| Twitter Photo Library | Decorative span, no handler | Shared Camera Roll picker request |
| Twitter attachments capsule | Inert, count-neutral artwork; no preview/removal state | Capsule unchanged; separate minimal pending-image/removal presentation |
| `InstagramContainer.tsx`, Share source | Already renders `PhotosContainer mode="picker"` with App Camera Roll and `SELECT_CAMERA_ROLL_PHOTO` | Unchanged |
| `FlickrContainer.tsx` | Photostream/sets/detail/comments/favorites only; no upload action | Unchanged; requester contract reserved |
| `TumblrContainer.tsx` | Dashboard/post/reblog/notes only; no capture/upload action | Unchanged; requester contract reserved |

Reusable existing APIs: App's `captureCameraPhoto`, `cameraRuntime.cameraApp`, AmbientWorld preview/capture callbacks, App-owned `cameraRoll`, and `PhotosContainer mode="picker"`.

## Ownership and explicit return

App owns one `mediaRequestTransition` reducer. Requests carry requester, photo mode,
source, context ID, request ID and experience session ID. Stages are source,
camera, library and result. A duplicate request cannot replace an active foreground
request. An explicit media action in a different foreground app supersedes a
retained background request without clearing drafts or pending images.

The requesting app remains the foreground runtime owner, mounted below an inert
media overlay. No navigation through SpringBoard or browser history is used to
return. `MEDIA_RETURN` restores the exact conversation / status composer / new or
reply composer and optionally installs an attachment in that app's existing
reducer. Cancel sends no image and retains any pre-existing attachment and draft.
The shared keyboard relinquishes focus during media presentation; returning does
not automatically refocus a composer. Explicit refocus remains available. See
`shared-media-keyboard-routing-regressions-v0.1.md` for the follow-up regression
fix and test evidence. Cross-app Safari focus behavior still needs acceptance.

The single rendered `CameraContainer owner="cameraApp"` is used for both standalone
Camera and attachment capture. The old black `cameraPicker` presentation is no
longer mounted. Its dormant reducer compatibility branch is not refactored here.
Camera control-state and scene selection remain in the existing App reducer;
presentation canvas mounting is not a new Camera runtime/bootstrap. The existing
full-height Camera chrome is preserved while the requesting app's status bar is
temporarily excluded. The source chooser and library retain the normal status bar.

Successful captures use the same artifact persistence path and Camera Roll. A
request-ID check rejects stale asynchronous results after cancellation or reset.
Selection reads an existing Camera Roll record, not an app-specific library.
Attachments reference the Roll's existing URL; they do not allocate/revoke blobs.

## Drafts and downstream boundaries

- Messages stores pending attachments by conversation ID in `MessagesState`.
  `SEND` consumes the active thread's pending image once, appends one outgoing
  message with the draft as optional text, and uses App's canonical device date/time.
  The existing conversation preview uses text or `Photo`. No automatic send occurs.
- Facebook stores one pending image in its existing state. `SUBMIT_STATUS` is a
  text-only pipeline; runtime photo upload/album creation is not implemented.
  Share is blocked while a photo is pending, with an explicit explanation. Remove
  restores normal text posting. No parallel post/album repository was added.
- Twitter stores one pending image in its existing composer state. The existing
  tweet/reply and public-submission paths are text-only and have no media upload
  service. Send is blocked while a photo is pending, with an explicit explanation.
  Remove restores existing text submission. The 140-character counter is unchanged.
  This does not claim October 2010 native Twitter photo hosting.

Home hides/suspends the flow without completing it. Resume restores the request.
Power sleep/wake and scheduled notifications leave requester/draft/media state
intact; a result that arrives in the background waits until the requester is active.
Only the existing completed session-reset callback clears requests and existing
app reducers (including their new pending fields). No resource/world deletion
policy, scene-selection rule, notification policy or lifecycle timing changed.

## Historical confidence / evidence

- Existing Messages PhotoButton raster: project-authenticated iOS 4.1 asset.
- Camera and Photos presentation: reuse the project's existing reconstruction.
- Twitter Camera / Photo Library affordances and order: project period capture
  documented in `twitter-2010-historical-ui-checkpoint-d3-compose-tool-panel.md`.
  This pass supersedes only those two controls' previously inert behavior.
- Prior Messages placeholder boundary:
  `mobilesms-camera-picker-return-blocker-fix-v0.2.md`.
- Source chooser, pending preview/remove, capture-to-draft return and local image
  send treatment: **RECONSTRUCTED**, not asserted to be pixel-exact app-specific
  historical picker/review chrome. No modern sheet, PHPicker, browser file chooser,
  multi-photo tweet, media upload service or new app feature beyond the request.

## Verification

`node src/device/mediaAttachmentFlow.test.mjs` runs the actual App controller,
reducers and effects with deterministic time and mocked capture/persistence I/O.
It covers A–R's controller boundaries over two sessions: all requesters' Camera
and library paths, draft/context retention, cancel, one outgoing image, pending
preview markup, explicit posting HOLD, one preview canvas, Home/Power, duplicate
request rejection, invalid library ID rejection, late capture rejection,
notification/auto-sleep continuity, reset and once-per-session selection/bootstrap.
Rendering checks use server-rendered real DeviceScreen markup, not Safari pixels.
Camera JPEG fidelity/IndexedDB integration are existing systems, not certified by
the mocked I/O checks.

The seed validator retains single App / DeviceScreen / AmbientWorld / Camera
ownership, adds single shared-request ownership, and preserves overlay order and
historical assertions. Only superseded picker/tool structural assertions changed.

Safari QA URL: `/hero.html?mediaAttachmentDebug=1`. DEV-only diagnostics expose
requester, source, context, stage, selected media ID, explicit return target,
Camera scene session ID and pending IDs for each wired requester.

Manual checks pending: the requested Mom capture/send sequence; Facebook source
chooser/capture/library and draft return; Twitter Camera/library/Remove; keyboard
typing and restored focus; full-height shutter/Cancel access; transformed taps;
notification/modal stacking; Home/Power resume; repeated opens and second loop.

Flickr/Tumblr reuse needs only an approved real entry point and app-local pending
result adapter; the shared contract includes both. No speculative UI was wired.


## Track B source record — ab4235d

The following records source-side software evidence. The Hero evidence above is retained; combined Hero validation is separate and is not implied by source passes. Later Flickr/Tumblr evidence supersedes earlier reserved-requester statements.

# Shared Media Attachment Flow v0.1

Implementation and controller tests complete; manual Safari acceptance pending.
Target: iPhone 4 / iOS 4.1, October 20, 2010. No network upload/MMS service is simulated.

This records the v0.1 stage. Its Facebook/Twitter publishing blocks and associated
test expectations are superseded by `media-publishing-v0.2-mms-visual-v0.1.md`.

## Entry-point audit

| Surface | Previous handler/behavior | v0.1 |
| --- | --- | --- |
| `MobileSMSContainer.tsx`, conversation PhotoButton | `onOpenCameraPicker` → App `LAUNCH cameraPicker`; black placeholder with Cancel, no preview/capture bridge | Same button requests camera-or-library with the active conversation ID |
| `FacebookContainer.tsx`, Feed composer camera | Disabled button, no handler; `SUBMIT_STATUS` creates text-only status records | Opens existing status composer and shared source chooser; draft retained |
| `TwitterContainer.tsx`, compose Camera | Decorative span, no handler | Shared Camera request with new/reply context |
| Twitter Photo Library | Decorative span, no handler | Shared Camera Roll picker request |
| Twitter attachments capsule | Inert, count-neutral artwork; no preview/removal state | Capsule unchanged; separate minimal pending-image/removal presentation |
| `InstagramContainer.tsx`, Share source | Already renders `PhotosContainer mode="picker"` with App Camera Roll and `SELECT_CAMERA_ROLL_PHOTO` | Unchanged |
| `FlickrContainer.tsx` | Photostream/sets/detail/comments/favorites only; no upload action | Unchanged; requester contract reserved |
| `TumblrContainer.tsx` | Dashboard/post/reblog/notes only; no capture/upload action | Unchanged; requester contract reserved |

Reusable existing APIs: App's `captureCameraPhoto`, `cameraRuntime.cameraApp`, AmbientWorld preview/capture callbacks, App-owned `cameraRoll`, and `PhotosContainer mode="picker"`.

## Ownership and explicit return

App owns one `mediaRequestTransition` reducer. Requests carry requester, photo mode,
source, context ID, request ID and experience session ID. Stages are source,
camera, library and result. A duplicate request cannot replace an active foreground
request. An explicit media action in a different foreground app supersedes a
retained background request without clearing drafts or pending images.

The requesting app remains the foreground runtime owner, mounted below an inert
media overlay. No navigation through SpringBoard or browser history is used to
return. `MEDIA_RETURN` restores the exact conversation / status composer / new or
reply composer and optionally installs an attachment in that app's existing
reducer. Cancel sends no image and retains any pre-existing attachment and draft.
The shared keyboard relinquishes focus during media presentation; returning does
not automatically refocus a composer. Explicit refocus remains available. See
`shared-media-keyboard-routing-regressions-v0.1.md` for the follow-up regression
fix and test evidence. Cross-app Safari focus behavior still needs acceptance.

The single rendered `CameraContainer owner="cameraApp"` is used for both standalone
Camera and attachment capture. The old black `cameraPicker` presentation is no
longer mounted. Its dormant reducer compatibility branch is not refactored here.
Camera control-state and scene selection remain in the existing App reducer;
presentation canvas mounting is not a new Camera runtime/bootstrap. The existing
full-height Camera chrome is preserved while the requesting app's status bar is
temporarily excluded. The source chooser and library retain the normal status bar.

Successful captures use the same artifact persistence path and Camera Roll. A
request-ID check rejects stale asynchronous results after cancellation or reset.
Selection reads an existing Camera Roll record, not an app-specific library.
Attachments reference the Roll's existing URL; they do not allocate/revoke blobs.

## Drafts and downstream boundaries

- Messages stores pending attachments by conversation ID in `MessagesState`.
  `SEND` consumes the active thread's pending image once, appends one outgoing
  message with the draft as optional text, and uses App's canonical device date/time.
  The existing conversation preview uses text or `Photo`. No automatic send occurs.
- Facebook stores one pending image in existing state. The existing `SUBMIT_STATUS`
  path now accepts photo-only and text+photo posts referencing the selected Roll record.
- Twitter stores one pending image in existing composer state. `SUBMIT_NEW_TWEET`
  accepts text+photo, retains required text and the 140-character counter, and uses
  the same media in timeline/detail. This does not claim native October photo hosting.
  The public-submission path remains text-only; no upload service is added.

Home hides/suspends the flow without completing it. Resume restores the request.
Power sleep/wake and scheduled notifications leave requester/draft/media state
intact; a result that arrives in the background waits until the requester is active.
Only the existing completed session-reset callback clears requests and existing
app reducers (including their new pending fields). No resource/world deletion
policy, scene-selection rule, notification policy or lifecycle timing changed.

## Historical confidence / evidence

- Existing Messages PhotoButton raster: project-authenticated iOS 4.1 asset.
- Camera and Photos presentation: reuse the project's existing reconstruction.
- Twitter Camera / Photo Library affordances and order: project period capture
  documented in `twitter-2010-historical-ui-checkpoint-d3-compose-tool-panel.md`.
  This pass supersedes only those two controls' previously inert behavior.
- Prior Messages placeholder boundary:
  `mobilesms-camera-picker-return-blocker-fix-v0.2.md`.
- Source chooser, pending preview/remove, capture-to-draft return and local image
  send treatment: **RECONSTRUCTED**, not asserted to be pixel-exact app-specific
  historical picker/review chrome. No modern sheet, PHPicker, browser file chooser,
  multi-photo tweet, media upload service or new app feature beyond the request.

## Verification

`node src/device/mediaAttachmentFlow.test.mjs` runs the actual App controller,
reducers and effects with deterministic time and mocked capture/persistence I/O.
It covers A–R's controller boundaries over two sessions: all requesters' Camera
and library paths, draft/context retention, cancel, one outgoing image, pending
preview markup, one-record photo publishing, one preview canvas, Home/Power, duplicate
request rejection, invalid library ID rejection, late capture rejection,
notification/auto-sleep continuity, reset and once-per-session selection/bootstrap.
Rendering checks use server-rendered real DeviceScreen markup, not Safari pixels.
Camera JPEG fidelity/IndexedDB integration are existing systems, not certified by
the mocked I/O checks.

The seed validator retains single App / DeviceScreen / AmbientWorld / Camera
ownership, adds single shared-request ownership, and preserves overlay order and
historical assertions. Only superseded picker/tool structural assertions changed.

Safari QA URL: `/?mediaAttachmentDebug=1`. DEV-only diagnostics expose
requester, source, context, stage, selected media ID, explicit return target,
Camera scene session ID and pending IDs for each wired requester.

Manual checks pending: the requested Mom capture/send sequence; Facebook source
chooser/capture/library and draft return; Twitter Camera/library/Remove; keyboard
typing and restored focus; full-height shutter/Cancel access; software surface taps;
notification/modal stacking; Home/Power resume; repeated opens and second loop.

Flickr/Tumblr reuse needs only an approved real entry point and app-local pending
result adapter; the shared contract includes both. No speculative UI was wired.
