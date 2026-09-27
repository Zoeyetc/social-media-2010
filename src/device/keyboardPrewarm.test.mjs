import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

let slots = [], cursor = 0, effects = [], dirty = false;
const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const hooks = {
  createContext: () => ({ Provider: "context" }), forwardRef: fn => fn, useContext: () => null,
  useState(initial) { const i = cursor++; slots[i] ??= { value: initial }; return [slots[i].value, next => { const value = typeof next === "function" ? next(slots[i].value) : next; if (value !== slots[i].value) { slots[i].value = value; dirty = true; } }]; },
  useRef(value) { return slots[cursor++] ??= { current: value }; },
  useCallback(fn, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
  useEffect(fn, deps) { const i = cursor++; if (!equal(slots[i]?.deps, deps)) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); },
};
hooks.useLayoutEffect = hooks.useEffect;
globalThis.__bootKeyboardHooks = hooks;
const originalDocument = globalThis.document;
globalThis.document = { activeElement: null };
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "silent", plugins: [{
  name: "boot-keyboard-host", enforce: "pre",
  resolveId: id => id === "virtual:boot-keyboard" ? "\0boot-keyboard" : undefined,
  load: id => id === "\0boot-keyboard" ? Object.keys(hooks).map(name => `export const ${name}=globalThis.__bootKeyboardHooks.${name};`).join("\n") : undefined,
  transform(code, id) { if (id.endsWith("/IOS4KeyboardSystem.tsx")) return code.replace('from "react";', 'from "virtual:boot-keyboard";'); },
}] });
try {
  const { IOS4KeyboardSystem } = await server.ssrLoadModule("/src/device/IOS4KeyboardSystem.tsx");
  const walk = node => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
  for (const experienceSessionId of ["run-1", "run-2"]) {
    slots = []; let count = 0, visible = false, suspended = true, tree, keyRef;
    const element = { offsetHeight: 216 };
    const onStructureReady = () => count++;
    const onVisibilityChange = value => { visible = value; };
    const render = () => {
      for (let i = 0; i < 10; i++) {
        cursor = 0; dirty = false;
        tree = IOS4KeyboardSystem({ children: null, suspended, experienceSessionId, retainStructure: true, onStructureReady, onVisibilityChange });
        const section = walk(tree).find(node => node.props?.className === "ios4-keyboard");
        assert.ok(section); section.props.ref.current = element;
        keyRef ??= section.props.ref; assert.equal(section.props.ref, keyRef, "same key structure retained through boot and app phase");
        const pending = effects; effects = []; pending.forEach(effect => effect());
        if (!dirty) return;
      }
      assert.fail("keyboard did not settle");
    };
    render(); render(); assert.equal(count, 1); assert.equal(visible, false);
    assert.equal(tree.props.value.state.activeInputId, null); assert.equal(document.activeElement, null);
    suspended = false; render(); assert.equal(count, 1); assert.equal(visible, false, "handoff does not claim keyboard visibility");
    assert.equal(tree.props.value.state.activeInputId, null);
    slots.forEach(slot => slot?.cleanup?.());
  }
  const screen = readFileSync(new URL("./DeviceScreen.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(screen, /<KeyboardPrewarm/);
  assert.match(screen, /session\.phase === "app" && <>/);
  assert.equal((screen.match(/<IOS4KeyboardSystem/g) ?? []).length, 1);
  const css = readFileSync(new URL("../styles/device.css", import.meta.url), "utf8");
  assert.match(css, /\.app-launch-container\.is-prewarm\s*\{[^}]*visibility: hidden;[^}]*animation: none;/);
  console.log("PASS: retained boot keyboard, exactly-once session layout acknowledgement, no focus/visibility/ownership, fresh Run 2, no hidden app trees");
} finally { globalThis.document = originalDocument; delete globalThis.__bootKeyboardHooks; await server.close(); }
