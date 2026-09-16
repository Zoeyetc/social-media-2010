# Media Publishing v0.2 + SMS/MMS Visual Correction v0.1

Target: October 20, 2010; iPhone 4, iOS 4.1. Uses
`agents/skills/sm2010-visual-authenticity-qa/SKILL.md`.

## Pre-implementation pipeline audit

| App | Owner / action / callback | Time | Insertion and persistence | Existing media |
| --- | --- | --- | --- | --- |
| Messages | App-owned Messages state; `SEND`; `MobileSMSContainer.sendDraft` | Device date/time and elapsed runtime passed through DeviceScreen | Existing ordered `messages`, same conversation and summary; session-local | `attachment: MediaAttachment` already carries selected Camera Roll ID, object URL and filename |
| Facebook | App-owned Facebook state; `SUBMIT_STATUS`; status form submit | ISO derived from canonical simulated runtime plus existing display timestamp | Prepend to existing `feed`; session-local, no repository | Seed `mediaId`/`mediaIds` reference typed historical `FacebookStoryMediaId` registry; those IDs cannot represent player Camera Roll photos |
| Twitter | App-owned Twitter state; `SUBMIT_NEW_TWEET`; New Tweet submit | Device date/time and elapsed runtime | Existing `timeline`, existing selector/detail/actions; local first; separate explicit public intent | Local `TwitterTweet` was text-only; public DTO/submission and frozen snapshot are text-only |

Smallest compatible extension, reported before implementation: optional singular
`attachment?: MediaAttachment` on FacebookFeedItem and TwitterTweet. Consume the
existing selected resource inside each existing reducer. No extra publication
owner, repository, image bytes, Camera Roll, capture, or Camera runtime.

## Facebook

Text, photo-only, and text+photo publish exactly one existing feed record.
Photo records use `kind: photo`; mixed text/photo sequence IDs remain unique.
Identity, friends visibility, canonical timestamp, feed actions, and time format
stay on their existing paths. Successful synchronous reducer insertion clears
text and pending photo and closes the composer. Failed validation changes neither.

The previous composer-area Cancel existed even for text-only status. No target-build
evidence in the audited project validates its placement. The existing Facebook
header already provides Home/back navigation, so the composer-area Cancel is
removed. Navigation/draft retention follows existing reducer behavior. Camera
Cancel and comment composer Cancel are unaffected. Remove Photo preserves text.

The photo renders inside the existing FacebookStoryMedia / feed row, including
normal identity, timestamp, and Like/Comment disclosure. Historical seed media
registry and album navigation are unchanged. The local photo is not assigned a
fake historical album ID or an inert fake photo-viewer button.

Photo upload availability is **CONFIRMED by the supplied project constraint**.
Exact local preview/composer spacing and the selected-photo rendering are
**RECONSTRUCTED**, using existing feed chrome rather than a new card.

## Twitter

New Tweet accepts non-empty text with one photo, retaining the existing required
text rule. Photo-only remains disabled. Text input is still capped at 140 UTF-16
code units; a media attachment deducts no characters. The reducer and Send enabled
state both enforce the existing limit. Exact 2010 service/link character cost is
**HOLD**; no modern t.co rule is inferred.

Send uses the existing local tweet insertion and frozen public-intent text snapshot.
Close / New Tweet / Send remain. Close retains the existing clear-and-return
behavior; Remove Photo preserves the draft. Reply publication is not expanded in
this pass. The existing reply-media guard remains.

One restrained, uncropped, at-most-160px image renders in the existing timeline
row and detail; author/time/reply/retweet/favorite behavior remains. Exact target
client linked/inline image presentation is **RECONSTRUCTED / HOLD**. No native
2011 Twitter photo-hosting claim, media carousel, or expanded card is introduced.

Canonical persistence basis:
`twitter-2010-composer-user-timeline-integration-v0.3.md`,
`twitter-public-visitor-v0.1-p1c-public-handle-flow.md`, and
`twitter-public-visitor-v0.1-p1d-end-of-experience-outro.md`.
Historical Send is session-local. Public submission is a separate explicit,
text-only mock contract; accepted drafts do not enter the approved archive. That
contract and the separate real/simulated timestamps remain unchanged. Local
photos are not uploaded by the optional public text outro and are not durable
public images. Durable public media remains outside this pass.

## SMS/MMS visual audit and treatment

No Balloon_1 or other ChatKit balloon raster is present in the project assets.
`ios4.1-mobilesms-conversation-view-v0.1.md` explicitly classifies existing bubble
rasters, cap insets, tails, gradients and dimensions as HOLD. The available
MobileSMS PhotoButton rasters are camera controls, not balloon assets.

