# Notification System v1 — October 20, 2010

Status: implemented; automated controller/policy checks pass; manual Safari visual,
gesture and audible-playback QA PENDING. No claim of pixel-exact third-party alerts.
Scope: one shared runtime, 00:02–00:17 America/Los_Angeles. No narrative retiming.

## Historical audit and confidence

Audit findings were reported before app-specific policy implementation. The
sm2010-visual-authenticity-qa preserve-first rule rules out contemporary notification
patterns and treats unknown app capability as HOLD, not permission to invent it.

| App | October capability/evidence | Alert / lock | Badge | Sound | Foreground / opening in v1 |
| --- | --- | --- | --- | --- | --- |
| Messages | Existing recovered iOS 4.1 SMS presentation and audio; retained reference behavior | Existing SMS sheet and single lock preview | Existing incoming unread message IDs | Existing SMS tone | Existing conversation-read behavior; known replies delivered directly while their conversation is visible; opening Messages alone does not clear unread conversations |
| Facebook | Push documented in v3.1, January 2010; directed messages, requests and invitations are supportable | Reuse period alert and lock geometry; exact third-party copy/interaction RECONSTRUCTED | One per unread session notification; clear on app entry, RECONSTRUCTED | Shared default SMS/system tone, RECONSTRUCTED, not an authenticated Facebook tone | Suppress external alert, sound and new badge in foreground; underlying app still updates |
| Twitter | Official native mentions/DM push announced November 16, after the runtime date | Disabled | Zero for current feed events | None | Timeline still updates; no Boxcar/third-party push client invented |
| Instagram | November 27 contemporary walkthrough describes a push permission prompt; does not prove October 20 behavior or post-publication pushes | HOLD / disabled for current photo publication/deletion events | Zero for these events | None | Feed still updates; no fabricated likes/comments/follows |
| Foursquare | Friend check-in push existed in 2009 | Single period alert / lock preview for existing June check-in; enabled friend ping and exact presentation RECONSTRUCTED | HOLD: no count, rather than inventing badge semantics | HOLD: no unverified branded/default tone | Suppress external alert in Foursquare; opening clears pending check-in presentation |

Evidence:

