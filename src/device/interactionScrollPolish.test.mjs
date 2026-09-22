import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { createRafScrollPersistence } = await server.ssrLoadModule("/src/device/scrollPersistence.ts");
  const commits = [];
  const frames = new Map();
  const cancelled = [];
  let nextFrame = 1;
  const persistence = createRafScrollPersistence(
    0,
    position => commits.push(position),
    callback => { const id = nextFrame++; frames.set(id, callback); return id; },
    id => { cancelled.push(id); frames.delete(id); },
  );

  persistence.record(12);
  persistence.record(24);
  persistence.record(36);
  assert.equal(frames.size, 1, "raw scroll events must share one pending animation frame");
  assert.deepEqual(commits, [], "raw events must not synchronously update reducer state");
  const [[frameId, frame]] = frames;
  frames.delete(frameId);
  frame(0);
  assert.deepEqual(commits, [36], "the frame boundary persists only the latest position");

  persistence.record(48);
  persistence.flush();
  assert.deepEqual(commits, [36, 48], "an explicit lifecycle boundary flushes the latest position");
  assert.ok(cancelled.length > 0, "flushing cleans up its pending frame");

  const camera = await server.ssrLoadModule("/src/state/cameraRollState.ts");
  let photos = camera.initialPhotosState;
  assert.equal(photos.cameraRollScrollPosition, null, "initial Camera Roll uses canonical newest-item positioning");
  photos = camera.photosStateTransition(photos, { type: "OPEN_CAMERA_ROLL" });
  photos = camera.photosStateTransition(photos, { type: "SET_CAMERA_ROLL_SCROLL_POSITION", scrollPosition: 84 });
  photos = camera.photosStateTransition(photos, { type: "OPEN_PHOTO", photoId: "photo-1", scrollPosition: 91 });
  photos = camera.photosStateTransition(photos, { type: "BACK" });
  assert.equal(photos.cameraRollScrollPosition, 91, "returning from a photo restores the exact Camera Roll position");
  photos = camera.photosStateTransition(photos, { type: "BACK" });
  photos = camera.photosStateTransition(photos, { type: "OPEN_CAMERA_ROLL" });
  assert.equal(photos.cameraRollScrollPosition, 91, "album navigation preserves the established position");
  photos = camera.photosStateTransition(photos, { type: "RESET" });
  assert.equal(photos.cameraRollScrollPosition, null, "reset restores canonical initial positioning");

  const deviceCss = readFileSync(new URL("../styles/device.css", import.meta.url), "utf8");
  const smallAppsCss = readFileSync(new URL("../styles/smallApps.css", import.meta.url), "utf8");
  const flickrCss = readFileSync(new URL("../styles/flickr.css", import.meta.url), "utf8");
  const heroCss = readFileSync(new URL("../hero/hero.css", import.meta.url), "utf8");
  for (const selector of [".twitter-timeline", ".instagram-feed", ".foursquare-root", ".tumblr-dashboard", ".photos-camera-roll-grid"]) {
    assert.match(deviceCss, new RegExp(selector.replace(".", "\\.") + "[\\s\\S]*?overscroll-behavior: contain"));
  }
  assert.match(flickrCss, /\.flickr-scroll[^}]*overscroll-behavior:contain/);
  assert.match(smallAppsCss, /\.small-note-list[^}]*overscroll-behavior:contain/);
  assert.match(heroCss, /@media \(max-width: 760px\)[\s\S]*body \{ overflow: auto; \}/, "narrow Hero document scrolling remains available");

  console.log("PASS: frame-coalesced scroll persistence, Camera Roll restoration/reset, scoped containment, and unchanged Hero outer scroll.");
} finally {
  await server.close();
}