Outgoing MMS now adds `is-mms` to the same outgoing SMS bubble, inherits its
green gradient/border, uses a 3px inset and 10px outer radius, and adds a small
right-side tail. The image uses intrinsic aspect ratio, automatic width/height,
208px maximum width and 240px maximum height. It stays in the existing right-aligned
row within the 320px transcript. No incoming or ordinary text-bubble styles change.
Exact padding, tail, and MMS raster parity are **RECONSTRUCTED / HOLD**.
The outgoing MMS tail silhouette remains visually imperfect and is explicitly
deferred. This checkpoint does not polish the tail or claim visual approval.

Message data, send callback, timestamp, sender, conversation identity, and summary
behavior are unchanged in this pass.

## Ownership and reset

Clearing pending media after successful local publication does not revoke the
object URL or delete the Camera Roll record. The same selected ID/resource is
referenced by the published record. Existing completed lifecycle reset clears
requester drafts, attachments and session-local publications; existing Camera Roll
cleanup policy is unchanged. Public mock/archive rules remain unchanged. Shared
keyboard suspension, Camera ownership/randomization, notification and lifecycle
implementation are untouched.

The six previously named Hero files have no diff against HEAD; nothing was
reverted. Existing Shared Media v0.1 and keyboard regression work was preserved.

## Verification

- `mediaPublishing.test.mjs`: Facebook text/photo-only/caption publication,
  unique IDs, existing renderer, one reference, timestamp/identity, clearing,
  Remove; Twitter text+photo, required text, 140/141 boundary, Close, timeline and
  detail; Messages incoming/text parity, outgoing MMS class/sizing, reset.
- `mediaAttachmentFlow.test.mjs`: actual container callbacks through App state,
  Camera/library, return/cancel, draft retention, publication, shared resources,
  stale capture, same scene, public outro and two reset loops.
- `mediaKeyboardOwnership.test.mjs`: all three requesters and source/camera/library.
- `experienceLifecycle.test.mjs`: two-run lifecycle/reset/resource checks.
- Build, seed validator and diff checks pass; narrow media assertions added
  without removing seed/historical assertions.
- Additional `test:public-twitter` reaches a pre-existing stale source assertion
  at `scripts/validate-public-twitter.mjs:202`: it requires an exact shutdown-only
  guard, but App already has a stronger shutdown/elapsed/lifecycle guard. The same
  regex fails against HEAD and the worktree. Public repository/state checks before
  that assertion pass. No unrelated scheduler or validator change was made.

These are controller, reducer, rendered-markup and style-contract checks, not
Safari hit-testing or pixel verification. Safari WebDriver refused session creation
because Settings → Developer → Allow remote automation is disabled. The browser
skill path supplied by the environment was also absent after local search.
Live Safari Camera/library publication and MMS visual approval remain pending.

QA URL: `http://localhost:5173/hero.html?mediaAttachmentDebug=1` (HTTP 200 verified).


## Track B source record — ab4235d

The following records source-side software evidence. The Hero evidence above is retained; combined Hero validation is separate and is not implied by source passes. Later Flickr/Tumblr evidence supersedes earlier reserved-requester statements.

# Media Publishing v0.2 + SMS/MMS Visual Correction v0.1

Target: October 20, 2010; iPhone 4, iOS 4.1. Uses
`agents/skills/sm2010-visual-authenticity-qa/SKILL.md`.

## Pre-implementation pipeline audit

| App | Owner / action / callback | Time | Insertion and persistence | Existing media |
| --- | --- | --- | --- | --- |
| Messages | App-owned Messages state; `SEND`; `MobileSMSContainer.sendDraft` | Device date/time and elapsed runtime passed through DeviceScreen | Existing ordered `messages`, same conversation and summary; session-local | `attachment: MediaAttachment` already carries selected Camera Roll ID, object URL and filename |
| Facebook | App-owned Facebook state; `SUBMIT_STATUS`; status form submit | ISO derived from canonical simulated runtime plus existing display timestamp | Prepend to existing `feed`; session-local, no repository | Seed `mediaId`/`mediaIds` reference typed historical `FacebookStoryMediaId` registry; those IDs cannot represent player Camera Roll photos |
| Twitter | App-owned Twitter state; `SUBMIT_NEW_TWEET`; New Tweet submit | Device date/time and elapsed runtime | Existing `timeline`, existing selector/detail/actions; local first; separate explicit public intent | Local `TwitterTweet` was text-only; public DTO/submission and frozen snapshot are text-only |

Smallest compatible extension, reported before implementation: optional singular
`attachment?: MediaAttachment` on FacebookFeedItem and TwitterTweet. Consume the
existing selected resource inside each existing reducer. No extra publication
owner, repository, image bytes, Camera Roll, capture, or Camera runtime.

## Facebook

Text, photo-only, and text+photo publish exactly one existing feed record.
Photo records use `kind: photo`; mixed text/photo sequence IDs remain unique.
Identity, friends visibility, canonical timestamp, feed actions, and time format
stay on their existing paths. Successful synchronous reducer insertion clears
text and pending photo and closes the composer. Failed validation changes neither.

