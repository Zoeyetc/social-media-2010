// Actual App controller/reducers/effects with deterministic host hooks and time.
// DOM projection, visual continuity and Safari gestures still require browser QA.
import assert from "node:assert/strict";
import { createServer } from "vite";

let clock = 100000, slots = [], cursor = 0, dirty = true, pending = [], view;
const timers = new Map(), listeners = new Map();
let nextTimer = 0, eraseCount = 0, initializeCount = 0, sceneSelections = 0;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const hooks = {
  useState(initial) {
    const i = cursor++;
    slots[i] ??= { value: typeof initial === "function" ? initial() : initial };
    return [slots[i].value, value => { const next = typeof value === "function" ? value(slots[i].value) : value; if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; } }];
  },
  useReducer(reducer, initial, initialize) {
    const [value, set] = hooks.useState(() => initialize ? initialize(initial) : initial);
    const i = cursor - 1;
    slots[i].dispatch ??= action => set(state => reducer(state, action));
    return [value, slots[i].dispatch];
  },
  useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
  useCallback(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
  useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { pending.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); } },
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
    if (/\/src\/device\/(?:App|use[A-Z]\w*)\.tsx?$/.test(id)) return code.replace('from "react";', 'from "virtual:lifecycle-hooks";');
    if (id.endsWith("/src/world/cameraVideoScenes.ts")) return code.replace("  const random = options.random ?? Math.random;", "  globalThis.__sceneSelected();\n  const random = options.random ?? Math.random;");
  },
}] });
try {
  const { App } = await server.ssrLoadModule("/src/device/App.tsx");
  const device = await server.ssrLoadModule("/src/state/deviceMachine.ts");
  const { initialVoiceMemoState } = await server.ssrLoadModule("/src/state/voiceMemoRecorder.ts");
  const { createMockPublicTwitterSubmissionRepository } = await server.ssrLoadModule("/src/data/mockPublicTwitterSubmissionRepository.ts");
  const world = createMockPublicTwitterSubmissionRepository();
  const draft = { publicHandle: "visitor", body: "hello", simulated2010CreatedAt: device.SESSION_START_ISO, simulatedElapsedMs: 0, idempotencyKey: "preserve" };
  const accepted = await world.submit(draft);
  const flush = async () => {
    for (let n = 0; n < 100; n++) {
      if (dirty) { dirty = false; cursor = 0; App({ presenter: "hero", renderHero: props => { view = props; return null; } }); const effects = pending; pending = []; effects.forEach(fn => fn()); }
      await Promise.resolve();
      if (!dirty && !pending.length && n > 5) return;
    }
    throw Error("controller did not settle");
  };
  const tick = async ms => {
    clock += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= clock) { if (timer.delay) timer.at = clock + timer.delay; else timers.delete(id); timer.fn(); }
    await flush();
  };
  await flush();
  assert.equal(microphoneRequests, 0, "mounting the real hook must not request microphone permission");
  const baselineTimers = timers.size;
  const ids = [];
  for (let run = 0; run < 2; run++) {
    assert.equal(view.lifecycle.phase, "identity");
    assert.deepEqual(view.screen.props.apps.voiceMemos.state, initialVoiceMemoState(), "each Hero run starts with clean Voice Memos state");
    view.startExperience({ name: `Visitor ${run}` });
    view.startExperience({ name: "duplicate" });
    await flush();
    const id = view.lifecycleDiagnostics.experienceSessionId; assert.ok(id); ids.push(id);
    assert.equal(view.lifecycle.phase, "detaching");
    assert.equal(view.lifecycleDiagnostics.sessionStartedAt, null);
    assert.equal(view.lifecycleDiagnostics.cameraSceneSessionId, id);
    assert.equal(sceneSelections, run + 1);
    view.onLifecycleAction({ type: "DETACH_COMPLETE" }); await flush();
    assert.equal(view.lifecycle.phase, "inspect");
    await tick(60000); assert.equal(view.lifecycleDiagnostics.elapsedMs, 0);
    const bootStartedAt = clock;
    view.onLifecycleAction({ type: "PRESS_POWER", startedAt: bootStartedAt }); await flush();
    assert.equal(view.lifecycle.phase, "powering-on");
    view.onLifecycleAction({ type: "ALIGN_COMPLETE" }); await flush();
    view.onHandoff(); await flush();
    assert.equal(view.lifecycleDiagnostics.sessionStartedAt, null, "early handoff cannot consume narrative time");
    await tick(20000);
    view.onHandoff(); view.onLifecycleAction({ type: "BOOT_COMPLETE", now: clock }); await flush();
    assert.equal(view.lifecycle.phase, "experience");
    const t0 = view.lifecycleDiagnostics.sessionStartedAt;
    assert.equal(t0, clock); assert.equal(view.lifecycleDiagnostics.elapsedMs, 0);
    assert.equal(view.screen.props.apps.messagesState.draft, "");
    assert.equal(view.screen.props.apps.messagesState.messages.some(message => message.id === "mom-home-yet"), false);
    const initialMessagesBadgeCount = view.screen.props.navigation.messagesBadgeCount;
    assert.equal(view.screen.props.overlays.activeLockNotification, null, "new user has no previous notification");
    assert.equal(view.screen.props.navigation.notificationBadgeCounts.facebook, 0);
    view.screen.props.actions.completeScreenUnlock(); await flush();
    assert.equal(view.lifecycleDiagnostics.softwarePhase, "passcode", "slide-to-unlock routes into the passcode gate");
    const passcode = view.screen.props.display.session.passcode;
    assert.match(passcode, /^\d{4}$/);
    const wrongPasscode = passcode === "0000" ? "0001" : "0000";
    view.screen.props.actions.attemptScreenPasscode(wrongPasscode); await flush();
    assert.equal(view.screen.props.display.session.passcodeAttempts, 1);
    await tick(1000);
    assert.equal(view.lifecycleDiagnostics.elapsedMs, 1000, "passcode lockout leaves the world clock running");
    view.powerControl.begin(); view.powerControl.end(); await flush();
    assert.equal(view.powerControl.state, "asleep");
    view.powerControl.begin(); view.powerControl.end(); await flush();
    assert.equal(view.powerControl.state, "awake");
    view.screen.props.actions.completeScreenUnlock(); await flush();
    assert.equal(view.lifecycleDiagnostics.softwarePhase, "passcode", "wake returns through the lockscreen gate");
    assert.equal(view.screen.props.display.session.passcodeAttempts, 1, "sleep/wake does not clear passcode access state");
    view.screen.props.actions.attemptScreenPasscode(view.screen.props.display.session.passcode); await flush();
    assert.equal(view.lifecycleDiagnostics.softwarePhase, "springboard");
    view.screen.props.navigation.launchSpringBoardApp("camera"); await flush();
    view.screen.props.navigation.dispatchAppRuntime({ type: "ANIMATION_COMPLETE" }); await flush();
    assert.equal(view.screen.props.camera.cameraRuntime.cameraApp.phase, "previewing");
    assert.equal(sceneSelections, run + 1, "Camera open does not reroll");
    const memos = view.screen.props.apps.voiceMemos.controller;
    await memos.record(true); await flush();
    memos.stop(); await flush();
    assert.equal(view.screen.props.apps.voiceMemos.state.recordings.length, 1);
    await memos.record(true); await flush();
    assert.equal(view.screen.props.apps.voiceMemos.state.phase, "recording", "leave transient recording active through lifecycle reset");
    assert.equal(microphoneRequests, 0, "simulation must not request a real microphone");
    view.screen.props.apps.dispatchMessages({ type: "EDIT_DRAFT", value: "session-only" }); await flush();
    view.powerControl.begin(); view.powerControl.end(); await flush();
    assert.equal(view.powerControl.state, "asleep");
    view.powerControl.begin(); view.powerControl.end(); await flush();
    assert.equal(view.powerControl.state, "awake");
    assert.equal(view.lifecycleDiagnostics.experienceSessionId, id);
    assert.equal(view.lifecycleDiagnostics.sessionStartedAt, t0);
    assert.equal(sceneSelections, run + 1, "sleep/wake does not reroll Camera");
    await tick(60000);
    assert.equal(view.screen.props.apps.messagesState.messages.filter(message => message.id === "mom-home-yet").length, 1, "scheduler can deliver again in each new run");
    assert.equal(view.screen.props.navigation.messagesBadgeCount, initialMessagesBadgeCount + 1);
    assert.equal(view.screen.props.overlays.activeLockNotification.id, "mom-home-yet");
    await tick(95000);
    assert.equal(view.screen.props.navigation.notificationBadgeCounts.facebook, 2, "existing scheduler delivers request and direct message");
    assert.equal(view.lifecycleDiagnostics.softwarePhase, "sleeping", "social alerts do not wake the phone");
    view.powerControl.begin(); view.powerControl.end(); await flush();
    // SMS stays first; social arrivals cannot replace it or overlap it.
    assert.equal(view.screen.props.overlays.activeLockNotification.id, "mom-home-yet");
    view.screen.props.actions.openLockNotificationTarget(view.screen.props.overlays.activeLockNotification); await flush();
    assert.equal(view.lifecycleDiagnostics.softwarePhase, "passcode");
    view.screen.props.actions.attemptScreenPasscode(view.screen.props.display.session.passcode); await flush();
    assert.equal(view.screen.props.navigation.appRuntime.activeAppId, "messages");
    assert.equal(view.screen.props.display.session.activeWarning, 20);
    assert.equal(view.screen.props.overlays.appNotification, null, "real low-battery warning has priority over the queued app alert");
    view.screen.props.actions.dismissScreenBatteryWarning(); await flush();
    assert.equal(view.screen.props.overlays.appNotification.id, "facebook-jack-request");
    view.screen.props.actions.setNotificationKeyboardVisible(true); await flush();
    assert.equal(view.screen.props.overlays.appNotification, null, "keyboard defers without consuming queue");
    view.screen.props.actions.setNotificationKeyboardVisible(false); await flush();
    assert.equal(view.screen.props.overlays.appNotification.id, "facebook-jack-request");
    view.screen.props.actions.dismissScreenSMSAlert(); await flush();
    assert.equal(view.screen.props.overlays.appNotification.id, "facebook-katie-jack-gossip-message");
    view.screen.props.actions.viewScreenAppAlert(); await flush();
    assert.equal(view.screen.props.navigation.appRuntime.activeAppId, "facebook", "View suspends previous app and routes to existing destination");
    assert.equal(view.screen.props.navigation.notificationBadgeCounts.facebook, 0);
    assert.equal(view.screen.props.overlays.appNotification, null);
    // Keep awake so the June delivery tests same-app foreground suppression.
    for (const delay of [50000, 50000, 15000]) { view.onUserActivity(); await flush(); await tick(delay); }
    assert.equal(view.lifecycleDiagnostics.elapsedMs, 271000, "the passcode access check advances canonical experience time");
    assert.equal(view.screen.props.navigation.appRuntime.activeAppId, "facebook");
    assert.equal(view.screen.props.apps.facebookState.inboxThreads.some(thread => thread.id === "june-live-message"), true, "same-app delivery still updates app data");
    assert.equal(view.screen.props.overlays.appNotification, null);
    assert.equal(view.screen.props.navigation.notificationBadgeCounts.facebook, 0);
    await tick(240000);
    // Social delivery never wakes a sleeping phone. Queued until manual wake.
    assert.equal(view.lifecycleDiagnostics.softwarePhase, "sleeping");
    view.powerControl.begin(); view.powerControl.end(); await flush();
    assert.equal(view.screen.props.overlays.activeLockNotification.id, "foursquare-friend-checkin");
    await tick(390000);
    assert.equal(view.lifecycle.phase, "power-loss");
    assert.equal(view.lifecycle.terminalFired, true);
    view.simulateExperienceEnd(); view.simulateExperienceEnd(); await flush();
    assert.equal(view.lifecycle.phase, "power-loss");
    for (const phase of ["power-loss", "returning", "recharging"]) {
      assert.equal(view.lifecycle.phase, phase);
      assert.equal(view.lifecycleDiagnostics.experienceSessionId, id);
      view.onLifecycleAction({ type: "ADVANCE_RETURN", from: phase }); await flush();
    }
    assert.equal(view.lifecycle.phase, "identity");
    assert.equal(view.lifecycle.resetGeneration, run + 1);
    assert.equal(view.lifecycleDiagnostics.experienceSessionId, null);
    assert.deepEqual(view.screen.props.apps.voiceMemos.state, initialVoiceMemoState(), "canonical reset clears active recording and prior memos");
    assert.deepEqual(memos.getState(), initialVoiceMemoState(), "controller resources reset with the hook state");
    assert.equal(view.screen.props.apps.messagesState.draft, "");
    assert.equal(view.screen.props.navigation.appRuntime.phase, "none");
    assert.equal(view.screen.props.navigation.notificationBadgeCounts.facebook, 0);
    assert.equal(view.screen.props.navigation.messagesBadgeCount, initialMessagesBadgeCount);
    assert.equal(view.screen.props.overlays.appNotification, null);
    assert.equal(view.screen.props.overlays.activeLockNotification, null);
    assert.equal(timers.size, baselineTimers, "no accumulated session timers");
    assert.deepEqual(await world.submit(draft), accepted, "world submission remains idempotently accepted");
  }
  assert.notEqual(ids[0], ids[1]);
  assert.equal(sceneSelections, 2);
  assert.equal(eraseCount, 2); assert.equal(initializeCount, 2);
  slots.forEach(slot => slot?.cleanup?.());
  assert.equal(timers.size, 0); assert.equal(listeners.size, 0);
  assert.equal(microphoneRequests, 0);
  console.log("PASS: actual App two-run lifecycle, unique IDs, T0 handoff, terminal once, sleep/wake continuity, per-session Camera Roll bootstrap, timer cleanup; resource/world persistence checks.");
} finally {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else delete globalThis.navigator;
  Date.now = realDateNow; performance.now = realPerformanceNow; await server.close();
}
