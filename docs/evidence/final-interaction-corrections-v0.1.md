# Track B Final Interaction Corrections v0.1

Target: iPhone 4 / iOS 4.1, October 20, 2010. Preserves prior uncommitted Track B work and all canonical messages/song metadata.

## Messages

Accepted top-left Edit position is unchanged. Edit/Done is functional; red minus followed by Delete removes a whole local conversation. Affordance artwork is conservative RECONSTRUCTED period-style UI, not an exact archival trace. No individual-message delete, forwarding, swipe UI or bulk editing.

The list derives from remaining messages. Deletion removes only that thread and its pending attachment; unrelated drafts and other threads are preserved. Reply eligibility and scheduled event ownership remain intact. Later incoming SMS appends normally and reveals the conversation again without restoring deleted history. Initial canonical content currently contains Dad; Mom first arrives through the runtime scheduler. Reset recreates the canonical initial state. Outgoing IDs now use a session counter so deleting a thread cannot recycle a surviving message ID. Canonical text/timing are unchanged.

## Loading animation

Safari/YouTube share the existing indicator with a CSS stepped rotation. No requestAnimationFrame, timer, network change, or chrome change. DeviceScreen mounts app content only in the active app phase; sleep/off removes it. CSS also pauses outside .screen.app. Reset/remount returns to the normal animation. Browser paint/visibility remains manual QA.

## Official iTunes previews

The five-song order and display metadata are unchanged: EVIDENCE-BACKED CONTEMPORARY ITUNES SALES DATA. Current Apple preview delivery is a MODERN TRANSPORT mechanism representing that historical list; it is NOT historically authentic transport.

- Commercial recordings are NOT bundled or downloaded into this repository.
- Runtime lookup uses only https://itunes.apple.com/search with country=US, media=music, entity=song, limit=10, omitted credentials and no referrer.
- Results require song/track kind, US storefront, exact normalized title and artist. The only special equivalence is audited Like a G6 featured credits split across Apple's title and artist fields. Covers/remixes/Taylor's Version are rejected. Preview URLs require HTTPS and the official audio-ssl.itunes.apple.com /itunes-assets/AudioPreview path.
- Official responses were inspected for all five tracks; matching candidates and Access-Control-Allow-Origin: * were present. This verifies lookup availability at inspection time, not Safari audible playback.
- Lookup caching is now hardened by itunes-preview-reliability-v0.1.md: validated memory cache plus optional 12-hour browser transport cache. Session reset clears playback and pending work; transport metadata may survive. URLs are never canonical metadata. No unofficial fallback.
- DeviceAudio owns one preview channel. Track change/reset cancels lookup, pauses/releases the previous source and prevents late replay. Volume applies; mute/lock/sleep pause. Unmute never automatically replays. Normal app switching retains the selected track/preview. Real media events supply elapsed/duration; there is no fake progress.
- A Play request can resolve asynchronously. If Safari requires another explicit gesture, the source remains ready for a second Play tap; autoplay restrictions are not bypassed. Lookup/media failure shows only “Preview unavailable” for that selected track. Initial idle state has no failure text.
- Availability is external and may change; this is preview streaming, not full-song playback. Do not assume every current response has exactly 30 seconds; displayed duration comes from the media element.

Official technical references:
- https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
- https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/UnderstandingSearchResults.html

## Verification boundary

Focused tests cover Edit/Done/Delete, thread resurrection and reset, outgoing IDs, exact preview matching/host validation, cache, failures, mute/volume, pause/resume, track replacement, stale callbacks after reset, and active spinner CSS. The actual App lifecycle test includes deletion persistence across app changes, incoming delivery, and two canonical resets.

Manual Safari QA pending: Messages deletion/reset, rotating indicators, at least one audible official preview, pause/resume, previous/next, mute and no duplicate streams. No Safari PASS or actual audio playback PASS claimed from mocked tests. Stop at a reproduced CORS/media runtime blocker; no unofficial source or proxy fallback is introduced.
