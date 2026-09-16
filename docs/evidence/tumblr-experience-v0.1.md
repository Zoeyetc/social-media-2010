# Tumblr Experience v0.1

## Objective

Implement a minimal Tumblr iPhone-native vertical slice for SOCIAL MEDIA, 2010 using the shared frozen runtime architecture.

## Historical target

- iPhone 4
- iOS 4.1
- October 20, 2010
- en-US / Pacific Time
- sessionIdentity-driven experience

## Shared architecture constraints

- Uses existing System Foundation and App Runtime
- No new runtime subsystem introduced
- Dev-only entry through query parameter

## v0.1 scope implemented

- DEV-only entry path:
  - `/?devApp=tumblr`
  - optional `/?devApp=tumblr&autoOpen=1`
- Shared App Runtime integration
- Tumblr session-scoped state with:
  - `currentView`
  - `selectedPostId`
  - `dashboardScrollPosition`
  - `likedPostIds`
  - `rebloggedPostIds`
  - `posts`
- Dashboard feed (sparse, mixed post types)
- Post detail view
- Like toggle
- Reblog toggle
- Back navigation
- Scroll restoration and state retention through suspension/open-close flow
- Session reset on shutdown via shared shutdown cleanup

## Implemented files

- State module: `src/state/tumblrState.ts`
- Container module: `src/device/TumblrContainer.tsx`
- Runtime integration: `src/device/App.tsx`
- Styles: `src/styles/device.css`

## State model

`TumblrState`:

- `currentView`: `"dashboard" | "post"`
- `selectedPostId`: selected post identifier in detail view
- `dashboardScrollPosition`: preserved scroll position for dashboard restore
- `likedPostIds`: session-local like set
- `rebloggedPostIds`: session-local reblog set
- `posts`: seeded sparse posts for v0.1

## Vertical slice behavior

Launch → Dashboard → Scroll → Open Post → Like/Reblog → Back → Home/suspend/resume restore.

## DEV access

- App is reachable through `AppDevAccess` with dev marker and no SpringBoard production icon introduced.

## Evidence classification

### READY

- Shared App Runtime integration and lifecycle reuse: READY
- v0.1 state model and event wiring (`OPEN_POST`, `BACK_TO_DASHBOARD`, `TOGGLE_LIKE`, `TOGGLE_REBLOG`, scroll restore): READY
- Session reset on shutdown clearing Tumblr state: READY

### HOLD / not yet implemented

- Exact 2010 Tumblr iconography: HOLD
- Exact dashboard/post chrome and typography: HOLD
- Image fixture authenticity for photo posts: HOLD
- Notes/detail metadata exactness: HOLD
- Composer / upload flow / modern surfaces: HOLD
- Deep historical semantics for reblog internals: HOLD (foundation only)

### Evidence matrix (updated for historical-grounding pass, 2026-09-13)

Context:

- WDM archive page for Tumblr 2010 is treated as **secondary archival visual evidence only**.
- It is not used as proof of an exact October 20 build/version.
- A separate November boundary is kept to avoid version leakage:
  - `Tumblr iPhone App Updated, Brings Sleek New Dashboard` (Nov 7, 2010), and
  - `Tumblr Lights Dashboards For iPhone, Android` (Nov 5, 2010).

