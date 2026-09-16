// Execute the actual hardware hook with headless pointer/timer adapters.
// This checks routing/cancellation, not Safari hit reachability.
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import * as THREE from "three";

const source = fs.readFileSync(new URL("./useHeroHardware.ts", import.meta.url), "utf8")
  .replace(/^import .*;\n/gm, "").replaceAll("import.meta.env.DEV", "false");
const dependencies = ["useCallback", "useEffect", "useLayoutEffect", "useRef", "useFrame", "useThree", "DeviceAudio", "window", "document", ...Object.keys(THREE)];
const factory = new Function(...dependencies, stripTypeScriptTypes(source).replaceAll("export ", "") + ";return useHeroHardware;");

function fixture(enabled, runtimePower) {
  const effects = [], timers = new Map(), listeners = new Map(), volumeValues = [];
  let id = 0, boots = 0, capture = false;
  const win = {
    setTimeout(fn) { timers.set(++id, fn); return id; }, clearTimeout(n) { timers.delete(n); },
    addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); },
  };
  const doc = { body: { style: {} }, hidden: false, addEventListener: win.addEventListener, removeEventListener: win.removeEventListener };
  const hook = factory(fn => fn, fn => effects.push(fn), fn => effects.push(fn), value => ({ current: value }), () => {}, () => ({ invalidate() {} }),
    { bindHardwareMuteMode: () => () => {}, setVolume(value) { volumeValues.push(value); } }, win, doc, ...Object.values(THREE));
  const root = new THREE.Group();
  const button = new THREE.Mesh(new THREE.BoxGeometry(.0104, .0026, .0005), new THREE.MeshBasicMaterial());
  button.name = "PowerButton"; root.add(button);
  const handlers = hook(root, enabled, () => boots++, undefined, runtimePower);
  const cleanups = effects.map(fn => fn());
  assert.deepEqual(volumeValues, [8 / 16], "initial hardware level must synchronize shared audio volume once");
  const hit = root.getObjectByName("HeroPowerButtonHitTarget");
  assert.ok(hit);
  assert.deepEqual(hit.position.toArray(), [0, .003, .006]);
  const target = { setPointerCapture() { capture = true; }, hasPointerCapture() { return capture; }, releasePointerCapture() { capture = false; } };
  const event = { object: hit, pointerId: 1, button: 0, target, stopPropagation() {} };
  return { handlers, event, timers, listeners, doc, get boots() { return boots; }, get capture() { return capture; },
    cleanup() { cleanups.forEach(fn => fn?.()); } };
}

const off = fixture(true);
off.handlers.onPointerDown(off.event);
assert.equal(off.capture, true);
off.handlers.onPointerUp(off.event);
assert.equal(off.boots, 0); assert.equal(off.timers.size, 0);
off.handlers.onPointerDown(off.event);
const trigger = [...off.timers.values()][0]; trigger(); trigger();
assert.equal(off.boots, 1); assert.equal(off.capture, false); off.cleanup();

for (const state of ["awake", "asleep"]) {
  let begins = 0, ends = 0, cancels = 0;
  const f = fixture(false, { state, begin() { begins++; }, end() { ends++; }, cancel() { cancels++; } });
  f.handlers.onPointerDown(f.event);
  assert.equal(begins, 1); assert.equal(f.timers.size, 0, "runtime hold must not start Hero boot timer");
  f.handlers.onPointerMove(f.event);
  f.handlers.onPointerUp(f.event);
  assert.equal(ends, 1); assert.equal(cancels, 0); assert.equal(f.boots, 0);
  for (const cancel of [() => f.handlers.onPointerCancel(f.event), () => f.handlers.onLostPointerCapture(f.event), () => f.listeners.get("blur")(), () => { f.doc.hidden = true; f.listeners.get("visibilitychange")(); }]) {
    f.handlers.onPointerDown(f.event); cancel();
    f.handlers.onPointerUp(f.event);
    assert.equal(ends, 1, "cancel must not trigger sleep/wake");
  }
  assert.equal(cancels, 4);
  f.handlers.onPointerDown(f.event); f.cleanup(); assert.equal(cancels, 5);
}
console.log("PASS: first-boot short/long press; awake/asleep runtime routing; no runtime Hero boot timer; capture and cancellation paths.");
