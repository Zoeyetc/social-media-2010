import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inflateSync} from 'node:zlib';
import {createServer} from 'vite';

const root = new URL('../', import.meta.url);
const css = await readFile(new URL('src/styles/device.css', root), 'utf8');
const chunks = bytes => {
  const result=[];
  for(let offset=8;offset<bytes.length;){const size=bytes.readUInt32BE(offset);result.push({type:bytes.toString('ascii',offset+4,offset+8),data:bytes.subarray(offset+8,offset+8+size)});offset+=size+12;}
  return result;
};
for(const name of ['BarBottomLock','WellLock','bottombarknobgray','bottombarlocktextmask']) {
  const path=`src/assets/historical/ios4.1/lockscreen/${name}@2x`;
  const original=chunks(await readFile(new URL(`${path}.png`,root)));
  const browser=chunks(await readFile(new URL(`${path}.browser.png`,root)));
  assert.ok(original.some(chunk=>chunk.type==='CgBI'), 'preserve archived Apple original');
  assert.ok(!browser.some(chunk=>chunk.type==='CgBI'), `${name} must decode in browsers`);
  assert.deepEqual(browser.find(chunk=>chunk.type==='IHDR').data.subarray(0,8),original.find(chunk=>chunk.type==='IHDR').data.subarray(0,8),'native image dimensions preserved');
  assert.ok(inflateSync(Buffer.concat(browser.filter(chunk=>chunk.type==='IDAT').map(chunk=>chunk.data))).length);
  assert.ok(css.includes(`${name}@2x.browser.png`),'CSS must use converted artwork');
  assert.ok(!css.includes(`${name}@2x.png`),'CSS must not use Apple-only PNG');
}
assert.match(css,/\.lockscreen, \.passcode-screen \{[^}]*DefaultWallpaper@2x~iphone\.browser\.png[^}]*320px 480px/,'wallpaper source and alignment shared');
const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try {
  const {PasscodeScreen}=await server.ssrLoadModule('/src/device/PasscodeScreen.tsx');
  const {createElement}=await import('react');
  const {renderToStaticMarkup}=await import('react-dom/server');
  const props={lockedUntilElapsedMs:null,elapsedMs:0,failedAttempts:0,onCancel(){},onAttempt(){}};
  const markup=renderToStaticMarkup(createElement(PasscodeScreen,props));
  const buttons=[...markup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)];
  assert.equal(buttons.length,12);
  assert.match(markup, /class="passcode-title-band"[\s\S]*class="passcode-entry-band"[\s\S]*class="passcode-keypad"/, 'three ordered system panels');
  assert.ok(!markup.includes('Incorrect Passcode'), 'clean initial entry has no permanent helper copy');
  assert.deepEqual(buttons.slice(-3).map(match=>match[1].replace(/<[^>]*>/g,'')),['Emergency Call','0','Cancel']);
  for(const letters of ['ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ'])assert.ok(markup.includes(letters));
  assert.ok(!markup.includes('Delete'));assert.ok(!markup.includes('passcode-top'));
  const locked=renderToStaticMarkup(createElement(PasscodeScreen,{...props,lockedUntilElapsedMs:60000}));
  assert.equal((locked.match(/ disabled=""/g)||[]).length,10,'all digit keys disabled during lockout');
  assert.ok(locked.includes('Try again in 60 seconds'));
  console.log('PASS: browser-decodable original-size lock artwork; shared wallpaper; 12-cell keypad and lockout rendering.');
} finally {await server.close();}
