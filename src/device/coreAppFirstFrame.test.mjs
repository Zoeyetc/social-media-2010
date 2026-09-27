import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const { createCoreAppFirstFrameGate, CORE_FIRST_FRAME_HOLD_MS } = await vite.ssrLoadModule("/src/device/coreAppFirstFrame.ts");
  const { coreAppFirstViewPlan } = await vite.ssrLoadModule("/src/device/coreAppFirstView.ts");
  const [{ createInitialMessagesState }, { createInitialFacebookState }, { createInitialTwitterState },
    { initialPublicTwitterState }, { createInitialInstagramState }] = await Promise.all([
    "/src/state/messagesState.ts", "/src/state/facebookState.ts", "/src/state/twitterState.ts",
    "/src/state/publicTwitterState.ts", "/src/state/instagramState.ts",
  ].map(path => vite.ssrLoadModule(path)));
  const state = { messages: createInitialMessagesState(), facebook: createInitialFacebookState("QA"),
    twitter: createInitialTwitterState("QA"), publicTwitter: initialPublicTwitterState,
    instagram: createInitialInstagramState(), elapsedMs: 0 };
  const plans = Object.fromEntries(["messages", "facebook", "twitter", "instagram"].map(app => [app, coreAppFirstViewPlan(app, state)]));
  assert.match(plans.messages.source, /^messages-/);
  assert.equal(plans.facebook.source, "facebook-home");
  assert.equal(plans.twitter.source, "twitter-timeline");
  assert.equal(plans.instagram.source, "instagram-feed");
  assert.ok(plans.facebook.imageSrc && plans.twitter.imageSrc && plans.instagram.imageSrc);
  assert.equal(plans.messages.imageSrc, undefined);

  let now = 0, next = 0;
  const timers = new Map(), decodes = new Map(), marks = [], opened = [];
  const gate = createCoreAppFirstFrameGate({
    now: () => now,
    timer: (callback, delay) => { const id = ++next; timers.set(id, { callback, at: now + delay }); return () => timers.delete(id); },
    decode: (src, signal) => new Promise(resolve => { decodes.set(src, { resolve, signal }); }),
    mark: name => marks.push(name),
  });
  const advance = ms => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } };
  const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };
  gate.request("twitter", "run-1", plans.twitter, () => opened.push("twitter"));
  assert.deepEqual(opened, [], "tap remains on the stable SpringBoard during preparation");
  advance(CORE_FIRST_FRAME_HOLD_MS - 1); assert.deepEqual(opened, []);
  advance(1); assert.deepEqual(opened, ["twitter"], "hard fallback is bounded at 150ms");
  gate.revealed("twitter", "run-1");
  assert.equal(gate.snapshot().twitter.timeoutFallbackUsed, true);
  assert.equal(gate.snapshot().twitter.firstOpenLatencyMs, CORE_FIRST_FRAME_HOLD_MS);
  assert.match(gate.snapshot().twitter.firstFrameSource, /fixed-geometry-fallback$/);
  decodes.get(plans.twitter.imageSrc).resolve(); await flush();
  assert.deepEqual(opened, ["twitter"], "late decode cannot launch twice");
  gate.request("twitter", "run-1", plans.twitter, () => opened.push("twitter-again"));
  assert.equal(opened.at(-1), "twitter-again", "second open has no first-use hold");

  gate.request("facebook", "run-1", plans.facebook, () => opened.push("facebook"));
  assert.equal(opened.at(-1), "twitter-again");
  decodes.get(plans.facebook.imageSrc).resolve(); await flush();
  assert.equal(opened.at(-1), "facebook");
  gate.revealed("facebook", "run-1");
  assert.equal(gate.snapshot().facebook.timeoutFallbackUsed, false);
  assert.ok(marks.includes("sm2010:facebook-open-request") && marks.includes("sm2010:facebook-first-frame"));
  gate.request("messages", "run-1", plans.messages, () => opened.push("messages"));
  assert.notEqual(opened.at(-1), "messages");
  await flush(); assert.equal(opened.at(-1), "messages", "synchronous data still crosses the readiness gate");
  gate.revealed("messages", "run-1");
  gate.request("instagram", "run-1", plans.instagram, () => opened.push("stale-instagram"));
  gate.reset("run-2");
  assert.equal(gate.snapshot().instagram, null);
  assert.equal(gate.snapshot().twitter, null);
  assert.equal(decodes.get(plans.instagram.imageSrc).signal.aborted, true);
  advance(CORE_FIRST_FRAME_HOLD_MS); await flush();
  assert.ok(!opened.includes("stale-instagram"), "Run 1 preparation cannot launch in Run 2");

  const screen = readFileSync(new URL("./DeviceScreen.tsx", import.meta.url), "utf8");
  const shell = readFileSync(new URL("./AppLaunchContainer.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../styles/device.css", import.meta.url), "utf8");
  const twitter = readFileSync(new URL("./TwitterContainer.tsx", import.meta.url), "utf8");
  assert.match(screen, /appRuntime\.phase === "launching"[\s\S]*<SpringBoard/, "SpringBoard remains behind core launch");
  assert.match(screen, /session\.phase === "app" && <>[\s\S]*appRuntime\.activeAppId === "twitter" && <TwitterContainer/, "only the selected app mounts");
  assert.match(shell, /useLayoutEffect[\s\S]*\.twitter-container \.twitter-navigation-bar/);
  assert.match(twitter, /useLayoutEffect\([\s\S]*timelineRef\.current\.scrollTop = state\.scrollPosition/);
  assert.match(css, /\.app-launch-container\.is-launching \{ animation: app-runtime-open/);
  assert.match(css, /\.twitter-avatar-fixture \{ width: 48px; height: 48px/);
  assert.match(css, /\.instagram-square-photo \{ width: 100%; aspect-ratio: 1 \/ 1/);
  assert.match(css, /\.facebook-home-icon \{[^}]*width: 64px; height: 58px/);
  console.log("PASS: four first-view plans, 150ms bound, atomic Twitter reveal, decoded/fallback paths, stable geometry, scroll-before-reveal structure, reopen and Run 2 reset");
} finally { await vite.close(); }
