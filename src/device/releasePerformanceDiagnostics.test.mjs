import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const diagnostics = readFileSync(new URL("./useReleasePerformanceDiagnostics.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const screenDiagnostics = readFileSync(new URL("./useDeviceScreenDiagnostics.ts", import.meta.url), "utf8");
const checklist = readFileSync(new URL("../../docs/qa/release-gate-3-real-device-performance.md", import.meta.url), "utf8");

assert.match(diagnostics, /import\.meta\.env\.DEV[^\n]+performanceDebug/);
assert.match(diagnostics, /__SM2010_PERFORMANCE_QA__/);
assert.match(diagnostics, /snapshot: \(\): ReleasePerformanceSnapshot/);
assert.doesNotMatch(diagnostics, /setInterval|setTimeout|console\.|requestAnimationFrame/);
assert.match(diagnostics, /document\.getElementsByTagName\("\*"\)\.length/);
assert.match(screenDiagnostics, /const visible = import\.meta\.env\.DEV/);
assert.match(screenDiagnostics, /performanceDebug/);
assert.match(screenDiagnostics, /if \(visible && !output\)/);

for (const field of [
  "lifecyclePhase", "softwarePhase", "experienceSessionId", "cameraMediaObjectCount",
  "activeVideoObjectUrlCount", "notificationQueueLength", "schedulerPendingCount",
  "currentApp", "powerHoldRafActive", "screenPortalBootRafActive",
]) assert.match(app, new RegExp(`\\b${field}\\b(?:\\s*:|\\s*[,}])`));

for (const item of [
  "Run 1", "Run 2", "Safari reloads or crashes", "ScreenPortal drift",
  "excessively hot", "minor first-use decode", "window.__SM2010_PERFORMANCE_QA__?.snapshot()",
]) assert.ok(checklist.includes(item), `checklist must include ${item}`);

console.log("PASS: Release Gate 3 diagnostics are DEV/query-gated, on-demand, headless, and paired with complete real-device thresholds.");
