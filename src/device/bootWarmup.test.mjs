import assert from "node:assert/strict";
import { createBootWarmup, BOOT_CRITICAL_DEADLINE_MS } from "./bootWarmup.ts";
import { heroTransition, initialHeroState, heroBootOpacity } from "../hero/HeroController.ts";

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function host() {
  let now = 0, next = 0;
  const idle = new Map(), timers = new Map(), marks = [];
  return {
    idle, timers, marks,
    api: { now: () => now, idle: fn => { const id = ++next; idle.set(id, fn); return () => idle.delete(id); },
      timer: (fn, delay) => { const id = ++next; timers.set(id, { fn, at: now + delay }); return () => timers.delete(id); }, mark: name => marks.push(name) },
    async turn(budget = 8) { const entry = idle.entries().next().value; if (entry) { idle.delete(entry[0]); entry[1](budget); } await flush(); },
    async tick(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } await flush(); },
  };
}
const h = host(); let acknowledge, keyboardRuns = 0, ready = 0, failed = 0, tier2 = 0;
const tasks = [
  { id: "runtime", tier: 0, run() {} },
  { id: "keyboard-structure", tier: 0, run: () => { keyboardRuns++; return new Promise(resolve => { acknowledge = resolve; }); } },
  { id: "optional-fails", tier: 1, run() { throw Error("decode"); } },
  { id: "optional-later", tier: 2, run() { tier2++; } },
];
const run = createBootWarmup(tasks, h.api, () => ready++, () => failed++);
run.start(); run.start();
await h.turn(0); assert.equal(run.snapshot().completedTaskIds.length, 0, "busy browser yields");
await h.tick(32); assert.deepEqual(run.snapshot().completedTaskIds, ["runtime"], "one task per idle turn");
await h.turn(); assert.equal(keyboardRuns, 1); assert.equal(run.ready, false);
await h.tick(19968); assert.equal(run.ready, false, "20 seconds cannot bypass keyboard readiness");
acknowledge(); await flush(); assert.equal(run.ready, true); assert.equal(ready, 1);
run.markBootExit(); assert.equal(run.snapshot().bootExitMs, 20000);
assert.deepEqual(run.snapshot().deferredTaskIds, ["optional-fails", "optional-later"]);
await h.turn(); assert.equal(run.ready, true); assert.equal(failed, 0, "Tier 1 failure does not block boot");
await h.turn(); assert.equal(tier2, 1);
run.markFirstApp(); run.markFirstApp(); run.markFirstKeyboard(); run.markFirstKeyboard();
assert.equal(h.marks.filter(name => name === "sm2010:first-app-open").length, 1);
assert.equal(h.marks.filter(name => name === "sm2010:first-keyboard-visible").length, 1);
run.cancel(); assert.equal(h.idle.size, 0); assert.equal(h.timers.size, 0);

const physical = { ...initialHeroState, phase: "front-aligned", bootStartedAt: 1000 };
assert.equal(heroTransition(physical, { type: "BOOT_COMPLETE", now: 21000 }), physical);
assert.equal(heroTransition(physical, { type: "BOOT_COMPLETE", now: 20999, bootCriticalReady: true }), physical);
assert.equal(heroTransition(physical, { type: "BOOT_COMPLETE", now: 21000, bootCriticalReady: true }).phase, "experience");
assert.equal(heroBootOpacity(25000, false), 1, "logo remains visible while critical work is pending");
assert.equal(heroTransition(physical, { type: "BOOT_FAILED" }).phase, "power-loss");

