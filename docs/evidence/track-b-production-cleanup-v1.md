# Track B production cleanup v1

Authority: approved production-cleanup brief and subsequent approval to remove the unfinished Tumblr photo together with its sole dependent seeded Like. This is a preservation pass, not new historical feature evidence.

## Narrative cutoff

The scheduler admits finite due times at or before SESSION_DURATION_MS (900000). Events due later are rejected; none are shifted earlier. Delivery is permitted only while elapsed < 900000. At exactly T+900 or later, including a delayed browser resume, no app event is delivered, even if its due time was earlier. Shutdown/outro presentation runs independently. Fixed offsets are unchanged, including Twitter at T+890. There is currently no fixed event exactly at T+900.

Mom's ordinary reply (+30 seconds), Mom's love reply (+20–60 seconds), and the Facebook party invitation (+20–60 seconds) use the same admission guard. If the computed due time exceeds T+900, they never enter the scheduler. Dad's terminal reply retains T+890; it is delivered only before the terminal boundary. A pending Messages intent can remain session-local until reset; it cannot create a late delivery or notification claim. Session reset discards queued events and claims, permitting the next session's fixed events normally.

## Keyboard ownership contract

Inside DeviceScreen / software app UI, text entry belongs to IOS4Input, IOS4Textarea and IOS4KeyboardSystem. The wrapper implementation owns the physical raw controls. The sole raw app exception is Facebook Places' non-text checkbox.

Outside DeviceScreen, exactly two page controls retain browser keyboard ownership: App's Identity input `id="name"` and PublicTwitterOutro's handle input `id="public-twitter-handle"`. This is an explicit project boundary, not permission for arbitrary page/app inputs. The seed validator invokes the recursive device-source ownership check, which rejects additional raw controls, textarea and contentEditable outside the keyboard implementation.

> Supersession: the earlier “Messages Edit is inert” statement below records the cleanup checkpoint only. It is superseded by [Final Interaction Corrections v0.1](final-interaction-corrections-v0.1.md): Edit/Done and conversation Delete are functional.

## Production presentation

Removed engineering copy from Power Off, the Facebook party location and Instagram connections. Instagram retains its heading/count and Back navigation without inventing account rows. The empty/minimal presentation remains RECONSTRUCTED. Messages Edit remains an inert span with button role, aria-disabled, no focus/handler, default cursor and reduced opacity; disabled appearance is RECONSTRUCTED. Two accessibility-only engineering labels were cleaned without enabling their deferred controls.

The unfinished Tumblr photo and its sole seeded Like were removed by explicit approval. Remaining seeds are Evening walk and Quote; the smallhours seeded reblog of Evening walk is unchanged. No replacement content or reassigned relationship was added.

## Public Twitter capability

`publicTwitterPreviewEnabled = import.meta.env.DEV` is the explicit local-preview boundary. Mock archive and submission repositories are constructed only in development. Production loads no mock archive and skips the unsupported publication outro, proceeding through the existing reset. Local Tweets remain session-owned and are not converted into durable visitor records. Development retains the selection/handle/withdraw workflow with neutral preview wording and an explicit statement that the preview is not published to others. DTOs, repository contracts and mock idempotency remain unchanged. A real durable backend/moderation integration remains HOLD and cannot be enabled merely by claiming mock success.

## Deferred polish and acceptance

Tumblr Dashboard display-string parsing remains POLISH. Replacing it properly requires numeric metadata across seed/live/user post construction and ordering tests; this pass leaves historical display dates and publishing contracts unchanged. No HOLD feature was expanded. Final visual/interaction acceptance remains focused manual Safari E2E; automated checks do not establish pixel fidelity.

## Production-leak search classification

Reviewed TS/TSX software renderers and data/state/mail/world sources for HOLD, placeholder, TODO, FIXME, unavailable, not implemented, fixture, debug and DEV. Documentation, evidence, tests and validators are documentation/test-only safe; matching identifiers, comments and provenance metadata are non-rendered safe false positives, not production wording. CSS selectors and asset filenames likewise do not render wording.

Production-visible bugs removed: the four listed engineering/placeholder strings plus Facebook shortcut's HOLD accessibility label and Messages' artwork-unavailable accessibility label. No remaining engineering-copy bug was identified in the reviewed software sources.

Legitimate production text retained: input placeholder attributes (Search/Title/Body/etc.); Photo/Camera Roll/Email unavailable failure states; Profile Info unavailable and Account information unavailable descriptions of intentionally deferred destinations; the ordinary instruction to press and hold Power. These are product/error descriptions, not development leaks. Foursquare To-Dos are historical app terminology, not TODO comments.

DEV-only safe: App development access and QA bridges; NotificationDebug; MediaAttachmentDebug; Camera framing diagnostics; world/video logging and warnings; public mock fixtures behind the new capability boundary.

Non-rendered safe: provenance/status fields and data attributes, avatar/preview placeholder class names and asset imports, fixture component identifiers, HOLD/THRESHOLD constants, internal persistence/renderer errors (mapped by existing UI to error states). No such metadata was deleted.