Surface | 2009–2010 evidentiary support | classification
--- | --- | ---
Dashboard structure | WDM archive includes a Tumblr dashboard screen; Macworld notes the Tumblr iPhone app exposes a core Dashboard flow and “re-blog” behavior; InformationWeek describes the iPhone dashboard as long-established since June 2009. | **EVIDENCE-BACKED BEST FIT**
Post-type selector | WDM archive includes a Tumblr “Text” screen and related dashboard/post screens. 2009–2010 contemporaries describe posting options including text/photo/audio/quote/link/chat/video, but selector chrome details are not directly confirmed. | **EVIDENCE-BACKED BEST FIT** (selector behavior)
Text composer | WDM archive includes a Tumblr “Text” capture and Macworld/InformationWeek identify text posting as an official iPhone workflow. | **EVIDENCE-BACKED BEST FIT**
Post detail | WDM archive includes a Tumblr “Post” capture and functional flows align to existing v0.1 post drill-in behavior. | **EVIDENCE-BACKED BEST FIT**
Iconography / exact bars / chrome spacing | No pixel-level provenance from recoverable primary artifacts. WDM is secondary and non-version-specific. | **HOLD — not yet exact**
Post-type picker micro-interactions / exact layout | WDM provides secondary visual context but does not establish exact October 20 geometry, labels, and control states. | **HOLD — not yet exact**

Notes:

- The WDM images were not locally inspectable in this environment due network resolution constraints in the current container session.
- Surfaces marked **EVIDENCE-BACKED BEST FIT** are unlocked for conservative implementation continuation; all other items remain `HOLD` / not exact.

### A/B/C status

- A (Blocker): none introduced
- B (Functional): v0.1 chain implemented
- C (Polish/Historical): deferred as backlog

## Cross-app isolation

Tumblr state update is local to `tumblrState`. No changes were made to:

- Messages
- Twitter
- Facebook
- Instagram
- Foursquare
- Flickr
- Camera runtime
- battery
- scheduler
- global clock
- folder state
- lock-notification routing

## Validation notes

- `npm run build`
- `git diff --check`
- Manual browser interaction verification pending (not performed in this pass)


## Visual Architecture Correction v0.2

This section supersedes the earlier blanket chrome/composer HOLD classification for the structures explicitly approved in the v0.2 brief. Target remains October 20, 2010 / iPhone 4 / iOS 4.1. No November redesign details are imported.

