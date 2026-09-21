// Actual App controller/reducers/effects with deterministic host hooks and time.
// DOM projection, visual continuity and Safari gestures still require browser QA.
import assert from "node:assert/strict";
import { createServer } from "vite";

let clock = 100000, slots = [], cursor = 0, dirty = true, pending = [], view, tree;
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
    if (id.endsWith("/src/device/DeviceRoot.tsx")) return code.replace('import { lazy, Suspense, useState } from "react";', 'import { lazy, Suspense } from "react"; import { useState } from "virtual:lifecycle-hooks";');
    if (id.endsWith("/src/device/useVoiceMemos.ts")) return code.replace('from "react";', 'from "virtual:lifecycle-hooks";');
    if (id.endsWith("/src/device/App.tsx")) return code.replace('from "react";', 'from "virtual:lifecycle-hooks";').replaceAll("import.meta.env.DEV", process.argv.includes("--production") ? "false" : "true");
    if (id.endsWith("/src/world/cameraVideoScenes.ts")) return code.replace("  const random = options.random ?? Math.random;", "  globalThis.__sceneSelected();\n  const random = options.random ?? Math.random;");
  },
}] });
const walk = node => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const realFormData = globalThis.FormData;
globalThis.FormData = class { constructor(values) { this.values=values; } get(key) { return this.values[key]; } };
function projectSoftware(tree) {
  const nodes=walk(tree), screen=nodes.find(node=>node.type?.name==='DeviceScreen');
  const power=nodes.find(node=>node.props?.['aria-label']==='Power button');
  const surface=nodes.find(node=>node.props?.['aria-label']==='Black iPhone 4');
  return {screen, powerControl: {begin:()=>power.props.onPointerDown(),end:()=>power.props.onPointerUp(),state:screen?.props.display.session.phase==='sleeping'?'asleep':'awake'},
    onUserActivity:()=>surface.props.onPointerDownCapture(),
    startExperience:({name})=>nodes.find(node=>node.type==='form').props.onSubmit({preventDefault(){},currentTarget:{name}}),
    sessionDiagnostics:{experienceSessionId:screen?.props.display.session.experienceSessionId,sessionStartedAt:screen?.props.display.session.sessionStartEpochMs,
      elapsedMs:screen?.props.display.elapsed,softwarePhase:screen?.props.display.session.phase},
  };
}
try {
  const { DeviceRoot } = await server.ssrLoadModule("/src/device/DeviceRoot.tsx");
  const device = await server.ssrLoadModule("/src/state/deviceMachine.ts");
  const { createMockPublicTwitterSubmissionRepository } = await server.ssrLoadModule("/src/data/mockPublicTwitterSubmissionRepository.ts");
  const world = createMockPublicTwitterSubmissionRepository();
  const draft = { publicHandle: "visitor", body: "hello", simulated2010CreatedAt: device.SESSION_START_ISO, simulatedElapsedMs: 0, idempotencyKey: "preserve" };
  const accepted = await world.submit(draft);
  const flush = async () => {
    for (let n = 0; n < 100; n++) {
      if (dirty) { dirty = false; cursor = 0; const runtime = DeviceRoot({presenter:"legacy"}); tree=runtime.type(runtime.props); view=projectSoftware(tree); const effects = pending; pending = []; effects.forEach(fn => fn()); }
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
  const baselineTimers = timers.size;
  const ids = [];
  for (let run = 0; run < 2; run++) {
    assert.ok(walk(tree).find(node=>node.type==='form'));
    view.startExperience({ name: `Visitor ${run}` }); await flush();
    const id=view.sessionDiagnostics.experienceSessionId;assert.ok(id);ids.push(id);
    assert.equal(view.sessionDiagnostics.sessionStartedAt,null);
    assert.equal(sceneSelections,run+1);
    view.powerControl.begin();await tick(device.POWER_HOLD_MS);view.powerControl.end();await flush();
    assert.equal(view.sessionDiagnostics.softwarePhase,'booting');
    await tick(device.BOOT_DURATION_MS);
    assert.equal(view.sessionDiagnostics.softwarePhase,'locked');
    const t0 = view.sessionDiagnostics.sessionStartedAt;
    assert.equal(t0, clock); assert.equal(view.sessionDiagnostics.elapsedMs, 0);
    assert.equal(view.screen.props.apps.messagesState.draft, "");
    assert.equal(view.screen.props.apps.messagesState.messages.some(message => message.id === "mom-home-yet"), false);
    assert.deepEqual(view.screen.props.apps.basicSystemApps.calendar, {year:2010,month:9,day:20});
    assert.equal(view.screen.props.apps.basicSystemApps.maps.selectedVenueId,null);
    assert.equal(view.screen.props.apps.basicSystemApps.calculator.display,"0");
    assert.deepEqual(view.screen.props.apps.iTunesState,{selectedIndex:null,playRequested:false});
    assert.equal(view.screen.props.apps.remainingBasicApps.heading,0);
    assert.equal(view.screen.props.apps.remainingBasicApps.stopwatch.startedAt,null);
    assert.deepEqual(view.screen.props.apps.voiceMemos.state.recordings,[]);
    const publicState = view.screen.props.apps.publicTwitterState;
    assert.equal(publicState.pendingSubmission, null, "session starts without a stale public intent");
    if (process.argv.includes("--production")) assert.deepEqual(publicState.approvedPosts, [], "production never loads mock archive");
    assert.ok(view.screen.props.apps.messagesState.messages.some(m=>m.conversationId==="dad"),"canonical Dad restored on new run");
    const initialMessagesBadgeCount = view.screen.props.navigation.messagesBadgeCount;
    assert.equal(view.screen.props.overlays.activeLockNotification, null, "new user has no previous notification");
    assert.equal(view.screen.props.navigation.notificationBadgeCounts.facebook, 0);
    view.screen.props.actions.completeScreenUnlock(); await flush();
    view.screen.props.actions.attemptScreenPasscode(view.screen.props.display.session.passcode); await flush();
    assert.equal(view.sessionDiagnostics.softwarePhase, "springboard");
    for (const key of ["2","+","3","="]) view.screen.props.apps.dispatchBasicSystemApps({type:"CALCULATOR_KEY",key});
    view.screen.props.apps.dispatchBasicSystemApps({type:"CALENDAR_MONTH",delta:1}); await flush();
    view.screen.props.navigation.launchSpringBoardApp("foursquare"); await flush();
    view.screen.props.navigation.dispatchAppRuntime({type:"ANIMATION_COMPLETE"}); await flush();
    view.screen.props.apps.dispatchFoursquare({type:"OPEN_VENUE",venueId:"main-street-diner",scrollPosition:80});
    view.screen.props.apps.dispatchFoursquare({type:"SHOW_VENUE_INFO"}); await flush();
    const beforeMaps = view.screen.props.apps.foursquareState;
    view.screen.props.apps.openSystemMap("night-owl"); await flush();
    assert.equal(view.screen.props.navigation.appRuntime.activeAppId,"foursquare");
    view.screen.props.apps.openSystemMap("main-street-diner"); await flush();
    assert.equal(view.screen.props.navigation.appRuntime.activeAppId,"maps");
    assert.equal(view.screen.props.apps.basicSystemApps.maps.selectedVenueId,"main-street-diner");
    view.screen.props.navigation.dispatchAppRuntime({type:"ANIMATION_COMPLETE"}); await flush();
    view.screen.props.actions.selectScreenMultitaskingApp("foursquare"); await flush();
    view.screen.props.navigation.dispatchAppRuntime({type:"ANIMATION_COMPLETE"}); await flush();
    assert.deepEqual(view.screen.props.apps.foursquareState,beforeMaps);
    assert.equal(view.screen.props.apps.basicSystemApps.calculator.display,"5");
    assert.equal(view.screen.props.apps.basicSystemApps.calendar.month,10);
    view.screen.props.navigation.dispatchAppRuntime({type:"SUSPEND"}); await flush();
    view.screen.props.apps.dispatchRemainingBasicApps({type:"HEADING",heading:405});
    view.screen.props.apps.dispatchRemainingBasicApps({type:"STOPWATCH_START",now:clock});
    await view.screen.props.apps.voiceMemos.controller.record(true); await flush();
    view.screen.props.apps.voiceMemos.controller.stop(); await flush();
    assert.equal(view.screen.props.apps.remainingBasicApps.heading,45);
    assert.equal(view.screen.props.apps.voiceMemos.state.recordings.length,1);
    for (const appId of ["clock","compass","voice-memos","whatsapp","skype"]) {
      view.screen.props.navigation.launchSpringBoardApp(appId); await flush();
      view.screen.props.navigation.dispatchAppRuntime({type:"ANIMATION_COMPLETE"}); await flush();
      assert.equal(view.screen.props.navigation.appRuntime.activeAppId,appId);
      view.screen.props.navigation.dispatchAppRuntime({type:"SUSPEND"}); await flush();
      view.screen.props.actions.selectScreenMultitaskingApp(appId); await flush();
      view.screen.props.navigation.dispatchAppRuntime({type:"ANIMATION_COMPLETE"}); await flush();
      assert.equal(view.screen.props.navigation.appRuntime.activeAppId,appId);
      assert.equal(view.screen.props.apps.remainingBasicApps.heading,45);
      assert.notEqual(view.screen.props.apps.remainingBasicApps.stopwatch.startedAt,null);
      assert.equal(view.screen.props.apps.voiceMemos.state.recordings.length,1);
      view.screen.props.navigation.dispatchAppRuntime({type:"SUSPEND"}); await flush();
    }

    const deletedDadUnread = view.screen.props.apps.messagesState.messages.filter(m=>m.conversationId==="dad" && m.status==="unread").length;
    view.screen.props.apps.dispatchMessages({type:"TOGGLE_LIST_EDIT"});
    view.screen.props.apps.dispatchMessages({type:"SELECT_DELETE_CONVERSATION",conversationId:"dad"});
    view.screen.props.apps.dispatchMessages({type:"DELETE_CONVERSATION",conversationId:"dad"});
    view.screen.props.apps.dispatchMessages({type:"TOGGLE_LIST_EDIT"});await flush();
    for (const appId of ["safari","youtube","itunes"]) {
      view.screen.props.navigation.launchSpringBoardApp(appId); await flush();
      view.screen.props.navigation.dispatchAppRuntime({type:"ANIMATION_COMPLETE"}); await flush();
      assert.equal(view.screen.props.navigation.appRuntime.activeAppId,appId);
      assert.ok(!view.screen.props.apps.messagesState.messages.some(m=>m.conversationId==="dad"),"deleted thread stays absent on switching");
      if(appId==="itunes") {view.screen.props.apps.dispatchITunes({type:"SELECT",index:3});view.screen.props.apps.dispatchITunes({type:"PLAY"});await flush();}
      let home=walk(tree).find(n=>n.props?.["aria-label"]==="Home button");
      const pointer={pointerId:1,currentTarget:{setPointerCapture(){},releasePointerCapture(){}}};
      home.props.onPointerDown(pointer);await flush();
      home=walk(tree).find(n=>n.props?.["aria-label"]==="Home button");home.props.onPointerUp(pointer);await tick(350);
      assert.equal(view.sessionDiagnostics.softwarePhase,"springboard",`${appId} Home returns`);
      view.screen.props.actions.selectScreenMultitaskingApp(appId);await flush();
      view.screen.props.navigation.dispatchAppRuntime({type:"ANIMATION_COMPLETE"});await flush();
      assert.equal(view.screen.props.navigation.appRuntime.activeAppId,appId);
      assert.ok(!view.screen.props.apps.messagesState.messages.some(m=>m.conversationId==="dad"),"deleted thread stays absent on switching");
      if(appId==="itunes")assert.deepEqual(view.screen.props.apps.iTunesState,{selectedIndex:3,playRequested:true});
      view.screen.props.navigation.dispatchAppRuntime({type:"SUSPEND"});await flush();
    }
    view.screen.props.navigation.launchSpringBoardApp("camera"); await flush();
    view.screen.props.navigation.dispatchAppRuntime({ type: "ANIMATION_COMPLETE" }); await flush();
    assert.equal(view.screen.props.camera.cameraRuntime.cameraApp.phase, "previewing");
    assert.equal(sceneSelections, run + 1, "Camera open does not reroll");
    view.screen.props.apps.dispatchMessages({ type: "EDIT_DRAFT", value: "session-only" }); await flush();
    view.powerControl.begin(); view.powerControl.end(); await flush();
    assert.equal(view.powerControl.state, "asleep");
    view.powerControl.begin(); view.powerControl.end(); await flush();
    assert.equal(view.powerControl.state, "awake");
    assert.equal(view.sessionDiagnostics.experienceSessionId, id);
    assert.equal(view.sessionDiagnostics.sessionStartedAt, t0);
    assert.equal(sceneSelections, run + 1, "sleep/wake does not reroll Camera");
    await tick(t0 + 60000 - clock); // Keep the existing timeline checkpoint despite Home double-click waits.
    assert.equal(view.screen.props.apps.messagesState.messages.filter(message => message.id === "mom-home-yet").length, 1, "scheduler can deliver again in each new run");
    assert.equal(view.screen.props.navigation.messagesBadgeCount, initialMessagesBadgeCount - deletedDadUnread + 1);
    assert.equal(view.screen.props.overlays.activeLockNotification.id, "mom-home-yet");
    await tick(95000);
    assert.equal(view.screen.props.navigation.notificationBadgeCounts.facebook, 2, "existing scheduler delivers request and direct message");
    assert.equal(view.sessionDiagnostics.softwarePhase, "sleeping", "social alerts do not wake the phone");
    view.powerControl.begin(); view.powerControl.end(); await flush();
    // SMS stays first; social arrivals cannot replace it or overlap it.
    assert.equal(view.screen.props.overlays.activeLockNotification.id, "mom-home-yet");
    view.screen.props.actions.openLockNotificationTarget(view.screen.props.overlays.activeLockNotification); await flush();
    assert.equal(view.sessionDiagnostics.softwarePhase, "passcode");
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
    assert.equal(view.sessionDiagnostics.elapsedMs, 270000);
    assert.equal(view.screen.props.navigation.appRuntime.activeAppId, "facebook");
    assert.equal(view.screen.props.apps.facebookState.inboxThreads.some(thread => thread.id === "june-live-message"), true, "same-app delivery still updates app data");
    assert.equal(view.screen.props.overlays.appNotification, null);
    assert.equal(view.screen.props.navigation.notificationBadgeCounts.facebook, 0);
    await tick(240000);
    // Social delivery never wakes a sleeping phone. Queued until manual wake.
    assert.equal(view.sessionDiagnostics.softwarePhase, "sleeping");
    view.powerControl.begin(); view.powerControl.end(); await flush();
    assert.equal(view.screen.props.overlays.activeLockNotification.id, "foursquare-friend-checkin");
    await tick(380000);
    assert.ok(view.screen.props.apps.twitterState.timeline.some(tweet => tweet.id === "terminal-goodnight-world"), "T+890 survives cutoff");
    await tick(5000);
    view.screen.props.actions.scheduleScreenMomReply(); await flush();
    view.screen.props.actions.scheduleScreenMomLoveReply(); await flush();
    assert.ok(!view.screen.props.display.session.deviceEvents.some(event => event.dueElapsedMs > device.SESSION_DURATION_MS), "late dynamic replies never admitted");
    const notificationState = () => slots.find(slot => slot?.value?.unread && Array.isArray(slot.value.delivered))?.value;
    const claimsBeforeResume = [...notificationState().delivered];
    const deliveredBeforeResume = [...view.screen.props.display.session.deliveredTimelineEventIds];
    const messagesBeforeResume = view.screen.props.apps.messagesState.messages.length;
    // Browser timer jumps directly past the terminal boundary; no app catch-up.
    await tick(10000);
    assert.deepEqual(view.screen.props.display.session.deliveredTimelineEventIds, deliveredBeforeResume);
    assert.ok(view.screen.props.apps.messagesState.messages.length <= messagesBeforeResume, "no late messages; terminal reset may already have cleared runtime messages");
    assert.ok(notificationState().delivered.every(claim => claimsBeforeResume.includes(claim)), "rejected late events create no notification claims");
    await tick(2000); // terminal warning presentation completes, canonical reset follows

    assert.deepEqual(view.screen.props.apps.basicSystemApps.calendar,{year:2010,month:9,day:20});
    assert.equal(view.screen.props.apps.basicSystemApps.calculator.display,"0");
    assert.deepEqual(view.screen.props.apps.iTunesState,{selectedIndex:null,playRequested:false});
    assert.equal(view.screen.props.apps.remainingBasicApps.heading,0);
    assert.equal(view.screen.props.apps.remainingBasicApps.stopwatch.startedAt,null);
    assert.deepEqual(view.screen.props.apps.voiceMemos.state.recordings,[]);
    assert.equal(view.screen.props.apps.basicSystemApps.maps.selectedVenueId,null);
    assert.deepEqual(notificationState().delivered, [], "terminal reset clears notification claims");
    assert.equal(view.screen.props.apps.messagesState.draft, "");
    assert.equal(view.screen.props.navigation.appRuntime.phase, "none");
    assert.equal(view.screen.props.navigation.notificationBadgeCounts.facebook, 0);
    assert.equal(view.screen.props.navigation.messagesBadgeCount, initialMessagesBadgeCount);
    assert.equal(view.screen.props.overlays.appNotification, null);
    assert.equal(view.screen.props.overlays.activeLockNotification, null);
    await tick(5000); await tick(5000);
    assert.ok(walk(tree).find(node=>node.type==='form'));
    assert.equal(timers.size, baselineTimers, "no accumulated session timers");
    assert.deepEqual(await world.submit(draft), accepted, "world submission remains idempotently accepted");
  }
  assert.notEqual(ids[0], ids[1]);
  assert.equal(sceneSelections, 2);
  assert.equal(eraseCount, 2); assert.equal(initializeCount, 2);
  slots.forEach(slot => slot?.cleanup?.());
  assert.equal(timers.size, 0); assert.equal(listeners.size, 0);
  console.log("PASS: actual App two-run lifecycle, unique IDs, software boot/reset, sleep/wake continuity, per-session Camera Roll bootstrap, timer cleanup; resource/world persistence checks.");
} finally { globalThis.FormData=realFormData; Date.now = realDateNow; performance.now = realPerformanceNow; await server.close(); }
