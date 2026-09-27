import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installHeroKeyboardViewportLock } from "./heroKeyboardViewportLock.ts";
import { mobilePhoneScale } from "./heroMobileScale.ts";

const previous = {
  window: globalThis.window, document: globalThis.document,
  HTMLElement: globalThis.HTMLElement, HTMLInputElement: globalThis.HTMLInputElement,
  HTMLTextAreaElement: globalThis.HTMLTextAreaElement,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
  MutationObserver: globalThis.MutationObserver,
};
class ElementMock {
  constructor(parent = null) { this.parent = parent; }
  closest(selector) { return selector === ".hero-screen-portal" ? this.parent : null; }
}
class InputMock extends ElementMock { constructor(parent, type = "text") { super(parent); this.type = type; } }
class TextareaMock extends ElementMock {}
const listeners = new Map(), viewportListeners = new Map(), stageListeners = new Map();
const listen = map => ({
  addEventListener(type, fn) { map.set(type, fn); },
  removeEventListener(type) { map.delete(type); },
});
let layoutHeight = 844, nextFrame = 0;
const frames = new Map();
const runFrames = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
const properties = new Map(), attributes = new Map();
let activeObserver;
globalThis.MutationObserver = class {
  constructor(callback) { this.callback = callback; }
  observe() { activeObserver = this; }
  disconnect() { if (activeObserver === this) activeObserver = undefined; }
};
const stage = {
  ...listen(stageListeners),
  style: {
    set height(value) { properties.set("height", value); },
    get height() { return properties.get("height") ?? ""; },
    removeProperty(name) { properties.delete(name); },
  },
  setAttribute(name, value) { attributes.set(name, value); },
  removeAttribute(name) { attributes.delete(name); },
  getBoundingClientRect() { return { height: Number.parseFloat(properties.get("height")) || layoutHeight }; },
};
globalThis.HTMLElement = ElementMock;
globalThis.HTMLInputElement = InputMock;
globalThis.HTMLTextAreaElement = TextareaMock;
globalThis.window = { ...listen(listeners), innerWidth: 390, visualViewport: listen(viewportListeners) };
globalThis.document = { activeElement: null };
globalThis.requestAnimationFrame = fn => { frames.set(++nextFrame, fn); return nextFrame; };
globalThis.cancelAnimationFrame = id => frames.delete(id);

try {
  const portal = {}, input = new InputMock(portal), second = new TextareaMock(portal);
  const outside = new InputMock(null), checkbox = new InputMock(portal, "checkbox");
  const cleanup = installHeroKeyboardViewportLock(stage);
  const emit = (type, target) => stageListeners.get(type)?.({ target });
  const fit = () => mobilePhoneScale({ width: 390, height: stage.getBoundingClientRect().height, fovDegrees: 38, cameraDistance: 7 }, "software");
  const before = fit();
  document.activeElement = input;
  emit("focusin", input);
  assert.equal(stage.style.height, "844px", "software focus captures pre-keyboard stage height");
  assert.equal(attributes.get("data-keyboard-viewport-locked"), "true");
  layoutHeight = 520; viewportListeners.get("resize")?.(); listeners.get("resize")?.();
  assert.equal(fit(), before, "keyboard height reduction cannot change physical phone scale");
  emit("focusout", input); document.activeElement = second; emit("focusin", second); runFrames();
  assert.equal(stage.style.height, "844px", "switching editors retains the lock");
  emit("focusout", second); document.activeElement = outside; runFrames();
  assert.equal(stage.style.height, "", "blur releases the basis");
  assert.notEqual(fit(), before, "normal resize fits again after dismissal");
  emit("focusin", checkbox); assert.equal(stage.style.height, "", "checkbox never locks the viewport");
  emit("focusin", outside); assert.equal(stage.style.height, "", "outside editor never locks the viewport");

  document.activeElement = input; layoutHeight = 844; emit("focusin", input);
  assert.ok(activeObserver);
  document.activeElement = null; activeObserver.callback();
  assert.equal(stage.style.height, "", "unmounted editor releases lock without blur");

  layoutHeight = 844; document.activeElement = input; emit("focusin", input);
  window.innerWidth = 844; layoutHeight = 390; listeners.get("resize")?.(); runFrames();
  assert.equal(stage.style.height, "", "wide orientation exits narrow lock");
  window.innerWidth = 430; viewportListeners.get("resize")?.();
  emit("focusin", input); assert.equal(stage.style.height, "390px", "new narrow orientation captures new basis");
  cleanup(); assert.equal(stage.style.height, "");
  assert.equal(stageListeners.size, 0); assert.equal(listeners.size, 0); assert.equal(viewportListeners.size, 0);

  const css = readFileSync(new URL("./hero.css", import.meta.url), "utf8");
  const screen = readFileSync(new URL("../device/DeviceScreen.tsx", import.meta.url), "utf8");
  const keyboard = readFileSync(new URL("../styles/device.css", import.meta.url), "utf8");
  const html = readFileSync(new URL("../../hero.html", import.meta.url), "utf8");
  assert.match(css, /\.hero-sandbox\[data-phase="experience"\] \.hero-screen-portal\s+:is\(input:not\(\[type\]\), input\[type="text"\], input\[type="search"\], input\[type="email"\], input\[type="password"\], textarea\)\s*\{\s*font-size: 16px !important;/);
  assert.match(css, /font-size-adjust: 0\.39/);
  assert.match(css, /\.small-note-editor \{ font-size: 18px !important; \}/);
  assert.match(html, /width=device-width, initial-scale=1\.0/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
  assert.match(screen, /className=\{`screen \$\{session\.phase\}`\}/);
  assert.match(keyboard, /\.ios4-keyboard-system\.is-keyboard-visible \{ grid-template-rows: minmax\(0,1fr\) 216px; \}/);
  console.log("PASS: scoped software focus lock, keyboard-height stability, blur, orientation resize, 320×480/keyboard structure, Safari focus size");
} finally {
  Object.assign(globalThis, previous);
}
