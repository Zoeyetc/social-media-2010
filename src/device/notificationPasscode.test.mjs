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
  const phase = () => view.screen.props.display.session.phase;
  const code = () => view.screen.props.display.session.passcode;
  const action = async (name, ...args) => { view.screen.props.actions[name](...args); await flush(); };
  const start = async () => {
    view.startExperience({name: "Auth QA"}); await flush();
    view.onLifecycleAction({type:"DETACH_COMPLETE"}); await flush();
    view.onLifecycleAction({type:"PRESS_POWER",startedAt:clock}); await flush();
    view.onLifecycleAction({type:"ALIGN_COMPLETE"}); await flush();
    await tick(20000); view.onHandoff(); view.onLifecycleAction({type:"BOOT_COMPLETE",now:clock}); await flush();
  };
  const wake = async () => { if(phase()==="sleeping"){view.powerControl.begin();view.powerControl.end();await flush();} };
  await start();
  await action("completeScreenUnlock"); assert.equal(phase(),"passcode");
  await action("attemptScreenPasscode",code()); assert.equal(phase(),"springboard", "I: ordinary unlock");
  view.powerControl.begin();view.powerControl.end();await flush();
  await tick(60000); await wake();
  const sms=view.screen.props.overlays.activeLockNotification; assert.ok(sms); assert.equal(sms.target.type,"messagesConversation");
  assert.equal(phase(),"locked","A: arrival cannot unlock");
  await action("openLockNotificationTarget",sms); assert.equal(phase(),"passcode","B: selection requires authentication");
  assert.notEqual(view.screen.props.navigation.appRuntime.activeAppId,"messages");
  await action("cancelScreenPasscode");assert.equal(phase(),"locked","H: cancel does not navigate");
  assert.equal(view.screen.props.overlays.activeLockNotification.id,sms.id,"cancel preserves alert");
  await action("completeScreenUnlock");await action("attemptScreenPasscode",code());
  assert.equal(phase(),"springboard","cancel cleared navigation intent");
  view.powerControl.begin();view.powerControl.end();await flush();await wake();
  await action("viewScreenSMSAlert");assert.equal(phase(),"passcode","SMS alert View also uses auth gate");
  for(let attempt=0;attempt<5;attempt++){
    await action("attemptScreenPasscode","0000");assert.equal(phase(),"passcode","D/E: wrong code cannot reveal Messages");
    assert.notEqual(view.screen.props.navigation.appRuntime.activeAppId,"messages");
  }
  const deadline=view.screen.props.display.session.passcodeLockoutUntilElapsedMs;assert.ok(deadline);
  const extra={...sms,id:"additional-sms",target:{type:"messagesConversation",conversationId:"dad"}};
  view.screen.props.apps.dispatchMessages({type:"OPEN_CONVERSATION",conversationId:"mom"});await flush();
  view.screen.props.apps.dispatchMessages({type:"EDIT_DRAFT",value:"Yes"});await flush();
  view.screen.props.apps.dispatchMessages({type:"SEND"});await flush();
  await action("scheduleScreenMomReply");
  const badgesBefore = view.screen.props.navigation.messagesBadgeCount;
  // Real scheduled SMS arrives while this lockout is active.
  await tick(30000);await tick(250);assert.equal(phase(),"passcode");
  assert.equal(view.screen.props.navigation.messagesBadgeCount,badgesBefore+1,"F: new SMS delivered during lockout");
  await action("viewScreenSMSAlert");await action("viewScreenAppAlert");
  assert.equal(phase(),"passcode","F: alert callbacks during lockout cannot bypass");
  assert.equal(view.screen.props.display.session.passcodeLockoutUntilElapsedMs,deadline);
  view.powerControl.begin();view.powerControl.end();await flush();assert.equal(phase(),"sleeping");await wake();
  assert.equal(phase(),"locked","G: wake remains locked");
  await action("completeScreenUnlock");await action("attemptScreenPasscode",code());assert.equal(phase(),"passcode");
  assert.equal(view.screen.props.display.session.passcodeLockoutUntilElapsedMs,deadline);
  await tick(30000);await wake();if(phase()==="locked")await action("completeScreenUnlock");
  await action("attemptScreenPasscode",code());assert.equal(phase(),"app","C: valid code releases deferred route");
  assert.equal(view.screen.props.navigation.appRuntime.activeAppId,"messages");
  assert.equal(view.screen.props.apps.messagesState.activeConversationId,sms.target.conversationId);
  view.powerControl.begin();view.powerControl.end();await flush();await wake();
  await action("openLockNotificationTarget",{...sms,id:"social-auth",target:{type:"app",appId:"facebook"}});
  assert.equal(phase(),"passcode","social notifications share the same authentication gate");
  await action("attemptScreenPasscode",code());
  assert.equal(view.screen.props.navigation.appRuntime.activeAppId,"facebook");
  // Leave another destination pending across the canonical end/reset boundary.
  view.powerControl.begin();view.powerControl.end();await flush();await wake();
  await action("openLockNotificationTarget",extra);assert.equal(phase(),"passcode");
  view.simulateExperienceEnd();await flush();
  for(const from of ["power-loss","returning","recharging"]){view.onLifecycleAction({type:"ADVANCE_RETURN",from});await flush();}
  assert.equal(view.lifecycle.phase,"identity");
  await start();await action("completeScreenUnlock");await action("attemptScreenPasscode",code());
  assert.equal(phase(),"springboard","J: reset removes deferred destination");
  assert.notEqual(view.screen.props.navigation.appRuntime.activeAppId,"messages");
  slots.forEach(slot=>slot?.cleanup?.());
  console.log("PASS: notification/passcode A–J through real App: deferred thread, cancel, wrong attempts, lockout, wake, normal unlock and reset.");
} finally {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else delete globalThis.navigator;
  Date.now = realDateNow; performance.now = realPerformanceNow; await server.close();
}
