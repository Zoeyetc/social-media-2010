import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DESKTOP_SOFTWARE_SCALE, inspectScale, mobilePhoneScale } from "./heroMobileScale.ts";

const viewport = (width, height) => ({ width, height, fovDegrees: 38, cameraDistance: 7 });
assert.equal(inspectScale(false), 1.04, "desktop inspect remains frozen");
assert.equal(DESKTOP_SOFTWARE_SCALE, 1.18 * 1.30, "desktop software remains frozen");

for (const [width, height] of [[390, 844], [393, 852], [430, 932], [375, 667], [700, 380]]) {
  const inspect = inspectScale(true, viewport(width, height));
  const software = mobilePhoneScale(viewport(width, height), "software");
  assert.ok(Number.isFinite(inspect) && inspect > 0 && software >= inspect, `${width}×${height}: valid ordered fits`);
  const focal = height / (2 * Math.tan(38 * Math.PI / 360));
  const phoneHeight = 2.82, phoneWidth = phoneHeight * 58.6 / 115.2;
  const softwarePixels = focal / (7 - software * phoneHeight * 9.3 / 115.2 / 2);
  assert.ok(phoneWidth * software * softwarePixels <= width - 20 + 1e-8, "width bounds chassis");
  assert.ok(phoneHeight * software * softwarePixels <= height - 20 + 1e-8, "height bounds chassis");
  assert.equal(phoneWidth / phoneHeight, 58.6 / 115.2, "uniform scale preserves aspect");
}

assert.ok(mobilePhoneScale(viewport(250, 844), "software") < mobilePhoneScale(viewport(390, 844), "software"), "width can constrain fit");
assert.ok(mobilePhoneScale(viewport(700, 400), "software") < mobilePhoneScale(viewport(700, 900), "software"), "height can constrain fit");
assert.notEqual(mobilePhoneScale(viewport(390, 844), "software"), mobilePhoneScale(viewport(390, 667), "software"), "viewport resize recomputes fit");
assert.equal(mobilePhoneScale(viewport(0, 844), "software"), 0);
assert.equal(mobilePhoneScale(viewport(390, -1), "inspect"), 0);

const css = readFileSync(new URL("./hero.css", import.meta.url), "utf8");
const phone = readFileSync(new URL("./HeroPhone.tsx", import.meta.url), "utf8");
const portal = readFileSync(new URL("./ScreenPortal.tsx", import.meta.url), "utf8");
assert.match(css, /\.hero-sandbox \{ min-height: 0; height: 100dvh; \}/);
assert.match(css, /#hero-root:has\(> \.public-twitter-outro\) > \.hero-sandbox \{ height: auto; \}/);
assert.match(phone, /mobilePhoneScale\(fitViewport, "software"\)/);
assert.match(portal, /320/);
assert.match(portal, /480/);
console.log("PASS: mobile width/height fit, resize, safe bounds, desktop/ending freeze, 320×480 portal");
