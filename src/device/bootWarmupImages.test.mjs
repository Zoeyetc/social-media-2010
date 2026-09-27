import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "silent" });
const originalImage = globalThis.Image;
try {
  const { BOOT_IMAGE_MANIFEST, BOOT_IMAGE_LIMIT, BOOT_IMAGE_BYTE_BUDGET, BOOT_IMAGE_MAX_EDGE, bootImageTasks } = await server.ssrLoadModule("/src/device/bootWarmupImages.ts");
  let bytes = 0, count = 0;
  for (const source of [new URL("./bootWarmupImages.ts", import.meta.url), new URL("../data/springBoardSocialApps.ts", import.meta.url)]) {
    for (const match of readFileSync(source, "utf8").matchAll(/from "([^"\n]+\.(?:png|svg))"/g)) {
      const data = readFileSync(new URL(match[1], source)); bytes += data.length; count++;
      if (match[1].endsWith(".png")) {
        assert.ok(data.readUInt32BE(16) <= BOOT_IMAGE_MAX_EDGE && data.readUInt32BE(20) <= BOOT_IMAGE_MAX_EDGE, "no full-resolution photographs in warm-up");
      }
    }
  }
  assert.equal(count, BOOT_IMAGE_MANIFEST.length);
  assert.ok(count <= BOOT_IMAGE_LIMIT); assert.ok(bytes <= BOOT_IMAGE_BYTE_BUDGET);
  let loads = 0, decodes = 0, latest;
  globalThis.Image = class {
    constructor() { latest = this; }
    set src(value) { this.url = value; loads++; queueMicrotask(() => this.onload?.()); }
    decode() { decodes++; return Promise.resolve(); }
    removeAttribute() { this.url = ""; }
  };
  for (const task of bootImageTasks()) await task.run(new AbortController().signal);
  assert.equal(loads, count); assert.equal(decodes, count);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(bootImageTasks()[0].run(abort.signal)); assert.equal(loads, count, "cancelled work never loads an image");
  assert.equal(latest.url, "");
  console.log(`PASS: ${count} bounded images, ${bytes} encoded bytes, maximum ${BOOT_IMAGE_MAX_EDGE}px raster edge, decode and cancellation`);
} finally { globalThis.Image = originalImage; await server.close(); }
