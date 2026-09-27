// Headless ownership/timing checks; not a substitute for Safari visual QA.
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const source = fs.readFileSync(new URL("./HeroController.ts", import.meta.url), "utf8").replace(/^import type .*;\n/gm, "");
const { heroTransition: step, initialHeroState, heroCanStartBoot: power, heroBootOpacity: opacity, HERO_BOOT_DURATION_MS } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
assert.equal(HERO_BOOT_DURATION_MS, 20000);
assert.deepEqual([0, 100, 200, 300, 400, 10000, 19200, 19600, 20000].map(ms => opacity(ms)), [0, 0, .5, 1, 1, 1, 1, .5, 0]);
for (const phase of ["inspect", "front-aligned", "powering-on"]) {
  assert.equal(power({ ...initialHeroState, phase, awaitingPower: true }), true, "availability is semantic, not pose-based");
  assert.equal(power({ ...initialHeroState, phase, awaitingPower: true, bootStartedAt: 100 }), false);
}
for (let loop = 0; loop < 2; loop++) {
  let state = initialHeroState;
  assert.equal(power(state), false);
  state = step(state, { type: "CONFIRM_IDENTITY", name: "Visitor" });
  assert.equal(power(state), false);
  state = step(state, { type: "DETACH_COMPLETE" });
  assert.equal(power(state), true);
  // A front-facing pose is not equivalent to an already-powered phone.
  state = step(state, { type: "JUMP_TO_PHASE", phase: "front-aligned" });
  assert.equal(power(state), true);
  assert.equal(step(state, { type: "ENTER_EXPERIENCE" }), state);
  const startedAt = 1000 + loop * 30000;
  state = step(state, { type: "PRESS_POWER", startedAt });
  assert.equal(power(state), false);
  assert.equal(step(state, { type: "PRESS_POWER", startedAt: startedAt + 10 }), state);
  assert.equal(step(state, { type: "BOOT_COMPLETE", now: startedAt + 20000, bootCriticalReady: true }), state, "alignment must complete first");
  state = step(state, { type: "ALIGN_COMPLETE" });
  for (const ms of [0, 750, 1800, 10000, 19999]) {
    assert.equal(step(state, { type: "BOOT_COMPLETE", now: startedAt + ms, bootCriticalReady: true }), state);
    assert.equal(state.bootComplete, false);
    assert.equal(power(state), false);
  }
  assert.equal(step(state, { type: "BOOT_COMPLETE", now: startedAt + 20000 }), state, "Tier 0 is required");
  state = step(state, { type: "BOOT_COMPLETE", now: startedAt + 20000, bootCriticalReady: true });
  assert.equal(state.phase, "experience");
  assert.equal(state.bootComplete, true);
  assert.equal(step(state, { type: "BOOT_COMPLETE", now: startedAt + 21000 }), state);
  state = step(state, { type: "EXPERIENCE_ENDED" });
  for (const phase of ["power-loss", "returning", "recharging"]) {
    assert.equal(state.phase, phase);
    assert.equal(power(state), false);
    state = step(state, { type: "ADVANCE_RETURN", from: phase });
  }
  assert.equal(state.phase, "resetting");
  assert.equal(state.terminalFired, true);
  state = step(state, { type: "RESET_COMPLETE" });
  assert.deepEqual(state, { ...initialHeroState, resetGeneration: 1 });
}
const hardware = fs.readFileSync(new URL("./useHeroHardware.ts", import.meta.url), "utf8");
assert.match(hardware, /POWER_HOLD_MS = 3000|POWER_HOLD_MS = 3_000/);
assert.match(hardware, /new Vector3\(0\.016, 0\.012, 0\.012\)/);
assert.match(hardware, /POWER_HIT_OFFSET = new Vector3\(0, 0\.003, 0\.006\)/);
const portal = fs.readFileSync(new URL("./ScreenPortal.tsx", import.meta.url), "utf8");
assert.match(portal, /applelogo-iphone3,1-8B117\.png\?inline/);
assert.match(portal, /left: 112, top: 160, width: 96, height: 160/);
assert.equal((portal.match(/\{software\}/g) ?? []).length, 1);
assert.ok(!fs.existsSync(new URL("./heroBootLogoMaterial.ts", import.meta.url)));
for (const guard of ["setPointerCapture", "onPointerCancel", "onLostPointerCapture", 'addEventListener("blur"', 'addEventListener("visibilitychange"']) assert.ok(hardware.includes(guard));
console.log("PASS: two boot/return loops, pre-power front pose, early/duplicate boot rejection, opacity envelope, hardware contract guards.");
