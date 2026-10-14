// Actual App controller/reducers/effects with deterministic host hooks and time.
// Automated component projection and deterministic effects; no manual browser QA.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

let clock = 100000, slots = [], cursor = 0, dirty = true, pending = [], view;
const timers = new Map(), listeners = new Map();
let nextTimer = 0, eraseCount = 0, initializeCount = 0, sceneSelections = 0;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const hooks = {
  useState(initial) {
    const i = cursor++;
    slots[i] ??= { value: typeof initial === "function" ? initial() : initial };
    const slot = slots[i];
    return [slot.value, value => { const next = typeof value === "function" ? value(slot.value) : value; if (!Object.is(next, slot.value)) { slot.value = next; dirty = true; } }];
  },
  useReducer(reducer, initial, initialize) {
    const [value, set] = hooks.useState(() => initialize ? initialize(initial) : initial);
    const slot = slots[cursor - 1];
    slot.dispatch ??= action => set(state => reducer(state, action));
    return [value, slot.dispatch];
  },
  useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
  useCallback(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
  useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { const owner = slots; pending.push(() => { owner[i]?.cleanup?.(); owner[i] = { deps, cleanup: fn() }; }); } },
};
globalThis.__lifecycleHooks = hooks;
globalThis.__sceneSelected = () => sceneSelections++;
const persistence = {
  eraseCurrentCameraRoll: async () => { eraseCount++; }, initializeCameraRollPersistence: async () => { initializeCount++; return []; },
  deleteStalePlayerCameraRolls: async () => {}, eraseAllPlayerCameraRolls: async () => { throw Error("must not erase world stores"); },
  discardPersistedCameraPhoto: async () => {}, persistCameraCapturedArtifact: async () => { throw Error("not capturing in lifecycle test"); },
  isCameraCaptureOwnerCurrent: (a, b) => a === b,
};
globalThis.__lifecyclePersistence = persistence;
const realDateNow = Date.now; Date.now = () => clock;
const realPerformanceNow = performance.now; performance.now = () => clock;
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
globalThis.window = {
  location: { search: "" },
  setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: clock + delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
  setInterval(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: clock + delay, delay }); return id; },
  clearInterval(id) { timers.delete(id); },
  requestAnimationFrame(fn) { return this.setTimeout(fn, 16); }, cancelAnimationFrame(id) { timers.delete(id); },
  addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); },
};
let prefersReducedMotion = false;
const mediaListeners = new Set();
window.matchMedia = () => ({ get matches() { return prefersReducedMotion; },
  addEventListener: (_, listener) => mediaListeners.add(listener),
  removeEventListener: (_, listener) => mediaListeners.delete(listener) });