Primary visual basis for this correction: [Web Design Museum, Tumblr for iPhone in 2010](https://www.webdesignmuseum.org/iphone/tumblr-for-iphone-in-2010), **SECONDARY ARCHIVAL VISUAL EVIDENCE**, together with the user's locked description of those screenshots. This is **EVIDENCE-BACKED BEST FIT**, not **VERIFIED EXACT OCTOBER BUILD**.

| Surface | Locked structure implemented | Confidence / limits |
| --- | --- | --- |
| Bottom navigation | Post / Dashboard / Settings, fixed dark gradient bar, icons above labels, selected state | EVIDENCE-BACKED BEST FIT structure; SVG artwork and exact colors RECONSTRUCTED |
| Post screen | Text / Photo / Quote / Link / Chat / Audio / Video in full-width gray gradient rows | EVIDENCE-BACKED BEST FIT; Text active, remaining six rows disabled; exact disabled appearance RECONSTRUCTED |
| Dashboard | Blue navigation gradient, refresh / Dashboard / disabled search, Tumblr / Dashboard / My Posts segments, Dashboard selected | EVIDENCE-BACKED BEST FIT; Search, Tumblr and My Posts semantics HOLD |
| Feed | Blog identity, post-type mark, title, full text and existing notes count; chronological ordering retained | Conservative RECONSTRUCTED presentation pending direct image comparison; no new media fixtures or seed changes |
| Text | Cancel / Text / Post, shared IOS4Input title and IOS4Textarea body, no floating form actions | EVIDENCE-BACKED BEST FIT structure; exact spacing RECONSTRUCTED; advanced-options row omitted pending inspection |
| Settings | Selected tab and sparse Settings shell | RECONSTRUCTED shell; actual account/settings controls HOLD |
| Post detail | Existing read/like/reblog/notes flows retained with compact actions and Dashboard back control | Functional preservation; exact subsidiary chrome HOLD |

Image access in this pass: the archive page was retrieved and its links confirmed for `tumblr-2010-02.jpg`, `tumblr-2010-03.jpg`, `tumblr-2010-05.jpg`, `tumblr-2010-06.jpg`. Image fetches failed; a local download of 02 returned HTTP 403, including a retry with the archive-page referrer. No claim is made to have visually inspected those pixels. The archive's “Post” label must not by itself be treated as proof of post-detail geometry: the locked brief identifies it as the post-type list.

Implementation remains entirely Tumblr-local. The pre-existing DeviceScreen elapsed-time prop is preserved. Publish/reblog/shared time, T+630 schedule, reset ownership, seeds and shared keyboard semantics are retained. A concrete navigation defect was corrected: OPEN_POST/BACK_TO_DASHBOARD no longer recycle the composer submission token, which could suppress a subsequent valid Text post. The duplicate-submission guard remains.

HOLD: Photo publishing / shared-media requester wiring, other post-type actions, Search, Tumblr/My Posts segment behavior, account settings, advanced options, Ask, Following, push, exact Notes expansion, and November redesign chrome.

Safari side-by-side acceptance is pending: Computer Use returned “permissions are not granted.” The local manual QA entry remains `/?devApp=tumblr&autoOpen=1`. Validate Post list/order, Dashboard/tab persistence, Text keyboard and Cancel/Post, Settings isolation, and comparison against the approved archive when access is available.


## Visual Fidelity + Photo Integration v0.3

This pass supersedes v0.2 Photo/Search HOLDs only as explicitly authorized. All work is Track B `main`.

The Web Design Museum 2010 JPEGs were directly inspected in Safari in this pass: `tumblr-2010-02.jpg` (Post stamp rows/pushpin–t–gear tabs), `03` (search field above segments and Search keyboard), `04` (in-app browser, **not** Photo composer), `05` (Text advanced-options row), and `06` (compact blog/notes feed and tabs). [Archive](https://www.webdesignmuseum.org/iphone/tumblr-for-iphone-in-2010). These are SECONDARY ARCHIVAL VISUAL EVIDENCE; structure remains EVIDENCE-BACKED BEST FIT, never VERIFIED EXACT OCTOBER BUILD.

| Surface | v0.3 basis and confidence |
| --- | --- |
| Post | Seven gray rows, tilted postage/paper icon tiles, T/landscape/orange quotes/green link/Hi!/purple audio/film motifs: EVIDENCE-BACKED BEST FIT. SVG artwork, precise perforations and disabled styling RECONSTRUCTED. |
| Bottom tabs | Pushpin / t / gear silhouettes, dark three-cell gradient and selected highlight: EVIDENCE-BACKED BEST FIT; exact paths RECONSTRUCTED. |
| Dashboard search | Independent nav/search/segmented layers, clear control, shared Search keyboard: EVIDENCE-BACKED BEST FIT. Filtering searches only local blog/title/body text; historical remote search semantics remain HOLD. |
| Text | Narrow “Close advanced options” row reproduced as disabled. The screenshot shows expanded options, but implementing their controls is explicitly out of scope. |
| Feed | Compact blog identity and top-right notes; arbitrary type badge removed. Canonical avatars are not supplied, so none invented. |
| Photo | User-approved single-photo Shared Media flow, Cancel/Photo/Post, image preview and optional caption. Exact native composer layout/caption control placement is RECONSTRUCTED; no Photo composer screenshot was found among the inspected captures. |

Photo uses requester `tumblr` and the existing source chooser, Camera owner, Camera Roll and screen-level keyboard suspension. No new camera runtime or selection is created. Return context includes the composer token to reject stale deliveries. The same Tumblr reducer owns pending attachment and publication; a post stores the existing media ID/URL reference, caption, session identity and simulated timestamp. Cancellation of a replacement preserves the existing draft/resource. Publication requires a selected resource and matching unused submission token; double-taps publish once. Normal session reset clears drafts and unsent attachments without revoking shared resources from Tumblr.

Remaining HOLDs: remote search semantics, Tumblr/My Posts semantics, Quote/Link/Chat/Audio/Video composers, advanced-option controls, settings/account details, Ask, Following, push, Notes expansion and November redesign. No Flickr behavior or other app UI changes are intended.

Verification: build, seed validator, diff whitespace, Tumblr state/SSR, software foundation/session, notification state, media keyboard ownership, shared media integration, media publishing, Flickr state and public Twitter checks pass. Shared media integration exercises Tumblr camera/library/cancel/reference identity/caption/double-submit/reset in two sessions alongside existing requesters. Safari reference JPEG inspection completed; updated implementation interaction/visual acceptance remains pending device power/unlock, which the available native automation cannot reliably hold. QA URL: `http://localhost:5175/?devApp=tumblr&autoOpen=1`. No claim of completed Safari acceptance is made.


## v0.4 — My Posts / Settings / Notes audit

Target remains October 20, 2010, iPhone 4 / iOS 4.1. This section supersedes My Posts and the empty Settings shell HOLD only.

| Detail | Evidence / decision | Classification |
| --- | --- | --- |
| Dashboard and reblog availability | [Macworld, March 30 2009](https://www.macworld.com/article/195615/tumblr.html) explicitly describes followed-blog Dashboard and reblogging. | FACT (availability, not exact October pixels) |
| My Posts segment, compact list, Settings tab | Previously directly inspected approved [2010 archive](https://www.webdesignmuseum.org/iphone/tumblr-for-iphone-in-2010), images 03/06 and 02. | EVIDENCE-BACKED BEST FIT; not exact October build |
| My Posts ownership | Session-created Text/Photo plus existing user reblog relationships, projected from the single reducer. Explicit session ownership excludes matching historical blog names and latewatch. | RECONSTRUCTED semantics authorized by v0.4 brief |
| Left Tumblr segment | No sufficiently specific target-period meaning established. | HOLD; visible disabled |
| Settings contents | No inspected exact Settings capture. Read-only Account / Blog identity uses existing session name; no invented email, credentials, logout, preferences or blog switching. Gray grouped table is conservative fallback authorized in brief. | RECONSTRUCTED; exact rows/chrome HOLD |
| Notes | Existing seed/user likes and source-linked reblogs retained; counts derive from notes. Compact blog/action rows, no invented avatars, timestamps or replies. | RECONSTRUCTED presentation; existing project-state basis |

Contemporaneous Gizmodo search results were reviewed but did not provide usable Settings/Notes detail; no unseen screenshot details inferred. November 2010 redesign remains an exclusion boundary, never a source for missing UI.

Reblog records already store sourcePostId, current author, optional text and canonical elapsed time; My Posts projects them without duplicating source content or image resources. Opening one returns to its source detail with existing attribution. Likes never imply ownership. Reset restores default Dashboard segment and seed notes/posts, clearing session posts/reblogs and navigation. Photo delivery is manually accepted per the v0.4 brief; its routing is unchanged.

Remaining HOLD: left Tumblr semantics, exact Settings options, logout/blog switching, Notes avatars/timestamps/replies, Quote/Link/Chat/Audio/Video, Ask, Following, push, November redesign, exact icon artwork/micro-spacing.

Verification: build, seed, diff check, focused Tumblr tests, software foundation/session, media attachment/keyboard/publishing, notifications, Flickr and public Twitter all PASS. Existing software-session and shared-media integration tests cover Camera scene stability and reset; no separate Camera test file is present. Focused tests run two sessions with Text/Photo/reblog, like/unlike, identity collision, source-object preservation, sub-minute reverse ordering, Settings, Notes counts, reset and exactly-once Dashboard-only T+630 delivery.

Safari v0.4 QA is ready at `http://127.0.0.1:5175/?devApp=tumblr&autoOpen=1`; browser currently at identity entry. Visual acceptance of these new surfaces is pending, not claimed complete. After power/unlock: publish Text/Photo, inspect My Posts, open source detail → Like/Unlike/Reblog → Notes, then Settings → Dashboard. Verify selected segment/tab and preserved search keyboard. No exact October Settings or Notes fidelity claim.
