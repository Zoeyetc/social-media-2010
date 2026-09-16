import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

// Exact raw-control owners; no blanket exception for an app or page file.
export async function validatePageInputs() {
  const found = [];
  for (const file of await readdir(new URL('../src/device/', import.meta.url), {recursive:true})) {
    if (!file.endsWith('.tsx') || file === 'IOS4KeyboardSystem.tsx') continue;
    const source = await readFile(new URL(`../src/device/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /contentEditable|<textarea\b/, `${file} must use shared keyboard wrappers`);
    const controls = [...source.matchAll(/<input\b([\s\S]*?)(?:\/>|<\/input>)/g)];
    assert.equal(controls.length, (source.match(/<input\b/g) ?? []).length, `${file}: raw inputs must be explicit`);
    for (const match of controls) {
      const attrs=match[1];
      assert.doesNotMatch(attrs, /\b(?:id|type)\s*=\s*\{|\{\.\.\./, "raw exceptions require static ownership and type");
      const id=attrs.match(/\bid="([^"]+)"/)?.[1] ?? '';
      const type=attrs.match(/\btype="([^"]+)"/)?.[1] ?? 'text';
      const key=`${file}:input:${id}:${type}`;
      assert.ok(['App.tsx:input:name:text','PublicTwitterOutro.tsx:input:public-twitter-handle:text','FacebookContainer.tsx:input::checkbox'].includes(key),`Unowned raw input: ${key}`);
      found.push(key);
    }
  }
  assert.deepEqual(found.sort(), ['App.tsx:input:name:text','FacebookContainer.tsx:input::checkbox','PublicTwitterOutro.tsx:input:public-twitter-handle:text'].sort());
}
