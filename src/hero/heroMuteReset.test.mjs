// Actual persistent hardware hook + lifecycle reducer + audio gate, headless.
// Safari visual/audio acceptance remains manual.
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import * as THREE from "three";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8").replace(/^import .*;\n/gm, "").replaceAll("import.meta.env.DEV", "false").replaceAll("export ", "");
const { heroTransition, initialHeroState } = new Function(stripTypeScriptTypes(read("./HeroController.ts")) + ";return {heroTransition, initialHeroState};")();
let plays = 0, previewPlays = 0;
const sounds = [], requests = [];
// Evaluate the production resolver with only its transport boundary replaced.
// No global fetch or browser audio implementation is reachable from this test.
const transport = (url, options) => new Promise(resolve => requests.push({ url, signal: options.signal, resolve }));
const ITunesPreviewResolver = new Function("fetch",
  stripTypeScriptTypes(read("../audio/itunesPreviewResolver.ts"), { mode: "transform" }) + ";return ITunesPreviewResolver;")(transport);
class AudioStub {
  constructor() { this.src = ""; this.volume = 1; sounds.push(this); }
  play() { if (this.src.startsWith("https:")) previewPlays++; else plays++; return Promise.resolve(); }
  pause() {}
  addEventListener() {}
  removeAttribute(name) { if (name === "src") this.src = ""; }
  load() {}
}
const audio = new Function("DEVICE_AUDIO_REGISTRY", "Audio", "ITunesPreviewResolver", stripTypeScriptTypes(read("../audio/deviceAudio.ts")) + ";return DeviceAudio;")({ lock: { assetStatus: "READY", assetUrl: "lock" } }, AudioStub, ITunesPreviewResolver);
const idlePreview = { trackId: null, status: "idle", position: 0, duration: 0 };
assert.deepEqual(audio.getPreviewState(), idlePreview);
assert.equal(plays, 0); assert.equal(requests.length, 0, "construction is silent and lazy");
audio.resetPreview();
assert.deepEqual(audio.getPreviewState(), idlePreview);
const slots = [];
let cursor = 0, pending = [], frame;
const effect = (fn, deps) => {
  const index = cursor++, old = slots[index];
  if (!old || deps.some((value, i) => value !== old.deps[i])) {
    pending.push(() => { old?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
  }
};
const invalidate = () => {};
const win = { addEventListener() {}, removeEventListener() {}, clearTimeout() {} };
const doc = { body: { style: {} }, addEventListener() {}, removeEventListener() {} };
const hook = new Function("useCallback", "useEffect", "useLayoutEffect", "useRef", "useFrame", "useThree", "DeviceAudio", "window", "document", ...Object.keys(THREE),
  stripTypeScriptTypes(read("./useHeroHardware.ts")) + ";return useHeroHardware;")(
  (fn, deps) => {
    const i = cursor++, old = slots[i];
    if (!old || deps.some((value, index) => value !== old.deps[index])) slots[i] = { deps, value: fn };
    return slots[i].value;
  }, effect, effect, value => { const i = cursor++; return slots[i] ??= { current: value }; },
  fn => { frame = fn; }, () => ({ invalidate }), audio, win, doc, ...Object.values(THREE));
const root = new THREE.Group();
for (const name of ["MuteSwitch", "VolumeUp", "VolumeDown"]) {
  const node = new THREE.Mesh(new THREE.BoxGeometry(.002, .004, .003), new THREE.MeshBasicMaterial());
  node.name = name; root.add(node);
}
let state = initialHeroState, handlers;
function render(enabled = false, runtimePower) {
  cursor = 0; pending = [];
  handlers = hook(root, enabled, () => {}, state.phase === "experience" ? () => {} : undefined, runtimePower, state.resetGeneration);
  pending.forEach(fn => fn()); frame({}, 1);
}
function click(name) {
  const event = { object: root.getObjectByName(`Hero${name}HitTarget`), pointerId: 1, button: 0, target: {}, stopPropagation() {} };
  handlers.onPointerDown(event); handlers.onPointerUp(event); frame({}, 1);
}
function assertAudioRinger() {
  assert.equal(audio.diagnostics.muteMode, "ringer");
  assert.equal(audio.canPlayAudio, true);
}
function settleRingerSlider() {
  const slider = root.getObjectByName("HeroMuteSlider");
  for (let step = 0; step < 120 && slider.position.z !== .00075; step++) frame({}, 1 / 60);
  assert.equal(slider.position.z, .00075, "existing animation must reach its exact ringer endpoint within 120 deterministic frames");
}
function assertRinger() {
  assertAudioRinger();
  assert.equal(root.getObjectByName("HeroMuteOrangeIndicator").visible, false);
  assert.equal(root.getObjectByName("HeroMuteSlider").position.z, .00075);
}
const track = { id: "back-to-december", title: "Back to December", artist: "Taylor Swift" };
async function startPreview() {
  const count = requests.length;
  const playing = audio.playPreview(track);
  if (requests.length > count) requests.at(-1).resolve({ ok: true, json: async () => ({ results: [{
    wrapperType: "track", kind: "song", country: "USA", trackName: track.title, artistName: track.artist,
    previewUrl: "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/test.m4a",
  }] }) });
  await playing;
  assert.equal(audio.getPreviewState().status, "playing");
  return sounds.at(-1);
}
render(); assertRinger();
if (process.argv.includes("--volume")) {
  const initial = await startPreview();
  assert.equal(initial.volume, .5, "mount synchronizes default hardware level 8");
  click("VolumeUp");
  assert.equal(initial.volume, .5, "identity cannot change volume");
  audio.resetPreview();
}
for (let loop = 0; loop < 2; loop++) {
  assert.deepEqual(audio.getPreviewState(), idlePreview, "next session has no stale preview state");
  state = heroTransition(state, { type: "CONFIRM_IDENTITY", name: `User ${loop}` }); render(); assertRinger();
  state = heroTransition(state, { type: "DETACH_COMPLETE" }); render(true);
  const requestCount = requests.length;
  const loading = audio.playPreview(track);
  assert.equal(audio.getPreviewState().status, "loading");
  assert.equal(requests.length, requestCount + 1, "real resolver reaches only the deterministic transport");
  const request = requests.at(-1);
  if (process.argv.includes("--volume")) {
    const previewAudio = sounds.at(-1);
    click("VolumeUp");
    // Physical hardware starts at 8/16 and retains volume across session reset.
    // setVolume must also update a pending preview, before playback can start.
    const expectedVolume = (9 + loop) / 16;
    const observedVolume = previewAudio.volume;
    // Release the pending lookup even if this integration assertion fails.
    if (observedVolume !== expectedVolume) {
      audio.resetPreview();
      request.resolve({ ok: true, json: async () => ({ results: [] }) });
      await loading;
    }
    assert.equal(observedVolume, expectedVolume, "physical VolumeUp must control the shared preview audio volume");
  }
  click("MuteSwitch");
  assert.deepEqual(audio.getPreviewState(), idlePreview, "physical mute cancels pending preview playback");
  assert.equal(audio.diagnostics.muteMode, "silent");
  assert.equal(root.getObjectByName("HeroMuteOrangeIndicator").visible, true);
  audio.lock(); assert.equal(plays, loop, "muted sound discarded");
  state = heroTransition(state, { type: "PRESS_POWER", startedAt: 0 }); render();
  state = heroTransition(state, { type: "ALIGN_COMPLETE" }); render();
  state = heroTransition(state, { type: "BOOT_COMPLETE", now: 20000 });
  for (const powerState of ["awake", "asleep", "awake"]) {
    render(false, { state: powerState }); render(false, { state: powerState });
    assert.equal(audio.diagnostics.muteMode, "silent", "same-session rerenders/sleep/wake preserve mute");
  }
  if (process.argv.includes("--volume")) {
    audio.resetPreview(); request.resolve({ ok: true, json: async () => ({ results: [] }) }); await loading;
    click("MuteSwitch"); assertAudioRinger();
    const active = await startPreview();
    const retainedLevel = 9 + loop;
    assert.equal(active.volume, retainedLevel / 16, "mute never rewrites stored gain");
    settleRingerSlider(); assertRinger();
    const playCount = previewPlays;
    click("VolumeDown"); assert.equal(active.volume, (retainedLevel - 1) / 16);
    click("VolumeUp"); assert.equal(active.volume, retainedLevel / 16);
    assert.equal(previewPlays, playCount, "active gain updates without restarting playback");
    for (let i = 0; i < 20; i++) click("VolumeDown");
    assert.equal(active.volume, 0, "lower clamp");
    for (let i = 0; i < 20; i++) click("VolumeUp");
    assert.equal(active.volume, 1, "upper clamp");
    for (let i = 16; i > retainedLevel; i--) click("VolumeDown");
    render(false, { state: "asleep" }); click("VolumeUp");
    assert.equal(active.volume, retainedLevel / 16, "sleep keeps volume and blocks awake-only controls");
    render(false, { state: "awake" });
    assert.equal(active.volume, retainedLevel / 16, "wake preserves volume");
    click("MuteSwitch");
    assert.equal(audio.canPlayAudio, false);
    assert.equal(active.volume, retainedLevel / 16);
    assert.equal(audio.getPreviewState().status, "paused");
    click("MuteSwitch"); assertAudioRinger();
    assert.equal(previewPlays, playCount, "unmute never automatically replays preview");
    assert.equal(active.volume, retainedLevel / 16);
    settleRingerSlider(); assertRinger();
    click("MuteSwitch"); // Preserve the original silent return/reset assertions.
  }
  state = heroTransition(state, { type: "EXPERIENCE_ENDED" }); render();
  for (const from of ["power-loss", "returning", "recharging"]) {
    assert.equal(audio.diagnostics.muteMode, "silent", from);
    state = heroTransition(state, { type: "ADVANCE_RETURN", from }); render();
  }
  assert.equal(state.phase, "resetting");
  assert.equal(audio.diagnostics.muteMode, "silent", "not reset before completion");
  // App's disposable-runtime reset owns preview cleanup; hardware owns ringer reset.
  audio.resetPreview();
  assert.equal(request.signal.aborted, true, "preview reset cancels resolver-owned work");
  request.resolve({ ok: true, json: async () => ({ results: [] }) });
  await loading;
  assert.deepEqual(audio.getPreviewState(), idlePreview, "late transport completion cannot revive preview state");
  assert.ok(sounds.every(sound => !sound.src), "no preview audio source survives reset");
  state = heroTransition(state, { type: "RESET_COMPLETE" }); render();
  assert.equal(state.phase, "identity"); assertRinger();
  assert.equal(plays, loop, "reset never replays suppressed sound");
  audio.lock(); assert.equal(plays, loop + 1, "new sound is audible");
  if (process.argv.includes("--volume")) assert.equal(sounds.at(-1).volume, (9 + loop) / 16, "reset resynchronizes retained volume for all DeviceAudio channels");
}
slots.forEach(slot => slot.cleanup?.());
console.log("PASS: two persistent hardware/session loops; mute preserved until RESET_COMPLETE; ringer/slider/indicator/audio restored; no replay.");
