# iTunes Preview Reliability v0.1

Narrow transport hardening only. Five-track ranking, historical metadata, iTunes UI and DeviceAudio ownership are unchanged. Safari/YouTube and other apps are unchanged.

- Every lookup explicitly supplies country=US, media=music, entity=song and limit=10. No locale, location or timezone inference.
- Lookup remains lazy: only a playback request resolves a song. Per-track concurrent callers share one Promise/network operation; switching away does not create duplicate same-track lookup work. Playback generation guards prevent a former consumer from starting audio.
- Successful results are cached in memory and optionally localStorage for 12 hours. Keys include US plus locked id/title/artist. Each read checks expiry and revalidates title/artist, song/storefront and official preview host. Corrupt, expired or blocked browser storage is nonfatal. No failure is permanently cached.
- Media failure invalidates memory/browser entries and permits only one fresh lookup and playback retry for that playback attempt. A second media failure enters a 45-second per-track cooldown. Resolution failures also enter cooldown. Repeated taps during cooldown cannot issue network requests. Lookup and pending playback each have a 12-second timeout. Autoplay permission rejection preserves the prior explicit-user-gesture behavior, without refetching or bypassing browser policy.
- Failure leaves the existing neutral unavailable state. Selection, previous/next and navigation stay independent of transport success; no UI changes.
- DeviceAudio retains its one preview channel and existing mute/volume/lock handling. Reset stops/release audio, aborts resolver-owned requests, clears runtime state and invalidates callbacks. Valid short-lived browser transport entries may survive; they never restore selection, playback or navigation.
- No commercial audio files or resolved production URLs were added to source. Official runtime previews remain modern transport for historical content, not historically authentic delivery.

Verification: build; new itunesPreviewReliability.test.mjs; existing itunesPreview, deviceAudio, finalDecorativeApps and development/production softwareSession suites; git diff --check. All pass. Network/media faults use deterministic fakes; this pass does not claim new Safari audibility or live availability verification.