const pending = host(); let late, failures = 0;
const cancelled = createBootWarmup([{ id: "keyboard-structure", tier: 0, run: () => new Promise(resolve => { late = resolve; }) }], pending.api, () => assert.fail("cancelled run cannot become ready"), () => failures++);
cancelled.start(); await pending.turn(); cancelled.cancel(); late(); await flush();
assert.equal(pending.idle.size, 0); assert.equal(pending.timers.size, 0);
const second = createBootWarmup([{ id: "keyboard-structure", tier: 0, run() { keyboardRuns++; } }], pending.api, () => {}, () => failures++);
second.start(); await pending.turn(); assert.equal(second.ready, true); assert.equal(keyboardRuns, 2, "Run 2 has fresh session bookkeeping"); second.cancel();
const stuck = createBootWarmup([{ id: "keyboard-structure", tier: 0, run: () => new Promise(() => {}) }], pending.api, () => assert.fail("stuck run cannot unlock"), () => failures++);
stuck.start(); await pending.turn(); await pending.tick(BOOT_CRITICAL_DEADLINE_MS);
assert.equal(failures, 1); assert.equal(stuck.ready, false); assert.equal(stuck.snapshot().failure, "tier0-deadline");
assert.equal(pending.idle.size, 0); assert.equal(pending.timers.size, 0);
console.log("PASS: serial idle tiers, real critical acknowledgement, minimum boot gate, optional failure/defer, marks, cancellation, Run 2 and bounded critical failure");

// First-viewport work makes serial progress even when every idle callback is busy.
const busy = host(); let viewportRuns = 0;
const busyRun = createBootWarmup([
  { id: "system", tier: 0, run() {} },
  ...[1, 2, 3].map(n => ({ id: `viewport-${n}`, tier: 1, bytes: 100, firstViewportApps: ["facebook"], run() { viewportRuns++; } })),
  { id: "optional", tier: 2, run() {} },
], busy.api, () => {}, () => assert.fail());
busyRun.start(); await busy.turn(0); await busy.tick(32);
assert.equal(busyRun.ready, true); assert.equal(busyRun.canExit(), false, "critical readiness alone does not release boot");
for (let n = 0; n < 3; n++) { await busy.turn(0); await busy.tick(32); }
assert.equal(viewportRuns, 3); assert.equal(busyRun.firstViewportReady, true);
await busy.tick(20000); busyRun.markBootExit();
assert.equal(busyRun.snapshot().firstViewport.completedTasks, 3);
assert.equal(busyRun.snapshot().firstViewport.completedBytes, 300);
assert.equal(busyRun.snapshot().firstViewport.deferredTasks, 0);
assert.equal(busyRun.snapshot().firstViewport.bootExitWithIncompleteFirstViewport, false);
busyRun.cancel(); assert.equal(busy.timers.size, 0);

// Progress permits a short grace; even continuous progress cannot extend past +2s.
const grace = host(); const releases = [];
const graceRun = createBootWarmup([
  { id: "system", tier: 0, run() {} },
  ...[1, 2, 3, 4, 5].map(n => ({ id: `vp-${n}`, tier: 1, firstViewportApps: ["instagram"], run: () => new Promise(resolve => releases.push(resolve)) })),
], grace.api, () => {}, () => assert.fail());
graceRun.start(); await grace.turn(); await grace.tick(19000); await grace.turn();
await grace.tick(600); releases[0](); await flush(); await grace.turn();
await grace.tick(400); assert.equal(graceRun.canExit(), false);
await grace.tick(300); releases[1](); await flush(); await grace.turn();
await grace.tick(700); releases[2](); await flush(); await grace.turn();
await grace.tick(700); releases[3](); await flush(); await grace.turn();
await grace.tick(300); assert.equal(graceRun.canExit(), true, "hard first-viewport maximum is 22 seconds");
graceRun.markBootExit(); const graceSnapshot = graceRun.snapshot().firstViewport;
assert.equal(graceSnapshot.gracePeriodUsed, true);
assert.equal(graceSnapshot.bootExitWithIncompleteFirstViewport, true);
assert.equal(graceSnapshot.completedTasks, 4); assert.equal(graceSnapshot.deferredTasks, 1);
graceRun.cancel(); releases[4](); await flush();
assert.equal(graceRun.snapshot().firstViewport.completedTasks, 4, "stale completion cannot enter a cancelled session");
console.log("PASS: busy-idle first-viewport progress, grouped byte/readiness diagnostics, progress-only grace, hard +2s maximum and reset cancellation");
