// Real note and Sandbox callbacks under a deterministic React hook host.
// Submit-button activation and Return both use the form's native submit path.
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let slots = [], cursor = 0;
globalThis.__noteHooks = {
  useState(initial) {
    const index = cursor++;
    slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
    const owner = slots;
    return [owner[index].value, value => { owner[index].value = typeof value === 'function' ? value(owner[index].value) : value; }];
  },
  useRef(value) { const index = cursor++; return slots[index] ??= { current: value }; },
  useCallback(fn) { return fn; },
  useEffect() {},
};
globalThis.location = { search: '' };
globalThis.window = { location: globalThis.location };
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
  for (const method of ['Return', 'click']) {
    const sandboxSlots = [], identitySlots = [], starts = [];
    let lifecycle = initialHeroState, note, form, nodes, tree;
    const render = () => {
      slots = sandboxSlots; cursor = 0;
      tree = HeroSandbox({ lifecycle, startExperience(input) { starts.push(input); lifecycle = heroTransition(lifecycle, { type: 'CONFIRM_IDENTITY', name: input.name }); } });
      const props = descendants(tree).find(node => node.type === HeroIdentity).props;
      slots = identitySlots; cursor = 0;
      note = HeroIdentity(props); nodes = descendants(note); form = nodes.find(node => node.type === 'form');
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
    assert.equal(button.props.type, 'submit', 'click and Return share native form submission');
    assert.equal(button.props.onClick, undefined, 'no alternate click handler');
    const scene = descendants(tree).find(node => node.type?.name === 'HeroScene');
    // Model the browser default action of activating this submit button.
    if (method === 'click') assert.equal(button.props.disabled, false);
    submit();
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
  console.log('PASS: NAME → CODE → Return/click share submission; preserved name/code/session, detaching, physical Power still required, inactive note blocked.');
} finally { await server.close(); delete globalThis.__noteHooks; }
