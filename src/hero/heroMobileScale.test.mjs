import assert from "node:assert/strict";
import { inspectScale } from "./heroMobileScale.ts";

assert.equal(inspectScale(false), 1.04, "desktop inspect pose is unchanged");
assert.equal(inspectScale(true), 1.2);
const projectedHeight = 2.82 * inspectScale(true) / (2 * 7 * Math.tan(38 * Math.PI / 360));
assert.ok(projectedHeight >= .68 && projectedHeight <= .74, "mobile chassis approaches 68–74% viewport height");
assert.ok(projectedHeight < 1, "phone retains breathing room");
console.log("PASS: narrow physical-scale approximation and unchanged desktop inspect scale");