- [Apple, iOS 5 announcement, June 6, 2011](https://www.apple.com/newsroom/2011/06/06New-Version-of-iOS-Includes-Notification-Center-iMessage-Newsstand-Twitter-Integration-Among-200-New-Features/): Notification Center is a later feature. No banners, shade, stacking, grouping, rich cards or inline replies in v1.
- [Facebook 3.1 contemporary release report, January 6, 2010](https://www.macrumors.com/2010/01/06/facebook-iphone-application-gains-push-notifications/): push support before the canonical date. Capability evidence does not establish exact on-device copy, badge clearing, tone or foreground handling; those choices above are reconstruction.
- [Twitter's own announcement, November 16, 2010](https://blog.x.com/official/en_us/a/2010/instant-notifications.html): native iPhone mention/DM push postdates this reconstruction.
- [Foursquare iPhone push report, June 25, 2009](https://techcrunch.com/2009/06/25/foursquare-push-notifications-for-the-ultimate-in-friend-stalking/): check-in push predates October 2010.
- [Contemporary Foursquare account, October 8, 2009](https://thenextweb.com/news/expect-foursquare): corroborates notification availability, not exact badge or tone behavior.
- [Instagram walkthrough, November 27, 2010](https://technicalcafe.com/2010/11/): later push-permission evidence only. October availability remains unresolved, not disproven.
- The [June 2010 iPhone manual announcement](https://www.macrumors.com/2010/06/23/apple-posts-user-guide-for-iphone-4-and-ios-4/) links Apple's old PDF, but that URL now redirects to current support. It was not treated as newly inspected iOS 4 manual evidence.

## Controller, presentation and sound ownership

`App` has one `notificationTransition` reducer. The existing scheduler first updates
the app reducer, then submits an event to `notificationDelivery`. `dueAt` is the
existing event's elapsed milliseconds; displayed timestamps use the canonical clock.
No event offsets, payloads, seeds or historical timestamps changed. Existing
`deliveryPolicy: internal` metadata remains untouched; the explicit notification
policy now classifies directed social events without changing app delivery.

Facebook routes the existing Jack request, Katie message, June message and conditional
party invitation. Status posts, friends' gossip comments and unrelated feed changes
do not notify. The one known `june-night-owl-checkin` is a Foursquare check-in; arbitrary
future activity text is not parsed or assumed to be a push event. All scheduled
Twitter and Instagram candidates explicitly resolve to no notification.

SMS still calls `smsMessageReceived`, which delegates delivery to the shared policy
in App. Its original standalone adapter remains available, but there are no separate
mounted SMS/lock/badge reducers. `SMSAlertOverlay`, LockScreen chrome/slider, and the
Messages reducer are unchanged. Queue projections supply their existing prop types.
View uses the specific SMS conversation target, including Dad, not a default Mom
conversation. Existing SMS-only sleep-to-lock wake is preserved; social notifications
do not wake, boot or reset the phone.

One FIFO alert is visible at a time. Dismiss removes presentation, not unread state;
View opens the existing app runtime. Social lock previews reuse the existing unlock
slider's target routing, not an invented tap-to-unlock/deep-link gesture. No timer
expires alerts: promotion occurs on dismissal/read/open. This finite session queue
does not drop scheduled events to enforce an arbitrary cap. Terminal, asleep/off,
system alerts, keyboard and multitasking block presentation. A pending battery warning
only blocks a lock preview when its system surface is actually displayed; its ownership
and dismissal remain in App. No app alert replaces a battery or power confirmation.

Sounds play once at delivery through `DeviceAudio.notificationReceived("message")`.
The existing registry maps this to recovered iOS 4.1 8B117 `sms-received1.caf`.
Physical mute still gates the sole DeviceAudio playback service. Queued/promoted
alerts, wake and unmute never play deferred sounds. Notifications arriving during a
system alert discard their sound. Camera, keyboard, lock/unlock and battery assets/
semantics are untouched; no new assets or audio playback engine added.

## Badges and reset

All five app counts are derived from shared unread IDs, not JSX constants. Social
badges represent unseen session notifications, not the app's entire historical inbox.
Opening Facebook clears its session badge/pending alerts but does not mark its old
inbox records read. Messages continues to synchronize with its existing read status.

The old unused `Session.badges` field is not used by this system or SpringBoard; it
was not removed as unrelated state-schema cleanup. World-persistent public Twitter
records never create badges. Existing seeded unread Messages history is restored for
each user; “clean reset” means no previous user's session notifications, not deletion
of historically unread seed messages.

The existing completed-reset call to `resetDisposableRuntime` clears queue, dedup
claims, last delivery, suppressed-notification diagnostic and session unread IDs.
No new lifecycle boundary, timer, persistence store, App or DeviceScreen exists.
Mute still resets to ringer through the existing hardware reset-generation contract.

## Verification and manual Safari handoff

- `src/state/notificationState.test.mjs`: background/silent/foreground/lock policies,
  duplicate sound claims, FIFO, system/keyboard/multitasking deferral, badge clear,
  terminal rejection, two resets, no replay, preserved SMS adapter and conversation.
- `src/device/experienceLifecycle.test.mjs`: two actual App-controller loops, existing
  scheduler updates, SMS before social queue, real low-battery priority, keyboard
  deferral, View navigation, same-app June content update without external alert,
  asleep Foursquare delivery without wake, reset/new-user badge baseline, unchanged
  Camera bootstrap/reroll counts and timer cleanup.
- Seed validator keeps all prior content and single-runtime assertions; exact screen
  component ordering adds only `AppNotificationAlert`. New ownership/audio/reset/
  priority checks include four rejecting structural mutations.
- Existing hardware mute/reset, Power, lifecycle, audio, projection, halo/spill tests
  remain regression checks, not substitutes for Safari rendering.
- `npm run build`, `npm run test:seed`, `git diff --check`, the direct notification
  suite and all the listed focused regressions pass. Build retains the existing
  large-chunk advisory.
- Extra `npm run test:public-twitter` fails on its obsolete exact scheduler guard
  regex (`session.phase === "shutdown") return;`). That same assertion fails against
  the pre-change HEAD App source, whose guard also includes terminal elapsed time
  and Hero lifecycle gating. Public Twitter validator/behavior were left untouched.

DEV only: append `?notificationDebug=1` to either simulator or `hero.html`. The read-only
panel shows queue, visible active ID, badges, last delivery/suppressed sound, phase,
foreground app, system/keyboard/multitasking blocks and current hardware audio gate.
It uses App's existing updates and never adds another clock.

Manual Safari remains PENDING for both presenters: fresh user → SMS at T+60 → unlock
and read → Facebook request T+150 / Katie T+155 (Close/View, badges) → June T+270
(repeat with Facebook foreground and another app foreground) → Foursquare T+510.
Check silent visual/badge delivery, return to ringer without replay, future sound,
real 20%/10% warning priority, typing and dismissal, slide coordinates and ScreenPortal
pointer alignment. Complete terminal/recharge/reset and repeat for user two; check
no stale queue/count and ringer gate restored. Third-party exact pixels, per-app
sound assets, Instagram October pushes, Foursquare badge preferences, and granular
Facebook notification deep links remain explicitly deferred.


## Track B source record — ab4235d

The following records source-side software evidence. The Hero evidence above is retained; combined Hero validation is separate and is not implied by source passes. Later Flickr/Tumblr evidence supersedes earlier reserved-requester statements.

# Notification System v1 — October 20, 2010

Status: implemented; automated controller/policy checks pass; manual Safari visual,
gesture and audible-playback QA PENDING. No claim of pixel-exact third-party alerts.
Scope: one shared runtime, 00:02–00:17 America/Los_Angeles. No narrative retiming.

## Historical audit and confidence

Audit findings were reported before app-specific policy implementation. The
sm2010-visual-authenticity-qa preserve-first rule rules out contemporary notification
patterns and treats unknown app capability as HOLD, not permission to invent it.

| App | October capability/evidence | Alert / lock | Badge | Sound | Foreground / opening in v1 |
| --- | --- | --- | --- | --- | --- |
| Messages | Existing recovered iOS 4.1 SMS presentation and audio; retained reference behavior | Existing SMS sheet and single lock preview | Existing incoming unread message IDs | Existing SMS tone | Existing conversation-read behavior; known replies delivered directly while their conversation is visible; opening Messages alone does not clear unread conversations |
| Facebook | Push documented in v3.1, January 2010; directed messages, requests and invitations are supportable | Reuse period alert and lock geometry; exact third-party copy/interaction RECONSTRUCTED | One per unread session notification; clear on app entry, RECONSTRUCTED | Shared default SMS/system tone, RECONSTRUCTED, not an authenticated Facebook tone | Suppress external alert, sound and new badge in foreground; underlying app still updates |
| Twitter | Official native mentions/DM push announced November 16, after the runtime date | Disabled | Zero for current feed events | None | Timeline still updates; no Boxcar/third-party push client invented |
| Instagram | November 27 contemporary walkthrough describes a push permission prompt; does not prove October 20 behavior or post-publication pushes | HOLD / disabled for current photo publication/deletion events | Zero for these events | None | Feed still updates; no fabricated likes/comments/follows |
| Foursquare | Friend check-in push existed in 2009 | Single period alert / lock preview for existing June check-in; enabled friend ping and exact presentation RECONSTRUCTED | HOLD: no count, rather than inventing badge semantics | HOLD: no unverified branded/default tone | Suppress external alert in Foursquare; opening clears pending check-in presentation |

Evidence:

- [Apple, iOS 5 announcement, June 6, 2011](https://www.apple.com/newsroom/2011/06/06New-Version-of-iOS-Includes-Notification-Center-iMessage-Newsstand-Twitter-Integration-Among-200-New-Features/): Notification Center is a later feature. No banners, shade, stacking, grouping, rich cards or inline replies in v1.
- [Facebook 3.1 contemporary release report, January 6, 2010](https://www.macrumors.com/2010/01/06/facebook-iphone-application-gains-push-notifications/): push support before the canonical date. Capability evidence does not establish exact on-device copy, badge clearing, tone or foreground handling; those choices above are reconstruction.
- [Twitter's own announcement, November 16, 2010](https://blog.x.com/official/en_us/a/2010/instant-notifications.html): native iPhone mention/DM push postdates this reconstruction.
- [Foursquare iPhone push report, June 25, 2009](https://techcrunch.com/2009/06/25/foursquare-push-notifications-for-the-ultimate-in-friend-stalking/): check-in push predates October 2010.
- [Contemporary Foursquare account, October 8, 2009](https://thenextweb.com/news/expect-foursquare): corroborates notification availability, not exact badge or tone behavior.
- [Instagram walkthrough, November 27, 2010](https://technicalcafe.com/2010/11/): later push-permission evidence only. October availability remains unresolved, not disproven.
- The [June 2010 iPhone manual announcement](https://www.macrumors.com/2010/06/23/apple-posts-user-guide-for-iphone-4-and-ios-4/) links Apple's old PDF, but that URL now redirects to current support. It was not treated as newly inspected iOS 4 manual evidence.

## Controller, presentation and sound ownership

`App` has one `notificationTransition` reducer. The existing scheduler first updates
the app reducer, then submits an event to `notificationDelivery`. `dueAt` is the
existing event's elapsed milliseconds; displayed timestamps use the canonical clock.
No event offsets, payloads, seeds or historical timestamps changed. Existing
`deliveryPolicy: internal` metadata remains untouched; the explicit notification
policy now classifies directed social events without changing app delivery.

Facebook routes the existing Jack request, Katie message, June message and conditional
party invitation. Status posts, friends' gossip comments and unrelated feed changes
do not notify. The one known `june-night-owl-checkin` is a Foursquare check-in; arbitrary
future activity text is not parsed or assumed to be a push event. All scheduled
Twitter and Instagram candidates explicitly resolve to no notification.

SMS still calls `smsMessageReceived`, which delegates delivery to the shared policy
in App. Its original standalone adapter remains available, but there are no separate
mounted SMS/lock/badge reducers. `SMSAlertOverlay`, LockScreen chrome/slider, and the
Messages reducer are unchanged. Queue projections supply their existing prop types.
View uses the specific SMS conversation target, including Dad, not a default Mom
conversation. Existing SMS-only sleep-to-lock wake is preserved; social notifications
do not wake, boot or reset the phone.

One FIFO alert is visible at a time. Dismiss removes presentation, not unread state;
View opens the existing app runtime. Social lock previews reuse the existing unlock
slider's target routing, not an invented tap-to-unlock/deep-link gesture. No timer
expires alerts: promotion occurs on dismissal/read/open. This finite session queue
does not drop scheduled events to enforce an arbitrary cap. Terminal, asleep/off,
system alerts, keyboard and multitasking block presentation. A pending battery warning
only blocks a lock preview when its system surface is actually displayed; its ownership
and dismissal remain in App. No app alert replaces a battery or power confirmation.

Sounds play once at delivery through `DeviceAudio.notificationReceived("message")`.
The existing registry maps this to recovered iOS 4.1 8B117 `sms-received1.caf`.
The software audio mode gates the sole DeviceAudio playback service. Queued/promoted
alerts, wake and unmute never play deferred sounds. Notifications arriving during a
system alert discard their sound. Camera, keyboard, lock/unlock and battery assets/
semantics are untouched; no new assets or audio playback engine added.

## Badges and reset

All five app counts are derived from shared unread IDs, not JSX constants. Social
badges represent unseen session notifications, not the app's entire historical inbox.
Opening Facebook clears its session badge/pending alerts but does not mark its old
inbox records read. Messages continues to synchronize with its existing read status.

The old unused `Session.badges` field is not used by this system or SpringBoard; it
was not removed as unrelated state-schema cleanup. World-persistent public Twitter
records never create badges. Existing seeded unread Messages history is restored for
each user; “clean reset” means no previous user's session notifications, not deletion
of historically unread seed messages.

The existing completed-reset call to `resetDisposableRuntime` clears queue, dedup
claims, last delivery, suppressed-notification diagnostic and session unread IDs.
No new lifecycle boundary, timer, persistence store, App or DeviceScreen exists.
Mute still resets to ringer through the existing runtime reset-generation contract.

## Software reconciliation verification

The normal App owns notification delivery, queue, claims and session-local badges.
`softwareSession.test.mjs` exercises two software name/boot/power-off loops, lock
presentation, FIFO, low battery priority, keyboard deferral, foreground suppression,
Foursquare delivery, reset, Camera bootstrap counts and timer cleanup.
`notificationState.test.mjs` covers policy and DeviceAudio-only sound, including mute
and no replay. The validator retains main's content checks and adds notification
ownership, priority, reset and audio checks with rejecting mutations.

Audio defaults to ringer. DeviceAudio.setMuted or bindAudioMode controls the runtime
gate; audioModeChanged suppresses active sound after an external mode change.
DEV diagnostics: `?notificationDebug=1`. Safari visual/audio verification is pending.
Exact third-party pixels, per-app sounds, Instagram October push, Foursquare badge
preferences and granular Facebook deep links remain HOLD.
