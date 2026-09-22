# Final RC system completion v1

Authority: explicitly approved Final RC System Completion v1. Visual additions are conservative **RECONSTRUCTED** iOS 4.1 surfaces, not pixel-verified original assets. Existing Stocks/Settings SpringBoard artwork and Camera mode artwork are retained. No manual/browser QA was performed.

## Twitter

Owner Tweets derives from unique session-authored timeline IDs (initial/reset zero). The existing curated following/followers/favorites baseline remains 4/12/7. Matt, Alex and Jay use unique authored tweet IDs across timeline, mention-tweet and linked-tweet records; timeline projections cannot inflate totals. Runtime records count only after delivery. Separate reply records and DMs do not count. Unknown metrics stay unknown. Matt's social identity/handle remains Matt Ricci / @mattricci; full name remains separate fictional metadata. Alex's full-name profile is unified with the existing `alex` follow identity rather than the former disconnected full-name fallback.

## Shared fictional geography

Night Owl Cafe (`night-owl`) and Cedar Books (`cedar-books`) now have approved local fictional positions, superseding their earlier map-ineligible classification. HK (`hk`) is a **RECONSTRUCTED FICTIONAL VENUE**. Gelato Roma reuses its existing canonical ID, name and position; no new restaurant biography or activity was authored. All six approved Foursquare venues resolve through the same canonical venue/geography records as Maps. Original venue order is retained; Gelato Roma and HK are appended. Their food category icon conservatively reuses the existing reconstructed restaurant artwork.

Coordinates are local fictional miles, never latitude/longitude or claimed Los Angeles addresses. Existing finite map bounds and geometry remain. Direct Maps shows the six markers; handoff selects the same canonical record. Beyond the local extent, static neutral blank regions replace unavailable tiles immediately; there is no spinner, remote provider, or expanded navigation. Existing Facebook venue lists and historical check-ins are unchanged.

## Stocks

Repository audit found Stocks icon artwork, but no approved quote/chart dataset. Three fixed rows (AAPL, GOOG, YHOO) and their small line charts are **RECONSTRUCTED EXPERIENCE DATA**. They are not verified October 20, 2010 market observations, live quotes, or investment information. Selection is App-owned, retained across switching and reset to AAPL. No network, trading, news or editing.

## Settings

Reconstructed grouped table with inactive Airplane Mode, Wi-Fi, Notifications and Brightness rows. Sounds reads shared DeviceAudio mute/volume, including physical-button updates, and never writes a second audio owner. Wallpaper previews the existing locked asset. General shows only the project's approved iPhone 4 / 4.1 model/version. Transient route is App-owned and resets; no network/account settings were introduced.

## Camera / Photos

**RECONSTRUCTED CAMERA VIDEO — NO LIVE DEVICE CAMERA/MIC ACCESS.** The existing synthetic, session-selected viewfinder canvas supplies `captureStream(15)`. MediaRecorder negotiates locally supported MP4 (preferred) or WebM; unsupported browsers show a restrained unavailable status. Clips are silent, session-local blobs, not claimed to be original iPhone-encoded recordings.

Limits: one active recorder; 12 seconds; 4 MiB per video blob and per poster; four clips per session. Home/sleep/app switch ends the current recording. Reset/unmount cancels recording and invalidates pending completion; tracks stop and timers clear. URLs for both clip and poster are revoked with the existing Camera Roll reset. Video does not persist across reloads or sessions.

Videos reserve sequence numbers from the same transaction-backed Camera Roll namespace as photos. They retain session/scene identity, timestamp, dimensions, duration and an explicit video discriminator. Photos shows poster thumbnails with video/duration badges and a local Play/Pause detail view with preserved aspect ratio. Shared social pickers exclude videos, and the App selection boundary rejects video attachments. Photo capture/persistence remains unchanged.

## Verification

Focused derived-count/venue/Stocks/Settings tests, synthetic recorder resource/cancellation tests, actual App two-session integration (four clips per run), Hero lifecycle integration, shared media attachment/publishing/keyboard regressions, historical seed validator, build and diff checks. Tests mock only host media/storage boundaries; Safari encoding and visual appearance remain for the user's manual QA.

Feature freeze re-enabled after this bounded pass. No post-RC expansions authorized here.

## Files changed in this pass

- Data: `src/data/canonicalVenues.ts`, `canonicalVenueGeography.ts`, `foursquareVenueAdapter.ts`, `sessionSeedContent.ts`.
- State: `src/state/twitterState.ts`, `basicSystemApps.ts`, `rcSystemApps.ts` (new), `cameraRuntime.ts`, `cameraCaptureState.ts`, `cameraRollState.ts`, `cameraRollPersistence.ts`, `cameraVideoRecorder.ts` (new).
- Device/UI: `src/device/App.tsx`, `DeviceScreen.tsx`, `SpringBoard.tsx`, `MultitaskingBar.tsx`, `BasicSystemApps.tsx`, `Shared2010Map.tsx`, `CameraContainer.tsx`, `PhotosContainer.tsx`, `RCSystemApps.tsx` (new).
- Styles/audio: `src/styles/device.css`, `rcSystemApps.css` (new), `src/audio/deviceAudio.ts` (read-only volume diagnostics).
- Tests: `src/state/rcSystemCompletion.test.mjs` (new), `cameraVideoRecorder.test.mjs` (new), `basicSystemApps.test.mjs`, `src/device/softwareSession.test.mjs`, `experienceLifecycle.test.mjs`, `scripts/validate-seed-content.mjs`.
- Evidence: this file. Prior uncommitted UI polish and Jack/Matt content changes were preserved, not included in this inventory.
