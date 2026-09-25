import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { needsKeyboardPrewarm, markKeyboardPrewarmed } from "./keyboardPrewarmState.ts";

assert.equal(needsKeyboardPrewarm("run-1"), true);
markKeyboardPrewarmed("run-1");
assert.equal(needsKeyboardPrewarm("run-1"), false, "returning to SpringBoard does not prewarm twice");
assert.equal(needsKeyboardPrewarm("run-2"), true, "reset creates a fresh prewarm opportunity");
const source = readFileSync(new URL("./KeyboardPrewarm.tsx", import.meta.url), "utf8");
assert.match(source, /requestIdleCallback/);
assert.match(source, /aria-hidden="true" inert/);
assert.match(source, /IOS4KeyboardSystem/);
const css = readFileSync(new URL("../styles/device.css", import.meta.url), "utf8");
assert.match(css, /\.ios4-keyboard-prewarm\s*\{[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none;/);
console.log("PASS: invisible idle keyboard prewarm once per session and reset reinitialization");