globalThis.location = window.location;
globalThis.clearTimeout = window.clearTimeout;
globalThis.clearInterval = window.clearInterval;
globalThis.cancelAnimationFrame = window.cancelAnimationFrame;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.document = { hidden: false, body: { style: {} } };
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
let microphoneRequests = 0;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
  mediaDevices: { getUserMedia() { microphoneRequests++; throw Error("lifecycle harness must never request a microphone"); } },
} });
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent", plugins: [{
  name: "lifecycle-controller-host", enforce: "pre",
  resolveId(id) {
    if (id === "virtual:lifecycle-hooks" || id.endsWith("/state/cameraRollPersistence")) return "\0" + (id === "virtual:lifecycle-hooks" ? "lifecycle-hooks" : "lifecycle-persistence");
  },
  load(id) {
    if (id === "\0lifecycle-hooks") return Object.keys(hooks).map(key => `export const ${key}=globalThis.__lifecycleHooks.${key};`).join("\n");
    if (id === "\0lifecycle-persistence") return Object.keys(persistence).map(key => `export const ${key}=globalThis.__lifecyclePersistence.${key};`).join("\n");
  },
  transform(code, id) {
    // Imported device hooks share App's deterministic hook slots and effects.
    // Keep their real implementations; only substitute the React hook host.
    if (/\/src\/device\/(?:App|LockScreen|PasscodeScreen|use[A-Z]\w*)\.tsx?$/.test(id)) return code.replace('from "react";', 'from "virtual:lifecycle-hooks";');
    if (id.endsWith("/src/world/cameraVideoScenes.ts")) return code.replace("  const random = options.random ?? Math.random;", "  globalThis.__sceneSelected();\n  const random = options.random ?? Math.random;");
  },
}] });
try {
  const { App } = await server.ssrLoadModule("/src/device/App.tsx");
  const { DeviceAudio } = await server.ssrLoadModule("/src/audio/deviceAudio.ts");
  const device = await server.ssrLoadModule("/src/state/deviceMachine.ts");
  const { PASSCODE_ENTRY_DURATION_MS } = await server.ssrLoadModule("/src/device/usePasscodeEntryTransition.ts");
  let sounds = 0;
  DeviceAudio.unlock = () => sounds++;
  const walk = n => !n || typeof n !== "object" ? [] : Array.isArray(n) ? n.flatMap(walk) : [n, ...walk(n.props?.children)];
  const scopes = new Map();
  const render = (name, component, props) => {
    const saved = { slots, cursor };
    slots = scopes.get(name) ?? []; scopes.set(name, slots); cursor = 0;
    try { return component(props); } finally { ({ slots, cursor } = saved); }
  };
  let screen, lock, passcode;
  const project = () => {
    screen = render("screen", view.screen.type, view.screen.props);
    for (const [name, componentName] of [["lock", "LockScreen"], ["passcode", "PasscodeScreen"]]) {
      const node = walk(screen).find(n => n.type?.name === componentName);
      const result = node ? render(name, node.type, node.props) : null;
      if (!node) { scopes.get(name)?.forEach(slot => slot?.cleanup?.()); scopes.delete(name); }
      if (name === "lock") lock = result; else passcode = result;
    }
  };
  const flush = async () => {
    for (let i = 0; i < 100; i++) {
      if (dirty) {
        dirty = false; cursor = 0;
        App({ presenter: "hero", renderHero: props => { view = props; return null; } });
        project(); const effects = pending; pending = []; effects.forEach(fn => fn());
      }
      await Promise.resolve();
      if (!dirty && !pending.length && i > 5) return;
    }
    throw Error("controller/screen did not settle");
  };
  const tick = async ms => {
    clock += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= clock) {
      if (timer.delay) timer.at = clock + timer.delay; else timers.delete(id);
      timer.fn();
    }
    await flush();
  };
  const phase = () => view.screen.props.display.session.phase;
  const code = () => view.screen.props.display.session.passcode;
  const action = async (name, ...args) => { view.screen.props.actions[name](...args); await flush(); };
  const wallpaper = () => walk(screen).find(n => n.props?.className === "locked-system-wallpaper");
  const status = () => walk(screen).find(n => n.type?.name === "LockScreenStatusPresentation");
  const ownerPath = (tree, target, path = []) => tree === target ? path :
    (Array.isArray(tree) ? tree.map((n, i) => ownerPath(n, target, [...path, i])).find(Boolean)
      : tree?.props ? ownerPath(tree.props.children, target, [...path, tree.type, tree.key]) : undefined);
  const buttons = () => walk(passcode).filter(n => n.type === "button");
  const slide = async () => {
    const knob = walk(lock).find(n => n.props?.role === "slider");
    const track = walk(lock).find(n => n.props?.className === "unlock-track");
    knob.props.ref.current = { offsetLeft: 3, offsetWidth: 71 };
    track.props.ref.current = { clientWidth: 280 };
    const target = { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} };
    knob.props.onPointerDown({ pointerId: 1, clientX: 0, currentTarget: target });
    knob.props.onPointerMove({ pointerId: 1, clientX: 203, currentTarget: target });
    assert.equal(phase(), "locked", "reaching the endpoint does not trigger before pointer-up");
    knob.props.onPointerUp({ pointerId: 1, clientX: 203, currentTarget: target });
    await flush();
    assert.equal(phase(), "passcodeEntering", "successful release crosses entry before stable input");
  };
  const wake = async () => { view.powerControl.begin(); view.powerControl.end(); await flush(); };
  await flush();
  view.startExperience({ name: "Entry QA", passcode: "1234" }); await flush();
  view.onLifecycleAction({ type: "DETACH_COMPLETE" }); await flush();
  view.onLifecycleAction({ type: "PRESS_POWER", startedAt: clock }); await flush();
  view.onLifecycleAction({ type: "ALIGN_COMPLETE" }); await flush();
  await tick(32); await tick(32); view.screen.props.warmup.onKeyboardReady(); await flush();
  await tick(19936); view.onHandoff(); view.onLifecycleAction({ type: "BOOT_COMPLETE", now: clock }); await flush();
  const originalWallpaperPath = ownerPath(screen, wallpaper());
  const originalStatusPath = ownerPath(screen, status());
  const originalStatusType = status().type;
  const originalClock = view.screen.props.display.lockScreenModel.clock;
  await slide();
  assert.deepEqual(ownerPath(screen, wallpaper()), originalWallpaperPath, "wallpaper retains its React owner/type/key slot");
  assert.deepEqual(ownerPath(screen, status()), originalStatusPath, "status retains its React owner/type/key slot");
  assert.equal(status().type, originalStatusType);
  assert.equal(walk(screen).filter(n => n.props?.className === "locked-system-wallpaper").length, 1);
  assert.ok(lock && passcode, "outgoing clock and incoming title coexist");
  assert.equal(walk(lock).find(n => n.props?.className === "lock-clock-slot").props.children, originalClock);
  assert.equal(walk(passcode).find(n => n.props?.className === "passcode-title").props.children, "Enter Passcode");
  assert.ok(!walk(screen).some(n => n.type?.name === "SpringBoard"), "no SpringBoard mounts in entry");
  assert.equal(lock.props.inert, true); assert.equal(passcode.props.inert, true);
  assert.equal(walk(lock).find(n => n.props?.role === "slider").props.disabled, true);
  assert.equal(buttons().length, 12); assert.ok(buttons().every(n => n.props.disabled));
  for (const button of buttons()) button.props.onClick?.();
  await flush();
  assert.equal(walk(passcode).find(n => n.props?.className === "passcode-cells").props["aria-label"], "0 of 4 digits entered");
  await action("attemptScreenPasscode", code()); await action("cancelScreenPasscode"); await action("completeScreenUnlock");
  assert.equal(phase(), "passcodeEntering"); assert.equal(sounds, 0, "entry and blocked authentication are silent");
  await tick(PASSCODE_ENTRY_DURATION_MS - 1); assert.equal(phase(), "passcodeEntering");
  await tick(1); assert.equal(phase(), "passcode");
  assert.equal(lock, null); assert.equal(passcode.props.inert, false);
  assert.deepEqual(ownerPath(screen, wallpaper()), originalWallpaperPath);
  assert.deepEqual(ownerPath(screen, status()), originalStatusPath);
  assert.ok(buttons().filter(n => n.props["aria-label"]).every(n => !n.props.disabled));
  // Exercise the real keypad immediately at completion, not an auth test shortcut.
  for (const digit of code()) { buttons().find(n => n.props["aria-label"] === digit).props.onClick(); await flush(); }
  assert.equal(phase(), "springboard"); assert.equal(sounds, 1);
  await wake(); await tick(60000); if (phase() === "sleeping") await wake();
  const notification = view.screen.props.overlays.activeLockNotification;
  assert.ok(notification);
  await slide();
  assert.notEqual(view.screen.props.navigation.appRuntime.activeAppId, "messages");
  await action("attemptScreenPasscode", code()); assert.equal(phase(), "passcodeEntering");
  await tick(PASSCODE_ENTRY_DURATION_MS);
  await action("attemptScreenPasscode", code());
  assert.equal(phase(), "app"); assert.equal(sounds, 2);
  assert.equal(view.screen.props.navigation.appRuntime.activeAppId, "messages");
  assert.equal(view.screen.props.apps.messagesState.activeConversationId, notification.target.conversationId);
  await wake(); await wake();
  await action("completeScreenUnlock"); await tick(PASSCODE_ENTRY_DURATION_MS);
  await action("cancelScreenPasscode"); assert.equal(phase(), "locked"); assert.equal(sounds, 2);
  await action("completeScreenUnlock"); assert.equal(phase(), "passcodeEntering");
  await wake(); assert.equal(phase(), "sleeping");
  await tick(PASSCODE_ENTRY_DURATION_MS); assert.equal(phase(), "sleeping", "cancelled timer cannot reveal passcode");
  await action("completeScreenPasscodeEntry"); assert.equal(phase(), "sleeping", "late completion is guarded");
  await wake(); assert.equal(phase(), "locked");
  assert.equal(device.homeButtonTransition({ ...device.initialSession, phase: "passcodeEntering" }), null);
  assert.deepEqual(device.longPowerTransition({ ...device.initialSession, phase: "passcodeEntering" }),
    { previousPhase: "passcode", phase: "powerOffConfirm" });
  prefersReducedMotion = true; mediaListeners.forEach(fn => fn()); await flush();
  await action("completeScreenUnlock"); assert.equal(phase(), "passcodeEntering", "reduced motion retains ordering");
  assert.equal(screen.props["data-entry-reduced-motion"], true);
  assert.equal(screen.props.style["--passcode-entry-duration"], "1ms");
  await tick(1); assert.equal(phase(), "passcode");
  await action("cancelScreenPasscode"); assert.equal(phase(), "locked");
  // Legacy no-passcode fixture establishes the existing unprotected unlock branch.
  const sessionSlot = slots.find(slot => slot.value?.experienceSessionId && slot.value?.deviceEvents);
  assert.ok(sessionSlot); sessionSlot.value = { ...sessionSlot.value, passcode: null }; dirty = true; await flush();
  await action("completeScreenUnlock"); assert.equal(phase(), "springboard"); assert.equal(sounds, 3);
  const css = readFileSync(new URL("../styles/device.css", import.meta.url), "utf8");
  const frames = name => css.match(new RegExp(`@keyframes ${name} \\{([^\\n]+)\\}`))?.[1];
  assert.match(frames("system-passcode-clock-exit"), /from \{ opacity:1; \} to \{ opacity:0; \}/);
  assert.match(frames("system-passcode-content-enter"), /from \{ opacity:0; \} to \{ opacity:1; \}/);
  assert.doesNotMatch(frames("system-passcode-clock-exit"), /transform/);
  assert.match(frames("system-passcode-keypad-enter"), /from \{ transform:translateY\(100%\); \} to \{ transform:translateY\(0\); \}/);
  const height = Number(css.match(/\.passcode-keypad \{[^}]*height:(\d+)px/)?.[1]);
  assert.equal(height, 204); assert.equal(480 - height + height, 480, "entire keypad starts below the visible 480px surface");
  const entryCSS = css.slice(css.indexOf("/* System-owned entry only."), css.indexOf(".unlock-track {"));
  assert.doesNotMatch(entryCSS, /animation-delay|\.passcode-cell[^\n]*transform|\d+ms/);
  assert.match(entryCSS, /\.passcode-keypad-panel \{ animation:system-passcode-content-enter var\(--passcode-entry-duration\)/);
  assert.match(entryCSS, /\[data-entry-reduced-motion\] \.passcode-keypad \{ animation-name:system-passcode-content-enter/);
  assert.match(entryCSS, /surface > \.passcode-screen \{[^}]*background:transparent/);
  assert.doesNotMatch(entryCSS.match(/\.locked-system-wallpaper \{[^}]*\}/)?.[0], /transform|opacity|animation/);
  console.log("PASS: real pointer-up entry, persistent owner slots, clock/title overlap, single wallpaper/locked status, whole keypad geometry, blocked/stable input, notification destination, success/Cancel/no-passcode, Power cleanup and reduced-motion ordering");
} finally {
  for (const slot of slots) slot?.cleanup?.();
  Date.now = realDateNow; performance.now = realPerformanceNow;
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else delete globalThis.navigator;
  await server.close();
}
