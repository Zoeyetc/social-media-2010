import assert from "node:assert/strict";
import { createServer } from "vite";
const original = { fetch: globalThis.fetch, Audio: globalThis.Audio, storage: Object.getOwnPropertyDescriptor(globalThis, "localStorage"), now: Date.now };
let now = 100000, requests = 0, release, plays = 0, callbacks = 0;
Date.now = () => now;
const storage = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } });
globalThis.fetch = () => { requests++; return new Promise(resolve => { release = resolve; }); };
const sounds = [];
globalThis.Audio = class {
  constructor() { this.src = ""; this.volume = 1; sounds.push(this); }
  play() { plays++; return Promise.resolve(); }
  pause() {} removeAttribute() { this.src = ""; } load() {} addEventListener() {}
};
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "silent" });
const walk = n => !n || typeof n !== "object" ? [] : Array.isArray(n) ? n.flatMap(walk) : [n, ...walk(n.props?.children)];
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
try {
  const { ITUNES_TRACKS: tracks, initialITunesState, iTunesTransition } = await server.ssrLoadModule("/src/state/finalDecorativeApps.ts");
  const { DeviceAudio: a } = await server.ssrLoadModule("/src/audio/deviceAudio.ts");
  const { ITunesContainer } = await server.ssrLoadModule("/src/device/FinalDecorativeApps.tsx");
  let state = iTunesTransition(initialITunesState(), { type: "SELECT", index: 0 });
  const track = tracks[0]; a.selectPreviewTrack(track);
  const unsub = a.subscribePreviewMetadata(() => callbacks++);
  const dispatch = event => { if (event.type === "PLAY") void a.playPreview(tracks[state.selectedIndex]); state = iTunesTransition(state, event); };
  const button = () => walk(ITunesContainer({ state, dispatch, preview: a.getPreviewState(), readiness: a.previewReadiness(tracks[state.selectedIndex] ?? null) })).find(n => n.props?.["aria-label"] === "Play");
  assert.equal(button().props.disabled, true); button().props.onClick();
  await a.playPreview(track); assert.equal(plays, 0); assert.equal(requests, 0, "cold play cannot start asynchronous metadata playback");
  const firstConsumer = new AbortController();
  const preparing = a.preparePreviewTrack(track, firstConsumer.signal);
  assert.equal(a.previewReadiness(track).status, "resolving"); assert.equal(button().props.disabled, true);
  firstConsumer.abort(); // Close/reopen while the shared metadata lookup is pending.
  const reopened = a.preparePreviewTrack(track, new AbortController().signal);
  assert.equal(requests, 1);
  const good = item => ({ wrapperType: "track", kind: "song", country: "USA", trackName: item.title, artistName: item.artist, previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/test.m4a" });
  release({ ok: true, json: async () => ({ results: [good(track)] }) }); await preparing; await reopened;
  assert.equal(a.previewReadiness(track).selectedTrackMetadataReady, true); assert.equal(button().props.disabled, false);
  button().props.onClick(); assert.equal(plays, 1, "enabled button reaches HTMLAudioElement.play synchronously");
  await flush(); assert.equal(a.getPreviewState().status, "playing");
  assert.equal(a.diagnostics.iTunes.playEnabled, true); assert.equal(a.diagnostics.iTunes.previewUrlPresent, true);
  a.setVolume(.25); assert.equal(sounds.at(-1).volume, .25); a.setMuted(true); assert.equal(a.getPreviewState().status, "paused");
  a.setMuted(false); assert.equal(plays, 1, "unmute never resumes automatically");
  a.stopPreview(); const before = requests; await a.preparePreviewTrack(track, new AbortController().signal);
  assert.equal(requests, before, "reopen retains validated cache");
  a.resetPreview(); state = initialITunesState(); assert.equal(button().props.disabled, true);
  state = iTunesTransition(state, { type: "SELECT", index: 0 });
  await a.preparePreviewTrack(track, new AbortController().signal); assert.equal(requests, before, "Run 2 reuses validated 12h storage metadata");
  assert.equal(button().props.disabled, false); assert.equal(plays, 1, "cache restoration does not play");
  const badTrack = tracks[2]; const failed = a.preparePreviewTrack(badTrack, new AbortController().signal);
  release({ ok: true, json: async () => ({ results: [{ ...good(badTrack), previewUrl: "https://invalid.example/audio" }] }) }); await failed;
  assert.equal(a.previewReadiness(badTrack).status, "unavailable"); assert.equal(a.previewReadiness(badTrack).playEnabled, false);
  const failedRequests = requests;
  for (let i = 0; i < 10; i++) await a.preparePreviewTrack(badTrack, new AbortController().signal);
  assert.equal(requests, failedRequests, "45s cooldown bounds repeated opens/preparation");
  now += 45001; const retry = a.preparePreviewTrack(badTrack, new AbortController().signal);
  release({ ok: true, json: async () => ({ results: [good(badTrack)] }) }); await retry;
  assert.equal(a.previewReadiness(badTrack).playEnabled, true);
  const staleTrack = tracks[3]; const stale = a.preparePreviewTrack(staleTrack, new AbortController().signal);
  const observed = callbacks; a.resetPreview(); const resetCallbacks = callbacks;
  release({ ok: true, json: async () => ({ results: [good(staleTrack)] }) }); await stale;
  assert.equal(callbacks, resetCallbacks, "late metadata completion cannot notify the next session"); assert.ok(resetCallbacks > observed);
  assert.equal(a.previewReadiness(staleTrack).playEnabled, false); assert.equal(plays, 1);
  now += 12 * 60 * 60 * 1000 + 1;
  assert.equal(a.previewReadiness(track).playEnabled, false, "expired URL cannot enable a later tap");
  unsub(); a.resetPreview();
  console.log("PASS: actual disabled Play control, validated readiness notifications, synchronous actionable tap, mute/pause, close/reopen, Run 2 cache, invalid response, bounded cooldown, expiry and stale reset");
} finally {
  await server.close(); globalThis.fetch = original.fetch; globalThis.Audio = original.Audio; Date.now = original.now;
  if (original.storage) Object.defineProperty(globalThis, "localStorage", original.storage); else delete globalThis.localStorage;
}
