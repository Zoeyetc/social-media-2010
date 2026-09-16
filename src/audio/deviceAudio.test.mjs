// Headless audio-gate tests; Safari audibility/autoplay QA remains manual.
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const events = ["lock", "unlock", "keyboardTap", "messageReceived", "messageSent", "lowBattery", "cameraShutter"];
const registry = Object.fromEntries(events.map(event => [event, { assetStatus: "READY", assetUrl: event }]));
const source = fs.readFileSync(new URL("./deviceAudio.ts", import.meta.url), "utf8").replace(/^import .*;\n/gm, "").replaceAll("export ", "");
const sounds = [];
class FakeAudio {
  constructor(url) { this.url = url; this.plays = 0; this.pauses = 0; this.listeners = {}; sounds.push(this); }
  play() { this.plays++; return Promise.resolve(); }
  pause() { this.pauses++; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
}
const audio = new Function("ITunesPreviewResolver", "DEVICE_AUDIO_REGISTRY", "Audio", stripTypeScriptTypes(source) + ";return DeviceAudio;")(class {}, registry, FakeAudio);
assert.equal(audio.canPlayAudio, true, "software/default is audible");
audio.unlock();
assert.equal(sounds.length, 1);
let runtimeMode = "ringer";
const release = audio.bindAudioMode(() => runtimeMode);
assert.equal(audio.canPlayAudio, true);
runtimeMode = "silent";
audio.audioModeChanged();
assert.equal(sounds[0].muted, true);
assert.equal(sounds[0].pauses, 1);
for (const event of events) audio.dispatch(event);
assert.equal(sounds.length, 1, "silent requests never instantiate/queue playback");
assert.equal(audio.diagnostics.lastSuppressedSound, "cameraShutter");
runtimeMode = "ringer";
audio.audioModeChanged();
assert.equal(sounds.length, 1, "unmuting does not replay anything");
assert.equal(sounds[0].plays, 1, "stopped one-shot never resumes");
audio.notificationReceived("message");
assert.equal(sounds.length, 2);
assert.equal(sounds[1].muted, false);
sounds[1].listeners.ended();
runtimeMode = "silent";
audio.audioModeChanged();
runtimeMode = "ringer";
audio.audioModeChanged();
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
console.log("PASS: default ringer, immediate active silence, all seven gated sounds, no replay, future playback, software fallback.");
