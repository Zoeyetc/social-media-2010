# Track B Remaining Basic Apps v0.1

Target: iPhone 4 / iOS 4.1, October 20, 2010. No new historical character content.

## Evidence and confidence

Apple iPhone iOS 4 User Guide (2010), Clock / Compass / Voice Memos chapters, supports app roles and period functionality: https://macdailynews.com/wp-content/uploads/2010/06/iphone_ios4_user_guide.pdf

Clock tab vocabulary, stopwatch/timer roles, circular Compass and microphone-led Voice Memos presentation are period-grounded. These minimal CSS/SVG layouts, button-based duration/alarm controls and microphone artwork are RECONSTRUCTED, not pixel-exact archival copies.

WhatsApp and Skype use the existing approved 2010 App Store icon assets (EVIDENCE-BACKED per explicit approval). See ios-4-1-springboard-icon-provenance-v1.0.md for archived asset provenance. The separate light WhatsApp and pale-blue-white Skype surfaces use enlarged approved marks with rotating indicators, without visible Loading text. The launch presentation is RECONSTRUCTED. It does not reproduce an archival launch screen. No detailed splash artwork or fabricated contacts/chat databases.

Skype 3G calling existed by May 2010; multitasking by July 2010. No false Wi-Fi-only/3G-unsupported explanation. December 2010 Skype video calling is outside the target date and is not exposed.

## Implemented boundaries

- Clock: Los Angeles uses the shared simulated device clock. Alarm supports one session-local alarm, editing, enable/disable/delete; alarm firing remains HOLD. Stopwatch and Timer use monotonic time and survive app switching. Timer completion is foreground text only; no new scheduler, notification or audio subsystem.
- Compass: explicitly simulated horizontal-drag heading, wrapped through 360 degrees. No real sensors, geolocation or fictional coordinates. Calibration remains HOLD.
- Voice Memos: microphone access only on Record, session-only MediaRecorder audio when supported, local playback. Unsupported capability provides explicitly labeled simulation without fake audio; denied permission offers retry or simulation. Reset stops recorder/tracks/playback, revokes recording URLs, clears list, and rejects late permission results. No upload, sharing, transcription or persistence.
- WhatsApp/Skype: conservative loading surfaces only; Home and multitasking remain available. No external messaging, calling or video.
- All five remain inside DeviceScreen. Session reset clears local state; canonical world content stays unchanged.

## Verification

Focused reducer, rendering and recorder lifecycle tests: src/state/remainingBasicApps.test.mjs. Actual App two-run harness includes remaining-app state and simulated memos in src/device/softwareSession.test.mjs. Manual Safari acceptance is pending user observation; automated Safari interaction is unavailable by user instruction. No archival visual match or Safari PASS is claimed.
