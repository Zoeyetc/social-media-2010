import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installHeroInspectLongPressSuppression } from "./heroInspectLongPress.ts";

const surface = new EventTarget();
const uninstall = installHeroInspectLongPressSuppression(surface);
const dispatch = (type, pointerType) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (pointerType) Object.defineProperty(event, "pointerType", { value: pointerType });
  surface.dispatchEvent(event);
  return event.defaultPrevented;
};
assert.equal(dispatch("pointerdown", "touch"), true, "touch Power/drag pointerdown must prevent Safari defaults");
assert.equal(dispatch("touchstart"), true, "iOS touchstart must prevent the long-press callout");
for (const type of ["contextmenu", "selectstart", "dragstart"]) {
  assert.equal(dispatch(type), true, `${type} must be suppressed on the inspect surface`);
}
assert.equal(dispatch("pointerdown", "mouse"), false, "mouse pointer behavior stays intact");
uninstall();
for (const type of ["pointerdown", "touchstart", "contextmenu", "selectstart", "dragstart"]) {
  assert.equal(dispatch(type, "touch"), false, `${type} must be restored after inspect`);
}

const css = readFileSync(new URL("./hero.css", import.meta.url), "utf8");
const scene = readFileSync(new URL("./HeroScene.tsx", import.meta.url), "utf8");
const hardware = readFileSync(new URL("./useHeroHardware.ts", import.meta.url), "utf8");
const phone = readFileSync(new URL("./HeroPhone.tsx", import.meta.url), "utf8");
assert.match(css, /\.hero-sandbox\[data-phase="inspect"\] \.hero-scene canvas \{[^}]*-webkit-user-select: none;[^}]*user-select: none;[^}]*-webkit-touch-callout: none;[^}]*touch-action: none;[^}]*-webkit-user-drag: none;/);
assert.match(scene, /if \(props\.phase !== "inspect" \|\| !sceneSurface\.current\) return;[\s\S]*installHeroInspectLongPressSuppression\(sceneSurface\.current\)/);
assert.match(scene, /ref=\{sceneSurface\} className="hero-scene"/);
assert.match(hardware, /hit\.name = `Hero\$\{name\}HitTarget`/);
assert.match(hardware, /POWER_HOLD_MS = 3000/);
assert.match(hardware, /window\.setTimeout\([\s\S]*?\}, POWER_HOLD_MS\)/);
assert.match(phone, /MathUtils\.degToRad\(-45\)/);
assert.match(phone, /MathUtils\.degToRad\(45\)/);
assert.doesNotMatch(css, /body\s*\{[^}]*user-select\s*:/);
assert.doesNotMatch(css, /hero-device-screen-host[^}]*user-select\s*:/);
console.log("PASS: inspect-only iOS long-press suppression covers the shared canvas/Power target, restores software input behavior, and preserves Power/drag constants.");
