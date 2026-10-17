import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createServer } from "vite";
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "silent" });
const originalImage = globalThis.Image;
try {
  const b = await server.ssrLoadModule("/src/device/bootWarmupImages.ts");
  const { FIRST_VIEWPORT_ASSETS, firstViewportSources } = await server.ssrLoadModule("/src/data/firstViewportAssets.ts");
  const { DISPLAY_IMAGE_DERIVATIVES, displayImageSrc } = await server.ssrLoadModule("/src/data/displayImageDerivatives.ts");
  const { firstViewportImageCache: cache } = await server.ssrLoadModule("/src/device/imageReadiness.ts");
  const urls = new Map();
  for (const file of ["src/device/bootWarmupImages.ts", "src/data/springBoardSocialApps.ts", "src/data/firstViewportAssets.ts", "src/data/displayImageDerivatives.ts"]) {
    for (const match of readFileSync(file, "utf8").matchAll(/from "([^"\n]+\.(?:png|svg|jpg|JPG|PNG))"/g)) {
      const absolute = path.resolve(path.dirname(file), match[1]);
      const { default: url } = await server.ssrLoadModule("/" + path.relative(process.cwd(), absolute));
      urls.set(url, absolute);
    }
  }
  let bytes = 0;
  for (const asset of b.BOOT_IMAGE_MANIFEST) {
    const file = urls.get(asset.src); assert.ok(file, asset.id);
    const size = statSync(file).size; bytes += size;
    assert.ok(size < 160000, `no huge original: ${file}`);
    if (file.endsWith(".png")) {
      const data = readFileSync(file); assert.ok(data.readUInt32BE(16) <= b.BOOT_IMAGE_MAX_EDGE && data.readUInt32BE(20) <= b.BOOT_IMAGE_MAX_EDGE);
    }
    if (asset.firstViewportApps.length) assert.equal(asset.bytes, size, "diagnostic bytes match actual source");
  }
  assert.ok(bytes <= b.BOOT_IMAGE_BYTE_BUDGET); assert.ok(b.BOOT_IMAGE_MANIFEST.length <= b.BOOT_IMAGE_LIMIT);
  assert.equal(new Set(FIRST_VIEWPORT_ASSETS.map(x => x.src)).size, FIRST_VIEWPORT_ASSETS.length);
  for (const derivative of DISPLAY_IMAGE_DERIVATIVES) {
    assert.ok(derivative.width <= 640 && derivative.height <= 640);
    assert.equal(displayImageSrc(derivative.originalSrc), derivative.src, "render helper reuses the exact warm URL");
    assert.ok(!b.BOOT_IMAGE_MANIFEST.some(asset => asset.src === derivative.originalSrc));
  }
  for (const app of ["facebook", "twitter", "instagram", "foursquare", "flickr"]) assert.ok(firstViewportSources(app).length > 1);
  for (const app of ["tumblr", "photos", "messages"]) assert.deepEqual(firstViewportSources(app), []);
  let loads = 0, decodes = 0, removals = 0;
  globalThis.Image = class {
    set src(value) { this.url = value; loads++; queueMicrotask(() => this.onload?.()); }
    decode() { decodes++; return Promise.resolve(); }
    removeAttribute() { this.url = ""; removals++; }
  };
  cache.reset("manifest-test");
  for (const task of b.bootImageTasks()) await task.run(new AbortController().signal);
  assert.equal(loads, b.BOOT_IMAGE_MANIFEST.length); assert.equal(decodes, loads);
  const priorDecodes = decodes;
  await cache.decode(FIRST_VIEWPORT_ASSETS[0].src, new AbortController().signal);
  assert.equal(decodes, priorDecodes + 1, "first open rechecks retained decoded pixels");
  assert.equal(loads, b.BOOT_IMAGE_MANIFEST.length, "completed images are retained and reused");
  const abort = new AbortController(); abort.abort();
  await assert.rejects(b.bootImageTasks()[0].run(abort.signal));
  cache.reset("run-2"); assert.equal(removals, loads); assert.equal(cache.isReady(FIRST_VIEWPORT_ASSETS[0].src), false);
  await cache.decode(FIRST_VIEWPORT_ASSETS[0].src, new AbortController().signal); assert.equal(loads, b.BOOT_IMAGE_MANIFEST.length + 1);
  cache.reset(null);
  // A first-open timeout must not abort a decode still owned by boot.
  const pendingImages = [];
  globalThis.Image = class {
    constructor() { pendingImages.push(this); }
    set src(value) { this.url = value; }
    decode() { return Promise.resolve(); }
    removeAttribute() { this.url = ""; }
  };
  cache.reset("pending-run"); const one = new AbortController(), two = new AbortController();
  const first = cache.decode("/shared.jpg", one.signal), second = cache.decode("/shared.jpg", two.signal);
  assert.equal(pendingImages.length, 1); one.abort(); await assert.rejects(first);
  assert.equal(pendingImages[0].url, "/shared.jpg", "remaining consumer owns the pending decode");
  pendingImages[0].onload(); await second; assert.equal(cache.isReady("/shared.jpg"), true);
  let completeRefresh;
  pendingImages[0].decode = () => new Promise(resolve => { completeRefresh = resolve; });
  const refresh = cache.decode("/shared.jpg", new AbortController().signal);
  assert.equal(cache.isReady("/shared.jpg"), false, "retained pixels are revalidated before being reported ready");
  const stale = cache.decode("/old-session.jpg", new AbortController().signal);
  cache.reset("new-run"); await assert.rejects(stale); await assert.rejects(refresh);
  completeRefresh(); await Promise.resolve(); assert.equal(cache.isReady("/shared.jpg"), false);
  assert.equal(pendingImages[1].url, ""); assert.equal(cache.isReady("/shared.jpg"), false);
  cache.reset(null);
  console.log(`PASS: ${FIRST_VIEWPORT_ASSETS.length} first-viewport assets / ${FIRST_VIEWPORT_ASSETS.reduce((sum, x) => sum + x.bytes, 0)} bytes; ${b.BOOT_IMAGE_MANIFEST.length} total / ${bytes} bytes, stable render URLs, original exclusion, retained decodes, cancellation and Run 2`);
} finally { globalThis.Image = originalImage; await server.close(); }
