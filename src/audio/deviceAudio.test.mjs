// Headless audio-gate tests; Safari audibility/autoplay QA remains manual.
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const events = ["lock", "unlock", "keyboardTap", "messageReceived", "messageSent", "lowBattery", "cameraShutter"];
const registry = Object.fromEntries(events.map(event => [event, { assetStatus: "READY", assetUrl: event, filename: `${event}.caf` }]));
const source = fs.readFileSync(new URL("./deviceAudio.ts", import.meta.url), "utf8").replace(/^import .*;\n/gm, "").replaceAll("export ", "");
const sounds = [];
let nextPlayError = null;
class FakeAudio {
  constructor(url) {
    this.url = url; this.plays = 0; this.pauses = 0; this.listeners = {};
    this.error = null; this.readyState = 0; this.networkState = 2;
    sounds.push(this);
  }
  play() {
    this.plays++;
    if (nextPlayError) {
      const error = nextPlayError; nextPlayError = null;
      this.error = { code: 4 }; this.readyState = 0; this.networkState = 3;
      return Promise.reject(error);
    }
    this.readyState = 4; this.networkState = 1;
    return Promise.resolve();
  }
  pause() { this.pauses++; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}
const fakeNavigator = { userActivation: { isActive: true } };
const audio = new Function("ITunesPreviewResolver", "DEVICE_AUDIO_REGISTRY", "Audio", "navigator", stripTypeScriptTypes(source) + ";return DeviceAudio;")(class {}, registry, FakeAudio, fakeNavigator);
assert.equal(audio.canPlayAudio, true, "software/default is audible");
audio.unlock();
await Promise.resolve();
assert.equal(sounds.length, 1);
assert.deepEqual(audio.diagnostics.oneShotPlaybackAttempts[0], {
  event: "unlock",
  soundId: "unlock.caf",
  userActivationActive: true,
  result: "resolved",
  rejectionName: null,
  rejectionMessage: null,
  errorCode: null,
  readyState: 4,
  networkState: 1,
}, "resolved playback records activation and settled media state");
let runtimeMode = "ringer";
const release = audio.bindHardwareMuteMode(() => runtimeMode);
assert.equal(audio.canPlayAudio, true);
runtimeMode = "silent";
audio.hardwareMuteChanged();
assert.equal(sounds[0].muted, true);
assert.equal(sounds[0].pauses, 1);
for (const event of events) audio.dispatch(event);
assert.equal(sounds.length, 1, "silent requests never instantiate/queue playback");
assert.equal(audio.diagnostics.lastSuppressedSound, "cameraShutter");
runtimeMode = "ringer";
audio.hardwareMuteChanged();
assert.equal(sounds.length, 1, "unmuting does not replay anything");
assert.equal(sounds[0].plays, 1, "stopped one-shot never resumes");
audio.notificationReceived("message");
assert.equal(sounds.length, 2);
assert.equal(sounds[1].muted, false);
sounds[1].listeners.ended();
runtimeMode = "silent";
audio.hardwareMuteChanged();
runtimeMode = "ringer";
audio.hardwareMuteChanged();
assert.equal(sounds[1].plays, 1, "completed one-shot never restarts");
release();
assert.equal(audio.canPlayAudio, true);
audio.unlock();
const count=sounds.length;
audio.setMuted(true);
assert.equal(audio.diagnostics.muteMode, "silent");
assert.equal(sounds.at(-1).pauses, 1);
audio.messageSent();assert.equal(sounds.length,count);
audio.setMuted(false);assert.equal(sounds.length,count);
assert.equal(audio.canPlayAudio,true);
fakeNavigator.userActivation.isActive = false;
nextPlayError = Object.assign(new Error("The operation is not allowed"), { name: "NotAllowedError" });
audio.cameraShutter();
await Promise.resolve();
assert.deepEqual(audio.diagnostics.oneShotPlaybackAttempts.at(-1), {
  event: "cameraShutter",
  soundId: "cameraShutter.caf",
  userActivationActive: false,
  result: "rejected",
  rejectionName: "NotAllowedError",
  rejectionMessage: "The operation is not allowed",
  errorCode: 4,
  readyState: 0,
  networkState: 3,
}, "rejected playback records the rejection and failed media state");
assert.equal(audio.diagnostics.activeChannel, null, "rejected one-shot releases the active channel");
console.log("PASS: default ringer, immediate active silence, all seven gated sounds, no replay, future playback, software fallback, and one-shot diagnostics.");
