import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "silent" });
const noop = () => {};
const decode = text => text.replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCodePoint(parseInt(x, 16))).replaceAll("&amp;", "&").replaceAll("&quot;", '"');
const sources = html => [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(m => decode(m[1]));
try {
  const { firstViewportSources } = await server.ssrLoadModule("/src/data/firstViewportAssets.ts");
  const { IOS4KeyboardSystem } = await server.ssrLoadModule("/src/device/IOS4KeyboardSystem.tsx");
  const render = (C, props) => renderToStaticMarkup(createElement(IOS4KeyboardSystem, {}, createElement(C, { dispatch: noop, ...props })));
  const covered = (app, urls) => { const warm = new Set(firstViewportSources(app)); for (const src of urls) assert.ok(warm.has(src), `${app} first-screen URL is cold: ${src.slice(0, 130)}`); };
  const date = new Date("2010-10-20T07:02:00Z");
  const fb = await server.ssrLoadModule("/src/state/facebookState.ts");
  const { FacebookContainer } = await server.ssrLoadModule("/src/device/FacebookContainer.tsx");
  const state = fb.createInitialFacebookState("QA");
  const fbProps = { state, currentDeviceTime: "12:02 AM", elapsedMs: 0, onRequestMedia: noop };
  const home = sources(render(FacebookContainer, fbProps)); assert.equal(home.length, 9); covered("facebook", home);
  const feed = render(FacebookContainer, { ...fbProps, state: { ...state, currentView: "feed" } });
  const aboveFoldRows = [...feed.matchAll(/<article class="facebook-feed-row[\s\S]*?<\/article>/g)].slice(0, 3).map(m => m[0]).join("");
  assert.ok(sources(aboveFoldRows).length >= 6); covered("facebook", sources(aboveFoldRows));
  const tw = await server.ssrLoadModule("/src/state/twitterState.ts");
  const { initialPublicTwitterState } = await server.ssrLoadModule("/src/state/publicTwitterState.ts");
  const { TwitterContainer } = await server.ssrLoadModule("/src/device/TwitterContainer.tsx");
  const twitter = render(TwitterContainer, { state: tw.createInitialTwitterState("QA"), publicState: initialPublicTwitterState, dispatchPublic: noop, currentElapsedMs: 0, currentDeviceDateTime: date, currentDeviceTime: "12:02 AM", onLocalTweetSubmitted: noop, onRequestMedia: noop });
  covered("twitter", sources(twitter).slice(0, 5));
  const ig = await server.ssrLoadModule("/src/state/instagramState.ts");
  const { InstagramContainer } = await server.ssrLoadModule("/src/device/InstagramContainer.tsx");
  const instagram = sources(render(InstagramContainer, { state: ig.createInitialInstagramState(), currentDeviceDateTime: date, cameraRoll: { status: "ready", records: [], error: null } }));
  covered("instagram", instagram.filter(src => !/IG02\.JPG/.test(src)));
  let laterInstagram = ig.instagramStateTransition(ig.createInitialInstagramState(), { type: "DELETE_KNOWN_ACCOUNT_POST", postId: "june-ig-04" });
  const igProps = state => ({ state, currentDeviceDateTime: date, cameraRoll: { status: "ready", records: [], error: null } });
  covered("instagram", sources(render(InstagramContainer, igProps(laterInstagram))).filter(src => !/IG02\.JPG/.test(src)));
  laterInstagram = ig.instagramStateTransition(laterInstagram, { type: "DELIVER_KNOWN_ACCOUNT_POST", post: { id: "june-ig-01", mediaId: "june-ig-01", timestamp: "2010-10-20T07:05:30Z" } });
  covered("instagram", sources(render(InstagramContainer, igProps(laterInstagram))).filter(src => !/IG02\.JPG/.test(src)));
  const fsq = await server.ssrLoadModule("/src/state/foursquareState.ts");
  const { FoursquareContainer } = await server.ssrLoadModule("/src/device/FoursquareContainer.tsx");
  const foursquare = sources(render(FoursquareContainer, { state: fsq.createInitialFoursquareState(), currentDeviceDateTime: date }));
  assert.equal(foursquare.length, 9); covered("foursquare", foursquare);
  const fl = await server.ssrLoadModule("/src/state/flickrState.ts");
  const { FlickrContainer } = await server.ssrLoadModule("/src/device/FlickrContainer.tsx");
  for (const elapsedMs of [0, 8000, 16000, 24000, 32000]) covered("flickr", sources(render(FlickrContainer, { state: fl.createInitialFlickrState(), elapsedMs })));
  for (const [name, module, initial, extra] of [
    ["Tumblr", "tumblrState", "createInitialTumblrState", {}],
    ["MobileSMS", "messagesState", "createInitialMessagesState", { currentElapsedMs: 0, currentDeviceDateTime: date, currentDeviceTime: "12:02 AM", onScheduleMomReply: noop, onScheduleMomLoveReply: noop, onScheduleDadLoveReply: noop }],
  ]) {
    const m = await server.ssrLoadModule(`/src/state/${module}.ts`); const c = await server.ssrLoadModule(`/src/device/${name}Container.tsx`);
    assert.deepEqual(sources(render(c[`${name}Container`], { state: m[initial](), ...extra })), []);
  }
  const { PhotosContainer } = await server.ssrLoadModule("/src/device/PhotosContainer.tsx");
  const { initialPhotosState } = await server.ssrLoadModule("/src/state/cameraRollState.ts");
  assert.deepEqual(sources(render(PhotosContainer, { state: initialPhotosState, cameraRoll: { status: "ready", records: [], error: null } })), []);
  console.log("PASS: actual initial app markup reuses warmed URLs for all nine Facebook Home icons, first feed rows/media, Twitter initial avatars, Instagram photo/avatar/chrome, Foursquare avatars/tabs and every Flickr slideshow candidate; empty apps require no static photos");
} finally { await server.close(); }