The previous composer-area Cancel existed even for text-only status. No target-build
evidence in the audited project validates its placement. The existing Facebook
header already provides Home/back navigation, so the composer-area Cancel is
removed. Navigation/draft retention follows existing reducer behavior. Camera
Cancel and comment composer Cancel are unaffected. Remove Photo preserves text.

The photo renders inside the existing FacebookStoryMedia / feed row, including
normal identity, timestamp, and Like/Comment disclosure. Historical seed media
registry and album navigation are unchanged. The local photo is not assigned a
fake historical album ID or an inert fake photo-viewer button.

Photo upload availability is **CONFIRMED by the supplied project constraint**.
Exact local preview/composer spacing and the selected-photo rendering are
**RECONSTRUCTED**, using existing feed chrome rather than a new card.

## Twitter

New Tweet accepts non-empty text with one photo, retaining the existing required
text rule. Photo-only remains disabled. Text input is still capped at 140 UTF-16
code units; a media attachment deducts no characters. The reducer and Send enabled
state both enforce the existing limit. Exact 2010 service/link character cost is
**HOLD**; no modern t.co rule is inferred.

Send uses the existing local tweet insertion and frozen public-intent text snapshot.
Close / New Tweet / Send remain. Close retains the existing clear-and-return
behavior; Remove Photo preserves the draft. Reply publication is not expanded in
this pass. The existing reply-media guard remains.

One restrained, uncropped, at-most-160px image renders in the existing timeline
row and detail; author/time/reply/retweet/favorite behavior remains. Exact target
client linked/inline image presentation is **RECONSTRUCTED / HOLD**. No native
2011 Twitter photo-hosting claim, media carousel, or expanded card is introduced.

Canonical persistence basis:
`twitter-2010-composer-user-timeline-integration-v0.3.md`,
`twitter-public-visitor-v0.1-p1c-public-handle-flow.md`, and
`twitter-public-visitor-v0.1-p1d-end-of-experience-outro.md`.
Historical Send is session-local. Public submission is a separate explicit,
text-only mock contract; accepted drafts do not enter the approved archive. That
contract and the separate real/simulated timestamps remain unchanged. Local
photos are not uploaded by the optional public text outro and are not durable
public images. Durable public media remains outside this pass.

## SMS/MMS visual audit and treatment

No Balloon_1 or other ChatKit balloon raster is present in the project assets.
`ios4.1-mobilesms-conversation-view-v0.1.md` explicitly classifies existing bubble
rasters, cap insets, tails, gradients and dimensions as HOLD. The available
MobileSMS PhotoButton rasters are camera controls, not balloon assets.

Outgoing MMS now adds `is-mms` to the same outgoing SMS bubble, inherits its
green gradient/border, uses a 3px inset and 10px outer radius, and adds a small
right-side tail. The image uses intrinsic aspect ratio, automatic width/height,
208px maximum width and 240px maximum height. It stays in the existing right-aligned
row within the 320px transcript. No incoming or ordinary text-bubble styles change.
Exact padding, tail, and MMS raster parity are **RECONSTRUCTED / HOLD**.
The outgoing MMS tail silhouette remains visually imperfect and is explicitly
deferred. This checkpoint does not polish the tail or claim visual approval.

Message data, send callback, timestamp, sender, conversation identity, and summary
behavior are unchanged in this pass.

## Ownership and reset

Clearing pending media after successful local publication does not revoke the
object URL or delete the Camera Roll record. The same selected ID/resource is
referenced by the published record. Existing completed lifecycle reset clears
requester drafts, attachments and session-local publications; existing Camera Roll
cleanup policy is unchanged. Public mock/archive rules remain unchanged. Shared
keyboard suspension, Camera ownership/randomization, notification and lifecycle
implementation are untouched.

## Verification

- `mediaPublishing.test.mjs`: Facebook text/photo-only/caption publication,
  unique IDs, existing renderer, one reference, timestamp/identity, clearing,
  Remove; Twitter text+photo, required text, 140/141 boundary, Close, timeline and
  detail; Messages incoming/text parity, outgoing MMS class/sizing, reset.
- `mediaAttachmentFlow.test.mjs`: actual container callbacks through App state,
  Camera/library, return/cancel, draft retention, publication, shared resources,
  stale capture, same scene, public outro and two reset loops.
- `mediaKeyboardOwnership.test.mjs`: all three requesters and source/camera/library.
- `softwareSession.test.mjs`: two-run lifecycle/reset/resource checks.
- Build, seed validator and diff checks pass; narrow media assertions added
  without removing seed/historical assertions.
- `npm run test:public-twitter` passes on the reconciliation branch.

These checks exercise controller, reducer, rendered markup and style contracts.
Manual Safari rendering, hit testing, audio and MMS visual acceptance remain pending.
The local QA server launch was declined during reconciliation, so no HTTP/browser
verification is claimed. Intended URL after starting Vite on port 5174:
`http://localhost:5174/?mediaAttachmentDebug=1&notificationDebug=1`.
