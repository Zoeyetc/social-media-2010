// Actual production GLB contract. No browser/visual acceptance is implied.
// Run: node --test scripts/blender/iphone4_contract.test.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { Box3, Group, Matrix4, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const asset = 'src/assets/hero/iphone4/iphone4.glb';
const bytes = fs.readFileSync(asset);
const json = buffer => JSON.parse(buffer.subarray(20, 20+buffer.readUInt32LE(12)));
const gltf = json(bytes);
const baseline = json(execFileSync('git', ['show', `HEAD:${asset}`], { maxBuffer: 8e6 }));
assert.deepEqual(gltf.nodes.map(n=>n.name).sort(), baseline.nodes.map(n=>n.name).sort());
assert.deepEqual(gltf.materials.map(n=>n.name).sort(),
  [...baseline.materials.map(n=>n.name), 'MAT_HomeDisc', 'MAT_HomeGlyph'].sort());
for (const n of gltf.nodes) assert.ok((n.scale ?? [1,1,1]).every(s=>Math.abs(s-1)<1e-7), n.name);
const node = name => gltf.nodes.find(n=>n.name===name);
const previous = name => baseline.nodes.find(n=>n.name===name);
assert.deepEqual(node('HomeButton').translation, previous('HomeButton').translation);
assert.deepEqual(node('HomeButton').rotation, previous('HomeButton').rotation);
const material = name => gltf.materials.find(entry => entry.name === name);
const homeMaterials = gltf.meshes[node('HomeButton').mesh].primitives.map(part => gltf.materials[part.material].name);
assert.deepEqual(homeMaterials, ['MAT_HomeDisc', 'MAT_HomeGlyph'], 'only the Home disc and glyph get dedicated PBR response');
for (const name of homeMaterials) assert.equal(material(name).emissiveFactor, undefined, `${name} must not emit light`);
const disc = material('MAT_HomeDisc').pbrMetallicRoughness;
const glyph = material('MAT_HomeGlyph').pbrMetallicRoughness;
assert.ok(disc.roughnessFactor > material('MAT_FrontGlass').pbrMetallicRoughness.roughnessFactor);
assert.ok(disc.baseColorFactor[0] < 0.01, 'Home disc stays black');
assert.ok(glyph.metallicFactor < 0.2 && glyph.baseColorFactor[0] < 0.15, 'glyph is restrained neutral gray rather than chrome');
for (const mesh of gltf.meshes.filter((_, index) => index !== node('HomeButton').mesh)) {
  assert.ok(mesh.primitives.every(part => !homeMaterials.includes(gltf.materials[part.material].name)), 'Home materials stay isolated');
}
assert.deepEqual(node('Dock30Pin').translation, previous('Dock30Pin').translation);
assert.deepEqual(node('Dock30Pin').rotation, previous('Dock30Pin').rotation);
assert.deepEqual(node('PowerButton').rotation, previous('PowerButton').rotation);
assert.equal(node('PowerButton').translation[0], previous('PowerButton').translation[0]);
assert.deepEqual(node('MuteSwitch').rotation, previous('MuteSwitch').rotation);

const loader = new GLTFLoader();
loader.register(()=>({name:'HeadlessNoTexture', loadTexture:()=>Promise.resolve(null)}));
const {scene} = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength), '');
scene.updateMatrixWorld(true);
const close = (a,b,tolerance=1e-7) => assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`);
const screen = scene.getObjectByName('Screen');
const screenBounds = new Box3().setFromObject(screen);
const size = screenBounds.getSize(new Vector3());
close(size.x,.0493); close(size.y,.07395); close(size.x/size.y,2/3);
close(screenBounds.getCenter(new Vector3()).y,.001);
close(screenBounds.max.z,.00459);
assert.ok(screenBounds.max.z < .00465-.00005, 'display recessed behind front glass');
const power=scene.getObjectByName('PowerButton');
const powerBounds=new Box3().setFromObject(power);
const frameBounds=new Box3().setFromObject(scene.getObjectByName('StainlessFrame'));
close(powerBounds.max.y-frameBounds.max.y,.00020);
close(powerBounds.max.y-.00016-frameBounds.max.y,.00004);
assert.ok(powerBounds.min.y<frameBounds.max.y,'button base seated below rail, not floating');
power.geometry.computeBoundingBox();
const physicalLocal=power.geometry.boundingBox;
const hitSize=physicalLocal.getSize(new Vector3()).add(new Vector3(.016,.012,.012));
const hitCenter=physicalLocal.getCenter(new Vector3()).add(new Vector3(0,.003,.006));
const hitBounds=new Box3().setFromCenterAndSize(hitCenter,hitSize).applyMatrix4(power.matrixWorld);
assert.ok(!hitBounds.intersectsBox(screenBounds),'existing padded Power hit volume stays outside Screen');

// Exercise the actual role resolver and normalization without Vite's URL glob.
const contractSource = fs.readFileSync('src/hero/iphone4ModelContract.ts','utf8')
  .replace(/const productionModelModules = import\.meta\.glob\([\s\S]*?\n\}\);/, 'const productionModelModules = {};');
const contract = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(contractSource)).toString('base64')}`);
const source = fs.readFileSync('src/hero/iphone4Normalization.ts','utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','');
const {normalizeIPhone4Model:normalize,chassisNormalizationBounds:chassisBounds} = new Function('Box3','Group','Matrix4','Quaternion','Vector3','resolveIPhone4MeshRoles',
  stripTypeScriptTypes(source)+';return {normalizeIPhone4Model,chassisNormalizationBounds};')(Box3,Group,Matrix4,Quaternion,Vector3,contract.resolveIPhone4MeshRoles);
const bounds=chassisBounds(contract.resolveIPhone4MeshRoles(scene));
bounds.getSize(new Vector3()).toArray().forEach((v,i)=>close(v,[.0586,.1152,.0093][i]));
bounds.getCenter(new Vector3()).toArray().forEach(v=>close(v,0));
const normalized = normalize(scene);
assert.deepEqual(contract.missingIPhone4MeshRoles(normalized.roles), []);
close(chassisBounds(normalized.roles).getSize(new Vector3()).y,2.82);
close(normalized.root.quaternion.angleTo(new Quaternion()),0);
for (const name of ['PowerButton','HomeButton','MuteSwitch','VolumeUp','VolumeDown','Dock30Pin']) {
  assert.ok(scene.getObjectByName(name), `${name} independently addressable`);
}
const primitives = gltf.meshes.reduce((n,m)=>n+m.primitives.length,0);
const triangles = gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
assert.ok(triangles >= 15000 && triangles <= 30000);
assert.equal(gltf.images.length,1);
console.log('PASS: all original semantic/material names, exact envelope, Screen, normalization, Power basis and unchanged Dock transform.',
  JSON.stringify({bytes:bytes.length,meshes:gltf.meshes.length,nodes:gltf.nodes.length,primitives,materials:gltf.materials.length,triangles,textures:gltf.textures.length}));
