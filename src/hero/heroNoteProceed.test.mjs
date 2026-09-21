// Real note and Sandbox callbacks under a deterministic React hook host.
// Native click submit and the post-reveal keyboard owner share one proceed guard.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let slots = [], cursor = 0, identity = false, pending = [];
const listeners = new Set();
globalThis.__noteHooks = {
  useState(initial) {
    const index = cursor++;
    slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
    const owner = slots;
    return [owner[index].value, value => { owner[index].value = typeof value === 'function' ? value(owner[index].value) : value; }];
  },
  useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
  useCallback(fn) { return fn; },
  useEffect(fn) {
    if (!identity) return;
    const index = cursor++, owner = slots;
    pending.push(() => { owner[index]?.cleanup?.(); owner[index] = { cleanup: fn() }; });
  },
};
globalThis.location = { search: '' };
globalThis.window = { location: globalThis.location, addEventListener: (name, fn) => listeners.add(fn), removeEventListener: (name, fn) => listeners.delete(fn) };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent', plugins: [{
  name: 'note-test-hooks', enforce: 'pre',
  resolveId(id) { if (id === 'virtual:note-hooks') return '\0note-hooks'; },
  load(id) { if (id === '\0note-hooks') return Object.keys(globalThis.__noteHooks).map(key => `export const ${key} = globalThis.__noteHooks.${key};`).join('\n'); },
  transform(code, id) {
    if (/\/src\/hero\/(HeroIdentity|HeroSandbox)\.tsx$/.test(id)) return code.replace('from "react";', 'from "virtual:note-hooks";');
  },
}] });
const descendants = node => !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(descendants)];
try {
  const { HeroSandbox } = await server.ssrLoadModule('/src/hero/HeroSandbox.tsx');
  const { HeroIdentity } = await server.ssrLoadModule('/src/hero/HeroIdentity.tsx');
  const { heroTransition, initialHeroState, heroCanStartBoot } = await server.ssrLoadModule('/src/hero/HeroController.ts');
  for (const method of ['input', 'elsewhere', 'click']) {
    const sandboxSlots = [], identitySlots = [], starts = [];
    let lifecycle = initialHeroState, note, form, nodes, tree;
    const render = () => {
      identity = false; slots = sandboxSlots; cursor = 0;
      tree = HeroSandbox({ lifecycle, startExperience(input) { starts.push(input); lifecycle = heroTransition(lifecycle, { type: 'CONFIRM_IDENTITY', name: input.name }); } });
      const props = descendants(tree).find(node => node.type === HeroIdentity).props;
      identity = true; slots = identitySlots; cursor = 0;
      note = HeroIdentity(props); nodes = descendants(note); form = nodes.find(node => node.type === 'form'); pending.splice(0).forEach(fn => fn());
    };
    const submit = () => { let prevented = false; form.props.onSubmit({ preventDefault() { prevented = true; } }); assert.ok(prevented); render(); };
    render();
    assert.equal(nodes.some(node => node.type === 'button'), false, 'no proceed action before code reveal');
    submit(); assert.equal(starts.length, 0, 'empty name cannot proceed');
    nodes.find(node => node.type === 'input').props.onChange({ target: { value: 'Note Visitor' } }); render();
    submit();
    const revealed = nodes.find(node => node.type === 'output').props.children;
    assert.match(revealed, /^\d{4}$/);
    assert.equal(starts.length, 0, 'name confirmation only reveals the code');
    assert.equal(nodes.find(node => node.type === 'input').props.readOnly, true);
    const button = nodes.find(node => node.type === 'button');
    assert.equal(button.props.children, 'enter →');
    assert.equal(button.props.type, 'submit', 'click uses the existing submit button');
    assert.equal(button.props.onClick, undefined, 'no alternate click handler');
    const scene = descendants(tree).find(node => node.type?.name === 'HeroScene');
    // Model the browser default action of activating this submit button.
    if (method === 'click') assert.equal(button.props.disabled, false);
    if (method === 'click') submit();
    else {
      const press = extra => {
        const event = { key: 'Enter', target: method === 'input' ? nodes.find(n => n.type === 'input') : {}, repeat: false, isComposing: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...extra };
        [...listeners].forEach(fn => fn(event)); return event;
      };
      press({ repeat: true }); press({ isComposing: true }); press({ keyCode: 229 });
      assert.equal(starts.length, 0, 'repeat and IME never proceed');
      assert.equal(press({}).prevented, true, 'native submit suppressed');
      press({});
      form.props.onSubmit({ preventDefault() {} });
      assert.equal(starts.length, 1, 'double Enter and native submit cannot double-transition');
      render();
    }
    assert.equal(listeners.size, 0, 'post-reveal listener removed after handoff');
    assert.equal(starts.length, 1);
    assert.equal(starts[0].name, 'Note Visitor');
    assert.equal(starts[0].passcode, revealed);
    assert.ok(starts[0].experienceSessionId);
    assert.equal(lifecycle.phase, 'detaching', `${method} begins the existing Hero transition`);
    assert.equal(lifecycle.bootStartedAt, null, 'proceed does not skip physical Power');
    assert.equal(heroCanStartBoot(heroTransition(lifecycle, { type: 'DETACH_COMPLETE' })), true);
    assert.equal(nodes.find(node => node.type === 'input').props.disabled, true);
    const nextScene = descendants(tree).find(node => node.type === scene.type);
    assert.ok(nextScene); assert.equal(nextScene.key, scene.key, 'scene identity is preserved');
    submit(); assert.equal(starts.length, 1, 'inactive note cannot start another session');
  }
  console.log('PASS: NAME → CODE → focused/unfocused Return and click share handoff; repeat/IME/double-submit blocked; preserved name/code/session, detaching, physical Power still required, inactive note blocked.');
} finally { await server.close(); delete globalThis.__noteHooks; }
