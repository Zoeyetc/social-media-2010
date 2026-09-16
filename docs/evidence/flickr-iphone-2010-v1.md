# Flickr for iPhone — October 20, 2010

## Version and evidence lock (before implementation)

Target: official Yahoo/Flickr iPhone **1.2**, US English, iPhone 4/iOS 4.1; **EVIDENCE-BACKED BEST FIT / PROBABLE**. Contemporary coverage establishes availability by July 16, 2010, requiring iPhone OS 3.0. Exact App Store release timestamp and any intervening patch number have not been recovered. No later pre-October release was established. This is not proof that none existed.

| Source | Date | Evidence and limits |
| --- | --- | --- |
| [Flickr launch announcement](https://blog.flickr.net/en/2009/09/10/the-new-flickr-iphone-app/) | 2009-09-10 | Primary: native app, contacts' photos, Ken Burns landing slideshow, own photostream/activity and photo upload. |
| [Search Engine Land review](https://searchengineland.com/flickr-now-has-an-iphone-app-25374) | 2009-09-08 | Contemporary native-app screenshots: landing, search scopes, You, detail, comments, Recent, source chooser. These are launch-version captures; continuity into 1.2 is PROBABLE, not October pixel proof. |
| [Macworld review](https://www.macworld.com/article/200017/flickr_iphone.html) | 2009-09-08 | Sets/tags browsing and upload tags, description and current location; exact upload form not recovered. |
| [MacMagazine 1.2 report](https://macmagazine.com.br/post/2010/07/16/flickr-para-ios-chega-a-versao-1-2-portal-ganha-integracao-com-facebook/) | 2010-07-16 | Version 1.2, iOS 4 background upload/fast switching, HD video, Twitter links, fullscreen and recent-search changes. |
| [iPhoneFAQ 1.2 report](https://www.iphonefaq.org/archives/971002) | 2010-07-17 | Upload-processing count on SpringBoard icon; no Retina artwork yet. Badge is upload progress, not unread activity. Exact artwork/count timing PROBABLE. |
| [WebProNews](https://www.webpronews.com/flickr-updates-iphone-app-to-utilize-ios-4-capabilities-adds-twitter-sharing/) | 2010-07-22 | Direct representative statements support state restoration, background uploads, flic.kr sharing and detail-image tap to fullscreen; swiping hides controls. |
| [Macgasm](https://news.macgasm.net/iphone-news/flickr-iphone-app-updated-community-support/) | 2010-07-19 | Contemporary criticism of limited community/Groups support. Full Groups excluded. |
| [TechCrunch launch coverage](https://techcrunch.com/2009/09/08/flickr-finally-officially-enters-the-iphone-app-space/) | 2009-09-08 | Upload privacy settings mentioned; precise mobile controls unresolved. |
| [2012 official redesign](https://blog.flickr.net/en/2012/12/12/our-latest-flickr-iphone-app/) | 2012-12-12 | Negative boundary only, never used to reconstruct 2010 chrome. |

The Web Design Museum 2010 gallery and archived App Store entry were located but could not be inspected (403/cache failure); neither is treated as visual proof. Search snippets were not used for exact geometry.

## Inspected visual references and navigation lock

Coordinates below include the historical 20-point status bar; software content must subtract 20 and reuse the shared StatusBar. Screenshots are references, not in-app assets. Color/geometry readings are approximate, not a pixel-accuracy claim.

| Screen / classification | Direct inspected reference | Geometry / chrome |
| --- | --- | --- |
| Landing — VERIFIED 2009 / PROBABLE 1.2 | [landing](https://live.staticflickr.com/2627/3900461324_e7995525f3.jpg) | 320×480; silver navigation y20–64, blue/pink wordmark centered, info left/upload right; search y64–101; slideshow y101–439; three silver buttons Recent/You/Contacts y439–480. Bottom navigation belongs to landing only. |
| You — PARTIALLY VERIFIED | [You](https://live.staticflickr.com/3451/3900461940_c125e9354a.jpg) | 44pt silver nav, back left, greeting center, grid/list right; Sets & Tags and Favorites tiles x8/167 y72–138; four-column ~76pt square grid with ~4pt gutters. |
| Detail — PARTIALLY VERIFIED | [detail](https://live.staticflickr.com/2520/3899680805_0c19810a08.jpg) | Ordinal nav title; image x5 y69 width310 preserving aspect; title ~24pt, blue owner ~13pt, description14, gray date11, privacy line, tags; separate bottom44pt toolbar with share/previous/next/comment. |
| Search — PARTIALLY VERIFIED | [search](https://live.staticflickr.com/2604/3899714859_5b440eee60.jpg) | Wordmark/Cancel; rounded search row; dark scope menu (All Uploads, From Your Contacts, Your Photostream); recent-query rows; period keyboard. Search results exact layout RECONSTRUCTED. |
| Recent Activity — PARTIALLY VERIFIED | [activity](https://live.staticflickr.com/2585/3900461540_b6132bf391.jpg) | Back and Activity/Uploads segmented nav; photo-title groups then comment/favorite rows. No invented seeded activity. |
| Recent Uploads — PARTIALLY VERIFIED | [official capture](https://live.staticflickr.com/2439/3906657841_12a5062bbc.jpg) | Official image333×500; grouped date headings, rows of three thumbnails and count. Scale geometry to320. |
| Comment — PARTIALLY VERIFIED | [comment](https://live.staticflickr.com/2620/3899681053_4a7da63f1d.jpg) | Cancel/Comment/Post bar; charcoal body; white rounded text area x20 y84 w280 h151; shared keyboard begins264 in reference. |
| Upload source — VERIFIED 2009 / PROBABLE 1.2 | [source chooser](https://live.staticflickr.com/2455/3899682003_46150b37c3.jpg) | Dimmed landing, bottom native gradient action sheet starting~270; two light43pt buttons and black Cancel. Historical label includes video; photo-only narrative may shorten it. |
| Upload metadata — RECONSTRUCTED / unresolved controls HOLD | No inspected metadata-form capture | Description/tags/location capability supported; exact arrangement, title/privacy/set/Twitter controls not verified. No modern share sheet or web uploader fields. |
| Fullscreen — PARTIALLY VERIFIED | 1.2 representative description above | Tap detail photo, swipe previous/next hides controls. Exact chrome reconstructed conservatively. |
| Contacts/sets/tags — PARTIALLY VERIFIED | Review and You/detail captures above | Stack navigation into photos; exact subsidiary lists reconstructed. No permanent modern tab bar. |
| Account/login — HOLD | Landing info control visible | No authentication network or invented biography. |

## Repository and canonical content audit

Baseline main b21cb163e0af0fe6be814d832bd2ebb414a0a08e; initially clean. Four reconciliation commits remain intact. Hero worktree is out of scope.

Flickr is registered once on SpringBoard using existing 57×57 historical icon. App owns one Flickr reducer and resets it through the shared software reset path; Home retains reducer state. DeviceScreen is presentation-only and owns the shared StatusBar/IOS4KeyboardSystem. Current FlickrContainer is HOLD gray chrome/checkerboard placeholders. Existing reducer tests lock comments, favorites, scroll restoration, set back-navigation and reset; preserve those semantics when replacing placeholder IDs.

Legacy SESSION_SEED_CONTENT.flickr contains flickr.demo photos without actual assets. They must not be relabeled as character photographs. Preserve the frozen legacy fixture as an archive; new runtime photo references must have distinct IDs.

The [canonical social-world matrix](../design/social-world-content-matrix-v0.1.md), sections6–7, explicitly permits shared character photos in Flickr: Alex's two dog photos and Jay's guitar/band photos are the minimal relevant inventory. sharedCharacterMedia stores original platform/provenance and currently enumerated uses; the matrix expressly says these are not Facebook-only. Do not mutate or duplicate the assets. Preserve the shared IDs and canonical dates, including 10-18.JPG's registered October19 timestamp rather than deriving a date from its filename. No new biography, dog identity, attendance, seeded comment/favorite counts, or social event is authorized by asset reuse.

The user's Flickr handle and prior photostream are undefined: session display name only, initially empty own photostream. Shared Media already reserves requester=flickr, but App currently rejects it. Camera/Camera Roll/session selection must be reused; no second camera/world/runtime. One pending attachment becomes a photo only on explicit Upload. Taken time comes from the selected Camera Roll record; upload time from the canonical simulated device clock. Resource ID/object URL stay unchanged.

## Implementation decisions and limits

- Preserve 320×480 logical device geometry, including the existing status bar. No 640×960 CSS redesign or modern Retina reinterpretation.
- Upload metadata/source chrome may only be a labeled conservative reconstruction; unverified optional controls remain HOLD.
- Twitter sharing is a verified 1.2 capability but its control/copy is HOLD for this implementation. Do not route it through native Twitter photo publishing.
- HD video is VERIFIED CAPABILITY / NOT IMPLEMENTED IN CURRENT NARRATIVE.
- Push audit: no reliable contemporary proof recovered for comments, favorites, contacts, activity, or completion push. NO EVIDENCE/HOLD; Flickr must remain absent from Notification System v1. In-app activity and processing badge are separate.
- Full Groups, filters/editor, automatic Camera Roll upload, modern Albums/community/search/share sheets, modern notification surfaces and 2012 redesign are excluded.
- Session-created uploads/comments/favorites/drafts/search/upload jobs follow Track B's same-session publication convention; reset clears them, preserves historical assets, and cancels return targets through existing shared reset ownership. No new cross-loop persistence.

## Verification status

Audit complete; implementation and regression/visual verification pending. No production UI has been changed at this checkpoint. Safari computer control was unavailable (Computer Use permissions not granted); no manual Safari pass is claimed. A build alone will not be reported as visual QA.


## Implementation mapping and final decisions

| Area | Implemented behavior | Classification / limit |
| --- | --- | --- |
| Landing | Wordmark, search, contact-photo slideshow, Recent/You/Contacts landing buttons | PROBABLE 1.2 structure; local CSS wordmark/icons and deterministic eight-second slideshow are RECONSTRUCTED. No photo bytes copied. |
| Contacts / Recent | Alex and Jay photostreams; dated thumbnail groups | Character distribution supported by canonical matrix. Exact contacts rows and grouped spacing RECONSTRUCTED. |
| You | Session display name, initially empty own photostream, four-column grid/list, Sets & Tags / Favorites | No invented username or biography. Own grid contains completed session uploads only. |
| Detail | Asset, descriptive title, owner, dates, description, privacy text, tags, favorite/comments; previous/next | No fabricated views or social counters. Favorite placement and date layout RECONSTRUCTED. Email toolbar action disabled/HOLD; no external message sending. |
| Fullscreen | Detail-image tap, horizontal pointer swipe, controls hide after advancing, tap restores controls, Done | Semantics supported by 1.2 report; exact chrome RECONSTRUCTED. Existing shared status bar remains. No pinch controls. |
| Search | All Uploads / From Your Contacts / Your Photostream; deterministic title/description/tag/owner matching, recent queries and clear | Scope labels verified in capture. Result grid and clear-button placement RECONSTRUCTED. No people/semantic/location search. |
| Sets / Tags | Read-only Sets, set-photo/back navigation, metadata tag lists and matching photos | Two small narrative Sets: Jay/Music and Alex/Dogs. Membership follows asset context, not an independently canonical historical set record. Titles/tags/membership explicitly RECONSTRUCTED. No set creation or Albums terminology. |
| Recent Activity | Only comments actually created in this session on the user's own uploads | Empty initially. Does not invent incoming social events or treat your favorites on someone else's photos as activity on your own stream. |
| Comments / Favorites | Local view/post, favorite/unfavorite, shared reducer | [Macgasm's September11,2009 native-app review](https://news.macgasm.net/miscellaneous-news/finally-flickr-reviewed/) explicitly describes star/comment functionality; full article retrieved and inspected. Favorites on other owners are not fabricated. Comment entry uses the inspected charcoal composer and shared keyboard. |
| Upload | Existing shared source chooser → Camera or Camera Roll → pending attachment → description/tags/fake-location → Upload → one own-photo record | Source buttons supported by screenshot; video label shortened to Take Photo for photo-only narrative. Metadata arrangement RECONSTRUCTED. Title uses original filename. Privacy selector, set destination and Twitter control HOLD; fixed private publication is an explicit simulation decision, not a claim about historical defaults. |
| Location | Optional metadata reference to SM2010_SESSION_PLAYER_MAP_POINT | Fake local coordinate system only. No real geolocation, map API or invented street/venue. Exact toggle chrome RECONSTRUCTED. |
| Upload timing | Three-second local job, completed using App's existing elapsed clock | Delay is simulation, not historical network timing. Canonical completion timestamp stored separately from Camera capture time; duplicate click/effect replay cannot create another publication. |
| Background / badge | Job survives Home/another app; one processing-count badge clears on completion | Badge derives directly from Flickr upload state, outside Notification System v1. No completion alert or sound. State owner remains in App, no extra timer. |
| Reset | Existing reset removes pending/job/navigation/search/comment/favorite/live-photo state | Same-session only, consistent with other Track B publications. Legacy frozen fixtures, canonical shared media, historical Camera Roll assets and public Twitter policy remain unchanged. |

### Photo inventory

Every runtime photo ID is prefixed `flickr:`; each mediaId is the existing shared ID below. Original files are referenced, never copied. Owner IDs come from sharedCharacterMedia. Titles/tags and cross-post placement are sparse narrative reconstruction. Dates preserve the shared catalog; reusing that date as both taken/uploaded is an explicit inference, not independently evidenced Flickr publication history. Descriptions and seeded comments/favorites are empty; public visibility is reconstructed for this contact-photo slice and does not alter other apps' privacy rules.

| Shared mediaId | Owner | Display title | Canonical date | Set / tag |
| --- | --- | --- | --- | --- |
| jay-band-performance | Jay | Band | 2010-10-19T22:00:00-07:00 | Music / music |
| jay-guitar | Jay | Guitar | 2010-10-17T21:12:00-07:00 | Music / music |
| jay-guitar-may | Jay | Guitar | 2010-05-15T18:00:00-07:00 | Music / music |
| alex-dogs-wangcai-bb-2009 | Alex | Dogs | 2009-05-08T16:00:00-07:00 | Dogs / dogs |
| alex-dog-golden-2007 | Alex | Dog | 2007-10-03T16:00:00-07:00 | Dogs / dogs |

The old flickr.demo IDs/titles/comment fixture remain unchanged in sessionSeedContent, but no longer feed the production Flickr reducer. No legacy placeholder ID has been reassigned to character media.

### File scope

- `src/data/flickrContent.ts`: version lock, shared photo references, two sparse reconstructed Sets.
- `src/state/flickrState.ts`: existing single reducer extended with browsing, search, pending publication and upload job; shared canonical clock/geography.
- `src/device/FlickrContainer.tsx`, `src/styles/flickr.css`: period screen reconstruction; old Flickr-only rules removed from `src/styles/device.css`.
- `src/device/App.tsx`: activate reserved Flickr requester, return shared media with capture time, advance upload on existing elapsed clock.
- `src/device/DeviceScreen.tsx`: presentation props and independent badge count.
- `src/device/MediaAttachmentPresentation.tsx`: Flickr-specific source-sheet presentation; other requesters retain their existing chooser.
- `src/device/SpringBoard.tsx`: optional Flickr processing count; no notification-policy changes.
- `src/state/flickrState.test.mjs`: focused state and server-rendered screen checks.
- `src/device/mediaAttachmentFlow.test.mjs`: add Flickr A–L/background/Home/Power/badge/reset scenarios to real App-controller harness, retaining previous assertions.
- `src/device/mediaKeyboardOwnership.test.mjs`: add Flickr search/comment/metadata IDs to real keyboard binding/suspension tests.
- `scripts/validate-seed-content.mjs`: Flickr-only replacement of placeholder expectations; preserve semantic favorite/comment/scroll/set/reset tests and legacy seed immutability check; add version, shared ownership/media/clock/reset/badge and negative UI assertions.

### Visual QA status

The screen/reference table above records measurements for every major implemented surface. Server rendering exercised landing, contacts, Recent, Activity, own/character streams, detail, fullscreen, sets, tags, search, comments and upload. This checks markup/state, not browser paint, hit testing or gestures. CSS uses 320 logical points, 44pt navigation/detail toolbar, 41pt landing buttons, 76pt grid tiles, 310pt detail image, and 280×151 comment entry. Raster historical screens are not shipped inside the app.

Manual Safari is **PENDING/BLOCKED**: attempts to select native Safari returned “Computer Use permissions are not granted”; no browser connector was available. Do not treat this implementation as visually signed off. All thirty user-requested Safari steps remain to be run on software main; earlier reconciliation Safari approval does not cover Flickr.


### Final automated results

| Check | Result |
| --- | --- |
| npm run build | PASS after final presentation change; existing large-chunk advisory remains. No new dependencies. |
| npm run test:seed | PASS, including DeviceScreen/software invariants, historical content, timeline and notification assertions. A new assertion initially used the wrong Vite variable name; corrected and rerun successfully. |
| src/state/flickrState.test.mjs | PASS: canonical asset IDs/dates, browse/SSR, scopes/recent clear, fullscreen/order, sets/tags, comments/favorites, draft/cancel, idempotent upload, canonical timing/fake location, terminal guard, stale session/reset. |
| src/device/mediaAttachmentFlow.test.mjs | PASS: Flickr A–L, actual App controller and source/upload control callbacks, capture/library/return, no premature publication, duplicate click, background completion, badge clearing, resource identity, Home/Power/search retention, same Camera scene and two resets. All existing Messages/Facebook/Twitter assertions retained and passing. |
| src/device/mediaKeyboardOwnership.test.mjs | PASS: six input IDs × three media stages × two loops; actual binding blur/suspension, no reacquisition, caret/draft retention, queued-focus cancellation. |
| src/device/mediaPublishing.test.mjs | PASS: existing Facebook/Twitter/MMS publication behavior. |
| src/device/softwareFoundation.test.mjs | PASS: session resource deduplication, canonical clock and Foursquare relative time. |
| src/device/softwareSession.test.mjs | PASS: actual App lifecycle, Camera selection/bootstrap, sleep/wake, timer cleanup and two resets. |
| src/state/notificationState.test.mjs | PASS: A–J twice; Flickr not registered for push. |
| src/audio/deviceAudio.test.mjs | PASS: audio gates, silence, no replay and software fallback. |
| npm run test:public-twitter | PASS. |
| git diff --check | PASS. |
| Forbidden paths/imports | PASS: no src/hero, src/assets/hero, scripts/blender, hero.html or Three/R3F production imports. Dependency manifests unchanged. |

QA server: **http://127.0.0.1:5175/**, served from the software main repository. Use the normal experience → power/boot/unlock → SpringBoard → Flickr sequence. Optional existing development entry: http://127.0.0.1:5175/?devApp=flickr&autoOpen=1 . Safari pixels, touch/gesture hit testing, clipping and all thirty manual steps remain unverified because Computer Use permissions are unavailable.

Final Git scope: 10 modified tracked files plus four new files (14 total); all listed above including this report. No commit or push. Local main HEAD remains b21cb163e0af0fe6be814d832bd2ebb414a0a08e; ec9ddc3, f2e612b, dc9ed9e and b21cb16 remain ancestors. Hero worktree stays clean at db3ace920aa6080f6d860030d91f5fd7572af8f7. Tumblr was not implemented or changed.


## Flickr Email Photo v0.1 — implementation, pending live/Safari acceptance

This section supersedes the earlier Email-action HOLD only for the newly requested mail implementation. It does not confer visual or live-delivery approval on this feature.

### Historical classification and reference audit

- **FACT:** Flickr supported emailing photos at launch. See the existing dated launch evidence above, including [September 8, 2009 launch coverage](https://searchengineland.com/flickr-now-has-an-iphone-app-25374) and the launch photo-detail capture.
- **EVIDENCE-BACKED INFERENCE:** the leftmost curved arrow is Email photo in the October 2010 Flickr 1.2 reconstruction, as locked by the user. Previous, Next and Comment keep their existing handlers; Next is not Play.
- **RECONSTRUCTED:** direct arrow → composer, immediate discard on Cancel before sending, exact layout/chrome/disabled treatment, default subject and signature. No verified Flickr 1.2 intermediate action sheet or exact outgoing subject was located.
- Existing project references were audited; no canonical iOS 4.1 Mail compose screenshot or Mail chrome asset was found. Apple's **WWDC 2009 session 104**, Chris Parker, documents in-app Mail composition, predefined recipients/subject/body and attachments: [archived Apple talk transcript](https://nonstrict.eu/wwdcindex/wwdc2009/104/). This supports period availability and general structure, not pixel equivalence. The archive warns of transcription errors; original video was not inspected.
- A guide mirrored under a June 2010 URL was downloaded and inspected: its cover says **iOS 4.2**. It was explicitly excluded as October 2010 / iOS 4.1 visual proof. Later iOS image-search results were also excluded.
- **PRODUCT-LAYER ADDITION:** real server delivery and the SOCIAL MEDIA, 2010 memorial note. Neither is presented as Flickr's historical infrastructure or wording.

### Composer and preserved behavior

The local composer occupies the existing 320×480 software experience, below its shared StatusBar. It has a 44pt blue-gray gradient navigation bar (Cancel / New Message / Send), white compact To/Subject rows, a message field, aspect-preserving photo preview and subordinate note. All three fields use IOS4KeyboardSystem controls; no second StatusBar, native email input, mailto, modern modal or share menu was added.

Recipient starts empty; subject is `A photo from Flickr`; editable message starts empty. `Sent from Flickr for iPhone` is appended to the outgoing text, then the product note, once. With configured Reply-To the exact note is:

```text
—
Sent from SOCIAL MEDIA, 2010

This message was created during an interactive reconstruction of social media in 2010.

If you have feedback, you’re welcome to reply to this email.
```

Without Reply-To, the final sentence is `Replies to this email are not monitored.` Configuration controls both preview and server formatting; the server owns the actual envelope and final note.

Mail composition lives in a volatile controller owned by App, separate from Flickr/session/public content. Open captures the current photo's existing ID/mediaId/source. Cancel before sending, success and canonical session reset erase private draft state. Home/sleep can retain the draft within the same experience. Reset aborts browser work and ignores stale completions; it cannot recall an email already accepted by a provider. Cancel is disabled while sending for that reason. Failure retains the draft; once dispatched its content is frozen so Retry reuses the same request ID and exact bytes. Cancel after failure discards it. Provider acceptance closes the composer to the same Flickr detail; acceptance is not proof of inbox receipt.

Previous/Next/Comment, browsing, upload/background upload, historical/photo state, Camera Roll, notifications, other apps, the master clock and Hero/Blender are unchanged by this pass.

### Backend and deployment contract

The repository had a static Vite application and no existing mail backend, provider integration or deployment configuration. v0.1 adds an isolated **Node 24+** HTTP service with an injected `sendMemorialEmail` transport. The UI knows only `/api/flickr-mail/config` and `/api/flickr-mail`. The initial real adapter uses Resend's server REST API; no provider SDK or client dependency was added. Current API and idempotency contract: [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

Production mode requires real configuration and fails closed when absent. Mock mode reports `accepted: false, mode: mock`; the composer explicitly says no real email was sent. Mock is forbidden with NODE_ENV=production and the CLI permits it only on loopback. Automated tests inject mock functions and never send external email.

`.env.mail.example` lists server-only variables:

| Variable | Purpose |
| --- | --- |
| MAIL_TRANSPORT | `real` (default) or local `mock` |
| MAIL_PROVIDER | `resend`; replace the isolated adapter if another provider is chosen |
| MAIL_API_KEY | Secret provider key; never VITE-prefixed |
| MAIL_FROM | Verified project-owned bare email address; actual From is `SOCIAL MEDIA, 2010 <address>` |
| MAIL_REPLY_TO | Optional real project feedback inbox; never client-controlled |
| MAIL_RECIPIENT_ALLOWLIST | **Required closed-pilot recipient addresses**, comma separated; one recipient per message |
| MAIL_LIMIT_SECRET | Random stable server secret, at least 32 characters |
| MAIL_ORIGIN | Exact public application origin; localhost default is `http://127.0.0.1:5175` |
| MAIL_HOST / MAIL_PORT | Bind address / port; defaults 127.0.0.1 / 8788 |

There are no real credentials, verified sender, deployment host or approved recipient configured by this task. The required recipient allowlist deliberately limits v0.1 to a closed delivery pilot. Arbitrary public visitor recipients are **not enabled**; a broader public rollout needs an explicit abuse-control/deployment decision.

Local setup: provide server variables through environment or ignored `.env.mail`, run `node --env-file=.env.mail server/flickrMailServer.mjs`, and run Vite on port 5175. The Vite proxy forwards only the Flickr mail API to port 8788. With exported environment, `npm run mail:serve` also works. For deployment, build first and run the Node service under Node 24+ with NODE_ENV=production, persistent server secret, verified sender, approved recipient and HTTPS termination; it can serve dist and the API on one origin. Existing static-only hosting needs this Node service or a host-specific API adapter; deployment cannot be finalized without the chosen host. No deployment was performed.

### Attachment, privacy and abuse controls

The browser reads the exact selected same-origin project image or same-origin Camera Roll blob. It does not resize, recapture, generate a media ID or copy Camera Roll state. Original bytes become one JPEG/PNG attachment, capped at 6 MiB. The server accepts bounded base64 bytes plus the existing media reference; it never fetches client attachment URLs. Validation rejects unknown payload/image fields (including From, Reply-To, HTML, headers or URL overrides), multiple recipients, malformed addresses, subject/header injection, subject over 160 characters, body over 4000 characters, invalid image signatures and oversized requests. Submitted message text is sent as plain text, never interpreted as HTML.

The service keeps no recipient/body/image database, analytics or address logs. Recipient and attachment data necessarily pass to the configured provider for delivery; provider retention is governed by its account policy, not erased by local reset. Only HMAC quota/fingerprint/idempotency values and small delivery results are cached in the server after in-flight work settles. Client state is never written to Flickr records, shared Session content or browser persistence.

Limits: three new messages per session per hour, six per socket IP per hour, thirty globally per hour, and thirty attempts per IP per hour including invalid payloads. Exact-origin checks supplement these limits; Origin and client session IDs are not authentication, hence the mandatory closed recipient list. Client-supplied forwarding headers are not trusted. Reverse-proxied clients conservatively share the proxy IP quota unless a trusted deployment adapter is added.

Concurrent duplicate IDs share one promise. Failed retries reuse the provider idempotency key and immutable payload; changed content under the same ID is rejected. Server result/fingerprint cache lasts 23 hours; Resend documents a 24-hour provider idempotency window. Quotas and result cache are **single-process/in-memory** and reset on restart. Stable MAIL_LIMIT_SECRET preserves provider idempotency keys across restart. Multi-instance/durable public quota storage is outside this closed-pilot implementation.

### Exact files changed by the mail pass

Modified existing files (preserving previous Flickr changes):

- `.gitignore`
- `package.json` (scripts only; dependencies unchanged)
- `vite.config.ts`
- `src/device/App.tsx`
- `src/device/DeviceScreen.tsx`
- `src/device/FlickrContainer.tsx`
- `docs/evidence/flickr-iphone-2010-v1.md`

Added:

- `.env.mail.example`
- `server/flickrMail.mjs`
- `server/flickrMailServer.mjs`
- `server/flickrMail.test.mjs`
- `src/mail/flickrMailContract.ts`
- `src/mail/flickrMailController.ts`
- `src/mail/flickrMailController.test.mjs`
- `src/device/FlickrMailComposer.tsx`
- `src/styles/flickrMail.css`

### Verification and remaining acceptance

- PASS: `npm run build` (existing large-bundle advisory only).
- PASS: `npm run test:flickr-mail`: A–N controller/SSR/transport checks, exact-byte attachment handling, safe mock failure, API validation, rate limits, provider envelope, footer once, duplicate/concurrent/retry idempotency and HTTP boundary. These are automated state/markup checks, not a claim of Safari hit testing.
- PASS: `npm run test:seed`; existing Flickr suite; media attachment flow, keyboard ownership, publishing, software foundation/Foursquare time, software session/Camera reset, notification and audio suites; public Twitter validation; `git diff --check`.
- **Safari QA BLOCKED:** the current attempt to access Safari returned `Computer Use permissions are not granted`. No composer pixels, field switching, keyboard clipping, scroll or manual failure flow have been signed off. All user-requested Safari steps remain pending.
- **Real delivery NOT TESTED:** no real recipient/provider/sender credentials were supplied. No live message sent, no inbox/attachment receipt confirmed and no reply tested. The real transport code is integrated but the requested stop condition is not yet met.
- No commit, push or deployment. Existing uncommitted Flickr work preserved. Hero untouched.

To finish acceptance: configure the provider/verified project sender, optional feedback Reply-To, approved test recipient and deployment origin/host; enable Safari access; perform the user's complete manual flow including actual receipt and attachment opening. Keep API keys out of chat and client variables.


## Flickr for iPhone 2010 v1 checkpoint acceptance

This checkpoint records the user's accepted Flickr v1 scope. It supersedes the earlier real-delivery NOT TESTED status above: **the user manually verified the real mail chain using Resend's test sender**. No additional live email was sent during checkpoint preparation.

The current test sender, `onboarding@resend.dev`, is limited to the Resend account-associated recipient, as confirmed by the user's acceptance note. Production arbitrary-recipient delivery remains deferred until a verified Resend domain is configured. The backend's existing closed recipient allowlist also remains enforced; domain verification alone does not remove it.

Manual Safari status: the user has confirmed the real mail chain, but has not explicitly supplied a complete Flickr Safari visual/interaction sign-off. Earlier agent Safari automation was blocked by missing Computer Use permissions. This checkpoint does not claim an additional full Safari QA pass.

Preserved HOLDs (none implemented as part of committing):

- Exact Flickr account controls.
- Privacy selector.
- Exact historical intermediate transition for Email (current direct composer entry remains RECONSTRUCTED).
- Flickr → Twitter sharing UI.
- Exact subsidiary Flickr UI details.
- Video upload capability (not implemented).
- Flickr push notifications (not implemented).
- Exact MMS tail fidelity, unrelated to Flickr.
- Production arbitrary-recipient mail delivery pending a verified domain and deployment/allowlist decision.

Checkpoint preparation changes only documentation and clears the API-key/limit-secret values from the example template. The private `.env.mail` remains ignored and excluded. No feature behavior, Tumblr, Hero/Blender, or unrelated app behavior is added by this checkpoint.
