import { validatePageInputs } from "./validate-page-inputs.mjs";
await validatePageInputs();
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createServer } from "vite";

import { runNotificationChecks } from "../src/state/notificationState.test.mjs";

function assertSoftwareReconciliation(sources) {
  const production = sources.filter(file => !file.path.includes(".test."));
  const source = path => production.find(file => file.path === path)?.source ?? "";
  const app = source("src/device/App.tsx");
  for (const [pattern, label] of [
    [/useState<Session>\(/g, "session"],
    [/useReducer\(cameraRuntimeTransition,/g, "Camera"],
    [/useReducer\(mediaRequestTransition, null\)/g, "media request"],
    [/new DeviceAudioService\(/g, "DeviceAudio"],
  ]) {
    const owners = production.flatMap(file => [...file.source.matchAll(pattern)].map(() => file.path));
    assert.deepEqual(owners, [label === "DeviceAudio" ? "src/audio/deviceAudio.ts" : "src/device/App.tsx"], `software-only: one ${label} owner`);
  }
  for (const file of production) {
    assert.doesNotMatch(file.path, /^src\/(?:hero|assets\/hero)\//, "software-only: no physical presentation files");
    assert.doesNotMatch(file.source, /(?:from\s*|import\s*\()["'](?:three(?:["']|\/)|@react-three\/|[^"']*\/hero\/)|\b(?:HeroController|HeroSandbox|ScreenPortal|DevicePresenter)\b/, `software-only: no physical presenter dependency in ${file.path}`);
  }
  assert.match(source("src/main.tsx"), /<App\s*\/>/, "software-only: normal App entry");
  assert.match(app, /cameraSelection\.current\.get\(experienceSessionId,[\s\S]+selectCameraVideoScene\(/, "Camera selection is keyed by session ID");
  assert.equal((app.match(/selectCameraVideoScene\(/g) ?? []).length, 1, "Camera opens cannot reroll selection");
  assert.match(app, /appliedCameraSession\.current === experienceSessionId\) return;/, "same-session effect replay must not reset Camera");
  assert.match(app, /cameraRollBootstrap\.current\.get\(experienceSessionId,/, "one Camera Roll bootstrap per session ID");
  const reset = app.slice(app.indexOf("const performCanonicalShutdownReset"), app.indexOf("const captureCameraPhoto"));
  for (const controller of ["dispatchMediaRequest", "dispatchFacebook", "dispatchTwitter"]) assert.match(reset, new RegExp(`${controller}\\(\\{ type: "RESET" \\}\\)`), "software reset clears pending media and composers");
  assert.match(reset, /dispatchMessages\(\{ type: "RESET_RUNTIME" \}\)/, "software reset clears unsent MMS");
  assert.match(reset, /cameraCaptureNamespace\.current \+= 1;\s+cameraCaptureInFlight\.current = false;/, "reset invalidates pending captures without blocking new sessions");
  assert.match(app, /if \(namespace === cameraCaptureNamespace\.current\) cameraCaptureInFlight\.current = false;/, "stale capture cannot release a new session's capture lock");
  assert.match(source("src/state/messagesState.ts"), /case "SEND"[\s\S]+state\.pendingAttachments\[state\.activeConversationId\][\s\S]+attachment, createdAt: event\.createdAt/, "Messages SEND consumes shared attachment");
  assert.match(source("src/state/facebookState.ts"), /case "SUBMIT_STATUS"[\s\S]+attachment: state\.pendingAttachment/, "Facebook extends existing publication pipeline");
  assert.match(source("src/state/twitterState.ts"), /case "SUBMIT_NEW_TWEET"[\s\S]+attachment: state\.pendingAttachment/, "Twitter extends existing publication pipeline");
  assert.doesNotMatch(production.map(file => file.source).join("\n"), /Photo posting unavailable|postingUnsupported/, "no production posting-unavailable engineering copy");
}

function assertNotificationArchitecture(sources) {
  const production = sources.filter(file => !file.path.includes(".test."));
  const source = path => production.find(file => file.path === path)?.source ?? "";
  const app = source("src/device/App.tsx");
  const state = source("src/state/notificationState.ts");
  const delivery = source("src/system/notificationDelivery.ts");
  const screen = source("src/device/DeviceScreen.tsx");
  const owners = production.flatMap(file => [...file.source.matchAll(/useReducer\(notificationTransition,/g)].map(() => file.path));
  assert.deepEqual(owners, ["src/device/App.tsx"], "notification v1: one App-owned notification controller");
  assert.doesNotMatch(app, /useReducer\((?:smsNotificationStateTransition|lockNotificationStateTransition|messagesBadgeStateTransition)/, "notification v1: no parallel legacy alert/badge owner");
  assert.equal((app.match(/const event = nextDueDeviceEvent\(/g) ?? []).length, 1, "notification v1: one scheduler consumer");
  assert.match(app, /const appNotification = scheduledNotificationEvent\(event, eventTime\);\s+if \(appNotification\) deliverNotification\(appNotification, deliveryContext, notificationRef\.current, dispatchNotifications\);/, "notification v1: social policy consumes existing canonical scheduler events");
  assert.match(app, /const deliveryContext = \{ \.\.\.notificationContext, systemAlert: notificationContext\.systemAlert[\s\S]+currentWarning\(elapsed, session\.dismissedWarnings\) !== null/, "notification v1: same-tick battery threshold has sound priority");
  assert.equal((app.match(/deliver: deliverSMS,/g) ?? []).length, 4, "notification v1: all four existing SMS delivery paths use the shared controller");
  const reset = app.slice(app.indexOf("const performCanonicalShutdownReset"), app.indexOf("const captureCameraPhoto"));
  assert.match(reset, /dispatchNotifications\(\{ type: "RESET" \}\)/, "notification v1: completed runtime reset clears notifications");
  assert.match(state, /case "RESET": return createInitialNotificationState\(\);/, "notification v1: reset recreates session-local queue, unread IDs and dedup claims");
  assert.doesNotMatch(state + delivery, /localStorage|sessionStorage|setTimeout|setInterval|Date\.now|new Date|new Audio|AudioContext|createElement\(["']audio/, "notification v1: no persistence, parallel clock or audio bypass");
  assert.doesNotMatch(app + state + delivery + source("src/system/smsNotification.ts") + source("src/device/AppNotificationAlert.tsx") + source("src/device/NotificationDebug.tsx"), /new Audio|HTMLAudioElement|AudioContext|<audio\b|createElement\(["']audio/, "notification v1: presentation and adapters cannot bypass DeviceAudio");
  assert.match(delivery, /if \(decision\.sound\) DeviceAudio\.notificationReceived\("message"\);/, "notification v1: sound uses DeviceAudio only at delivery");
  assert.match(delivery, /state\.delivered\.includes\(`\$\{event\.app\}:\$\{event\.id\}`\)/, "notification v1: delivery sound is idempotent");
  for (const appName of ["messages", "facebook", "twitter", "instagram", "foursquare"]) assert.match(state, new RegExp(`${appName}: \\{ kinds:`), `notification v1: explicit ${appName} policy`);
  assert.match(state, /context\.terminal \|\| context\.systemAlert \|\| context\.keyboard \|\| context\.multitasking/, "notification v1: system/keyboard/multitasking priority is explicit");
  assert.match(app, /messagesBadgeCount: messagesUnreadIds\.length,\s+notificationBadgeCounts: notificationBadges\(notifications\)/, "notification v1: badges derive from shared unread state, not legacy Session.badges");
  assert.match(screen, /onVisibilityChange=\{setNotificationKeyboardVisible\}/, "notification v1: keyboard reports actual visibility");
  assert.match(app, /DeviceAudio\.lowBatteryWarning\(\)/, "notification v1: system battery sound remains owned by App");
  assert.doesNotMatch(state + delivery, /DeviceAudio\.lowBatteryWarning|app: "battery"|app: "power"/, "notification v1: system alerts never enter app queue");
  assert.match(screen, /<LowBatteryAlert[\s\S]+<SMSAlertOverlay[\s\S]+<AppNotificationAlert/, "notification v1: retain system/SMS ordering and one social surface");
  assert.match(app, /appNotification: currentNotification\?\.app !== "messages" && session\.phase !== "locked" \? currentNotification : null/, "notification v1: social and SMS surfaces are mutually exclusive");
  assert.doesNotMatch(screen + source("src/device/AppNotificationAlert.tsx"), /<(?:NotificationCenter|NotificationBanner)|className="(?:notification-center|notification-banner)/, "notification v1: no modern notification surfaces");
  assert.match(source("src/device/NotificationDebug.tsx"), /!import\.meta\.env\.DEV[\s\S]+get\("notificationDebug"\) !== "1"/, "notification v1: diagnostics require DEV and query opt-in");
}

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vite = await createServer({ root: projectRoot, server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });

try {
  const messages = await vite.ssrLoadModule("/src/state/messagesState.ts");
  const messagesBadge = await vite.ssrLoadModule("/src/state/messagesBadgeState.ts");
  const facebook = await vite.ssrLoadModule("/src/state/facebookState.ts");
  const twitter = await vite.ssrLoadModule("/src/state/twitterState.ts");
  const twitterTimelineComposition = await vite.ssrLoadModule("/src/state/twitterTimelineComposition.ts");
  const foursquare = await vite.ssrLoadModule("/src/state/foursquareState.ts");
  const foursquareContent = await vite.ssrLoadModule("/src/data/foursquareContent.ts");
  const foursquareVenueAdapter = await vite.ssrLoadModule("/src/data/foursquareVenueAdapter.ts");
  const foursquareGameSeed = await vite.ssrLoadModule("/src/data/foursquareGameSeed.ts");
  const foursquareGameModel = await vite.ssrLoadModule("/src/data/foursquareGameModel.ts");
  const tumblr = await vite.ssrLoadModule("/src/state/tumblrState.ts");
  const flickr = await vite.ssrLoadModule("/src/state/flickrState.ts");
  const instagram = await vite.ssrLoadModule("/src/state/instagramState.ts");
  const instagramPopular = await vite.ssrLoadModule("/src/data/instagramPopularContent.ts");
  const seedContent = await vite.ssrLoadModule("/src/data/sessionSeedContent.ts");
  const coreSocialFriends = await vite.ssrLoadModule("/src/data/coreSocialFriends.ts");
  const facebookActors = await vite.ssrLoadModule("/src/data/facebookActors.ts");
  const facebookMedia = await vite.ssrLoadModule("/src/data/facebookMedia.ts");
  const facebookAlbums = await vite.ssrLoadModule("/src/data/facebookAlbums.ts");
  const facebookStoryMedia = await vite.ssrLoadModule("/src/data/facebookStoryMedia.ts");
  const facebookStoryTime = await vite.ssrLoadModule("/src/data/facebookStoryTime.ts");
  const facebookActorMedia = await vite.ssrLoadModule("/src/data/facebookActorMedia.ts");
  const facebookPages = await vite.ssrLoadModule("/src/data/facebookPages.ts");
  const sharedCharacterMedia = await vite.ssrLoadModule("/src/data/sharedCharacterMedia.ts");
  const twitterAvatars = await vite.ssrLoadModule("/src/data/twitterAvatarRegistry.ts");
  const sessionTimeline = await vite.ssrLoadModule("/src/data/sessionTimeline.ts");
  const canonicalVenues = await vite.ssrLoadModule("/src/data/canonicalVenues.ts");
  const canonicalVenueGeography = await vite.ssrLoadModule("/src/data/canonicalVenueGeography.ts");
  const canonicalMapGeometry = await vite.ssrLoadModule("/src/data/canonicalMapGeometry.ts");
  const shared2010Map = await vite.ssrLoadModule("/src/device/Shared2010Map.tsx");
  const foursquareMapOverlay = await vite.ssrLoadModule("/src/device/FoursquareMapOverlay.tsx");
  const facebookMapOverlay = await vite.ssrLoadModule("/src/device/FacebookMapOverlay.tsx");
  const facebookStateForMap = await vite.ssrLoadModule("/src/state/facebookState.ts");
  const scheduler = await vite.ssrLoadModule("/src/state/deviceEventScheduler.ts");
  const deviceMachine = await vite.ssrLoadModule("/src/state/deviceMachine.ts");
  const appRuntime = await vite.ssrLoadModule("/src/state/appRuntimeState.ts");
  const cameraRollPersistence = await vite.ssrLoadModule("/src/state/cameraRollPersistence.ts");
  const cameraVideoScenes = await vite.ssrLoadModule("/src/world/cameraVideoScenes.ts");

  const seed = seedContent.SESSION_SEED_CONTENT;
  assert.equal(cameraVideoScenes.CAMERA_VIDEO_EVENT_WEIGHTS.reduce((sum, entry) => sum + entry.weight, 0), 100, "Camera event weights must total 100");
  assert.equal(new Set(cameraVideoScenes.cameraVideoScenes.map(scene => scene.id)).size, cameraVideoScenes.cameraVideoScenes.length, "active Camera scene IDs must be unique");
  assert.ok(cameraVideoScenes.cameraVideoScenes.every(scene => cameraVideoScenes.CAMERA_VIDEO_EVENT_TYPES.includes(scene.eventType)), "every active Camera scene must use a valid event type");
  assert.ok(cameraVideoScenes.cameraVideoScenes.every(scene => scene.runtimeCompatible === true), "only runtime-compatible Camera scenes may enter the active pool");
  assert.deepEqual(cameraVideoScenes.excludedCameraVideoAssets.map(asset => asset.filename), ["diner-closing-shift-01.mp4", "street-passing-car-02.mp4"], "QuickTime-container assets must remain explicitly excluded");
  assert.equal(cameraVideoScenes.getCameraVideoScene(cameraVideoScenes.resolveCameraVideoSceneId("unsupported-scene")).id, "residential-cat-01", "invalid direct scene resolution must retain the deterministic default");
  assert.deepEqual(cameraVideoScenes.getScenesByEventType("cat").map(scene => scene.id), ["residential-cat-01", "residential-cat-02"], "cat variants must remain grouped by event type");
  assert.deepEqual(cameraVideoScenes.selectCameraVideoScene({ cameraScene: "residential-cat-02", cameraEvent: "yard", random: () => { throw new Error("forced scene must not consume randomness"); } }), { eventType: "cat", sceneId: "residential-cat-02", videoDisabled: false, forcedByQuery: "cameraScene" }, "cameraScene must force an exact active scene ahead of cameraEvent");
  assert.deepEqual(cameraVideoScenes.selectCameraVideoScene({ cameraEvent: "cat", random: () => 0.999 }), { eventType: "cat", sceneId: "residential-cat-02", videoDisabled: false, forcedByQuery: "cameraEvent" }, "cameraEvent must choose a deterministic injected-RNG variant");
  assert.deepEqual(cameraVideoScenes.selectCameraVideoScene({ cameraVideo: "off", cameraScene: "residential-cat-02", random: () => { throw new Error("disabled video must bypass selection"); } }), { eventType: "nothing", sceneId: "nothing-happens-01", videoDisabled: true, forcedByQuery: "cameraVideo" }, "cameraVideo=off must have highest precedence and bypass randomness");
  assert.deepEqual(cameraVideoScenes.selectCameraVideoScene({ cameraScene: "unsupported-scene", random: () => 0 }), { eventType: "nothing", sceneId: "nothing-happens-01", videoDisabled: false, forcedByQuery: null }, "unsupported cameraScene must fall back to weighted selection");
  assert.deepEqual(cameraVideoScenes.selectCameraVideoScene({ cameraEvent: "unsupported-event", random: () => 0.45 }), { eventType: "cat", sceneId: "residential-cat-01", videoDisabled: false, forcedByQuery: null }, "unsupported cameraEvent must fall back to weighted selection");
  assert.deepEqual(cameraVideoScenes.CAMERA_VIDEO_EVENT_WEIGHTS.map(({ eventType }) => cameraVideoScenes.selectCameraVideoScene({ random: () => ({ nothing: 0, cat: 0.45, "passing-car": 0.65, "diner-closing": 0.8, "apartment-light": 0.88, "passing-bus": 0.93, "parking-unlock": 0.96, yard: 0.98 })[eventType] }).eventType), cameraVideoScenes.CAMERA_VIDEO_EVENT_WEIGHTS.map(({ eventType }) => eventType), "deterministic weighted boundaries must select every configured event group");
  assert.deepEqual(coreSocialFriends.CORE_SOCIAL_CHARACTER_IDS, ["katie", "matt", "alex", "chris", "jay", "june", "jack", "ben", "luca"]);
  assert.deepEqual(facebookPages.FACEBOOK_PAGES.map(page => [page.id, page.name, page.category, page.venueId ?? null, page.avatarMediaId, page.posts.length]), [
    ["facebook-page-high-school-festival", "High School Festival", "School / Event", null, null, 0],
    ["facebook-page-main-street-diner", "Main Street Diner", "Local Business / Restaurant", "main-street-diner", null, 0],
    ["facebook-page-gelato-roma", "Gelato Roma", "Local Business / Food & Drink", "gelato-roma", null, 0],
  ], "Facebook Pages must remain an exact three-record sparse local dataset");
  assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS["author-z-tokyo"], undefined, "author easter egg must not enter the canonical character registry");
  assert.deepEqual(
    facebookActors.FACEBOOK_AUTHOR_EASTER_EGGS[facebookActors.FACEBOOK_AUTHOR_EASTER_EGG_ID],
    { id: "author-z-tokyo", displayName: "Z.tokyo", classification: "AUTHOR_EASTER_EGG", profileMediaId: "z-tokyo-profile-picture" },
  );
  assert.deepEqual(
    Object.values(coreSocialFriends.CORE_SOCIAL_CHARACTERS).map(character => [character.id, character.category, character.lifeStage, character.classification]),
    [
      ["katie", "core-friend", "young-social-circle", "CURATED FICTIONAL"],
      ["matt", "core-friend", "young-social-circle", "CURATED FICTIONAL"],
      ["alex", "core-friend", "young-social-circle", "CURATED FICTIONAL"],
      ["chris", "core-friend", "young-social-circle", "CURATED FICTIONAL"],
      ["jay", "core-friend", "young-social-circle", "CURATED FICTIONAL"],
      ["june", "narrative-contact", "young-social-circle", "CURATED FICTIONAL"],
      ["jack", "narrative-contact", "young-social-circle", "CURATED FICTIONAL"],
      ["ben", "extended-friend", "working-adult", "CURATED FICTIONAL"],
      ["luca", "extended-friend", "working-adult", "CURATED FICTIONAL"],
    ],
    "the canonical social character set, categories, and life-stage anchors must remain locked",
  );
  assert.strictEqual(coreSocialFriends.CORE_SOCIAL_FRIENDS.katie, coreSocialFriends.CORE_SOCIAL_CHARACTERS.katie, "compatibility views must reuse canonical identity objects");
  assert.strictEqual(coreSocialFriends.CORE_SOCIAL_FRIENDS.jay, coreSocialFriends.CORE_SOCIAL_CHARACTERS.jay, "compatibility views must not duplicate character records");
  const expectedTwitterAvatars = [
    ["june", "june-profile-avatar", "June01.PNG", "50% 35%"],
    ["matt", "matt-profile-current", "Matt03.JPG", "50% 34%"],
    ["jack", "jack-profile-picture", "Jack01.PNG", "50% 35%"],
    ["alex", "alex-profile-picture", "Alex.png", "50% 24%"],
    ["ben", "ben-profile-current", "Ben01.JPG", "50% 30%"],
    ["katie", "katie-profile-picture", "Katie03.PNG", "50% 35%"],
    ["chris", "chris-profile-picture", "Chris01.PNG", "50% 30%"],
    ["luca", "luca-profile-picture", "Luca.png", "50% 50%"],
  ];
  assert.deepEqual(Object.values(twitterAvatars.TWITTER_AVATAR_REGISTRY)
    .filter(record => record.classification === "CANONICAL_AVATAR_CANDIDATE")
    .map(record => [record.identityId, record.mediaId, sharedCharacterMedia.getSharedCharacterMedia(record.mediaId).originalFilename, record.objectPosition]), expectedTwitterAvatars, "Twitter Avatar Pass A must contain exactly the eight approved canonical media mappings and deterministic crops");
  for (const [identityId, mediaId, , objectPosition] of expectedTwitterAvatars) {
    const stable = twitterAvatars.resolveTwitterAvatar({ identityId, displayName: "irrelevant" });
    const bridged = twitterAvatars.resolveTwitterAvatar({ displayName: coreSocialFriends.CORE_SOCIAL_CHARACTERS[identityId].displayName });
    assert.deepEqual([stable.mediaId, stable.objectPosition], [mediaId, objectPosition], `${identityId} must resolve from its stable identity ID`);
    assert.deepEqual([bridged.mediaId, bridged.objectPosition], [mediaId, objectPosition], `${identityId} temporary name bridge must resolve the identical avatar and crop`);
  }
  assert.deepEqual(
    [twitterAvatars.TWITTER_DEFAULT_AVATAR.identityId, twitterAvatars.TWITTER_DEFAULT_AVATAR.mediaId, twitterAvatars.TWITTER_DEFAULT_AVATAR.classification, twitterAvatars.TWITTER_DEFAULT_AVATAR.objectPosition],
    ["twitter-default", "twitter-default-egg-2010-reconstructed", "RECONSTRUCTED_FROM_PERIOD_SCREENSHOT", "50% 50%"],
    "Twitter Avatar Pass C must expose one centralized reconstructed default descriptor",
  );
  assert.deepEqual(
    ["cnn", "nasa"].map(identityId => {
      const resolved = twitterAvatars.resolveTwitterAvatar({ identityId, displayName: "must-not-drive-resolution" });
      return [resolved.identityId, resolved.mediaId, resolved.classification, resolved.objectPosition];
    }),
    [
      ["cnn", "cnn-2010-reconstructed", "RECONSTRUCTED_FROM_PERIOD_SCREENSHOT", "50% 50%"],
      ["nasa", "nasa-2010-reconstructed", "RECONSTRUCTED_FROM_PERIOD_EVIDENCE", "50% 50%"],
    ],
    "Pass B1 must resolve only the approved CNN and NASA public-account avatars by stable identity ID",
  );
  for (const identityId of ["jay", "dana", "nora", "mia", "marcus", "eli", "claire", "sam", "priya", "eva", "session-owner", "nytimes", "npr", "time", "bbcworld", "conan-obrien"]) {
    assert.equal(twitterAvatars.resolveTwitterAvatar({ identityId, displayName: identityId }).mediaId, "twitter-default-egg-2010-reconstructed", `${identityId} must resolve to the Pass C egg fallback`);
  }
  assert.equal(twitterAvatars.TWITTER_AVATAR_REGISTRY.nprnews, undefined, "@nprnews period media must not be cross-mapped onto the project's @NPR account");
  assert.equal(twitterAvatars.TWITTER_AVATAR_REGISTRY.bbcbreaking, undefined, "@bbcbreaking period media must not be cross-mapped onto the project's @BBCWorld account");
  assert.equal(twitterAvatars.resolveTwitterAvatar({ displayName: "June", allowNameBridge: false }).mediaId, "twitter-default-egg-2010-reconstructed", "session-owner and public-visitor resolution must disable the canonical name bridge and use the egg");
  const publicAvatarProbe = twitterTimelineComposition.composeTwitterTimelineActivities([], [{ id: "public-avatar-probe", publicHandle: "june", displayName: "June", body: "probe", simulated2010CreatedAt: "2010-10-20T07:03:00.000Z", simulatedElapsedMs: 60 }], ["public-avatar-probe"], 60)[0];
  assert.deepEqual(publicAvatarProbe.capabilities, { detail: false, profile: false, reply: false, retweet: false, favorite: true }, "egg fallback must not grant public visitors account or Profile capabilities");
  assert.equal(twitterAvatars.resolveTwitterAvatar({ displayName: publicAvatarProbe.tweet.displayName, allowNameBridge: false }).mediaId, "twitter-default-egg-2010-reconstructed", "a public visitor whose name matches a fictional character must still use the egg");
  const twitterDefaultEggSource = await readFile(resolve(projectRoot, "src/assets/twitter/avatar/twitter-default-egg-2010-reconstructed.svg"), "utf8");
  assert.match(twitterDefaultEggSource, /width="48" height="48" viewBox="0 0 48 48"/, "Pass C egg must use its deterministic native 48-point canvas");
  assert.match(twitterDefaultEggSource, /fill="#91b7ca"[\s\S]*fill="#f3f0e7"/, "Pass C egg must retain the approved reconstructed blue-field and pale-egg colors");
  assert.doesNotMatch(twitterDefaultEggSource, /<text|<circle|filter=|gradient|shadow/i, "Pass C egg must not contain initials, circular avatar construction, filters, gradients, or shadows");
  assert.deepEqual(coreSocialFriends.CORE_SOCIAL_RELATIONSHIPS.map(relationship => [relationship.id, relationship.participantIds, relationship.kind]), [
    ["katie-ben-siblings", ["katie", "ben"], "SIBLINGS"],
    ["chris-luca-basketball-friends", ["chris", "luca"], "BASKETBALL_FRIENDS"],
    ["jack-matt-neighbors-family-friends", ["jack", "matt"], "LONGTIME_NEIGHBORS_FAMILY_FRIENDS"],
    ["june-sophie-best-friends", ["june", "facebook-ephemeral-sophie"], "BEST_FRIENDS"],
  ]);
  assert.deepEqual(coreSocialFriends.CORE_SOCIAL_BAND.members.map(member => [member.entityId, member.role, member.accountBoundary]), [
    ["jay", "GUITAR", "CORE_SOCIAL_CHARACTER"],
    ["matt", "BASS", "CORE_SOCIAL_CHARACTER"],
    ["author-z-tokyo", "KEYBOARD", "AUTHOR_EASTER_EGG"],
    ["offline-anil", "DRUMS", "OFFLINE_NO_SNS"],
  ], "canonical band roles and account boundaries must remain exact");
  assert.equal(coreSocialFriends.CORE_SOCIAL_BEHAVIOR.matt.personalityBoundary, "INTROVERTED_NOT_STEREOTYPE", "Matt's introversion must remain canon without stereotype reduction");
  assert.deepEqual(coreSocialFriends.CORE_SOCIAL_BEHAVIOR.chris, { selfPosting: "VERY_LOW", taggedPresence: "MEDIUM_HIGH", engagement: "INTERACTION_FIRST", presenceModel: "INTERACTION_FIRST" }, "Chris must remain sparse and interaction-first");
  assert.deepEqual(coreSocialFriends.CORE_SOCIAL_INTENTIONAL_AMBIGUITIES.map(ambiguity => [ambiguity.id, ambiguity.participantIds]), [
    ["june-jack-relationship", ["june", "jack"]],
    ["sophie-jack-history-interest", ["facebook-ephemeral-sophie", "jack"]],
  ], "approved relationship ambiguities must remain unresolved");
  assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS.sophie, undefined, "Sophie must remain outside the canonical nine");
  assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS.anil, undefined, "offline-only Anil must remain outside the SNS character registry");
  const facebookSessionStartMs = Date.parse("2010-10-20T00:02:00-07:00");
  const parseExplicitFlickrTimestamp = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}) (AM|PM)$/.exec(value);
    assert.ok(match, `Flickr timestamp must include an explicit YYYY-MM-DD date and 12-hour time: ${value}`);
    const [, year, month, day, hourText, minute, meridiem] = match;
    const hour12 = Number(hourText);
    assert.ok(hour12 >= 1 && hour12 <= 12, `Flickr timestamp hour must be 1-12: ${value}`);
    const hour24 = hour12 % 12 + (meridiem === "PM" ? 12 : 0);
    const parsed = Date.parse(`${year}-${month}-${day}T${String(hour24).padStart(2, "0")}:${minute}:00-07:00`);
    assert.ok(Number.isFinite(parsed), `Flickr timestamp must be chronologically parseable: ${value}`);
    return parsed;
  };
  const formatFacebookTime = (storyTimestamp, elapsedSeconds, extras = {}) => facebookStoryTime.formatFacebookStoryTime({ storyTimestamp, simulatedNowMs: facebookSessionStartMs + elapsedSeconds * 1_000, storyType: "status", ...extras });
  assert.equal(formatFacebookTime("2010-10-20T00:03:00-07:00", 60), "just now");
  assert.equal(formatFacebookTime("2010-10-20T00:03:00-07:00", 120), "1 minute ago");
  assert.equal(formatFacebookTime("2010-10-20T00:03:00-07:00", 180), "2 minutes ago");
  assert.equal(formatFacebookTime("2010-10-19T20:02:00-07:00", 0), "Tue 8:02 PM");
  assert.equal(formatFacebookTime("2010-10-18T20:51:00-07:00", 0), "Mon 8:51 PM");
  assert.equal(formatFacebookTime("2010-05-15T18:00:00-07:00", 0), "May 15");
  assert.equal(formatFacebookTime("2010-10-18T20:51:00-07:00", 0, { sourceApp: "iPhoto Uploader" }), "Mon 8:51 PM via iPhoto Uploader");
  assert.equal(formatFacebookTime("2010-10-19T22:44:00-07:00", 0, { storyType: "checkin" }), "Tue 10:44 PM", "previous-day Places stories must expose the cross-midnight calendar boundary");
  const futureStoryDisplay = formatFacebookTime("2010-10-20T00:10:00-07:00", 0, { storyId: "invalid-future-seed" });
  assert.equal(futureStoryDisplay, "Wed 12:10 AM", "future timestamps must use deterministic absolute fallback rather than just now");
  assert.notEqual(futureStoryDisplay, "just now");
  const facebookSeedTimestampAudit = Object.fromEntries(seed.facebook.feed.filter(item => item.origin === "seed").map(item => [item.id, item.createdAt]));
  assert.deepEqual(
    Object.fromEntries(["ben-long-day", "jack-movie", "alex-jacks-party-friday", "katie-coffee"].map(id => [id, facebookSeedTimestampAudit[id]])),
    {
      "ben-long-day": "2010-10-19T23:58:00-07:00",
      "jack-movie": "2010-10-19T23:52:00-07:00",
      "alex-jacks-party-friday": "2010-10-19T23:47:00-07:00",
      "katie-coffee": "2010-10-19T23:41:00-07:00",
    },
    "all late-night pre-session stories must belong to October 19",
  );
  assert.ok(seed.facebook.feed.filter(item => item.origin === "seed").every(item => item.createdAt && facebookStoryTime.isFacebookSeedStoryTimestampValid(item.createdAt, facebookSessionStartMs)), "every Facebook seed story must carry an explicit timestamp before session start");
  assert.equal(facebookStoryTime.isFacebookSeedStoryTimestampValid("2010-10-20T00:03:00-07:00", facebookSessionStartMs), false, "future seed content must fail the strict boundary guard");
  const atThirteenMinutes = facebookSessionStartMs + 11 * 60_000;
  const atThirteen = storyTimestamp => facebookStoryTime.formatFacebookStoryTime({ storyTimestamp, simulatedNowMs: atThirteenMinutes, storyType: "status" });
  assert.deepEqual(
    [atThirteen("2010-10-19T23:58:00-07:00"), atThirteen("2010-10-19T23:52:00-07:00"), atThirteen("2010-10-19T23:47:00-07:00"), atThirteen("2010-10-19T23:41:00-07:00"), atThirteen("2010-10-20T00:03:00-07:00"), atThirteen("2010-10-20T00:04:15-07:00"), atThirteen("2010-10-19T22:00:00-07:00")],
    ["Tue 11:58 PM", "Tue 11:52 PM", "Tue 11:47 PM", "Tue 11:41 PM", "10 minutes ago", "8 minutes ago", "Tue 10:00 PM"],
    "previous-day seed stories must use weekday/time while current-day live stories remain relative",
  );
  const crossMidnightFeedCases = [
    ["luca-main-street-diner-checkin", "2010-10-19T22:44:00-07:00", "checkin", "Tue 10:44 PM"],
    ["luca-pickup-basketball-photos", "2010-10-19T22:58:00-07:00", "album", "Tue 10:58 PM"],
    ["jay-reading", "2010-10-19T23:33:00-07:00", "status", "Tue 11:33 PM"],
    ["katie-coffee", "2010-10-19T23:41:00-07:00", "activity", "Tue 11:41 PM"],
    ["alex-jacks-party-friday", "2010-10-19T23:47:00-07:00", "status", "Tue 11:47 PM"],
    ["jack-movie", "2010-10-19T23:52:00-07:00", "status", "Tue 11:52 PM"],
    ["ben-long-day", "2010-10-19T23:58:00-07:00", "status", "Tue 11:58 PM"],
    ["jay-band-performance-photo", "2010-10-19T22:00:00-07:00", "photo", "Tue 10:00 PM"],
  ];
  assert.deepEqual(crossMidnightFeedCases.map(([storyId, storyTimestamp, storyType]) => [storyId, facebookStoryTime.formatFacebookStoryTime({ storyId, storyTimestamp, simulatedNowMs: atThirteenMinutes, storyType })]), crossMidnightFeedCases.map(([storyId, , , display]) => [storyId, display]), "all Oct 19 Feed metadata must retain Tuesday across midnight");
  assert.equal(facebookStoryTime.formatFacebookStoryTime({ storyId: "ben-long-day", storyTimestamp: "2010-10-19T23:58:00-07:00", simulatedNowMs: atThirteenMinutes, storyType: "status", surface: "detail" }), "October 19 11:58 PM", "2010 Detail metadata must omit the reconstruction year and connective at");
  assert.equal(facebookStoryTime.formatFacebookStoryTime({ storyId: "jay-band-performance-photo", storyTimestamp: "2010-10-19T22:00:00-07:00", simulatedNowMs: atThirteenMinutes, storyType: "photo", surface: "detail" }), "October 19 10:00 PM", "Jay Detail must preserve the intentional October 19 upload timestamp without 2010-era redundancy");
  assert.equal(facebookStoryTime.formatFacebookStoryTime({ storyId: "june-instagram-announcement", storyTimestamp: "2010-10-20T00:03:00-07:00", simulatedNowMs: atThirteenMinutes, storyType: "status", surface: "detail" }), "October 20 12:03 AM", "June Detail must format in canonical Pacific time without browser-local timezone drift");
  assert.equal(facebookStoryTime.formatFacebookStoryTime({ storyId: "alex-jacks-party-friday", storyTimestamp: "2010-10-19T23:47:00-07:00", simulatedNowMs: atThirteenMinutes, storyType: "status", surface: "detail" }), "October 19 11:47 PM", "Alex Comments Detail must use the locked 2010 timestamp convention");
  assert.equal(facebookStoryTime.formatFacebookStoryTime({ storyId: "june-fb-10-18-01", storyTimestamp: "2010-10-19T23:51:00-07:00", simulatedNowMs: atThirteenMinutes, storyType: "photo", surface: "detail" }), "October 19 11:51 PM", "June Photo Detail must use the locked 2010 timestamp convention");
  assert.equal(facebookStoryTime.formatFacebookStoryTime({ storyId: "jay-learning-by-ear-2009-11-07", storyTimestamp: "2009-11-07T23:08:00-08:00", simulatedNowMs: atThirteenMinutes, storyType: "photo", surface: "detail" }), "November 7, 2009 at 11:08 PM", "2009 Jay Detail must retain its disambiguating historical year");
  assert.equal(facebookStoryTime.formatFacebookStoryTime({ storyId: "jack-matt-2008-photo", storyTimestamp: "2008-09-20T19:32:00-07:00", simulatedNowMs: atThirteenMinutes, storyType: "photo", surface: "detail" }), "September 20, 2008 at 7:32 PM", "2008 Jack/Matt Detail must retain its disambiguating historical year");
  assert.equal(facebookStoryTime.formatFacebookStoryTime({ storyId: "matt-photo-2007", storyTimestamp: "2007-09-25T21:14:00-07:00", simulatedNowMs: atThirteenMinutes, storyType: "photo", surface: "detail" }), "September 25, 2007 at 9:14 PM", "2007 Photo Detail must retain its disambiguating historical year");
  assert.deepEqual(
    facebookAlbums.FACEBOOK_ALBUMS.map(album => [album.id, album.ownerActor.displayName, album.title, album.mediaIds, album.photos.map(photo => photo.storyId), album.classification]),
    [
      ["z-tokyo-profile-pictures", "Z.tokyo", "Profile Pictures", ["z-tokyo-profile-picture"], ["z-tokyo-profile-picture-update"], "CURATED"],
      ["mike-football-photos", "Mike", "Photos", ["jack-football-game"], ["jack-football-game-photo"], "CURATED"],
      ["sarah-beach-photos", "Sarah", "Photos", ["jack-beach-10", "jack-beach-8"], ["jack-summer-photos", "jack-summer-photos"], "CURATED"],
      ["ryan-photos", "Ryan", "Photos", ["jack-tagged-ryan"], ["ryan-jack-night-photo"], "CURATED"],
      ["sophie-photos", "Sophie Miller", "Photos", ["sophie-june-club-photo", "jack-tagged-sophie-02", "jack-tagged-sophie-03"], ["sophie-june-club-photo-story", "sophie-jack-tagged-02", "sophie-jack-tagged-03"], "CURATED"],
      ["june-profile-pictures", "June Park", "Profile Pictures", ["june-facebook-profile-picture"], ["june-profile-picture-update"], "CURATED"],
      ["june-show-10-18", "June Park", "10/18", ["june-fb-F", "june-fb-10-18-01", "june-fb-10-18-02"], ["june-show-photos-oct19", "june-show-photos-oct19", "june-show-photos-oct19"], "CURATED"],
      ["june-18th-birthday", "June Park", "18th Birthday", ["june-birthday-bag", "june-birthday-gift", "june-birthday-main"], ["june-birthday-bag-photo", "june-birthday-gift-photo", "june-birthday-main-photo"], "CURATED"],
      ["june-girls", "June Park", "Girls ♥", ["june-sophie-girls"], ["june-sophie-photo"], "CURATED"],
      ["june-senior-year", "June Park", "Senior Year", ["june-family-graduation"], ["june-graduation-photo"], "CURATED"],
["june-mobile-uploads", "June Park", "Me", ["june-starbucks-mobile", "june-home-mobile"], ["june-starbucks-photo", "june-home-photo"], "CURATED"],
["june-photos", "June Park", "Photos", ["jack-tagged-june"], ["june-jack-tagged-night-photo"], "CURATED"],
["jack-profile-pictures", "Jack Keller", "Profile Pictures", ["jack-profile-picture"], ["jack-profile-picture-update"], "CURATED"],
["jack-summer", "Jack Keller", "Summer", ["jack-summer-party"], ["jack-summer-party-photo"], "CURATED"],
["jack-18th-birthday", "Jack Keller", "18th Birthday", ["jack-birthday-02", "jack-birthday-03"], ["jack-birthday-thanks-photos", "jack-birthday-thanks-photos"], "CURATED"],
["jack-photos", "Jack Keller", "Photos", ["jack-matt-01", "jack-car", "jack-matt-02", "jack-owned-j-2009", "jack-matt-03", "jack-matt-family"], ["jack-matt-2010-photo", "jack-car-matt-2009-photos", "jack-car-matt-2009-photos", "jack-owned-j-2009-photo", "jack-matt-2008-photo", "jack-matt-family-2007-photo"], "CURATED"],
      ["luca-profile-pictures", "Luca Bennett", "Profile Pictures", ["luca-profile-picture"], ["luca-profile-picture-current"], "CURATED"],
      ["luca-pickup-basketball", "Luca Bennett", "Pickup Basketball", ["luca-basketball-01", "luca-basketball-02", "luca-basketball-03"], ["luca-pickup-basketball-photos", "luca-pickup-basketball-photos", "luca-pickup-basketball-photos"], "CURATED"],
      ["luca-photos", "Luca Bennett", "Photos", ["jack-tagged-luca-01", "luca-jack-birthday-00", "luca-jack-birthday-01", "luca-jack-birthday-02", "luca-jack-birthday-03", "luca-work-main-street-diner"], ["luca-jack-tagged-photo", "luca-jack-birthday-photos", "luca-jack-birthday-photos", "luca-jack-birthday-photos", "luca-jack-birthday-photos", "luca-work-main-street-diner"], "CURATED"],
      ["alex-profile-pictures", "Alex Wong", "Profile Pictures", ["alex-profile-picture"], ["alex-profile-picture-update"], "CURATED"],
      ["alex-dogs", "Alex Wong", "Dogs", ["alex-dogs-wangcai-bb-2009", "alex-dog-golden-2007"], ["alex-dogs-wangcai-bb-2009", "alex-dog-golden-2007"], "CURATED"],
      ["ben-profile-pictures", "Ben Dawson", "Profile Pictures", ["ben-profile-current", "ben-profile-2005"], ["ben-profile-current-update", "ben-profile-2005-update"], "CURATED"],
      ["ben-photos", "Ben Dawson", "Photos", ["ben-photo-friday-2010", "ben-car-2010", "ben-coffee-2009", "ben-coffee-2006"], ["ben-photo-friday-2010", "ben-car-2010", "ben-coffee-2009", "ben-coffee-2006"], "CURATED"],
      ["chris-profile-pictures", "Chris Morgan", "Profile Pictures", ["chris-profile-picture"], ["chris-profile-picture-update"], "CURATED"],
      ["matt-profile-pictures", "Matt Ricci", "Profile Pictures", ["matt-profile-current", "matt-profile-2007"], ["matt-profile-current-update", "matt-profile-2007-update"], "CURATED"],
      ["matt-photos", "Matt Ricci", "Photos", ["matt-code-2010", "jack-tagged-matt-02", "matt-jack-birthday", "matt-photo-2007"], ["matt-code-photo-2010", "matt-jack-tagged-photo", "matt-jack-birthday-photo", "matt-photo-2007"], "CURATED"],
      ["katie-profile-pictures", "Katie Dawson", "Profile Pictures", ["katie-profile-picture"], ["katie-profile-picture-update"], "CURATED"],
      ["katie-photo-history", "Katie Dawson", "Photos", ["katie-selfie-september-2010", "katie-selfie-july-2010", "katie-selfie-august-2009", "katie-selfie-july-2009"], ["katie-selfie-september-2010", "katie-selfie-july-2010", "katie-selfie-august-2009", "katie-selfie-july-2009"], "CURATED"],
      ["jay-music", "Jay Diaz", "Music", ["jay-band-performance", "jay-guitar", "jay-guitar-may", "jay-learning-by-ear-2009-11-07", "jay-cd-haul-2009-08-22", "jay-rehearsal-2009-06-27-01", "jay-rehearsal-2009-06-27-02", "jay-music-bedroom-2009-03-14"], ["jay-band-performance-photo", "jay-guitar-photo", "jay-may-guitar-photo", "jay-learning-by-ear-2009-11-07", "jay-cd-haul-2009-08-22", "jay-rehearsal-2009-06-27", "jay-rehearsal-2009-06-27", "jay-music-bedroom-2009-03-14"], "CURATED"],
    ],
    "Facebook albums must preserve the exact approved owner/media/story bindings",
  );
  assert.deepEqual(facebookAlbums.FACEBOOK_ALBUMS.map(album => album.mediaIds.length), [1, 1, 2, 1, 3, 1, 3, 3, 1, 1, 2, 1, 1, 1, 2, 6, 1, 3, 6, 1, 2, 2, 4, 1, 2, 4, 1, 4, 8], "album counts must derive from approved media membership");
const jackAlbums = facebookAlbums.FACEBOOK_ALBUMS.filter(album => album.ownerActor.kind === "canonical" && album.ownerActor.characterId === "jack");
assert.deepEqual(jackAlbums.map(album => [album.id, album.title, album.mediaIds.length]), [["jack-profile-pictures", "Profile Pictures", 1], ["jack-summer", "Summer", 1], ["jack-18th-birthday", "18th Birthday", 2], ["jack-photos", "Photos", 6]], "Jack owned albums must exclude externally uploaded tagged photos");
assert.deepEqual(["jack-matt-family", "jack-matt-01", "jack-matt-02", "jack-matt-03"].filter(id => jackAlbums.flatMap(album => album.mediaIds).includes(id)), ["jack-matt-family", "jack-matt-01", "jack-matt-02", "jack-matt-03"], "Jack-owned Matt history must be present in Photos");
assert.equal(facebookActorMedia.getFacebookCanonicalProfileMediaId("jack"), "jack-profile-picture", "Jack actor media must resolve centrally");
assert.deepEqual(
  Object.fromEntries(coreSocialFriends.CORE_SOCIAL_CHARACTER_IDS.map(characterId => [characterId, coreSocialFriends.CORE_SOCIAL_CHARACTERS[characterId].displayName])),
  { katie: "Katie Dawson", matt: "Matt Ricci", alex: "Alex Wong", chris: "Chris Morgan", jay: "Jay Diaz", june: "June Park", jack: "Jack Keller", ben: "Ben Dawson", luca: "Luca Bennett" },
  "stable canonical actor IDs must resolve the locked display names without duplicate surname-based identities",
);
assert.equal(Object.values(coreSocialFriends.CORE_SOCIAL_CHARACTERS).some(character => character.displayName.includes("Kaite")), false, "Kaite must not remain as Katie's canonical name");
assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS.ben.displayName.split(" ").at(-1), coreSocialFriends.CORE_SOCIAL_CHARACTERS.katie.displayName.split(" ").at(-1), "Ben and Katie must share the canonical Dawson surname");
assert.deepEqual(facebookActorMedia.getFacebookCanonicalProfileInfo("jack"), { fullName: "Jack Keller", canonicalDateOfBirth: "1992-08-02", age: 18, birthday: "August 2", location: "Los Angeles", activity: "Football team captain", interests: ["football", "Lakers", "movies", "music"], classification: "CURATED" });
assert.equal("relationshipStatus" in facebookActorMedia.getFacebookCanonicalProfileInfo("jack"), false, "Jack relationship status must remain absent");
assert.deepEqual(seed.facebook.feed.filter(story => story.friendId === "jack" && story.profileWallEligible).map(story => story.id), ["jack-movie", "jack-matt-2010-photo", "jack-practice-brutal", "jack-car-photo", "jack-profile-picture-update", "jack-summer-party-photo", "jack-birthday-thanks-photos", "jack-car-matt-2009-photos", "jack-owned-j-2009-photo", "jack-matt-2008-photo", "jack-matt-family-2007-photo"], "Jack Wall must expose Jack-owned uploads while excluding externally owned tagged photos");
assert.equal(seed.facebook.feed.find(story => story.id === "jack-movie")?.text, "That movie was better than I expected.");
assert.deepEqual(jackAlbums.find(album => album.id === "jack-photos")?.photos.map(photo => [photo.mediaId, photo.storyId, photo.taggedCharacterIds]), [["jack-matt-01", "jack-matt-2010-photo", ["matt"]], ["jack-car", "jack-car-matt-2009-photos", ["matt"]], ["jack-matt-02", "jack-car-matt-2009-photos", ["matt"]], ["jack-owned-j-2009", "jack-owned-j-2009-photo", undefined], ["jack-matt-03", "jack-matt-2008-photo", ["matt"]], ["jack-matt-family", "jack-matt-family-2007-photo", ["matt"]]], "Jack Photos must preserve exact media/story/tag bindings");
const jackTaggedPhotos = facebookAlbums.getFacebookPhotosOfCharacter("jack");
assert.deepEqual(jackTaggedPhotos.map(({ album, photo }) => [album.id, album.ownerActor.displayName, photo.mediaId, photo.storyId, photo.timestamp]), [
  ["mike-football-photos", "Mike", "jack-football-game", "jack-football-game-photo", "2010-10-15T22:45:00-07:00"],
  ["matt-photos", "Matt Ricci", "jack-tagged-matt-02", "matt-jack-tagged-photo", "2010-10-03T20:00:00-07:00"],
  ["ryan-photos", "Ryan", "jack-tagged-ryan", "ryan-jack-night-photo", "2010-09-27T21:00:00-07:00"],
  ["june-photos", "June Park", "jack-tagged-june", "june-jack-tagged-night-photo", "2010-09-27T21:00:00-07:00"],
  ["luca-photos", "Luca Bennett", "jack-tagged-luca-01", "luca-jack-tagged-photo", "2010-09-14T20:00:00-07:00"],
  ["sophie-photos", "Sophie Miller", "jack-tagged-sophie-02", "sophie-jack-tagged-02", "2010-08-24T20:00:00-07:00"],
  ["sophie-photos", "Sophie Miller", "jack-tagged-sophie-03", "sophie-jack-tagged-03", "2010-08-24T20:00:00-07:00"],
  ["sarah-beach-photos", "Sarah", "jack-beach-10", "jack-summer-photos", "2010-08-22T17:30:00-07:00"],
  ["sarah-beach-photos", "Sarah", "jack-beach-8", "jack-summer-photos", "2010-08-22T17:30:00-07:00"],
  ["matt-photos", "Matt Ricci", "matt-jack-birthday", "matt-jack-birthday-photo", "2010-08-02T23:49:00-07:00"],
  ["luca-photos", "Luca Bennett", "luca-jack-birthday-00", "luca-jack-birthday-photos", "2010-08-02T23:17:00-07:00"],
  ["luca-photos", "Luca Bennett", "luca-jack-birthday-01", "luca-jack-birthday-photos", "2010-08-02T23:17:00-07:00"],
  ["luca-photos", "Luca Bennett", "luca-jack-birthday-02", "luca-jack-birthday-photos", "2010-08-02T23:17:00-07:00"],
  ["luca-photos", "Luca Bennett", "luca-jack-birthday-03", "luca-jack-birthday-photos", "2010-08-02T23:17:00-07:00"],
], "Photos of Jack must derive exactly fourteen externally owned tagged records newest-first");
const externalJackTaggedMediaIds = jackTaggedPhotos.map(({ photo }) => photo.mediaId);
assert.equal(jackAlbums.flatMap(album => album.mediaIds).some(mediaId => externalJackTaggedMediaIds.includes(mediaId)), false, "externally owned Jack tags must remain absent from Jack-owned albums");
assert.equal(jackAlbums.flatMap(album => album.mediaIds).includes("jack-owned-j-2009"), true, "Jack-owned J.png must remain in Jack Photos");
assert.equal(externalJackTaggedMediaIds.includes("jack-owned-j-2009"), false, "Jack-owned J.png must not duplicate into Photos of Jack");
const distributedJackPhotoStories = [
  ["sophie-jack-tagged-02", "Sophie Miller", "jack-tagged-sophie-02", "sophie-photos"],
  ["sophie-jack-tagged-03", "Sophie Miller", "jack-tagged-sophie-03", "sophie-photos"],
  ["luca-jack-tagged-photo", "Luca Bennett", "jack-tagged-luca-01", "luca-photos"],
  ["ryan-jack-night-photo", "Ryan", "jack-tagged-ryan", "ryan-photos"],
  ["june-jack-tagged-night-photo", "June Park", "jack-tagged-june", "june-photos"],
  ["matt-jack-tagged-photo", "Matt Ricci", "jack-tagged-matt-02", "matt-photos"],
  ["matt-jack-birthday-photo", "Matt Ricci", "matt-jack-birthday", "matt-photos"],
  ["luca-jack-birthday-photos", "Luca Bennett", "luca-jack-birthday-00", "luca-photos"],
];
assert.deepEqual(distributedJackPhotoStories.map(([storyId]) => {
  const story = seed.facebook.feed.find(item => item.id === storyId);
  const album = facebookAlbums.getFacebookAlbumByStoryId(storyId);
  return [story?.id, story?.author, story?.mediaId, story?.taggedCharacterIds, album?.id, album?.ownerActor.displayName];
}), distributedJackPhotoStories.map(([storyId, owner, mediaId, albumId]) => [storyId, owner, mediaId, ["jack"], albumId, owner]), "every externally owned Jack photo story must preserve uploader authorship, tag identity, and owning album linkage");
const distributionState = facebook.createInitialFacebookState("Visitor");
const distributableStoryIds = new Set(facebook.selectFacebookVisibleFeed(distributionState).map(item => item.id));
assert.equal(distributedJackPhotoStories.every(([storyId]) => distributableStoryIds.has(storyId)), true, "owner upload stories must be eligible for the existing News Feed visibility pipeline");
for (const [storyId, owner, mediaId] of distributedJackPhotoStories) {
  assert.equal(facebook.selectFacebookProfileWall(distributionState, owner).filter(item => item.id === storyId && item.mediaId === mediaId).length, 1, `${storyId} must resolve exactly once on the uploader Wall`);
}
assert.equal(facebook.selectFacebookProfileWall(distributionState, "Jack Keller").some(item => distributedJackPhotoStories.some(([storyId]) => storyId === item.id)), false, "external owner uploads must not create Jack owner-style Wall stories");
assert.deepEqual(seed.facebook.comments.filter(comment => comment.itemId === "jack-car-matt-2009-photos").map(comment => [comment.id, comment.author.characterId, comment.text]), [
  ["jack-car-matt-2009-comment-matt-1", "matt", "why? you have one"],
  ["jack-car-matt-2009-comment-jack-1", "jack", "i'm not your chauffeur"],
  ["jack-car-matt-2009-comment-matt-2", "matt", "you kinda are"],
  ["jack-car-comment-02", "chris", "finally"],
  ["jack-car-matt-2009-comment-jack-2", "jack", "yeah bro"],
], "Jack's 2009 car/Matt thread must preserve exact IDs, actors, copy, and chronological order");
assert.deepEqual(seed.facebook.comments.filter(comment => comment.itemId === "jack-matt-2008-photo").map(comment => [comment.author.characterId, comment.text]), [["matt", "that's why you keep showing up"]], "2008 Jack/Matt comments must share the canonical story ID");
assert.deepEqual(seed.facebook.comments.filter(comment => comment.itemId === "jack-matt-2010-photo").map(comment => [comment.author.characterId, comment.text]), [["matt", "cazzo, delete it"], ["jack", "拒絕"], ["matt", "Du bist unmöglich."]], "2010 Jack/Matt comments must preserve canonical order");
for (const [storyId, likeCount, commentCount] of [["jack-football-game-photo", 28, 6], ["jack-summer-photos", 34, 7], ["jack-car-matt-2009-photos", 9, 5], ["jack-practice-brutal", 8, 2]]) {
  assert.equal(seed.facebook.likes.filter(like => like.itemId === storyId).length, likeCount, `${storyId} Like baseline must be deterministic`);
  assert.equal(seed.facebook.comments.filter(comment => comment.itemId === storyId).length, commentCount, `${storyId} comment baseline must be deterministic`);
}
for (const [storyId, likeCount, commentCount] of [["jack-birthday-thanks-photos", 57, 15], ["jack-birthday-june-post", 34, 9], ["luca-jack-birthday-photos", 28, 7], ["matt-jack-birthday-photo", 22, 5], ["jack-birthday-sophie-post", 19, 5]]) {
  assert.deepEqual([seed.facebook.likes.filter(like => like.itemId === storyId).length, seed.facebook.comments.filter(comment => comment.itemId === storyId).length], [likeCount, commentCount], `${storyId} birthday engagement must derive from exact seed records`);
}
assert.deepEqual(seed.facebook.comments.filter(comment => comment.itemId === "matt-jack-birthday-photo").slice(0, 2).map(comment => [comment.author.characterId, comment.text]), [["jack", "heyyy what does that mean"], ["jack", "thanks man"]], "Matt birthday photo must preserve Jack's two exact ordered replies");
assert.deepEqual(seed.facebook.feed.filter(story => ["jack-birthday-june-post", "jack-birthday-sophie-post", "luca-jack-birthday-photos", "matt-jack-birthday-photo", "jack-birthday-thanks-photos"].includes(story.id)).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).map(story => [story.id, story.author, story.createdAt, story.text]), [
  ["jack-birthday-thanks-photos", "Jack Keller", "2010-08-03T13:08:00-07:00", "Thx, guys!"],
  ["matt-jack-birthday-photo", "Matt Ricci", "2010-08-02T23:49:00-07:00", "another year. happy birthday"],
  ["luca-jack-birthday-photos", "Luca Bennett", "2010-08-02T23:17:00-07:00", "@Jack happy birthday bro"],
  ["jack-birthday-sophie-post", "Sophie Miller", "2010-08-02T12:38:00-07:00", "@Jack happy birthday, superstar"],
  ["jack-birthday-june-post", "June Park", "2010-08-02T10:24:00-07:00", "@Jack happy 18th!! ♥"],
], "Jack birthday stories must preserve exact owners, timestamps, copy, and seed chronology");
  const facebookFeedById = new Map(seed.facebook.feed.map(story => [story.id, story]));
  const resolvableFacebookMediaIds = new Set([...sharedCharacterMedia.SHARED_CHARACTER_MEDIA_IDS, ...facebookMedia.FACEBOOK_MEDIA_IDS]);
  for (const album of facebookAlbums.FACEBOOK_ALBUMS) {
    assert.equal(album.mediaIds.length, album.photos.length, `${album.id} count must derive from photo records`);
    assert.deepEqual(album.mediaIds, album.photos.map(photo => photo.mediaId), `${album.id} media IDs must derive from ordered photo records`);
    for (const photo of album.photos) {
      assert.equal(photo.albumId, album.id, `${photo.mediaId} must preserve its exact canonical source album`);
      assert.ok(resolvableFacebookMediaIds.has(photo.mediaId), `${album.id}/${photo.mediaId} must resolve through centralized media`);
      let photoState = facebook.createInitialFacebookState("Zoey");
      photoState = facebook.facebookStateTransition(photoState, { type: "OPEN_ALBUM", albumId: album.id });
      photoState = facebook.facebookStateTransition(photoState, { type: "OPEN_ALBUM_PHOTO", albumId: album.id, mediaId: photo.mediaId });
      assert.deepEqual([photoState.currentView, photoState.selectedAlbumId, photoState.selectedPhotoMediaId], ["photoDetail", album.id, photo.mediaId], `${album.id}/${photo.mediaId} must open canonical Photo Detail`);
      const canonicalStoryId = photo.uploadStoryId ?? photo.storyId;
      const matchingStories = seed.facebook.feed.filter(story => story.id === canonicalStoryId);
      assert.equal(matchingStories.length, 1, `${canonicalStoryId} must have exactly one owner upload story`);
      const story = matchingStories[0];
      assert.equal(story.author, album.ownerActor.displayName, `${canonicalStoryId} author must equal the canonical media owner`);
      assert.equal(photo.timestamp, story.createdAt, `${photo.storyId} Wall and Photo Detail must share one underlying timestamp`);
      assert.equal(story.kind === "album" ? story.mediaIds.includes(photo.mediaId) : story.mediaId === photo.mediaId, true, `${canonicalStoryId} must resolve the same canonical media from Feed and Album`);
      assert.equal(facebook.selectFacebookProfileWall(facebook.createInitialFacebookState("Visitor"), album.ownerActor.displayName).some(item => item.id === canonicalStoryId), true, `${canonicalStoryId} must resolve on its owner Wall`);
    }
  }
  for (const story of seed.facebook.feed.filter(story => story.kind === "album")) {
    const album = facebookAlbums.getFacebookAlbumByStoryId(story.id);
    assert.ok(album, `${story.id} added-photos story must bind an album`);
    const storyPhotos = album.photos.filter(photo => (photo.uploadStoryId ?? photo.storyId) === story.id);
    const storyMediaIds = storyPhotos.map(photo => photo.mediaId);
    assert.deepEqual(story.mediaIds, storyMediaIds, `${story.id} Wall and album must share exact ordered story-bound media IDs`);
    assert.equal(story.photoCount, storyMediaIds.length, `${story.id} photoCount must derive from story-bound album membership`);
    assert.equal(story.albumTitle, album.title, `${story.id} Wall and album titles must agree`);
    const claimedCountMatch = story.text.match(/added\s+(\d+)\s+new\s+photos/i);
    if (claimedCountMatch) {
      assert.equal(Number(claimedCountMatch[1]), storyMediaIds.length, `${story.id} copy count must match story-bound album membership`);
    }
    if (story.id === "jack-car-matt-2009-photos") {
      assert.deepEqual(storyMediaIds, ["jack-car", "jack-matt-02"], "Jack's 2009 batch must remain an exact ordered two-photo subset");
      assert.deepEqual([album.ownerActor.kind, album.ownerActor.characterId], ["canonical", "jack"], "Jack must own the 2009 batch album records");
      assert.deepEqual(storyPhotos.map(photo => photo.taggedCharacterIds), [["matt"], ["matt"]], "both 2009 batch records must preserve canonical Matt tags");
    }
  }
  assert.equal(facebookActorMedia.getFacebookCanonicalProfileMediaId("katie"), "katie-profile-picture", "Katie03 must be the centralized current Facebook profile picture");
  assert.equal(facebookActorMedia.getFacebookCanonicalProfileMediaId("june"), "june-facebook-profile-picture", "June must use one centralized Facebook profile picture record");
  assert.deepEqual(facebookActorMedia.getFacebookCanonicalProfileInfo("june"), { fullName: "June Park", canonicalDateOfBirth: "1992-06-06", age: 18, birthday: "June 6", location: "Los Angeles", lifeStage: "Recent high-school graduate", interests: ["Starbucks", "Gossip Girl", "photography", "shopping", "music"], classification: "CURATED" });
  assert.equal("relationshipStatus" in facebookActorMedia.getFacebookCanonicalProfileInfo("june"), false, "June relationship status must remain absent");
  const juneAlbums = facebookAlbums.getFacebookAlbumsForActor({ kind: "canonical", characterId: "june", displayName: "June" });
  assert.deepEqual(juneAlbums.map(album => [album.id, album.title, album.mediaIds]), [
    ["june-profile-pictures", "Profile Pictures", ["june-facebook-profile-picture"]],
    ["june-show-10-18", "10/18", ["june-fb-F", "june-fb-10-18-01", "june-fb-10-18-02"]],
    ["june-18th-birthday", "18th Birthday", ["june-birthday-bag", "june-birthday-gift", "june-birthday-main"]],
    ["june-girls", "Girls ♥", ["june-sophie-girls"]],
    ["june-senior-year", "Senior Year", ["june-family-graduation"]],
    ["june-mobile-uploads", "Me", ["june-starbucks-mobile", "june-home-mobile"]],
    ["june-photos", "Photos", ["jack-tagged-june"]],
  ], "June Photos must expose seven registry-driven Facebook-owned albums with no Me fallback");
  assert.equal(facebookAlbums.getFacebookAlbum("june-mobile-uploads")?.mediaIds.includes("jack-tagged-june"), false, "June tagged media must not fall back into Me");
  assert.equal(facebookAlbums.getFacebookAlbum("june-photos")?.photos[0]?.albumId, "june-photos", "June tagged media must preserve its Photos source album");
  assert.equal(juneAlbums.some(album => album.title === "Mobile Uploads"), false, "June must expose Me rather than Mobile Uploads");
  assert.equal(facebookAlbums.getFacebookAlbum("june-mobile-uploads")?.photos.find(photo => photo.mediaId === "june-home-mobile")?.caption, "my sister took this lol / 책 읽는 중");
  assert.equal(facebookAlbums.getFacebookAlbum("june-18th-birthday")?.photos.find(photo => photo.mediaId === "june-birthday-main")?.caption, "happy 18th, June ♥ 생일 축하해");
  const juneSocialHubState = facebook.createInitialFacebookState("Visitor");
  assert.deepEqual([["june-18th-birthday-photos", 38, 12], ["june-home-photo", 16, 6], ["june-starbucks-photo", 21, 7], ["june-sophie-photo", 27, 9], ["june-graduation-photo", 32, 10]].map(([itemId]) => [itemId, facebook.selectFacebookLikes(juneSocialHubState, itemId, 0).length, facebook.selectFacebookComments(juneSocialHubState, itemId).length]), [["june-18th-birthday-photos", 38, 12], ["june-home-photo", 16, 6], ["june-starbucks-photo", 21, 7], ["june-sophie-photo", 27, 9], ["june-graduation-photo", 32, 10]], "June engagement tiers must derive from varied real seed records");
  assert.equal(facebookAlbums.getFacebookAlbumByStoryId("june-show-photos-oct19")?.id, "june-show-10-18", "June Wall and Photos must share the show story");
  const juneBirthdayAlbum = facebookAlbums.getFacebookAlbum("june-18th-birthday");
  assert.deepEqual(juneBirthdayAlbum.photos.map(photo => [photo.mediaId, photo.storyId, photo.uploadStoryId]), [["june-birthday-bag", "june-birthday-bag-photo", "june-18th-birthday-photos"], ["june-birthday-gift", "june-birthday-gift-photo", "june-18th-birthday-photos"], ["june-birthday-main", "june-birthday-main-photo", "june-18th-birthday-photos"]], "birthday upload and individual photo interaction identities must be explicit");
  let birthdayInteractionState = facebook.createInitialFacebookState("Zoey");
  birthdayInteractionState = facebook.facebookStateTransition(birthdayInteractionState, { type: "TOGGLE_LIKE", itemId: "june-birthday-main-photo", displayName: "Zoey" });
  assert.deepEqual([facebook.selectFacebookLikes(birthdayInteractionState, "june-18th-birthday-photos", 0).length, facebook.selectFacebookLikes(birthdayInteractionState, "june-birthday-main-photo", 0).length], [38, 1], "birthday photo interaction must not mutate upload-story engagement");
  const forbiddenJuneFacebookFilenames = new Set(["IG01.JPG", "IG02.JPG", "IG03.JPG", "IG04.JPG", "June-Jack-club.png", "June-Jack-kiss.png"]);
  assert.ok(juneAlbums.flatMap(album => album.mediaIds).every(mediaId => !forbiddenJuneFacebookFilenames.has(sharedCharacterMedia.getSharedCharacterMedia(mediaId)?.originalFilename)), "June Facebook albums must exclude Instagram and private June/Jack assets");
  const juneTaggedPhotos = facebookAlbums.getFacebookPhotosOfCharacter("june");
  assert.deepEqual(juneTaggedPhotos.map(({ album, photo }) => [album.id, album.ownerActor.displayName, photo.mediaId, photo.storyId]), [["sophie-photos", "Sophie Miller", "sophie-june-club-photo", "sophie-june-club-photo-story"]], "Photos of June must aggregate the Sophie-owned structured tag without changing ownership");
  assert.equal(facebookActorMedia.getFacebookCanonicalProfileMediaId("luca"), "luca-profile-picture", "Luca.png must be the centralized current Facebook profile picture");
  assert.equal(facebookActorMedia.getFacebookCanonicalProfileMediaId("jay"), "facebook-default-avatar", "Jay must use the centralized Facebook default avatar");
  assert.equal(facebookActorMedia.getFacebookCanonicalProfileMediaId("alex"), "alex-profile-picture", "Alex.png must be the centralized current Facebook profile picture");
  assert.equal(facebookActorMedia.getFacebookCanonicalProfileMediaId("ben"), "ben-profile-current", "Ben01.JPG must be the centralized current Facebook profile picture");
  assert.equal(facebookActorMedia.getFacebookCanonicalProfileMediaId("chris"), "chris-profile-picture", "Chris01.PNG must be the centralized current Facebook profile picture");
  assert.equal(facebookActorMedia.getFacebookCanonicalProfileMediaId("matt"), "matt-profile-current", "Matt03.JPG must be the centralized current Facebook profile picture");
  assert.deepEqual(facebookActorMedia.getFacebookCanonicalProfileInfo("matt"), { fullName: "Matt Ricci", formalCanonicalName: "Matteo Lee Ricci", age: 18, location: "Los Angeles", activity: "Bass", interests: ["computers", "music", "bass", "movies"], classification: "CURATED" }, "Matt must retain separate Facebook display and formal canonical names");
  assert.deepEqual(facebookActorMedia.getFacebookCanonicalProfileInfo("katie"), { fullName: "Katie Dawson", age: 14, location: "Los Angeles", lifeStage: "High school student", interests: ["music", "photography", "movies", "shopping", "dogs"], classification: "CURATED" });
  assert.deepEqual(facebookActorMedia.getFacebookCanonicalProfileInfo("alex"), { fullName: "Alex Wong", age: 21, location: "Los Angeles", lifeStage: "College student", interests: ["coffee", "dogs", "photography", "movies", "food"], classification: "CURATED" });
  assert.deepEqual(facebookActorMedia.getFacebookCanonicalProfileInfo("chris"), { fullName: "Chris Morgan", age: 19, location: "Los Angeles", lifeStage: "College student", interests: ["basketball", "Lakers", "movies", "music"], classification: "CURATED" });
  assert.deepEqual(facebookActorMedia.getFacebookCanonicalProfileInfo("jay"), { fullName: "Jay Diaz", age: 18, location: "Los Angeles", lifeStage: "Recent high-school graduate", interests: ["guitar", "Led Zeppelin", "Interpol", "The Strokes", "live music", "records"], classification: "CURATED" });
  assert.deepEqual(facebookActorMedia.getFacebookCanonicalProfileInfo("ben"), { fullName: "Ben Dawson", age: 23, location: "Los Angeles", lifeStage: "College graduate", work: "Finance", interests: ["coffee", "cars", "Lakers", "movies", "road trips"], classification: "CURATED" });
  assert.deepEqual(facebookActorMedia.getFacebookCanonicalProfileInfo("luca"), { fullName: "Luca Bennett", age: 20, location: "Los Angeles", work: "Main Street Diner", interests: ["basketball", "Lakers", "hip-hop", "movies", "sneakers"], classification: "CURATED" });
  assert.deepEqual(facebookActorMedia.getFacebookEphemeralProfileInfo("facebook-ephemeral-sophie"), { fullName: "Sophie Miller", age: 18, location: "Los Angeles", lifeStage: "Recent high-school graduate", interests: ["fashion", "The Hills", "photography", "beach", "music"], classification: "CURATED" });
  const forbiddenInventedInfoKeys = ["employer", "college", "relationshipStatus", "phone", "email", "religion", "politics"];
  assert.equal(Object.values(facebookActorMedia.FACEBOOK_CANONICAL_PROFILE_INFO).some(info => forbiddenInventedInfoKeys.some(key => key in info)), false, "Info must not invent employers, colleges, relationship status, contact details, religion, or politics");
  assert.deepEqual(Object.keys(facebookActorMedia.getFacebookCanonicalProfileInfo("chris")), ["fullName", "age", "location", "lifeStage", "interests", "classification"], "Chris Info must remain deliberately bounded and omit birthday, work, activities, and biography fields");
  assert.equal(facebookActorMedia.getFacebookEphemeralProfileMediaId("fof-ryan-001"), "facebook-default-avatar", "Ryan must use the centralized Facebook default avatar");
  assert.equal(facebookActorMedia.getFacebookEphemeralProfileMediaId("facebook-ephemeral-frank"), "facebook-default-avatar", "Frank must use the centralized Facebook default avatar");
  const musicCircleAvatarMapping = [
    ["facebook-ephemeral-mike", "facebook-avatar-02", "02.png"],
    ["facebook-ephemeral-sarah", "facebook-avatar-00", "00.png"],
    ["facebook-ephemeral-kevin", "facebook-avatar-05", "05.png"],
    ["facebook-ephemeral-emily", "facebook-avatar-03", "03.png"],
    ["facebook-ephemeral-nick", "facebook-avatar-06", "06.png"],
    ["facebook-ephemeral-rachel", "facebook-avatar-07", "07.png"],
  ];
  assert.deepEqual(musicCircleAvatarMapping.map(([actorId, , filename]) => [actorId, facebookMedia.getFacebookMedia(facebookActorMedia.getFacebookEphemeralProfileMediaId(actorId))?.originalFilename, filename]), musicCircleAvatarMapping.map(([actorId, , filename]) => [actorId, filename, filename]), "music-circle actor avatars must resolve to their explicit existing local filenames");
  assert.equal(new Set(musicCircleAvatarMapping.map(([, mediaId]) => mediaId)).size, 6, "visible music-circle commenters must not reuse avatars when six distinct approved assets exist");
  const sophieAvatarMediaId = facebookActorMedia.getFacebookEphemeralProfileMediaId("facebook-ephemeral-sophie");
  assert.equal(sophieAvatarMediaId, "facebook-sophie-avatar", "Sophie must bypass the general ephemeral-avatar pool");
  const sophieAvatarMedia = facebookMedia.getFacebookMedia(sophieAvatarMediaId);
  assert.deepEqual([sophieAvatarMedia?.originalFilename, sophieAvatarMedia?.sha256], ["S.png", "a9a1f1ad1eb96422c5119a8a760e297575a4d790a988de94026949ae6130ac30"], "Sophie must resolve the unchanged dedicated S.png asset");
  assert.deepEqual(Object.entries(facebookActorMedia.FACEBOOK_EPHEMERAL_ACTOR_MEDIA).filter(([, mapping]) => mapping.profileMediaId === sophieAvatarMediaId).map(([actorId]) => actorId), ["facebook-ephemeral-sophie"], "S.png must be assigned exclusively to Sophie");
  assert.deepEqual(Object.values(facebookMedia.FACEBOOK_MEDIA).filter(media => media.originalFilename === "S.png").map(media => media.id), ["facebook-sophie-avatar"], "S.png must remain outside the generic avatar records");
  const sophieAvatarState = facebook.createInitialFacebookState("Visitor");
  const sophieComment = facebook.selectFacebookComments(sophieAvatarState, "june-show-photos-oct19").find(comment => comment.id === "june-show-comment-sophie");
  assert.ok(sophieComment, "June's show thread must retain Sophie's comment");
  const sophieCommentActor = facebook.resolveFacebookCommentActor(sophieComment, "Visitor");
  assert.deepEqual(sophieCommentActor, { kind: "ephemeral-friend-of-friend", ephemeralId: "facebook-ephemeral-sophie", displayName: "Sophie Miller", classification: "RECURRING_SECONDARY_CHARACTER" });
  const sophieProfileState = facebook.facebookStateTransition(sophieAvatarState, { type: "OPEN_COMMENT_AUTHOR", actor: sophieCommentActor });
  assert.deepEqual([sophieProfileState.currentView, sophieProfileState.selectedProfileActor], ["profile", sophieCommentActor], "Sophie comment and Profile must share one actor identity");
  assert.equal(facebookActorMedia.getFacebookEphemeralProfileMediaId(sophieProfileState.selectedProfileActor.ephemeralId), sophieAvatarMediaId, "Sophie Profile must reuse the comment avatar mapping");
  const sophieAlbums = facebookAlbums.getFacebookAlbumsForActor({ kind: "ephemeral-friend-of-friend", ephemeralId: "facebook-ephemeral-sophie", displayName: "Sophie Miller", classification: "RECURRING_SECONDARY_CHARACTER" });
  assert.deepEqual(sophieAlbums.map(album => [album.id, album.title, album.mediaIds]), [["sophie-photos", "Photos", ["sophie-june-club-photo", "jack-tagged-sophie-02", "jack-tagged-sophie-03"]]], "Sophie must own her June and Jack tagged photos");
  const sophieClubPhoto = sophieAlbums[0].photos[0];
  const sophieClubRelationship = facebookAlbums.getFacebookCanonicalMediaRelationship("sophie-june-club-photo");
  assert.ok(sophieClubRelationship, "Sophie club media must resolve through the canonical joined relationship helper");
  assert.equal(sophieClubRelationship.album, sophieAlbums[0], "joined media relationship must preserve the canonical source album");
  assert.equal(sophieClubRelationship.photo, sophieClubPhoto, "joined media relationship must preserve the canonical photo record");
  assert.equal(sophieClubRelationship.ownerActor.classification, "RECURRING_SECONDARY_CHARACTER", "joined media relationship must preserve Sophie's recurring-secondary classification");
  assert.equal(sophieClubRelationship.storyId, "sophie-june-club-photo-story", "joined media relationship must preserve canonical story identity");
  assert.deepEqual(sophieClubRelationship.tags, [{ kind: "canonical", characterId: "june" }], "joined media relationship must preserve structured tags");
  for (const album of facebookAlbums.FACEBOOK_ALBUMS) {
    for (const photo of album.photos) {
      const relationship = facebookAlbums.getFacebookCanonicalMediaRelationship(photo.mediaId);
      assert.ok(relationship, `${photo.mediaId} must resolve to exactly one canonical album relationship`);
      assert.equal(relationship.album, album, `${photo.mediaId} must retain its source album`);
      assert.equal(relationship.photo, photo, `${photo.mediaId} must retain its source photo record`);
      assert.equal(relationship.ownerActor, album.ownerActor, `${photo.mediaId} must retain its uploader`);
      assert.equal(relationship.storyId, photo.storyId, `${photo.mediaId} must retain its canonical story`);
      assert.equal(relationship.media.id, photo.mediaId, `${photo.mediaId} must resolve its canonical media record`);
    }
  }
  assert.deepEqual([sophieClubPhoto.storyId, sophieClubPhoto.timestamp, sophieClubPhoto.caption, sophieClubPhoto.taggedCharacterIds], ["sophie-june-club-photo-story", "2010-10-16T02:57:00-07:00", "bestie ♥ @June", ["june"]], "Sophie club photo must preserve caption and structured June tag metadata");
  const sophieClubStory = seed.facebook.feed.find(item => item.id === "sophie-june-club-photo-story");
  assert.deepEqual([sophieClubStory.author, sophieClubStory.text, sophieClubStory.mediaId, sophieClubStory.createdAt, sophieClubStory.taggedCharacterIds], ["Sophie Miller", "bestie ♥ @June", "sophie-june-club-photo", "2010-10-16T02:57:00-07:00", ["june"]], "Sophie Wall story must bind the same tagged photo record and caption");
  assert.deepEqual(sophieClubStory.mentions, [{ token: "@June", actor: { kind: "canonical", characterId: "june", displayName: "June Park" } }], "@June must keep its historical token while routing through canonical June Park identity metadata");
  const sophieWallState = facebook.createInitialFacebookState("Visitor");
  assert.deepEqual(facebook.selectFacebookProfileWall(sophieWallState, "Sophie Miller").map(item => item.id), ["sophie-june-club-photo-story", "sophie-jack-tagged-02", "sophie-jack-tagged-03", "jack-birthday-sophie-post"], "Sophie Wall must contain her canonical owned photo and birthday stories");
  assert.equal(juneAlbums.some(album => album.mediaIds.includes("sophie-june-club-photo")), false, "Sophie-owned tagged media must not enter June-owned albums");
  const mattAlbums = facebookAlbums.getFacebookAlbumsForActor({ kind: "canonical", characterId: "matt", displayName: "Matt" });
  const mattTaggedPhotos = facebookAlbums.getFacebookPhotosOfCharacter("matt");
  assert.deepEqual(mattTaggedPhotos.map(({ album, photo }) => [album.id, album.ownerActor.displayName, photo.mediaId, photo.storyId]), [
    ["june-show-10-18", "June Park", "june-fb-10-18-01", "june-show-photos-oct19"],
    ["june-show-10-18", "June Park", "june-fb-10-18-02", "june-show-photos-oct19"],
    ["jack-photos", "Jack Keller", "jack-matt-01", "jack-matt-2010-photo"],
    ["jack-photos", "Jack Keller", "jack-car", "jack-car-matt-2009-photos"],
    ["jack-photos", "Jack Keller", "jack-matt-02", "jack-car-matt-2009-photos"],
    ["jay-music", "Jay Diaz", "jay-rehearsal-2009-06-27-01", "jay-rehearsal-2009-06-27"],
    ["jay-music", "Jay Diaz", "jay-rehearsal-2009-06-27-02", "jay-rehearsal-2009-06-27"],
    ["jack-photos", "Jack Keller", "jack-matt-03", "jack-matt-2008-photo"],
    ["jack-photos", "Jack Keller", "jack-matt-family", "jack-matt-family-2007-photo"],
  ], "Photos of Matt must aggregate exact Jack-owned structured tags newest-first");
  const juneShowAlbum = facebookAlbums.getFacebookAlbum("june-show-10-18");
  assert.deepEqual(juneShowAlbum.photos.map(photo => [photo.mediaId, photo.taggedActors]), [
    ["june-fb-F", undefined],
    ["june-fb-10-18-01", [{ kind: "canonical", characterId: "matt" }]],
    ["june-fb-10-18-02", [{ kind: "canonical", characterId: "matt" }, { kind: "author-easter-egg", authorId: "author-z-tokyo" }]],
  ], "June show tags must follow visible photo-level band membership rather than caption parsing");
  const zTokyoTaggedPhotos = facebookAlbums.getFacebookPhotosOfActor({ kind: "author-easter-egg", authorId: "author-z-tokyo" });
  assert.deepEqual(zTokyoTaggedPhotos.map(({ album, photo }) => [album.id, album.ownerActor.displayName, photo.mediaId, photo.storyId]), [
    ["june-show-10-18", "June Park", "june-fb-10-18-02", "june-show-photos-oct19"],
    ["jay-music", "Jay Diaz", "jay-rehearsal-2009-06-27-01", "jay-rehearsal-2009-06-27"],
    ["jay-music", "Jay Diaz", "jay-rehearsal-2009-06-27-02", "jay-rehearsal-2009-06-27"],
  ], "Photos of Z.tokyo must expose the exact June/Jay show and rehearsal photos with structured author tags");
  assert.equal(juneShowAlbum.photos.some(photo => (photo.taggedActors ?? []).some(actor =>
    (actor.kind === "canonical" && actor.characterId === "anil") ||
    (actor.kind === "author-easter-egg" && actor.authorId === "anil"))), false, "offline-only Anil must not receive a Facebook photo actor tag");
  assert.equal(mattAlbums.flatMap(album => album.mediaIds).some(mediaId => mattTaggedPhotos.some(({ photo }) => photo.mediaId === mediaId)), false, "Jack-owned tagged photos must remain absent from Matt-owned albums");
  let taggedNavigation = facebook.createInitialFacebookState("Visitor");
  taggedNavigation = facebook.facebookStateTransition(taggedNavigation, { type: "OPEN_PROFILE", profileName: "June Park" });
  taggedNavigation = facebook.facebookStateTransition(taggedNavigation, { type: "SET_PROFILE_SECTION", section: "photos" });
  taggedNavigation = facebook.facebookStateTransition(taggedNavigation, { type: "OPEN_TAGGED_PHOTOS", actor: { kind: "canonical", characterId: "june" } });
  taggedNavigation = facebook.facebookStateTransition(taggedNavigation, { type: "OPEN_TAGGED_PHOTO", actor: { kind: "canonical", characterId: "june" }, mediaId: "sophie-june-club-photo" });
  assert.deepEqual([taggedNavigation.currentView, taggedNavigation.selectedAlbumId, taggedNavigation.selectedPhotoMediaId], ["photoDetail", "sophie-photos", "sophie-june-club-photo"], "tagged route must open the canonical owner album Photo Detail");
  taggedNavigation = facebook.facebookStateTransition(taggedNavigation, { type: "TOGGLE_LIKE", itemId: "sophie-june-club-photo-story", displayName: "Visitor" });
  assert.equal(taggedNavigation.likedItemIds.includes("sophie-june-club-photo-story"), true, "tagged and owner routes must share the canonical story interaction ID");
  taggedNavigation = facebook.facebookStateTransition(taggedNavigation, { type: "OPEN_COMMENT_AUTHOR", actor: { kind: "ephemeral-friend-of-friend", ephemeralId: "facebook-ephemeral-sophie", displayName: "Sophie Miller", classification: "RECURRING_SECONDARY_CHARACTER" } });
  taggedNavigation = facebook.facebookStateTransition(taggedNavigation, { type: "GO_BACK" });
  assert.equal(taggedNavigation.currentView, "photoDetail", "cross-profile Back must restore tagged Photo Detail");
  taggedNavigation = facebook.facebookStateTransition(taggedNavigation, { type: "GO_BACK" });
  assert.equal(taggedNavigation.currentView, "taggedPhotos", "Photo Back must restore Photos of June");
  taggedNavigation = facebook.facebookStateTransition(taggedNavigation, { type: "GO_BACK" });
  assert.deepEqual([taggedNavigation.currentView, taggedNavigation.profileSection], ["profile", "photos"], "tagged gallery Back must restore June Photos");
  let sophiePhotoNavigation = facebook.createInitialFacebookState("Visitor");
  sophiePhotoNavigation = facebook.facebookStateTransition(sophiePhotoNavigation, { type: "OPEN_ALBUM", albumId: "sophie-photos" });
  sophiePhotoNavigation = facebook.facebookStateTransition(sophiePhotoNavigation, { type: "OPEN_ALBUM_PHOTO", albumId: "sophie-photos", mediaId: "sophie-june-club-photo" });
  assert.deepEqual([sophiePhotoNavigation.currentView, sophiePhotoNavigation.selectedAlbumId, sophiePhotoNavigation.selectedPhotoMediaId], ["photoDetail", "sophie-photos", "sophie-june-club-photo"], "Sophie club photo must open shared Photo Detail");
  let sophieMentionNavigation = facebook.facebookStateTransition(sophieWallState, { type: "OPEN_COMMENT_AUTHOR", actor: { kind: "ephemeral-friend-of-friend", ephemeralId: "facebook-ephemeral-sophie", displayName: "Sophie Miller", classification: "RECURRING_SECONDARY_CHARACTER" } });
  sophieMentionNavigation = facebook.facebookStateTransition(sophieMentionNavigation, { type: "OPEN_COMMENT_AUTHOR", actor: sophieClubStory.mentions[0].actor });
  assert.deepEqual([sophieMentionNavigation.currentView, sophieMentionNavigation.selectedProfileName, sophieMentionNavigation.selectedProfileActor?.characterId], ["profile", "June Park", "june"], "@June must open canonical June Park Profile");
  sophieMentionNavigation = facebook.facebookStateTransition(sophieMentionNavigation, { type: "GO_BACK" });
  assert.deepEqual([sophieMentionNavigation.currentView, sophieMentionNavigation.selectedProfileName, sophieMentionNavigation.selectedProfileActor?.ephemeralId], ["profile", "Sophie Miller", "facebook-ephemeral-sophie"], "Back must restore the originating Sophie Profile");
  let sophieSharedInteraction = facebook.facebookStateTransition(sophieWallState, { type: "TOGGLE_LIKE", itemId: "sophie-june-club-photo-story", displayName: "Visitor" });
  assert.deepEqual([sophieSharedInteraction.likedItemIds.includes(sophieClubPhoto.storyId), facebook.selectFacebookLikes(sophieSharedInteraction, sophieClubPhoto.storyId, 0).length], [true, 1], "Wall and Photo Detail must share the canonical Sophie photo interaction key");
  const alexAlbums = facebookAlbums.getFacebookAlbumsForActor({ kind: "canonical", characterId: "alex", displayName: "Alex" });
  assert.deepEqual(alexAlbums.map(album => [album.id, album.title, album.mediaIds]), [["alex-profile-pictures", "Profile Pictures", ["alex-profile-picture"]], ["alex-dogs", "Dogs", ["alex-dogs-wangcai-bb-2009", "alex-dog-golden-2007"]]], "Alex albums must preserve Profile Pictures and newest-first dog history");
  assert.deepEqual(alexAlbums.find(album => album.id === "alex-dogs")?.photos.map(photo => [photo.mediaId, photo.timestamp, photo.caption]), [["alex-dogs-wangcai-bb-2009", "2009-05-08T16:00:00-07:00", "旺財&BB"], ["alex-dog-golden-2007", "2007-10-03T16:00:00-07:00", undefined]], "Alex dog history must preserve exact chronology and UTF-8 caption");
  for (const mediaId of ["alex-dogs-wangcai-bb-2009", "alex-dog-golden-2007"]) {
    let alexPhotoNavigation = facebook.createInitialFacebookState("Visitor");
    alexPhotoNavigation = facebook.facebookStateTransition(alexPhotoNavigation, { type: "OPEN_PROFILE", profileName: "Alex Wong" });
    alexPhotoNavigation = facebook.facebookStateTransition(alexPhotoNavigation, { type: "SET_PROFILE_SECTION", section: "photos" });
    alexPhotoNavigation = facebook.facebookStateTransition(alexPhotoNavigation, { type: "OPEN_ALBUM", albumId: "alex-dogs" });
    alexPhotoNavigation = facebook.facebookStateTransition(alexPhotoNavigation, { type: "OPEN_ALBUM_PHOTO", albumId: "alex-dogs", mediaId });
    assert.deepEqual([alexPhotoNavigation.currentView, alexPhotoNavigation.selectedAlbumId, alexPhotoNavigation.selectedPhotoMediaId], ["photoDetail", "alex-dogs", mediaId], `${mediaId} must open through shared Photo Detail`);
    alexPhotoNavigation = facebook.facebookStateTransition(alexPhotoNavigation, { type: "TOGGLE_LIKE", itemId: mediaId, displayName: "Visitor" });
    alexPhotoNavigation = facebook.facebookStateTransition(alexPhotoNavigation, { type: "BEGIN_COMMENT", itemId: mediaId });
    alexPhotoNavigation = facebook.facebookStateTransition(alexPhotoNavigation, { type: "EDIT_COMMENT", value: "good dogs" });
    alexPhotoNavigation = facebook.facebookStateTransition(alexPhotoNavigation, { type: "SUBMIT_COMMENT", displayName: "Visitor" });
    assert.equal(alexPhotoNavigation.likedItemIds.includes(mediaId), true, `${mediaId} must retain shared Like state`);
    assert.equal(facebook.selectFacebookComments(alexPhotoNavigation, mediaId).some(comment => comment.text === "good dogs"), true, `${mediaId} must retain shared comment state`);
    alexPhotoNavigation = facebook.facebookStateTransition(alexPhotoNavigation, { type: "GO_BACK" });
    assert.deepEqual([alexPhotoNavigation.currentView, alexPhotoNavigation.selectedAlbumId], ["album", "alex-dogs"], `${mediaId} Back must restore Dogs album`);
  }
  const benAlbums = facebookAlbums.getFacebookAlbumsForActor({ kind: "canonical", characterId: "ben", displayName: "Ben" });
  assert.deepEqual(benAlbums.map(album => [album.id, album.title, album.mediaIds]), [["ben-profile-pictures", "Profile Pictures", ["ben-profile-current", "ben-profile-2005"]], ["ben-photos", "Photos", ["ben-photo-friday-2010", "ben-car-2010", "ben-coffee-2009", "ben-coffee-2006"]]], "Ben albums must preserve Profile Pictures and newest-first working-life photo history");
  assert.deepEqual(benAlbums.find(album => album.id === "ben-photos")?.photos.map(photo => [photo.mediaId, photo.timestamp, photo.caption]), [["ben-photo-friday-2010", "2010-10-15T21:49:00-07:00", "happy friday. finally."], ["ben-car-2010", "2010-07-10T16:00:00-07:00", "new truck :)"], ["ben-coffee-2009", "2009-02-14T16:00:00-08:00", undefined], ["ben-coffee-2006", "2006-08-12T16:00:00-07:00", undefined]], "Ben Photos must preserve exact chronology and captions");
  assert.equal(sharedCharacterMedia.getSharedCharacterMedia("ben-profile-current").src, sharedCharacterMedia.getSharedCharacterMedia("ben-photo-friday-2010").src, "Ben01.JPG must be one physical source reused by ordinary-photo and profile-picture records");
  for (const [albumId, mediaId] of [["ben-profile-pictures", "ben-profile-current"], ["ben-profile-pictures", "ben-profile-2005"], ["ben-photos", "ben-photo-friday-2010"], ["ben-photos", "ben-car-2010"], ["ben-photos", "ben-coffee-2009"], ["ben-photos", "ben-coffee-2006"]]) {
    const benAlbum = facebookAlbums.getFacebookAlbum(albumId);
    const storyId = facebookAlbums.getFacebookAlbumPhoto(benAlbum, mediaId)?.storyId;
    assert.equal(typeof storyId, "string", `${mediaId} must resolve its canonical album story ID`);
    let benPhotoNavigation = facebook.createInitialFacebookState("Visitor");
    benPhotoNavigation = facebook.facebookStateTransition(benPhotoNavigation, { type: "OPEN_PROFILE", profileName: "Ben Dawson" });
    benPhotoNavigation = facebook.facebookStateTransition(benPhotoNavigation, { type: "SET_PROFILE_SECTION", section: "photos" });
    benPhotoNavigation = facebook.facebookStateTransition(benPhotoNavigation, { type: "OPEN_ALBUM", albumId });
    benPhotoNavigation = facebook.facebookStateTransition(benPhotoNavigation, { type: "OPEN_ALBUM_PHOTO", albumId, mediaId });
    assert.deepEqual([benPhotoNavigation.currentView, benPhotoNavigation.selectedAlbumId, benPhotoNavigation.selectedPhotoMediaId], ["photoDetail", albumId, mediaId], `${mediaId} must open through shared Photo Detail`);
    benPhotoNavigation = facebook.facebookStateTransition(benPhotoNavigation, { type: "TOGGLE_LIKE", itemId: storyId, displayName: "Visitor" });
    benPhotoNavigation = facebook.facebookStateTransition(benPhotoNavigation, { type: "BEGIN_COMMENT", itemId: storyId });
    benPhotoNavigation = facebook.facebookStateTransition(benPhotoNavigation, { type: "EDIT_COMMENT", value: "nice photo" });
    benPhotoNavigation = facebook.facebookStateTransition(benPhotoNavigation, { type: "SUBMIT_COMMENT", displayName: "Visitor" });
    assert.equal(benPhotoNavigation.likedItemIds.includes(storyId), true, `${mediaId} must retain Like state through ${storyId}`);
    assert.equal(facebook.selectFacebookComments(benPhotoNavigation, storyId).some(comment => comment.text === "nice photo"), true, `${mediaId} must retain comment state through ${storyId}`);
  }
  assert.deepEqual(facebookAlbums.getFacebookAlbum("ben-profile-pictures")?.photos.find(photo => photo.mediaId === "ben-profile-current")?.storyId, "ben-profile-current-update", "Ben current Profile Picture media and canonical story IDs must remain distinct");
  assert.notEqual(facebookAlbums.getFacebookAlbum("ben-photos")?.photos.find(photo => photo.mediaId === "ben-photo-friday-2010")?.storyId, "ben-profile-current-update", "the 21:49 ordinary Ben01 photo must retain independent interaction state from the 22:12 Profile Picture update");
  const chrisAlbums = facebookAlbums.getFacebookAlbumsForActor({ kind: "canonical", characterId: "chris", displayName: "Chris" });
  assert.deepEqual(chrisAlbums.map(album => [album.id, album.title, album.mediaIds]), [["chris-profile-pictures", "Profile Pictures", ["chris-profile-picture"]]], "Chris must have one single-photo Profile Pictures album and no generic Photos album");
  assert.deepEqual(chrisAlbums[0]?.photos.map(photo => [photo.mediaId, photo.storyId, photo.timestamp, photo.caption]), [["chris-profile-picture", "chris-profile-picture-update", "2009-11-14T20:30:00-08:00", undefined]], "Chris Profile Picture must preserve the locked November 2009 timestamp without fabricated caption");
  let chrisPhotoNavigation = facebook.createInitialFacebookState("Visitor");
  chrisPhotoNavigation = facebook.facebookStateTransition(chrisPhotoNavigation, { type: "OPEN_PROFILE", profileName: "Chris Morgan" });
  chrisPhotoNavigation = facebook.facebookStateTransition(chrisPhotoNavigation, { type: "SET_PROFILE_SECTION", section: "photos" });
  chrisPhotoNavigation = facebook.facebookStateTransition(chrisPhotoNavigation, { type: "OPEN_ALBUM", albumId: "chris-profile-pictures" });
  chrisPhotoNavigation = facebook.facebookStateTransition(chrisPhotoNavigation, { type: "OPEN_ALBUM_PHOTO", albumId: "chris-profile-pictures", mediaId: "chris-profile-picture" });
  assert.deepEqual([chrisPhotoNavigation.currentView, chrisPhotoNavigation.selectedAlbumId, chrisPhotoNavigation.selectedPhotoMediaId], ["photoDetail", "chris-profile-pictures", "chris-profile-picture"], "Chris01.PNG must open through shared Photo Detail");
  assert.deepEqual(mattAlbums.map(album => [album.id, album.title, album.mediaIds]), [["matt-profile-pictures", "Profile Pictures", ["matt-profile-current", "matt-profile-2007"]], ["matt-photos", "Photos", ["matt-code-2010", "jack-tagged-matt-02", "matt-jack-birthday", "matt-photo-2007"]]], "Matt albums must preserve separate newest-first Profile Pictures and Photos histories");
  assert.deepEqual(mattAlbums.flatMap(album => album.photos.map(photo => [album.id, photo.mediaId, photo.storyId, photo.timestamp, photo.caption])), [["matt-profile-pictures", "matt-profile-current", "matt-profile-current-update", "2010-10-02T21:18:00-07:00", undefined], ["matt-profile-pictures", "matt-profile-2007", "matt-profile-2007-update", "2007-08-18T20:10:00-07:00", undefined], ["matt-photos", "matt-code-2010", "matt-code-photo-2010", "2010-10-15T23:03:00-07:00", undefined], ["matt-photos", "jack-tagged-matt-02", "matt-jack-tagged-photo", "2010-10-03T20:00:00-07:00", "apparently standing still isn't an option"], ["matt-photos", "matt-jack-birthday", "matt-jack-birthday-photo", "2010-08-02T23:49:00-07:00", "another year. happy birthday"], ["matt-photos", "matt-photo-2007", "matt-photo-2007", "2007-09-25T21:14:00-07:00", undefined]], "Matt photo records must preserve exact timestamps and captions");
  for (const mediaId of ["matt-code-2010", "jack-tagged-matt-02", "matt-photo-2007"]) {
    let mattPhotoNavigation = facebook.createInitialFacebookState("Visitor");
    mattPhotoNavigation = facebook.facebookStateTransition(mattPhotoNavigation, { type: "OPEN_PROFILE", profileName: "Matt Ricci" });
    mattPhotoNavigation = facebook.facebookStateTransition(mattPhotoNavigation, { type: "SET_PROFILE_SECTION", section: "photos" });
    mattPhotoNavigation = facebook.facebookStateTransition(mattPhotoNavigation, { type: "OPEN_ALBUM", albumId: "matt-photos" });
    mattPhotoNavigation = facebook.facebookStateTransition(mattPhotoNavigation, { type: "OPEN_ALBUM_PHOTO", albumId: "matt-photos", mediaId });
    assert.deepEqual([mattPhotoNavigation.currentView, mattPhotoNavigation.selectedAlbumId, mattPhotoNavigation.selectedPhotoMediaId], ["photoDetail", "matt-photos", mediaId], `${mediaId} must open through shared Photo Detail`);
  }
  let mattCodeThreadState = facebook.createInitialFacebookState("Visitor");
  const mattCodeComments = facebook.selectFacebookComments(mattCodeThreadState, "matt-code-photo-2010");
  assert.deepEqual(mattCodeComments.map(comment => [comment.id, comment.author, comment.characterId, comment.ephemeralAuthor?.id, comment.text, comment.classification]), [
    ["matt-code-comment-eric-jsonp", "Eric", undefined, "facebook-ephemeral-eric", "jsonp? lol", "PERIOD-EVIDENCE-INFORMED / CURATED"],
    ["matt-code-comment-daniel-callback", "Daniel", undefined, "facebook-ephemeral-daniel", "yeah callback=? should work", "PERIOD-EVIDENCE-INFORMED / CURATED"],
    ["matt-code-comment-sam-jquery", "Sam", undefined, "facebook-ephemeral-sam", "still on 1.4.2. not touching rc2 yet", "PERIOD-EVIDENCE-INFORMED / CURATED"],
    ["matt-code-comment-kevin-image", "Kevin", undefined, "facebook-ephemeral-kevin", "image[2]['#text'] should give you the larger one", "PERIOD-EVIDENCE-INFORMED / CURATED"],
    ["matt-code-comment-rachel-album", "Rachel", undefined, "facebook-ephemeral-rachel", "oracular spectacular again lol", "CURATED"],
    ["matt-code-comment-matt-reply", "Matt Ricci", "matt", undefined, "works now", "CURATED"],
  ], "Matt code photo must retain the exact six-comment technical/music chronology");
  assert.equal(mattCodeComments.some(comment => comment.text.includes("1.4.3 final") || comment.text.includes("final 1.4.3")), false, "Oct 15 comments must not imply final jQuery 1.4.3 was released");
  for (const comment of mattCodeComments.filter(comment => comment.ephemeralAuthor)) {
    assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS[comment.ephemeralAuthor.id], undefined, `${comment.author} must remain outside the canonical registry`);
  }
  mattCodeThreadState = facebook.facebookStateTransition(mattCodeThreadState, { type: "BEGIN_COMMENT", itemId: "matt-code-photo-2010" });
  mattCodeThreadState = facebook.facebookStateTransition(mattCodeThreadState, { type: "EDIT_COMMENT", value: "nice" });
  mattCodeThreadState = facebook.facebookStateTransition(mattCodeThreadState, { type: "SUBMIT_COMMENT", displayName: "Visitor" });
  assert.equal(facebook.selectFacebookComments(mattCodeThreadState, "matt-code-photo-2010").length, 7, "user comment must increment Matt's code thread from six to seven");
  const lucaAlbums = facebookAlbums.getFacebookAlbumsForActor({ kind: "canonical", characterId: "luca", displayName: "Luca" });
  assert.deepEqual(lucaAlbums.map(album => [album.id, album.title, album.mediaIds]), [["luca-profile-pictures", "Profile Pictures", ["luca-profile-picture"]], ["luca-pickup-basketball", "Pickup Basketball", ["luca-basketball-01", "luca-basketball-02", "luca-basketball-03"]], ["luca-photos", "Photos", ["jack-tagged-luca-01", "luca-jack-birthday-00", "luca-jack-birthday-01", "luca-jack-birthday-02", "luca-jack-birthday-03", "luca-work-main-street-diner"]]], "Luca albums must use the approved profile, tagged-social, birthday, basketball, and work media boundaries");
  assert.deepEqual(seed.facebook.feed.filter(story => story.id === "luca-profile-picture-current").map(story => [story.friendId, story.author, story.text, story.mediaId, story.createdAt, story.visibility, story.profileWallEligible]), [["luca", "Luca Bennett", "updated his profile picture.", "luca-profile-picture", "2010-10-20T00:00:00-07:00", "custom", true]], "Luca Profile Picture must have exactly one canonical historical owner story");
  assert.equal(facebook.selectFacebookProfileWall(facebook.createInitialFacebookState("Visitor"), "Luca Bennett").filter(story => story.id === "luca-profile-picture-current").length, 1, "Luca Wall must expose exactly one Profile Picture update story");
  assert.deepEqual(lucaAlbums.find(album => album.id === "luca-photos")?.photos.map(photo => [photo.mediaId, photo.timestamp, photo.venueId]), [["jack-tagged-luca-01", "2010-09-14T20:00:00-07:00", undefined], ["luca-jack-birthday-00", "2010-08-02T23:17:00-07:00", undefined], ["luca-jack-birthday-01", "2010-08-02T23:17:00-07:00", undefined], ["luca-jack-birthday-02", "2010-08-02T23:17:00-07:00", undefined], ["luca-jack-birthday-03", "2010-08-02T23:17:00-07:00", undefined], ["luca-work-main-street-diner", "2010-03-20T22:30:00-07:00", "main-street-diner"]], "Luca Photos must retain tagged Jack birthday photos and deterministic work-history venue binding");
  let lucaThreadState = facebook.createInitialFacebookState("Visitor");
  const lucaThreadId = "luca-pickup-basketball-photos";
  const lucaSeedComments = facebook.selectFacebookComments(lucaThreadState, lucaThreadId);
  assert.deepEqual(lucaSeedComments.map(comment => [comment.author, comment.characterId, comment.ephemeralAuthor?.id, comment.text]), [
    ["Chris Morgan", "chris", undefined, "my shot was clean tho lol"],
    ["Luca Bennett", "luca", undefined, "you missed like 10 before that"],
    ["Chris Morgan", "chris", undefined, "details details"],
    ["Frank", undefined, "facebook-ephemeral-frank", "i counted 12 lol"],
  ], "Luca basketball banter must preserve the exact four-comment chronology");
  assert.deepEqual(facebook.selectFacebookLikes(lucaThreadState, lucaThreadId, 0).map(like => [like.id, like.characterId, like.displayName]), [["luca-pickup-basketball-like-chris", "chris", "Chris Morgan"]], "Chris must provide exactly one seeded Like on Luca's album story");
  const lucaCommentActors = lucaSeedComments.map(comment => facebook.resolveFacebookCommentActor(comment, "Visitor"));
  assert.deepEqual(lucaCommentActors, [
    { kind: "canonical", characterId: "chris", displayName: "Chris Morgan" },
    { kind: "canonical", characterId: "luca", displayName: "Luca Bennett" },
    { kind: "canonical", characterId: "chris", displayName: "Chris Morgan" },
    { kind: "ephemeral-friend-of-friend", ephemeralId: "facebook-ephemeral-frank", displayName: "Frank", classification: "EPHEMERAL_FRIEND_OF_FRIEND" },
  ], "basketball comment authors must resolve through canonical and ephemeral actor routing");
  assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS.frank, undefined, "Frank must remain outside the canonical character registry");
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "SHOW_FEED" });
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "OPEN_FEED_ITEM", itemId: lucaThreadId, scrollPosition: 41 });
  const lucaThreadBeforeProfile = [lucaThreadState.selectedFeedItemId, lucaThreadState.scrollPosition, lucaThreadState.comments.length, lucaThreadState.likes.length];
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "OPEN_COMMENT_AUTHOR", actor: lucaCommentActors[3] });
  assert.deepEqual([lucaThreadState.currentView, lucaThreadState.selectedProfileName, lucaThreadState.selectedProfileActor?.kind], ["profile", "Frank", "ephemeral-friend-of-friend"], "Frank must open the shared sparse ephemeral Profile route");
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "GO_BACK" });
  assert.deepEqual([lucaThreadState.currentView, lucaThreadState.selectedFeedItemId, lucaThreadState.scrollPosition, lucaThreadState.comments.length, lucaThreadState.likes.length], ["feedDetail", ...lucaThreadBeforeProfile], "Frank Profile Back must restore the exact Luca thread state");
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "OPEN_COMMENT_AUTHOR", actor: lucaCommentActors[0] });
  assert.deepEqual([lucaThreadState.currentView, lucaThreadState.selectedProfileName], ["profile", "Chris Morgan"]);
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "GO_BACK" });
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "OPEN_COMMENT_AUTHOR", actor: lucaCommentActors[1] });
  assert.deepEqual([lucaThreadState.currentView, lucaThreadState.selectedProfileName], ["profile", "Luca Bennett"]);
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "GO_BACK" });
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "TOGGLE_LIKE", itemId: lucaThreadId, displayName: "Visitor" });
  assert.equal(facebook.selectFacebookLikes(lucaThreadState, lucaThreadId, 0).length, 2, "user Like must increment Luca's real Like records from one to two");
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "BEGIN_COMMENT", itemId: lucaThreadId });
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "EDIT_COMMENT", value: "good game" });
  lucaThreadState = facebook.facebookStateTransition(lucaThreadState, { type: "SUBMIT_COMMENT", displayName: "Visitor" });
  assert.equal(facebook.selectFacebookComments(lucaThreadState, lucaThreadId).length, 5, "user comment must increment Luca's shared thread from four to five");
  let jayBandThreadState = facebook.createInitialFacebookState("Visitor");
  const jayBandThreadId = "jay-band-performance-photo";
  const jayBandSeedLikes = facebook.selectFacebookLikes(jayBandThreadState, jayBandThreadId, 0);
  assert.deepEqual(jayBandSeedLikes.map(like => like.id), Array.from({ length: 48 }, (_, index) => `jay-band-performance-like-${String(index + 1).padStart(2, "0")}`), "Jay band post must retain exactly 48 deterministic seed Like records");
  const jayBandSeedComments = facebook.selectFacebookComments(jayBandThreadState, jayBandThreadId);
  assert.deepEqual(jayBandSeedComments.map(comment => [comment.id, comment.author, comment.characterId, comment.ephemeralAuthor?.id, comment.text]), [
    ["jay-band-comment-katie", "Katie Dawson", "katie", undefined, "wait you guys are actually really good lol"],
    ["jay-band-comment-alex", "Alex Wong", "alex", undefined, "wish i made it lol"],
    ["jay-band-comment-jack", "Jack Keller", "jack", undefined, "nice. you guys killed it"],
    ["jay-band-comment-mike", "Mike", undefined, "facebook-ephemeral-mike", "@Matt bass sounded sick"],
    ["jay-band-comment-sarah", "Sarah", undefined, "facebook-ephemeral-sarah", "who's the drummer?"],
    ["jay-band-comment-kevin", "Kevin", undefined, "facebook-ephemeral-kevin", "that was a good set"],
    ["jay-band-comment-emily", "Emily", undefined, "facebook-ephemeral-emily", "i knew that song!!"],
    ["jay-band-comment-nick", "Nick", undefined, "facebook-ephemeral-nick", "next show when"],
    ["jay-band-comment-rachel", "Rachel", undefined, "facebook-ephemeral-rachel", "so good"],
    ["jay-band-comment-frank", "Frank", undefined, "facebook-ephemeral-frank", "nice set lol"],
    ["jay-band-comment-ryan", "Ryan", undefined, "fof-ryan-001", "looks awesome"],
  ], "Jay band post must retain the exact 11-comment music-circle chronology");
  const mikeBandComment = jayBandSeedComments.find(comment => comment.id === "jay-band-comment-mike");
  assert.deepEqual(mikeBandComment?.mentions, [{ token: "@Matt", actor: { kind: "canonical", characterId: "matt", displayName: "Matt Ricci" } }], "Mike's @Matt must use structured canonical mention metadata");
  assert.equal(jayBandSeedComments.filter(comment => comment.characterId === "matt").length, 0, "Matt must not comment on Jay's band post");
  assert.equal(jayBandSeedComments.some(comment => comment.text === "who's the drummer?"), true, "one external commenter must ask about the offline drummer");
  assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS.anil, undefined, "drummer discussion must not create an Anil SNS identity");
  for (const comment of jayBandSeedComments.filter(comment => comment.ephemeralAuthor)) {
    assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS[comment.ephemeralAuthor.id], undefined, `${comment.author} must remain outside the canonical registry`);
  }
  jayBandThreadState = facebook.facebookStateTransition(jayBandThreadState, { type: "SHOW_FEED" });
  jayBandThreadState = facebook.facebookStateTransition(jayBandThreadState, { type: "OPEN_FEED_ITEM", itemId: jayBandThreadId, scrollPosition: 52 });
  jayBandThreadState = facebook.facebookStateTransition(jayBandThreadState, { type: "OPEN_COMMENT_AUTHOR", actor: mikeBandComment.mentions[0].actor });
  assert.deepEqual([jayBandThreadState.currentView, jayBandThreadState.selectedProfileName], ["profile", "Matt Ricci"], "Mike's structured @Matt must open canonical Matt Profile");
  jayBandThreadState = facebook.facebookStateTransition(jayBandThreadState, { type: "GO_BACK" });
  assert.deepEqual([jayBandThreadState.currentView, jayBandThreadState.selectedFeedItemId, jayBandThreadState.scrollPosition], ["feedDetail", jayBandThreadId, 52], "Matt mention Back must restore Jay's band thread");
  jayBandThreadState = facebook.facebookStateTransition(jayBandThreadState, { type: "TOGGLE_LIKE", itemId: jayBandThreadId, displayName: "Visitor" });
  assert.equal(facebook.selectFacebookLikes(jayBandThreadState, jayBandThreadId, 0).length, 49, "user Like must increment Jay's band post from 48 to 49");
  jayBandThreadState = facebook.facebookStateTransition(jayBandThreadState, { type: "TOGGLE_LIKE", itemId: jayBandThreadId, displayName: "Visitor" });
  assert.equal(facebook.selectFacebookLikes(jayBandThreadState, jayBandThreadId, 0).length, 48, "Unlike must restore Jay's deterministic 48-Like baseline");
  jayBandThreadState = facebook.facebookStateTransition(jayBandThreadState, { type: "BEGIN_COMMENT", itemId: jayBandThreadId });
  jayBandThreadState = facebook.facebookStateTransition(jayBandThreadState, { type: "EDIT_COMMENT", value: "great show" });
  jayBandThreadState = facebook.facebookStateTransition(jayBandThreadState, { type: "SUBMIT_COMMENT", displayName: "Visitor" });
  assert.equal(facebook.selectFacebookComments(jayBandThreadState, jayBandThreadId).length, 12, "user comment must increment Jay's band post from 11 to 12");
  const lucaBasketballMediaIds = ["luca-basketball-01", "luca-basketball-02", "luca-basketball-03"];
  assert.equal(lucaBasketballMediaIds.every(mediaId => facebookStoryMedia.getFacebookStoryMedia(mediaId)?.src), true, "all three Luca Feed preview records must resolve through the centralized story-media path");
  for (const mediaId of lucaBasketballMediaIds) {
    let lucaPhotoNavigation = facebook.createInitialFacebookState("Visitor");
    lucaPhotoNavigation = facebook.facebookStateTransition(lucaPhotoNavigation, { type: "OPEN_PROFILE", profileName: "Luca Bennett" });
    lucaPhotoNavigation = facebook.facebookStateTransition(lucaPhotoNavigation, { type: "SET_PROFILE_SECTION", section: "photos" });
    lucaPhotoNavigation = facebook.facebookStateTransition(lucaPhotoNavigation, { type: "OPEN_ALBUM", albumId: "luca-pickup-basketball" });
    lucaPhotoNavigation = facebook.facebookStateTransition(lucaPhotoNavigation, { type: "OPEN_ALBUM_PHOTO", albumId: "luca-pickup-basketball", mediaId });
    assert.deepEqual([lucaPhotoNavigation.currentView, lucaPhotoNavigation.selectedAlbumId, lucaPhotoNavigation.selectedPhotoMediaId], ["photoDetail", "luca-pickup-basketball", mediaId], `${mediaId} must open through the shared Photo Detail route`);
    lucaPhotoNavigation = facebook.facebookStateTransition(lucaPhotoNavigation, { type: "GO_BACK" });
    assert.deepEqual([lucaPhotoNavigation.currentView, lucaPhotoNavigation.selectedAlbumId], ["album", "luca-pickup-basketball"], `${mediaId} Back must restore Pickup Basketball`);
  }
  let lucaWorkNavigation = facebook.createInitialFacebookState("Visitor");
  lucaWorkNavigation = facebook.facebookStateTransition(lucaWorkNavigation, { type: "OPEN_PROFILE", profileName: "Luca Bennett" });
  lucaWorkNavigation = facebook.facebookStateTransition(lucaWorkNavigation, { type: "SET_PROFILE_SECTION", section: "photos" });
  lucaWorkNavigation = facebook.facebookStateTransition(lucaWorkNavigation, { type: "OPEN_ALBUM", albumId: "luca-photos" });
  lucaWorkNavigation = facebook.facebookStateTransition(lucaWorkNavigation, { type: "OPEN_ALBUM_PHOTO", albumId: "luca-photos", mediaId: "luca-work-main-street-diner" });
  assert.deepEqual([lucaWorkNavigation.currentView, lucaWorkNavigation.selectedAlbumId, lucaWorkNavigation.selectedPhotoMediaId], ["photoDetail", "luca-photos", "luca-work-main-street-diner"], "Luca work photo must open through the shared Photo Detail route");
  lucaWorkNavigation = facebook.facebookStateTransition(lucaWorkNavigation, { type: "TOGGLE_LIKE", itemId: "luca-work-main-street-diner", displayName: "Visitor" });
  lucaWorkNavigation = facebook.facebookStateTransition(lucaWorkNavigation, { type: "BEGIN_COMMENT", itemId: "luca-work-main-street-diner" });
  lucaWorkNavigation = facebook.facebookStateTransition(lucaWorkNavigation, { type: "EDIT_COMMENT", value: "late shift" });
  lucaWorkNavigation = facebook.facebookStateTransition(lucaWorkNavigation, { type: "SUBMIT_COMMENT", displayName: "Visitor" });
  assert.equal(lucaWorkNavigation.likedItemIds.includes("luca-work-main-street-diner"), true, "Luca work Photo Detail must retain the canonical story Like state");
  assert.equal(facebook.selectFacebookComments(lucaWorkNavigation, "luca-work-main-street-diner").some(comment => comment.text === "late shift"), true, "Luca work Photo Detail must retain the canonical story comment thread");
  lucaWorkNavigation = facebook.facebookStateTransition(lucaWorkNavigation, { type: "GO_BACK" });
  assert.deepEqual([lucaWorkNavigation.currentView, lucaWorkNavigation.selectedAlbumId], ["album", "luca-photos"], "work photo Back must restore Luca Photos");
  const katieAlbums = facebookAlbums.getFacebookAlbumsForActor({ kind: "canonical", characterId: "katie", displayName: "Katie" });
  assert.deepEqual(katieAlbums.map(album => [album.id, album.title]), [["katie-profile-pictures", "Profile Pictures"], ["katie-photo-history", "Photos"]]);
  assert.deepEqual(katieAlbums.find(album => album.id === "katie-photo-history")?.photos.map(photo => [photo.mediaId, photo.timestamp, photo.caption]), [["katie-selfie-september-2010", "2010-09-11T14:00:00-07:00", undefined], ["katie-selfie-july-2010", "2010-07-17T15:00:00-07:00", undefined], ["katie-selfie-august-2009", "2009-08-22T16:00:00-07:00", "summer :)"], ["katie-selfie-july-2009", "2009-07-18T17:00:00-07:00", undefined]], "Katie selfie history must be deterministic and newest-first with one restrained caption");
  const jayMusicAlbum = facebookAlbums.getFacebookAlbum("jay-music");
  assert.deepEqual(jayMusicAlbum.photos.map(photo => [photo.mediaId, photo.timestamp, photo.caption]), [
    ["jay-band-performance", "2010-10-19T22:00:00-07:00", "last night was awesome. thx @Matt @Z.tokyo @Anil"],
    ["jay-guitar", "2010-10-17T21:12:00-07:00", undefined],
    ["jay-guitar-may", "2010-05-15T18:00:00-07:00", "hey baby"],
    ["jay-learning-by-ear-2009-11-07", "2009-11-07T23:08:00-08:00", "trying to figure this one out"],
    ["jay-cd-haul-2009-08-22", "2009-08-22T15:22:00-07:00", "good day"],
    ["jay-rehearsal-2009-06-27-01", "2009-06-27T20:46:00-07:00", "not terrible today"],
    ["jay-rehearsal-2009-06-27-02", "2009-06-27T20:46:00-07:00", "not terrible today"],
    ["jay-music-bedroom-2009-03-14", "2009-03-14T22:18:00-07:00", "been playing this all week"],
  ], "Jay Music must sort photo records newest-first by in-world timestamp");
  const jay2009StoryIds = ["jay-learning-by-ear-2009-11-07", "jay-cd-haul-2009-08-22", "jay-rehearsal-2009-06-27", "jay-music-bedroom-2009-03-14"];
  const jay2009State = facebook.createInitialFacebookState("Visitor");
  const jay2009Stories = jay2009StoryIds.map(id => jay2009State.feed.find(item => item.id === id));
  assert.equal(jay2009Stories.every(Boolean), true, "exactly four approved Jay 2009 music stories must exist");
  assert.deepEqual(
    jay2009State.feed
      .filter((story) => story.friendId === "jay" && story.createdAt.startsWith("2009-"))
      .map((story) => story.id),
    jay2009StoryIds,
    "Jay must have exactly the four locked 2009 Facebook music stories",
  );
  assert.deepEqual(jay2009Stories.map(story => [story.id, story.friendId, story.createdAt, story.text]), [
    ["jay-learning-by-ear-2009-11-07", "jay", "2009-11-07T23:08:00-08:00", "trying to figure this one out"],
    ["jay-cd-haul-2009-08-22", "jay", "2009-08-22T15:22:00-07:00", "good day"],
    ["jay-rehearsal-2009-06-27", "jay", "2009-06-27T20:46:00-07:00", "not terrible today"],
    ["jay-music-bedroom-2009-03-14", "jay", "2009-03-14T22:18:00-07:00", "been playing this all week"],
  ], "Jay 2009 music story ownership, chronology, and captions must remain exact");
  assert.deepEqual(facebook.selectFacebookProfileWall(jay2009State, "Jay Diaz").filter(item => jay2009StoryIds.includes(item.id)).map(item => item.id), jay2009StoryIds, "Jay historical Wall must expose the four stories newest-first");
  assert.equal(jay2009Stories.every(story => !facebook.isFacebookNewsFeedEligible(jay2009State, story, Date.parse("2010-10-20T00:02:00-07:00"))), true, "all Jay 2009 stories must remain outside the Oct 2010 News Feed");
  assert.equal(facebook.selectFacebookVisibleFeed(jay2009State).some(item => jay2009StoryIds.includes(item.id)), false, "the visible Oct 2010 Feed must contain no Jay 2009 story");
  const jay2009ExpectedInteractions = [
    ["jay-music-bedroom-2009-03-14", 8, [["Luca Bennett", "again??"], ["Jay Diaz", "yeah"], ["Sarah", "good album"]]],
    ["jay-rehearsal-2009-06-27", 14, [["Matt Ricci", "speak for yourself"], ["Jay Diaz", "shut up ricci"], ["Z.tokyo", "lol"], ["Mike", "sounds better"], ["Kevin", "finally lol"]]],
    ["jay-cd-haul-2009-08-22", 6, [["Matt Ricci", "you bought that one finally"], ["Jay Diaz", "yeah"], ["Emily", "worth it?"], ["Jay Diaz", "definitely"]]],
    ["jay-learning-by-ear-2009-11-07", 11, [["Matt Ricci", "you're playing it wrong"], ["Jay Diaz", "come over then"], ["Matt Ricci", "no"], ["Frank", "lol"]]],
  ];
  for (const [storyId, likeCount, comments] of jay2009ExpectedInteractions) {
    assert.equal(facebook.selectFacebookLikes(jay2009State, storyId, 0).length, likeCount, `${storyId} Like baseline must derive from real records`);
    assert.deepEqual(facebook.selectFacebookComments(jay2009State, storyId).map(comment => [comment.author, comment.text]), comments, `${storyId} comments must preserve exact order and copy`);
  }
  const rehearsalPhotos = jayMusicAlbum.photos.filter(photo => photo.storyId === "jay-rehearsal-2009-06-27");
  assert.deepEqual(rehearsalPhotos.map(photo => [photo.mediaId, facebookAlbums.getFacebookPhotoTagActors(photo)]), [
    ["jay-rehearsal-2009-06-27-01", [{ kind: "canonical", characterId: "matt" }, { kind: "author-easter-egg", authorId: "author-z-tokyo" }]],
    ["jay-rehearsal-2009-06-27-02", [{ kind: "canonical", characterId: "matt" }, { kind: "author-easter-egg", authorId: "author-z-tokyo" }]],
  ], "rehearsal photos may tag Matt and Z.tokyo but never offline Anil");
  assert.equal(rehearsalPhotos.some(photo => JSON.stringify(facebookAlbums.getFacebookPhotoTagActors(photo)).includes("anil")), false, "Anil must remain absent from structured Facebook tags");
  assert.equal(rehearsalPhotos.every(photo => facebookAlbums.getFacebookCanonicalMediaRelationship(photo.mediaId)?.storyId === "jay-rehearsal-2009-06-27"), true, "rehearsal media must resolve through the canonical joined relationship model");
  const zTokyoRehearsalComment = facebook.selectFacebookComments(jay2009State, "jay-rehearsal-2009-06-27")[2];
  assert.deepEqual(facebook.resolveFacebookCommentActor(zTokyoRehearsalComment, "Visitor"), { kind: "author-easter-egg", authorId: "author-z-tokyo", displayName: "Z.tokyo" }, "Z.tokyo rehearsal comment must reuse the author-easter-egg profile route");
  assert.equal(coreSocialFriends.CORE_SOCIAL_RELATIONSHIPS.some(relationship => relationship.participantIds.includes("jay") && relationship.participantIds.includes("matt")), false, "casual Jay/Matt comments must not create a hard neighbor relationship");
  assert.equal(facebookAlbums.FACEBOOK_ALBUMS.filter(album => album.ownerActor.kind === "canonical" && album.ownerActor.characterId === "jay").length, 1, "Jay must retain exactly one Music album");
  assert.equal(facebookAlbums.getFacebookAlbumsForActor({ kind: "session-user", displayName: "Visitor" }).length, 0, "root Photos must remain the current user's empty baseline");
  assert.equal(facebookAlbums.getFacebookAlbumsForActor({ kind: "ephemeral-friend-of-friend", ephemeralId: "facebook-ephemeral-ryan", displayName: "Ryan", classification: "EPHEMERAL_FRIEND_OF_FRIEND" }).length, 0, "Ryan must retain an empty Photos surface");
  assert.equal(facebookAlbums.FACEBOOK_ALBUMS.some(album => album.ownerActor.displayName === "Anil"), false, "offline-only Anil must not receive a Facebook album");

  let facebookPhotoNavigation = facebook.createInitialFacebookState("Visitor");
  facebookPhotoNavigation = facebook.facebookStateTransition(facebookPhotoNavigation, { type: "OPEN_PROFILE", profileName: "Jay Diaz" });
  facebookPhotoNavigation = facebook.facebookStateTransition(facebookPhotoNavigation, { type: "SET_PROFILE_SECTION", section: "photos" });
  facebookPhotoNavigation = facebook.facebookStateTransition(facebookPhotoNavigation, { type: "OPEN_ALBUM", albumId: "jay-music" });
  facebookPhotoNavigation = facebook.facebookStateTransition(facebookPhotoNavigation, { type: "OPEN_ALBUM_PHOTO", albumId: "jay-music", mediaId: "jay-guitar" });
  assert.deepEqual([facebookPhotoNavigation.currentView, facebookPhotoNavigation.selectedAlbumId, facebookPhotoNavigation.selectedPhotoMediaId], ["photoDetail", "jay-music", "jay-guitar"]);
  facebookPhotoNavigation = facebook.facebookStateTransition(facebookPhotoNavigation, { type: "TOGGLE_LIKE", itemId: "jay-guitar-photo", displayName: "Visitor" });
  facebookPhotoNavigation = facebook.facebookStateTransition(facebookPhotoNavigation, { type: "BEGIN_COMMENT", itemId: "jay-guitar-photo" });
  facebookPhotoNavigation = facebook.facebookStateTransition(facebookPhotoNavigation, { type: "EDIT_COMMENT", value: "nice" });
  facebookPhotoNavigation = facebook.facebookStateTransition(facebookPhotoNavigation, { type: "SUBMIT_COMMENT", displayName: "Visitor" });
  assert.equal(facebookPhotoNavigation.likedItemIds.includes("jay-guitar-photo"), true, "Photo Detail must share the Feed story Like ID");
  assert.equal(facebook.selectFacebookComments(facebookPhotoNavigation, "jay-guitar-photo").some(comment => comment.text === "nice"), true, "Photo Detail must share the Feed story comment thread");
  facebookPhotoNavigation = facebook.facebookStateTransition(facebookPhotoNavigation, { type: "GO_BACK" });
  assert.equal(facebookPhotoNavigation.currentView, "album", "Photo Back must restore the originating album");
  facebookPhotoNavigation = facebook.facebookStateTransition(facebookPhotoNavigation, { type: "GO_BACK" });
  assert.deepEqual([facebookPhotoNavigation.currentView, facebookPhotoNavigation.profileSection], ["profile", "photos"], "Album Back must restore the same Profile Photos section");
  assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS.june.socialHandles.instagram, "junepark", "June's Instagram username must remain canonical and session-independent");
  assert.deepEqual(coreSocialFriends.CORE_SOCIAL_FRIEND_IDS, ["katie", "matt", "alex", "chris", "jay"]);
  assert.deepEqual(
    Object.values(coreSocialFriends.CORE_SOCIAL_FRIENDS).map(friend => [friend.id, friend.displayName, friend.fictional]),
    [["katie", "Katie Dawson", true], ["matt", "Matt Ricci", true], ["alex", "Alex Wong", true], ["chris", "Chris Morgan", true], ["jay", "Jay Diaz", true]],
    "core social friend identities must remain centralized and immutable",
  );
  const timelineDefinitions = sessionTimeline.SESSION_TIMELINE_EVENTS;
  const expectedTimeline = [
    ["initial-sms-mom-home-yet", 60, "initialSMS"],
    ["facebook-june-instagram-announcement", 60, "facebookJuneInstagramAnnouncement"],
    ["twitter-slang-epic-fail", 75, "twitterBackgroundTweet"],
    ["facebook-june-jack-gossip-katie", 120, "facebookJuneJackGossip"],
    ["facebook-june-jack-gossip-ryan-standalone", 135, "facebookEphemeralGossip"],
    ["facebook-june-jack-gossip-chris", 145, "facebookJuneJackGossip"],
    ["facebook-jack-request", 150, "facebookJackRequest"],
    ["facebook-katie-jack-gossip-message", 155, "facebookKatieGossipMessage"],
    ["instagram-june-jack-accidental-delete", 200, "instagramJuneDelete"],
    ["instagram-june-replacement-photo", 210, "instagramJunePost"],
    ["twitter-matt-mac-rumors", 220, "twitterBackgroundTweet"],
    ["facebook-june-message", 270, "facebookJuneMessage"],
    ["twitter-eva-school-tomorrow", 300, "twitterBackgroundTweet"],
    ["twitter-late-night-update", 390, "twitterBackgroundTweet"],
    ["foursquare-friend-checkin", 510, "foursquareActivity"],
    ["twitter-slang-fml", 540, "twitterBackgroundTweet"],
      ["tumblr-background-post", 630, "tumblrBackgroundPost"],
      ["twitter-nora-homework", 690, "twitterBackgroundTweet"],
      ["twitter-jay-headphones", 760, "twitterBackgroundTweet"],
      ["facebook-sophie-june-instagram-comment-1", 780, "facebookSophieJuneComment"],
      ["facebook-sophie-june-instagram-comment-2", 795, "facebookSophieJuneComment"],
      ["twitter-terminal-goodnight-world", 890, "twitterBackgroundTweet"],
  ];
  assert.deepEqual(
    timelineDefinitions.map(event => [event.id, event.atElapsedSeconds, event.type]),
    expectedTimeline,
    "cross-app timeline IDs, timing, and types must remain frozen",
  );
  const scheduledTimeline = scheduler.scheduleDeviceEvents([], sessionTimeline.buildSessionTimelineEvents());
  const scheduledTwice = scheduler.scheduleDeviceEvents(scheduledTimeline, sessionTimeline.buildSessionTimelineEvents());
  assert.equal(scheduledTwice.length, expectedTimeline.length, "timeline registration must remain exactly once");
  assert.deepEqual(scheduledTwice.map(event => event.id), expectedTimeline.map(([id]) => id));
  let catchUpQueue = scheduledTimeline;
  const caughtUpIds = [];
  while (scheduler.nextDueDeviceEvent(catchUpQueue, 15 * 60 * 1_000 - 1)) {
    const due = scheduler.nextDueDeviceEvent(catchUpQueue, 15 * 60 * 1_000 - 1);
    caughtUpIds.push(due.id);
    catchUpQueue = scheduler.removeDeviceEvent(catchUpQueue, due.id);
  }
  assert.deepEqual(caughtUpIds, expectedTimeline.map(([id]) => id), "pre-terminal catch-up must expose every event once without interaction");
  assert.equal(scheduledTimeline.some(event => event.sourceApp === "flickr"), false, "Flickr seed photos must not have scheduler duplicates");
  assert.equal(scheduledTimeline.some(event => event.payload?.kind === "initial-sms" && event.payload.sender === "Dad"), false, "Dad seed must not be registered as an arrival");

  let messagesA = messages.createInitialMessagesState();
  const messagesB = messages.createInitialMessagesState();
  assert.notStrictEqual(messagesA.messages, messagesB.messages, "sessions must clone the Messages seed array");
  assert.notStrictEqual(messagesA.messages[0], messagesB.messages[0], "sessions must clone the Dad seed record");
  assert.deepEqual(messagesA.messages.map(message => [message.sender, message.status, message.origin]), [["Dad", "unread", "seed"]]);
  assert.equal(messagesA.messages[0].timestamp, "5:48 PM");
  assert.equal(messagesA.messages.some(message => message.sender === "Mom"), false, "Mom must not exist before the live event");
  let unreadDadBadges = messagesBadge.createInitialMessagesBadgeState();
  assert.deepEqual(unreadDadBadges, ["dad-dinner-tonight"]);
  messagesA = messages.messagesStateTransition(messagesA, { type: "RECEIVE_MESSAGE", id: "mom-home-yet", conversationId: "mom", sender: "Mom", message: "Home yet?", timestamp: "12:03 AM" });
  unreadDadBadges = messagesBadge.messagesBadgeStateTransition(unreadDadBadges, { type: "ADD_UNREAD", messageId: "mom-home-yet" });
  assert.equal(unreadDadBadges.length, 2, "Mom arrival must stack on an unread Dad badge");
  assert.equal(messagesA.messages.at(-1).origin, "live");
  assert.equal(messagesB.messages.length, 1, "one session mutation must not leak into another");

  let readDadState = messages.createInitialMessagesState();
  let readDadBadges = messagesBadge.createInitialMessagesBadgeState();
  readDadState = messages.messagesStateTransition(readDadState, { type: "OPEN_CONVERSATION", conversationId: "dad" });
  readDadBadges = messagesBadge.messagesBadgeStateTransition(readDadBadges, { type: "MARK_READ", messageId: "dad-dinner-tonight" });
  assert.equal(readDadBadges.length, 0);
  assert.equal(readDadState.messages.find(message => message.id === "dad-dinner-tonight").status, "read");
  readDadState = messages.messagesStateTransition(readDadState, { type: "EDIT_DRAFT", value: "Maybe later" });
  readDadState = messages.messagesStateTransition(readDadState, { type: "SEND" });
  assert.equal(readDadState.messages.at(-1).conversationId, "dad");
  assert.equal(readDadState.messages.at(-1).origin, "live");
  assert.equal(readDadState.momReply, "none", "Dad replies must not schedule a scripted response");
  readDadState = messages.messagesStateTransition(readDadState, { type: "RECEIVE_MESSAGE", id: "mom-home-yet", conversationId: "mom", sender: "Mom", message: "Home yet?", timestamp: "12:03 AM" });
  readDadBadges = messagesBadge.messagesBadgeStateTransition(readDadBadges, { type: "ADD_UNREAD", messageId: "mom-home-yet" });
  assert.equal(readDadBadges.length, 1, "Mom must be the only badge after Dad was read");

  const lovePhrases = ["love u", "love you", "i love u", "i love you", "luv u", "luv you", "Yes, love you!"];
  lovePhrases.forEach(phrase => assert.equal(messages.isLoveYouIntent(phrase), true, `${phrase} must classify as explicit love intent`));
  ["love", "love home", "not love you", "I like you"].forEach(phrase => assert.equal(messages.isLoveYouIntent(phrase), false, `${phrase} must not classify as explicit love intent`));
  assert.equal(messages.classifyMomReply("yes love you"), "love", "love intent must take priority over the affirmative branch");

  let momLoveState = messages.createInitialMessagesState();
  momLoveState = messages.messagesStateTransition(momLoveState, { type: "OPEN_CONVERSATION", conversationId: "mom" });
  momLoveState = messages.messagesStateTransition(momLoveState, { type: "EDIT_DRAFT", value: "I love you" });
  momLoveState = messages.messagesStateTransition(momLoveState, { type: "SEND", elapsedMs: 120_000 });
  assert.equal(momLoveState.momLoveReply, "pending");
  assert.equal(momLoveState.momReply, "none", "love must not also schedule Good. Sleep early.");
  const momLoveDelay = messages.deterministicMomLoveReplyDelayMs("Zoey");
  assert.ok(momLoveDelay >= 20_000 && momLoveDelay <= 60_000, "Mom love delay must stay within the curated 20–60 second window");
  assert.equal(messages.deterministicMomLoveReplyDelayMs("Zoey"), momLoveDelay, "Mom love delay must be deterministic per session identity");
  let loveEvents = scheduler.scheduleDeviceEvent([], { id: "mom-love-reply", type: "momLoveReply", dueElapsedMs: 120_000 + momLoveDelay });
  loveEvents = scheduler.scheduleDeviceEvent(loveEvents, { id: "mom-love-reply", type: "momLoveReply", dueElapsedMs: 120_000 + momLoveDelay });
  assert.equal(loveEvents.length, 1, "Mom love event ID must be exactly-once");
  momLoveState = messages.messagesStateTransition(momLoveState, { type: "DELIVER_MOM_LOVE_REPLY" });
  momLoveState = messages.messagesStateTransition(momLoveState, { type: "DELIVER_MOM_LOVE_REPLY" });
  assert.equal(momLoveState.messages.filter(message => message.id === "mom-love-you-too").length, 1, "Mom love reply must deliver at most once");

  let affirmativeMomState = messages.createInitialMessagesState();
  affirmativeMomState = messages.messagesStateTransition(affirmativeMomState, { type: "OPEN_CONVERSATION", conversationId: "mom" });
  affirmativeMomState = messages.messagesStateTransition(affirmativeMomState, { type: "EDIT_DRAFT", value: "yes" });
  affirmativeMomState = messages.messagesStateTransition(affirmativeMomState, { type: "SEND", elapsedMs: 120_000 });
  assert.equal(affirmativeMomState.momReply, "pending", "existing affirmative Mom behavior must remain available");
  assert.equal(affirmativeMomState.momLoveReply, "none");

  let dadLoveState = messages.createInitialMessagesState();
  dadLoveState = messages.messagesStateTransition(dadLoveState, { type: "OPEN_CONVERSATION", conversationId: "dad" });
  dadLoveState = messages.messagesStateTransition(dadLoveState, { type: "EDIT_DRAFT", value: "luv u" });
  dadLoveState = messages.messagesStateTransition(dadLoveState, { type: "SEND", elapsedMs: 300_000 });
  assert.equal(dadLoveState.dadLoveReplyEligible, true);
  assert.equal(dadLoveState.dadLoveReply, "pending");
  const dadEvents = scheduler.scheduleDeviceEvent([], { id: "dad-love-terminal-reply", type: "dadLoveReply", dueElapsedMs: messages.DAD_LOVE_REPLY_DUE_ELAPSED_MS });
  assert.equal(dadEvents[0].dueElapsedMs, 890_000, "Dad love reply must remain fixed at T+890s");
  dadLoveState = messages.messagesStateTransition(dadLoveState, { type: "DELIVER_DAD_LOVE_REPLY" });
  dadLoveState = messages.messagesStateTransition(dadLoveState, { type: "DELIVER_DAD_LOVE_REPLY" });
  assert.equal(dadLoveState.messages.filter(message => message.id === "dad-sleep-early").length, 1, "Dad terminal reply must deliver at most once");

  let dadWithoutLoveState = messages.createInitialMessagesState();
  dadWithoutLoveState = messages.messagesStateTransition(dadWithoutLoveState, { type: "OPEN_CONVERSATION", conversationId: "dad" });
  dadWithoutLoveState = messages.messagesStateTransition(dadWithoutLoveState, { type: "EDIT_DRAFT", value: "Maybe later" });
  dadWithoutLoveState = messages.messagesStateTransition(dadWithoutLoveState, { type: "SEND", elapsedMs: 300_000 });
  assert.equal(dadWithoutLoveState.dadLoveReply, "none", "Dad must remain silent without explicit love intent");

  let lateDadLoveState = messages.createInitialMessagesState();
  lateDadLoveState = messages.messagesStateTransition(lateDadLoveState, { type: "OPEN_CONVERSATION", conversationId: "dad" });
  lateDadLoveState = messages.messagesStateTransition(lateDadLoveState, { type: "EDIT_DRAFT", value: "love you" });
  lateDadLoveState = messages.messagesStateTransition(lateDadLoveState, { type: "SEND", elapsedMs: 890_000 });
  assert.equal(lateDadLoveState.dadLoveReply, "none", "Dad love sent at or after the terminal-event cutoff must not schedule a reply");
  const resetLoveState = messages.messagesStateTransition(dadLoveState, { type: "RESET_RUNTIME" });
  assert.equal(resetLoveState.momLoveReply, "none");
  assert.equal(resetLoveState.dadLoveReplyEligible, false);
  assert.equal(resetLoveState.dadLoveReply, "none");

  messagesA = messages.messagesStateTransition(messagesA, { type: "RESET_RUNTIME" });
  unreadDadBadges = messagesBadge.messagesBadgeStateTransition(unreadDadBadges, { type: "RESET" });
  assert.deepEqual(messagesA.messages.map(message => [message.sender, message.status]), [["Dad", "unread"]], "Messages reset must restore the unread seed baseline");
  assert.deepEqual(unreadDadBadges, ["dad-dinner-tonight"]);
  assert.deepEqual(seed.messages.map(message => [message.sender, message.status]), [["Dad", "unread"]], "Messages runtime actions must not mutate the seed source");

  let facebookA = facebook.createInitialFacebookState("Zoey");
  const facebookB = facebook.createInitialFacebookState("Alex");
  assert.equal(facebookA.currentView, "home", "Facebook must launch into the audited Home hub");
  assert.deepEqual(facebookA.navigationStack, ["home"]);
  assert.deepEqual(facebookA.friends.map(friend => friend.id), ["katie", "matt", "alex", "chris", "jay", "june", "ben", "luca", "facebook-ephemeral-emily", "facebook-ephemeral-mike", "fof-ryan-001"], "Friends must begin with the canonical Facebook social circle plus exactly three existing peripheral friends, excluding pending Jack");
  assert.deepEqual(facebookA.friends.slice(-3).map(friend => [friend.name, friend.actor.kind]), [["Emily", "ephemeral-friend-of-friend"], ["Mike", "ephemeral-friend-of-friend"], ["Ryan", "ephemeral-friend-of-friend"]], "Emily, Mike, and Ryan must reuse Facebook-local peripheral actor routing");
  assert.equal(facebookA.friends.slice(-3).every(friend => coreSocialFriends.CORE_SOCIAL_CHARACTERS[friend.id] === undefined), true, "peripheral Friends must remain outside the canonical core registry");
  assert.deepEqual(facebook.selectFacebookPeopleSearchResults("june"), [{ kind: "canonical", characterId: "june", displayName: "June Park" }]);
  assert.deepEqual(facebook.selectFacebookPeopleSearchResults("Z.tokyo"), [{ kind: "author-easter-egg", authorId: "author-z-tokyo", displayName: "Z.tokyo" }]);
  assert.deepEqual(facebook.selectFacebookPeopleSearchResults("Anil"), [], "offline Anil must not become a searchable Facebook account");
  assert.equal(facebook.selectFacebookRequestCount(facebookA), 0);
  assert.equal(facebook.selectFacebookInboxUnreadCount(facebookA), 0);
  assert.equal(facebookA.friendRequestState, "none");
  assert.equal(facebook.selectFacebookJuneMessageState(facebookA), "none");
  assert.ok(facebookA.inboxThreads.every(thread => thread.origin === "seed" && thread.status === "read"));
  assert.deepEqual(facebookA.inboxThreads.map(thread => [thread.friendId, thread.sender]), [["katie", "Katie Dawson"], ["jay", "Jay Diaz"]]);
  assert.deepEqual([...new Set(facebookA.feed.filter(item => item.friendId).map(item => item.friendId))].sort(), ["alex", "ben", "chris", "jack", "jay", "june", "katie", "luca", "matt"]);
  assert.deepEqual([...new Set(facebookA.feed.map(item => item.kind))].sort(), ["activity", "album", "checkin", "photo", "status"], "Facebook seed must exercise every locked story structure");
  assert.ok(facebookA.feed.every(item => ["friends", "friends-of-friends", "everyone", "custom"].includes(item.visibility)), "every Facebook story must carry a visibility scope");
  assert.equal(facebook.selectFacebookVisibleFeed(facebookA).some(item => item.id === "jack-movie"), false, "Jack friends-only content must remain hidden before acceptance");
  assert.equal(facebookA.feed.some(item => item.id === "facebook-june-instagram-announcement"), false, "June's Instagram announcement must not exist before T+60");
  const zTokyoPost = facebookA.feed.find(item => item.id === "z-tokyo-profile-picture-update");
  assert.deepEqual(
    [zTokyoPost?.actor, zTokyoPost?.author, zTokyoPost?.text, zTokyoPost?.mediaId, zTokyoPost?.createdAt],
    [{ kind: "author-easter-egg", authorId: "author-z-tokyo" }, "Z.tokyo", "updated her profile picture.", "z-tokyo-profile-picture", "2010-10-18T20:52:00-07:00"],
  );
  const zTokyoMedia = facebookMedia.getFacebookMedia(zTokyoPost?.mediaId);
  assert.deepEqual(zTokyoMedia?.intendedUses, ["profile-picture", "wall-activity", "photos", "profile-pictures-album"]);
  assert.deepEqual(zTokyoMedia?.surfaceStatus, { profilePicture: "READY", wallActivity: "READY", photos: "READY", profilePicturesAlbum: "READY" });
  const zTokyoPortrait = await readFile(resolve(projectRoot, "src/assets/facebook/characters/z-tokyo/profile/IMG_1423.JPG"));
  assert.equal(createHash("sha256").update(zTokyoPortrait).digest("hex"), "46c233ae6b8425ba90008df67e64a3bbe8066457c4d12c524d7576efc5419021", "Z.tokyo portrait bytes must remain unchanged");
  let zTokyoProfile = facebook.facebookStateTransition(facebookA, { type: "OPEN_PROFILE", profileName: "Z.tokyo" });
  assert.deepEqual([zTokyoProfile.currentView, zTokyoProfile.selectedProfileName, zTokyoProfile.profileSection], ["profile", "Z.tokyo", "wall"]);
  assert.deepEqual(zTokyoProfile.feed.filter(item => item.author === "Z.tokyo").map(item => item.id), ["z-tokyo-profile-picture-update"], "Z.tokyo Wall must remain sparse and reuse the seed story");
  const alexPartyPost = facebookA.feed.find(item => item.id === "alex-jacks-party-friday");
  assert.ok(alexPartyPost, "Alex's Friday party post must exist as one canonical Facebook record");
  assert.deepEqual([alexPartyPost.friendId, alexPartyPost.visibility], ["alex", "friends-of-friends"]);
  assert.strictEqual(facebookA.feed.filter(item => item.author === "Alex Wong").find(item => item.id === alexPartyPost.id), alexPartyPost, "News Feed and Alex Wall must reference the same post object");
  assert.deepEqual(
    facebookA.comments.filter(comment => comment.itemId === alexPartyPost.id).map(comment => [comment.author, comment.characterId, comment.ephemeralAuthor?.classification]),
    [["Jay Diaz", "jay", undefined], ["Ryan", undefined, "EPHEMERAL_FRIEND_OF_FRIEND"]],
  );
  assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS.ryan, undefined, "friend-of-friend commenter must not enter the canonical registry");
  const lucaBasketballPost = facebookA.feed.find(item => item.id === "luca-pickup-basketball-photos");
  assert.deepEqual(
    [lucaBasketballPost?.friendId, lucaBasketballPost?.photoCount, lucaBasketballPost?.relatedCharacterIds, lucaBasketballPost?.tagUiStatus],
    ["luca", 3, ["chris"], "HOLD"],
    "Luca's photo story must retain canonical Chris participation without fabricated tag UI",
  );
  facebookA = facebook.facebookStateTransition(facebookA, { type: "DELIVER_JACK_REQUEST" });
  facebookA = facebook.facebookStateTransition(facebookA, { type: "DELIVER_JUNE_MESSAGE", timestamp: "12:06 AM" });
  facebookA = facebook.facebookStateTransition(facebookA, { type: "DELIVER_JACK_REQUEST" });
  facebookA = facebook.facebookStateTransition(facebookA, { type: "DELIVER_JUNE_MESSAGE", timestamp: "12:06 AM" });
  assert.equal(facebookA.friendRequestState, "pending");
  assert.equal(facebook.selectFacebookJuneMessageState(facebookA), "unread");
  assert.equal(facebook.selectFacebookRequestCount(facebookA), 1, "Requests count must derive from pending state");
  assert.equal(facebook.selectFacebookInboxUnreadCount(facebookA), 1, "Inbox count must derive from unread threads");
  assert.equal(facebook.selectFacebookNotificationUnreadCount(facebookA), 2, "Notifications must derive Jack and June unread activity from shared state");
  assert.deepEqual(facebook.FACEBOOK_HOME_LAUNCHER_PAGES.map(page => page.map(destination => destination.label)), [
    ["News Feed", "Profile", "Friends", "Inbox", "Places", "Requests", "Events", "Photos", "Chat"],
    ["Notes"],
  ], "Facebook Home must preserve the exact October 20 two-page launcher IA");
  assert.equal(facebook.FACEBOOK_HOME_LAUNCHER_PAGES[0].length, 9, "Facebook Home page 1 must contain no empty launcher slot");
  assert.equal(facebook.FACEBOOK_HOME_LAUNCHER_PAGES.flat().some(destination => destination.label === "Messages" || destination.label === "Groups"), false, "Home launcher must expose Inbox and omit Groups");
  const initialHomeBadgeState = facebook.createInitialFacebookState("Zoey");
  assert.deepEqual([
    facebook.selectFacebookInboxUnreadCount(initialHomeBadgeState),
    facebook.selectFacebookRequestCount(initialHomeBadgeState),
    facebook.selectFacebookEventInviteUnseenCount(initialHomeBadgeState),
    facebook.selectFacebookNotificationUnreadCount(initialHomeBadgeState),
  ], [0, 0, 0, 0], "fresh-session Home badges must reflect the canonical pre-delivery state rather than hardcoded prompts");
  const requestBadgeState = facebook.facebookStateTransition(initialHomeBadgeState, { type: "DELIVER_JACK_REQUEST" });
  assert.deepEqual([facebook.selectFacebookRequestCount(requestBadgeState), facebook.selectFacebookNotificationUnreadCount(requestBadgeState)], [1, 1], "Jack request delivery must drive independent Requests and Notifications counts");
  const acceptedRequestBadgeState = facebook.facebookStateTransition(requestBadgeState, { type: "ACCEPT_JACK" });
  assert.deepEqual([facebook.selectFacebookRequestCount(acceptedRequestBadgeState), facebook.selectFacebookNotificationUnreadCount(acceptedRequestBadgeState)], [0, 0], "accepting Jack must clear the pending request badge without a hardcoded count");
  let notesNavigation = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "SET_HOME_LAUNCHER_PAGE", page: 1 });
  notesNavigation = facebook.facebookStateTransition(notesNavigation, { type: "SHOW_NOTES" });
  assert.deepEqual([notesNavigation.currentView, notesNavigation.navigationStack, notesNavigation.homeLauncherPage], ["notes", ["home", "notes"], 1], "Notes must open from Home page 2 without losing its page snapshot");
  notesNavigation = facebook.facebookStateTransition(notesNavigation, { type: "GO_BACK" });
  assert.deepEqual([notesNavigation.currentView, notesNavigation.homeLauncherPage], ["home", 1], "Notes Back must return to Home page 2");
  assert.equal(facebook.resolveFacebookHomeSwipePage(0, 220, 120, 160, 116), 1, "left horizontal swipe must move Home page 1 to page 2");
  assert.equal(facebook.resolveFacebookHomeSwipePage(1, 100, 120, 155, 124), 0, "right horizontal swipe must move Home page 2 to page 1");
  assert.equal(facebook.resolveFacebookHomeSwipePage(1, 220, 120, 160, 116), 1, "left swipe on Home page 2 must not wrap");
  assert.equal(facebook.resolveFacebookHomeSwipePage(0, 100, 120, 155, 124), 0, "right swipe on Home page 1 must not wrap");
  assert.equal(facebook.resolveFacebookHomeSwipePage(0, 100, 100, 110, 180), 0, "mostly vertical gesture must not switch launcher pages");
  assert.equal(facebook.isFacebookHomeHorizontalSwipe(100, 100, 104, 102), false, "ordinary launcher tap movement must not be classified as a drag");
  assert.equal(facebook.isFacebookHomeHorizontalSwipe(220, 120, 160, 116), true, "meaningful horizontal movement must be classified as launcher paging");
  assert.equal(facebookA.inboxThreads.filter(thread => thread.id === "june-live-message").length, 1, "June live message must deliver once");
  assert.ok(facebookA.feed.every(item => item.origin === "seed"), "older Facebook feed content must remain seed content");
  assert.ok(facebookA.inboxThreads.filter(thread => thread.id !== "june-live-message").every(thread => thread.origin === "seed"), "older Facebook inbox content must survive live delivery");
  assert.equal(facebookB.friendRequestState, "none");
  assert.equal(facebookB.inboxThreads.some(thread => thread.id === "june-live-message"), false);

  const partyInviteDelay = facebook.deterministicFacebookPartyInviteDelayMs("Zoey");
  assert.ok(partyInviteDelay >= 20_000 && partyInviteDelay <= 60_000, "party invitation delay must stay within the curated 20-60 second window");
  assert.equal(facebook.deterministicFacebookPartyInviteDelayMs("Zoey"), partyInviteDelay, "party invitation delay must be deterministic per session identity");
  assert.equal(facebookA.partyInviteState, "none", "party invitation must not exist before either eligibility trigger");
  assert.equal(facebookA.inboxThreads.some(thread => thread.id === facebook.FACEBOOK_PARTY_INVITE_EVENT_ID), false);

  let junePartyState = facebook.facebookStateTransition(facebookA, { type: "OPEN_JUNE_MESSAGE" });
  junePartyState = facebook.facebookStateTransition(junePartyState, { type: "EDIT_MESSAGE_REPLY", value: "Still awake." });
  junePartyState = facebook.facebookStateTransition(junePartyState, { type: "SUBMIT_MESSAGE_REPLY", displayName: "Zoey", timestamp: "12:06 AM" });
  assert.equal(junePartyState.partyInviteEligibleFromJune, true, "any non-empty June reply must establish June eligibility");
  assert.equal(junePartyState.partyInviteState, "eligible");

  let ignoredJackPartyState = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "DELIVER_JACK_REQUEST" });
  ignoredJackPartyState = facebook.facebookStateTransition(ignoredJackPartyState, { type: "IGNORE_JACK" });
  assert.equal(ignoredJackPartyState.partyInviteEligibleFromJack, false, "ignoring Jack must not establish eligibility");
  assert.equal(ignoredJackPartyState.partyInviteState, "none");

  let jackPartyState = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "DELIVER_JACK_REQUEST" });
  jackPartyState = facebook.facebookStateTransition(jackPartyState, { type: "ACCEPT_JACK" });
  assert.equal(jackPartyState.partyInviteEligibleFromJack, true, "accepting Jack must establish Jack eligibility");
  assert.equal(jackPartyState.partyInviteState, "eligible");

  const partyInviteDueElapsedMs = 300_000 + partyInviteDelay;
  let partyInviteEvents = scheduler.scheduleDeviceEvent([], {
    id: facebook.FACEBOOK_PARTY_INVITE_EVENT_ID,
    type: "facebookPartyInvite",
    dueElapsedMs: partyInviteDueElapsedMs,
    sourceApp: "facebook",
    deliveryPolicy: "internal",
    payload: { kind: "facebook-party-invite" },
    provenanceStatus: "CURATED",
  });
  partyInviteEvents = scheduler.scheduleDeviceEvent(partyInviteEvents, { ...partyInviteEvents[0] });
  assert.equal(partyInviteEvents.length, 1, "June and Jack paths must converge on one stable scheduled event ID");
  assert.equal(scheduler.nextDueDeviceEvent(partyInviteEvents, partyInviteDueElapsedMs - 1), null, "party invitation must not arrive before its deterministic delay");
  assert.equal(scheduler.nextDueDeviceEvent(partyInviteEvents, partyInviteDueElapsedMs)?.id, facebook.FACEBOOK_PARTY_INVITE_EVENT_ID);

  let sharedPartyState = facebook.facebookStateTransition(junePartyState, { type: "DELIVER_JACK_REQUEST" });
  sharedPartyState = facebook.facebookStateTransition(sharedPartyState, { type: "ACCEPT_JACK" });
  assert.deepEqual([sharedPartyState.partyInviteEligibleFromJune, sharedPartyState.partyInviteEligibleFromJack], [true, true]);
  sharedPartyState = facebook.facebookStateTransition(sharedPartyState, { type: "SHOW_HOME" });
  assert.equal(sharedPartyState.partyInviteState, "eligible", "Facebook navigation must preserve invite eligibility");
  sharedPartyState = facebook.facebookStateTransition(sharedPartyState, { type: "DELIVER_PARTY_INVITE", timestamp: "12:08 AM" });
  sharedPartyState = facebook.facebookStateTransition(sharedPartyState, { type: "DELIVER_PARTY_INVITE", timestamp: "12:09 AM" });
  assert.equal(sharedPartyState.partyInviteState, "delivered");
  assert.equal(facebook.selectFacebookEventInviteUnseenCount(sharedPartyState), 1, "one delivered unseen event invite must drive the Events launcher badge");
  assert.equal(sharedPartyState.inboxThreads.filter(thread => thread.id === facebook.FACEBOOK_PARTY_INVITE_EVENT_ID).length, 1, "party invitation must be delivered at most once");
  assert.equal(sharedPartyState.inboxThreads.find(thread => thread.id === facebook.FACEBOOK_PARTY_INVITE_EVENT_ID)?.status, "unread");
  assert.deepEqual(facebook.selectFacebookNotifications(sharedPartyState).filter(notification => notification.target === "event"), [{ id: "facebook-notification-party-event", text: "Jack invited you to Jack's Party.", target: "event", unread: true }], "delivered party invite must drive exactly one unread event notification");
  let partyEventState = facebook.facebookStateTransition(sharedPartyState, { type: "SHOW_EVENTS" });
  assert.equal(facebook.selectFacebookEventInviteUnseenCount(partyEventState), 0, "opening Events must acknowledge the launcher badge");
  assert.equal(partyEventState.partyInviteState, "delivered", "opening the Events list must retain the event without opening detail");
  assert.equal(partyEventState.partyRsvp, null, "opening Events must not auto-RSVP");
  assert.equal(facebook.selectFacebookNotifications(partyEventState).find(notification => notification.target === "event")?.unread, true, "Events acknowledgement must remain independent from Notifications unread state");
  partyEventState = facebook.facebookStateTransition(partyEventState, { type: "OPEN_PARTY_EVENT" });
  assert.equal(partyEventState.partyInviteState, "opened", "Events must expose the same shared party invitation state");
  assert.equal(partyEventState.inboxThreads.find(thread => thread.id === facebook.FACEBOOK_PARTY_INVITE_EVENT_ID)?.status, "read");
  assert.equal(partyEventState.partyRsvp, null, "party RSVP must remain empty until explicit user action");
  partyEventState = facebook.facebookStateTransition(partyEventState, { type: "SET_PARTY_RSVP", value: "maybe" });
  assert.equal(partyEventState.partyRsvp, "maybe");
  sharedPartyState = facebook.facebookStateTransition(sharedPartyState, { type: "OPEN_MESSAGE", messageId: facebook.FACEBOOK_PARTY_INVITE_EVENT_ID });
  assert.equal(sharedPartyState.partyInviteState, "opened");
  assert.equal(sharedPartyState.inboxThreads.find(thread => thread.id === facebook.FACEBOOK_PARTY_INVITE_EVENT_ID)?.status, "read");
  const resetPartyState = facebook.facebookStateTransition(sharedPartyState, { type: "RESET", displayName: "Zoey" });
  assert.deepEqual(
    [resetPartyState.partyInviteState, resetPartyState.partyInviteEligibleFromJune, resetPartyState.partyInviteEligibleFromJack],
    ["none", false, false],
    "new session must clear party eligibility and delivery state",
  );
  assert.equal(resetPartyState.inboxThreads.some(thread => thread.id === facebook.FACEBOOK_PARTY_INVITE_EVENT_ID), false);

  let facebookNavigation = facebook.createInitialFacebookState("Zoey");
  facebookNavigation = facebook.facebookStateTransition(facebookNavigation, { type: "SHOW_FEED" });
  facebookNavigation = facebook.facebookStateTransition(facebookNavigation, { type: "SET_SCROLL_POSITION", scrollPosition: 73 });
  const feedAuthor = facebookNavigation.feed[0].author;
  facebookNavigation = facebook.facebookStateTransition(facebookNavigation, { type: "OPEN_PROFILE", profileName: feedAuthor });
  assert.equal(facebookNavigation.currentView, "profile");
  assert.equal(facebookNavigation.selectedProfileName, feedAuthor);
  assert.deepEqual(facebookNavigation.navigationStack, ["home", "feed", "profile"]);
  facebookNavigation = facebook.facebookStateTransition(facebookNavigation, { type: "GO_BACK" });
  assert.equal(facebookNavigation.currentView, "feed");
  assert.equal(facebookNavigation.scrollPosition, 73, "Profile Back must preserve Feed position");
  let facebookStatus = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "SHOW_FEED" });
  assert.equal(facebookStatus.feed.some(item => item.origin === "user"), false, "Facebook must not seed user-owned status content");
  facebookStatus = facebook.facebookStateTransition(facebookStatus, { type: "OPEN_STATUS_COMPOSER" });
  facebookStatus = facebook.facebookStateTransition(facebookStatus, { type: "EDIT_STATUS", value: "My own status" });
  facebookStatus = facebook.facebookStateTransition(facebookStatus, { type: "SUBMIT_STATUS", displayName: "Zoey", timestamp: "12:09 AM", createdAt: "2010-10-20T00:09:00-07:00" });
  assert.deepEqual(
    [facebookStatus.feed[0].author, facebookStatus.feed[0].text, facebookStatus.feed[0].timestamp, facebookStatus.feed[0].origin, facebookStatus.feed[0].contentStatus],
    ["Zoey", "My own status", "12:09 AM", "user", "USER-GENERATED"],
    "only explicit Status submission may create owner-authored Facebook content",
  );
  let facebookPlaces = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "SHOW_PLACES" });
  assert.equal(facebookPlaces.userCheckIn, null, "Facebook Places must not seed a user location");
  facebookPlaces = facebook.facebookStateTransition(facebookPlaces, { type: "OPEN_NEARBY_PLACES" });
  assert.deepEqual([facebookPlaces.currentView, facebookPlaces.navigationStack], ["nearbyPlaces", ["home", "places", "nearbyPlaces"]], "Places Check In must open the dedicated Nearby Places route");
  facebookPlaces = facebook.facebookStateTransition(facebookPlaces, { type: "SELECT_PLACE_FOR_CHECK_IN", venueId: "downtown-coffee" });
  assert.deepEqual([facebookPlaces.currentView, facebookPlaces.selectedPlaceId], ["placeCheckIn", "downtown-coffee"], "Nearby Places selection must retain the canonical venue ID");
  facebookPlaces = facebook.facebookStateTransition(facebookPlaces, { type: "OPEN_PLACE_TAG_FRIENDS" });
  assert.equal(facebookPlaces.friends.some(friend => friend.id === "jack"), false, "Jack must not be taggable before friendship acceptance");
  assert.equal(facebookPlaces.friends.some(friend => friend.id === "anil"), false, "Anil must never enter the Facebook friend tag source");
  facebookPlaces = facebook.facebookStateTransition(facebookPlaces, { type: "TOGGLE_PLACE_TAGGED_FRIEND", friendId: "katie" });
  facebookPlaces = facebook.facebookStateTransition(facebookPlaces, { type: "GO_BACK" });
  facebookPlaces = facebook.facebookStateTransition(facebookPlaces, { type: "EDIT_PLACE_STATUS", value: "late coffee" });
  facebookPlaces = facebook.facebookStateTransition(facebookPlaces, { type: "CHECK_IN", venueId: "downtown-coffee", displayName: "Zoey", timestamp: "12:10 AM", createdAt: "2010-10-20T00:10:00-07:00" });
  assert.deepEqual(facebookPlaces.userCheckIn, { venueId: "downtown-coffee", venueName: "Downtown Coffee", author: "Zoey", timestamp: "12:10 AM", createdAt: "2010-10-20T00:10:00-07:00", status: "late coffee", taggedFriendIds: ["katie"], origin: "user" });
  assert.deepEqual([facebookPlaces.currentView, facebookPlaces.navigationStack], ["placeDetail", ["home", "places", "placeDetail"]], "successful Check In must return to canonical Place Detail");
  const userPlaceStory = facebookPlaces.feed.find(item => item.id === "facebook-user-checkin");
  assert.deepEqual([userPlaceStory?.venueId, userPlaceStory?.createdAt, userPlaceStory?.text, userPlaceStory?.taggedCharacterIds], ["downtown-coffee", "2010-10-20T00:10:00-07:00", "is at Downtown Coffee. late coffee", ["katie"]], "the existing CHECK_IN path must create one canonical venue story with optional status and selected friends");
  assert.equal(facebookPlaces.feed.filter(item => item.id === "facebook-user-checkin").length, 1, "Facebook Check In must never duplicate the stable user story");
  assert.equal(facebook.isFacebookNewsFeedEligible(facebookPlaces, userPlaceStory, Date.parse("2010-10-20T00:10:00-07:00")), true, "user Check In must remain eligible only through the centralized News Feed helper");
  assert.equal(facebook.selectFacebookPlacesActivity(facebookPlaces)[0].id, "facebook-user-checkin", "Places activity must include the submitted check-in newest-first");
  const duplicatePlaceSubmit = facebook.facebookStateTransition(facebookPlaces, { type: "CHECK_IN", venueId: "downtown-coffee", displayName: "Zoey", timestamp: "12:10 AM", createdAt: "2010-10-20T00:10:00-07:00" });
  assert.strictEqual(duplicatePlaceSubmit, facebookPlaces, "Check In submission outside the venue form must not create a duplicate record");
  let acceptedJackPlaces = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "DELIVER_JACK_REQUEST" });
  acceptedJackPlaces = facebook.facebookStateTransition(acceptedJackPlaces, { type: "ACCEPT_JACK" });
  acceptedJackPlaces = facebook.facebookStateTransition(acceptedJackPlaces, { type: "SHOW_PLACES" });
  acceptedJackPlaces = facebook.facebookStateTransition(acceptedJackPlaces, { type: "OPEN_NEARBY_PLACES" });
  acceptedJackPlaces = facebook.facebookStateTransition(acceptedJackPlaces, { type: "SELECT_PLACE_FOR_CHECK_IN", venueId: "main-street-diner" });
  acceptedJackPlaces = facebook.facebookStateTransition(acceptedJackPlaces, { type: "OPEN_PLACE_TAG_FRIENDS" });
  assert.equal(acceptedJackPlaces.friends.some(friend => friend.id === "jack"), true, "accepted Jack must become available through the current Facebook friends tag source");
  assert.deepEqual(facebook.FACEBOOK_PLACE_OPTIONS.map(venue => [venue.id, venue.name]), [
    ["downtown-coffee", "Downtown Coffee"],
    ["community-courts", "Community Courts"],
    ["main-street-diner", "Main Street Diner"],
    ["riverside-park", "Riverside Park"],
    ["westside-library", "Westside Library"],
    ["gelato-roma", "Gelato Roma"],
  ], "Facebook Places must use one exact canonical identity per venue");
  assert.deepEqual(facebook.FACEBOOK_FRIEND_CHECK_INS.map(checkIn => [checkIn.id, checkIn.characterId, checkIn.venueId, checkIn.venueName, checkIn.createdAt]), [
    ["ben-coffee-checkin", "ben", "downtown-coffee", "Downtown Coffee", "2010-10-19T23:12:00-07:00"],
    ["luca-diner-checkin", "luca", "main-street-diner", "Main Street Diner", "2010-10-19T22:44:00-07:00"],
    ["chris-courts-checkin", "chris", "community-courts", "Community Courts", "2010-10-19T22:18:00-07:00"],
    ["alex-riverside-park-checkin", "alex", "riverside-park", "Riverside Park", "2010-10-19T21:36:00-07:00"],
    ["katie-westside-library-checkin", "katie", "westside-library", "Westside Library", "2010-10-19T20:14:00-07:00"],
    ["matt-gelato-roma-checkin", "matt", "gelato-roma", "Gelato Roma", "2010-10-19T19:22:00-07:00"],
  ], "Recent Check-ins must preserve the exact character/venue baseline newest-first");
  assert.equal(facebook.FACEBOOK_FRIEND_CHECK_INS.every((checkIn, index, checkIns) => index === 0 || Date.parse(checkIns[index - 1].createdAt) > Date.parse(checkIn.createdAt)), true, "Recent Check-ins must derive strict newest-first order from canonical timestamps");
  assert.equal(new Set(facebook.FACEBOOK_PLACE_OPTIONS.map(venue => venue.id)).size, facebook.FACEBOOK_PLACE_OPTIONS.length, "Facebook canonical venue IDs must be unique");
  assert.equal(new Set(facebook.FACEBOOK_PLACE_OPTIONS.map(venue => venue.name)).size, facebook.FACEBOOK_PLACE_OPTIONS.length, "Facebook canonical venue names must be unique");
  const alignedPlacesState = facebook.createInitialFacebookState("Zoey");
  const newPlaceStoryIds = ["alex-riverside-park-checkin", "katie-westside-library-checkin", "matt-gelato-roma-checkin"];
  const newPlaceStories = newPlaceStoryIds.map(storyId => alignedPlacesState.feed.find(story => story.id === storyId));
  assert.deepEqual(newPlaceStories.map(story => [story?.id, story?.friendId, story?.venueId, story?.createdAt, story?.kind, story?.visibility]), [
    ["alex-riverside-park-checkin", "alex", "riverside-park", "2010-10-19T21:36:00-07:00", "checkin", "friends"],
    ["katie-westside-library-checkin", "katie", "westside-library", "2010-10-19T20:14:00-07:00", "checkin", "friends"],
    ["matt-gelato-roma-checkin", "matt", "gelato-roma", "2010-10-19T19:22:00-07:00", "checkin", "friends"],
  ], "Alex, Katie, and Matt must each receive exactly one aligned Facebook Places story");
  assert.equal(newPlaceStories.every(story => story && story.createdAt.startsWith("2010-") && Date.parse(story.createdAt) <= facebookSessionStartMs), true, "new Places stories must be valid non-future 2010 records");
  assert.equal(newPlaceStories.every(story => story && facebook.isFacebookNewsFeedEligible(alignedPlacesState, story, facebookSessionStartMs)), true, "new Places stories must remain eligible only through the centralized News Feed selector");
  assert.equal(newPlaceStoryIds.every(storyId => facebook.selectFacebookVisibleFeed(alignedPlacesState).some(story => story.id === storyId)), true, "eligible aligned Places stories must resolve through the final visible Feed");
  const canonicalCheckInStories = alignedPlacesState.feed.filter(story => story.kind === "checkin");
  for (const characterId of ["alex", "katie", "matt"]) assert.equal(canonicalCheckInStories.filter(story => story.friendId === characterId).length, 1, `${characterId} must have exactly one Facebook check-in story`);
  for (const characterId of ["jay", "june", "jack"]) assert.equal(canonicalCheckInStories.filter(story => story.friendId === characterId).length, 0, `${characterId} must receive no new Facebook check-in`);
  assert.deepEqual(seed.foursquare.venues.map(venue => [venue.id, venue.name]), [["night-owl", "Night Owl Cafe"], ["main-street-diner", "Main Street Diner"], ["cedar-books", "Cedar Books"], ["riverside-park", "Riverside Park"]], "Facebook Places alignment must not modify Foursquare venue state");
  assert.deepEqual(facebook.FACEBOOK_CHAT_ROSTER.map(person => [person.characterId, person.displayName, person.presence]), [
    ["katie", "Katie Dawson", "online"],
    ["chris", "Chris Morgan", "online"],
    ["matt", "Matt Ricci", "online"],
    ["june", "June Park", "online"],
    ["jay", "Jay Diaz", "offline"],
    ["jack", "Jack Keller", "offline"],
  ], "Facebook Chat candidate presence records must preserve exact online-first canonical order");
  assert.deepEqual(facebook.FACEBOOK_CHAT_ROSTER.filter(person => person.presence === "online").map(person => person.characterId), ["katie", "chris", "matt", "june"], "Facebook Chat candidate online set must remain exact");
  assert.deepEqual(facebook.FACEBOOK_CHAT_ROSTER.filter(person => person.presence === "offline").map(person => person.characterId), ["jay", "jack"], "Facebook Chat candidate offline set must remain exact");
  for (const excludedIdentity of ["ben", "luca", "alex", "sophie", "author-z-tokyo", "anil"]) {
    assert.equal(facebook.FACEBOOK_CHAT_ROSTER.some(person => person.characterId === excludedIdentity), false, `${excludedIdentity} must remain outside the Facebook Chat roster`);
  }
  const initialChatState = facebook.createInitialFacebookState("Zoey");
  assert.deepEqual(facebook.selectFacebookVisibleChatRoster(initialChatState).map(person => [person.characterId, person.presence]), [["katie", "online"], ["chris", "online"], ["matt", "online"], ["june", "online"], ["jay", "offline"]], "session-start Chat must expose only existing Facebook friends");
  const pendingJackChatState = facebook.facebookStateTransition(initialChatState, { type: "DELIVER_JACK_REQUEST" });
  assert.equal(pendingJackChatState.friendRequestState, "pending", "Jack request must use the existing pending friendship state");
  assert.equal(facebook.selectFacebookVisibleChatRoster(pendingJackChatState).some(person => person.characterId === "jack"), false, "pending Jack request must not expose Chat presence");
  const ignoredJackChatState = facebook.facebookStateTransition(pendingJackChatState, { type: "IGNORE_JACK" });
  assert.equal(ignoredJackChatState.friendRequestState, "ignored");
  assert.equal(facebook.selectFacebookVisibleChatRoster(ignoredJackChatState).some(person => person.characterId === "jack"), false, "ignored Jack request must not expose Chat presence");
  const acceptedJackChatState = facebook.facebookStateTransition(pendingJackChatState, { type: "ACCEPT_JACK" });
  assert.equal(acceptedJackChatState.friendRequestState, "accepted");
  assert.equal(acceptedJackChatState.friends.some(friend => friend.id === "jack"), true, "acceptance must update the canonical Facebook friends collection");
  assert.deepEqual(facebook.selectFacebookVisibleChatRoster(acceptedJackChatState).map(person => [person.characterId, person.presence]), [["katie", "online"], ["chris", "online"], ["matt", "online"], ["june", "online"], ["jay", "offline"], ["jack", "offline"]], "accepted Jack must become visible in Chat while remaining offline");
  assert.deepEqual(acceptedJackChatState.inboxThreads, pendingJackChatState.inboxThreads, "accepting Jack must not create or mutate Messages threads");
  assert.deepEqual(acceptedJackChatState.threadMessages, pendingJackChatState.threadMessages, "accepting Jack must not create Chat or Message content");
  for (const peerId of ["katie", "chris", "matt", "june"]) {
    const rosterState = facebook.facebookStateTransition(initialChatState, { type: "SHOW_CHAT" });
    const conversationState = facebook.facebookStateTransition(rosterState, { type: "OPEN_CHAT_CONVERSATION", peerId });
    assert.deepEqual([conversationState.currentView, conversationState.selectedChatPeerId, conversationState.navigationStack], ["chatConversation", peerId, ["home", "chat", "chatConversation"]], `${peerId} online row must open its generic Chat conversation`);
  }
  const chatRosterState = facebook.facebookStateTransition(initialChatState, { type: "SHOW_CHAT" });
  assert.equal(facebook.facebookStateTransition(chatRosterState, { type: "OPEN_CHAT_CONVERSATION", peerId: "jay" }), chatRosterState, "offline Jay must not open an active Chat conversation");
  const acceptedJackRosterState = facebook.facebookStateTransition(acceptedJackChatState, { type: "SHOW_CHAT" });
  assert.equal(facebook.facebookStateTransition(acceptedJackRosterState, { type: "OPEN_CHAT_CONVERSATION", peerId: "jack" }), acceptedJackRosterState, "offline accepted Jack must not open an active Chat conversation");
  const katieConversation = facebook.facebookStateTransition(chatRosterState, { type: "OPEN_CHAT_CONVERSATION", peerId: "katie" });
  const emptyKatieDraft = facebook.facebookStateTransition(katieConversation, { type: "EDIT_CHAT_DRAFT", value: "   " });
  assert.equal(facebook.facebookStateTransition(emptyKatieDraft, { type: "SUBMIT_CHAT_MESSAGE", displayName: "Zoey", timestamp: "12:09 AM", createdAt: "2010-10-20T07:09:00.000Z" }), emptyKatieDraft, "whitespace-only Chat messages must be a no-op");
  const typedKatieChat = facebook.facebookStateTransition(katieConversation, { type: "EDIT_CHAT_DRAFT", value: "  hey  " });
  const messagesBeforeChatSend = { inboxThreads: typedKatieChat.inboxThreads, threadMessages: typedKatieChat.threadMessages, unreadCount: facebook.selectFacebookInboxUnreadCount(typedKatieChat) };
  const sentKatieChat = facebook.facebookStateTransition(typedKatieChat, { type: "SUBMIT_CHAT_MESSAGE", displayName: "Zoey", timestamp: "12:09 AM", createdAt: "2010-10-20T07:09:00.000Z" });
  assert.deepEqual(facebook.selectFacebookChatMessages(sentKatieChat, "katie"), [{ id: "facebook-chat-katie-user-1", peerId: "katie", authorType: "session-user", author: "Zoey", text: "hey", createdAt: "2010-10-20T07:09:00.000Z", timestamp: "12:09 AM", direction: "outgoing", origin: "user" }], "Chat send must create one trimmed session-local outgoing message at simulated time");
  assert.equal(sentKatieChat.chatDraft, "", "successful Chat send must clear the composer");
  assert.equal(facebook.selectFacebookChatMessages(sentKatieChat, "matt").length, 0, "Chat threads must remain isolated by canonical peer ID");
  assert.deepEqual({ inboxThreads: sentKatieChat.inboxThreads, threadMessages: sentKatieChat.threadMessages, unreadCount: facebook.selectFacebookInboxUnreadCount(sentKatieChat) }, messagesBeforeChatSend, "Chat send must not mutate Messages storage or unread state");
  const returnedChatRoster = facebook.facebookStateTransition(sentKatieChat, { type: "GO_BACK" });
  assert.equal(returnedChatRoster.currentView, "chat", "Chat conversation Back must return to the roster");
  const reopenedKatieChat = facebook.facebookStateTransition(returnedChatRoster, { type: "OPEN_CHAT_CONVERSATION", peerId: "katie" });
  assert.equal(facebook.selectFacebookChatMessages(reopenedKatieChat, "katie").length, 1, "sent Chat message must persist after Back and reopen in the same session");
  const resetChatState = facebook.facebookStateTransition(reopenedKatieChat, { type: "RESET", displayName: "Zoey" });
  assert.equal(Object.values(resetChatState.chatThreads).flat().length, 0, "new simulated-phone session must clear all Chat messages");
  assert.deepEqual(facebookMedia.FACEBOOK_MEDIA_IDS, ["z-tokyo-profile-picture", "facebook-default-avatar", "facebook-avatar-00", "facebook-avatar-02", "facebook-avatar-03", "facebook-avatar-05", "facebook-avatar-06", "facebook-avatar-07", "facebook-sophie-avatar"], "Facebook-local media must centralize the author portrait and approved actor avatars");
  assert.deepEqual([facebookMedia.getFacebookMedia("facebook-default-avatar")?.originalFilename, facebookMedia.getFacebookMedia("facebook-default-avatar")?.classification], ["01.png", "CURATED / FACEBOOK_DEFAULT"]);

  let facebookInbox = facebook.facebookStateTransition(facebookA, { type: "SHOW_INBOX" });
  assert.equal(facebook.selectFacebookInboxUnreadCount(facebookInbox), 1, "opening Inbox alone must not clear June unread");
  facebookInbox = facebook.facebookStateTransition(facebookInbox, { type: "OPEN_MESSAGE", messageId: "june-live-message" });
  assert.equal(facebook.selectFacebookInboxUnreadCount(facebookInbox), 0, "opening June must clear only its thread unread state");
  facebookInbox = facebook.facebookStateTransition(facebookInbox, { type: "GO_BACK" });
  assert.equal(facebookInbox.currentView, "inbox", "June Back must return to Inbox");

  let facebookAccept = facebook.facebookStateTransition(facebookA, { type: "ACCEPT_JACK" });
  assert.equal(facebookAccept.friendRequestState, "accepted");
  assert.deepEqual(facebookAccept.friends.map(friend => friend.id), ["katie", "matt", "alex", "chris", "jay", "june", "ben", "luca", "facebook-ephemeral-emily", "facebook-ephemeral-mike", "fof-ryan-001", "jack"], "accepting Jack must append one session-local friend to the expanded baseline circle");
  facebookAccept = facebook.facebookStateTransition(facebookAccept, { type: "SHOW_FRIENDS" });
  assert.equal(facebookAccept.currentView, "friends");
  assert.equal(facebookAccept.friends.some(friend => friend.id === "jack"), true, "accepted Jack must be available from Friends");
  assert.equal(facebook.selectFacebookRequestCount(facebookAccept), 0, "accepted request must leave no pending count");
  facebookAccept = facebook.facebookStateTransition(facebookAccept, { type: "DELIVER_JACK_REQUEST" });
  assert.equal(facebookAccept.friends.length, 12, "Jack request must not recreate or duplicate after acceptance");
  let facebookIgnore = facebook.facebookStateTransition(
    facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "DELIVER_JACK_REQUEST" }),
    { type: "IGNORE_JACK" },
  );
  assert.equal(facebookIgnore.friendRequestState, "ignored");
  assert.deepEqual(facebookIgnore.friends.map(friend => friend.id), ["katie", "matt", "alex", "chris", "jay", "june", "ben", "luca", "facebook-ephemeral-emily", "facebook-ephemeral-mike", "fof-ryan-001"], "ignoring Jack must not add him to baseline Friends");
  facebookIgnore = facebook.facebookStateTransition(facebookIgnore, { type: "DELIVER_JACK_REQUEST" });
  assert.equal(facebookIgnore.friendRequestState, "ignored", "ignored request must not be recreated");

  let facebookPlayability = facebook.facebookStateTransition(facebookA, { type: "OPEN_JUNE_MESSAGE" });
  assert.equal(facebook.selectFacebookJuneMessageState(facebookPlayability), "read", "opening June must mark only the live June message read");
  facebookPlayability = facebook.facebookStateTransition(facebookPlayability, { type: "EDIT_MESSAGE_REPLY", value: "Still awake." });
  facebookPlayability = facebook.facebookStateTransition(facebookPlayability, { type: "SUBMIT_MESSAGE_REPLY", displayName: "Zoey", timestamp: "12:06 AM" });
  assert.equal(facebook.selectFacebookJuneMessageState(facebookPlayability), "replied");
  assert.deepEqual(facebook.selectFacebookThreadMessages(facebookPlayability, "june-live-message").filter(message => message.origin === "user").map(message => [message.author, message.body, message.timestamp]), [["Zoey", "Still awake.", "12:06 AM"]]);
  facebookPlayability = facebook.facebookStateTransition(facebookPlayability, { type: "OPEN_FEED_ITEM", itemId: "jack-movie", scrollPosition: 96 });
  facebookPlayability = facebook.facebookStateTransition(facebookPlayability, { type: "BEGIN_COMMENT", itemId: "jack-movie" });
  facebookPlayability = facebook.facebookStateTransition(facebookPlayability, { type: "EDIT_COMMENT", value: "I thought so too." });
  facebookPlayability = facebook.facebookStateTransition(facebookPlayability, { type: "SUBMIT_COMMENT", displayName: "Zoey" });
  facebookPlayability = facebook.facebookStateTransition(facebookPlayability, { type: "TOGGLE_LIKE", itemId: "jack-movie" });
  assert.deepEqual(facebookPlayability.comments.filter(comment => comment.origin === "user"), [{ id: "facebook-comment-1", itemId: "jack-movie", author: "Zoey", text: "I thought so too.", origin: "user" }]);
  assert.deepEqual(facebook.selectFacebookComments(facebookPlayability, "alex-jacks-party-friday").map(comment => [comment.author, comment.origin]), [["Jay Diaz", "seed"], ["Ryan", "seed"]], "Alex's baseline discussion must remain exactly Jay and Ryan regardless of unrelated story comments");
  assert.deepEqual(facebookPlayability.likedItemIds, ["jack-movie"]);
  assert.equal(facebook.selectFacebookJuneMessageState(facebookPlayability), "replied", "Feed interaction must not mutate June state");
  assert.deepEqual(facebookPlayability.friends.map(friend => friend.id), ["katie", "matt", "alex", "chris", "jay", "june", "ben", "luca", "facebook-ephemeral-emily", "facebook-ephemeral-mike", "fof-ryan-001"], "Feed and message interaction must not mutate Friends state");
  assert.equal(facebookPlayability.scrollPosition, 96, "Facebook playability mutations must preserve feed scroll state");

  const twitterSeed = seed.twitter;
  assert.equal(twitterSeed.length, 19, "Twitter must start with the approved nineteen-item seed timeline");
  const mattPartyTweet = twitterSeed.find(tweet => tweet.id === "matt-jacks-party");
  assert.deepEqual([mattPartyTweet?.friendId, mattPartyTweet?.displayName, mattPartyTweet?.text], ["matt", "Matt Ricci", "jack's party sounds exhausting lol"]);
  assert.equal(seed.facebook.feed.some(item => item.friendId === "matt" && item.text.includes("party")), false, "Matt's party reaction must remain Twitter-specific");
  assert.deepEqual(
    twitter.sortTwitterTimeline(twitterSeed).map(tweet => tweet.timestamp),
    ["11:58 PM", "11:53 PM", "11:49 PM", "11:41 PM", "11:26 PM", "11:23 PM", "11:16 PM", "11:09 PM", "11:03 PM", "10:47 PM", "10:47 PM", "10:22 PM", "10:21 PM", "10:05 PM", "9:47 PM", "9:38 PM", "9:12 PM", "9:08 PM", "8:30 PM"],
    "Twitter seed must remain newest-first",
  );
  assert.equal(twitterSeed.filter(tweet => tweet.contentType === "manual-retweet").length, 2);
  assert.equal(twitterSeed.filter(tweet => tweet.contentType === "celebrity-discussion").length, 1);
  assert.equal(twitterSeed.filter(tweet => tweet.contentType === "ordinary").length, 4);
  assert.equal(twitterSeed.filter(tweet => tweet.contentType === "party-reaction").length, 1);
  assert.equal(twitterSeed.filter(tweet => tweet.contentType === "work-life").length, 5, "five work-life seed Tweets must rebalance the demographic tone");
  assert.equal(twitterSeed.filter(tweet => tweet.contentType === "apple-reference").length, 1, "Twitter preserves the original Apple-reference category");
  assert.equal(
    twitterSeed.filter(tweet => tweet.contentType === "apple-reference").length
      + timelineDefinitions.filter(event => event.sourceApp === "twitter" && /apple|back to the mac/i.test(event.payload?.post?.text ?? "")).length,
    1,
    "original Apple-reference category remains unchanged",
  );
  assert.ok(twitterSeed.filter(tweet => tweet.contentType === "work-life").every(tweet => tweet.origin === "seed" && tweet.contentProvenance === "CURATED"));
  assert.ok(twitterSeed.every(tweet => tweet.origin === "seed" && tweet.timestampProvenance === "CURATED"));
  assert.ok(twitterSeed.filter(tweet => tweet.contentType === "manual-retweet").every(tweet => (
    tweet.sourceTweetProvenance === "HOLD"
    && tweet.retweetWrapperProvenance === "CURATED"
    && tweet.sourceTweet?.handle
    && tweet.sourceTweet?.sourceDate
    && tweet.sourceTweet?.sourceUrl
  )), "mixed Twitter provenance metadata must remain intact");

  let twitterState = twitter.createInitialTwitterState("Zoey");
  assert.equal(twitterState.activeTab, "timeline");
  assert.equal(twitterState.currentView, "timeline");
  assert.equal(twitterState.revealedTweetId, null);
  const b2FirstTweetId = twitterState.timeline[0].id;
  const b2SecondTweetId = twitterState.timeline[1].id;
  let b2ActionState = twitter.twitterStateTransition(twitterState, { type: "TOGGLE_TWEET_ACTIONS", tweetId: b2FirstTweetId, timelineItemId: b2FirstTweetId });
  assert.equal(b2ActionState.revealedTweetId, b2FirstTweetId, "B2 must reveal the selected Timeline Tweet only");
  b2ActionState = twitter.twitterStateTransition(b2ActionState, { type: "TOGGLE_TWEET_ACTIONS", tweetId: b2SecondTweetId, timelineItemId: b2SecondTweetId });
  assert.equal(b2ActionState.revealedTweetId, b2SecondTweetId, "revealing a second Timeline Tweet must close the first and leave one revealed ID");
  const b2ReplyState = twitter.twitterStateTransition(b2ActionState, { type: "BEGIN_REPLY", tweetId: b2SecondTweetId });
  assert.deepEqual([b2ReplyState.currentView, b2ReplyState.composerKind, b2ReplyState.replyComposerTweetId, b2ReplyState.revealedTweetId], ["composer", "reply", b2SecondTweetId, null], "B2 Reply must reuse the existing composer route and clear the pane");
  const b2ReplyCancelState = twitter.twitterStateTransition(b2ReplyState, { type: "CANCEL_REPLY" });
  assert.deepEqual([b2ReplyCancelState.currentView, b2ReplyCancelState.composerKind, b2ReplyCancelState.replyComposerTweetId], ["timeline", null, null], "canceling a Timeline-pane Reply must return to Timeline root");
  const b2RetweetState = twitter.twitterStateTransition(b2ActionState, { type: "TOGGLE_RETWEET", tweetId: b2SecondTweetId, retweetedBy: "Zoey", retweetActionTimestamp: 100 });
  assert.deepEqual(b2RetweetState.retweetedTweetIds, [b2SecondTweetId], "B2 Retweet must retain the existing single-source state transition");
  assert.equal(b2RetweetState.retweetActivities[0].sourceTweetId, b2SecondTweetId, "B2 Retweet must retain the source Tweet relation");
  const b2FavoriteState = twitter.twitterStateTransition(b2ActionState, { type: "TOGGLE_FAVORITE", tweetId: b2SecondTweetId });
  assert.deepEqual(b2FavoriteState.favoriteTweetIds, [b2SecondTweetId], "B2 Favorite must retain the existing state transition");
  const b2FavoriteOffState = twitter.twitterStateTransition(b2FavoriteState, { type: "TOGGLE_FAVORITE", tweetId: b2SecondTweetId });
  assert.deepEqual(b2FavoriteOffState.favoriteTweetIds, [], "B2 Favorite must retain existing toggle-off behavior");
  const b2ProfileState = twitter.twitterStateTransition(b2ActionState, { type: "OPEN_USER_PROFILE", displayName: twitterState.timeline[1].displayName, originView: "timeline" });
  assert.deepEqual([b2ProfileState.currentView, b2ProfileState.profileOriginView, b2ProfileState.revealedTweetId], ["userProfile", "timeline", null], "B2 Profile must reuse the existing origin-aware profile route");
  const b2ProfileBackState = twitter.twitterStateTransition(b2ProfileState, { type: "BACK_FROM_PROFILE" });
  assert.deepEqual([b2ProfileBackState.activeTab, b2ProfileBackState.currentView], ["timeline", "timeline"], "B2 Profile Back must return to Timeline");
  const b2ProfileRootState = twitter.twitterStateTransition(b2ProfileState, { type: "SHOW_TAB", tab: "timeline" });
  assert.deepEqual([b2ProfileRootState.activeTab, b2ProfileRootState.currentView, b2ProfileRootState.selectedUserId], ["timeline", "timeline", null], "B2 Profile to Timeline tab must retain strict root-tab navigation");
  const b2PersistentState = twitter.twitterStateTransition(b2RetweetState, { type: "TOGGLE_FAVORITE", tweetId: b2SecondTweetId });
  const b2AfterTabState = twitter.twitterStateTransition(b2PersistentState, { type: "SHOW_TAB", tab: "mentions" });
  assert.deepEqual([b2AfterTabState.favoriteTweetIds, b2AfterTabState.retweetedTweetIds], [[b2SecondTweetId], [b2SecondTweetId]], "tab navigation must preserve B2 Favorite and Retweet state");
  assert.equal(twitter.TWITTER_SUGGESTED_USER_COUNT, 20, "Suggested Users must expose the designed 20-account inventory");
  assert.equal(twitterState.suggestedUsers.length, 20);
  assert.ok(twitterState.suggestedUsers.every(user => (
    user.handle.startsWith("@")
    && user.avatarStatus === "DEV-HOLD"
    && ["PERIOD-EVIDENCE", "CURATED", "HOLD"].includes(user.provenance)
    && typeof user.evidence === "string"
    && user.evidence.length > 0
  )), "every Suggested User must carry identity and provenance metadata");
  assert.ok(twitterState.suggestedUsers.every(user => (
    ["followers", "following", "tweets", "favorites"].every(field => (
      ["EXACT", "NEAR-DATE", "ESTIMATED", "ESTIMATED-DISPLAY", "CURATED-FILL"].includes(user.statistics[field].provenance)
      && user.statistics[field].sourceNotes.length > 0
    ))
  )), "every real-account statistic field must retain provenance and source notes");
  assert.deepEqual(twitterState.suggestedUsers.find(user => user.id === "nasa").statistics.followers, {
    value: 616842,
    provenance: "ESTIMATED-DISPLAY",
    confidence: "high",
    sourceDate: "2010-10-25",
    sourceUrl: "https://clickz.com/nasa-hopes-gen-x-and-y-follow-its-social-media-lift-off/54178/",
    sourceNotes: "Deterministic display estimate within the evidence-supported range below ClickZ's 626,700 snapshot five days later; not an exact historical count.",
  });
  assert.equal(twitter.selectTwitterUserProfile(twitterState, "nasa", "Zoey").followerCount, 616842);
  assert.ok(twitterState.suggestedUsers.every(user => (
    [user.statistics.following, user.statistics.followers, user.statistics.tweets, user.statistics.favorites]
      .every(stat => Number.isInteger(stat.value) && stat.value >= 0)
  )), "every real Suggested User profile must have a complete four-count grid");
  const fictionalFollowerCounts = ["June", "Nora", "Mia", "Eli", "Eva"].map(name => twitter.getTwitterUserProfile(name, "Zoey").followerCount);
  assert.equal(new Set(fictionalFollowerCounts).size, fictionalFollowerCounts.length, "fictional profiles must not share a uniform CURATED count pattern");
  const baselineFollowingCount = twitterState.followedUserIds.length;
  const baselineFollowerCount = twitterState.ownerProfileStats.followerCount;
  assert.equal(twitter.selectTwitterFollowingUsers(twitterState, "Zoey").length, baselineFollowingCount);
  let followGraphState = twitter.twitterStateTransition(twitterState, { type: "SHOW_TAB", tab: "search" });
  assert.equal(followGraphState.currentView, "searchLanding");
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "OPEN_SUGGESTED_USERS" });
  assert.equal(followGraphState.currentView, "suggestedUsers");
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "SET_PEOPLE_SCROLL_POSITION", view: "suggestedUsers", scrollPosition: 137 });
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "OPEN_USER_PROFILE_BY_ID", profileId: "npr", originView: "suggestedUsers", scrollPosition: 142 });
  assert.equal(followGraphState.currentView, "userProfile");
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "BACK_FROM_PROFILE" });
  assert.equal(followGraphState.currentView, "suggestedUsers");
  assert.equal(followGraphState.suggestedUsersScrollPosition, 142, "Suggested Users Profile Back must restore the captured list position");
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "SET_FOLLOW", profileId: "npr", following: true });
  assert.equal(twitter.selectTwitterUserProfile(followGraphState, "session-owner", "Zoey").followingCount, baselineFollowingCount + 1);
  assert.equal(followGraphState.ownerProfileStats.followerCount, baselineFollowerCount, "Follow must not fabricate a follower-count change");
  assert.equal(twitter.selectTwitterUserProfile(followGraphState, "npr", "Zoey").following, true, "Suggested list and Profile must share one follow graph");
  const duplicateFollow = twitter.twitterStateTransition(followGraphState, { type: "SET_FOLLOW", profileId: "npr", following: true });
  assert.strictEqual(duplicateFollow, followGraphState, "repeated Follow must be idempotent");
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "SHOW_TAB", tab: "search" });
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "OPEN_USER_PROFILE_BY_ID", profileId: "session-owner", originView: "searchLanding" });
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "OPEN_FOLLOWING" });
  assert.deepEqual(
    [followGraphState.activeTab, followGraphState.currentView, followGraphState.selectedUserId, followGraphState.profileOriginView],
    ["search", "profileFollowing", "session-owner", "searchLanding"],
    "Following must be a Profile-owned child that preserves the selected owner and original Profile origin",
  );
  assert.ok(twitter.selectTwitterFollowingUsers(followGraphState, "Zoey").some(user => user.id === "npr"));
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "SET_PEOPLE_SCROLL_POSITION", view: "following", scrollPosition: 61 });
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "BACK_FROM_PROFILE_FOLLOWING" });
  assert.deepEqual(
    [followGraphState.activeTab, followGraphState.currentView, followGraphState.selectedUserId, followGraphState.profileOriginView, followGraphState.followingScrollPosition],
    ["search", "userProfile", "session-owner", "searchLanding", 61],
    "Profile Following Back must restore the same owner Profile and retain its original Search origin",
  );
  followGraphState = twitter.twitterStateTransition(followGraphState, { type: "SET_FOLLOW", profileId: "npr", following: false });
  assert.equal(twitter.selectTwitterUserProfile(followGraphState, "session-owner", "Zoey").followingCount, baselineFollowingCount);
  assert.equal(followGraphState.followedUserIds.includes("npr"), false);
  const duplicateUnfollow = twitter.twitterStateTransition(followGraphState, { type: "SET_FOLLOW", profileId: "npr", following: false });
  assert.strictEqual(duplicateUnfollow, followGraphState, "repeated Unfollow must be idempotent");
  let universalFollowState = twitter.twitterStateTransition(followGraphState, { type: "SET_FOLLOW", profileId: "june", following: true });
  assert.equal(twitter.selectTwitterUserProfile(universalFollowState, "june", "Zoey").following, true, "Timeline-only profiles must use the shared graph");
  assert.equal(twitter.selectTwitterUserProfile(universalFollowState, "june", "Zoey").followerCount, 221, "an initially-unfollowed target gains one displayed follower");
  assert.ok(twitter.selectTwitterFollowingUsers(universalFollowState, "Zoey").some(user => user.id === "june"), "universal follows must appear in Following");
  assert.equal(twitter.selectTwitterUserProfile(universalFollowState, "session-owner", "Zoey").followingCount, baselineFollowingCount + 1);
  assert.deepEqual(
    twitter.selectTwitterFollowingUsers(universalFollowState, "Zoey").map(user => user.id),
    universalFollowState.followedUserIds,
    "owner Following must enumerate exactly the canonical followedUserIds graph, including profiles outside Suggested Users",
  );
  const repeatedUniversalFollow = twitter.twitterStateTransition(universalFollowState, { type: "SET_FOLLOW", profileId: "june", following: true });
  assert.strictEqual(repeatedUniversalFollow, universalFollowState, "universal Follow must remain idempotent");
  assert.equal(twitter.selectTwitterUserProfile(repeatedUniversalFollow, "june", "Zoey").followerCount, 221, "repeated Follow must not stack follower deltas");
  universalFollowState = twitter.twitterStateTransition(universalFollowState, { type: "SET_FOLLOW", profileId: "june", following: false });
  assert.equal(twitter.selectTwitterUserProfile(universalFollowState, "june", "Zoey").following, false);
  assert.equal(twitter.selectTwitterUserProfile(universalFollowState, "june", "Zoey").followerCount, 220, "Unfollow must restore an initially-unfollowed target baseline");
  assert.equal(twitter.selectTwitterFollowingUsers(universalFollowState, "Zoey").some(user => user.id === "june"), false);
  const repeatedUniversalUnfollow = twitter.twitterStateTransition(universalFollowState, { type: "SET_FOLLOW", profileId: "june", following: false });
  assert.strictEqual(repeatedUniversalUnfollow, universalFollowState, "universal Unfollow must remain idempotent");
  assert.equal(twitter.selectTwitterUserProfile(repeatedUniversalUnfollow, "june", "Zoey").followerCount, 220);
  const nasaUnfollowed = twitter.twitterStateTransition(universalFollowState, { type: "SET_FOLLOW", profileId: "nasa", following: false });
  assert.equal(twitter.selectTwitterUserProfile(universalFollowState, "nasa", "Zoey").followerCount, 616842, "baseline-followed target must not receive an initial extra follower");
  assert.equal(twitter.selectTwitterUserProfile(nasaUnfollowed, "nasa", "Zoey").followerCount, 616841, "baseline-followed target loses one displayed follower when unfollowed");
  const nasaRefollowed = twitter.twitterStateTransition(nasaUnfollowed, { type: "SET_FOLLOW", profileId: "nasa", following: true });
  assert.equal(twitter.selectTwitterUserProfile(nasaRefollowed, "nasa", "Zoey").followerCount, 616842, "refollow restores the historical baseline without double counting");
  const selfFollowAttempt = twitter.twitterStateTransition(universalFollowState, { type: "SET_FOLLOW", profileId: "session-owner", following: true });
  assert.strictEqual(selfFollowAttempt, universalFollowState, "reducer must reject self-follow even if UI dispatches it");
  const followReset = twitter.twitterStateTransition(
    twitter.twitterStateTransition(universalFollowState, { type: "SET_FOLLOW", profileId: "june", following: true }),
    { type: "RESET", displayName: "Alex" },
  );
  assert.equal(twitter.selectTwitterUserProfile(followReset, "session-owner", "Alex").followingCount, baselineFollowingCount, "new session must restore the designed follow baseline");
  assert.equal(followReset.followedUserIds.includes("npr"), false, "Zoey Follow state must not leak to Alex");
  assert.equal(followReset.followedUserIds.includes("june"), false, "universal Follow state must reset with the session");
  assert.equal(twitter.selectTwitterUserProfile(followReset, "june", "Alex").followerCount, 220, "session reset must remove target follower deltas");
  assert.equal(twitter.selectTwitterUserProfile(followReset, "nasa", "Alex").followerCount, 616842, "session reset must restore baseline-followed target count");
  assert.equal(twitter.selectTwitterLiveFollowerDelta("nasa", 0, "Zoey"), 0, "live drift must begin at zero at T0");
  const nasaDriftAt300 = twitter.selectTwitterLiveFollowerDelta("nasa", 300, "Zoey");
  assert.notEqual(nasaDriftAt300, 0, "eligible public-account follower count should drift over simulated time");
  assert.equal(twitter.selectTwitterLiveFollowerDelta("nasa", 300, "Zoey"), nasaDriftAt300, "same session/account/second must reproduce the same drift");
  assert.equal(twitter.selectTwitterLiveFollowerDelta("june", 300, "Zoey"), 0, "fictional ordinary users must not receive live drift");
  const nasaAt300 = twitter.selectTwitterUserProfile(twitterState, "nasa", "Zoey", 300).followerCount;
  const nasaUnfollowAt300 = twitter.selectTwitterUserProfile(
    twitter.twitterStateTransition(twitterState, { type: "SET_FOLLOW", profileId: "nasa", following: false }),
    "nasa", "Zoey", 300,
  ).followerCount;
  assert.equal(nasaAt300 - nasaUnfollowAt300, 1, "Follow graph ±1 must remain independent from live follower drift");
  assert.ok(Math.abs(twitter.selectTwitterLiveFollowerDelta("barackobama", 900, "Zoey")) <= 500, "session drift must respect its curated cap");
  assert.equal(followReset.suggestedUsersScrollPosition, 0);
  assert.equal(followReset.followingScrollPosition, 0);
  let rootNavigationBaseline = twitter.twitterStateTransition(twitter.createInitialTwitterState("Zoey"), { type: "SET_SCROLL_POSITION", scrollPosition: 91 });
  rootNavigationBaseline = twitter.twitterStateTransition(rootNavigationBaseline, { type: "SET_SOCIAL_SCROLL_POSITION", view: "mentions", scrollPosition: 12 });
  rootNavigationBaseline = twitter.twitterStateTransition(rootNavigationBaseline, { type: "SET_SOCIAL_SCROLL_POSITION", view: "messages", scrollPosition: 13 });
  rootNavigationBaseline = twitter.twitterStateTransition(rootNavigationBaseline, { type: "TOGGLE_FAVORITE", tweetId: "still-awake" });
  rootNavigationBaseline = twitter.twitterStateTransition(rootNavigationBaseline, { type: "TOGGLE_RETWEET", tweetId: "still-awake", retweetedBy: "Zoey", retweetActionTimestamp: 100 });
  rootNavigationBaseline = twitter.twitterStateTransition(rootNavigationBaseline, { type: "SET_FOLLOW", profileId: "npr", following: true });
  rootNavigationBaseline = twitter.twitterStateTransition(rootNavigationBaseline, { type: "TOGGLE_TWEET_ACTIONS", tweetId: "still-awake" });
  const assertRootNavigationPreservesTwitterData = (candidate, baseline, label) => {
    assert.strictEqual(candidate.timeline, baseline.timeline, `${label}: Timeline records must remain unchanged`);
    assert.strictEqual(candidate.mentions, baseline.mentions, `${label}: Mention records and unread state must remain unchanged`);
    assert.strictEqual(candidate.mentionTweets, baseline.mentionTweets, `${label}: Mention Tweets must remain unchanged`);
    assert.strictEqual(candidate.directMessages, baseline.directMessages, `${label}: DM records and unread state must remain unchanged`);
    assert.strictEqual(candidate.linkedTweets, baseline.linkedTweets, `${label}: linked Tweets must remain unchanged`);
    assert.strictEqual(candidate.favoriteTweetIds, baseline.favoriteTweetIds, `${label}: Favorites must remain unchanged`);
    assert.strictEqual(candidate.retweetedTweetIds, baseline.retweetedTweetIds, `${label}: Retweet IDs must remain unchanged`);
    assert.strictEqual(candidate.retweetActivities, baseline.retweetActivities, `${label}: Retweet activities must remain unchanged`);
    assert.strictEqual(candidate.replies, baseline.replies, `${label}: replies must remain unchanged`);
    assert.strictEqual(candidate.followedUserIds, baseline.followedUserIds, `${label}: Follow graph must remain unchanged`);
    assert.deepEqual(
      [candidate.scrollPosition, candidate.mentionsScrollPosition, candidate.messagesScrollPosition, candidate.suggestedUsersScrollPosition, candidate.followingScrollPosition, candidate.revealedTweetId],
      [baseline.scrollPosition, baseline.mentionsScrollPosition, baseline.messagesScrollPosition, baseline.suggestedUsersScrollPosition, baseline.followingScrollPosition, baseline.revealedTweetId],
      `${label}: scroll and revealed Timeline action state must remain unchanged`,
    );
  };
  const moreRootState = twitter.twitterStateTransition(rootNavigationBaseline, { type: "SHOW_TAB", tab: "more" });
  assert.deepEqual([moreRootState.activeTab, moreRootState.currentView], ["more", "more"], "C3a More tab must select the explicit More root");
  assertRootNavigationPreservesTwitterData(moreRootState, rootNavigationBaseline, "C3a More root");
  const moreProfileState = twitter.twitterStateTransition(moreRootState, { type: "OPEN_USER_PROFILE_BY_ID", profileId: "session-owner", originView: "more" });
  assert.deepEqual(
    [moreProfileState.activeTab, moreProfileState.currentView, moreProfileState.selectedUserId, moreProfileState.profileOriginView],
    ["more", "userProfile", "session-owner", "more"],
    "C3a More must open the existing session-owner Profile with More as its origin",
  );
  assertRootNavigationPreservesTwitterData(moreProfileState, moreRootState, "C3a More to My Profile");
  const moreProfileBackState = twitter.twitterStateTransition(moreProfileState, { type: "BACK_FROM_PROFILE" });
  assert.deepEqual(
    [moreProfileBackState.activeTab, moreProfileBackState.currentView, moreProfileBackState.selectedUserId, moreProfileBackState.profileOriginView],
    ["more", "more", null, null],
    "C3a Profile Back must restore More root and clear only transient Profile route state",
  );
  assertRootNavigationPreservesTwitterData(moreProfileBackState, moreProfileState, "C3a My Profile Back to More");
  const moreProfileToTimeline = twitter.twitterStateTransition(moreProfileState, { type: "SHOW_TAB", tab: "timeline" });
  assert.deepEqual(
    [moreProfileToTimeline.activeTab, moreProfileToTimeline.currentView, moreProfileToTimeline.selectedUserId, moreProfileToTimeline.profileOriginView],
    ["timeline", "timeline", null, null],
    "C3a More-origin Profile to Timeline tab must select Timeline root",
  );
  assertRootNavigationPreservesTwitterData(moreProfileToTimeline, moreProfileState, "C3a More Profile to Timeline root");
  const moreProfileToMentions = twitter.twitterStateTransition(moreProfileState, { type: "SHOW_TAB", tab: "mentions" });
  assert.deepEqual(
    [moreProfileToMentions.activeTab, moreProfileToMentions.currentView, moreProfileToMentions.selectedUserId, moreProfileToMentions.profileOriginView],
    ["mentions", "mentions", null, null],
    "C3a More-origin Profile to Mentions tab must select Mentions root",
  );
  assertRootNavigationPreservesTwitterData(moreProfileToMentions, moreProfileState, "C3a More Profile to Mentions root");
  const moreProfileFollowing = twitter.twitterStateTransition(moreProfileState, { type: "OPEN_FOLLOWING" });
  assert.deepEqual(
    [moreProfileFollowing.activeTab, moreProfileFollowing.currentView, moreProfileFollowing.selectedUserId, moreProfileFollowing.profileOriginView],
    ["more", "profileFollowing", "session-owner", "more"],
    "C2b-2 More-origin owner Profile must open a Profile-owned Following child without destroying Profile identity or origin",
  );
  assertRootNavigationPreservesTwitterData(moreProfileFollowing, moreProfileState, "C2b-2 More Profile to Following");
  const moreFollowingBack = twitter.twitterStateTransition(moreProfileFollowing, { type: "BACK_FROM_PROFILE_FOLLOWING" });
  assert.deepEqual(
    [moreFollowingBack.activeTab, moreFollowingBack.currentView, moreFollowingBack.selectedUserId, moreFollowingBack.profileOriginView],
    ["more", "userProfile", "session-owner", "more"],
    "C2b-2 Following Back must restore the same More-origin owner Profile",
  );
  const moreFollowingSecondBack = twitter.twitterStateTransition(moreFollowingBack, { type: "BACK_FROM_PROFILE" });
  assert.deepEqual(
    [moreFollowingSecondBack.activeTab, moreFollowingSecondBack.currentView, moreFollowingSecondBack.selectedUserId, moreFollowingSecondBack.profileOriginView],
    ["more", "more", null, null],
    "C2b-2 the second Back step must restore More root",
  );
  let searchProfileFollowing = twitter.twitterStateTransition(rootNavigationBaseline, { type: "SHOW_TAB", tab: "search" });
  searchProfileFollowing = twitter.twitterStateTransition(searchProfileFollowing, { type: "OPEN_USER_PROFILE_BY_ID", profileId: "session-owner", originView: "searchLanding" });
  searchProfileFollowing = twitter.twitterStateTransition(searchProfileFollowing, { type: "OPEN_FOLLOWING" });
  assert.deepEqual(
    [searchProfileFollowing.activeTab, searchProfileFollowing.currentView, searchProfileFollowing.selectedUserId, searchProfileFollowing.profileOriginView],
    ["search", "profileFollowing", "session-owner", "searchLanding"],
    "C2b-2 Search-origin owner Profile must retain Search as the Profile origin inside Following",
  );
  const searchFollowingBack = twitter.twitterStateTransition(searchProfileFollowing, { type: "BACK_FROM_PROFILE_FOLLOWING" });
  const searchFollowingSecondBack = twitter.twitterStateTransition(searchFollowingBack, { type: "BACK_FROM_PROFILE" });
  assert.deepEqual(
    [searchFollowingBack.currentView, searchFollowingBack.selectedUserId, searchFollowingBack.profileOriginView],
    ["userProfile", "session-owner", "searchLanding"],
    "C2b-2 Search-origin Following Back must restore the same owner Profile",
  );
  assert.deepEqual(
    [searchFollowingSecondBack.activeTab, searchFollowingSecondBack.currentView, searchFollowingSecondBack.selectedUserId, searchFollowingSecondBack.profileOriginView],
    ["search", "searchLanding", null, null],
    "C2b-2 the second Search-origin Back step must restore Search root",
  );
  let timelineProfileFollowing = twitter.twitterStateTransition(rootNavigationBaseline, { type: "OPEN_USER_PROFILE_BY_ID", profileId: "session-owner", originView: "timeline" });
  timelineProfileFollowing = twitter.twitterStateTransition(timelineProfileFollowing, { type: "OPEN_FOLLOWING" });
  const timelineFollowingBack = twitter.twitterStateTransition(timelineProfileFollowing, { type: "BACK_FROM_PROFILE_FOLLOWING" });
  assert.deepEqual(
    [timelineFollowingBack.activeTab, timelineFollowingBack.currentView, timelineFollowingBack.selectedUserId, timelineFollowingBack.profileOriginView],
    ["timeline", "userProfile", "session-owner", "timeline"],
    "C2b-2 Timeline-origin Following Back must restore the same owner Profile and Timeline origin",
  );
  const externalProfile = twitter.twitterStateTransition(rootNavigationBaseline, { type: "OPEN_USER_PROFILE_BY_ID", profileId: "june", originView: "timeline" });
  assert.strictEqual(
    twitter.twitterStateTransition(externalProfile, { type: "OPEN_FOLLOWING" }),
    externalProfile,
    "C2b-2 external Profile Following statistics must remain inert at the reducer boundary",
  );
  for (const [tab, rootView] of [["timeline", "timeline"], ["mentions", "mentions"], ["messages", "messagesList"], ["search", "searchLanding"], ["more", "more"]]) {
    const rootFromProfileFollowing = twitter.twitterStateTransition(moreProfileFollowing, { type: "SHOW_TAB", tab });
    assert.deepEqual(
      [rootFromProfileFollowing.activeTab, rootFromProfileFollowing.currentView, rootFromProfileFollowing.selectedUserId, rootFromProfileFollowing.profileOriginView],
      [tab, rootView, null, null],
      `C2b-2 Profile Following to ${tab} tab must select its strict root and clear Profile-child state`,
    );
    assertRootNavigationPreservesTwitterData(rootFromProfileFollowing, moreProfileFollowing, `C2b-2 Profile Following to ${tab} root`);
  }
  const truthfulFollowingIds = twitter.selectTwitterFollowingUsers(moreProfileFollowing, "Zoey").map(user => user.id);
  assert.deepEqual(truthfulFollowingIds, moreProfileFollowing.followedUserIds, "C2b-2 Following rows must map one-to-one to actual followedUserIds without fabricated identities");
  const c2bFollowAdded = twitter.twitterStateTransition(moreProfileFollowing, { type: "SET_FOLLOW", profileId: "june", following: true });
  assert.deepEqual(twitter.selectTwitterFollowingUsers(c2bFollowAdded, "Zoey").map(user => user.id), c2bFollowAdded.followedUserIds, "C2b-2 existing Follow must add exactly the truthful graph-backed row");
  const c2bFollowRemoved = twitter.twitterStateTransition(c2bFollowAdded, { type: "SET_FOLLOW", profileId: "june", following: false });
  assert.deepEqual(c2bFollowRemoved.followedUserIds, moreProfileFollowing.followedUserIds, "C2b-2 Unfollow must remove only the selected truthful row");
  const c2bReset = twitter.twitterStateTransition(c2bFollowAdded, { type: "RESET", displayName: "Alex" });
  assert.deepEqual(c2bReset.followedUserIds, twitter.createInitialTwitterState("Alex").followedUserIds, "C2b-2 RESET must restore the canonical owner Following graph");
  const moreRouteReset = twitter.twitterStateTransition(moreProfileState, { type: "RESET", displayName: "Alex" });
  assert.deepEqual(
    [moreRouteReset.activeTab, moreRouteReset.currentView, moreRouteReset.selectedUserId, moreRouteReset.profileOriginView],
    ["timeline", "timeline", null, null],
    "C3a RESET must restore the canonical Twitter root and clear the More-origin Profile route",
  );
  assert.deepEqual(moreRouteReset.mentions.map(item => [item.id, item.unread]), [["mention-alex-conan", true], ["mention-chris-thing", false]], "C3a RESET must restore canonical Mention state");
  assert.deepEqual(moreRouteReset.directMessages.map(item => [item.id, item.unread]), [["dm-katie", true], ["dm-matt", false]], "C3a RESET must restore canonical DM state");
  let profileRootOrigin = twitter.twitterStateTransition(rootNavigationBaseline, { type: "SHOW_TAB", tab: "search" });
  profileRootOrigin = twitter.twitterStateTransition(profileRootOrigin, { type: "OPEN_USER_PROFILE_BY_ID", profileId: "session-owner", originView: "searchLanding" });
  assert.deepEqual([profileRootOrigin.activeTab, profileRootOrigin.currentView, profileRootOrigin.selectedUserId, profileRootOrigin.profileOriginView], ["search", "userProfile", "session-owner", "searchLanding"]);
  const profileToTimelineRoot = twitter.twitterStateTransition(profileRootOrigin, { type: "SHOW_TAB", tab: "timeline" });
  assert.deepEqual([profileToTimelineRoot.activeTab, profileToTimelineRoot.currentView, profileToTimelineRoot.selectedUserId, profileToTimelineRoot.profileOriginView], ["timeline", "timeline", null, null], "My Profile to Timeline tab must select Timeline root and clear Profile route state");
  assertRootNavigationPreservesTwitterData(profileToTimelineRoot, profileRootOrigin, "Profile to Timeline");
  const profileToMentionsRoot = twitter.twitterStateTransition(profileRootOrigin, { type: "SHOW_TAB", tab: "mentions" });
  assert.deepEqual([profileToMentionsRoot.activeTab, profileToMentionsRoot.currentView, profileToMentionsRoot.selectedUserId, profileToMentionsRoot.profileOriginView], ["mentions", "mentions", null, null], "My Profile to Mentions tab must select Mentions root without stale Profile state");
  assertRootNavigationPreservesTwitterData(profileToMentionsRoot, profileRootOrigin, "Profile to Mentions");
  const profileToMessagesRoot = twitter.twitterStateTransition(profileRootOrigin, { type: "SHOW_TAB", tab: "messages" });
  assert.deepEqual([profileToMessagesRoot.activeTab, profileToMessagesRoot.currentView, profileToMessagesRoot.selectedUserId, profileToMessagesRoot.profileOriginView], ["messages", "messagesList", null, null], "My Profile to Messages tab must select Messages root without stale Profile state");
  assertRootNavigationPreservesTwitterData(profileToMessagesRoot, profileRootOrigin, "Profile to Messages");
  const profileToSearchRoot = twitter.twitterStateTransition(profileRootOrigin, { type: "SHOW_TAB", tab: "search" });
  assert.deepEqual([profileToSearchRoot.activeTab, profileToSearchRoot.currentView, profileToSearchRoot.selectedUserId, profileToSearchRoot.profileOriginView], ["search", "searchLanding", null, null], "My Profile to Search tab must select Search root without stale Profile state");
  assertRootNavigationPreservesTwitterData(profileToSearchRoot, profileRootOrigin, "Profile to Search");
  const profileToMoreRoot = twitter.twitterStateTransition(profileRootOrigin, { type: "SHOW_TAB", tab: "more" });
  assert.deepEqual([profileToMoreRoot.activeTab, profileToMoreRoot.currentView, profileToMoreRoot.selectedUserId, profileToMoreRoot.profileOriginView], ["more", "more", null, null], "My Profile to More tab must select the explicit More root without stale Profile state");
  assertRootNavigationPreservesTwitterData(profileToMoreRoot, profileRootOrigin, "Profile to More");
  const tweetDetailRootOrigin = twitter.twitterStateTransition(rootNavigationBaseline, { type: "OPEN_TWEET", tweetId: "still-awake", scrollPosition: 144 });
  const detailToTimelineRoot = twitter.twitterStateTransition(tweetDetailRootOrigin, { type: "SHOW_TAB", tab: "timeline" });
  assert.deepEqual([detailToTimelineRoot.activeTab, detailToTimelineRoot.currentView, detailToTimelineRoot.selectedTweetId], ["timeline", "timeline", null], "Tweet Detail to Timeline tab must select Timeline root");
  assertRootNavigationPreservesTwitterData(detailToTimelineRoot, tweetDetailRootOrigin, "Tweet Detail to Timeline");
  const detailToSearchRoot = twitter.twitterStateTransition(tweetDetailRootOrigin, { type: "SHOW_TAB", tab: "search" });
  assert.deepEqual([detailToSearchRoot.activeTab, detailToSearchRoot.currentView, detailToSearchRoot.selectedTweetId], ["search", "searchLanding", null], "Tweet Detail to Search tab must select Search root and clear Tweet selection");
  assertRootNavigationPreservesTwitterData(detailToSearchRoot, tweetDetailRootOrigin, "Tweet Detail to Search");
  let dmRootOrigin = twitter.twitterStateTransition(rootNavigationBaseline, { type: "SHOW_TAB", tab: "messages" });
  dmRootOrigin = twitter.twitterStateTransition(dmRootOrigin, { type: "OPEN_DIRECT_MESSAGE", threadId: "dm-katie", scrollPosition: 41 });
  const dmToTimelineRoot = twitter.twitterStateTransition(dmRootOrigin, { type: "SHOW_TAB", tab: "timeline" });
  assert.deepEqual([dmToTimelineRoot.activeTab, dmToTimelineRoot.currentView, dmToTimelineRoot.selectedDirectMessageId], ["timeline", "timeline", null], "DM Detail to Timeline tab must select Timeline root and clear DM selection");
  assertRootNavigationPreservesTwitterData(dmToTimelineRoot, dmRootOrigin, "DM Detail to Timeline");
  let suggestedRootOrigin = twitter.twitterStateTransition(rootNavigationBaseline, { type: "SHOW_TAB", tab: "search" });
  suggestedRootOrigin = twitter.twitterStateTransition(suggestedRootOrigin, { type: "OPEN_SUGGESTED_USERS" });
  const suggestedToMoreRoot = twitter.twitterStateTransition(suggestedRootOrigin, { type: "SHOW_TAB", tab: "more" });
  assert.deepEqual([suggestedToMoreRoot.activeTab, suggestedToMoreRoot.currentView], ["more", "more"], "Suggested Users to More tab must select More root");
  assertRootNavigationPreservesTwitterData(suggestedToMoreRoot, suggestedRootOrigin, "Suggested Users to More");
  let followingRootOrigin = twitter.twitterStateTransition(rootNavigationBaseline, { type: "SHOW_TAB", tab: "more" });
  followingRootOrigin = twitter.twitterStateTransition(followingRootOrigin, { type: "OPEN_USER_PROFILE_BY_ID", profileId: "session-owner", originView: "more" });
  followingRootOrigin = twitter.twitterStateTransition(followingRootOrigin, { type: "OPEN_FOLLOWING" });
  const followingToMoreRoot = twitter.twitterStateTransition(followingRootOrigin, { type: "SHOW_TAB", tab: "more" });
  assert.deepEqual([followingToMoreRoot.activeTab, followingToMoreRoot.currentView, followingToMoreRoot.selectedUserId, followingToMoreRoot.profileOriginView], ["more", "more", null, null], "Profile Following child to More tab must select More root and clear child state");
  assertRootNavigationPreservesTwitterData(followingToMoreRoot, followingRootOrigin, "Following to More");
  let programmaticComposerRoot = twitter.twitterStateTransition(tweetDetailRootOrigin, { type: "BEGIN_REPLY", tweetId: "still-awake" });
  programmaticComposerRoot = twitter.twitterStateTransition(programmaticComposerRoot, { type: "EDIT_REPLY", value: "@june draft" });
  programmaticComposerRoot = twitter.twitterStateTransition(programmaticComposerRoot, { type: "SHOW_TAB", tab: "mentions" });
  assert.deepEqual(
    [programmaticComposerRoot.activeTab, programmaticComposerRoot.currentView, programmaticComposerRoot.selectedTweetId, programmaticComposerRoot.composerKind, programmaticComposerRoot.replyComposerTweetId, programmaticComposerRoot.replyDraft],
    ["mentions", "mentions", null, null, null, ""],
    "programmatic root-tab navigation from Composer must normalize stale Composer and Tweet route state",
  );
  assertRootNavigationPreservesTwitterData(programmaticComposerRoot, tweetDetailRootOrigin, "Composer to Mentions root");
  const rootNavigationReset = twitter.twitterStateTransition(profileToMoreRoot, { type: "RESET", displayName: "Alex" });
  assert.deepEqual([rootNavigationReset.activeTab, rootNavigationReset.currentView, rootNavigationReset.selectedUserId, rootNavigationReset.selectedTweetId, rootNavigationReset.selectedDirectMessageId], ["timeline", "timeline", null, null, null], "RESET must retain the canonical Twitter navigation baseline");
  assert.deepEqual(rootNavigationReset.mentions.map(item => [item.id, item.unread]), [["mention-alex-conan", true], ["mention-chris-thing", false]], "RESET after root navigation must restore canonical Mention state");
  assert.equal(twitterState.mentions.length, 2);
  assert.deepEqual(twitterState.mentions.map(item => item.unread), [true, false]);
  assert.equal(twitterState.directMessages.length, 2);
  assert.deepEqual(twitterState.directMessages.map(item => item.unread), [true, false]);
  assert.deepEqual(twitterState.mentions.map(item => item.friendId), ["alex", "chris"]);
  assert.deepEqual(twitterState.directMessages.map(item => item.friendId), ["katie", "matt"]);
  assert.equal(twitterState.directMessages[0].friendId, facebookA.inboxThreads.find(thread => thread.sender === "Katie Dawson")?.friendId, "Katie must reuse one cross-app friend ID");
  assert.equal(twitter.selectTwitterMentionsUnreadCount(twitterState), 1);
  assert.equal(twitter.selectTwitterDirectMessagesUnreadCount(twitterState), 1);
  const timelineNames = new Set(twitterState.timeline.map(tweet => tweet.displayName.toLowerCase()));
  const mentionNames = twitterState.mentionTweets.map(tweet => tweet.displayName);
  assert.ok([...mentionNames, twitterState.directMessages.find(item => item.friendId === "katie")?.sender].filter(Boolean).every(name => !timelineNames.has(name.toLowerCase())), "Alex, Chris, and Katie social records must remain outside the seed Timeline");
  assert.ok(timelineNames.has("matt ricci"), "Matt's canonical identity may span DM and Timeline for the party fragment");
  assert.equal(new Set([...mentionNames, ...twitterState.directMessages.map(item => item.sender)]).size, 4);
  assert.ok(twitterState.followedUserIds.includes("alex"), "Alex must be followed in the designed baseline graph");
  assert.equal(twitterState.followedUserIds.includes("chris"), false, "Chris must remain initially unfollowed");
  const homeActivities = twitter.selectTwitterTimelineActivities(twitterState);
  const alexMentionTweet = twitterState.mentionTweets.find(tweet => tweet.displayName === "Alex Wong");
  const chrisMentionTweet = twitterState.mentionTweets.find(tweet => tweet.displayName === "Chris Morgan");
  assert.ok(alexMentionTweet && homeActivities.some(activity => activity.tweet === alexMentionTweet), "Home Timeline must reference the same Alex Tweet object used by Mentions");
  assert.ok(chrisMentionTweet && !homeActivities.some(activity => activity.tweet.id === chrisMentionTweet.id), "Chris @reply must remain absent from Home Timeline");
  assert.deepEqual(twitterState.linkedTweets.map(tweet => [tweet.displayName, tweet.text, tweet.contentStatus]), [["Conan O'Brien", "Saw Jackass 3D. Not as good as the book.", "PERIOD-EVIDENCE"]]);
  const canonicalMentionIds = twitterState.mentions.map(item => item.id);
  const canonicalMentionTweetIds = twitterState.mentionTweets.map(tweet => tweet.id);
  const canonicalLinkedTweetIds = twitterState.linkedTweets.map(tweet => tweet.id);
  let mentionState = twitter.twitterStateTransition(twitterState, { type: "SHOW_TAB", tab: "mentions" });
  assert.equal(twitter.selectTwitterMentionsUnreadCount(mentionState), 1, "opening Mentions tab alone must not clear unread state");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "OPEN_MENTION", mentionId: "mention-alex-conan", scrollPosition: 73 });
  assert.equal(mentionState.mentions.find(item => item.id === "mention-alex-conan").unread, false);
  assert.equal(twitter.selectTwitterMentionsUnreadCount(mentionState), 0, "reading the final unread Mention must clear its derived indicator count");
  assert.deepEqual([mentionState.currentView, mentionState.selectedTweetId, mentionState.mentionsScrollPosition], ["tweetDetail", "tweet-mention-alex-conan", 73]);
  assert.ok(twitter.selectTwitterTimelineActivities(mentionState).some(activity => activity.tweet.id === "tweet-mention-alex-conan"), "reading Mention state must not remove Alex from Timeline");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "TOGGLE_FAVORITE", tweetId: "tweet-mention-alex-conan" });
  assert.ok(mentionState.favoriteTweetIds.includes("tweet-mention-alex-conan"), "Favorite must be shared by Mentions and Timeline through the Tweet ID");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "TOGGLE_RETWEET", tweetId: "tweet-mention-alex-conan", retweetedBy: "Zoey", retweetActionTimestamp: 100 });
  assert.ok(mentionState.retweetedTweetIds.includes("tweet-mention-alex-conan"), "Retweet must be shared by Mentions and Timeline through the Tweet ID");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "OPEN_LINKED_TWEET", tweetId: "historical-conan-jackass-3d", origin: "mentions" });
  assert.deepEqual([mentionState.activeTab, mentionState.currentView, mentionState.selectedTweetId, mentionState.tweetDetailOrigin], ["mentions", "tweetDetail", "historical-conan-jackass-3d", "mentions"], "Alex's historical linked Tweet must retain its Mentions origin");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "BEGIN_REPLY", tweetId: "historical-conan-jackass-3d" });
  assert.deepEqual([mentionState.activeTab, mentionState.currentView, mentionState.replyComposerTweetId], ["mentions", "composer", "historical-conan-jackass-3d"], "Reply from a Mention-linked Tweet must keep Mentions active while opening Composer");
  assert.deepEqual(mentionState.mentions.map(item => item.id), canonicalMentionIds, "opening Mention Reply must retain Alex and Chris in canonical order");
  assert.deepEqual(mentionState.mentionTweets.map(tweet => tweet.id), canonicalMentionTweetIds, "opening Mention Reply must retain both canonical Mention Tweet records");
  assert.deepEqual(mentionState.linkedTweets.map(tweet => tweet.id), canonicalLinkedTweetIds, "opening Mention Reply must retain the linked historical Tweet");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "CANCEL_REPLY" });
  assert.deepEqual([mentionState.activeTab, mentionState.currentView, mentionState.selectedTweetId, mentionState.tweetDetailOrigin], ["mentions", "tweetDetail", "historical-conan-jackass-3d", "mentions"], "Cancel Reply must restore the linked Tweet Detail and its Mentions origin");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "BACK_TO_TIMELINE" });
  assert.deepEqual([mentionState.activeTab, mentionState.currentView, mentionState.mentionsScrollPosition], ["mentions", "mentions", 73], "linked Tweet Back must restore Mentions origin and scroll");
  assert.deepEqual(mentionState.mentions.map(item => [item.id, item.unread]), [["mention-alex-conan", false], ["mention-chris-thing", false]], "Mention Reply return must preserve order and change only Alex's expected read state");
  assert.deepEqual(mentionState.mentionTweets.map(tweet => tweet.id), canonicalMentionTweetIds, "Mention Reply return must retain both Mention Tweet records");
  assert.deepEqual(mentionState.linkedTweets.map(tweet => tweet.id), canonicalLinkedTweetIds, "Mention Reply return must retain the linked historical Tweet");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "SHOW_TAB", tab: "timeline" });
  mentionState = twitter.twitterStateTransition(mentionState, { type: "SHOW_TAB", tab: "mentions" });
  assert.deepEqual([mentionState.activeTab, mentionState.currentView, mentionState.mentions.map(item => item.id)], ["mentions", "mentions", canonicalMentionIds], "Timeline to Mentions switching must retain both Mention records after Reply return");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "SHOW_TAB", tab: "search" });
  mentionState = twitter.twitterStateTransition(mentionState, { type: "SHOW_TAB", tab: "mentions" });
  assert.deepEqual([mentionState.activeTab, mentionState.currentView, mentionState.mentions.map(item => item.id), mentionState.mentions.map(item => item.unread)], ["mentions", "mentions", canonicalMentionIds, [false, false]], "B3 Timeline to Mentions to Search to Mentions navigation must preserve Mention order and read state");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "OPEN_MENTION", mentionId: "mention-chris-thing", scrollPosition: 0 });
  assert.deepEqual(mentionState.mentions.map(item => item.id), canonicalMentionIds, "opening Chris must not clear Alex or change Mention order");
  mentionState = twitter.twitterStateTransition(mentionState, { type: "BACK_TO_TIMELINE" });
  assert.deepEqual([mentionState.activeTab, mentionState.currentView], ["mentions", "mentions"], "Chris Back must restore Mentions through the same origin model");
  const mentionStateBeforeRuntimeSuspend = mentionState;
  let twitterAppRuntime = appRuntime.appRuntimeStateTransition(appRuntime.initialAppRuntimeState, { type: "LAUNCH", appId: "twitter" });
  twitterAppRuntime = appRuntime.appRuntimeStateTransition(twitterAppRuntime, { type: "ANIMATION_COMPLETE" });
  twitterAppRuntime = appRuntime.appRuntimeStateTransition(twitterAppRuntime, { type: "SUSPEND" });
  twitterAppRuntime = appRuntime.appRuntimeStateTransition(twitterAppRuntime, { type: "RESUME", appId: "twitter" });
  twitterAppRuntime = appRuntime.appRuntimeStateTransition(twitterAppRuntime, { type: "ANIMATION_COMPLETE" });
  assert.deepEqual([twitterAppRuntime.phase, twitterAppRuntime.activeAppId], ["running", "twitter"], "Twitter must complete the ordinary suspend/resume lifecycle");
  assert.strictEqual(mentionState, mentionStateBeforeRuntimeSuspend, "App Runtime suspend/resume must not replace or reset Twitter state");
  assert.deepEqual(mentionState.mentions.map(item => item.id), canonicalMentionIds, "Twitter suspend/resume must retain both Mention records");
  const mentionReset = twitter.twitterStateTransition(mentionState, { type: "RESET", displayName: "Alex" });
  assert.deepEqual(mentionReset.mentions.map(item => [item.id, item.unread]), [["mention-alex-conan", true], ["mention-chris-thing", false]], "RESET must restore the canonical Mention baseline and unread state");
  assert.deepEqual(mentionReset.mentionTweets.map(tweet => tweet.id), canonicalMentionTweetIds, "RESET must restore the canonical Mention Tweet records");
  let timelineReplyState = twitter.twitterStateTransition(twitter.createInitialTwitterState("Zoey"), { type: "OPEN_TWEET", tweetId: "still-awake", scrollPosition: 64 });
  timelineReplyState = twitter.twitterStateTransition(timelineReplyState, { type: "BEGIN_REPLY", tweetId: "still-awake" });
  assert.deepEqual([timelineReplyState.activeTab, timelineReplyState.currentView], ["timeline", "composer"], "Timeline Reply must continue to open Composer from Timeline");
  timelineReplyState = twitter.twitterStateTransition(timelineReplyState, { type: "CANCEL_REPLY" });
  assert.deepEqual([timelineReplyState.activeTab, timelineReplyState.currentView, timelineReplyState.selectedTweetId], ["timeline", "tweetDetail", "still-awake"], "canceling a Timeline Reply must restore its Tweet Detail");
  timelineReplyState = twitter.twitterStateTransition(timelineReplyState, { type: "BACK_TO_TIMELINE" });
  assert.deepEqual([timelineReplyState.activeTab, timelineReplyState.currentView, timelineReplyState.selectedTweetId], ["timeline", "timeline", null], "Timeline-origin Reply must return to Timeline after Cancel and Back");
  let dmState = twitter.twitterStateTransition(twitterState, { type: "SHOW_TAB", tab: "messages" });
  assert.equal(twitter.selectTwitterDirectMessagesUnreadCount(dmState), 1, "opening Messages tab alone must not clear unread state");
  dmState = twitter.twitterStateTransition(dmState, { type: "OPEN_DIRECT_MESSAGE", threadId: "dm-katie", scrollPosition: 41 });
  assert.equal(dmState.directMessages.find(thread => thread.id === "dm-katie").unread, false);
  assert.equal(twitter.selectTwitterDirectMessagesUnreadCount(dmState), 0, "reading the final unread DM must clear its derived indicator count");
  dmState = twitter.twitterStateTransition(dmState, { type: "OPEN_LINKED_TWEET", tweetId: "historical-conan-jackass-3d", origin: "dmThread" });
  dmState = twitter.twitterStateTransition(dmState, { type: "BACK_TO_TIMELINE" });
  assert.deepEqual([dmState.activeTab, dmState.currentView, dmState.selectedDirectMessageId], ["messages", "dmThread", "dm-katie"]);
  dmState = twitter.twitterStateTransition(dmState, { type: "BACK_TO_MESSAGES" });
  assert.deepEqual([dmState.currentView, dmState.messagesScrollPosition], ["messagesList", 41]);
  const canonicalDirectMessageSummary = [
    ["dm-katie", "Katie Dawson", "11:46 PM", "crazy ahaha", true],
    ["dm-matt", "Matt Ricci", "10:21 PM", "see you tomorrow", false],
  ];
  const summarizeDirectMessages = state => state.directMessages.map(thread => [thread.id, thread.sender, thread.timestamp, thread.messages.at(-1)?.text, thread.unread]);
  let b4MessagesState = twitter.twitterStateTransition(twitter.createInitialTwitterState("Zoey"), { type: "SHOW_TAB", tab: "messages" });
  assert.deepEqual(summarizeDirectMessages(b4MessagesState), canonicalDirectMessageSummary, "B4a Messages must begin in canonical Katie/Matt order with locked copy, timestamps, and unread state");
  assert.equal(twitter.selectTwitterDirectMessagesUnreadCount(b4MessagesState), 1, "B4a Messages tab indicator must derive from the one initial unread thread");
  b4MessagesState = twitter.twitterStateTransition(b4MessagesState, { type: "OPEN_DIRECT_MESSAGE", threadId: "dm-katie", scrollPosition: 41 });
  assert.deepEqual(summarizeDirectMessages(b4MessagesState), canonicalDirectMessageSummary.map(summary => summary[0] === "dm-katie" ? [...summary.slice(0, 4), false] : summary), "opening Katie must mark only Katie read without changing either DM record or its order");
  assert.equal(twitter.selectTwitterDirectMessagesUnreadCount(b4MessagesState), 0, "reading Katie must clear the state-driven Messages tab indicator");
  b4MessagesState = twitter.twitterStateTransition(b4MessagesState, { type: "BACK_TO_MESSAGES" });
  assert.deepEqual([b4MessagesState.activeTab, b4MessagesState.currentView, b4MessagesState.messagesScrollPosition], ["messages", "messagesList", 41], "Back from Katie must retain the Messages root and saved scroll position");
  assert.deepEqual(b4MessagesState.directMessages.map(thread => [thread.sender, thread.unread]), [["Katie Dawson", false], ["Matt Ricci", false]], "Back must retain both rows in order and render each as read");
  b4MessagesState = twitter.twitterStateTransition(b4MessagesState, { type: "OPEN_DIRECT_MESSAGE", threadId: "dm-matt", scrollPosition: 23 });
  assert.deepEqual(b4MessagesState.directMessages.map(thread => [thread.sender, thread.unread]), [["Katie Dawson", false], ["Matt Ricci", false]], "opening Matt must not change either read state");
  b4MessagesState = twitter.twitterStateTransition(b4MessagesState, { type: "SHOW_TAB", tab: "timeline" });
  b4MessagesState = twitter.twitterStateTransition(b4MessagesState, { type: "SHOW_TAB", tab: "messages" });
  b4MessagesState = twitter.twitterStateTransition(b4MessagesState, { type: "SHOW_TAB", tab: "search" });
  b4MessagesState = twitter.twitterStateTransition(b4MessagesState, { type: "SHOW_TAB", tab: "messages" });
  assert.deepEqual(b4MessagesState.directMessages.map(thread => [thread.sender, thread.unread]), [["Katie Dawson", false], ["Matt Ricci", false]], "Timeline, Messages, Search, and Messages root navigation must preserve DM records and read state");
  const b4MessagesBeforeSuspend = b4MessagesState;
  twitterAppRuntime = appRuntime.appRuntimeStateTransition(twitterAppRuntime, { type: "SUSPEND" });
  twitterAppRuntime = appRuntime.appRuntimeStateTransition(twitterAppRuntime, { type: "RESUME", appId: "twitter" });
  twitterAppRuntime = appRuntime.appRuntimeStateTransition(twitterAppRuntime, { type: "ANIMATION_COMPLETE" });
  assert.strictEqual(b4MessagesState, b4MessagesBeforeSuspend, "ordinary Twitter suspend/resume must preserve B4a DM records and read state");
  const b4MessagesReset = twitter.twitterStateTransition(b4MessagesState, { type: "RESET", displayName: "Alex" });
  assert.deepEqual(summarizeDirectMessages(b4MessagesReset), canonicalDirectMessageSummary, "RESET must restore the canonical Katie unread and Matt read Messages baseline");
  const socialReset = twitter.twitterStateTransition(dmState, { type: "RESET", displayName: "Alex" });
  assert.deepEqual(socialReset.mentions.map(item => item.unread), [true, false]);
  assert.deepEqual(socialReset.directMessages.map(item => item.unread), [true, false]);
  assert.deepEqual([twitter.selectTwitterMentionsUnreadCount(socialReset), twitter.selectTwitterDirectMessagesUnreadCount(socialReset)], [1, 1], "new session must restore both unread indicators from seed records");
  const multipleUnreadMentions = { ...twitterState, mentions: twitterState.mentions.map(item => ({ ...item, unread: true })) };
  const oneMentionRead = twitter.twitterStateTransition(multipleUnreadMentions, { type: "OPEN_MENTION", mentionId: "mention-chris-thing", scrollPosition: 0 });
  assert.equal(twitter.selectTwitterMentionsUnreadCount(oneMentionRead), 1, "reading one item must leave the indicator while another Mention remains unread");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "SET_SCROLL_POSITION", scrollPosition: 64 });
  for (const tab of ["mentions", "messages", "search", "more"]) {
    twitterState = twitter.twitterStateTransition(twitterState, { type: "SHOW_TAB", tab });
    assert.equal(twitterState.activeTab, tab);
    assert.equal(twitterState.scrollPosition, 64, "secondary tab shells must not reset Timeline scroll");
  }
  twitterState = twitter.twitterStateTransition(twitterState, { type: "SHOW_TAB", tab: "timeline" });
  twitterState = twitter.twitterStateTransition(twitterState, { type: "TOGGLE_TWEET_ACTIONS", tweetId: "still-awake" });
  assert.equal(twitterState.revealedTweetId, "still-awake", "timeline swipe state must reveal one tweet action pane");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "SHOW_TAB", tab: "mentions" });
  twitterState = twitter.twitterStateTransition(twitterState, { type: "SHOW_TAB", tab: "timeline" });
  assert.equal(twitterState.revealedTweetId, "still-awake", "tweet action state must survive tab switching");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "TOGGLE_TWEET_ACTIONS", tweetId: "still-awake" });
  assert.equal(twitterState.revealedTweetId, null);
  twitterState = twitter.twitterStateTransition(twitterState, { type: "BEGIN_NEW_TWEET" });
  assert.equal(twitterState.currentView, "composer");
  assert.equal(twitterState.composerKind, "new");
  assert.equal(twitterState.newTweetDraft, "", "Timeline Compose must open a blank New Tweet draft");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "EDIT_COMPOSER", value: "draft from top compose" });
  assert.equal(twitterState.newTweetDraft, "draft from top compose");
  assert.equal(twitterState.replyDraft, "", "new Tweet and Reply drafts must remain independent");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "CANCEL_REPLY" });
  assert.equal(twitterState.currentView, "timeline");
  assert.equal(twitterState.composerKind, null);
  assert.equal(twitterState.newTweetDraft, "");

  let userTweetState = twitter.twitterStateTransition(twitter.createInitialTwitterState("Zoey"), { type: "BEGIN_NEW_TWEET" });
  userTweetState = twitter.twitterStateTransition(userTweetState, { type: "EDIT_COMPOSER", value: "x".repeat(141) });
  assert.equal(userTweetState.newTweetDraft.length, 140, "New Tweets must enforce the 140-character limit in state");
  userTweetState = twitter.twitterStateTransition(userTweetState, { type: "EDIT_COMPOSER", value: "still up" });
  userTweetState = twitter.twitterStateTransition(userTweetState, {
    type: "SUBMIT_NEW_TWEET",
    displayName: "Zoey",
    createdAt: Date.parse("2010-10-20T00:07:15-07:00"),
    timestamp: "12:07 AM",
  });
  const userTweet = userTweetState.timeline.find(tweet => tweet.id === "twitter-user-tweet-1");
  assert.deepEqual(userTweet, {
    id: "twitter-user-tweet-1",
    displayName: "Zoey",
    authorHandle: "@zoey",
    text: "still up",
    timestamp: "12:07 AM",
    createdAt: Date.parse("2010-10-20T00:07:15-07:00"),
    type: "tweet",
    contentStatus: "USER",
    origin: "user",
  });
  assert.equal(userTweetState.timeline[0].id, "twitter-user-tweet-1", "successful Compose must return the user Tweet at the current top");
  const afterDuplicateSubmit = twitter.twitterStateTransition(userTweetState, {
    type: "SUBMIT_NEW_TWEET",
    displayName: "Zoey",
    createdAt: Date.parse("2010-10-20T00:07:16-07:00"),
    timestamp: "12:07 AM",
  });
  assert.strictEqual(afterDuplicateSubmit, userTweetState, "a completed composer must not publish twice");
  userTweetState = twitter.twitterStateTransition(userTweetState, {
    type: "DELIVER_TIMELINE_TWEET",
    tweet: { id: "later-live", displayName: "Mia", text: "later", timestamp: "12:08 AM" },
  });
  assert.equal(userTweetState.timeline[0].id, "later-live", "a later live Tweet must sort above an earlier user Tweet");
  assert.equal(userTweetState.scrollPosition, 0);
  userTweetState = twitter.twitterStateTransition(userTweetState, {
    type: "TOGGLE_RETWEET",
    tweetId: "still-awake",
    retweetedBy: "Zoey",
    retweetActionTimestamp: Date.parse("2010-10-20T00:09:00-07:00"),
  });
  assert.deepEqual(
    twitter.selectTwitterTimelineActivities(userTweetState).slice(0, 3).map(activity => activity.id),
    ["user-retweet:still-awake", "later-live", "twitter-user-tweet-1"],
    "seed/live/user/native-Retweet activity must share one effective-time ordering",
  );
  const selfRetweetState = twitter.twitterStateTransition(userTweetState, {
    type: "TOGGLE_RETWEET",
    tweetId: "twitter-user-tweet-1",
    retweetedBy: "Zoey",
    retweetActionTimestamp: Date.parse("2010-10-20T00:10:00-07:00"),
  });
  assert.strictEqual(selfRetweetState, userTweetState, "self-Retweet remains disabled/HOLD");
  const userTweetReset = twitter.twitterStateTransition(userTweetState, { type: "RESET", displayName: "Alex" });
  assert.equal(userTweetReset.timeline.some(tweet => tweet.origin === "user"), false, "new session must remove user-authored Tweets");
  assert.equal(userTweetReset.timeline.find(tweet => tweet.id === "late-night-matt")?.displayName, "Matt Ricci", "session reset must preserve canonical ownership of Matt's seed Tweet");
  assert.equal(userTweetReset.timeline.some(tweet => tweet.id === "late-night-user" || tweet.displayName === "session-owner"), false, "Twitter seed must not contain pre-authored session-owner content");
  const scheduledTwitterPosts = timelineDefinitions
    .filter(event => event.payload?.kind === "twitter-post")
    .map(event => event.payload.post);
  assert.equal(scheduledTwitterPosts.length, 8, "Twitter must be the most active social app with eight live additions");
  const liveCountsBySocialApp = timelineDefinitions
    .filter(event => event.sourceApp !== "messages")
    .reduce((counts, event) => ({ ...counts, [event.sourceApp]: (counts[event.sourceApp] ?? 0) + 1 }), {});
  assert.equal(liveCountsBySocialApp.twitter, 8, "Twitter live volume must remain unchanged");
  assert.equal(liveCountsBySocialApp.facebook, 9, "Facebook includes the intentional T+135 standalone friend-of-friend gossip event and two late Sophie comments");
  assert.ok(Object.entries(liveCountsBySocialApp).every(([app, count]) => app === "twitter" || app === "facebook" || count < liveCountsBySocialApp.twitter), "Facebook has nine and Twitter six live events while every other social app remains sparser");
  const evaEvent = timelineDefinitions.find(event => event.id === "twitter-eva-school-tomorrow");
  assert.equal(evaEvent?.atElapsedSeconds, 300);
  assert.deepEqual(evaEvent?.payload?.kind === "twitter-post" ? evaEvent.payload.post : null, {
    id: "eva-school-tomorrow",
    displayName: "Eva",
    text: "ugh I really don't want to go to school tomorrow",
    timestamp: "12:07 AM",
  });
  const epicFailEvent = timelineDefinitions.find(event => event.id === "twitter-slang-epic-fail");
  const fmlEvent = timelineDefinitions.find(event => event.id === "twitter-slang-fml");
  const terminalTweetEvent = timelineDefinitions.find(event => event.id === "twitter-terminal-goodnight-world");
  assert.deepEqual(
    [epicFailEvent?.atElapsedSeconds, epicFailEvent?.payload?.kind === "twitter-post" ? epicFailEvent.payload.post.timestamp : null, epicFailEvent?.languageReference],
    [75, "12:03 AM", "PERIOD-EVIDENCE"],
  );
  assert.deepEqual(
    [fmlEvent?.atElapsedSeconds, fmlEvent?.payload?.kind === "twitter-post" ? fmlEvent.payload.post.timestamp : null, fmlEvent?.languageReference],
    [540, "12:11 AM", "PERIOD-EVIDENCE"],
  );
  assert.deepEqual(
    [terminalTweetEvent?.atElapsedSeconds, terminalTweetEvent?.payload?.kind === "twitter-post" ? terminalTweetEvent.payload.post.text : null, terminalTweetEvent?.payload?.kind === "twitter-post" ? terminalTweetEvent.payload.post.timestamp : null, terminalTweetEvent?.role],
    [890, "goodnight, world.", "12:16 AM", "terminal-easter-egg"],
  );
  assert.ok(terminalTweetEvent.atElapsedSeconds * 1_000 < deviceMachine.SESSION_DURATION_MS, "terminal Tweet must be due before the T+900s battery boundary");
  assert.equal(deviceMachine.SESSION_DURATION_MS, 900_000, "battery terminal must remain T+900s");
  const activeDeviceSession = {
    ...deviceMachine.initialSession,
    experienceSessionId: deviceMachine.createExperienceSessionId(),
    phase: "app",
    sessionStartEpochMs: 1_000,
  };
  const sleepTransition = deviceMachine.shortPowerTransition(activeDeviceSession);
  assert.deepEqual(sleepTransition, { phase: "sleeping" }, "ordinary power sleep must enter the display-off sleeping phase");
  const sleepingDeviceSession = { ...activeDeviceSession, ...sleepTransition };
  assert.deepEqual(deviceMachine.homeButtonTransition(sleepingDeviceSession), { phase: "locked" }, "Home wake from sleep must reveal Lock Screen");
  assert.deepEqual(deviceMachine.shortPowerTransition(sleepingDeviceSession), { phase: "locked" }, "Power wake from sleep must reveal Lock Screen");
  assert.equal(sleepingDeviceSession.sessionStartEpochMs, activeDeviceSession.sessionStartEpochMs, "ordinary sleep must preserve the current session");
  assert.equal(sleepingDeviceSession.experienceSessionId, activeDeviceSession.experienceSessionId, "ordinary lock/sleep and resume transitions must preserve Camera Roll ownership");
  assert.equal(deviceMachine.elapsedMs(sleepingDeviceSession, 61_000), 60_000, "session clock must continue while the display sleeps");
  assert.equal(deviceMachine.hasReachedSessionTerminal(sleepingDeviceSession, 900_999), false, "ordinary sleep must not trigger terminal shutdown early");
  assert.equal(deviceMachine.hasReachedSessionTerminal(sleepingDeviceSession, 901_000), true, "T+900 terminal shutdown must remain independent from ordinary sleep");
  assert.equal(deviceMachine.initialSession.experienceSessionId, null, "Hero must not own a prior player's Camera Roll namespace");
  const experienceSessionA = deviceMachine.createExperienceSessionId();
  const experienceSessionB = deviceMachine.createExperienceSessionId();
  assert.notEqual(experienceSessionA, experienceSessionB, "each valid new-player activation must receive a distinct opaque experience ID");
  assert.equal(deviceMachine.resolveExperienceSessionId(experienceSessionA, true), experienceSessionA, "reload and ordinary resume must preserve the active canonical experience ID");
  assert.equal(deviceMachine.resolveExperienceSessionId(undefined, false), null, "Hero and terminal session state must not manufacture an experience ID");
  const migratedLegacyExperience = deviceMachine.resolveExperienceSessionId(undefined, true);
  assert.ok(migratedLegacyExperience && migratedLegacyExperience !== experienceSessionA, "a legacy active narrative session must receive one new opaque ID rather than inheriting browser-global media");
  assert.equal(cameraRollPersistence.CAMERA_ROLL_DATABASE_VERSION, 2, "Camera Roll ownership requires IndexedDB v2");
  assert.notEqual(cameraRollPersistence.cameraRollRecordId(experienceSessionA, 1), cameraRollPersistence.cameraRollRecordId(experienceSessionB, 1), "two experiences may allocate IMG_0001 without durable ID collision");
  assert.equal(cameraRollPersistence.cameraRollFilename(1), "IMG_0001.JPG", "each experience filename namespace must begin at IMG_0001.JPG");
  assert.notEqual(cameraRollPersistence.cameraRollSequenceMetadataKey(experienceSessionA), cameraRollPersistence.cameraRollSequenceMetadataKey(experienceSessionB), "capture sequence metadata must be owner-scoped");
  assert.equal(cameraRollPersistence.resolveNextCameraRollSequence([], undefined), 1, "a new experience must begin at IMG_0001");
  assert.equal(cameraRollPersistence.resolveNextCameraRollSequence([{ captureSequence: 1 }, { captureSequence: 2 }], 3), 3, "the loaded page must continue its owner-scoped sequence");
  assert.equal(cameraRollPersistence.resolveNextCameraRollSequence([], 1), 1, "another experience must not participate in the current owner's sequence");
  const ownershipFixture = { origin: "player-camera", experienceSessionId: experienceSessionA };
  assert.equal(cameraRollPersistence.isCameraRollRecordOwnedByExperience(ownershipFixture, experienceSessionA), true, "the active owner may resolve its own Camera Roll record");
  assert.equal(cameraRollPersistence.isCameraRollRecordOwnedByExperience(ownershipFixture, experienceSessionB), false, "Camera Roll queries must reject another experience's records");
  assert.equal(cameraRollPersistence.isCameraCaptureOwnerCurrent(experienceSessionA, experienceSessionB), false, "a stale capture must not cross the owner boundary");
  assert.equal(cameraRollPersistence.isCameraCaptureOwnerCurrent(experienceSessionB, experienceSessionB), true, "a capture may commit only while its shutter-time owner remains active");
  assert.ok(timelineDefinitions.filter(event => event.atElapsedSeconds <= 720).some(event => event.id === "twitter-slang-epic-fail"));
  assert.ok(timelineDefinitions.filter(event => event.atElapsedSeconds <= 720).some(event => event.id === "twitter-slang-fml"), "both slang events must be catch-up eligible by 12:14 AM");
  assert.ok(timelineDefinitions.filter(event => event.sourceApp === "twitter").every(event => event.deliveryPolicy === "internal"));
  assert.equal([...twitterState.timeline, ...scheduledTwitterPosts].filter(tweet => /Apple/i.test(tweet.text)).length, 2, "Twitter retains Sam and the approved Matt Apple-event references");
  assert.ok(scheduledTwitterPosts.every(post => !twitterState.timeline.some(tweet => tweet.id === post.id)), "no live Twitter post may exist in seed");
  assert.equal(twitterState.timeline.some(tweet => scheduledTwitterPosts.some(post => post.id === tweet.id)), false, "live Twitter content must not be seeded");
  let retweetOrderState = twitter.twitterStateTransition(twitter.createInitialTwitterState("Zoey"), {
    type: "TOGGLE_RETWEET",
    tweetId: "still-awake",
    retweetedBy: "Zoey",
    retweetActionTimestamp: 100,
  });
  retweetOrderState = twitter.twitterStateTransition(retweetOrderState, {
    type: "TOGGLE_RETWEET",
    tweetId: "class-tomorrow",
    retweetedBy: "Zoey",
    retweetActionTimestamp: 200,
  });
  assert.deepEqual(
    retweetOrderState.retweetActivities.map(activity => activity.id),
    ["user-retweet:class-tomorrow", "user-retweet:still-awake"],
    "new current-user Retweet activities must prepend in action order",
  );
  retweetOrderState = twitter.twitterStateTransition(retweetOrderState, {
    type: "TOGGLE_RETWEET",
    tweetId: "class-tomorrow",
    retweetedBy: "Zoey",
    retweetActionTimestamp: 300,
  });
  assert.deepEqual(retweetOrderState.retweetActivities.map(activity => activity.id), ["user-retweet:still-awake"], "unretweet must preserve unrelated Retweet activity");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "OPEN_TWEET", tweetId: "still-awake", scrollPosition: 144 });
  twitterState = twitter.twitterStateTransition(twitterState, { type: "SHOW_TAB", tab: "messages" });
  assert.equal(twitterState.currentView, "messagesList");
  assert.equal(twitterState.selectedTweetId, null, "root-tab navigation must clear the selected Tweet route");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "SHOW_TAB", tab: "timeline" });
  twitterState = twitter.twitterStateTransition(twitterState, { type: "BEGIN_REPLY", tweetId: "still-awake" });
  assert.equal(twitterState.currentView, "composer");
  assert.equal(twitterState.composerKind, "reply");
  assert.equal(twitterState.replyDraft, "@june ", "Reply composer must prefill the target username approximation");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "EDIT_REPLY", value: "x".repeat(141) });
  assert.equal(twitterState.replyDraft.length, 140, "Twitter replies must enforce the 140-character limit in state");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "CANCEL_REPLY" });
  assert.equal(twitterState.replyComposerTweetId, null);
  assert.equal(twitterState.replyDraft, "");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "BEGIN_REPLY", tweetId: "still-awake" });
  twitterState = twitter.twitterStateTransition(twitterState, { type: "EDIT_REPLY", value: "still here" });
  twitterState = twitter.twitterStateTransition(twitterState, { type: "BACK_TO_TIMELINE" });
  assert.equal(twitterState.replyDraft, "still here", "reply draft must survive navigation and suspension-equivalent retained state");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "SUBMIT_REPLY", displayName: "Zoey" });
  assert.deepEqual(twitterState.replies, [...seed.twitterReplies, { id: "twitter-reply-2", targetTweetId: "still-awake", displayName: "Zoey", text: "still here" }]);
  twitterState = twitter.twitterStateTransition(twitterState, {
    type: "TOGGLE_RETWEET",
    tweetId: "still-awake",
    retweetedBy: "Zoey",
    retweetActionTimestamp: 1_287_552_360_000,
  });
  twitterState = twitter.twitterStateTransition(twitterState, { type: "TOGGLE_FAVORITE", tweetId: "still-awake" });
  assert.deepEqual(twitterState.retweetedTweetIds, ["still-awake"]);
  assert.deepEqual(twitterState.retweetActivities, [{
    id: "user-retweet:still-awake",
    sourceTweetId: "still-awake",
    retweetedBy: "Zoey",
    originalTweetTimestamp: "11:58 PM",
    retweetActionTimestamp: 1_287_552_360_000,
  }], "current-user Retweet must create one stable timeline activity without rewriting the source tweet");
  assert.equal(twitterState.timeline.find(tweet => tweet.id === "still-awake")?.displayName, "June");
  assert.equal(twitterState.timeline.find(tweet => tweet.id === "still-awake")?.timestamp, "11:58 PM");
  assert.deepEqual(twitterState.favoriteTweetIds, ["still-awake"]);
  assert.equal(twitterState.replies.length, 2, "Reply, Retweet, and Favorite state must remain independent");
  twitterState = twitter.twitterStateTransition(twitterState, { type: "SET_SCROLL_POSITION", scrollPosition: 144 });
  scheduledTwitterPosts.forEach(post => {
    twitterState = twitter.twitterStateTransition(twitterState, { type: "DELIVER_TIMELINE_TWEET", tweet: post });
    twitterState = twitter.twitterStateTransition(twitterState, { type: "DELIVER_TIMELINE_TWEET", tweet: post });
    assert.equal(twitterState.timeline.filter(tweet => tweet.id === post.id).length, 1);
  });
  assert.equal(twitterState.scrollPosition, 144, "live delivery must not force-reset the current Twitter scroll position");
  assert.equal(twitterState.timeline[0].id, "terminal-goodnight-world", "terminal live activity must sort above earlier live and seed items");
  assert.deepEqual(
    twitterState.timeline.slice(0, 8).map(tweet => tweet.id),
    ["terminal-goodnight-world", "jay-headphones-late", "nora-homework", "slang-fml", "late-night-line", "eva-school-tomorrow", "matt-mac-rumors", "slang-epic-fail"],
    "live Twitter activity must remain newest-first",
  );
  assert.ok(
    ["terminal-goodnight-world", "slang-fml", "slang-epic-fail"].every(id => twitterState.timeline.find(tweet => tweet.id === id)?.origin === "live"),
    "v0.7 Twitter additions must enter runtime state as live content",
  );
  assert.deepEqual(twitterState.retweetedTweetIds, ["still-awake"], "live delivery must preserve Retweet state");
  assert.equal(twitterState.retweetActivities.length, 1, "live delivery must preserve exactly one current-user Retweet activity");
  assert.deepEqual(twitterState.favoriteTweetIds, ["still-awake"], "live delivery must preserve Favorite state");
  assert.equal(twitterState.replies.length, 2, "live delivery must preserve user replies");
  twitterState = twitter.twitterStateTransition(twitterState, {
    type: "TOGGLE_RETWEET",
    tweetId: "still-awake",
    retweetedBy: "Zoey",
    retweetActionTimestamp: 1_287_552_480_000,
  });
  assert.deepEqual(twitterState.retweetedTweetIds, []);
  assert.deepEqual(twitterState.retweetActivities, [], "unretweet must remove only the related session activity");
  assert.equal(twitterState.timeline.filter(tweet => tweet.id === "still-awake").length, 1, "unretweet must preserve the original tweet");
  assert.deepEqual(twitterState.favoriteTweetIds, ["still-awake"], "unretweet must preserve Favorite state");
  assert.equal(twitterState.replies.length, 2, "unretweet must preserve replies");
  twitterState = twitter.twitterStateTransition(twitterState, {
    type: "TOGGLE_RETWEET",
    tweetId: "still-awake",
    retweetedBy: "Zoey",
    retweetActionTimestamp: 1_287_552_540_000,
  });
  assert.equal(twitterState.retweetActivities.length, 1, "re-retweet must restore one stable activity without duplicates");
  assert.equal(twitterState.retweetActivities[0].id, "user-retweet:still-awake");
  const twitterReset = twitter.twitterStateTransition(twitterState, { type: "RESET", displayName: "Alex" });
  assert.equal(twitterReset.favoriteTweetIds.length, 0);
  assert.equal(twitterReset.retweetedTweetIds.length, 0);
  assert.equal(twitterReset.retweetActivities.length, 0);
  assert.deepEqual(twitterReset.replies, seed.twitterReplies);
  assert.equal(twitterReset.replyComposerTweetId, null);
  assert.equal(twitterReset.replyDraft, "");
  assert.equal(twitterReset.newTweetDraft, "");
  assert.equal(twitterReset.nextUserTweetSequence, 1);
  assert.equal(twitterReset.activeTab, "timeline");
  assert.equal(twitterReset.currentView, "timeline");
  assert.equal(twitterReset.composerKind, null);
  assert.equal(twitterReset.revealedTweetId, null);
  assert.equal(twitterReset.timeline.length, 19);
  assert.ok(scheduledTwitterPosts.every(post => !twitterReset.timeline.some(tweet => tweet.id === post.id)), "session reset must remove every live Twitter addition");
  assert.equal(twitterReset.timeline.find(tweet => tweet.id === "late-night-matt").displayName, "Matt Ricci");

  let foursquareState = foursquare.createInitialFoursquareState();
  const foursquarePlaces = foursquareVenueAdapter.createFoursquareVenueViewModels(foursquareState.venues, foursquareState.socialActivities);
  assert.deepEqual(foursquarePlaces.map(venue => [venue.id, venue.name]), [["night-owl", "Night Owl Cafe"], ["main-street-diner", "Main Street Diner"], ["cedar-books", "Cedar Books"], ["riverside-park", "Riverside Park"]], "F2a must retain all four venue identities and ordering");
  assert.deepEqual(foursquarePlaces.map(venue => [venue.id, venue.category]), [["night-owl", "coffee-shop"], ["main-street-diner", "diner-restaurant"], ["cedar-books", "bookstore"], ["riverside-park", "park"]], "F2a must use explicit stable category mappings");
  assert.equal(foursquarePlaces.every(venue => typeof venue.categoryIcon === "string" && venue.categoryIcon.length > 0), true, "every F2a venue must resolve category artwork");
  assert.equal(new Set(foursquarePlaces.map(venue => venue.categoryIcon)).size, 4, "F2a must bind one explicit category artwork asset per current venue category");
  assert.equal(foursquarePlaces.every(venue => !Object.hasOwn(venue, "address") && !Object.hasOwn(venue, "distance") && !Object.hasOwn(venue, "coordinates")), true, "F2a view models must omit unverified address, fabricated distance, and private coordinates");
  assert.equal(foursquarePlaces.every(venue => !Object.hasOwn(venue, "mayor") && !Object.hasOwn(venue, "mayorCharacterId")), true, "F4 legacy mayor strings must not enter UI-eligible venue view models");
  assert.deepEqual(foursquarePlaces.find(venue => venue.id === "main-street-diner")?.priorFriendActivityIds, ["foursquare-history-june-2010-10-19-main-street-diner", "foursquare-history-luca-2010-10-19-main-street-diner"], "adapter must derive only visible prior friend activity IDs");
  assert.deepEqual(foursquare.FOURSQUARE_ROOT_TABS, ["friends", "places", "tips", "todos", "profile"], "F1 must expose exactly five period root destinations in locked order");
  assert.deepEqual([foursquareState.activeTab, foursquareState.currentView, foursquareState.selectedVenueId], ["friends", "root", null], "Foursquare must open to the Friends root");
  assert.deepEqual(foursquareState.rootScrollPositions, { friends: 0, places: 0, tips: 0, todos: 0, profile: 0 }, "every Foursquare root must own independent scroll state");
  assert.deepEqual(foursquareState.pointEvents, []);
  assert.equal(foursquareState.latestCheckinResult, null);
  assert.equal(foursquareGameModel.getSessionPoints(foursquareState.pointEvents), 0);
  assert.equal(foursquareGameModel.getPlayerWeeklyPoints(foursquareState.pointEvents), 0);
  assert.equal(foursquareGameModel.getPlayerRank(foursquareState.pointEvents), null);
  assert.deepEqual(foursquareGameSeed.FOURSQUARE_LEADERBOARD_SEED.map(entry => [entry.characterId, entry.baseWeeklyPoints, entry.stableTieOrder]), [["alex", 18, 0], ["katie", 15, 1], ["june", 9, 2], ["luca", 4, 3], ["foursquare-mia", 2, 4]], "F3a must retain the immutable reconstructed weekly baseline and tie order");
  assert.deepEqual(foursquareGameModel.buildLeaderboard(foursquareState.pointEvents).map(entry => [entry.rank, entry.identityId, entry.weeklyPoints]), [[1, "alex", 18], [2, "katie", 15], [3, "june", 9], [4, "luca", 4], [5, "foursquare-mia", 2]], "F3b fresh leaderboard must contain exactly the five frozen friend rows");
  assert.equal(foursquareGameModel.buildLeaderboard(foursquareState.pointEvents).some(entry => entry.isPlayer), false, "F3b must not render an unranked player row");
  let foursquareLeaderboardNavigation = foursquare.foursquareStateTransition(foursquareState, { type: "SHOW_TAB", tab: "profile" });
  foursquareLeaderboardNavigation = foursquare.foursquareStateTransition(foursquareLeaderboardNavigation, { type: "SHOW_LEADERBOARD" });
  assert.deepEqual([foursquareLeaderboardNavigation.activeTab, foursquareLeaderboardNavigation.currentView, foursquareLeaderboardNavigation.venueSubview, foursquareLeaderboardNavigation.selectedVenueId], ["profile", "leaderboard", "summary", null], "F3b Profile entry must open a venue-neutral Leaderboard child route");
  const foursquareLeaderboardBack = foursquare.foursquareStateTransition(foursquareLeaderboardNavigation, { type: "SHOW_PROFILE" });
  assert.deepEqual([foursquareLeaderboardBack.activeTab, foursquareLeaderboardBack.currentView, foursquareLeaderboardBack.selectedVenueId], ["profile", "root", null], "F3b Back must return to the Profile root");
  for (const tab of foursquare.FOURSQUARE_ROOT_TABS) {
    const rootFromLeaderboard = foursquare.foursquareStateTransition(foursquareLeaderboardNavigation, { type: "SHOW_TAB", tab });
    assert.deepEqual([rootFromLeaderboard.activeTab, rootFromLeaderboard.currentView, rootFromLeaderboard.venueSubview, rootFromLeaderboard.selectedVenueId], [tab, "root", "summary", null], `F3b root tab ${tab} must escape to that root`);
  }
  assert.deepEqual(foursquareState.checkIns, {});
  assert.deepEqual(foursquareState.shoutDrafts, {});
  assert.deepEqual(foursquareState.todos, [], "F5a initial session To-Dos must be empty without claiming zero historical To-Dos");
  const foursquareTodos = await vite.ssrLoadModule("/src/data/foursquareTodos.ts");
  const venueTodoId = "todo:venue:night-owl";
  const tipTodoId = "todo:tip:night-owl-tip";
  let foursquareTodoState = foursquare.foursquareStateTransition(foursquareState, { type: "ADD_VENUE_TODO", venueId: "night-owl", simulatedCreatedAt: 1_287_552_180_000 });
  assert.deepEqual(foursquareTodoState.todos, [{ id: venueTodoId, kind: "venue", venueId: "night-owl", createdAt: 1_287_552_180_000, completed: false }], "F5a must add exactly one venue To-Do with caller-supplied simulated time");
  const oneVenueTodoState = foursquareTodoState;
  foursquareTodoState = foursquare.foursquareStateTransition(foursquareTodoState, { type: "ADD_VENUE_TODO", venueId: "night-owl", simulatedCreatedAt: 1_287_552_181_000 });
  assert.strictEqual(foursquareTodoState, oneVenueTodoState, "F5a duplicate venue To-Do must be an identity-preserving no-op");
  assert.strictEqual(foursquare.foursquareStateTransition(foursquareTodoState, { type: "ADD_VENUE_TODO", venueId: "unknown-venue", simulatedCreatedAt: 1_287_552_182_000 }), foursquareTodoState, "F5a unknown venue To-Do must be a no-op");
  foursquareTodoState = foursquare.foursquareStateTransition(foursquareTodoState, { type: "ADD_TIP_TODO", tipId: "night-owl-tip", simulatedCreatedAt: 1_287_552_240_000 });
  assert.deepEqual(foursquareTodoState.todos, [
    { id: tipTodoId, kind: "tip", tipId: "night-owl-tip", venueId: "night-owl", createdAt: 1_287_552_240_000, completed: false },
    { id: venueTodoId, kind: "venue", venueId: "night-owl", createdAt: 1_287_552_180_000, completed: false },
  ], "F5a venue and Tip To-Dos must remain distinct and sort newest-created first");
  const venueAndTipTodoState = foursquareTodoState;
  assert.strictEqual(foursquare.foursquareStateTransition(foursquareTodoState, { type: "ADD_TIP_TODO", tipId: "night-owl-tip", simulatedCreatedAt: 1_287_552_241_000 }), foursquareTodoState, "F5a duplicate Tip To-Do must be an identity-preserving no-op");
  assert.strictEqual(foursquare.foursquareStateTransition(foursquareTodoState, { type: "ADD_TIP_TODO", tipId: "unknown-tip", simulatedCreatedAt: 1_287_552_241_000 }), foursquareTodoState, "F5a unknown Tip must not create a To-Do");
  assert.equal(foursquareTodos.isFoursquareVenueTodoSaved(foursquareTodoState.todos, "night-owl"), true);
  assert.equal(foursquareTodos.isFoursquareTipTodoSaved(foursquareTodoState.todos, "night-owl-tip"), true);
  assert.equal(foursquareTodos.getActiveFoursquareTodos(foursquareTodoState.todos).length, 2);
  foursquareTodoState = foursquare.foursquareStateTransition(foursquareTodoState, { type: "TOGGLE_TODO_COMPLETED", todoId: tipTodoId });
  assert.deepEqual([foursquareTodos.getCompletedFoursquareTodos(foursquareTodoState.todos).map(todo => todo.id), foursquareTodos.getActiveFoursquareTodos(foursquareTodoState.todos).map(todo => todo.id)], [[tipTodoId], [venueTodoId]], "F5a completion selectors must separate session state");
  foursquareTodoState = foursquare.foursquareStateTransition(foursquareTodoState, { type: "TOGGLE_TODO_COMPLETED", todoId: tipTodoId });
  assert.equal(foursquareTodos.getFoursquareTipTodo(foursquareTodoState.todos, "night-owl-tip")?.completed, false, "F5a completion toggle must be reversible");
  assert.strictEqual(foursquare.foursquareStateTransition(foursquareTodoState, { type: "TOGGLE_TODO_COMPLETED", todoId: "unknown-todo" }), foursquareTodoState, "F5a unknown completion toggle must be a no-op");
  const todosBeforeCheckIn = foursquareTodoState.todos;
  const todoStateAfterCheckIn = foursquare.foursquareStateTransition(foursquareTodoState, { type: "CHECK_IN", venueId: "night-owl", checkedInBy: "Zoey", checkInTimestamp: 1_287_552_600_000 });
  assert.strictEqual(todoStateAfterCheckIn.todos, todosBeforeCheckIn, "F5a CHECK_IN must not complete, remove, or replace To-Do state");
  const todoStateAfterNavigation = foursquare.foursquareStateTransition(foursquareTodoState, { type: "SHOW_TAB", tab: "profile" });
  assert.strictEqual(todoStateAfterNavigation.todos, foursquareTodoState.todos, "F5a internal navigation must preserve session To-Dos");
  foursquareTodoState = foursquare.foursquareStateTransition(foursquareTodoState, { type: "REMOVE_TODO", todoId: venueTodoId });
  assert.deepEqual(foursquareTodoState.todos.map(todo => todo.id), [tipTodoId], "F5a remove must affect only the requested To-Do");
  assert.strictEqual(foursquare.foursquareStateTransition(foursquareTodoState, { type: "REMOVE_TODO", todoId: "unknown-todo" }), foursquareTodoState, "F5a unknown removal must be a no-op");
  assert.deepEqual(foursquare.foursquareStateTransition(venueAndTipTodoState, { type: "RESET" }).todos, [], "F5a RESET must clear session-created To-Dos");
  let f5cTodoState = foursquare.foursquareStateTransition(foursquare.createInitialFoursquareState(), { type: "ADD_VENUE_TODO", venueId: "night-owl", simulatedCreatedAt: 1_287_552_180_000 });
  f5cTodoState = foursquare.foursquareStateTransition(f5cTodoState, { type: "ADD_VENUE_TODO", venueId: "main-street-diner", simulatedCreatedAt: 1_287_552_240_000 });
  assert.deepEqual(f5cTodoState.todos.map(todo => todo.id), ["todo:venue:main-street-diner", "todo:venue:night-owl"], "F5c visible venue To-Dos must retain deterministic newest-first ordering");
  assert.strictEqual(foursquare.foursquareStateTransition(f5cTodoState, { type: "ADD_VENUE_TODO", venueId: "main-street-diner", simulatedCreatedAt: 1_287_552_300_000 }), f5cTodoState, "F5c duplicate venue saves must remain reducer no-ops");
  const f5cTodosRootState = foursquare.foursquareStateTransition(f5cTodoState, { type: "SHOW_TAB", tab: "todos", scrollPosition: 0 });
  assert.deepEqual([f5cTodosRootState.activeTab, f5cTodosRootState.currentView], ["todos", "root"], "F5c must expose To-Dos as the existing root-tab surface");
  const f5cVenueFromTodoState = foursquare.foursquareStateTransition(f5cTodosRootState, { type: "OPEN_VENUE", venueId: "night-owl", scrollPosition: 0 });
  assert.deepEqual([f5cVenueFromTodoState.currentView, f5cVenueFromTodoState.selectedVenueId, f5cVenueFromTodoState.venueSubview], ["venue", "night-owl", "summary"], "F5c To-Do rows must open the existing venue summary route");
  const f5cRemovedTodoState = foursquare.foursquareStateTransition(f5cTodoState, { type: "REMOVE_TODO", todoId: "todo:venue:main-street-diner" });
  assert.deepEqual(f5cRemovedTodoState.todos.map(todo => todo.id), ["todo:venue:night-owl"], "F5c removal must remove only the selected venue To-Do");
  const f5dTipRemovedState = foursquare.foursquareStateTransition(venueAndTipTodoState, { type: "REMOVE_TODO", todoId: tipTodoId });
  assert.deepEqual(f5dTipRemovedState.todos.map(todo => todo.id), [venueTodoId], "F5d removing the Tip To-Do must leave the coexisting venue To-Do untouched");
  assert.deepEqual(foursquareTodos.getFoursquareTipTodo(venueAndTipTodoState.todos, "night-owl-tip"), { id: tipTodoId, kind: "tip", tipId: "night-owl-tip", venueId: "night-owl", createdAt: 1_287_552_240_000, completed: false }, "F5d Tip save must retain its Tip identity and reducer-derived Night Owl venue");
  assert.equal(foursquareState.mayorState, "otherUser");
  assert.deepEqual(
    foursquareState.venues.map(venue => [venue.id, venue.mayor]),
    [["night-owl", "June"], ["main-street-diner", "Jack"], ["cedar-books", "Mia"], ["riverside-park", "Eli"]],
    "F4 must quarantine the four legacy HOLD-fictional mayor strings until a coordinated F6 migration",
  );
  assert.deepEqual(foursquareState.earnedBadges, []);
  assert.equal(foursquareState.socialActivities.length, 5);
  assert.deepEqual(foursquareState.socialActivities.map(activity => [activity.friendId, activity.venueId, activity.simulatedCreatedAt, activity.shout ?? null, activity.source, activity.visible]), [
    ["june", "main-street-diner", "2010-10-19T22:52:00-07:00", "Late dinner.", "seed", true],
    ["foursquare-mia", "cedar-books", "2010-10-19T20:42:00-07:00", null, "seed", true],
    ["alex", "riverside-park", "2010-10-19T20:41:00-07:00", "Evening walk with the dogs.", "seed", true],
    ["katie", "riverside-park", "2010-10-19T17:18:00-07:00", null, "seed", true],
    ["luca", "main-street-diner", "2010-10-19T15:06:00-07:00", null, "seed", true],
  ], "F6e initial Friends feed must preserve the five-row visible order and semantics");
  assert.deepEqual(foursquareState.socialActivities.find(activity => activity.id === "mia-cedar-books"), { id: "mia-cedar-books", friendId: "foursquare-mia", venueId: "cedar-books", simulatedCreatedAt: "2010-10-19T20:42:00-07:00", source: "seed", visible: true }, "F1 structured migration must preserve the existing Mia/Cedar Books seed meaning");
  assert.equal(foursquareState.socialActivities.every(activity => activity.friendId && activity.venueId && activity.simulatedCreatedAt && !Object.hasOwn(activity, "message")), true, "Friends feed must use structured identity/venue/time records without freeform parsing");
  let foursquareVenueNavigation = foursquare.foursquareStateTransition(foursquare.createInitialFoursquareState(), { type: "OPEN_VENUE", venueId: "night-owl", scrollPosition: 73 });
  assert.deepEqual([foursquareVenueNavigation.currentView, foursquareVenueNavigation.selectedVenueId, foursquareVenueNavigation.venueSubview], ["venue", "night-owl", "summary"], "F2b-1 OPEN_VENUE must open the selected venue summary");
  foursquareVenueNavigation = foursquare.foursquareStateTransition(foursquareVenueNavigation, { type: "SHOW_VENUE_INFO" });
  assert.deepEqual([foursquareVenueNavigation.selectedVenueId, foursquareVenueNavigation.venueSubview], ["night-owl", "info"], "Info must preserve the selected venue");
  foursquareVenueNavigation = foursquare.foursquareStateTransition(foursquareVenueNavigation, { type: "SHOW_VENUE_SUMMARY" });
  foursquareVenueNavigation = foursquare.foursquareStateTransition(foursquareVenueNavigation, { type: "SHOW_VENUE_TIPS" });
  assert.deepEqual([foursquareVenueNavigation.selectedVenueId, foursquareVenueNavigation.venueSubview], ["night-owl", "tips"], "Tips must preserve the selected venue");
  foursquareVenueNavigation = foursquare.foursquareStateTransition(foursquareVenueNavigation, { type: "SHOW_VENUE_SUMMARY" });
  foursquareVenueNavigation = foursquare.foursquareStateTransition(foursquareVenueNavigation, { type: "SHOW_VENUE_CHECK_IN" });
  foursquareVenueNavigation = foursquare.foursquareStateTransition(foursquareVenueNavigation, { type: "EDIT_CHECK_IN_SHOUT", venueId: "night-owl", value: "draft survives navigation" });
  assert.deepEqual([foursquareVenueNavigation.selectedVenueId, foursquareVenueNavigation.venueSubview, foursquareVenueNavigation.shoutDrafts["night-owl"]], ["night-owl", "checkIn", "draft survives navigation"], "Check In must preserve venue-keyed shout state");
  foursquareVenueNavigation = foursquare.foursquareStateTransition(foursquareVenueNavigation, { type: "SHOW_VENUE_SUMMARY" });
  assert.deepEqual([foursquareVenueNavigation.venueSubview, foursquareVenueNavigation.shoutDrafts["night-owl"]], ["summary", "draft survives navigation"], "nested Back must return to summary without clearing the draft");
  foursquareVenueNavigation = foursquare.foursquareStateTransition(foursquareVenueNavigation, { type: "SHOW_PLACES" });
  assert.deepEqual([foursquareVenueNavigation.activeTab, foursquareVenueNavigation.currentView, foursquareVenueNavigation.venueSubview, foursquareVenueNavigation.selectedVenueId, foursquareVenueNavigation.rootScrollPositions.places], ["places", "root", "summary", null, 73], "summary Back must restore Places root and its stored scroll");
  for (const tab of foursquare.FOURSQUARE_ROOT_TABS) {
    let deepState = foursquare.foursquareStateTransition(foursquare.createInitialFoursquareState(), { type: "OPEN_VENUE", venueId: "night-owl", scrollPosition: 17 });
    deepState = foursquare.foursquareStateTransition(deepState, { type: "SHOW_VENUE_INFO" });
    deepState = foursquare.foursquareStateTransition(deepState, { type: "SHOW_TAB", tab });
    assert.deepEqual([deepState.activeTab, deepState.currentView, deepState.venueSubview, deepState.selectedVenueId], [tab, "root", "summary", null], `root tab ${tab} must clear every venue-local route`);
  }
  let foursquareResultRoute = foursquare.foursquareStateTransition(foursquare.createInitialFoursquareState(), { type: "OPEN_VENUE", venueId: "night-owl", scrollPosition: 19 });
  foursquareResultRoute = foursquare.foursquareStateTransition(foursquareResultRoute, { type: "SHOW_VENUE_CHECK_IN" });
  assert.equal(foursquareResultRoute.venueSubview, "checkIn", "F3c-2 unchecked venue must open the existing Check In form");
  foursquareResultRoute = foursquare.foursquareStateTransition(foursquareResultRoute, { type: "EDIT_CHECK_IN_SHOUT", venueId: "night-owl", value: "stored but hidden" });
  foursquareResultRoute = foursquare.foursquareStateTransition(foursquareResultRoute, { type: "CHECK_IN", venueId: "night-owl", checkedInBy: "Zoey", checkInTimestamp: 1_287_552_600_000 });
  assert.equal(foursquareResultRoute.venueSubview, "result", "F3c-2 successful form submission must route directly to result");
  assert.equal(foursquareResultRoute.checkIns["night-owl"].shout, "stored but hidden", "F3c-2 must preserve stored shout data");
  assert.deepEqual([foursquareResultRoute.checkIns["night-owl"].result.pointDelta, foursquareResultRoute.checkIns["night-owl"].result.rankAfter, foursquareResultRoute.checkIns["night-owl"].result.weeklyPointsAfter], [1, 6, 1], "F3c-2 result route must expose Venue A's frozen result");
  foursquareResultRoute = foursquare.foursquareStateTransition(foursquareResultRoute, { type: "SHOW_VENUE_SUMMARY" });
  assert.deepEqual([foursquareResultRoute.currentView, foursquareResultRoute.venueSubview, foursquareResultRoute.selectedVenueId], ["venue", "summary", "night-owl"], "F3c-2 Close must return one level to the same venue summary");
  foursquareResultRoute = foursquare.foursquareStateTransition(foursquareResultRoute, { type: "SHOW_VENUE_CHECK_IN" });
  assert.equal(foursquareResultRoute.venueSubview, "result", "F3c-2 checked venue must reopen its result without showing the form");
  for (const tab of foursquare.FOURSQUARE_ROOT_TABS) {
    const rootFromResult = foursquare.foursquareStateTransition(foursquareResultRoute, { type: "SHOW_TAB", tab });
    assert.deepEqual([rootFromResult.activeTab, rootFromResult.currentView, rootFromResult.venueSubview, rootFromResult.selectedVenueId], [tab, "root", "summary", null], `F3c-2 result must escape cleanly to ${tab} root`);
  }
  assert.deepEqual(foursquareContent.FOURSQUARE_VENUE_TIPS, [{ id: "night-owl-tip", venueId: "night-owl", authorId: "june", authorDisplayName: "June", text: "The coffee is strongest after ten.", source: "seed", classification: "HOLD-fictional" }], "F2b-2 must expose exactly the existing June/Night Owl Tip as structured project fiction");
  assert.equal(Object.hasOwn(foursquareContent.FOURSQUARE_VENUE_TIPS[0], "simulatedCreatedAt"), false, "F2b-2 must not fabricate a Tip timestamp");
  assert.deepEqual(foursquareContent.selectFoursquareVenueTips("night-owl").map(tip => tip.id), ["night-owl-tip"], "Night Owl must resolve its one structured Tip");
  for (const venueId of ["main-street-diner", "cedar-books", "riverside-park"]) assert.deepEqual(foursquareContent.selectFoursquareVenueTips(venueId), [], `${venueId} must not gain invented Tips`);
  assert.equal(foursquareState.venues.every(venue => !Object.hasOwn(venue, "tip")), true, "Foursquare runtime venue state must not retain the legacy embedded Tip architecture");
  const activity = { id: "june-night-owl-checkin", message: "June checked in at Night Owl Cafe." };
  foursquareState = foursquare.foursquareStateTransition(foursquareState, { type: "DELIVER_SOCIAL_ACTIVITY", activity });
  foursquareState = foursquare.foursquareStateTransition(foursquareState, { type: "DELIVER_SOCIAL_ACTIVITY", activity });
  assert.equal(foursquareState.socialActivities.length, 6);
  assert.equal(foursquareState.socialActivities.at(-1).visible, false, "unresolved Night Owl live activity must remain delivered but hidden in F1");
  assert.equal(foursquareState.unreadActivityCount, 1);
  assert.deepEqual(foursquareState.pointEvents, [], "ambient activity must not mutate user gameplay state");
  assert.deepEqual(foursquareState.checkIns, {}, "ambient activity must not check in the session owner");
  assert.equal(foursquareState.mayorState, "otherUser");
  assert.deepEqual(foursquareState.earnedBadges, []);

  let foursquarePlayability = foursquare.foursquareStateTransition(foursquareState, { type: "OPEN_VENUE", venueId: "night-owl", scrollPosition: 73 });
  assert.deepEqual([foursquarePlayability.activeTab, foursquarePlayability.currentView, foursquarePlayability.rootScrollPositions.places], ["places", "venue", 73], "opening a venue must preserve the Places root origin");
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, { type: "SHOW_VENUE_TIPS" });
  assert.equal(foursquarePlayability.venueSubview, "tips", "the venue Tips subview must open without changing user gameplay");
  assert.equal(foursquareGameModel.getSessionPoints(foursquarePlayability.pointEvents), 0);
  assert.equal(foursquarePlayability.rootScrollPositions.places, 73);
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, { type: "EDIT_CHECK_IN_SHOUT", venueId: "night-owl", value: "late coffee" });
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, {
    type: "CHECK_IN",
    venueId: "night-owl",
    checkedInBy: "Zoey",
    checkInTimestamp: 1_287_552_600_000,
  });
  const firstVenueResult = { venueId: "night-owl", simulatedCreatedAt: 1_287_552_600_000, pointEventIds: ["check-in:night-owl"], pointDelta: 1, weeklyPointsAfter: 1, rankBefore: null, rankAfter: 6, badgeIdsUnlocked: [], mayorshipChange: null };
  assert.deepEqual(foursquarePlayability.checkIns["night-owl"], {
    checkedIn: true,
    checkedInBy: "Zoey",
    checkInTimestamp: 1_287_552_600_000,
    shout: "late coffee",
    pointsAwarded: 1,
    result: firstVenueResult,
  });
  assert.deepEqual(foursquarePlayability.pointEvents, [{ id: "check-in:night-owl", reason: "check_in", delta: 1, venueId: "night-owl", simulatedCreatedAt: 1_287_552_600_000 }]);
  assert.equal(foursquareGameModel.getPlayerWeeklyPoints(foursquarePlayability.pointEvents), 1);
  assert.deepEqual(foursquarePlayability.latestCheckinResult, firstVenueResult);
  assert.strictEqual(foursquarePlayability.checkIns["night-owl"].result, foursquarePlayability.latestCheckinResult, "F3c-1 must store the one canonical result snapshot in both latest and venue-keyed state");
  assert.equal(foursquarePlayability.checkIns["night-owl"].pointsAwarded, foursquarePlayability.checkIns["night-owl"].result.pointDelta, "compatibility pointsAwarded must derive from the frozen result delta");
  assert.equal(foursquarePlayability.venueSubview, "tips", "check-in state changes must not mutate the selected venue subview");
  assert.equal(foursquarePlayability.mayorState, "otherUser", "one check-in must not promote the session owner to Mayor");
  assert.deepEqual(foursquarePlayability.earnedBadges, [], "check-in must not award a badge");
  assert.deepEqual(foursquarePlayability.latestCheckinResult?.badgeIdsUnlocked, [], "F4 unknown prior player history must not be interpreted as Newbie eligibility");
  assert.equal(foursquarePlayability.latestCheckinResult?.mayorshipChange, null, "F4 one session check-in must not acquire a mayorship");
  assert.equal(foursquareState.socialActivities.some(activity => activity.friendId === "luca" && activity.venueId === "main-street-diner"), true, "F4 preserves Luca's existing Main Street Diner activity observation");
  assert.equal(foursquareState.venues.find(venue => venue.id === "main-street-diner")?.mayor, "Jack", "F4 must not derive Luca mayorship from workplace or venue presence");
  const afterFirstCheckIn = foursquarePlayability;
  const firstVenueRecord = afterFirstCheckIn.checkIns["night-owl"];
  assert.deepEqual(foursquareGameModel.buildLeaderboard(afterFirstCheckIn.pointEvents).map(entry => [entry.rank, entry.identityId, entry.weeklyPoints]), [[1, "alex", 18], [2, "katie", 15], [3, "june", 9], [4, "luca", 4], [5, "foursquare-mia", 2], [6, "session-owner", 1]], "F3b first unique check-in must add the player at #6 with 1");
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, {
    type: "CHECK_IN",
    venueId: "night-owl",
    checkedInBy: "Zoey",
    checkInTimestamp: 1_287_552_660_000,
  });
  assert.strictEqual(foursquarePlayability, afterFirstCheckIn, "duplicate venue check-in must not mutate state or award points");
  assert.strictEqual(foursquarePlayability.checkIns["night-owl"], firstVenueRecord, "duplicate check-in must not replace its venue record or frozen result");
  assert.deepEqual(foursquareGameModel.buildLeaderboard(foursquarePlayability.pointEvents), foursquareGameModel.buildLeaderboard(afterFirstCheckIn.pointEvents), "F3b duplicate check-in must leave leaderboard output unchanged");
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, { type: "OPEN_VENUE", venueId: "main-street-diner", scrollPosition: 73 });
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, {
    type: "CHECK_IN",
    venueId: "main-street-diner",
    checkedInBy: "Zoey",
    checkInTimestamp: 1_287_552_720_000,
  });
  assert.equal(foursquarePlayability.checkIns["main-street-diner"].shout, null, "empty shout must still permit check-in");
  const secondVenueResult = { venueId: "main-street-diner", simulatedCreatedAt: 1_287_552_720_000, pointEventIds: ["check-in:main-street-diner"], pointDelta: 1, weeklyPointsAfter: 2, rankBefore: 6, rankAfter: 6, badgeIdsUnlocked: [], mayorshipChange: null };
  assert.deepEqual(foursquarePlayability.checkIns["main-street-diner"].result, secondVenueResult, "F3c-1 must freeze Venue B's own result on Venue B");
  assert.strictEqual(foursquarePlayability.checkIns["main-street-diner"].result, foursquarePlayability.latestCheckinResult, "latestCheckinResult must point to the same Venue B snapshot");
  assert.strictEqual(foursquarePlayability.checkIns["night-owl"], firstVenueRecord, "Venue A record must remain unchanged after Venue B");
  assert.deepEqual(foursquarePlayability.checkIns["night-owl"].result, firstVenueResult, "Venue A must retain its original weekly total and rank after Venue B");
  assert.equal(foursquareGameModel.getPlayerWeeklyPoints(foursquarePlayability.pointEvents), 2);
  assert.deepEqual(foursquareGameModel.buildLeaderboard(foursquarePlayability.pointEvents).slice(-2).map(entry => [entry.rank, entry.identityId, entry.weeklyPoints]), [[5, "foursquare-mia", 2], [6, "session-owner", 2]], "F3b frozen tie order must keep Mia above the two-point player");
  assert.deepEqual(foursquarePlayability.latestCheckinResult, secondVenueResult);
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, { type: "CHECK_IN", venueId: "cedar-books", checkedInBy: "Zoey", checkInTimestamp: 1_287_552_780_000 });
  assert.equal(foursquareGameModel.getPlayerWeeklyPoints(foursquarePlayability.pointEvents), 3);
  const thirdVenueResult = { venueId: "cedar-books", simulatedCreatedAt: 1_287_552_780_000, pointEventIds: ["check-in:cedar-books"], pointDelta: 1, weeklyPointsAfter: 3, rankBefore: 6, rankAfter: 5, badgeIdsUnlocked: [], mayorshipChange: null };
  assert.deepEqual(foursquarePlayability.checkIns["cedar-books"].result, thirdVenueResult, "F3c-1 must freeze the third venue result at weekly 3 / rank 5");
  assert.strictEqual(foursquarePlayability.checkIns["cedar-books"].result, foursquarePlayability.latestCheckinResult, "latestCheckinResult must point to the same third-venue snapshot");
  assert.strictEqual(foursquarePlayability.checkIns["night-owl"], firstVenueRecord, "Venue A must remain immutable after a third result");
  assert.deepEqual(foursquarePlayability.checkIns["main-street-diner"].result, secondVenueResult, "Venue B must remain frozen after a third result");
  assert.deepEqual(foursquareGameModel.buildLeaderboard(foursquarePlayability.pointEvents).slice(-2).map(entry => [entry.rank, entry.identityId, entry.weeklyPoints]), [[5, "session-owner", 3], [6, "foursquare-mia", 2]], "F3b third unique check-in must rank the player above Mia");
  assert.deepEqual(foursquarePlayability.latestCheckinResult, thirdVenueResult);
  assert.deepEqual(foursquareGameSeed.FOURSQUARE_LEADERBOARD_SEED.map(entry => entry.baseWeeklyPoints), [18, 15, 9, 4, 2], "player scoring must never mutate the friend baseline");
  assert.equal(foursquarePlayability.socialActivities.length, 6, "user check-in must remain separate from ambient seed/live activity");
  const foursquareGameReset = foursquare.foursquareStateTransition(foursquarePlayability, { type: "RESET" });
  assert.deepEqual(foursquareGameReset.checkIns, {}, "F3c-1 RESET must remove every venue record and frozen result snapshot");
  assert.deepEqual(foursquareGameReset.pointEvents, [], "F3a RESET must clear session point events");
  assert.equal(foursquareGameReset.latestCheckinResult, null, "F3a RESET must clear the frozen result");
  assert.equal(foursquareGameModel.getPlayerWeeklyPoints(foursquareGameReset.pointEvents), 0, "F3a RESET must restore the zero player baseline");
  assert.equal(foursquareGameModel.getPlayerRank(foursquareGameReset.pointEvents), null, "F3a RESET must leave the player unranked");
  assert.deepEqual([foursquareGameReset.activeTab, foursquareGameReset.currentView, foursquareGameModel.buildLeaderboard(foursquareGameReset.pointEvents).length], ["friends", "root", 5], "F3b RESET must restore Friends root and the five-entry baseline");
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, { type: "SET_ROOT_SCROLL_POSITION", tab: "friends", scrollPosition: 41 });
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, { type: "SET_ROOT_SCROLL_POSITION", tab: "places", scrollPosition: 82 });
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, { type: "SHOW_TAB", tab: "profile" });
  assert.deepEqual([foursquarePlayability.activeTab, foursquarePlayability.currentView, foursquarePlayability.selectedVenueId], ["profile", "root", null], "root-tab selection must clear incompatible venue detail state");
  foursquarePlayability = foursquare.foursquareStateTransition(foursquarePlayability, { type: "SHOW_TAB", tab: "places" });
  assert.deepEqual([foursquarePlayability.activeTab, foursquarePlayability.currentView, foursquarePlayability.rootScrollPositions.friends, foursquarePlayability.rootScrollPositions.places], ["places", "root", 41, 82], "root navigation must retain independent root scroll positions");

  let tumblrState = tumblr.createInitialTumblrState();
  assert.ok(tumblrState.posts.every(post => post.origin === "seed"));
  assert.equal(tumblrState.notes.length, 1);
  assert.ok(tumblrState.notes.every(note => note.origin === "seed" && tumblrState.posts.some(post => post.id === note.sourcePostId)), "Tumblr seed Notes must reference existing posts without mutating post objects");
  assert.equal(tumblrState.posts.some(post => post.id === "late-note"), false);
  const livePost = { id: "late-note", type: "text", blog: "latewatch", title: "After midnight", content: "Quiet.", timestamp: "2010-10-20 12:12 AM" };
  tumblrState = tumblr.tumblrStateTransition(tumblrState, { type: "DELIVER_BACKGROUND_POST", post: livePost });
  tumblrState = tumblr.tumblrStateTransition(tumblrState, { type: "DELIVER_BACKGROUND_POST", post: livePost });
  assert.equal(tumblrState.posts.filter(post => post.id === livePost.id).length, 1);
  assert.equal(tumblrState.posts.at(-1).origin, "live");
  assert.equal(seed.tumblr.some(post => post.id === livePost.id), false, "Tumblr live item must not mutate the seed source");

  let tumblrPlayability = tumblr.createInitialTumblrState();
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "OPEN_POST", postId: "sunset-note", dashboardScrollPosition: 82 });
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "TOGGLE_LIKE", postId: "sunset-note", blogName: "Zoey" });
  assert.deepEqual(tumblrPlayability.likedPostIds, ["sunset-note"]);
  assert.deepEqual(tumblrPlayability.notes.at(-1), { id: "user-like:sunset-note", sourcePostId: "sunset-note", blogName: "Zoey", type: "liked", origin: "user" });
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "OPEN_NOTES", postId: "sunset-note" });
  assert.equal(tumblrPlayability.currentView, "notes");
  assert.deepEqual(tumblrPlayability.rebloggedPostIds, [], "opening Notes must not mutate Reblog state");
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "BACK_TO_POST" });
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "OPEN_REBLOG", postId: "sunset-note" });
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "EDIT_REBLOG_TEXT", value: "x".repeat(141) });
  assert.equal(tumblrPlayability.reblogDraft.length, 140, "minimal Reblog text must remain short in reducer state");
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "CANCEL_REBLOG" });
  assert.equal(tumblrPlayability.currentView, "post");
  assert.equal(tumblrPlayability.reblogDraft, "");
  assert.deepEqual(tumblrPlayability.reblogs, [], "cancel must not create a Reblog relation");
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "OPEN_REBLOG", postId: "sunset-note" });
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "EDIT_REBLOG_TEXT", value: "same feeling" });
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "CONFIRM_REBLOG", rebloggedBy: "Zoey", actionTimestamp: 1_287_552_780_000 });
  assert.deepEqual(tumblrPlayability.reblogs, [{
    id: "user-reblog:sunset-note",
    sourcePostId: "sunset-note",
    reblogged: true,
    rebloggedBy: "Zoey",
    optionalUserText: "same feeling",
    actionTimestamp: 1_287_552_780_000,
  }]);
  assert.deepEqual(tumblrPlayability.rebloggedPostIds, ["sunset-note"]);
  assert.equal(tumblrPlayability.posts.find(post => post.id === "sunset-note").blog, "dayonejournal", "Reblog must preserve the source post author/content object");
  assert.equal(tumblrPlayability.likedPostIds.includes("sunset-note"), true, "Reblog must not clear Like");
  assert.equal(tumblrPlayability.notes.filter(note => note.id === "user-reblog:sunset-note").length, 1, "confirmed Reblog must create at most one user Note relation");
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "DELIVER_BACKGROUND_POST", post: livePost });
  assert.equal(tumblrPlayability.reblogs.length, 1, "live delivery must preserve current-user Reblog state");
  assert.equal(tumblrPlayability.dashboardScrollPosition, 82);
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "REMOVE_REBLOG", postId: "sunset-note" });
  assert.deepEqual(tumblrPlayability.rebloggedPostIds, []);
  assert.deepEqual(tumblrPlayability.reblogs, [], "unreblog must remove only the current-user relation");
  assert.equal(tumblrPlayability.likedPostIds.includes("sunset-note"), true, "unreblog must preserve Like");
  assert.equal(tumblrPlayability.notes.some(note => note.id === "user-like:sunset-note"), true, "unreblog must preserve the user Like Note");
  assert.equal(tumblrPlayability.notes.some(note => note.id === "user-reblog:sunset-note"), false);
  assert.equal(tumblrPlayability.posts.filter(post => post.id === "sunset-note").length, 1, "unreblog must preserve the original Dashboard post");
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "OPEN_REBLOG", postId: "sunset-note" });
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "CONFIRM_REBLOG", rebloggedBy: "Zoey", actionTimestamp: 1_287_552_840_000 });
  assert.equal(tumblrPlayability.reblogs.length, 1, "reblogging again must restore one stable relation without duplicates");
  tumblrPlayability = tumblr.tumblrStateTransition(tumblrPlayability, { type: "BACK_TO_DASHBOARD" });
  assert.equal(tumblrPlayability.currentView, "dashboard");
  assert.equal(tumblrPlayability.dashboardScrollPosition, 82, "Back must restore the existing Dashboard scroll position");
  assert.equal(tumblrPlayability.reblogs.length, 1, "Back navigation must preserve Reblog state");

  let flickrA = flickr.createInitialFlickrState();
  const flickrB = flickr.createInitialFlickrState();
  assert.notStrictEqual(flickrA.photos, flickrB.photos);
  assert.notStrictEqual(flickrA.photos[0], flickrB.photos[0]);
  assert.ok(flickrA.photos.every(photo => photo.origin === "seed" && Date.parse(photo.uploadedAt) < facebookSessionStartMs));
  assert.deepEqual(flickrA.commentsState.map(comment => [comment.text, comment.origin]), [], "canonical Flickr photos must not invent seeded comments");
  assert.ok(flickrA.sets.length <= 2 && flickrA.sets.every(set => set.photoIds.every(photoId => flickrA.photos.some(photo => photo.id === photoId))), "Flickr Sets must reference existing photo IDs without duplicate photo objects");
  flickrA = flickr.flickrStateTransition(flickrA, { type: "TOGGLE_FAVORITE", photoId: flickrA.photos[0].id });
  assert.equal(flickrA.favoritePhotoIds.length, 1);
  assert.equal(flickrB.favoritePhotoIds.length, 0, "Flickr Favorite state must remain session-local");
  flickrA = flickr.flickrStateTransition(flickrA, { type: "OPEN_PHOTO", photoId: "flickr:jay-band-performance", origin: { view: "photostream" }, photostreamScrollPosition: 91 });
  flickrA = flickr.flickrStateTransition(flickrA, { type: "OPEN_COMMENTS" });
  flickrA = flickr.flickrStateTransition(flickrA, { type: "EDIT_COMMENT", value: "Still beautiful." });
  flickrA = flickr.flickrStateTransition(flickrA, { type: "SUBMIT_COMMENT", author: "Zoey" });
  assert.deepEqual(flickrA.commentsState.at(-1), {
    id: "flickr-user-comment-1",
    photoId: "flickr:jay-band-performance",
    author: "Zoey",
    text: "Still beautiful.",
    origin: "user",
  });
  assert.deepEqual(seed.flickr[0].comments, ["Nice shot"], "user comment must not mutate the Flickr seed definition");
  assert.deepEqual(flickrA.favoritePhotoIds, ["flickr:jay-band-performance"], "commenting must not alter Favorite state");
  assert.equal(flickrA.photostreamScrollPosition, 91);
  flickrA = flickr.flickrStateTransition(flickrA, { type: "BACK_TO_PHOTO" });
  flickrA = flickr.flickrStateTransition(flickrA, { type: "BACK_FROM_PHOTO" });
  assert.equal(flickrA.currentView, "photostream");
  assert.equal(flickrA.photostreamScrollPosition, 91, "photo opened from Photostream must restore its scroll position");
  flickrA = flickr.flickrStateTransition(flickrA, { type: "SHOW_SETS" });
  flickrA = flickr.flickrStateTransition(flickrA, { type: "OPEN_SET", setId: "jay-music" });
  const setMembershipBeforePhoto = [...flickrA.sets.find(set => set.id === "jay-music").photoIds];
  flickrA = flickr.flickrStateTransition(flickrA, { type: "OPEN_PHOTO", photoId: "flickr:jay-guitar", origin: { view: "set", setId: "jay-music" } });
  assert.equal(flickrA.currentView, "photo");
  assert.deepEqual(flickrA.photoNavigationOrigin, { view: "set", setId: "jay-music" });
  flickrA = flickr.flickrStateTransition(flickrA, { type: "BACK_FROM_PHOTO" });
  assert.equal(flickrA.currentView, "set", "photo opened from a Set must return to that Set");
  assert.equal(flickrA.currentSetId, "jay-music");
  assert.deepEqual(flickrA.sets.find(set => set.id === "jay-music").photoIds, setMembershipBeforePhoto, "navigation and comments must not alter Set membership");
  assert.deepEqual(flickrA.favoritePhotoIds, ["flickr:jay-band-performance"]);
  assert.equal(flickrA.commentsState.filter(comment => comment.origin === "user").length, 1);

  let instagramState = instagram.createInitialInstagramState();
  assert.deepEqual({ photos: instagramState.photos.length, followers: instagramState.followers, following: instagram.selectInstagramFollowingCount(instagramState) }, { photos: 0, followers: 0, following: 1 });
  assert.equal(instagramState.knownAccounts.length, 1, "Instagram must remain sparse with exactly one familiar early adopter");
  assert.deepEqual(instagramState.knownAccounts.map(account => account.canonicalCharacterId), ["june"], "Instagram must not auto-populate any other canonical character");
  assert.equal(new Set(instagramState.knownAccounts.map(account => account.canonicalCharacterId)).size, instagramState.knownAccounts.length, "Instagram must not duplicate canonical identities");
  assert.deepEqual(instagramState.followedCharacterIds, ["june"], "the Instagram relationship baseline must follow canonical June");
  assert.deepEqual(instagram.selectInstagramFollowedAccounts(instagramState).map(account => [account.canonicalCharacterId, account.username]), [["june", "junepark"]], "Following must contain exactly canonical June");
  const juneInstagramAccount = instagram.selectInstagramKnownAccountByUsername(instagramState, "@junepark");
  assert.deepEqual(
    [juneInstagramAccount?.canonicalCharacterId, juneInstagramAccount?.username, juneInstagramAccount?.displayName, juneInstagramAccount?.followersBaseline, juneInstagramAccount?.followingBaseline],
    ["june", "junepark", "June Park", 118, 236],
  );
  assert.equal(juneInstagramAccount?.username, coreSocialFriends.CORE_SOCIAL_CHARACTERS.june.socialHandles.instagram, "Facebook and Instagram must resolve the same canonical June handle");
  assert.deepEqual([juneInstagramAccount?.discoveryUiStatus, juneInstagramAccount?.followUiStatus, juneInstagramAccount?.profileUiStatus], ["READY", "READY", "HOLD"]);
  assert.deepEqual(sharedCharacterMedia.SHARED_CHARACTER_MEDIA_IDS, ["june-ig-01", "june-ig-02", "june-ig-03", "june-ig-04", "june-profile-avatar", "june-fb-F", "june-fb-10-18-01", "june-fb-10-18-02", "june-facebook-profile-picture", "june-birthday-main", "june-birthday-gift", "june-birthday-bag", "june-sophie-girls", "sophie-june-club-photo", "june-family-graduation", "june-home-mobile", "june-starbucks-mobile", "jack-profile-picture", "jack-football-game", "jack-summer-party", "jack-beach-10", "jack-beach-8", "jack-car", "jack-matt-family", "jack-matt-01", "jack-matt-02", "jack-matt-03", "jack-owned-j-2009", "jack-tagged-sophie-02", "jack-tagged-sophie-03", "jack-tagged-luca-01", "jack-tagged-ryan", "jack-tagged-june", "jack-tagged-matt-02", "luca-jack-birthday-00", "luca-jack-birthday-01", "luca-jack-birthday-02", "luca-jack-birthday-03", "matt-jack-birthday", "jack-birthday-02", "jack-birthday-03", "jay-music-bedroom-2009-03-14", "jay-rehearsal-2009-06-27-01", "jay-rehearsal-2009-06-27-02", "jay-cd-haul-2009-08-22", "jay-learning-by-ear-2009-11-07", "jay-guitar", "jay-guitar-may", "jay-band-performance", "katie-selfie-july-2009", "katie-selfie-august-2009", "katie-profile-picture", "katie-selfie-july-2010", "katie-selfie-september-2010", "luca-profile-picture", "luca-basketball-01", "luca-basketball-02", "luca-basketball-03", "luca-work-main-street-diner", "alex-profile-picture", "alex-dog-golden-2007", "alex-dogs-wangcai-bb-2009", "ben-profile-current", "ben-photo-friday-2010", "ben-profile-2005", "ben-coffee-2006", "ben-coffee-2009", "ben-car-2010", "chris-profile-picture", "matt-profile-current", "matt-profile-2007", "matt-photo-2007", "matt-code-2010"]);
  assert.deepEqual(
    sharedCharacterMedia.SHARED_CHARACTER_MEDIA_IDS.map(id => {
      const media = sharedCharacterMedia.getSharedCharacterMedia(id);
      return [media.id, media.originalFilename, media.canonicalCharacterId, media.platform, media.timestamp, media.role, media.initialVisibility];
    }),
    [
      ["june-ig-01", "IG01.JPG", "june", "instagram", "2010-10-20T00:05:30-07:00", "replacement", "hidden"],
      ["june-ig-02", "IG02.JPG", "june", "instagram", "2010-10-15", "nightclub-dancing", "visible"],
      ["june-ig-03", "IG03.JPG", "june", "instagram", "2010-10-16", "party", "visible"],
      ["june-ig-04", "IG04.JPG", "june", "instagram", "2010-10-20T00:00:00-07:00", "accidental-intimate", "visible"],
      ["june-profile-avatar", "June01.PNG", "june", "instagram", "2010-10-20", "profile-avatar", "visible"],
      ["june-fb-F", "June-F.PNG", "june", "facebook", "2010-10-19T23:51:00-07:00", "facebook-photo", "visible"],
      ["june-fb-10-18-01", "10-18-June.JPG", "june", "facebook", "2010-10-19T23:51:00-07:00", "facebook-photo", "visible"],
      ["june-fb-10-18-02", "10-18-June0.JPG", "june", "facebook", "2010-10-19T23:51:00-07:00", "facebook-photo", "visible"],
      ["june-facebook-profile-picture", "June01.PNG", "june", "facebook", "2010-10-10T16:00:00-07:00", "facebook-profile-picture", "visible"],
      ["june-birthday-main", "June-BH.PNG", "june", "facebook", "2010-06-06T20:30:00-07:00", "birthday", "visible"],
      ["june-birthday-gift", "June-BH01.jpg", "june", "facebook", "2010-06-06T21:05:00-07:00", "birthday", "visible"],
      ["june-birthday-bag", "June-BH02.jpg", "june", "facebook", "2010-06-06T21:08:00-07:00", "birthday", "visible"],
      ["june-sophie-girls", "June-Sophie Miller.PNG", "june", "facebook", "2010-08-14T22:30:00-07:00", "close-friend", "visible"],
      ["sophie-june-club-photo", "June-club.png", "june", "facebook", "2010-10-16T02:57:00-07:00", "close-friend", "visible"],
      ["june-family-graduation", "June-family.PNG", "june", "facebook", "2010-06-12T17:00:00-07:00", "graduation-family", "visible"],
      ["june-home-mobile", "June-home.PNG", "june", "facebook", "2010-09-26T19:30:00-07:00", "daily-life", "visible"],
      ["june-starbucks-mobile", "June02.PNG", "june", "facebook", "2010-10-18T14:10:00-07:00", "daily-life", "visible"],
["jack-profile-picture", "Jack01.PNG", "jack", "facebook", "2010-09-05T18:00:00-07:00", "facebook-profile-picture", "visible"],
["jack-football-game", "Game.PNG", "jack", "facebook", "2010-10-15T22:45:00-07:00", "facebook-photo", "visible"],
["jack-summer-party", "Jack-party.PNG", "jack", "facebook", "2010-08-22T17:30:00-07:00", "party", "visible"],
["jack-beach-10", "Beach-10.PNG", "jack", "facebook", "2010-08-22T17:30:00-07:00", "party", "visible"],
["jack-beach-8", "Beach-8.PNG", "jack", "facebook", "2010-08-22T17:30:00-07:00", "party", "visible"],
["jack-car", "Jack-car.PNG", "jack", "facebook", "2009-11-14T21:10:00-08:00", "car-history", "visible"],
["jack-matt-family", "Jack-Matt- Family.PNG", "jack", "facebook", "2007-06-16T18:40:00-07:00", "friendship-history", "visible"],
["jack-matt-01", "Jack-Matt.PNG", "jack", "facebook", "2010-10-18T22:34:00-07:00", "friendship-history", "visible"],
["jack-matt-02", "Jack-Matt02.PNG", "jack", "facebook", "2009-11-14T21:10:00-08:00", "friendship-history", "visible"],
["jack-matt-03", "Jack-Matt03.JPG", "jack", "facebook", "2008-09-20T19:32:00-07:00", "friendship-history", "visible"],
["jack-owned-j-2009", "J.png", "jack", "facebook", "2009-04-15T16:00:00-07:00", "facebook-photo", "visible"],
["jack-tagged-sophie-02", "Tagged02.png", "jack", "facebook", "2010-08-24T20:00:00-07:00", "facebook-photo", "visible"],
["jack-tagged-sophie-03", "Tagged03.png", "jack", "facebook", "2010-08-24T20:00:00-07:00", "facebook-photo", "visible"],
["jack-tagged-luca-01", "Tagged01.png", "jack", "facebook", "2010-09-14T20:00:00-07:00", "facebook-photo", "visible"],
["jack-tagged-ryan", "Tagged-J.png", "jack", "facebook", "2010-09-27T21:00:00-07:00", "facebook-photo", "visible"],
["jack-tagged-june", "Tagged.png", "jack", "facebook", "2010-09-27T21:00:00-07:00", "facebook-photo", "visible"],
["jack-tagged-matt-02", "Jack02.PNG", "jack", "facebook", "2010-10-03T20:00:00-07:00", "friendship-history", "visible"],
["luca-jack-birthday-00", "JBH00.png", "luca", "facebook", "2010-08-02T23:17:00-07:00", "birthday", "visible"],
["luca-jack-birthday-01", "JBH01.png", "luca", "facebook", "2010-08-02T23:17:00-07:00", "birthday", "visible"],
["luca-jack-birthday-02", "JBH02.png", "luca", "facebook", "2010-08-02T23:17:00-07:00", "birthday", "visible"],
["luca-jack-birthday-03", "JBH03.png", "luca", "facebook", "2010-08-02T23:17:00-07:00", "birthday", "visible"],
["matt-jack-birthday", "JackBH.png", "matt", "facebook", "2010-08-02T23:49:00-07:00", "birthday", "visible"],
["jack-birthday-02", "BH02.png", "jack", "facebook", "2010-08-03T13:08:00-07:00", "birthday", "visible"],
      ["jack-birthday-03", "BH03.png", "jack", "facebook", "2010-08-03T13:08:00-07:00", "birthday", "visible"],
      ["jay-music-bedroom-2009-03-14", "2009-03-14.png", "jay", "facebook", "2009-03-14T22:18:00-07:00", "music-listening", "visible"],
      ["jay-rehearsal-2009-06-27-01", "2009-06-27.JPG", "jay", "facebook", "2009-06-27T20:46:00-07:00", "music-rehearsal", "visible"],
      ["jay-rehearsal-2009-06-27-02", "2009-06-27-.png", "jay", "facebook", "2009-06-27T20:46:00-07:00", "music-rehearsal", "visible"],
      ["jay-cd-haul-2009-08-22", "2009-08-22 — CD haul.png", "jay", "facebook", "2009-08-22T15:22:00-07:00", "music-purchase", "visible"],
      ["jay-learning-by-ear-2009-11-07", "2009-11-07 — “trying to figure this one out”.png", "jay", "facebook", "2009-11-07T23:08:00-08:00", "guitar-practice", "visible"],
      ["jay-guitar", "Jay01.PNG", "jay", "facebook", "2010-10-17T21:12:00-07:00", "music-context", "visible"],
      ["jay-guitar-may", "Jay02.PNG", "jay", "facebook", "2010-05-15T18:00:00-07:00", "music-guitar-still-life", "visible"],
      ["jay-band-performance", "10-18.JPG", "jay", "facebook", "2010-10-19T22:00:00-07:00", "band-performance", "visible"],
      ["katie-selfie-july-2009", "Katie01.jpg", "katie", "facebook", "2009-07-18T17:00:00-07:00", "facebook-selfie", "visible"],
      ["katie-selfie-august-2009", "Katie02.jpg", "katie", "facebook", "2009-08-22T16:00:00-07:00", "facebook-selfie", "visible"],
      ["katie-profile-picture", "Katie03.PNG", "katie", "facebook", "2010-10-10T16:00:00-07:00", "facebook-profile-picture", "visible"],
      ["katie-selfie-july-2010", "Katie04.jpg", "katie", "facebook", "2010-07-17T15:00:00-07:00", "facebook-selfie", "visible"],
      ["katie-selfie-september-2010", "Katie05.jpg", "katie", "facebook", "2010-09-11T14:00:00-07:00", "facebook-selfie", "visible"],
      ["luca-profile-picture", "Luca.png", "luca", "facebook", "2010-10-20T00:00:00-07:00", "facebook-profile-picture", "visible"],
      ["luca-basketball-01", "guys.png", "luca", "facebook", "2010-10-19T22:58:00-07:00", "basketball-friends", "visible"],
      ["luca-basketball-02", "guys02.PNG", "luca", "facebook", "2010-10-19T22:58:00-07:00", "basketball-friends", "visible"],
      ["luca-basketball-03", "guys03.png", "luca", "facebook", "2010-10-19T22:58:00-07:00", "basketball-friends", "visible"],
      ["luca-work-main-street-diner", "Luca-work.png", "luca", "facebook", "2010-03-20T22:30:00-07:00", "restaurant-work", "visible"],
      ["alex-profile-picture", "Alex.png", "alex", "facebook", "2010-10-01T16:00:00-07:00", "facebook-profile-picture", "visible"],
      ["alex-dog-golden-2007", "Alex01.PNG", "alex", "facebook", "2007-10-03T16:00:00-07:00", "dog-history", "visible"],
      ["alex-dogs-wangcai-bb-2009", "Alex-dogs.PNG", "alex", "facebook", "2009-05-08T16:00:00-07:00", "dog-history", "visible"],
      ["ben-profile-current", "Ben01.JPG", "ben", "facebook", "2010-10-15T22:12:00-07:00", "facebook-profile-picture", "visible"],
      ["ben-photo-friday-2010", "Ben01.JPG", "ben", "facebook", "2010-10-15T21:49:00-07:00", "office-life", "visible"],
      ["ben-profile-2005", "Ben0.png", "ben", "facebook", "2005-09-18T16:00:00-07:00", "facebook-profile-picture", "visible"],
      ["ben-coffee-2006", "Ben-coffee.PNG", "ben", "facebook", "2006-08-12T16:00:00-07:00", "coffee-history", "visible"],
      ["ben-coffee-2009", "Ben-coffee02.JPG", "ben", "facebook", "2009-02-14T16:00:00-08:00", "coffee-history", "visible"],
      ["ben-car-2010", "Ben-car.JPG", "ben", "facebook", "2010-07-10T16:00:00-07:00", "car-history", "visible"],
      ["chris-profile-picture", "Chris01.PNG", "chris", "facebook", "2009-11-14T20:30:00-08:00", "facebook-profile-picture", "visible"],
      ["matt-profile-current", "Matt03.JPG", "matt", "facebook", "2010-10-02T21:18:00-07:00", "facebook-profile-picture", "visible"],
      ["matt-profile-2007", "Matt01.JPG", "matt", "facebook", "2007-08-18T20:10:00-07:00", "facebook-profile-picture", "visible"],
      ["matt-photo-2007", "Matt02.JPG", "matt", "facebook", "2007-09-25T21:14:00-07:00", "facebook-photo", "visible"],
      ["matt-code-2010", "Matt-code-10-15.PNG", "matt", "facebook", "2010-10-15T23:03:00-07:00", "code-project", "visible"],
    ],
  );
  assert.deepEqual(
    instagram.selectInstagramVisibleKnownPosts(instagramState, "june").map(post => [post.id, post.mediaId, post.timestamp, post.origin]),
    [
      ["june-ig-04", "june-ig-04", "2010-10-20T00:00:00-07:00", "seed"],
      ["june-ig-03", "june-ig-03", "2010-10-16", "seed"],
      ["june-ig-02", "june-ig-02", "2010-10-15", "seed"],
    ],
    "June profile must begin with the locked IG04 / IG03 / IG02 chronology",
  );
  const juneStatsAtSessionStart = instagram.selectInstagramKnownAccountStats(instagramState, "june");
  assert.deepEqual(juneStatsAtSessionStart, { posts: 3, followers: 118, following: 236 }, "June stats must combine curated social baselines with the visible-media count");
  assert.deepEqual(instagram.selectInstagramKnownAccountStats(instagramState, "june"), juneStatsAtSessionStart, "June social stats must be deterministic");
  assert.equal(instagramState.knownAccountPosts.some(post => post.id === "june-ig-01"), false, "IG01 must not be visible or instantiated at session start");
  let followingNavigationState = instagram.instagramStateTransition(instagramState, { type: "SHOW_PROFILE" });
  followingNavigationState = instagram.instagramStateTransition(followingNavigationState, { type: "SHOW_FOLLOWING" });
  assert.deepEqual([followingNavigationState.currentView, instagram.selectInstagramFollowingCount(followingNavigationState)], ["following", 1]);
  followingNavigationState = instagram.instagramStateTransition(followingNavigationState, { type: "OPEN_KNOWN_PROFILE", characterId: "june" });
  assert.deepEqual([followingNavigationState.currentView, followingNavigationState.selectedKnownCharacterId, followingNavigationState.knownProfileOrigin], ["knownProfile", "june", "following"]);
  assert.deepEqual(instagram.selectInstagramVisibleKnownPosts(followingNavigationState, "june").map(post => post.id), ["june-ig-04", "june-ig-03", "june-ig-02"], "Following-opened June must use the canonical profile media selector");
  followingNavigationState = instagram.instagramStateTransition(followingNavigationState, { type: "SHOW_KNOWN_CONNECTIONS", kind: "following" });
  assert.deepEqual([followingNavigationState.currentView, followingNavigationState.selectedKnownCharacterId, followingNavigationState.knownConnectionsKind], ["knownConnections", "june", "following"]);
  followingNavigationState = instagram.instagramStateTransition(followingNavigationState, { type: "BACK_FROM_DISCOVERY" });
  assert.equal(followingNavigationState.currentView, "knownProfile");
  followingNavigationState = instagram.instagramStateTransition(followingNavigationState, { type: "BACK_FROM_DISCOVERY" });
  assert.equal(followingNavigationState.currentView, "following");
  followingNavigationState = instagram.instagramStateTransition(followingNavigationState, { type: "BACK_FROM_DISCOVERY" });
  assert.equal(followingNavigationState.currentView, "profile");
  assert.equal(timelineDefinitions.some(event => event.id === "instagram-june-jack-accidental-photo" || event.atElapsedSeconds === 80 && event.type === "instagramJunePost"), false, "IG04 must be seed content with no T+80 creation event");
  assert.equal(instagramPopular.INSTAGRAM_POPULAR_POSTS.length, 20, "Popular must register all twenty local photos in deterministic order");
  assert.equal(new Set(instagramPopular.INSTAGRAM_POPULAR_POSTS.map(post => post.id)).size, 20);
  assert.ok(instagramPopular.INSTAGRAM_POPULAR_POSTS.every(post => post.classification === "EPHEMERAL_INSTAGRAM_USER" && post.mediaStatus === "CURATED_LOCAL_ASSET" && typeof post.media === "string" && post.media.length > 0));
  assert.ok(instagramPopular.INSTAGRAM_POPULAR_POSTS.every(post => post.username !== "junepark" && post.canonicalCharacterId === undefined), "June and the canonical nine must not be inserted into Popular");
  const popularOrder = instagramPopular.INSTAGRAM_POPULAR_POSTS.map(post => post.id);
  let popularState = instagram.instagramStateTransition(instagramState, { type: "SHOW_POPULAR" });
  assert.equal(popularState.currentView, "popular");
  popularState = instagram.instagramStateTransition(popularState, { type: "SET_POPULAR_SCROLL_POSITION", scrollPosition: 87 });
  popularState = instagram.instagramStateTransition(popularState, { type: "REFRESH_POPULAR" });
  assert.deepEqual([popularState.popularScrollPosition, popularState.popularRefreshCount, instagramPopular.INSTAGRAM_POPULAR_POSTS.map(post => post.id)], [87, 1, popularOrder], "Popular refresh must retain deterministic ordering and local scroll state");
  popularState = instagram.instagramStateTransition(popularState, { type: "OPEN_POPULAR_PHOTO", postId: popularOrder[0] });
  assert.deepEqual([popularState.currentView, popularState.selectedPopularPostId], ["popularPhotoDetail", popularOrder[0]]);
  assert.equal(instagramPopular.getInstagramPopularPost(popularOrder[0]).media, instagramPopular.INSTAGRAM_POPULAR_POSTS[0].media, "Popular thumbnail and Photo Detail must resolve the same media record");
  popularState = instagram.instagramStateTransition(popularState, { type: "BACK_FROM_POPULAR_PHOTO" });
  assert.deepEqual([popularState.currentView, popularState.selectedPopularPostId, popularState.popularScrollPosition], ["popular", null, 87], "Popular Photo Detail Back must restore Popular and its scroll position");
  let dramaFacebook = facebook.createInitialFacebookState("Zoey");
  let dramaInstagram = instagram.createInitialInstagramState();
  const partyStateBeforeDrama = [dramaFacebook.partyInviteState, dramaFacebook.partyInviteEligibleFromJune, dramaFacebook.partyInviteEligibleFromJack, dramaFacebook.partyRsvp, dramaFacebook.friendRequestState];
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "DELIVER_JUNE_INSTAGRAM_ANNOUNCEMENT", timestamp: "12:03 AM", createdAt: "2010-10-20T00:03:00-07:00" });
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "DELIVER_JUNE_INSTAGRAM_ANNOUNCEMENT", timestamp: "12:03 AM", createdAt: "2010-10-20T00:03:00-07:00" });
  const juneInstagramPost = dramaFacebook.feed.find(item => item.id === "facebook-june-instagram-announcement");
  assert.deepEqual([juneInstagramPost?.friendId, juneInstagramPost?.text, juneInstagramPost?.timestamp, juneInstagramPost?.origin], ["june", "finally got instagram lol @junepark", "12:03 AM", "live"]);
  const juneInstagramLikeMilestones = [[60, 1], [82, 2], [94, 4], [113, 5], [136, 7], [164, 8], [190, 10], [225, 11], [270, 13], [326, 14], [377, 16], [438, 17], [501, 19], [568, 20], [645, 21], [718, 22], [790, 23]];
  assert.deepEqual(juneInstagramLikeMilestones.map(([second]) => facebook.selectFacebookLikes(dramaFacebook, "facebook-june-instagram-announcement", second).length), juneInstagramLikeMilestones.map(([, count]) => count), "June announcement Like growth must be deterministic, irregular, monotonic, and record-derived");
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "TOGGLE_LIKE", itemId: "facebook-june-instagram-announcement", displayName: "Zoey" });
  assert.equal(facebook.selectFacebookLikes(dramaFacebook, "facebook-june-instagram-announcement", 790).length, 24, "user Like must add to June's 23-record live baseline");
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "TOGGLE_LIKE", itemId: "facebook-june-instagram-announcement", displayName: "Zoey" });
  assert.equal(facebook.selectFacebookLikes(dramaFacebook, "facebook-june-instagram-announcement", 790).length, 23, "Unlike must restore June's live baseline");
  const juneShowLikeMilestones = [[0, 41], [125, 42], [198, 44], [290, 45], [365, 46], [470, 48], [590, 49], [690, 50], [805, 51]];
  assert.deepEqual(juneShowLikeMilestones.map(([second]) => facebook.selectFacebookLikes(dramaFacebook, "june-show-photos-oct19", second).length), juneShowLikeMilestones.map(([, count]) => count), "June show post must grow slowly from 41 to 51 through deterministic records");
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "TOGGLE_LIKE", itemId: "june-show-photos-oct19", displayName: "Zoey" });
  assert.equal(facebook.selectFacebookLikes(dramaFacebook, "june-show-photos-oct19", 805).length, 52);
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "TOGGLE_LIKE", itemId: "june-show-photos-oct19", displayName: "Zoey" });
  assert.equal(facebook.selectFacebookLikes(dramaFacebook, "june-show-photos-oct19", 805).length, 51);
  assert.equal(facebook.selectFacebookNotifications(dramaFacebook).length, 0, "June like growth must not create notification spam");
  assert.equal(dramaFacebook.feed.filter(item => item.id === "facebook-june-instagram-announcement").length, 1, "June announcement must deliver exactly once");
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "DELIVER_JUNE_JACK_GOSSIP", reactionId: "facebook-june-jack-gossip-katie", characterId: "katie", text: "june + jack???" });
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "DELIVER_EPHEMERAL_GOSSIP", postId: "facebook-june-jack-gossip-ryan-standalone", ephemeralId: "fof-ryan-001", text: "june + jack??? lol", timestamp: "12:04 AM", createdAt: "2010-10-20T00:04:15-07:00" });
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "DELIVER_EPHEMERAL_GOSSIP", postId: "facebook-june-jack-gossip-ryan-standalone", ephemeralId: "fof-ryan-001", text: "june + jack??? lol", timestamp: "12:04 AM", createdAt: "2010-10-20T00:04:15-07:00" });
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "DELIVER_JUNE_JACK_GOSSIP", reactionId: "facebook-june-jack-gossip-chris", characterId: "chris", text: "lol no way" });
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "DELIVER_KATIE_GOSSIP_MESSAGE", timestamp: "12:04 AM" });
  assert.deepEqual(dramaFacebook.comments.filter(comment => comment.itemId === "facebook-june-instagram-announcement").map(comment => [comment.id, comment.characterId, comment.text]), [["facebook-june-jack-gossip-katie", "katie", "june + jack???"], ["facebook-june-jack-gossip-chris", "chris", "lol no way"]]);
  assert.equal(dramaFacebook.comments.some(comment => comment.itemId === "facebook-june-instagram-announcement" && comment.characterId === "jay"), false, "Jay must have no June/Jack gossip activity");
  const standaloneGossip = dramaFacebook.feed.filter(item => item.id === "facebook-june-jack-gossip-ryan-standalone");
  assert.equal(standaloneGossip.length, 1, "exactly one ephemeral standalone June/Jack gossip post may exist");
  assert.deepEqual([standaloneGossip[0].actor, standaloneGossip[0].friendId, standaloneGossip[0].author, standaloneGossip[0].text, standaloneGossip[0].visibility, standaloneGossip[0].origin], [{ kind: "ephemeral-friend-of-friend", ephemeralId: "fof-ryan-001" }, undefined, "Ryan", "june + jack??? lol", "friends-of-friends", "live"]);
  assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS[standaloneGossip[0].actor.ephemeralId], undefined, "standalone gossip author must not be canonical");
  assert.deepEqual(timelineDefinitions.find(event => event.id === "facebook-june-jack-gossip-ryan-standalone")?.atElapsedSeconds, 135);
  assert.deepEqual(dramaFacebook.comments.filter(comment => comment.itemId === "facebook-june-instagram-announcement").map(comment => comment.text), ["june + jack???", "lol no way"]);
  assert.deepEqual(dramaFacebook.inboxThreads.find(thread => thread.id === "facebook-katie-jack-gossip-message"), { id: "facebook-katie-jack-gossip-message", friendId: "katie", sender: "Katie Dawson", preview: "Do you know Jack????", timestamp: "12:04 AM", status: "unread", origin: "live" });
  assert.equal(facebook.selectFacebookNotifications(dramaFacebook).filter(notification => notification.id === "facebook-notification-katie-gossip-message").length, 1, "Katie's unread message must drive one derived notification");
  const partyBeforeKatieReply = [dramaFacebook.partyInviteState, dramaFacebook.partyInviteEligibleFromJune, dramaFacebook.partyInviteEligibleFromJack, dramaFacebook.partyRsvp, dramaFacebook.friendRequestState];
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "OPEN_MESSAGE", messageId: "facebook-katie-jack-gossip-message" });
  assert.equal(dramaFacebook.inboxThreads.find(thread => thread.id === "facebook-katie-jack-gossip-message")?.status, "read", "opening Katie must clear the thread-derived unread state");
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "EDIT_MESSAGE_REPLY", value: "   " });
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "SUBMIT_MESSAGE_REPLY", displayName: "Zoey", timestamp: "12:05 AM" });
  assert.equal(facebook.selectFacebookThreadMessages(dramaFacebook, "facebook-katie-jack-gossip-message").length, 1, "whitespace-only Facebook replies must not send");
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "EDIT_MESSAGE_REPLY", value: "  who?  " });
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "SUBMIT_MESSAGE_REPLY", displayName: "Zoey", timestamp: "12:05 AM" });
  assert.deepEqual(facebook.selectFacebookThreadMessages(dramaFacebook, "facebook-katie-jack-gossip-message").map(message => [message.authorType, message.author, message.body, message.timestamp, message.origin]), [["character", "Katie Dawson", "Do you know Jack????", "12:04 AM", "live"], ["session-user", "Zoey", "  who?  ", "12:05 AM", "user"]]);
  assert.deepEqual([dramaFacebook.partyInviteState, dramaFacebook.partyInviteEligibleFromJune, dramaFacebook.partyInviteEligibleFromJack, dramaFacebook.partyRsvp, dramaFacebook.friendRequestState], partyBeforeKatieReply, "Katie reply must remain independent from Jack and party state");
  assert.equal(facebook.selectFacebookNotifications(dramaFacebook).find(notification => notification.id === "facebook-notification-katie-gossip-message")?.unread, false, "sending a reply must not create self-unread state");
  const persistedKatieMessages = facebook.selectFacebookThreadMessages(facebook.facebookStateTransition(facebook.facebookStateTransition(dramaFacebook, { type: "SHOW_HOME" }), { type: "OPEN_MESSAGE", messageId: "facebook-katie-jack-gossip-message" }), "facebook-katie-jack-gossip-message");
  assert.equal(persistedKatieMessages.filter(message => message.origin === "user").length, 1, "Facebook reply must persist across navigation without duplication");
  dramaInstagram = instagram.instagramStateTransition(dramaInstagram, { type: "DELETE_KNOWN_ACCOUNT_POST", postId: "june-ig-04" });
  assert.deepEqual(instagram.selectInstagramVisibleKnownPosts(dramaInstagram, "june").map(post => post.id), ["june-ig-03", "june-ig-02"], "deleted IG04 must disappear while older seed posts remain");
  assert.deepEqual(instagram.selectInstagramKnownAccountStats(dramaInstagram, "june"), { posts: 2, followers: 118, following: 236 }, "IG04 deletion must decrement only June's derived post count");
  assert.equal(dramaFacebook.comments.filter(comment => comment.itemId === "facebook-june-instagram-announcement").length, 2, "Facebook gossip must persist after Instagram deletion");
  assert.deepEqual(timelineDefinitions.filter(event => event.type === "facebookSophieJuneComment").map(event => [event.id, event.atElapsedSeconds, event.deliveryPolicy]), [["facebook-sophie-june-instagram-comment-1", 780, "internal"], ["facebook-sophie-june-instagram-comment-2", 795, "internal"]]);
  const notificationsBeforeSophie = facebook.selectFacebookNotifications(dramaFacebook);
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "DELIVER_SOPHIE_JUNE_COMMENT", commentId: "facebook-sophie-june-instagram-comment-1", text: "what are you doing???" });
  assert.equal(facebook.selectFacebookComments(dramaFacebook, "facebook-june-instagram-announcement").length, 3);
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "DELIVER_SOPHIE_JUNE_COMMENT", commentId: "facebook-sophie-june-instagram-comment-2", text: "Jack????" });
  dramaFacebook = facebook.facebookStateTransition(dramaFacebook, { type: "DELIVER_SOPHIE_JUNE_COMMENT", commentId: "facebook-sophie-june-instagram-comment-2", text: "Jack????" });
  const sophieJuneComments = facebook.selectFacebookComments(dramaFacebook, "facebook-june-instagram-announcement").filter(comment => comment.ephemeralAuthor?.id === "facebook-ephemeral-sophie");
  assert.deepEqual(sophieJuneComments.map(comment => [comment.id, comment.text, comment.classification]), [["facebook-sophie-june-instagram-comment-1", "what are you doing???", "CURATED / RELATIONSHIP-AMBIGUITY"], ["facebook-sophie-june-instagram-comment-2", "Jack????", "CURATED / RELATIONSHIP-AMBIGUITY"]]);
  assert.equal(facebook.selectFacebookComments(dramaFacebook, "facebook-june-instagram-announcement").length, 4, "Sophie comments must increment the real thread from two to four without duplication");
  assert.deepEqual(facebook.selectFacebookNotifications(dramaFacebook), notificationsBeforeSophie, "Sophie comments must not create notification spam");
  const sophieJuneActor = facebook.resolveFacebookCommentActor(sophieJuneComments[0], "Zoey");
  let sophieJuneNavigation = facebook.facebookStateTransition(dramaFacebook, { type: "SHOW_FEED" });
  sophieJuneNavigation = facebook.facebookStateTransition(sophieJuneNavigation, { type: "OPEN_FEED_ITEM", itemId: "facebook-june-instagram-announcement", scrollPosition: 61 });
  sophieJuneNavigation = facebook.facebookStateTransition(sophieJuneNavigation, { type: "OPEN_COMMENT_AUTHOR", actor: sophieJuneActor });
  assert.deepEqual([sophieJuneNavigation.currentView, sophieJuneNavigation.selectedProfileName, facebookActorMedia.getFacebookEphemeralProfileMediaId(sophieJuneNavigation.selectedProfileActor.ephemeralId)], ["profile", "Sophie Miller", "facebook-sophie-avatar"]);
  sophieJuneNavigation = facebook.facebookStateTransition(sophieJuneNavigation, { type: "GO_BACK" });
  assert.deepEqual([sophieJuneNavigation.currentView, sophieJuneNavigation.selectedFeedItemId, sophieJuneNavigation.scrollPosition, facebook.selectFacebookComments(sophieJuneNavigation, "facebook-june-instagram-announcement").length], ["feedDetail", "facebook-june-instagram-announcement", 61, 4]);
  assert.equal(facebook.selectFacebookComments(facebook.createInitialFacebookState("Zoey"), "facebook-june-instagram-announcement").length, 0, "new session must reset Sophie's live comments");
  assert.equal(dramaFacebook.feed.filter(item => item.id === "facebook-june-jack-gossip-ryan-standalone").length, 1, "standalone gossip must remain after IG04 deletion");
  assert.equal(dramaFacebook.feed.some(item => item.friendId === "jay" && /june|jack/.test(item.text) && item.id !== "alex-jacks-party-friday"), false, "Jay must have no standalone June/Jack gossip post");
  assert.equal(dramaFacebook.feed.some(item => item.friendId === "matt" && /june|jack/.test(item.text)), false, "Matt must have no June/Jack gossip post");
  dramaInstagram = instagram.instagramStateTransition(dramaInstagram, { type: "DELIVER_KNOWN_ACCOUNT_POST", post: { id: "june-ig-01", mediaId: "june-ig-01", timestamp: "2010-10-20T00:05:30-07:00" } });
  assert.deepEqual(instagram.selectInstagramVisibleKnownPosts(dramaInstagram, "june").map(post => [post.id, post.mediaId]), [["june-ig-01", "june-ig-01"], ["june-ig-03", "june-ig-03"], ["june-ig-02", "june-ig-02"]]);
  assert.deepEqual(instagram.selectInstagramKnownAccountStats(dramaInstagram, "june"), { posts: 3, followers: 118, following: 236 }, "IG01 replacement must restore June's derived post count");
  assert.equal(dramaInstagram.knownAccountPosts.find(post => post.id === "june-ig-04")?.status, "deleted", "IG04 deletion must persist after IG01 appears");
  assert.deepEqual([dramaFacebook.partyInviteState, dramaFacebook.partyInviteEligibleFromJune, dramaFacebook.partyInviteEligibleFromJack, dramaFacebook.partyRsvp, dramaFacebook.friendRequestState], partyStateBeforeDrama, "Instagram drama must not mutate party, RSVP, or Jack request state");
  let interactionFacebook = facebook.createInitialFacebookState("Zoey");
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "BEGIN_COMMENT", itemId: "ben-long-day" });
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "EDIT_COMMENT", value: "same" });
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "SUBMIT_COMMENT", displayName: "Zoey" });
  assert.equal(facebook.formatFacebookCommentCount(facebook.selectFacebookComments(interactionFacebook, "ben-long-day").length), "1 comment");
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "BEGIN_COMMENT", itemId: "ben-long-day" });
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "EDIT_COMMENT", value: "really" });
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "SUBMIT_COMMENT", displayName: "Zoey" });
  assert.equal(facebook.formatFacebookCommentCount(facebook.selectFacebookComments(interactionFacebook, "ben-long-day").length), "2 comments");
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "TOGGLE_LIKE", itemId: "ben-long-day", displayName: "Zoey" });
  assert.deepEqual(facebook.selectFacebookLikes(interactionFacebook, "ben-long-day", 0).map(like => [like.displayName, like.origin]), [["Zoey", "user"]]);
  let commentNavigation = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "SHOW_FEED" });
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "SET_SCROLL_POSITION", scrollPosition: 132 });
  const feedIdsBeforeLike = commentNavigation.feed.map(item => item.id);
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "TOGGLE_LIKE", itemId: "alex-jacks-party-friday", displayName: "Zoey" });
  assert.deepEqual([commentNavigation.scrollPosition, commentNavigation.feed.map(item => item.id)], [132, feedIdsBeforeLike], "Feed Like must preserve scroll state and exact story ordering");
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "OPEN_PROFILE", profileName: "Alex Wong", scrollPosition: 146 });
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "GO_BACK" });
  assert.deepEqual([commentNavigation.currentView, commentNavigation.scrollPosition], ["feed", 146], "Feed actor Profile Back must restore the live Feed scroll snapshot");
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "SHOW_HOME" });
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "SHOW_FEED" });
  assert.equal(commentNavigation.scrollPosition, 0, "an explicit fresh News Feed entry must start at the top");
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "OPEN_FEED_ITEM", itemId: "alex-jacks-party-friday", scrollPosition: 84 });
  const commentStateBeforeProfile = [commentNavigation.selectedFeedItemId, commentNavigation.scrollPosition, commentNavigation.comments.length, commentNavigation.likes.length, commentNavigation.partyInviteState];
  const jayComment = commentNavigation.comments.find(comment => comment.id === "alex-party-comment-jay");
  const jayActor = facebook.resolveFacebookCommentActor(jayComment, "Zoey");
  assert.deepEqual(jayActor, { kind: "canonical", characterId: "jay", displayName: "Jay Diaz" });
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "OPEN_COMMENT_AUTHOR", actor: jayActor });
  assert.deepEqual([commentNavigation.currentView, commentNavigation.selectedProfileName, commentNavigation.selectedProfileActor], ["profile", "Jay Diaz", jayActor]);
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "GO_BACK" });
  assert.deepEqual([commentNavigation.currentView, commentNavigation.selectedFeedItemId, commentNavigation.scrollPosition, commentNavigation.comments.length, commentNavigation.likes.length, commentNavigation.partyInviteState], ["feedDetail", ...commentStateBeforeProfile]);
  const ryanComment = commentNavigation.comments.find(comment => comment.id === "alex-party-comment-ryan");
  const ryanActor = facebook.resolveFacebookCommentActor(ryanComment, "Zoey");
  assert.deepEqual(ryanActor, { kind: "ephemeral-friend-of-friend", ephemeralId: "fof-ryan-001", displayName: "Ryan", classification: "EPHEMERAL_FRIEND_OF_FRIEND" });
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "OPEN_COMMENT_AUTHOR", actor: ryanActor });
  assert.deepEqual([commentNavigation.currentView, commentNavigation.selectedProfileName, commentNavigation.selectedProfileActor?.kind], ["profile", "Ryan", "ephemeral-friend-of-friend"]);
  assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS.ryan, undefined, "Ryan must remain outside the canonical character registry");
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "GO_BACK" });
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "BEGIN_COMMENT", itemId: "alex-jacks-party-friday" });
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "EDIT_COMMENT", value: "user note" });
  commentNavigation = facebook.facebookStateTransition(commentNavigation, { type: "SUBMIT_COMMENT", displayName: "Zoey" });
  assert.equal(facebook.selectFacebookComments(commentNavigation, "alex-jacks-party-friday").length, 3, "one user comment must coexist with Alex's two scoped baseline comments");
  const userCommentActor = facebook.resolveFacebookCommentActor(commentNavigation.comments.find(comment => comment.origin === "user"), "Zoey");
  assert.deepEqual(userCommentActor, { kind: "session-user", displayName: "Zoey" }, "session-user comments must route to the current user Profile");
  const lucaAlbum = interactionFacebook.feed.find(item => item.id === "luca-pickup-basketball-photos");
  assert.deepEqual([lucaAlbum?.kind, lucaAlbum?.mediaId, lucaAlbum?.mediaIds, lucaAlbum?.photoCount, lucaAlbum?.text, lucaAlbum?.relatedCharacterIds], ["album", "luca-basketball-01", ["luca-basketball-01", "luca-basketball-02", "luca-basketball-03"], 3, "added 3 new photos from pickup basketball.", ["chris"]]);
  const lucaCheckIn = interactionFacebook.feed.find(item => item.id === "luca-main-street-diner-checkin");
  const lucaWorkPhoto = interactionFacebook.feed.find(item => item.id === "luca-work-main-street-diner");
  const foursquareMainStreetDiner = seed.foursquare.venues.find(venue => venue.id === "main-street-diner");
  assert.deepEqual([lucaCheckIn?.venueId, lucaWorkPhoto?.venueId, foursquareMainStreetDiner?.id, foursquareMainStreetDiner?.name], ["main-street-diner", "main-street-diner", "main-street-diner", "Main Street Diner"], "Facebook check-in, work photo and Foursquare must share one canonical Main Street Diner identity");
  assert.equal(seed.foursquare.venues.filter(venue => venue.id === "main-street-diner").length, 1, "Main Street Diner must have exactly one Foursquare venue record");
  assert.equal(facebook.selectFacebookVisibleFeed(interactionFacebook).some(item => item.id === "alex-profile-picture-update" || item.id === "alex-dogs-wangcai-bb-2009" || item.id === "alex-dog-golden-2007"), false, "Alex historical media must remain outside the current October Feed");
  const benHistoricalStatusIds = interactionFacebook.feed.filter(item => item.id.startsWith("ben-wall-")).map(item => item.id);
  assert.equal(benHistoricalStatusIds.length, 30, "Ben must have exactly 30 deterministic historical Wall statuses");
  assert.deepEqual(benHistoricalStatusIds, ["ben-wall-2010-10-12-coffee", "ben-wall-2010-10-04-spreadsheet", "ben-wall-2010-09-29-still-here", "ben-wall-2010-09-10-numbers", "ben-wall-2010-08-27-home", "ben-wall-2010-08-18-printer", "ben-wall-2010-08-06-emails", "ben-wall-2010-07-23-friday", "ben-wall-2010-07-12-monday", "ben-wall-2010-07-02-weekend", "ben-wall-2010-06-29-quarter-end", "ben-wall-2010-06-11-office", "ben-wall-2010-05-25-excel", "ben-wall-2010-05-14-weekend", "ben-wall-2010-05-06-coffee", "ben-wall-2010-04-27-tuesday", "ben-wall-2010-04-16-meeting", "ben-wall-2010-04-09-outside", "ben-wall-2010-03-31-month-end", "ben-wall-2010-03-12-client", "ben-wall-2010-02-26-numbers", "ben-wall-2010-02-19-lunch", "ben-wall-2010-02-05-commute", "ben-wall-2010-01-21-meeting", "ben-wall-2010-01-08-inbox", "ben-wall-2009-12-29-still-here", "ben-wall-2009-12-18-friday", "ben-wall-2009-12-04-spreadsheet", "ben-wall-2009-11-24-printer", "ben-wall-2009-11-06-coffee"], "Ben Wall statuses must remain explicit and newest-first");
  const benProfileWall = facebook.selectFacebookProfileWall(interactionFacebook, "Ben Dawson");
  assert.equal(benProfileWall.some(item => item.id === "ben-long-day" && item.text === "Long day."), true, "Ben Profile Wall must preserve the current Long day. status");
  assert.equal(benHistoricalStatusIds.every(id => benProfileWall.some(item => item.id === id)), true, "all Ben historical statuses must be discoverable from his Profile Wall");
  let benWallNavigation = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "OPEN_PROFILE", profileName: "Ben Dawson" });
  benWallNavigation = facebook.facebookStateTransition(benWallNavigation, { type: "SET_PROFILE_WALL_SCROLL_POSITION", profileName: "Ben Dawson", scrollPosition: 900 });
  benWallNavigation = facebook.facebookStateTransition(benWallNavigation, { type: "TOGGLE_LIKE", itemId: "ben-long-day", displayName: "Zoey" });
  assert.deepEqual([benWallNavigation.profileWallScrollPositions["Ben Dawson"], benWallNavigation.scrollPosition], [900, 0], "Ben Wall Like must preserve Wall position without contaminating Feed scroll state");
  benWallNavigation = facebook.facebookStateTransition(benWallNavigation, { type: "SET_PROFILE_SECTION", section: "info" });
  benWallNavigation = facebook.facebookStateTransition(benWallNavigation, { type: "SET_PROFILE_SECTION", section: "wall" });
  assert.equal(benWallNavigation.profileWallScrollPositions["Ben Dawson"], 900, "Ben Wall tab round-trip must preserve its own position");
  benWallNavigation = facebook.facebookStateTransition(benWallNavigation, { type: "OPEN_FEED_ITEM", itemId: "ben-long-day", scrollPosition: 912, origin: "profileWall", profileName: "Ben Dawson" });
  benWallNavigation = facebook.facebookStateTransition(benWallNavigation, { type: "GO_BACK" });
  assert.deepEqual([benWallNavigation.currentView, benWallNavigation.selectedProfileName, benWallNavigation.profileWallScrollPositions["Ben Dawson"], benWallNavigation.scrollPosition], ["profile", "Ben Dawson", 912, 0], "Ben Wall Post Detail Back must restore the exact Wall snapshot and preserve Feed isolation");
  benWallNavigation = facebook.facebookStateTransition(benWallNavigation, { type: "OPEN_PROFILE", profileName: "Jack Keller" });
  assert.deepEqual([benWallNavigation.profileWallScrollPositions["Ben Dawson"], benWallNavigation.profileWallScrollPositions["Jack Keller"] ?? 0], [912, 0], "Ben Wall position must not leak into Jack or another profile");
  const benFeedAtSessionStart = facebook.selectFacebookVisibleFeed(interactionFacebook, Date.parse("2010-10-20T00:02:00-07:00"));
  assert.equal(benFeedAtSessionStart.some(item => item.id === "ben-photo-friday-2010"), true, "Ben's Oct 15 Friday photo must be eligible for the current Feed");
  assert.equal(facebook.isFacebookNewsFeedEligible(interactionFacebook, interactionFacebook.feed.find(item => item.id === "ben-photo-friday-2010"), Date.parse("2010-10-20T00:02:00-07:00")), true, "Ben's canonical Friday photo must pass centralized Feed eligibility");
  assert.equal(benFeedAtSessionStart.some(item => item.id.startsWith("ben-wall-") || ["ben-profile-current-update", "ben-car-2010", "ben-coffee-2009", "ben-coffee-2006", "ben-profile-2005-update"].includes(item.id)), false, "Ben Wall-only and Profile-activity records must remain outside the current Feed");
  const chrisProfileWallHistory = facebook.selectFacebookProfileWall(interactionFacebook, "Chris Morgan").filter(item => item.profileWallEligible === true);
  assert.deepEqual(chrisProfileWallHistory.map(item => [item.id, item.mediaId, item.createdAt]), [["chris-profile-picture-update", "chris-profile-picture", "2009-11-14T20:30:00-08:00"]], "Chris historical Profile Wall must remain intentionally sparse");
  assert.equal(facebook.selectFacebookVisibleFeed(interactionFacebook).some(item => item.id === "chris-profile-picture-update"), false, "Chris historical profile-picture update must not enter the current Feed");
  assert.deepEqual(facebook.selectFacebookProfileWall(interactionFacebook, "Matt Ricci").filter(item => item.profileWallEligible === true).map(item => item.id), ["matt-code-photo-2010", "matt-jack-tagged-photo", "matt-profile-current-update", "matt-jack-birthday-photo", "matt-photo-2007", "matt-profile-2007-update"], "Matt Profile Wall must remain sparse and newest-first");
  const mattCodeStory = interactionFacebook.feed.find(item => item.id === "matt-code-photo-2010");
  assert.deepEqual([mattCodeStory?.createdAt, mattCodeStory?.visibility, mattCodeStory?.mediaId], ["2010-10-15T23:03:00-07:00", "friends", "matt-code-2010"], "Matt's Oct 15 story must retain its canonical timestamp and media identity");
  assert.equal(facebook.isFacebookNewsFeedEligible(interactionFacebook, mattCodeStory, Date.parse("2010-10-20T00:02:00-07:00")), true, "Matt's Oct 15 story must pass centralized Feed eligibility at session start");
  assert.equal(facebook.selectFacebookVisibleFeed(interactionFacebook).some(item => item.id === "matt-code-photo-2010"), true, "Matt's Oct 15 story must enter the final Feed candidate list");
  assert.equal(facebook.selectFacebookVisibleFeed(interactionFacebook).some(item => item.id.startsWith("matt-profile-") || item.id === "matt-photo-2007"), false, "Matt Profile-activity and pre-2010 media must remain outside the current Feed");
  const canonicalFeedIdsBeforeSort = interactionFacebook.feed.map(item => item.id);
  const feedAtSessionStart = facebook.selectFacebookVisibleFeed(interactionFacebook, Date.parse("2010-10-20T00:02:00-07:00"));
  const feedTimeValues = feedAtSessionStart.map(item => Date.parse(item.createdAt));
  assert.equal(feedTimeValues.every((value, index) => index === 0 || feedTimeValues[index - 1] >= value), true, "News Feed timestamps must be monotonically descending");
  const chronologyIds = feedAtSessionStart.map(item => item.id);
  const chronologyIndex = (id) => chronologyIds.indexOf(id);
  assert.equal(["jack-football-game-photo", "matt-jack-tagged-photo", "luca-jack-tagged-photo", "sophie-jack-tagged-02", "jack-summer-party-photo"].every(id => chronologyIndex(id) >= 0), true, "chronology fixtures must all remain eligible Feed candidates");
  assert.ok(chronologyIndex("jack-football-game-photo") < chronologyIndex("matt-jack-tagged-photo"), "Oct 15 must sort above Oct 3");
  assert.ok(chronologyIndex("matt-jack-tagged-photo") < chronologyIndex("luca-jack-tagged-photo"), "Oct 3 must sort above Sep 14");
  assert.ok(chronologyIndex("luca-jack-tagged-photo") < chronologyIndex("sophie-jack-tagged-02"), "September must sort above August");
  assert.ok(chronologyIndex("sophie-jack-tagged-02") < chronologyIndex("jack-summer-party-photo"), "Aug 24 must sort above Aug 22");
  assert.ok(chronologyIndex("sophie-jack-tagged-02") < chronologyIndex("sophie-jack-tagged-03"), "equal timestamps must use canonical story ID as deterministic tie-breaker");
  const reversedFeedState = { ...interactionFacebook, feed: [...interactionFacebook.feed].reverse() };
  assert.deepEqual(facebook.selectFacebookVisibleFeed(reversedFeedState).map(item => item.id), facebook.selectFacebookVisibleFeed(interactionFacebook).map(item => item.id), "seed declaration order must not determine News Feed chronology");
  assert.deepEqual(interactionFacebook.feed.map(item => item.id), canonicalFeedIdsBeforeSort, "News Feed sorting must not mutate canonical state order");
  assert.equal(feedAtSessionStart.some(item => ["jack-car-matt-2009-photos", "jack-owned-j-2009-photo", "jack-matt-2008-photo", "jack-matt-family-2007-photo"].includes(item.id)), false, "all pre-2010 Jack stories must fail the News Feed year gate");
  assert.equal(facebook.selectFacebookProfileWall(interactionFacebook, "Jack Keller").some(item => item.id === "jack-car-matt-2009-photos"), true, "the 2009 Jack story must remain on Jack Wall");
  assert.equal(feedAtSessionStart.some(item => item.id === "alex-dog-golden-2007"), false, "Alex's 2007 dog photo must fail the News Feed year gate");
  assert.equal(facebookAlbums.getFacebookAlbum("alex-dogs")?.mediaIds.includes("alex-dog-golden-2007"), true, "Alex's 2007 dog photo must remain in Photos");
  assert.equal(feedAtSessionStart.some(item => item.id === "matt-photo-2007"), false, "Matt's 2007 photo must fail the News Feed year gate");
  assert.equal(facebookAlbums.getFacebookAlbum("matt-photos")?.mediaIds.includes("matt-photo-2007"), true, "Matt's 2007 photo must remain in his album");
  assert.equal(feedAtSessionStart.some(item => item.id === "ben-long-day"), true, "a visible 2010 story may remain Feed-eligible");
  assert.ok(chronologyIndex("matt-code-photo-2010") < chronologyIndex("ben-photo-friday-2010"), "Matt's 11:03 PM Oct 15 story must sort above Ben's 9:49 PM Oct 15 story");
  assert.equal(new Set(interactionFacebook.feed.map(item => item.id)).size, interactionFacebook.feed.length, "Feed eligibility corrections must not duplicate canonical stories");
  assert.equal(feedAtSessionStart.some(item => item.id === "june-starbucks-photo"), false, "a 2010 custom story must still obey audience visibility");
  const deliveredFutureLiveState = facebook.facebookStateTransition(facebook.createInitialFacebookState("Visitor"), { type: "DELIVER_JUNE_INSTAGRAM_ANNOUNCEMENT", timestamp: "12:03 AM", createdAt: "2010-10-20T00:03:00-07:00" });
  assert.equal(facebook.selectFacebookVisibleFeed(deliveredFutureLiveState, Date.parse("2010-10-20T00:02:59-07:00")).some(item => item.id === "facebook-june-instagram-announcement"), false, "a delivered 2010 live story must not appear before its canonical timestamp");
  const feedWithDeliveredLiveStory = facebook.selectFacebookVisibleFeed(deliveredFutureLiveState, Date.parse("2010-10-20T00:03:00-07:00"));
  assert.equal(feedWithDeliveredLiveStory.some(item => item.id === "facebook-june-instagram-announcement"), true, "a delivered live story may appear at its canonical timestamp");
  assert.equal(feedWithDeliveredLiveStory[0]?.id, "facebook-june-instagram-announcement", "a delivered Oct 20 live story must sort above Oct 19 content");
  assert.equal(facebookAlbums.getFacebookAlbum("luca-pickup-basketball")?.ownerActor.displayName, "Luca Bennett", "Luca must remain the owner of Pickup Basketball media");
  assert.equal(interactionFacebook.likes.some(like => like.itemId === "luca-pickup-basketball-photos" && like.characterId === "chris"), true, "Chris must retain his Like on Luca's basketball content");
  assert.deepEqual(facebook.selectFacebookComments(interactionFacebook, "luca-pickup-basketball-photos").filter(comment => comment.characterId === "chris").map(comment => comment.text), ["my shot was clean tho lol", "details details"], "Chris must retain his two comments on Luca's basketball content");
  assert.equal(interactionFacebook.feed.find(item => item.id === "alex-jacks-party-friday")?.text, "anyone going to jack's party friday?", "Alex party post must remain unchanged");
  assert.equal(interactionFacebook.feed.some(item => item.mediaId === "june-ig-04" || item.mediaIds?.includes("june-ig-04")), false, "IG04 must remain Instagram-only");
  assert.deepEqual(facebook.FACEBOOK_OFFLINE_PERSON_IDS, ["anil"], "Facebook story metadata must support Anil only as an offline subject");
  const jayBandPost = interactionFacebook.feed.find(item => item.id === "jay-band-performance-photo");
  const jayMayPost = interactionFacebook.feed.find(item => item.id === "jay-may-guitar-photo");
  assert.deepEqual([jayBandPost?.mediaId, jayBandPost?.createdAt, jayBandPost?.text, jayBandPost?.relatedCharacterIds, jayBandPost?.offlineSubjectIds], ["jay-band-performance", "2010-10-19T22:00:00-07:00", "last night was awesome. thx @Matt @Z.tokyo @Anil", ["matt"], ["anil"]]);
  assert.deepEqual(jayBandPost?.mentions, [
    { token: "@Matt", actor: { kind: "canonical", characterId: "matt", displayName: "Matt Ricci" } },
    { token: "@Z.tokyo", actor: { kind: "author-easter-egg", authorId: "author-z-tokyo", displayName: "Z.tokyo" } },
  ], "only Facebook-backed Jay caption identities may receive structured mention mappings");
  assert.equal(jayBandPost?.mentions?.some(mention => mention.token === "@Anil"), false, "offline-only @Anil must remain plain text");
  assert.deepEqual([jayMayPost?.mediaId, jayMayPost?.createdAt, jayMayPost?.text, jayMayPost?.visibility, jayMayPost?.customAudienceIncludesUser], ["jay-guitar-may", "2010-05-15T18:00:00-07:00", "hey baby", "friends", undefined]);
  assert.equal(facebook.isFacebookNewsFeedEligible(interactionFacebook, jayMayPost, Date.parse("2010-10-20T00:02:00-07:00")), true, "Jay's May story must pass centralized Feed eligibility at session start");
  assert.equal(facebook.selectFacebookVisibleFeed(interactionFacebook).some(item => item.id === "jay-may-guitar-photo"), true, "Jay's valid May story must enter the current News Feed");
  assert.equal(coreSocialFriends.CORE_SOCIAL_CHARACTERS.anil, undefined, "plain-text @Anil must not create a canonical SNS identity");
  const katieSeptemberComments = facebook.selectFacebookComments(interactionFacebook, "katie-selfie-september-2010");
  assert.deepEqual(katieSeptemberComments.map(comment => [comment.author, comment.characterId, comment.text, comment.classification]), [["Ben Dawson", "ben", "do you own any other shirts?", "CURATED / SIBLING BANTER"]]);
  assert.equal(facebook.selectFacebookComments(interactionFacebook, "alex-jacks-party-friday").some(comment => comment.id === "katie-september-comment-ben" || comment.characterId === "ben"), false, "Katie's Ben seed comment must not enter Alex's discussion");
  let katiePhotoNavigation = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "OPEN_PROFILE", profileName: "Katie Dawson" });
  katiePhotoNavigation = facebook.facebookStateTransition(katiePhotoNavigation, { type: "SET_PROFILE_SECTION", section: "photos" });
  katiePhotoNavigation = facebook.facebookStateTransition(katiePhotoNavigation, { type: "OPEN_ALBUM", albumId: "katie-photo-history" });
  katiePhotoNavigation = facebook.facebookStateTransition(katiePhotoNavigation, { type: "OPEN_ALBUM_PHOTO", albumId: "katie-photo-history", mediaId: "katie-selfie-september-2010" });
  const katiePhotoState = [katiePhotoNavigation.selectedAlbumId, katiePhotoNavigation.selectedPhotoMediaId, katiePhotoNavigation.comments.length];
  const benPhotoActor = facebook.resolveFacebookCommentActor(facebook.selectFacebookComments(katiePhotoNavigation, "katie-selfie-september-2010")[0], "Zoey");
  katiePhotoNavigation = facebook.facebookStateTransition(katiePhotoNavigation, { type: "OPEN_COMMENT_AUTHOR", actor: benPhotoActor });
  assert.deepEqual([katiePhotoNavigation.currentView, katiePhotoNavigation.selectedProfileName, katiePhotoNavigation.selectedProfileActor], ["profile", "Ben Dawson", { kind: "canonical", characterId: "ben", displayName: "Ben Dawson" }]);
  katiePhotoNavigation = facebook.facebookStateTransition(katiePhotoNavigation, { type: "GO_BACK" });
  assert.deepEqual([katiePhotoNavigation.currentView, katiePhotoNavigation.selectedAlbumId, katiePhotoNavigation.selectedPhotoMediaId, katiePhotoNavigation.comments.length], ["photoDetail", ...katiePhotoState]);
  katiePhotoNavigation = facebook.facebookStateTransition(katiePhotoNavigation, { type: "BEGIN_COMMENT", itemId: "katie-selfie-september-2010" });
  katiePhotoNavigation = facebook.facebookStateTransition(katiePhotoNavigation, { type: "EDIT_COMMENT", value: "haha" });
  katiePhotoNavigation = facebook.facebookStateTransition(katiePhotoNavigation, { type: "SUBMIT_COMMENT", displayName: "Zoey" });
  assert.equal(facebook.selectFacebookComments(katiePhotoNavigation, "katie-selfie-september-2010").length, 2, "Katie photo comment count must derive from real records");
  assert.deepEqual([formatFacebookTime("12:03 AM", 60), formatFacebookTime("12:03 AM", 480)], ["just now", "7 minutes ago"], "June live metadata must advance from the simulated clock");
  assert.deepEqual([formatFacebookTime("12:04 AM", 180), formatFacebookTime("12:04 AM", 480)], ["1 minute ago", "6 minutes ago"], "Ryan live metadata must advance from the simulated clock");
  assert.deepEqual([interactionFacebook.feed.find(item => item.id === "jay-band-performance-photo")?.createdAt, interactionFacebook.feed.find(item => item.id === "luca-pickup-basketball-photos")?.createdAt], ["2010-10-19T22:00:00-07:00", "2010-10-19T22:58:00-07:00"], "formatter integration must not rewrite static story timestamps");
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "TOGGLE_LIKE", itemId: "jay-band-performance-photo", displayName: "Zoey" });
  assert.equal(interactionFacebook.likedItemIds.includes("jay-band-performance-photo"), true, "Feed and album performance photo must share one story interaction ID");
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "SHOW_FEED" });
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "OPEN_FEED_ITEM", itemId: "jay-band-performance-photo", scrollPosition: 73 });
  const jayMentionState = [interactionFacebook.selectedFeedItemId, interactionFacebook.scrollPosition, interactionFacebook.likedItemIds, interactionFacebook.comments.length, interactionFacebook.partyInviteState];
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "OPEN_COMMENT_AUTHOR", actor: jayBandPost.mentions[0].actor });
  assert.deepEqual([interactionFacebook.currentView, interactionFacebook.selectedProfileName, interactionFacebook.selectedProfileActor], ["profile", "Matt Ricci", { kind: "canonical", characterId: "matt", displayName: "Matt Ricci" }]);
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "GO_BACK" });
  assert.deepEqual([interactionFacebook.currentView, interactionFacebook.selectedFeedItemId, interactionFacebook.scrollPosition, interactionFacebook.likedItemIds, interactionFacebook.comments.length, interactionFacebook.partyInviteState], ["feedDetail", ...jayMentionState], "Matt mention Back must restore the exact Jay Post state");
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "OPEN_COMMENT_AUTHOR", actor: jayBandPost.mentions[1].actor });
  assert.deepEqual([interactionFacebook.currentView, interactionFacebook.selectedProfileName, interactionFacebook.selectedProfileActor], ["profile", "Z.tokyo", { kind: "author-easter-egg", authorId: "author-z-tokyo", displayName: "Z.tokyo" }]);
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "GO_BACK" });
  assert.deepEqual([interactionFacebook.currentView, interactionFacebook.selectedFeedItemId, interactionFacebook.scrollPosition, interactionFacebook.likedItemIds, interactionFacebook.comments.length, interactionFacebook.partyInviteState], ["feedDetail", ...jayMentionState], "Z.tokyo mention Back must restore the exact Jay Post state");
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "DELIVER_JACK_REQUEST" });
  interactionFacebook = facebook.facebookStateTransition(interactionFacebook, { type: "ACCEPT_JACK" });
  assert.equal(facebook.selectFacebookVisibleFeed(interactionFacebook).some(item => item.id === "jack-movie"), true, "Jack friends-only content may become visible only after acceptance");
  dramaInstagram = instagram.instagramStateTransition(dramaInstagram, { type: "SHOW_PROFILE" });
  dramaInstagram = instagram.instagramStateTransition(dramaInstagram, { type: "SHOW_FACEBOOK_FRIENDS" });
  dramaInstagram = instagram.instagramStateTransition(dramaInstagram, { type: "OPEN_KNOWN_PROFILE", characterId: "june" });
  assert.deepEqual([dramaInstagram.currentView, dramaInstagram.selectedKnownCharacterId], ["knownProfile", "june"]);
  assert.deepEqual([dramaInstagram.followedCharacterIds, instagram.selectInstagramFollowingCount(dramaInstagram)], [["june"], 1], "Following button and count must share the relationship graph");
  dramaInstagram = instagram.instagramStateTransition(dramaInstagram, { type: "SET_KNOWN_ACCOUNT_FOLLOWING", characterId: "june", following: false });
  assert.deepEqual([dramaInstagram.followedCharacterIds, instagram.selectInstagramFollowingCount(dramaInstagram)], [[], 0]);
  assert.deepEqual(instagram.selectInstagramKnownAccountStats(dramaInstagram, "june"), { posts: 3, followers: 117, following: 236 }, "explicit Unfollow may change June's follower display without changing her own Following baseline");
  dramaInstagram = instagram.instagramStateTransition(dramaInstagram, { type: "SET_KNOWN_ACCOUNT_FOLLOWING", characterId: "june", following: true });
  assert.deepEqual([dramaInstagram.followedCharacterIds, instagram.selectInstagramFollowingCount(dramaInstagram)], [["june"], 1]);
  assert.deepEqual(instagram.selectInstagramKnownAccountStats(dramaInstagram, "june"), { posts: 3, followers: 118, following: 236 });
  assert.equal(instagramState.currentView, "feed");
  assert.deepEqual(instagramState.draft, { selectedCameraRollPhotoId: null, filter: null });
  const instagramFilterIdentities = ["Original", "X-Pro II", "Lomo-fi", "Earlybird", "1977"];
  for (const [filterIndex, filter] of instagramFilterIdentities.entries()) {
    let filterState = instagram.createInitialInstagramState();
    filterState = instagram.instagramStateTransition(filterState, { type: "BEGIN_FIRST_PHOTO" });
    filterState = instagram.instagramStateTransition(filterState, { type: "SELECT_CAMERA_ROLL_PHOTO", photoId: "camera-photo-filter-source" });
    assert.equal(filterState.draft.filter, "Original", "every new Camera Roll selection must begin at Normal / Original");
    filterState = instagram.instagramStateTransition(filterState, { type: "SELECT_FILTER", filter });
    assert.deepEqual(filterState.draft, { selectedCameraRollPhotoId: "camera-photo-filter-source", filter }, `${filter} must update only the draft filter identity`);
    filterState = instagram.instagramStateTransition(filterState, { type: "CONTINUE_TO_SHARE" });
    filterState = instagram.instagramStateTransition(filterState, { type: "BACK_TO_FILTERS" });
    assert.deepEqual([filterState.currentView, filterState.draft.filter], ["filter", filter], `${filter} must survive Filters to Share to Back`);
    filterState = instagram.instagramStateTransition(filterState, { type: "CONTINUE_TO_SHARE" });
    filterState = instagram.instagramStateTransition(filterState, { type: "POST_FIRST_PHOTO", owner: "Zoey", createdAt: 1_287_552_800_000 + filterIndex });
    assert.deepEqual([filterState.photos[0].sourcePhotoId, filterState.photos[0].filter], ["camera-photo-filter-source", filter], `${filter} must persist by identity while retaining the original Camera Roll stable ID`);
  }
  instagramState = instagram.instagramStateTransition(instagramState, { type: "BEGIN_FIRST_PHOTO" });
  assert.equal(instagramState.currentView, "source");
  instagramState = instagram.instagramStateTransition(instagramState, { type: "SELECT_CAMERA_ROLL_PHOTO", photoId: "camera-photo-session-a-0001" });
  assert.equal(instagramState.currentView, "filter");
  assert.deepEqual(instagramState.draft, { selectedCameraRollPhotoId: "camera-photo-session-a-0001", filter: "Original" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "BACK_TO_CAMERA_ROLL" });
  assert.equal(instagramState.currentView, "source", "Filters Back must return to the system Camera Roll picker");
  assert.deepEqual(instagramState.draft, { selectedCameraRollPhotoId: "camera-photo-session-a-0001", filter: "Original" }, "Filters Back may preserve the selected draft identity");
  instagramState = instagram.instagramStateTransition(instagramState, { type: "INVALIDATE_DRAFT_MEDIA" });
  assert.deepEqual(instagramState.draft, { selectedCameraRollPhotoId: null, filter: null }, "an unresolved Camera Roll identity must invalidate without retaining media data");
  instagramState = instagram.instagramStateTransition(instagramState, { type: "CANCEL_FIRST_PHOTO" });
  assert.equal(instagramState.currentView, "feed");
  assert.deepEqual(instagramState.draft, { selectedCameraRollPhotoId: null, filter: null }, "cancel must discard the first-photo draft");
  instagramState = instagram.instagramStateTransition(instagramState, { type: "BEGIN_FIRST_PHOTO" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "SELECT_CAMERA_ROLL_PHOTO", photoId: "camera-photo-session-a-0002" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "SELECT_FILTER", filter: "Original" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "CONTINUE_TO_SHARE" });
  assert.equal(instagramState.currentView, "share");
  instagramState = instagram.instagramStateTransition(instagramState, { type: "BACK_TO_FILTERS" });
  assert.equal(instagramState.currentView, "filter", "Share Back must return to Filters without replacing the selected media");
  instagramState = instagram.instagramStateTransition(instagramState, { type: "CONTINUE_TO_SHARE" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "POST_FIRST_PHOTO", owner: "Zoey", createdAt: 1_287_552_900_000 });
  assert.deepEqual(instagramState.photos, [{
    id: "instagram-user-photo-0001",
    owner: "Zoey",
    source: "camera-roll",
    sourcePhotoId: "camera-photo-session-a-0002",
    filter: "Original",
    createdAt: 1_287_552_900_000,
    origin: "user",
  }]);
  assert.deepEqual([instagramState.currentView, instagramState.selectedPhotoId, instagramState.draft], ["feed", "instagram-user-photo-0001", { selectedCameraRollPhotoId: null, filter: null }], "posting must return to Feed and clear only the completed draft");
  assert.deepEqual({ followers: instagramState.followers, following: instagram.selectInstagramFollowingCount(instagramState) }, { followers: 0, following: 1 });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "BEGIN_FIRST_PHOTO" });
  assert.equal(instagramState.currentView, "source", "Share must remain available after the first post");
  instagramState = instagram.instagramStateTransition(instagramState, { type: "SELECT_CAMERA_ROLL_PHOTO", photoId: "camera-photo-session-a-0002" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "SELECT_FILTER", filter: "X-Pro II" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "CONTINUE_TO_SHARE" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "POST_FIRST_PHOTO", owner: "Zoey", createdAt: 1_287_552_901_000 });
  assert.deepEqual(instagramState.photos.map(photo => [photo.id, photo.sourcePhotoId, photo.createdAt]), [
    ["instagram-user-photo-0001", "camera-photo-session-a-0002", 1_287_552_900_000],
    ["instagram-user-photo-0002", "camera-photo-session-a-0002", 1_287_552_901_000],
  ], "a second post must append without replacing the first and may reuse the same authorized Camera Roll source");
  instagramState = instagram.instagramStateTransition(instagramState, { type: "BEGIN_FIRST_PHOTO" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "SELECT_CAMERA_ROLL_PHOTO", photoId: "camera-photo-session-a-0003" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "SELECT_FILTER", filter: "1977" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "CONTINUE_TO_SHARE" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "POST_FIRST_PHOTO", owner: "Zoey", createdAt: 1_287_552_902_000 });
  assert.deepEqual(instagramState.photos.map(photo => photo.id), ["instagram-user-photo-0001", "instagram-user-photo-0002", "instagram-user-photo-0003"], "multiple posts must receive deterministic unique session-local IDs in append order");
  assert.equal(new Set(instagramState.photos.map(photo => photo.id)).size, 3, "every player Instagram post ID must be unique");
  assert.deepEqual(instagramState.photos.map(photo => photo.sourcePhotoId), ["camera-photo-session-a-0002", "camera-photo-session-a-0002", "camera-photo-session-a-0003"], "multi-post state must retain every Camera Roll stable source ID without Blob duplication");
  assert.deepEqual(instagramState.photos.map(photo => photo.filter), ["Original", "X-Pro II", "1977"], "multiple posts must retain distinct filter identities without replacing earlier post treatment");
  instagramState = instagram.instagramStateTransition(instagramState, { type: "SET_SCROLL_POSITION", scrollPosition: 37 });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "SHOW_PROFILE" });
  instagramState = instagram.instagramStateTransition(instagramState, { type: "SHOW_FEED" });
  assert.equal(instagramState.photos.length, 3, "navigation and the Profile Photos count source must retain every current-session post");
  assert.equal(instagramState.scrollPosition, 37);
  assert.deepEqual(seed.instagram.photos, [], "multi-post activity must not mutate the Instagram seed baseline");

  const tumblrZoey = tumblrPlayability;
  let facebookZoey = facebook.createInitialFacebookState("Zoey");
  facebookZoey = facebook.facebookStateTransition(facebookZoey, { type: "TOGGLE_LIKE", itemId: facebookZoey.feed[0].id });
  facebookZoey = facebook.facebookStateTransition(facebookZoey, { type: "DELIVER_JACK_REQUEST" });
  facebookZoey = facebook.facebookStateTransition(facebookZoey, { type: "ACCEPT_JACK" });
  facebookZoey = facebook.facebookStateTransition(facebookZoey, { type: "DELIVER_JUNE_MESSAGE", timestamp: "12:06 AM" });
  facebookZoey = facebook.facebookStateTransition(facebookZoey, { type: "OPEN_JUNE_MESSAGE" });
  facebookZoey = facebook.facebookStateTransition(facebookZoey, { type: "EDIT_MESSAGE_REPLY", value: "yes" });
  facebookZoey = facebook.facebookStateTransition(facebookZoey, { type: "SUBMIT_MESSAGE_REPLY", displayName: "Zoey", timestamp: "12:06 AM" });
  facebookZoey = facebook.facebookStateTransition(facebookZoey, { type: "BEGIN_COMMENT", itemId: facebookZoey.feed[0].id });
  facebookZoey = facebook.facebookStateTransition(facebookZoey, { type: "EDIT_COMMENT", value: "Zoey session comment" });
  facebookZoey = facebook.facebookStateTransition(facebookZoey, { type: "SUBMIT_COMMENT", displayName: "Zoey" });
  const facebookAlex = facebook.facebookStateTransition(facebookZoey, { type: "RESET", displayName: "Alex" });
  const flickrAlex = flickr.flickrStateTransition(flickrA, { type: "RESET" });
  const tumblrAlex = tumblr.tumblrStateTransition(tumblrZoey, { type: "RESET" });
  const foursquareAlex = foursquare.foursquareStateTransition(foursquarePlayability, { type: "RESET" });
  const instagramAlex = instagram.instagramStateTransition(instagramState, { type: "RESET" });
  assert.deepEqual(facebookAlex.likedItemIds, []);
  assert.equal(facebookAlex.friendRequestState, "none");
  assert.deepEqual(facebookAlex.friends.map(friend => friend.id), ["katie", "matt", "alex", "chris", "jay", "june", "ben", "luca", "facebook-ephemeral-emily", "facebook-ephemeral-mike", "fof-ryan-001"]);
  assert.deepEqual([facebookAlex.statusDraft, facebookAlex.statusComposerOpen, facebookAlex.partyRsvp, facebookAlex.userCheckIn, facebookAlex.readNotificationIds], ["", false, null, null, []], "new session must clear Facebook v0.3 user actions and notification reads");
  assert.equal(facebook.selectFacebookJuneMessageState(facebookAlex), "none");
  assert.equal(facebookAlex.threadMessages.some(message => message.origin === "user"), false);
  assert.equal(facebookAlex.messageReplyDraft, "");
  assert.deepEqual(facebookAlex.comments.map(comment => comment.id), ["alex-party-comment-jay", "alex-party-comment-ryan", "june-show-comment-jack", "june-show-comment-emily", "june-show-comment-ryan-a", "june-show-comment-sophie", "june-show-comment-nicole", "june-show-comment-chris", "june-show-comment-ryan-b", "june-show-comment-derek", "june-show-comment-megan", "june-show-comment-june", "june-sophie-photo-comment-sophie", ...Array.from({ length: 12 }, (_, index) => `june-birthday-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 6 }, (_, index) => `june-reading-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 7 }, (_, index) => `june-starbucks-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 8 }, (_, index) => `june-girls-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 10 }, (_, index) => `june-graduation-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 6 }, (_, index) => `jack-game-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 7 }, (_, index) => `jack-summer-comment-${String(index + 1).padStart(2, "0")}`), "jack-car-matt-2009-comment-matt-1", "jack-car-matt-2009-comment-jack-1", "jack-car-matt-2009-comment-matt-2", "jack-car-comment-02", "jack-car-matt-2009-comment-jack-2", ...Array.from({ length: 2 }, (_, index) => `jack-practice-comment-${String(index + 1).padStart(2, "0")}`), "jack-matt-2008-comment-01", ...Array.from({ length: 3 }, (_, index) => `jack-matt-2010-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 9 }, (_, index) => `jack-birthday-june-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 5 }, (_, index) => `jack-birthday-sophie-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 7 }, (_, index) => `jack-birthday-luca-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 5 }, (_, index) => `jack-birthday-matt-comment-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 15 }, (_, index) => `jack-birthday-thanks-comment-${String(index + 1).padStart(2, "0")}`), "katie-september-comment-ben", "luca-basketball-comment-chris-shot", "luca-basketball-comment-luca-misses", "luca-basketball-comment-chris-details", "luca-basketball-comment-frank-count", "jay-band-comment-katie", "jay-band-comment-alex", "jay-band-comment-jack", "jay-band-comment-mike", "jay-band-comment-sarah", "jay-band-comment-kevin", "jay-band-comment-emily", "jay-band-comment-nick", "jay-band-comment-rachel", "jay-band-comment-frank", "jay-band-comment-ryan", "jay-2009-march-comment-luca", "jay-2009-march-comment-jay", "jay-2009-march-comment-sarah", "jay-2009-june-comment-matt", "jay-2009-june-comment-jay", "jay-2009-june-comment-z-tokyo", "jay-2009-june-comment-mike", "jay-2009-june-comment-kevin", "jay-2009-august-comment-matt", "jay-2009-august-comment-jay-1", "jay-2009-august-comment-emily", "jay-2009-august-comment-jay-2", "jay-2009-november-comment-matt-1", "jay-2009-november-comment-jay", "jay-2009-november-comment-matt-2", "jay-2009-november-comment-frank", "matt-code-comment-eric-jsonp", "matt-code-comment-daniel-callback", "matt-code-comment-sam-jquery", "matt-code-comment-kevin-image", "matt-code-comment-rachel-album", "matt-code-comment-matt-reply"]);
  assert.deepEqual(facebookAlex.likes.map(like => like.id), ["luca-pickup-basketball-like-chris", "june-show-like-jack", ...Array.from({ length: 40 }, (_, index) => `june-show-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 38 }, (_, index) => `june-birthday-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 16 }, (_, index) => `june-reading-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 21 }, (_, index) => `june-starbucks-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 27 }, (_, index) => `june-girls-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 32 }, (_, index) => `june-graduation-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 28 }, (_, index) => `jack-game-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 34 }, (_, index) => `jack-summer-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 9 }, (_, index) => `jack-car-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 8 }, (_, index) => `jack-practice-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 34 }, (_, index) => `jack-birthday-june-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 19 }, (_, index) => `jack-birthday-sophie-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 28 }, (_, index) => `jack-birthday-luca-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 22 }, (_, index) => `jack-birthday-matt-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 57 }, (_, index) => `jack-birthday-thanks-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 48 }, (_, index) => `jay-band-performance-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 8 }, (_, index) => `jay-2009-march-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 14 }, (_, index) => `jay-2009-june-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 6 }, (_, index) => `jay-2009-august-like-${String(index + 1).padStart(2, "0")}`), ...Array.from({ length: 11 }, (_, index) => `jay-2009-november-like-${String(index + 1).padStart(2, "0")}`)], "new session must restore the complete deterministic Facebook seed Like baseline");
  assert.equal(facebookAlex.commentComposerItemId, null);
  assert.equal(facebookAlex.commentDraft, "");
  assert.equal(facebookAlex.inboxThreads.some(thread => thread.id === "june-live-message"), false);
  assert.deepEqual(
    [facebookAlex.feed.find(item => item.id === "ben-long-day")?.friendId, facebookAlex.feed.find(item => item.id === "ben-long-day")?.author],
    ["ben", "Ben Dawson"],
    "new session must preserve canonical ownership of Ben's seed Feed item",
  );
  assert.equal(facebookAlex.feed.some(item => item.id === "owner-late" || item.author === "session-owner"), false, "Facebook seed must not contain pre-authored session-owner content");
  assert.deepEqual(flickrAlex.favoritePhotoIds, []);
  assert.equal(flickrAlex.currentView, "home");
  assert.equal(flickrAlex.selectedPhotoId, null);
  assert.equal(flickrAlex.currentSetId, null);
  assert.equal(flickrAlex.photostreamScrollPosition, 0);
  assert.equal(flickrAlex.commentsState.filter(comment => comment.origin === "user").length, 0);
  assert.deepEqual(flickrAlex.commentsState.map(comment => [comment.text, comment.origin]), []);
  assert.equal(flickrAlex.pendingUpload, null);
  assert.equal(flickrAlex.upload, null);
  assert.deepEqual(flickrAlex.recentSearches, []);
  assert.deepEqual(tumblrAlex.likedPostIds, []);
  assert.deepEqual(tumblrAlex.rebloggedPostIds, []);
  assert.deepEqual(tumblrAlex.reblogs, []);
  assert.equal(tumblrAlex.reblogDraft, "");
  assert.equal(tumblrAlex.currentView, "dashboard");
  assert.equal(tumblrAlex.selectedPostId, null);
  assert.equal(tumblrAlex.dashboardScrollPosition, 0);
  assert.equal(tumblrAlex.notes.filter(note => note.origin === "user").length, 0);
  assert.equal(tumblrAlex.notes.filter(note => note.origin === "seed").length, 1);
  assert.equal(tumblrAlex.posts.some(post => post.id === "late-note"), false, "new session must remove live Tumblr additions and restore seed Dashboard baseline");
  assert.deepEqual(foursquareAlex.checkIns, {});
  assert.deepEqual(foursquareAlex.shoutDrafts, {});
  assert.deepEqual(foursquareAlex.pointEvents, []);
  assert.equal(foursquareAlex.latestCheckinResult, null);
  assert.equal(foursquareGameModel.getPlayerWeeklyPoints(foursquareAlex.pointEvents), 0);
  assert.equal(foursquareGameModel.getPlayerRank(foursquareAlex.pointEvents), null);
  assert.equal(foursquareAlex.venueSubview, "summary");
  assert.deepEqual([foursquareAlex.activeTab, foursquareAlex.currentView, foursquareAlex.selectedVenueId], ["friends", "root", null], "new session must restore the Friends root");
  assert.deepEqual(foursquareAlex.rootScrollPositions, { friends: 0, places: 0, tips: 0, todos: 0, profile: 0 }, "new session must clear every Foursquare root scroll position");
  assert.equal(foursquareAlex.socialActivities.length, 5, "new session must restore the structured F1 baseline and remove live/user mutations");
  assert.deepEqual(instagramAlex.photos, []);
  assert.equal(instagramAlex.currentView, "feed");
  assert.equal(instagramAlex.selectedPhotoId, null);
  assert.equal(instagramAlex.scrollPosition, 0);
  assert.deepEqual(instagramAlex.draft, { selectedCameraRollPhotoId: null, filter: null });
  assert.deepEqual({ followers: instagramAlex.followers, following: instagram.selectInstagramFollowingCount(instagramAlex) }, { followers: 0, following: 1 });
  assert.deepEqual(instagramAlex.knownAccounts.map(account => [account.canonicalCharacterId, account.username]), [["june", "junepark"]], "new session must restore the sparse canonical June mapping");
  assert.deepEqual(instagram.selectInstagramVisibleKnownPosts(instagramAlex, "june").map(post => post.id), ["june-ig-04", "june-ig-03", "june-ig-02"], "new session must restore the locked June seed chronology");
  assert.deepEqual(instagram.selectInstagramKnownAccountStats(instagramAlex, "june"), { posts: 3, followers: 118, following: 236 }, "new session must restore June's curated display baseline");
  assert.deepEqual([instagramAlex.followedCharacterIds, instagramAlex.selectedKnownCharacterId, instagramAlex.knownProfileOrigin], [["june"], null, null], "new session must restore June Follow baseline and clear profile navigation state");
  assert.deepEqual([instagramAlex.popularScrollPosition, instagramAlex.selectedPopularPostId, instagramAlex.popularRefreshCount], [0, null, 0], "new session must reset Instagram Popular navigation state");

  const seedSource = await readFile(resolve(projectRoot, "src/data/sessionSeedContent.ts"), "utf8");
  const coreSocialSource = await readFile(resolve(projectRoot, "src/data/coreSocialFriends.ts"), "utf8");
  const instagramStateSource = await readFile(resolve(projectRoot, "src/state/instagramState.ts"), "utf8");
  const appSource = await readFile(resolve(projectRoot, "src/device/App.tsx"), "utf8");
  const deviceScreenSource = await readFile(resolve(projectRoot, "src/device/DeviceScreen.tsx"), "utf8");
  const foursquareStateSource = await readFile(resolve(projectRoot, "src/state/foursquareState.ts"), "utf8");
  const foursquareGameModelSource = await readFile(resolve(projectRoot, "src/data/foursquareGameModel.ts"), "utf8");
  const deviceMachineSource = await readFile(resolve(projectRoot, "src/state/deviceMachine.ts"), "utf8");
  const cameraRollPersistenceSource = await readFile(resolve(projectRoot, "src/state/cameraRollPersistence.ts"), "utf8");
  const cameraCaptureStateSource = await readFile(resolve(projectRoot, "src/state/cameraCaptureState.ts"), "utf8");
  const ambientWorldRendererSource = await readFile(resolve(projectRoot, "src/world/ambientWorldRenderer.ts"), "utf8");
  const lockScreenSource = await readFile(resolve(projectRoot, "src/device/LockScreen.tsx"), "utf8");
  const instagramContainerSource = await readFile(resolve(projectRoot, "src/device/InstagramContainer.tsx"), "utf8");
  const instagramFilteredImageSource = await readFile(resolve(projectRoot, "src/device/instagram/InstagramFilteredImage.tsx"), "utf8");
  const instagramChromeSource = await readFile(resolve(projectRoot, "src/device/instagram/InstagramChrome.tsx"), "utf8");
  const instagramWordmarkSource = await readFile(resolve(projectRoot, "src/assets/instagram/chrome/instagram-wordmark-2010-reconstructed.svg"), "utf8");
  const instagramTabIconSources = await Promise.all([
    "instagram-feed-2010-reconstructed.svg",
    "instagram-feed-2010-selected-reconstructed.svg",
    "instagram-popular-2010-reconstructed.svg",
    "instagram-popular-2010-selected-reconstructed.svg",
    "instagram-share-2010-reconstructed.svg",
    "instagram-news-2010-reconstructed.svg",
    "instagram-news-2010-selected-reconstructed.svg",
    "instagram-profile-2010-reconstructed.svg",
    "instagram-profile-2010-selected-reconstructed.svg",
  ].map(fileName => readFile(resolve(projectRoot, "src/assets/instagram/chrome", fileName), "utf8")));
  const instagramSelectedFeedSource = instagramTabIconSources[1];
  const instagramShareIconSource = instagramTabIconSources[4];
  const instagramNewsIconSource = instagramTabIconSources[5];
  const instagramSelectedNewsSource = instagramTabIconSources[6];
  const instagramSelectedProfileSource = instagramTabIconSources[8];
  const instagramClockSource = await readFile(resolve(projectRoot, "src/assets/instagram/chrome/instagram-clock-2010-reconstructed.svg"), "utf8");
  const instagramBackButtonSource = await readFile(resolve(projectRoot, "src/assets/instagram/chrome/instagram-back-button-2010-reconstructed.svg"), "utf8");
  const instagramShareHousingSource = await readFile(resolve(projectRoot, "src/assets/instagram/chrome/instagram-share-housing-2010-reconstructed.svg"), "utf8");
  const photosContainerSource = await readFile(resolve(projectRoot, "src/device/PhotosContainer.tsx"), "utf8");
  const facebookContainerSource = await readFile(resolve(projectRoot, "src/device/FacebookContainer.tsx"), "utf8");
  const facebookHomeIconsSource = await readFile(resolve(projectRoot, "src/device/FacebookHomeIcons.tsx"), "utf8");
  const facebookMicroChromeSource = await readFile(resolve(projectRoot, "src/device/FacebookMicroChrome.tsx"), "utf8");
  const facebookStoryActionBubbleSource = await readFile(resolve(projectRoot, "src/assets/facebook/chrome/facebook-2010-story-action-plus.svg"), "utf8");
  const facebookCameraArtworkSource = await readFile(resolve(projectRoot, "src/assets/facebook/chrome/facebook-2010-camera.svg"), "utf8");
  const facebookCommentGlyphSource = await readFile(resolve(projectRoot, "src/assets/facebook/chrome/facebook-2010-comment-glyph.svg"), "utf8");
  const facebookLikeGlyphSource = await readFile(resolve(projectRoot, "src/assets/facebook/chrome/facebook-2010-like-glyph.svg"), "utf8");
  const facebookGridLauncherSource = await readFile(resolve(projectRoot, "src/assets/facebook/chrome/facebook-2010-grid-launcher.svg"), "utf8");
  const facebookNotificationActionBubbleSource = await readFile(resolve(projectRoot, "src/assets/facebook/chrome/facebook-2010-notification-action-bubble.svg"), "utf8");
  const recoveredFacebookHomeIconHashes = Object.freeze({
    feed: ["feedButton@2x.png", "be9c0efbb91846ccb38e63bd8c9063978e56387a69ef28c1ffcb0985cb09a518"],
    profile: ["profileButton@2x.png", "23f332b8588e553a7105cd5f5f330f8d8f7b73b86a56834a9b6f5d02cf2873a0"],
    friends: ["friendsButton@2x.png", "5abffa3dd1b1beba1e0d995128df525d9800a73041cc9a472269288d407c0224"],
    inbox: ["inboxButton@2x.png", "bb6d10f8adb8b74ed5ebc09ad186fa350ebd8be21d0d1de0d0fa6000a6dd3702"],
    places: ["placesButton@2x.png", "f5a2416d27876957ffffe2b2d83610229fbb53888d65ae1125eacdeef712c01b"],
    requests: ["requestsButton@2x.png", "bd0397ecdfbe24181f34824f8b109598ec9242c8735ceeae9f7002b44274d124"],
    events: ["eventsButton@2x.png", "809d937f1af919b40d600461f6e36ceb30af45f8709c6e60f5169e1424460620"],
    photos: ["photosButton@2x.png", "46dc3e661acc0ef980d7da7ab5d43673e4c361001cf098fc24abf1af4d3b2c59"],
    chat: ["chatButton@2x.png", "8c723f7036a66a43df09ae348cea9e3e8ed7804a49ccf151b6ad41113f3c6b54"],
    notes: ["notesButton@2x.png", "d56e198df052abdccf8a9a77731aff9086441bfff15f6df734c94b131c1dfc36"],
  });
  const facebookStateSource = await readFile(resolve(projectRoot, "src/state/facebookState.ts"), "utf8");
  const facebookStoryTimeSource = await readFile(resolve(projectRoot, "src/data/facebookStoryTime.ts"), "utf8");
  const twitterContainerSource = await readFile(resolve(projectRoot, "src/device/TwitterContainer.tsx"), "utf8");
  const twitterAvatarSource = await readFile(resolve(projectRoot, "src/device/TwitterAvatar.tsx"), "utf8");
  const deviceCssSource = await readFile(resolve(projectRoot, "src/styles/device.css"), "utf8");
  const publishingTwitterStateSource = await readFile(resolve(projectRoot, "src/state/twitterState.ts"), "utf8");
  const pendingMediaSource = await readFile(resolve(projectRoot, "src/device/MediaAttachmentPresentation.tsx"), "utf8");
  assert.doesNotMatch(`${facebookContainerSource}\n${twitterContainerSource}\n${pendingMediaSource}`, /Photo posting unavailable|postingUnsupported/, "media publishing must not expose temporary engineering copy");
  for (const source of [facebookStateSource, publishingTwitterStateSource]) {
    assert.match(source, /attachment\?: MediaAttachment;/, "published records support one shared selected-media reference");
    assert.match(source, /attachment: state\.pendingAttachment/, "existing publication consumes the selected Camera Roll resource");
    assert.doesNotMatch(source, /attachment\?: MediaAttachment\[\]|mediaPosts:|mediaTweets:/, "media must not add multiple attachments or a parallel publication store");
  }
  assert.match(deviceCssSource, /\.mobilesms-bubble\.is-outgoing\.is-mms \{[^}]*padding: 3px;/, "MMS uses a narrow inset on the existing outgoing bubble");
  assert.match(deviceCssSource, /\.mobilesms-bubble\.is-outgoing\.is-mms::after/, "outgoing MMS retains a directional tail");
  const twitterProfileSource = twitterContainerSource.match(/function TwitterProfile[\s\S]*?\n\}\n\nfunction TwitterSearchLanding/)?.[0] ?? "";
  const twitterChromeSources = await Promise.all([
    "twitter-tab-timeline-2010-reconstructed.svg",
    "twitter-tab-mentions-2010-reconstructed.svg",
    "twitter-tab-messages-2010-reconstructed.svg",
    "twitter-tab-search-2010-reconstructed.svg",
    "twitter-tab-more-2010-reconstructed.svg",
    "twitter-compose-2010-reconstructed.svg",
    "twitter-back-control-2010-reconstructed.svg",
    "twitter-action-reply-2010-reconstructed.svg",
    "twitter-action-retweet-2010-reconstructed.svg",
    "twitter-action-favorite-2010-reconstructed.svg",
    "twitter-action-favorite-selected-2010-reconstructed.svg",
    "twitter-action-profile-2010-reconstructed.svg",
    "twitter-action-slot5-hold-2010-reconstructed.svg",
    "twitter-action-slot6-hold-2010-reconstructed.svg",
    "twitter-favorite-corner-2010-reconstructed.svg",
  ].map(fileName => readFile(resolve(projectRoot, "src/assets/twitter/chrome", fileName), "utf8")));
  const springBoardSource = await readFile(resolve(projectRoot, "src/device/SpringBoard.tsx"), "utf8");
  const springBoardSocialAppsSource = await readFile(resolve(projectRoot, "src/data/springBoardSocialApps.ts"), "utf8");
  const ios4KeyboardSource = await readFile(resolve(projectRoot, "src/device/IOS4KeyboardSystem.tsx"), "utf8");
  const mobileSmsContainerSource = await readFile(resolve(projectRoot, "src/device/MobileSMSContainer.tsx"), "utf8");
  const foursquareContainerSource = await readFile(resolve(projectRoot, "src/device/FoursquareContainer.tsx"), "utf8");
  const flickrContainerSource = await readFile(resolve(projectRoot, "src/device/FlickrContainer.tsx"), "utf8");
  const tumblrContainerSource = await readFile(resolve(projectRoot, "src/device/TumblrContainer.tsx"), "utf8");

  // Mechanical extraction: check the presenter/controller relationship, not a
  // concatenation that could hide a second mount or move runtime ownership.
  const deviceScreenMountSource = appSource.match(/<DeviceScreen\s[\s\S]*?\n      \/>/)?.[0];
  assert.ok(deviceScreenMountSource, "App must render the extracted DeviceScreen");
  assert.match(appSource, /import \{ DeviceScreen, type DeviceScreenProps \} from "\.\/DeviceScreen";/, "App must import the shared DeviceScreen implementation");
  assert.doesNotMatch(deviceScreenMountSource, /\bkey\s*=/, "DeviceScreen must not acquire a remount key");
  assert.match(deviceScreenMountSource, /display=\{\{\s+session,[^}]+deviceDateTime,/, "the screen phase and simulated clock must come from App");
  assert.match(deviceScreenMountSource, /camera=\{\{\s+cameraRuntime,\s+cameraRoll,\s+setCameraPreviewCanvas,\s+setCameraLookPointerOffset,\s+captureCameraPhoto,\s+openLatestCameraPhoto,\s*\}\}/, "Camera presentation must use the existing App-owned runtime, roll and bridge callbacks");
  assert.match(deviceScreenSource, /const \{\s+session,[^}]+deviceDateTime,[^}]*\} = display;/, "DeviceScreen must consume the App display values");
  assert.match(deviceScreenSource, /const \{\s+cameraRuntime,\s+cameraRoll,\s+setCameraPreviewCanvas,\s+setCameraLookPointerOffset,\s+captureCameraPhoto,\s+openLatestCameraPhoto,\s*\} = camera;/, "DeviceScreen must consume the existing Camera bridge without substituting another owner");
  assert.match(deviceScreenSource, /return <div className=\{`screen \$\{session\.phase\}`\} data-media-camera=\{media\.cameraActive \|\| undefined\}>/, "the sole screen root must retain its phase classes and scoped media-camera presentation flag");
  assert.doesNotMatch(deviceScreenSource, /\buse(?:State|Reducer|Effect|LayoutEffect|Ref)\s*\(|\b(?:setTimeout|setInterval|createRoot|createPortal|createExperienceSessionId|initializeCameraRollPersistence|selectCameraVideoScene)\s*\(/, "DeviceScreen must remain presentation-only without another runtime, persistence, timer or portal owner");
  assert.doesNotMatch(deviceScreenSource, /<SessionIdentityContext\.Provider\b|<AmbientWorld\b|<PublicTwitterOutro\b|className=\{`home\$\{|className=["']device["']/, "hardware, identity provider, world and page-level outro must stay outside DeviceScreen");
  assert.match(appSource, /return <SessionIdentityContext\.Provider value=\{session\.sessionIdentity\}>\s+<AmbientWorld\s[\s\S]+<DeviceScreen\s[\s\S]+<\/SessionIdentityContext\.Provider>;/, "App must keep the same identity provider above AmbientWorld and DeviceScreen");
  assert.match(appSource, /<DeviceScreen\s[\s\S]*?\n      \/>\s+<button\s+className=\{`home\$\{homePressed \? " is-pressed" : ""\}`\}[\s\S]+<\/section>[\s\S]+<PublicTwitterOutro\s/, "the physical Home button and page-level outro must remain outside the software screen");

  // Scan all source modules so a second JSX mount in Hero or another entry
  // point cannot pass merely because App.tsx still has one mount.
  async function readRuntimeSources(directory) {
    const entries = await readdir(resolve(projectRoot, directory), { withFileTypes: true });
    const groups = await Promise.all(entries.map(async entry => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return readRuntimeSources(path);
      return /\.[cm]?[jt]sx?$/.test(entry.name)
        ? [{ path, source: await readFile(resolve(projectRoot, path), "utf8") }]
        : [];
    }));
    return groups.flat();
  }
  const runtimeSources = await readRuntimeSources("src");
  assertNotificationArchitecture(runtimeSources);
  assertSoftwareReconciliation(runtimeSources);
  for (const [path, mutation, expected] of [
    ["src/device/App.tsx", text => text + "\nuseReducer(notificationTransition, undefined);", /one App-owned/],
    ["src/device/App.tsx", text => text.replace('dispatchNotifications({ type: "RESET" });', ''), /completed runtime reset/],
    ["src/system/notificationDelivery.ts", text => text + "\nnew Audio();", /audio bypass/],
    ["src/state/notificationState.ts", text => text.replace(" || context.systemAlert", ""), /priority is explicit/],
  ]) {
    assert.throws(() => assertNotificationArchitecture(runtimeSources.map(file => file.path === path ? { ...file, source: mutation(file.source) } : file)), expected);
  }
  await runNotificationChecks(vite);

  for (const [component, owner] of [["App", "src/main.tsx"], ["DeviceScreen", "src/device/App.tsx"], ["AmbientWorld", "src/device/App.tsx"]]) {
    const mounts = runtimeSources.flatMap(({ path, source }) => [...source.matchAll(new RegExp(`<${component}(?=[\\s/>])`, "g"))].map(() => path));
    assert.deepEqual(mounts, [owner], `${component} must have exactly one JSX mount site, in ${owner}`);
  }
  const screenRoots = runtimeSources.flatMap(({ path, source }) => [...source.matchAll(/className=(?:["']screen(?:\s|["'])|\{`screen(?:\s|`))/g)].map(() => path));
  assert.deepEqual(screenRoots, ["src/device/DeviceScreen.tsx"], "only DeviceScreen may declare the single software screen root");

  const screenPresentationSource = deviceScreenSource.match(/return <div className=\{`screen \$\{session\.phase\}`\} data-media-camera=\{media\.cameraActive \|\| undefined\}>[\s\S]*?\n  <\/div>;/)?.[0];
  assert.ok(screenPresentationSource, "the screen presentation boundary must remain explicit");
  assert.deepEqual([...screenPresentationSource.matchAll(/<([A-Z]\w*)\b/g)].map(match => match[1]), [
    "LockScreenStatusPresentation", "StatusBar", "BootLogo", "LockScreen", "SpringBoard",
    "AppLaunchContainer", "IOS4KeyboardSystem", "CameraContainer", "PhotosContainer",
    "MobileSMSContainer", "TwitterContainer", "FacebookContainer",
    "InstagramContainer", "FlickrContainer", "TumblrContainer", "SafariContainer", "YouTubeContainer", "ITunesContainer", "ClockContainer", "CompassContainer", "VoiceMemosContainer", "LegacyLoadingContainer", "CalculatorContainer", "CalendarContainer", "MapsContainer", "FoursquareContainer",
    "MediaSourceChooser", "PhotosContainer", "MultitaskingBar", "PowerOffConfirm", "LowBatteryAlert", "SMSAlertOverlay", "AppNotificationAlert",
  ], "screen-local components must preserve their original multiplicity and status/lock/app/overlay order");
  const keyboardSubtreeSource = screenPresentationSource.match(/<IOS4KeyboardSystem\s[\s\S]*?<\/IOS4KeyboardSystem>/)?.[0];
  assert.ok(keyboardSubtreeSource, "the app subtree must retain its keyboard provider");
  assert.deepEqual([...keyboardSubtreeSource.matchAll(/<([A-Z]\w*)\b/g)].map(match => match[1]), [
    "IOS4KeyboardSystem", "CameraContainer", "PhotosContainer", "MobileSMSContainer",
    "TwitterContainer", "FacebookContainer", "InstagramContainer",
    "FlickrContainer", "TumblrContainer", "SafariContainer", "YouTubeContainer", "ITunesContainer", "ClockContainer", "CompassContainer", "VoiceMemosContainer", "LegacyLoadingContainer", "CalculatorContainer", "CalendarContainer", "MapsContainer", "FoursquareContainer", "MediaSourceChooser", "PhotosContainer",
  ], "the keyboard must wrap exactly the same app and Camera picker presentation subtree");
  assert.match(screenPresentationSource, /<\/IOS4KeyboardSystem>\s+<\/AppLaunchContainer>\}\s+\{session\.phase === "app" && <MultitaskingBar/, "keyboard and app viewport must close before the screen-level multitasking overlay");
  assert.match(keyboardSubtreeSource, /\(appRuntime\.activeAppId === "camera" \|\| media\.cameraActive\) && cameraRuntime\.cameraApp\.phase !== "none" && <CameraContainer\s+owner="cameraApp"\s+mediaAttachment=\{media\.cameraActive\}\s+onCancel=\{media\.cameraActive \? cancelScreenCameraPicker : undefined\}\s+session=\{cameraRuntime\.cameraApp\}\s+previewCanvasRef=\{setCameraPreviewCanvas\}/, "standalone and attachment Camera must share exactly the same runtime and preview bridge");
  assert.equal((deviceScreenSource.match(/<CameraContainer\b/g) ?? []).length, 1, "shared media must not add a second Camera preview");
  assert.match(keyboardSubtreeSource, /media\.visible && media\.request\?\.stage === "library"[\s\S]+<PhotosContainer mode="picker" cameraRoll=\{cameraRoll\} onPickerCancel=\{cancelScreenCameraPicker\} onPickerSelect=\{media\.selectPhoto\}/, "all requesters must select from the existing App Camera Roll");
  assert.match(screenPresentationSource, /session\.phase === "locked"\s+\|\| session\.phase === "springboard"\s+\|\| \(session\.phase === "app"\s+&& !\(\(appRuntime\.activeAppId === "camera" \|\| media\.cameraActive\) && cameraRuntime\.cameraApp\.phase !== "none"\)\)\) && <div className="device-status-bar-layer">\s+\{session\.phase === "locked"\s+\? <LockScreenStatusPresentation model=\{lockScreenModel\} \/>\s+: <StatusBar state=\{statusBarState\} \/>\}/, "status-bar phases must remain unchanged except full-screen shared Camera exclusion");
  assert.match(screenPresentationSource, /session\.phase === "sleeping" && <div className="screen-off-surface"[^\n]+\n\s+\{session\.phase === "powerOffConfirm"[\s\S]+session\.phase === "shutdown" && <div className="screen-off-surface"[^\n]+\n\s+\{session\.phase === "lowBatteryWarning"[\s\S]+<LowBatteryAlert[\s\S]+<SMSAlertOverlay/, "off, confirmation, shutdown, low-battery and SMS surfaces must preserve their layering");
  assert.equal((ios4KeyboardSource.match(/export function IOS4KeyboardSystem/g) ?? []).length, 1, "the device must own exactly one shared software-keyboard runtime");
  assert.match(deviceScreenSource, /session\.phase === "app" && <AppLaunchContainer[\s\S]+<IOS4KeyboardSystem[\s\S]+suspended=\{multitaskingBar !== "closed" \|\| media\.visible\}[\s\S]+suspendReason=/, "the shared keyboard must remain at the app boundary and suspend for all shared media sources");
  assert.match(deviceMachineSource, /experienceSessionId: string \| null;[\s\S]+initialSession[\s\S]+experienceSessionId: null/, "experience ownership must extend the canonical Session and remain empty at Hero");
  assert.match(appSource, /submitName[\s\S]+createExperienceSessionId\(\)[\s\S]+experienceSessionId,/, "only valid Hero name submission may activate a new experience ID");
  assert.match(appSource, /experienceSessionId: persisted\.experienceSessionId/, "runtime reload reconstruction must preserve the persisted canonical experience ID");
  assert.match(cameraCaptureStateSource, /CameraCaptureSnapshot[\s\S]+experienceSessionId: string;[\s\S]+CameraPhotoDurableRecord[\s\S]+experienceSessionId: string;/, "shutter-time snapshots and durable Camera records must carry explicit experience ownership");
  assert.match(cameraRollPersistenceSource, /CAMERA_ROLL_DATABASE_VERSION = 2[\s\S]+\["origin", "experienceSessionId"\][\s\S]+\["experienceSessionId", "captureSequence"\][\s\S]+unique: true/, "IndexedDB v2 must index owner queries and enforce unique owner-sequence pairs");
  assert.match(cameraRollPersistenceSource, /oldVersion < 2[\s\S]+origin === "player-camera"[\s\S]+typeof value\.experienceSessionId !== "string"[\s\S]+cursor\.delete\(\)/, "v1 player-camera records without provable ownership must be deleted rather than assigned to the current player");
  assert.match(cameraRollPersistenceSource, /index\(CAMERA_ROLL_OWNER_INDEX\)\.getAll\(\["player-camera", experienceSessionId\]\)/, "Camera Roll initialization and current-owner erase must query an explicit owner namespace");
  assert.match(cameraRollPersistenceSource, /cameraRollSequenceMetadataKey\(experienceSessionId\)[\s\S]+photoStore\.add\(record\)[\s\S]+nextSequence: sequence \+ 1/, "record insertion and owner-scoped sequence advancement must share one transaction");
  assert.match(appSource, /cameraRollBootstrap\.current.get\(experienceSessionId,[\s\S]+eraseCurrentCameraRoll\(experienceSessionId\)[\s\S]+\.then\(\(\) => initializeCameraRollPersistence\(experienceSessionId\)\)/, "session bootstrap must erase the current Camera Roll before hydrating it");
  assert.match(ambientWorldRendererSource, /normalizedViewfinder[\s\S]+bounds\.left \/ canvas\.width[\s\S]+canvas\.height - bounds\.top - bounds\.height[\s\S]+lastPresentedCameraFrame/, "Camera capture must freeze the live bottom-origin viewfinder mapping");
  assert.match(ambientWorldRendererSource, /CAMERA_CAPTURE_GRAIN_SCALE,[\s\S]+canvasWidth: CAMERA_CAPTURE_WIDTH,[\s\S]+canvasHeight: CAMERA_CAPTURE_HEIGHT,[\s\S]+width: 1,[\s\S]+height: 1/, "offscreen capture must reuse the captured viewport-mapped source geometry");
  assert.match(appSource, /const experienceSessionId = session\.experienceSessionId;[\s\S]+isCameraCaptureOwnerCurrent\(experienceSessionId, activeExperienceSessionIdRef\.current\)[\s\S]+persistCameraCapturedArtifact\(artifact, experienceSessionId\)[\s\S]+discardPersistedCameraPhoto\(durableRecord\)/, "capture must freeze shutter-time ownership and discard a record if its owner becomes stale before runtime exposure");
  assert.match(appSource, /deleteStalePlayerCameraRolls\(experienceSessionId\)[\s\S]+owner filtering remains active/, "stale cleanup failure must leave explicit owner filtering as the privacy boundary");
  assert.match(ios4KeyboardSource, /activeRegistration = useRef<IOS4InputRegistration \| null>\(null\)/, "the keyboard must enforce one active input owner");
  assert.match(ios4KeyboardSource, /export type IOS4KeyboardDismissReason =[\s\S]+"submit"[\s\S]+"navigation"[\s\S]+"app-switch"[\s\S]+"session-reset"[\s\S]+"explicit";/, "keyboard dismissal must use centralized typed reasons");
  assert.doesNotMatch(ios4KeyboardSource, /tap-anywhere|document\.addEventListener|window\.addEventListener\(["'](?:click|pointerdown|mousedown|touchstart)/, "the shared keyboard must not implement universal outside-tap dismissal");
  assert.match(ios4KeyboardSource, /mode: "letters"[\s\S]+shiftState: "lower"[\s\S]+keyboardVisible: false/, "new and reset keyboard sessions must return to the hidden lowercase alphabet baseline");
  assert.doesNotMatch(ios4KeyboardSource, /facebookState|twitterState|instagramState|foursquareState|messagesState|sessionSeedContent|Date\.|setTimeout|setInterval/, "device keyboard state must remain independent from app data and simulated time");
  assert.doesNotMatch(ios4KeyboardSource, /predictive|QuickType|dictation|microphone|emoji|swipe/i, "v0.1 keyboard source must not import later keyboard-only UI");
  assert.match(deviceCssSource, /\.ios4-keyboard-system[\s\S]+\.ios4-keyboard-viewport[\s\S]+\.ios4-keyboard \{/, "keyboard viewport and chrome must remain under one system-scoped CSS root");
  const numberSecondRowMatch = ios4KeyboardSource.match(/const NUMBER_ROWS = \[\s*\[\.\.\."1234567890"\],\s*\[([^\]]+)\] as const,/);
  assert.ok(numberSecondRowMatch, "the 123 keyboard must retain an explicit punctuation row");
  const numberSecondRow = JSON.parse(`[${numberSecondRowMatch[1]}]`);
  assert.deepEqual(numberSecondRow, ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""], "the 123 second row must contain exactly ten keys ending with double quote");
  const symbolSecondRowMatch = ios4KeyboardSource.match(/const SYMBOL_ROWS = \[[\s\S]*?\[([^\]]+)\] as const,\s*\] as const;/);
  assert.ok(symbolSecondRowMatch, "the #+= keyboard must retain an explicit secondary punctuation row");
  const symbolSecondRow = JSON.parse(`[${symbolSecondRowMatch[1]}]`);
  assert.deepEqual(symbolSecondRow, ["_", "\\", "|", "~", "<", ">", "€", "£", "¥", "•"], "the #+= second row must contain exactly ten keys with bullet directly after yen");
  assert.match(ios4KeyboardSource, /state\.mode !== "letters" && index === 1 \? " is-ten-key-punctuation"/, "both ten-key punctuation pages must receive the explicit ten-column correction");
  assert.match(ios4KeyboardSource, /row\.map\(key => <IOS4KeyboardKey key=\{key\} label=\{key\} onPress=\{\(\) => pressCharacter\(key\)\}/, "every punctuation key, including bullet, must insert its exact row-data character");
  assert.match(deviceCssSource, /\.ios4-keyboard-row\.is-row-2\.is-ten-key-punctuation \{ grid-template-columns: repeat\(10,minmax\(0,1fr\)\); column-gap: 3px; padding: 0; \}/, "both punctuation second rows must use ten explicit non-wrapping grid columns");
  assert.doesNotMatch(deviceCssSource, /\.ios4-keyboard-row\.is-row-2\.is-ten-key-punctuation[^}]*flex-wrap/, "ten-key punctuation rows must not use a wrapping flex layout");
  assert.match(ios4KeyboardSource, /state\.mode === "numbers" \? "#\+=" : "123"/, "the 123 third row must continue to begin with the #+= control");
  assert.doesNotMatch(deviceCssSource, /\.(?:facebook|twitter|instagram|foursquare)-keyboard/, "apps must not gain independently themed keyboard implementations");

  const pageOneSource = springBoardSource.match(/const PAGE_ONE_APPS[^=]*= \[([\s\S]*?)\n\] as const;/)?.[1];
  const pageTwoSource = springBoardSource.match(/const PAGE_TWO_APPS[^=]*= \[([\s\S]*?)\n\] as const;/)?.[1];
  const dockSource = springBoardSource.match(/const DOCK_APPS = \[([\s\S]*?)\n\] as const;/)?.[1];
  assert.ok(pageOneSource && pageTwoSource && dockSource, "SpringBoard must retain explicit fixed page and dock registries");
  const pageOneNames = [...pageOneSource.matchAll(/name: "([^"]+)"/g)].map(match => match[1]);
  const pageTwoNames = [...pageTwoSource.matchAll(/name: "([^"]+)"/g)].map(match => match[1]);
  const dockNames = [...dockSource.matchAll(/name: "([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(pageOneNames, ["Calendar", "Photos", "Stocks", "Maps", "Weather", "Notes", "Utilities", "iTunes", "App Store", "Game Center", "Settings", "Facebook", "Twitter", "Instagram", "Foursquare", "Flickr"], "Page 1 must preserve the exact stock-first sixteen-slot order");
  assert.deepEqual(pageTwoNames, ["Tumblr", "WhatsApp", "Skype"], "Page 2 must begin with Tumblr, WhatsApp, and Skype in fixed slots");
  assert.deepEqual(dockNames, ["Messages", "Safari", "Camera", "YouTube"], "the dock must contain exactly the four canonical apps in order");
  assert.equal(pageOneNames.length, 16, "Page 1 must contain exactly sixteen populated fixed slots");
  assert.equal(new Set(pageOneNames).size, 16, "Page 1 app names must be unique");
  assert.equal([...pageOneNames, ...pageTwoNames].filter(name => dockNames.includes(name)).length, 0, "dock apps must not be duplicated on either page");
  assert.equal(new Set([...pageOneNames, ...pageTwoNames, ...dockNames]).size, pageOneNames.length + pageTwoNames.length + dockNames.length, "SpringBoard app names must not be duplicated across pages and dock");
  assert.deepEqual(pageOneNames.slice(10, 16), ["Settings", "Facebook", "Twitter", "Instagram", "Foursquare", "Flickr"], "Settings must immediately precede Facebook and the four requested social apps must occupy Row 4");
  assert.match(springBoardSource, /const PAGE_TWO_APPS:[^=]+ = \[[\s\S]+name: "Tumblr"[\s\S]+name: "WhatsApp"[\s\S]+name: "Skype"[\s\S]+undefined,\s*undefined,\s*undefined,\s*undefined,\s*undefined,\s*undefined,\s*undefined,\s*undefined,\s*undefined,\s*undefined,\s*undefined,\s*undefined,\s*undefined,\s*\] as const;/, "Page 2 must retain sixteen explicit slots with three top-row apps and thirteen trailing empties");
  assert.match(deviceCssSource, /\.springboard-icon-grid \{[^}]*left: 16px;[^}]*top: 36px;[^}]*grid-template-columns: repeat\(4,59px\);[^}]*grid-template-rows: repeat\(4,74px\);[^}]*column-gap: 17px;[^}]*row-gap: 14px;/, "SpringBoard pages must use the fixed 4x4 iPhone portrait slot geometry");
  assert.doesNotMatch(deviceCssSource, /\.springboard-icon-grid[^}]*(?:space-around|space-between|auto-fit|auto-fill)/, "SpringBoard slot geometry must remain independent of item count");
  assert.match(deviceCssSource, /\.springboard-page-indicator \{[^}]*bottom: 84px;/, "page-dot position must remain fixed independently of populated rows");
  assert.match(deviceCssSource, /\.springboard-dock \{[^}]*height: 84px;[^}]*grid-template-columns: repeat\(4,59px\);[^}]*column-gap: 17px;/, "the dock must retain four fixed icon slots");
  assert.match(springBoardSource, /dock && iconSrc && <span className="springboard-dock-icon-reflection" aria-hidden="true">\s*<img src=\{iconSrc\} alt="" \/>\s*<\/span>/, "each dock reflection wrapper must contain only the same canonical icon artwork, leaving labels and unread badges as unreflected siblings");
  assert.match(deviceCssSource, /\.springboard-dock-icon-reflection \{[^}]*height: 16px;[^}]*overflow: hidden;[^}]*mask-image: linear-gradient\(to bottom,[^}]*transparent\);[^}]*\}[\s\S]+\.springboard-dock-icon-reflection > img \{[^}]*transform: scaleY\(-1\);/, "dock reflections must use one clipped, vertically mirrored, downward-fading treatment");
  assert.match(deviceCssSource, /\.springboard-icon-label \{[^}]*font-family: "Helvetica Neue",Helvetica,Arial,sans-serif;[^}]*font-size: 10px;[^}]*font-weight: 600;[^}]*text-shadow: 0 1px 1px rgba\(0,0,0,\.95\),0 0 1px rgba\(0,0,0,\.78\);/, "all SpringBoard icon labels must retain one scoped compact period-style weight and dark edge treatment");
  assert.match(springBoardSource, /name: "Utilities"[^\n]+kind: "folder"[^\n]+folderId: "utilities"[^\n]+folderApps: UTILITIES_APPS/, "Utilities must be a real folder entry using the shared folder runtime");
  assert.deepEqual([...springBoardSource.matchAll(/\{ name: "(Clock|Calculator|Compass|Voice Memos)", iconSrc:/g)].map(match => match[1]), ["Clock", "Compass", "Calculator", "Voice Memos"], "Utilities must retain the approved reference order");
  assert.match(springBoardSource, /name: "Game Center", iconSrc: gameCenterIconSrc/, "Game Center must remain present with its iOS 4.1 asset");
  assert.match(springBoardSource, /name: "WhatsApp"[^\n]+whatsAppIconSrc/, "WhatsApp must use the archived 2010 App Store artwork");
  assert.match(springBoardSource, /name: "Skype"[^\n]+skypeIconSrc/, "Skype must use the archived 2010 App Store artwork");
  assert.match(springBoardSource, /SpringBoardFolderIcon[\s\S]+springboard-folder-mini-grid[\s\S]+miniatures\.slice\(0, 9\)/, "folder tiles must expose miniatures of their contained applications");
  assert.match(springBoardSource, /const panelHeight = 125 \+ \(rows - 1\) \* 85;/, "folder tray height must follow the target-build row formula");
  assert.equal((springBoardSource.match(/className="springboard-folder-notch is-top"/g) ?? []).length, 1, "the shared open-folder tray must render exactly one top pointer");
  assert.doesNotMatch(springBoardSource, /springboard-folder-notch is-bottom|folderShadowBottomNotchSrc/, "the open-folder tray must not retain a second hidden pointer instance");
  assert.match(appSource, /const \[activeFolderSlotIndex, setActiveFolderSlotIndex\] = useState\(0\);/, "App must retain active folder-slot ownership across SpringBoard unmounts");
  assert.match(deviceScreenMountSource, /navigation=\{\{[^}]+activeFolderSlotIndex,\s+setActiveFolderSlotIndex,/, "App must pass its folder slot and setter to DeviceScreen without creating screen-local state");
  assert.match(deviceScreenSource, /<SpringBoard\s[^]*?activeFolderSlotIndex=\{activeFolderSlotIndex\}\s+onActiveFolderSlotChange=\{setActiveFolderSlotIndex\}/, "DeviceScreen must forward the retained folder slot and setter to SpringBoard");
  assert.match(springBoardSource, /const openFolder = \(slotIndex: number\)[\s\S]+onActiveFolderSlotChange\(slotIndex\)[\s\S]+openFolder\(index\)/, "folder pointer ownership must retain the triggering fixed-grid slot index");
  assert.match(springBoardSource, /const sourceColumn = sourceSlotIndex % SPRINGBOARD_COLUMN_COUNT;[\s\S]+SPRINGBOARD_GRID_LEFT[\s\S]+sourceColumn \* \(SPRINGBOARD_SLOT_WIDTH \+ SPRINGBOARD_COLUMN_GAP\)[\s\S]+SPRINGBOARD_SLOT_WIDTH \/ 2/, "folder pointer center X must derive from the active slot column and fixed SpringBoard geometry");
  assert.match(springBoardSource, /const pointerLeft = anchorX - FOLDER_POINTER_WIDTH \/ 2;[\s\S]+left: pointerLeft/, "the shared pointer element must center on the calculated folder anchor");
  assert.match(deviceCssSource, /\.springboard-folder-panel \{[^}]*overflow: visible;[^}]*\}[\s\S]+\.springboard-folder-tray \{[^}]*overflow: hidden;[^}]*\}/, "the animated panel must expose the pointer while an inner tray wrapper clips linen content");
  assert.match(deviceCssSource, /\.springboard-folder-notch\.is-top \{ top: -12px; height: 12px;[^}]*background-size: 320px 360px;[^}]*clip-path: polygon\(50% 0,100% 100%,0 100%\);/, "the shared pointer must expose one attached twelve-point linen-textured ramp");
  assert.match(springBoardSource, /className="springboard-folder-notch is-top"[\s\S]+backgroundImage: `url\(\$\{folderLinenSrc\}\)`[\s\S]+backgroundPosition:/, "the folder pointer must continue the same recovered linen texture as the tray");
  assert.match(deviceCssSource, /\.springboard\.is-folder-opening \.springboard-page-split-region\.is-active-folder-anchor \.springboard-icon-label \{ animation: springboard-folder-label-hide 300ms ease-in-out both; \}[\s\S]+\.springboard\.is-folder-open \.springboard-page-split-region\.is-active-folder-anchor \.springboard-icon-label \{ opacity: 0; \}[\s\S]+springboard-folder-label-show 300ms ease-in-out both;/, "the active folder's closed-state label must hide and restore with the folder transition");
  assert.equal((springBoardSource.match(/className="springboard-folder-title-layer">Utilities/g) ?? []).length, 1, "the open tray must retain exactly one full-contrast Utilities title");
  assert.match(springBoardSource, /const activeFolderRow = Math\.floor\(activeFolderSlotIndex \/ SPRINGBOARD_COLUMN_COUNT\);[\s\S]+const splitDistance = FOLDER_TRAY_BASE_HEIGHT - SPRINGBOARD_ROW_GAP;[\s\S]+const upperShift = Math\.round\(splitDistance \* \(activeFolderRow \+ 1\) \/ \(SPRINGBOARD_ROW_COUNT \+ 1\)\);[\s\S]+const lowerShift = splitDistance - upperShift;/, "folder split distances must derive from the active fixed-grid row rather than a Utilities-only offset");
  assert.match(springBoardSource, /const SPRINGBOARD_SLOT_HEIGHT = 74;[\s\S]+const SPRINGBOARD_ROW_GAP = 14;[\s\S]+const FOLDER_TRAY_BASE_HEIGHT = 125;/, "folder opening must preserve the standard 74-point slots, 14-point row gap, and 125-point base tray instead of compressing the SpringBoard");
  assert.match(springBoardSource, /const folderTrayTop = SPRINGBOARD_GRID_TOP[\s\S]+activeFolderRow \* \(SPRINGBOARD_SLOT_HEIGHT \+ SPRINGBOARD_ROW_GAP\)[\s\S]+SPRINGBOARD_SLOT_HEIGHT[\s\S]+- upperShift;/, "the folder tray top must remain attached directly beneath the translated source row");
  assert.match(springBoardSource, /if \(folderState !== "closed"\) return;[\s\S]+setPointerCapture/, "an open or transitioning folder must own interaction instead of starting a page swipe");
  assert.match(springBoardSource, /springboard-page-split-region is-upper[\s\S]+springboard-page-split-region is-active-folder-anchor[\s\S]+springboard-page-split-region is-lower/, "the source page must retain explicit upper, active-anchor, and lower split regions");
  assert.match(springBoardSource, /event\.target === event\.currentTarget\) dispatch\("CLOSE"\)/, "tapping outside the shared folder tray must retain the close path");
  assert.match(springBoardSource, /onActivate=\{state === "open" \? \(\) => onLaunchApp\(app\.launchId\) : undefined\}/, "folder apps must remain launchable from inside the stable open tray");
  assert.match(appSource, /session\.phase === "springboard" && \(folderState === "open" \|\| folderState === "opening"\)[\s\S]+dispatchFolderEvent\("CLOSE"\);[\s\S]+return;/, "the physical Home control must close an open SpringBoard folder first");
  assert.match(deviceCssSource, /\.springboard-folder-wallpaper-dim \{[^}]*inset: 20px 0 0;[^}]*background: rgba\(8,11,16,\.48\);/, "folder dimming must begin below the fixed status bar and remain a temporary translucent treatment");
  assert.match(deviceCssSource, /\.springboard\.is-folder-opening \.springboard-page-indicator,[\s\S]+translate\(-50%, var\(--folder-lower-offset\)\)/, "page dots must join the coherent lower SpringBoard displacement while a folder opens");
  assert.match(deviceCssSource, /\.springboard\.is-folder-opening \.springboard-dock,[\s\S]+\.springboard\.is-folder-open \.springboard-dock \{[^}]*translateY\(100%\);/, "the dock must complete its downward motion fully beyond the physical viewport while a folder is open");
  assert.match(deviceCssSource, /\.springboard-pages \{[^}]*inset: 0 0 84px;[^}]*overflow: hidden;[^}]*\}[\s\S]+\.springboard\.is-folder-opening \.springboard-pages,[\s\S]+\.springboard\.is-folder-open \.springboard-pages,[\s\S]+\.springboard\.is-folder-closing \.springboard-pages \{ overflow: visible; \}/, "folder states must remove the closed-page child clip so the lower SpringBoard remains continuous below the tray");
  assert.match(deviceCssSource, /\.screen \{[^}]*height: var\(--iphone4-screen-height\);[^}]*overflow: hidden;/, "only the canonical physical device screen may clip the final folder-open composition");
  assert.match(deviceCssSource, /\.springboard-dock \{[^}]*height: 84px;/, "folder opening must not compress the standard 84-point dock region");
  assert.match(deviceCssSource, /springboard-folder-region-open 300ms ease-in-out[\s\S]+springboard-folder-tray-open 300ms ease-in-out/, "split regions and folder tray must use one synchronized reconstructed 300ms mechanical transition");
  assert.doesNotMatch(deviceCssSource, /@keyframes springboard-folder-(?:open|close)[^{]*\{[^}]*scale\(/, "folder presentation must not regress to the former whole-panel scale effect");
  const folderLaunchLifecycleSource = appSource.slice(appSource.indexOf("const launchSpringBoardApp"), appSource.indexOf("const openLockNotificationTarget"));
  const folderSleepLifecycleSource = appSource.slice(appSource.indexOf("const endPower"), appSource.indexOf("const cancelPower"));
  const folderUnlockLifecycleSource = appSource.match(/const completeScreenUnlock: DeviceScreenProps\["actions"\]\["completeScreenUnlock"\] = \(\) => \{[\s\S]*?\n  \};/)?.[0];
  assert.ok(folderUnlockLifecycleSource, "the named unlock controller must remain in App; a missing boundary must not silently validate an empty slice");
  assert.match(deviceScreenMountSource, /actions=\{\{[^}]+completeScreenUnlock,/, "App must pass the existing unlock controller to DeviceScreen");
  assert.match(deviceScreenSource, /<LockScreen\s[^]*?onUnlock=\{completeScreenUnlock\}/, "LockScreen must invoke the App-owned unlock controller");
  assert.doesNotMatch(folderLaunchLifecycleSource, /dispatchFolderEvent|setActiveFolderSlotIndex/, "app launch must not close or retarget the active folder");
  assert.doesNotMatch(folderSleepLifecycleSource, /dispatchFolderEvent|setActiveFolderSlotIndex/, "sleep and lock must not close or retarget the active folder");
  assert.doesNotMatch(folderUnlockLifecycleSource, /dispatchFolderEvent|setActiveFolderSlotIndex/, "unlock must not close or retarget the active folder");
  assert.equal((appSource.match(/dispatchFolderEvent\("CLOSE"\)/g) ?? []).length, 2, "only full shutdown and explicit Home-on-SpringBoard may dispatch the folder close event");
  assert.match(springBoardSocialAppsSource, /id: "facebook"[\s\S]+id: "twitter"[\s\S]+id: "foursquare"[\s\S]+id: "tumblr"[\s\S]+id: "flickr"[\s\S]+id: "instagram"/, "the stable social-app registry must preserve all six existing application IDs");
  assert.equal((springBoardSocialAppsSource.match(/artworkStatus: "RECONSTRUCTED_FROM_PERIOD_REFERENCE"/g) ?? []).length, 6, "all six third-party SpringBoard icons must carry explicit reference-derived provenance");
  assert.equal((springBoardSocialAppsSource.match(/iconStatus: "HOLD"/g) ?? []).length, 6, "reference-derived artwork must not be mislabeled as a recovered original bundle payload");
  assert.equal((springBoardSocialAppsSource.match(/referenceUrl: "https:\/\/www\.webdesignmuseum\.org\/iphone\//g) ?? []).length, 6, "each reconstructed icon must retain its supplied dated visual reference");
  assert.match(springBoardSource, /function SpringBoardSocialIcon[\s\S]+SPRINGBOARD_SOCIAL_APPS\.find[\s\S]+className="springboard-social-icon"[\s\S]+src=\{app\.iconSrc\}[\s\S]+data-artwork-status=\{app\.artworkStatus\}/, "SpringBoard must render the central raster registry and expose its reconstruction status");
  assert.doesNotMatch(springBoardSource, /ReconstructedSocialIcon|appId === "facebook"|appId === "twitter"|appId === "foursquare"|>••<|>◉</, "third-party launchers must not regress to per-app letter or symbol placeholders");
  assert.match(deviceCssSource, /\.springboard-social-icon \{[^}]*left: 1px;[^}]*top: 1px;[^}]*width: 57px;[^}]*height: 57px;[^}]*object-fit: cover;[^}]*border-radius: 10px;/, "reference-derived icons must retain the established 57-point SpringBoard artwork box");
  assert.doesNotMatch(deviceCssSource, /\.springboard-social-icon\.is-(?:facebook|twitter|instagram|foursquare|flickr|tumblr)/, "CSS letter/gradient approximations must not return beside the raster registry");
  const reconstructedThirdPartyIcons = [
    ["Facebook-2010-reference@2x.png", 114, "471b6971281523cb276ec88ffe911d80438a9081613e32e78ed138f946c03340"],
    ["Twitter-2010-reference@2x.png", 114, "b12f9939f32c16816009ecec206e4f42f0b16a9717806be79af52ec856eccaaa"],
    ["Instagram-2010-reference@2x.png", 114, "03ea31e8af5afc1bbf8dc506a05c5dfcb365bd61f607ad47cd70493a6e8a777a"],
    ["Foursquare-2010-reference@2x.png", 114, "e31eddda163b1d974952c4e5e93218c9cac33c2b2af20476bed1ac78f65f6dfc"],
    ["Flickr-2010-reference.png", 57, "93ea3a49ec696769b0a60469aa485166d2aea0c07a112461ac74f39b82061aa5"],
    ["Tumblr-2010-reference@2x.png", 114, "f2a704a65d07dcbecaf7a4ea551c7dc5cad391b7eb77f565d1b1118813d3ddf9"],
  ];
  for (const [fileName, pixelSize, expectedHash] of reconstructedThirdPartyIcons) {
    const iconBytes = await readFile(resolve(projectRoot, "src/assets/historical/ios4.1/springboard/apps/third-party", fileName));
    assert.equal(iconBytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${fileName} must remain a PNG raster asset`);
    assert.equal(iconBytes.readUInt32BE(16), pixelSize, `${fileName} must retain its audited pixel width`);
    assert.equal(iconBytes.readUInt32BE(20), pixelSize, `${fileName} must retain its audited pixel height`);
    assert.equal(createHash("sha256").update(iconBytes).digest("hex"), expectedHash, `${fileName} must not silently drift from the audited reconstruction`);
  }
  const promotedSocialIds = [...pageOneSource.matchAll(/socialAppId: "([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(promotedSocialIds, ["facebook", "twitter", "instagram", "foursquare", "flickr"], "Page 1 social icons must retain their stable IDs in the corrected order");
  assert.equal(new Set(promotedSocialIds).size, promotedSocialIds.length, "promoted social app IDs must not be duplicated");
  const pageLaunchIds = [...`${pageOneSource}\n${pageTwoSource}`.matchAll(/launchId: "([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(pageLaunchIds).size, pageLaunchIds.length, "SpringBoard page launch IDs must not be duplicated");
  assert.deepEqual(pageLaunchIds, ["calendar", "photos", "maps", "itunes", "facebook", "twitter", "instagram", "foursquare", "flickr", "tumblr", "whatsapp", "skype"], "the approved Photos launcher, direct social launchers, and HOLD app shells must retain their stable IDs across both pages");
  assert.doesNotMatch(springBoardSource, /name: "Social"|folderId: "social"|const SOCIAL_APPS|activeFolderId/, "the retired Social folder instance and its SpringBoard-specific state must be absent");
  assert.doesNotMatch(springBoardSocialAppsSource, /SOCIAL_FOLDER_SLOTS/, "the retired Social folder's padded slot registry must remain removed");
  assert.match(deviceCssSource, /\.screen > \.springboard \{[^}]*DefaultWallpaper@2x~iphone\.png[^}]*320px 480px no-repeat;/, "the existing water-droplet wallpaper and crop must remain unchanged");
  assert.match(appSource, /createStatusBarState\(\{[\s\S]+signalStrength: 5,[\s\S]+network: DEVICE_CARRIER_CONFIG\.networkType,[\s\S]+bluetoothEnabled: false,[\s\S]+charging: false,[\s\S]+carrier: DEVICE_CARRIER_CONFIG\.carrier/, "the established SpringBoard status-bar configuration must remain unchanged");
  assert.doesNotMatch(springBoardSource, /iphone os 5|ios 5|newsstand|passbook|health|wallet|control center/i, "SpringBoard must not include post-iOS-4 applications or chrome");
  assert.doesNotMatch(springBoardSource, /facebookState|twitterState|instagramState|foursquareState|messagesState|sessionSeedContent/, "SpringBoard placement must not couple to application data or reducers");

  const springBoardOriginalIconHashes = Object.freeze({
    "Calendar@2x.png": "1bbc4d9bd75edb5fe3cd3d7cb8ad8a669909117ddc36bfb7f9420cc7b412e042",
    "Photos@2x.png": "8ee378887d5cd2415544f3588e1c2d823fdc934f7ad2707d7810f37b750bbede",
    "Stocks@2x.png": "020e4f247290a859fb1bc459c9c7ed8b0259ef1d4bcc61a2eaf56677eafb382e",
    "Maps@2x.png": "44895c61986aebf4e64f625382f31ea1454af3bc65ee31d03c4ef2ad0bb13a55",
    "Weather@2x.png": "c41a834ec31239fdcc886e1cfc78a571144db914841792790440ba27612dcbed",
    "Notes@2x.png": "48b87b32327dc974697d9c0989c77e06241fd7f562390c4a5ef591a0c08f7310",
    "iTunes@2x.png": "1b1cfd7cc532fa48a0c9fda9c132ab52933d84fd0ee85a1e19aac60b25b663d6",
    "AppStore@2x.png": "638b5d917401c91d19e6c040f5bfbc5c84a900cf6f6db8064a129304f06b63f4",
    "GameCenter@2x.png": "189f1c065ae7932654a2815244cfa3682cc42d764a0d35b66d25fbca2348d534",
    "Settings@2x.png": "fb9472654d75aab98cb940482a1b9ce15f82fc230902dbac7b7950644e5d5cc7",
    "Clock@2x.png": "083f98c421c5c19b7ff2aa7f03915e0549414a0c5a238e6ad1e41837c05b7930",
    "Calculator@2x.png": "a0abc743da2afd355c9de5778644184f2159d76aeaa99f5b4adf2425163a1c2b",
    "Compass@2x.png": "44ccbc5fbfce28791fe146de23465559b398948a43fe0a4468b59645908150a3",
    "VoiceMemos@2x.png": "b43bc46256e6f1b46c381266eac589db9e90313cfb34aa3f2d823b99ea4a4cc2",
    "Messages@2x.png": "7de42ad9a1e2d876abc95a742724366dca8405e3f7bfec8e1469fc8ce2cbbc79",
    "Safari@2x.png": "7d6a1fcbf071278778930ab0063f82d8f11f72aa6358266ffbdba6ba27a04709",
    "Camera@2x.png": "fda38114fc4ce321595513927250414f5caed2d6a5a694a6a2580a5e562a790e",
    "YouTube@2x.png": "81ef16bbb2d3e04e5a45c7cdf2c2800093126b4b54a5d42229183d014eb3d7b6",
  });
  for (const [filename, expectedHash] of Object.entries(springBoardOriginalIconHashes)) {
    const originalBytes = await readFile(resolve(projectRoot, "src/assets/historical/ios4.1/springboard/apps", filename));
    const browserBytes = await readFile(resolve(projectRoot, "src/assets/historical/ios4.1/springboard/apps", filename.replace(".png", ".browser.png")));
    assert.equal(createHash("sha256").update(originalBytes).digest("hex"), expectedHash, `${filename} must remain byte-identical to its 8B117 source`);
    assert.equal(browserBytes.indexOf(Buffer.from("CgBI")), -1, `${filename} must retain a browser-readable standard-PNG companion`);
  }
  const springBoardArchivedAppStoreIconHashes = Object.freeze({
    "WhatsApp-2010-AppStore.jpg": "a0c832fd18475b82b0df9b75556a8c7470c827db5e5f4e29672eabe35ed0db46",
    "Skype-2010-AppStore.jpg": "53cfcde8151f0312b856d6cdf3114fadbb353803496c8df44530ebd3aac45df9",
  });
  for (const [filename, expectedHash] of Object.entries(springBoardArchivedAppStoreIconHashes)) {
    const artworkBytes = await readFile(resolve(projectRoot, "src/assets/historical/ios4.1/springboard/apps", filename));
    assert.equal(createHash("sha256").update(artworkBytes).digest("hex"), expectedHash, `${filename} must remain byte-identical to its dated archived Apple-CDN source`);
  }
  assert.match(facebookContainerSource, /import \{ IOS4Input, IOS4Textarea \} from "\.\/IOS4KeyboardSystem";/, "Facebook must consume the shared system inputs rather than own keyboard chrome");
  assert.match(facebookContainerSource, /keyboardInputId="facebook-home-search"[\s\S]+EDIT_HOME_SEARCH/, "Facebook Home Search must register with the shared keyboard and retain its handler");
  assert.match(facebookContainerSource, /keyboardInputId=\{`facebook-\$\{state\.friendsSection\}-search`\}[\s\S]+EDIT_FRIEND_SEARCH/, "Facebook Friends and Pages Search must share explicit keyboard ownership with existing live filtering");
  assert.match(facebookContainerSource, /keyboardInputId="facebook-status"[^>]+autoFocus[^>]+onValueChange=\{value => dispatch\(\{ type: "EDIT_STATUS", value \}\)\}/, "Facebook Status must auto-focus through the shared keyboard wrapper and retain its draft event");
  assert.match(facebookContainerSource, /keyboardInputId=\{`facebook-comments-\$\{selectedItem\.id\}`\}[\s\S]+EDIT_COMMENT/, "Facebook Comments must register with the shared keyboard and retain its handler");
  assert.match(facebookContainerSource, /keyboardInputId=\{`facebook-feed-comment-\$\{selectedItem\.id\}`\}[\s\S]+keyboardInputId=\{`facebook-inbox-\$\{selectedMessage\.id\}`\}/, "Facebook Feed comments and Inbox replies must both register with the shared keyboard");
  assert.match(facebookContainerSource, /keyboardInputId=\{`facebook-chat-\$\{peer\.characterId\}`\}[\s\S]+EDIT_CHAT_DRAFT/, "Facebook Chat must register with the shared keyboard and retain its handler");
  assert.match(facebookContainerSource, /keyboardInputId=\{`facebook-place-\$\{venue\.id\}`\}[\s\S]+EDIT_PLACE_STATUS/, "Facebook Places status must register without changing check-in state handling");
  assert.match(facebookContainerSource, /keyboardInputId=\{`facebook-photo-comment-\$\{photo\.storyId\}`\}[\s\S]+EDIT_COMMENT/, "Facebook Photo comments must register with the shared keyboard");
  assert.match(ios4KeyboardSource, /const initialAutofocus = openWhenMounted && !initialFocusHandled\.current;\s+initialFocusHandled\.current = true;\s+if \(context\.suspended\) return;\s+if \(\(initialAutofocus \|\| document\.activeElement === registration\.element\)[\s\S]+context\.openKeyboard\(registration\)/, "initial autofocus and explicit focus must acquire ownership only while the shared keyboard is not suspended");
  assert.match(ios4KeyboardSource, /registration\.inputType === "multi-line" && registration\.returnKeyType === "return"[\s\S]+applyTextEdit\("\\n"\)[\s\S]+return;/, "multiline Return must insert a newline rather than submit");
  assert.match(facebookContainerSource, /new ResizeObserver\(scrollToLatest\)[\s\S]+observer\.observe\(transcript\)/, "Facebook Chat must preserve its latest-message viewport while the keyboard resizes it");
  assert.match(mobileSmsContainerSource, /<IOS4Input[\s\S]+keyboardInputId="messages-compose"[\s\S]+onValueChange=\{value => dispatch\(\{ type: "EDIT_DRAFT", value \}\)\}/, "Messages compose must use the shared keyboard and canonical draft event");
  assert.match(mobileSmsContainerSource, /keyboardReturnKeyType="send"[\s\S]+onKeyboardSubmit=\{sendDraft\}/, "Messages must retain continuous shared-keyboard Send semantics");
  assert.match(mobileSmsContainerSource, /new ResizeObserver\(scrollToLatest\)[\s\S]+observer\.observe\(transcript\)/, "Messages must keep the latest message visible during keyboard resize");
  assert.match(twitterContainerSource, /<IOS4Textarea[\s\S]+keyboardInputId=\{replyTarget[\s\S]+onValueChange=\{onChange\}/, "Twitter compose and reply must share the system keyboard without moving tweet state");
  assert.doesNotMatch(twitterContainerSource, /<IOS4Textarea[^>]+keyboardReturnKeyType="send"/, "Twitter's actual multiline textarea must retain Return/newline semantics and use its explicit header Send control");
  assert.match(foursquareContainerSource, /<IOS4Textarea[\s\S]+keyboardInputId=\{`foursquare-shout-[\s\S]+EDIT_CHECK_IN_SHOUT/, "Foursquare check-in text must use the shared keyboard and existing event");
  assert.match(foursquareContainerSource, /friends: \{ label: "Friends"[\s\S]+places: \{ label: "Places"[\s\S]+tips: \{ label: "Tips"[\s\S]+todos: \{ label: "To-Dos"[\s\S]+profile: \{ label: "Profile"/, "F1 shell must retain the locked five-tab labels and order");
  assert.match(foursquareContainerSource, /FOURSQUARE_ROOT_TABS\.map\(tab => <button/, "F1 shell must render every root from the locked tab definition");
  assert.match(foursquareContainerSource, /activity\.friendId[\s\S]+activity\.venueId[\s\S]+activity\.simulatedCreatedAt/, "Friends rows must resolve stable identities, venues, and simulated timestamps from structured records");
  assert.doesNotMatch(foursquareContainerSource, /split\(|match\(|checked in at.*split/i, "Friends renderer must not parse freeform check-in strings");
  const foursquareVenueRowSource = foursquareContainerSource.match(/function VenueRow\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(foursquareVenueRowSource, /venue\.categoryIcon[\s\S]*venue\.name[\s\S]*venue\.categoryLabel[\s\S]*foursquare-venue-disclosure/, "F2a rows must render explicit category artwork, truthful category metadata, and a restrained disclosure");
  assert.doesNotMatch(foursquareVenueRowSource, /venue\.(?:address|distance|mayor)|people here|nearby/i, "F2a Places rows must omit unverified geography, fabricated distance, and unsupported presence or mayor claims");
  assert.match(deviceCssSource, /\.foursquare-venue-row \{[^}]*min-height: 58px; padding: 7px 8px;[^}]*grid-template-columns: 36px minmax\(0, 1fr\) 8px;/, "F2a Places rows must retain reconstructed compact geometry");
  assert.match(deviceCssSource, /\.foursquare-venue-category-icon \{ width: 36px; height: 36px;/, "F2a category artwork must retain its reconstructed native-scale bounds");
  const foursquareVenueDetailSource = foursquareContainerSource.match(/function VenueDetail\([\s\S]*?\n\}/)?.[0] ?? "";
  const foursquareVenueSummarySource = foursquareVenueDetailSource.match(/state\.venueSubview === "summary"[\s\S]*?state\.venueSubview === "info"/)?.[0] ?? "";
  assert.match(foursquareVenueSummarySource, /venueViewModel\.categoryIcon[\s\S]*venueViewModel\.name[\s\S]*venueViewModel\.categoryLabel[\s\S]*Check In[\s\S]*Info[\s\S]*Tips/, "F2b-1 summary must render truthful venue identity and the three approved entries");
  assert.doesNotMatch(foursquareVenueSummarySource, /Mayor|Points|address|distance|friends who|here now|phone|rating|review|photos/i, "F2b-1 summary must not restore placeholder or deferred venue metadata");
  assert.match(foursquareVenueSummarySource, /venueTodo \? "Remove from To-Dos" : "Add to To-Dos"/, "F5c Venue summary must expose exactly the approved save/remove To-Do action states");
  assert.equal(foursquareVenueSummarySource.match(/To-Dos/g)?.length, 2, "F5c Venue summary must contain no To-Do wording beyond the two approved action states");
  assert.doesNotMatch(foursquareVenueSummarySource, /I've done this|\bDone\b|Completed/i, "F5c Venue summary must not expose To-Do completion wording");
  assert.doesNotMatch(foursquareVenueSummarySource, /ADD_TIP_TODO|tipTodo|Add Tip to To-Dos|Save Tip/i, "F5c Venue summary must not expose Tip-to-To-Do UI");
  assert.doesNotMatch(foursquareVenueSummarySource, /todo(?:s)?(?:Count|Badge)|To-Dos\s*\(\d+\)|\d+\s+To-Dos|badge/i, "F5c Venue summary must not expose a To-Do count or badge");
  assert.doesNotMatch(foursquareVenueSummarySource, /map|filter/i, "F5c Venue summary must not expose map or filter UI");
  assert.match(foursquareVenueDetailSource, /state\.venueSubview === "checkIn"/, "F2b-1 must gate the existing functional form behind the Check In subview");
  assert.match(foursquareVenueDetailSource, /<IOS4Textarea[\s\S]*EDIT_CHECK_IN_SHOUT/, "F2b-1 must preserve the shared textarea and venue-keyed draft event");
  assert.match(foursquareVenueDetailSource, /<form className="foursquare-checkin-form"[\s\S]*type: "CHECK_IN"/, "F2b-1 must preserve the existing Check In submit event");
  const foursquareCheckInSource = foursquareVenueDetailSource.match(/state\.venueSubview === "checkIn"[\s\S]*?<\/article>/)?.[0] ?? "";
  assert.match(deviceScreenSource, /<FoursquareContainer[\s\S]*currentDeviceDateTime=\{deviceDateTime\}/, "F2c-1 must pass the existing simulated device datetime into Foursquare");
  assert.match(foursquareCheckInSource, /currentDeviceDateTime\.getTime\(\)[\s\S]*type: "CHECK_IN"[\s\S]*checkInTimestamp/, "F2c-1 must freeze the simulated device timestamp at check-in submission");
  assert.doesNotMatch(foursquareCheckInSource, /Date\.now\(|new Date\(/, "F2c-1 check-in submission must not use the host clock");
  assert.match(foursquareCheckInSource, /foursquare-checkin-venue-context[\s\S]*venueViewModel\.name[\s\S]*venueViewModel\.categoryLabel/, "F2c-1 must render the truthful text-only venue context");
  assert.doesNotMatch(foursquareCheckInSource, /address|distance|coordinates|map|mayor|people here/i, "F2c-1 venue context must omit unsupported location and presence claims");
  assert.match(foursquareCheckInSource, /maxLength=\{140\}[\s\S]*Check-in here/, "F2c-1 must retain the project-canonical shout limit and reconstructed action label");
  assert.doesNotMatch(foursquareCheckInSource, /Twitter|Facebook|sharing|socialActivities|DELIVER_SOCIAL_ACTIVITY/, "F2c-1 must not invent sharing controls or player social-activity insertion");
  assert.match(foursquareStateSource, /pointEvents: FoursquarePointEvent\[\]; latestCheckinResult: FoursquareCheckinResult \| null/, "F3a state must store events and its frozen latest result");
  assert.doesNotMatch(foursquareStateSource, /\bpoints:\s*number|points:\s*state\.points|state\.points\s*\+/, "F3a must retire independently mutable aggregate scoring");
  assert.match(foursquareStateSource, /createCheckInPointEvent\(event\.venueId, event\.checkInTimestamp\)[\s\S]*buildCheckinResult\(state\.pointEvents, pointEvent\)/, "F3a CHECK_IN must atomically derive its event and frozen result from the F2c timestamp");
  assert.match(foursquareStateSource, /const result = buildCheckinResult\(state\.pointEvents, pointEvent\)[\s\S]*pointsAwarded: result\.pointDelta, result \}[\s\S]*latestCheckinResult: result[, }]/, "F3c-1 must derive compatibility points and both result references from one canonical local snapshot");
  assert.match(foursquareStateSource, /SHOW_VENUE_CHECK_IN[^\n]+state\.checkIns\[state\.selectedVenueId\] \? "result" : "checkIn"/, "F3c-2 checked venue must route directly to result while unchecked venue routes to form");
  assert.match(foursquareStateSource, /latestCheckinResult: result, venueSubview: state\.currentView === "venue"[^\n]+state\.venueSubview === "checkIn" \? "result" : state\.venueSubview/, "F3c-2 successful form check-in must route directly to result without altering unrelated programmatic subviews");
  const foursquareResultSource = foursquareContainerSource.match(/function CheckInResult\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(foursquareContainerSource, /state\.venueSubview === "result"[\s\S]*state\.checkIns\[venue\.id\]\.result/, "F3c-2 must bind the selected venue's frozen result snapshot");
  assert.doesNotMatch(foursquareResultSource, /latestCheckinResult/, "F3c-2 result renderer must never use the global latest-result pointer");
  assert.match(foursquareContainerSource, /state\.venueSubview === "result" \? "Close"/, "F3c-2 result navigation must use the confirmed Close label");
  assert.match(foursquareResultSource, /OK! We’ve got you @ \{venueName\}\./, "F3c-2 confirmation must contain the selected venue without fabricated visit data");
  assert.match(foursquareResultSource, />Points<[\s\S]*Nice check-in! You earned: <strong>\+\{result\.pointDelta\}<\/strong>[\s\S]*>Check-in<[\s\S]*\+\{result\.pointDelta\}/, "F3c-2 Points section must derive its summary and one itemized reason from the frozen delta");
  assert.match(foursquareResultSource, />Leaderboard<[\s\S]*#\{result\.rankAfter\}[\s\S]*FoursquareAvatar[\s\S]*playerDisplayName[\s\S]*result\.weeklyPointsAfter/, "F3c-2 embedded row must use frozen rank and weekly score with the existing player avatar");
  assert.doesNotMatch(foursquareResultSource, /shout|Weekly total|This week|Total points|Weekly points|Mayor|Badges|Specials|moved|climbed|overtook|basement/i, "F3c-2 must hide shout and omit unsupported total, event, and movement sections");
  assert.doesNotMatch(foursquareContainerSource, /foursquare-checkin-confirmation|Checked in\.|earned \{state\.checkIns/, "F3c-2 must remove the legacy green result renderer");
  assert.doesNotMatch(deviceCssSource, /\.foursquare-checkin-confirmation/, "F3c-2 must remove the legacy green result material");
  assert.match(deviceCssSource, /\.foursquare-result-confirmation \{[^}]*min-height: 56px;[^}]*padding: 10px 12px;/, "F3c-2 confirmation must use the reconstructed contiguous 56px field");
  assert.match(deviceCssSource, /\.foursquare-result-section-header \{[^}]*height: 23px;[^}]*padding: 0 9px;/, "F3c-2 section headers must retain compact Foursquare geometry");
  assert.match(deviceCssSource, /\.foursquare-result-points-summary \{[^}]*height: 38px;[^}]*padding: 0 12px;/, "F3c-2 points summary must use reconstructed native-scale geometry");
  assert.match(deviceCssSource, /\.foursquare-result-reason \{[^}]*height: 34px;[^}]*padding: 0 12px;/, "F3c-2 reason row must use reconstructed native-scale geometry");
  assert.match(deviceCssSource, /\.foursquare-result-leaderboard-row \{[^}]*height: 52px;[^}]*grid-template-columns: 32px 36px minmax\(0,1fr\) auto;/, "F3c-2 embedded row must remain scoped from the frozen F3b standalone row");
  assert.doesNotMatch(`${foursquareStateSource}\n${foursquareGameModelSource}`, /Date\.now\(|new Date\(|performance\.now\(/, "F3a game chronology must not use a host clock");
  assert.doesNotMatch(foursquareStateSource.match(/case "CHECK_IN":[\s\S]*?case "DELIVER_SOCIAL_ACTIVITY"/)?.[0] ?? "", /socialActivities/, "F3a player check-in must not enter the Friends activity feed");
  assert.match(foursquareStateSource, /type FoursquareView = "root" \| "venue" \| "leaderboard"/, "F3b must add only the dedicated Leaderboard child view");
  assert.match(foursquareStateSource, /case "SHOW_LEADERBOARD":[^\n]+activeTab: "profile", currentView: "leaderboard"[^\n]+selectedVenueId: null/, "F3b Leaderboard route must be profile-owned and venue-neutral");
  assert.match(foursquareStateSource, /case "SHOW_PROFILE":[^\n]+activeTab: "profile", currentView: "root"/, "F3b Back must return to Profile root");
  assert.match(foursquareContainerSource, /foursquare-profile-leaderboard-row[\s\S]*SHOW_LEADERBOARD/, "F3b Profile root must expose the minimal Leaderboard route row");
  const foursquareProfileRootSource = foursquareContainerSource.match(/\{state\.activeTab === "profile"[\s\S]*?<\/button><\/>\}/)?.[0] ?? "";
  assert.match(foursquareProfileRootSource, /foursquare-profile-root[\s\S]*FoursquareAvatar identityId="session-owner"[\s\S]*identity\.name[\s\S]*foursquare-profile-leaderboard-row[\s\S]*SHOW_LEADERBOARD[\s\S]*>Leaderboard</, "F3d Profile must contain its frozen identity block and exactly one Leaderboard entry");
  assert.equal((foursquareProfileRootSource.match(/<button\b/g) ?? []).length, 1, "F3d Profile must retain exactly one interactive Leaderboard entry");
  assert.doesNotMatch(foursquareProfileRootSource, /pointEvents|checkIns|latestCheckinResult|getPlayerWeeklyPoints|getPlayerRank|buildLeaderboard/, "F3d Profile DOM must remain structurally independent of live game values before and after check-ins");
  assert.doesNotMatch(foursquareProfileRootSource, />\s*(?:Points|Score|Weekly(?: Points)?|This Week|Rank|Unranked|Badges|Mayorships|Check-ins|History)\s*</i, "F3d Profile must omit unsupported game statistics and history copy");
  assert.doesNotMatch(foursquareProfileRootSource, /badge|mayor/i, "F4 Profile must not expose badge or mayorship ownership while historical data is unknown");
  assert.doesNotMatch(foursquareVenueSummarySource, /mayor|crown|visit count|mayorship progress|No mayor yet/i, "F4 Venue must not expose legacy mayor identity, a zero-state claim, or progress");
  assert.doesNotMatch(foursquareResultSource, /badge|mayor|crown|Newbie/i, "F4 Result must render no badge or mayor surface for empty and null events");
  const foursquareLeaderboardSource = foursquareContainerSource.match(/function Leaderboard\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(foursquareLeaderboardSource, /entries\.map[\s\S]*#\{entry\.rank\}[\s\S]*FoursquareAvatar[\s\S]*person\.displayName[\s\S]*entry\.weeklyPoints/, "F3b rows must render rank, reused avatar, name, and numeric score from the game model output");
  assert.doesNotMatch(foursquareLeaderboardSource, /<button|onClick|This Week|>Weekly<|>pts<|>points<|highlight|disclosure|movement|medal/i, "F3b leaderboard rows must remain inert and omit unsupported week, suffix, highlight, and navigation treatments");
  assert.match(deviceCssSource, /\.foursquare-profile-leaderboard-row \{[^}]*height: 44px;[^}]*padding: 0 12px 0 15px;/, "F3b Profile entry must retain its conservative reconstructed list-row geometry");
  assert.match(deviceCssSource, /\.foursquare-leaderboard-row \{[^}]*height: 52px;[^}]*grid-template-columns: 32px 36px minmax\(0,1fr\) auto;/, "F3b standalone rows must retain the approved reconstructed geometry");
  assert.doesNotMatch(deviceCssSource, /foursquare-leaderboard-row[^}]*is-player|foursquare-leaderboard-row\.is-player/, "F3b must not add player-specific row material");
  assert.match(deviceCssSource, /\.foursquare-checkin-venue-context \{[^}]*min-height: 50px;[^}]*padding: 7px 12px;/, "F2c-1 venue context must retain its compact reconstructed geometry");
  assert.match(deviceCssSource, /\.foursquare-checkin-form textarea \{[^}]*min-height: 72px;[^}]*padding: 7px;/, "F2c-1 shout field must retain its reconstructed geometry");
  assert.match(deviceCssSource, /\.foursquare-checkin-button \{[^}]*height: 38px;[^}]*margin: 14px 13px 0;[^}]*linear-gradient/, "F2c-1 action must retain its 294x38 effective geometry and skeuomorphic material");
  assert.match(deviceCssSource, /\.foursquare-venue-summary-header \{[^}]*min-height: 62px;[^}]*grid-template-columns: 36px minmax\(0,1fr\);/, "F2b-1 venue identity must use its compact reconstructed header geometry");
  assert.match(foursquareVenueDetailSource, /state\.venueSubview === "info"[\s\S]*Category[\s\S]*venueViewModel\.categoryLabel/, "F2b-2 Info must render only the truthful adapter category");
  assert.match(foursquareVenueDetailSource, /state\.venueSubview === "tips"[\s\S]*tips\.map[\s\S]*tip\.authorDisplayName[\s\S]*tip\.text/, "F2b-2 Tips must render structured author identity and Tip text");
  assert.doesNotMatch(foursquareVenueDetailSource, /OPEN_TIP|CLOSE_TIP|foursquare-tip-row|Tip from|No tips/, "F2b-2 must remove the old inline Tip architecture and avoid invented empty-state copy");
  assert.match(deviceCssSource, /\.foursquare-venue-info > div \{[^}]*min-height: 48px;[^}]*grid-template-columns: 80px minmax\(0,1fr\);/, "F2b-2 Info must retain its reconstructed compact row geometry");
  assert.match(deviceCssSource, /\.foursquare-container \{[^}]*grid-template-rows: 44px minmax\(0,1fr\) 49px;/, "F1 must retain the reconstructed 44/content/49 shell geometry");
  assert.match(deviceCssSource, /\.foursquare-tab-bar \{[^}]*grid-template-columns: repeat\(5,64px\);/, "F1 tab bar must use five equal 64px cells");
  const flickrContent = await vite.ssrLoadModule("/src/data/flickrContent.ts");
  assert.equal(flickrContent.FLICKR_VERSION, "1.2");
  assert.equal(flickrContent.FLICKR_VERSION_CONFIDENCE, "EVIDENCE-BACKED BEST FIT");
  assert.equal((appSource.match(/useReducer\(flickrStateTransition,/g) ?? []).length, 1, "one App-owned Flickr reducer");
  assert.match(appSource, /request.requester === "flickr"\) dispatchFlickr\(\{ type: "MEDIA_RETURN"/, "shared media returns explicitly to Flickr");
  assert.match(appSource, /dispatchFlickr\(\{ type: "ADVANCE_UPLOAD", experienceSessionId: session.experienceSessionId, elapsedMs: elapsed/, "background upload uses shared clock/session");
  assert.match(appSource, /dispatchFlickr\(\{ type: "RESET"/, "Flickr remains in reset inventory");
  assert.match(deviceScreenSource, /flickrUploadCount=\{flickrState.upload \? 1 : 0\}/, "processing badge is independent of unread policy");
  assert.doesNotMatch(flickrContainerSource, /<StatusBar|<IOS4KeyboardSystem|navigator.geolocation|Notification Center|Camera Filters|Auto Upload|Community|Albums|Explore/, "no duplicated device systems or later Flickr surfaces");
  assert.doesNotMatch(flickrContainerSource, /fetch\(|XMLHttpRequest|localStorage|setInterval|setTimeout|Date.now/, "Flickr has no network, persistence or parallel clock");
  assert.match(flickrContainerSource, /<IOS4Textarea[\s\S]+keyboardInputId=\{`flickr-comment-[\s\S]+EDIT_COMMENT/, "Flickr comments must use the shared keyboard and existing event");
  assert.match(tumblrContainerSource, /<IOS4Textarea[\s\S]+keyboardInputId=\{`tumblr-reblog-[\s\S]+EDIT_REBLOG_TEXT/, "Tumblr optional reblog text must use the shared keyboard and existing event");
  const registeredEditableSources = `${facebookContainerSource}\n${mobileSmsContainerSource}\n${twitterContainerSource}\n${instagramContainerSource}\n${foursquareContainerSource}\n${flickrContainerSource}\n${tumblrContainerSource}`;
  assert.doesNotMatch(registeredEditableSources, /<textarea\b|contentEditable/, "every implemented runtime textarea/editable region must use a shared IOS4 wrapper");
  assert.equal((registeredEditableSources.match(/<input\b/g) ?? []).length, 1, "the only raw app input may remain the non-text Facebook Places checkbox");
  assert.match(facebookMicroChromeSource, /FACEBOOK_MICRO_GLYPHS[\s\S]+comment: commentGlyphSrc[\s\S]+like: likeGlyphSrc[\s\S]+"mobile-source": mobileSourceMarkSrc/, "comment, Like, and media-source marks must resolve through one shared Facebook micro-glyph registry");
  assert.match(facebookMicroChromeSource, /function FacebookStoryActionBubble[\s\S]+storyActionPlusSrc[\s\S]+function FacebookCameraArtwork[\s\S]+cameraGlyphSrc/, "story action and camera controls must render dedicated reconstructed artwork rather than text or modern icon libraries");
  assert.match(facebookMicroChromeSource, /function FacebookUnreadBadge[\s\S]+function FacebookNotificationActionBubble/, "launcher unread badges and transient notification action bubbles must remain distinct components");
  assert.match(facebookContainerSource, /<FacebookStoryActionBubble \/>/, "Feed and Profile Wall action disclosures must reuse the shared historical story bubble artwork");
  assert.equal((facebookContainerSource.match(/<FacebookStoryActionBubble \/>/g) ?? []).length, 2, "the shared story bubble artwork must be used exactly once on Feed and once on Profile Wall");
  assert.match(facebookStoryActionBubbleSource, /width="46" height="56" viewBox="0 0 23 28"/, "the story-action bubble must retain its reference-matched @2x-equivalent 23x28 geometry");
  assert.match(facebookStoryActionBubbleSource, /l-2\.8 5\.8-2\.8-5\.8/, "the story-action bubble must retain a centered compact downward tail");
  assert.match(facebookStoryActionBubbleSource, /stroke="#fff" stroke-width="1\.6" stroke-linejoin="round"/, "the story-action bubble halo must follow body and tail without oversized glow");
  assert.match(facebookStoryActionBubbleSource, /#82a7dd[^\n]+#5b87c4[^\n]+#3e6ca9/, "the story-action bubble must retain its brighter reference-matched interior blue treatment");
  assert.match(facebookStoryActionBubbleSource, /M11\.5 7v9\.4M6\.8 11\.7h9\.4/, "the story-action plus must retain its reduced measured centerline proportions");
  assert.match(facebookStoryActionBubbleSource, /stroke="#fff" stroke-width="2\.6"/, "the story-action plus must retain its measured thick white strokes");
  assert.doesNotMatch(facebookStoryActionBubbleSource, /(?:href|xlink:href)="(?:data:image|https?:\/\/)/, "the reconstructed story-action asset must not embed screenshot pixels or external artwork");
  assert.match(facebookContainerSource, /<FacebookCameraArtwork \/>/, "the Feed composer must use the dedicated historical camera artwork");
  assert.match(facebookCameraArtworkSource, /width="58" height="58" viewBox="0 0 29 29"/, "the camera artwork must retain a @2x source for its measured 29-pixel composer box");
  assert.match(facebookCommentGlyphSource, /width="18" height="16" viewBox="0 0 9 8"/, "the shared comment mark must retain its reduced compact bounds");
  assert.match(facebookLikeGlyphSource, /width="18" height="18" viewBox="0 0 9 9"/, "the shared Like mark must retain its reduced compact bounds");
  assert.match(facebookMicroChromeSource, /name === "mobile-source"[\s\S]+<span[\s\S]+WebkitMaskImage:[\s\S]+maskImage:/, "comment and Like artwork must inherit the shared micro-glyph color while the multi-tone source mark remains an image");
  assert.match(facebookGridLauncherSource, /width="46" height="46" viewBox="0 0 23 23"/, "the Feed launcher grid must retain an explicit @2x-equivalent 23-pixel glyph source");
  assert.equal((facebookGridLauncherSource.match(/<rect /g) ?? []).length, 9, "the Feed launcher control must contain the historical three-by-three grid glyph");
  const facebookCommentsOriginalStorySource = facebookContainerSource.match(/function FacebookCommentsOriginalStory[\s\S]*?function FacebookCommentsRow/)?.[0] ?? "";
  const facebookCommentsDetailSource = facebookContainerSource.match(/\{state\.currentView === "commentsDetail"[\s\S]*?\{state\.currentView === "profile"/)?.[0] ?? "";
  const facebookStoryViewSource = facebookContainerSource.match(/function FacebookStoryView[\s\S]*?function FacebookStoryMedia/)?.[0] ?? "";
  assert.match(facebookStoryTimeSource, /export function formatFacebookDetailTimestamp[\s\S]+storyYear !== "2010"[\s\S]+formatToParts[\s\S]+`\$\{part\("month"\)\} \$\{part\("day"\)\} \$\{part\("hour"\)\}:\$\{part\("minute"\)\} \$\{part\("dayPeriod"\)\}`/, "Facebook Detail must centralize the locked 2010 month/day/time rule with an older-year fallback");
  assert.match(facebookStoryTimeSource, /const FACEBOOK_TIME_ZONE = "America\/Los_Angeles";/, "Facebook Detail timestamps must remain locked to canonical Pacific time");
  assert.match(facebookContainerSource, /function FacebookDetailTimestampRow[\s\S]+facebook-detail-timestamp-row"><FacebookMicroGlyph name="mobile-source" \/><span>\{formatFacebookStoryTime/, "the shared Facebook Detail timestamp row must place the reconstructed handset mark before its text");
  assert.equal((facebookContainerSource.match(/<FacebookDetailTimestampRow /g) ?? []).length, 3, "Post Detail, Comments Detail, and Photo Detail must share the icon-first timestamp row");
  assert.doesNotMatch(facebookCommentsOriginalStorySource, /showMobileSource|hasExplicitFacebookMobileSource|item\.kind === "photo" \|\| item\.kind === "album"/, "Comments must apply the locked detail convention without actor, source, or story-kind branches");
  assert.match(deviceCssSource, /\.facebook-detail-timestamp-row \{ display: inline-flex; align-items: center; gap: 3px; \}/, "Facebook Detail timestamp rows must keep the mark and text in one compact aligned flow");
  assert.match(facebookStoryViewSource, /<time className="facebook-story-timestamp-row">\{\(item\.kind === "photo" \|\| item\.kind === "album"\) && <FacebookMicroGlyph name="mobile-source" \/>\}<span>\{storyTime\}<\/span><\/time>/, "the shared Feed/Wall story renderer must place the mobile mark before compact timestamp text in DOM order");
  assert.doesNotMatch(facebookStoryViewSource, /<span>\{storyTime\}<\/span>[\s\S]{0,160}<FacebookMicroGlyph name="mobile-source"/, "no Feed/Wall timestamp renderer may retain timestamp-then-mark ordering");
  assert.match(deviceCssSource, /\.facebook-story-timestamp-row \{ gap: 3px; \}[\s\S]+\.facebook-story-timestamp-row \.facebook-micro-glyph\.is-mobile-source \{ margin-left: 0; \}/, "Feed and Wall must share one compact mark/text gap without trailing-mark margin");
  assert.doesNotMatch(deviceCssSource, /facebook-(?:story|detail)-timestamp-row[^}]*flex-direction:\s*row-reverse|facebook-(?:story|detail)-timestamp-row[^}]*order:/, "timestamp ordering must come from JSX rather than CSS reordering hacks");
  assert.match(deviceCssSource, /--facebook-avatar-radius: 2px;/, "shared small Facebook avatars must retain the conservative reconstructed two-pixel radius");
  assert.match(deviceCssSource, /--facebook-engagement-height: 22px;[^}]*--facebook-engagement-notch-size: 5px;[^}]*--facebook-engagement-group-gap: 8px;/, "Feed and Wall engagement rhythm must derive from explicit reference measurements");
  assert.match(deviceCssSource, /\.facebook-story-counts\.is-feed,\.facebook-story-counts\.is-wall \{[^}]*height: var\(--facebook-engagement-height\);[^}]*display: inline-grid;[^}]*background: #e7edf5;[^}]*font-size: 11px;/, "Feed and Wall engagement summaries must share the fixed historical panel grammar");
  assert.match(deviceCssSource, /\.facebook-story-counts\.is-feed::before,\.facebook-story-counts\.is-wall::before \{[^}]*top: -3px;[^}]*width: var\(--facebook-engagement-notch-size\);[^}]*transform: rotate\(45deg\);/, "shared engagement summaries must retain their measured compact top pointer");
  assert.match(deviceCssSource, /\.facebook-unread-badge \{[^}]*min-width: 23px; height: 23px; padding: 2px;[^}]*background: #fff;[^}]*box-shadow: 0 0 0 1px/, "launcher unread badges must retain distinct white-halo and dark-rim layers");
  assert.match(facebookNotificationActionBubbleSource, /width="46" height="48" viewBox="0 0 23 24"/, "the transient notification action bubble must retain its measured @2x source bounds");
  assert.match(facebookNotificationActionBubbleSource, /l-3\.7 3\.2\.35-3\.2/, "the transient notification action bubble must retain an integrated speech tail");
  assert.match(facebookNotificationActionBubbleSource, /stroke="#fff" stroke-width="1\.8" stroke-linejoin="round"/, "the transient notification action bubble white rim must follow body and tail as one silhouette");
  assert.doesNotMatch(deviceCssSource, /\.facebook-unread-badge(?:::before|::after)/, "launcher unread badges must never acquire a speech tail");
  assert.match(facebookMicroChromeSource, /function Facebook2010BackButton[\s\S]+bodyWidth = Math\.max\(39, Math\.ceil\(label\.length \* 6\.2\) \+ 14\)[\s\S]+shapePath = `M10 1\.2H\$\{rightShoulder\}Q\$\{rightEdge\} 1\.2 \$\{rightEdge\} 5V25Q\$\{rightEdge\} 28\.8 \$\{rightShoulder\} 28\.8H10L1 15Z`/, "directional Back controls must use one dynamic-width continuous SVG silhouette with a fixed ten-pixel arrow shoulder");
  assert.match(facebookMicroChromeSource, /linearGradient id="facebook-2010-back-gradient"[\s\S]+#7d92b9[\s\S]+#657daa[\s\S]+#4c699d[\s\S]+#365584[\s\S]+#294674/, "the directional silhouette must use one continuous period blue vertical gradient");
  assert.match(facebookMicroChromeSource, /stroke="#1c3764" strokeWidth="1\.2" strokeLinejoin="round"[\s\S]+stroke="#fff" strokeWidth="\.7"/, "the directional silhouette must retain one dark outline and a restrained inset highlight");
  assert.match(facebookContainerSource, /<Facebook2010BackButton label=\{directionalBackLabel\} onClick=\{\(\) => dispatch\(\{ type: "GO_BACK" \}\)\} \/>/, "all directional Facebook back controls must share one SVG component without changing GO_BACK behavior");
  assert.match(facebookContainerSource, /state\.currentView === "feed" \|\| state\.currentView === "friends"[\s\S]+facebook-grid-launcher-control facebook-2010-nav-button is-grid is-left[\s\S]+aria-label="Facebook Home"[\s\S]+GO_BACK/, "Feed and Friends must reuse the measured grid launcher presentation without changing the Home route");
  assert.match(facebookContainerSource, /commentsSourceLabel = selectedItem\?\.author\.trim\(\)\.split\(\/\\s\+\/\)\[0\] \|\| "Back"/, "Comments must derive its compact source label from the safely selected story actor with Back fallback");
  assert.match(facebookContainerSource, /previousView = state\.navigationStack\[state\.navigationStack\.length - 2\] \?\? null[\s\S]+state\.currentView === "commentsDetail"[\s\S]+commentsSourceLabel[\s\S]+state\.currentView === "messageDetail"[\s\S]+previousView === "inbox" \? "Messages" : nested \? "Back" : "Home"[\s\S]+state\.currentView === "chatConversation"[\s\S]+"Chat"/, "Comments, Messages, and Chat must provide route-context-safe labels to the shared directional silhouette");
  assert.match(facebookContainerSource, /facebook-navigation-context facebook-2010-nav-button is-normal is-right is-static is-feed-context">News Feed</, "the Feed context control must use the reference label inside the shared right navigation-button family");
  assert.doesNotMatch(facebookContainerSource, /is-feed-context">Live Feed</, "the superseded Feed header label must not return");
  assert.match(deviceCssSource, /\.facebook-navigation-bar \.facebook-2010-nav-button \{[^}]*height: 30px;[^}]*border: 1px solid #1c3764;[^}]*linear-gradient\(#7d92b9/, "shared Facebook navigation controls must retain one measured beveled surface");
  assert.match(deviceCssSource, /\.facebook-navigation-bar \.facebook-2010-nav-button\.is-grid \{[^}]*left: 5px;[^}]*width: 39px; height: 32px;/, "the Feed grid launcher control must retain the measured reference bounds");
  assert.match(deviceCssSource, /\.facebook-navigation-bar > \.facebook-directional-back-control \{[^}]*left: 5px; top: 7px; height: 30px;[^}]*border: 0;[^}]*background: transparent;[^}]*box-shadow: none;/, "the directional button host must expose only the continuous SVG silhouette without a second rectangle");
  assert.match(deviceCssSource, /\.facebook-directional-back-label \{[^}]*left: 10px; right: 1px;[^}]*place-items: center;[^}]*white-space: nowrap;/, "directional labels must center inside the body beginning at the fixed arrow shoulder");
  assert.doesNotMatch(deviceCssSource, /\.facebook-(?:directional-back|back-control|comments-back)[^{]*::before/, "directional Back controls must not reconstruct arrowheads with pseudo-elements");
  assert.doesNotMatch(deviceCssSource, /\.facebook-navigation-bar \.facebook-2010-nav-button\.is-(?:back|comments-back)/, "superseded rectangle-plus-diamond directional variants must remain removed");
  assert.match(deviceCssSource, /\.facebook-navigation-bar \.facebook-2010-nav-button\.is-feed-context \{[^}]*right: 5px; width: 84px; min-width: 84px; height: 30px;/, "the News Feed context button must retain the measured reference bounds");
  assert.match(deviceCssSource, /\.facebook-feed-composer-strip \{ gap: 4px; padding: 4px 5px 4px 6px; \}/, "the Feed camera and status field must retain the measured composer spacing");
  assert.match(deviceCssSource, /\.facebook-feed-status-control \{ height: 28px;[^}]*font-size: 12px;/, "the Feed status field must retain the measured height and placeholder scale");
  assert.equal((deviceCssSource.match(/\.facebook-feed\s*\{[^}]*overflow-y:\s*auto/g) ?? []).length, 1, "News Feed must have exactly one authoritative vertical scroll container");
  assert.equal((deviceCssSource.match(/\.facebook-profile-wall\s*\{[^}]*overflow-y:\s*auto/g) ?? []).length, 1, "Profile Wall must have exactly one authoritative vertical scroll container");
  assert.match(deviceCssSource, /\.facebook-profile-wall\s*\{[^}]*overscroll-behavior-y:\s*contain;[^}]*touch-action:\s*pan-y;/, "Profile Wall scrolling must remain inside the device viewport");
  assert.match(facebookContainerSource, /key=\{item\.id\}[\s\S]*surface="wall"/, "Profile Wall stories must retain stable canonical story IDs as React keys");
  assert.match(facebookContainerSource, /state\.profileWallScrollPositions\[profileName\] \?\? 0/, "Profile Wall restoration must use the selected profile's isolated scroll state");
  assert.match(deviceCssSource, /\.facebook-feed\s*\{[^}]*overscroll-behavior-y:\s*contain;[^}]*overflow-anchor:\s*none;[^}]*touch-action:\s*pan-y;/, "News Feed scrolling must remain inside the device viewport and use explicit story anchoring");
  assert.match(facebookContainerSource, /key=\{item\.id\}/, "Feed stories must retain stable canonical story IDs as React keys");
  assert.match(facebookContainerSource, /data-facebook-feed-story-id=\{surface === "feed" \? item\.id : undefined\}/, "Feed rows must expose canonical IDs for viewport anchoring");
  assert.match(facebookContainerSource, /captureFacebookFeedAnchor/, "News Feed must preserve a visible story anchor across rerenders and live insertion");
  assert.match(deviceScreenSource, /session\.phase === "app" && <AppLaunchContainer/, "an app viewport must render only while the device phase is app");
  assert.match(deviceScreenSource, /session\.phase === "sleeping" && <div className="screen-off-surface"/, "sleeping must render the dedicated display-off surface");
  assert.match(deviceScreenSource, /session\.phase === "locked" && <LockScreen/, "locked must render Lock Screen");
  assert.match(deviceCssSource, /\.screen-off-surface\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*100;[^}]*inset:\s*0;[^}]*background:\s*#000;/, "display-off surface must be an opaque full-screen top layer");
  assert.match(deviceCssSource, /\.device \{[^}]*--iphone4-screen-left: 30px;[^}]*--iphone4-screen-top: 133px;[^}]*--iphone4-screen-width: 320px;[^}]*--iphone4-screen-height: 480px;[^}]*width: 380px;[^}]*height: 747px;/, "the physical shell must own one fixed iPhone 4 body and 2:3 screen geometry");
  assert.match(deviceCssSource, /\.device \{[^}]*width: 380px; height: 747px;[^}]*border-radius: 55px;[^}]*isolation: isolate;/, "frozen iPhone 4 shell v1.0 must retain its outer dimensions, corner geometry and stacking context");
  assert.match(deviceCssSource, /\.device-front-glass \{[^}]*z-index: 1; inset: 3px; border-radius: 52px;[^}]*pointer-events: none;/, "frozen iPhone 4 shell v1.0 must retain its black-glass and steel-perimeter relationship");
  assert.match(deviceCssSource, /\.speaker \{[^}]*z-index: 4; width: 58px; height: 7px; top: 74px; left: 161px; border-radius: 8px;/, "frozen iPhone 4 shell v1.0 must retain its earpiece geometry");
  assert.match(deviceCssSource, /\.camera \{[^}]*z-index: 4; width: 10px; height: 10px; top: 72px; left: 124px; border-radius: 50%;/, "frozen iPhone 4 shell v1.0 must retain its front-camera geometry");
  assert.match(deviceCssSource, /\.home \{[^}]*z-index: 4; left: 158px; bottom: 26px; width: 64px; height: 64px;[^}]*border-radius: 50%;/, "frozen iPhone 4 shell v1.0 must retain its Home-button geometry");
  assert.match(deviceCssSource, /\.device-mute-switch,\.device-volume-button \{[^}]*z-index: 0; left: -6px;[^}]*width: 6px;/, "frozen iPhone 4 shell v1.0 must retain its left-control projection and stacking");
  assert.match(deviceCssSource, /\.device-mute-switch \{ top: 94px; height: 20px;[^}]*border-radius: 3px 0 0 3px;/, "frozen iPhone 4 shell v1.0 must retain Ring\/Silent geometry at top 94px");
  assert.match(deviceCssSource, /\.device-volume-button \{ height: 30px; overflow: hidden; \}[\s\S]+\.device-volume-button::before \{[^}]*width: 30px; height: 30px;[^}]*border-radius: 50%;[\s\S]+\.device-volume-button\.is-up \{ top: 136px; \}[\s\S]+\.device-volume-button\.is-down \{ top: 202px; \}/, "frozen iPhone 4 shell v1.0 must retain circular volume controls at top 136px and 202px");
  assert.match(deviceCssSource, /\.power \{[^}]*z-index: 0; width: 68px; height: 9px; right: 56px; top: -7px;[^}]*background: transparent;[\s\S]+\.power::before \{[^}]*clip-path: inset\(0 0 2px 0\);[^}]*border-radius: 5px 5px 1px 1px;/, "frozen iPhone 4 shell v1.0 must retain Sleep\/Wake geometry and frame occlusion");
  assert.doesNotMatch(deviceCssSource, /(?:\.device\.[\w-]+|\.screen\.[\w-]+)\s+\.(?:power|home|speaker|camera|device-mute-switch|device-volume-button)/, "frozen iPhone 4 hardware geometry must not depend on Lock Screen, SpringBoard, app or display state");
  assert.match(deviceCssSource, /\.screen \{[^}]*left: var\(--iphone4-screen-left\);[^}]*top: var\(--iphone4-screen-top\);[^}]*width: var\(--iphone4-screen-width\);[^}]*height: var\(--iphone4-screen-height\);/, "every device state must render through the single canonical screen rectangle");
  assert.doesNotMatch(deviceCssSource, /\.screen\.(?:booting|locked|springboard|app|sleeping|poweredOff|shutdown|lowBatteryWarning|powerOffConfirm)[^{]*\{[^}]*(?:width|height):/, "no device phase may override the canonical screen dimensions");
  assert.match(appSource, /const displayIsLit = session\.phase !== "sleeping" && session\.phase !== "poweredOff" && session\.phase !== "shutdown";[\s\S]+className=\{`device\$\{displayIsLit \? " is-display-lit" : ""\}`\}/, "screen light spill must derive from the existing display session phase without new power state");
  assert.match(deviceCssSource, /\.device-screen-glow \{[^}]*opacity: 0;[^}]*pointer-events: none;[^}]*\}[\s\S]+\.device\.is-display-lit \.device-screen-glow \{ opacity: 1; \}/, "the dedicated screen glow must remain non-interactive and disappear for sleeping or powered-off states");
  assert.match(lockScreenSource, /data-geometry-status="VISUAL-CROSSCHECK" data-material-status="RECONSTRUCTED"/, "the SMS alert must keep its visual geometry and reconstructed material confidence explicit");
  assert.match(deviceCssSource, /\.lockscreen::before \{[^}]*background: rgba\(0,0,0,\.08\);[^}]*pointer-events: none;/, "Lock Screen wallpaper dimming must remain a simple non-interactive tonal overlay");
  assert.doesNotMatch(deviceCssSource, /\.lockscreen(?:::before)?[^}]*(?:backdrop-filter|filter:\s*blur)/, "Lock Screen wallpaper must not acquire modern blur material");
  assert.match(deviceCssSource, /\.unlock-track-raster \{[^}]*WellLock@2x\.png[^}]*\}[\s\S]+\.unlock-track button \{[^}]*width: 71px; height: 47px;[^}]*bottombarknobgray@2x\.png/, "the slider must retain the recovered iOS 4.1 track and knob artwork at native logical geometry");
  assert.match(lockScreenSource, /data-slider-arrow-source="embedded-in-knob-asset"[\s\S]+onPointerDown=\{beginDrag\}[\s\S]+onPointerMove=\{drag\}[\s\S]+onPointerUp=\{finishDrag\}/, "the period arrow raster and existing slider interaction handlers must remain intact");
  assert.match(appSource, /className="device-mute-switch"[\s\S]+className="device-volume-button is-up"[\s\S]+className="device-volume-button is-down"/, "the GSM shell must expose one visual Ring/Silent switch and two separate volume controls");
  assert.equal((appSource.match(/className="device-antenna-seam is-/g) ?? []).length, 3, "the front-facing GSM shell must retain only its three subtle visible seam projections");
  assert.match(appSource, /className="power"[^>]+onPointerDown=\{beginPower\}[^>]+onPointerUp=\{endPower\}/, "the refined Power control must retain its existing runtime handlers");
  assert.match(appSource, /className=\{`home\$\{homePressed \? " is-pressed" : ""\}`\}[\s\S]+onPointerDown=\{beginHomePress\}[\s\S]+onPointerUp=\{endHomePress\}/, "the refined Home control must retain its existing runtime handlers");
  const timelineCellSource = twitterContainerSource.match(/function TimelineTweet[\s\S]*?function TweetDetail/)?.[0] ?? "";
  const tweetDetailSource = twitterContainerSource.match(/function TweetDetail[\s\S]*?function TwitterComposer/)?.[0] ?? "";
  const twitterMentionsSource = twitterContainerSource.match(/function TwitterMentions[\s\S]*?function TwitterMessages/)?.[0] ?? "";
  const twitterMessagesSource = twitterContainerSource.match(/function TwitterMessages[\s\S]*?function TwitterDMThread/)?.[0] ?? "";
  const twitterDMThreadSource = twitterContainerSource.match(/function TwitterDMThread[\s\S]*?function TwitterPeopleList/)?.[0] ?? "";
  const facebookProfileSource = facebookContainerSource.match(/function FacebookProfile[\s\S]*?function FacebookCommentRow/)?.[0] ?? "";
  const facebookProfileIdentitySource = facebookProfileSource.match(/<header className="facebook-profile-header"[\s\S]*?<\/header>/)?.[0] ?? "";
  assert.doesNotMatch(seedSource, /DeviceAudio|deviceEventScheduler|smsNotification/, "seed definitions must not depend on delivery systems");
  assert.doesNotMatch(`${seedSource}\n${coreSocialSource}\n${instagramStateSource}`, /juneph[o]to/, "runtime/data must contain no superseded June Instagram handle");
  assert.doesNotMatch(instagramStateSource, /Math\.random|followerDrift|liveFollowerDrift/, "ordinary fictional June must not receive render-time randomization or celebrity follower drift");
  assert.match(instagramContainerSource, /viewTitle\(state\.currentView, selectedKnownAccount\?\.username/, "June's username must supply the other-user profile navigation title");
  assert.match(instagramContainerSource, /viewTitle\(state\.currentView, selectedKnownAccount\?\.username, state\.knownConnectionsKind, accountTabLabel\)/, "the player Profile navigation title must receive the existing account-derived label");
  assert.match(instagramContainerSource, /case "profile": return accountTitle;/, "the player Profile must show the existing account-derived handle instead of a generic Profile title");
  assert.match(instagramContainerSource, /state\.currentView === "news" && <section className="instagram-period-empty-root" data-content-status="RECONSTRUCTED" data-exact-ui-status="HOLD"><p>No new activity\.<\/p><\/section>/, "News must remain the approved single-line reconstructed empty state");
  assert.match(instagramContainerSource, /instagram-profile-photo-stream/, "Instagram 1.0 profiles must use a vertical photo stream");
  assert.doesNotMatch(instagramContainerSource, /instagram-known-photo-grid|profile-bio|Story Highlights|Reels/, "June profile must not contain post-2010 grid, bio, Story, or Reels UI");
  assert.match(instagramContainerSource, /getSharedCharacterMedia\("june-profile-avatar"\)/, "June's profile and stream avatar must resolve through shared media");
  assert.match(instagramChromeSource, /<span className="instagram-tab-label">Popular<\/span>/, "Popular must be a functional root tab");
  assert.match(instagramChromeSource, /<span className="instagram-tab-label">Share<\/span>/, "the center Instagram tab must use Share semantics");
  assert.match(instagramContainerSource, /instagramAccountTabLabel\(identity\.name\)/, "the rightmost tab must derive current-account identity");
  assert.match(instagramChromeSource, /feedIconSelectedSrc[\s\S]+popularIconSelectedSrc[\s\S]+newsIconSelectedSrc[\s\S]+profileIconSelectedSrc/, "ordinary Instagram tabs must import explicit selected-state artwork");
  assert.match(instagramChromeSource, /function InstagramTabArtwork[\s\S]+className="is-unselected"[\s\S]+className="is-selected"/, "ordinary Instagram tabs must render explicit selected and unselected artwork paths");
  assert.doesNotMatch(deviceCssSource, /(?:-webkit-)?mask:\s*var\(--instagram-tab-icon\)/, "Instagram tab states must not be generated by recoloring one generic mask");
  assert.match(instagramSelectedFeedSource, /RECONSTRUCTED_FROM_PERIOD_SCREENSHOT/, "selected Instagram tab artwork must retain reconstructed provenance");
  assert.equal([...instagramSelectedFeedSource.matchAll(/<circle\b/g)].length, 3, "the screenshot-derived Feed icon must retain its three-person group silhouette");
  assert.match(instagramNewsIconSource, /RECONSTRUCTED_FROM_PERIOD_SCREENSHOT[\s\S]+M6 1\.5h16\.5[\s\S]+M3 5\.5h16\.5/, "the screenshot-derived News icon must use two overlapping card surfaces");
  assert.match(instagramShareIconSource, /RECONSTRUCTED_FROM_PERIOD_SCREENSHOT[\s\S]+width="28" height="22"[\s\S]+<circle cx="14" cy="13\.5" r="4"/, "the raised Share control must retain its flat 28-by-22 camera and restrained 8pt circular lens");
  assert.ok(instagramTabIconSources.every(source => /<svg[^>]+stroke="none"/.test(source)), "every Instagram tab icon family and state must explicitly default to no stroke");
  assert.doesNotMatch(instagramTabIconSources.join("\n"), /\bstroke=(?!"none")|<filter\b|(?:linear|radial)Gradient|drop-shadow/, "Instagram tab icons must not regain unsupported outlines, filters, gradients, or drop shadows");
  assert.match(instagramSelectedNewsSource, /selected tonal state remains HOLD/, "unsupported selected News micro-artwork must remain explicitly HOLD");
  assert.match(instagramSelectedProfileSource, /selected tonal state remains HOLD/, "unsupported selected Profile micro-artwork must remain explicitly HOLD");
  assert.match(instagramWordmarkSource, /RECONSTRUCTED_FROM_PERIOD_SCREENSHOT/, "the deterministic Instagram wordmark must retain reconstructed provenance");
  assert.match(instagramWordmarkSource, /width="122" height="29" viewBox="0 0 122 29"[\s\S]+data-provenance="RECONSTRUCTED_FROM_PERIOD_SCREENSHOT"[\s\S]+stroke="none"/, "the Instagram wordmark must retain its audited 122-by-29 screenshot-trace canvas and provenance");
  assert.equal([...instagramWordmarkSource.matchAll(/<path\b/g)].length, 1, "the Instagram wordmark must use exactly one filled silhouette");
  assert.match(instagramWordmarkSource, /<path d="[^"]+Z" fill="#f4f1e8" fill-rule="evenodd"\/>/, "the Instagram wordmark must retain its single warm-white screenshot-traced silhouette");
  assert.doesNotMatch(instagramWordmarkSource, /#29495f|<text\b|font-family=|stroke-width=|stroke-linecap=|stroke-linejoin=|<filter\b|\bfilter=|drop-shadow|text-shadow|opacity=/, "the Instagram wordmark must remain fill-only without dark depth, fonts, outlines, shadows, opacity treatments, or filters");
  assert.match(instagramClockSource, /RECONSTRUCTED_FROM_PERIOD_SCREENSHOT[\s\S]+<circle[\s\S]+<path/, "the Feed timestamp clock must use explicit reconstructed face and hand artwork");
  assert.match(instagramContainerSource, /instagramClockSrc[\s\S]+<time><img src=\{instagramClockSrc\}/, "Feed timestamps must render the reconstructed clock asset");
  assert.match(deviceCssSource, /\.instagram-navigation-bar button\.instagram-navigation-cancel \{ width: 52px; min-width: 52px;/, "Instagram Back controls must retain the audited fixed 52pt frame");
  assert.match(instagramBackButtonSource, /RECONSTRUCTED_FROM_PERIOD_SCREENSHOT[\s\S]+<path d="M13 1h34\.3[\s\S]+L1 15\.5 13 1Z"/, "Instagram Back must use one continuous reconstructed pentagonal path");
  assert.match(deviceCssSource, /\.instagram-navigation-bar button\.instagram-navigation-cancel \{[^}]*border-radius: 0;[^}]*instagram-back-button-2010-reconstructed\.svg/, "every shared Instagram Back surface must use the continuous artwork instead of a rounded rectangle");
  assert.match(deviceCssSource, /\.instagram-navigation-bar button\.instagram-navigation-next:not\(\.instagram-profile-relationship-control\) \{ width: 42px; min-width: 42px;/, "Instagram Next and Post controls must retain the audited fixed 42pt frame without changing HOLD Profile relationship geometry");
  assert.match(deviceCssSource, /\.instagram-wordmark \{ width: 122px; height: 29px;[^}]*transform: translateX\(-1\.5px\);/, "the deterministic Instagram wordmark must render at the audited 122-by-29 bounds with the native-reference optical bias");
  assert.match(deviceCssSource, /\.instagram-development-navigation \{[^}]*flex: 0 0 48px;[^}]*grid-template-columns: repeat\(5,64px\)/, "Instagram artwork reconstruction must preserve the locked 48pt five-by-64pt tab geometry");
  assert.match(deviceCssSource, /\.instagram-development-navigation button \{[^}]*height: 48px; padding: 0; display: block;[^}]*font-size: 9px; font-weight: normal; line-height: 11px;/, "Instagram tabs must use the measured 9px period label face without selected-state weight inflation");
  assert.match(deviceCssSource, /\.instagram-tab-icon \{[^}]*left: 18px; top: 4px; width: 28px; height: 24px;/, "ordinary Instagram icon canvases must occupy one explicit optical row");
  assert.match(deviceCssSource, /\.instagram-tab-label \{[^}]*left: 2px; top: 34px; width: 60px; height: 11px;[^}]*font-size: 9px; font-weight: normal; line-height: 11px;/, "all five Instagram labels must share one explicit 9px baseline row");
  assert.doesNotMatch(deviceCssSource, /\.instagram-development-navigation button\[aria-current="page"\][^{]*\{[^}]*font-weight:\s*bold/, "selected Instagram labels must not become optically larger through bold weight");
  assert.match(deviceCssSource, /\.instagram-navigation-bar \{[^}]*flex: 0 0 44px; height: 44px;/, "Instagram material reconstruction must preserve the locked 44pt navigation geometry");
  assert.match(deviceCssSource, /\.instagram-share-housing \{[^}]*top: -7px; width: 64px; height: 55px;[^}]*instagram-share-housing-2010-reconstructed\.svg[^}]*64px 55px no-repeat;/, "the raised Share control must use the measured continuous 64-by-55 molded-tab silhouette");
  assert.doesNotMatch(deviceCssSource, /\.instagram-share-housing(?:::before|::after)? \{[^}]*(?:border-radius|box-shadow|linear-gradient)/, "the Share housing must not regress to generic rounded-card or autonomous bevel construction");
  assert.match(instagramShareHousingSource, /RECONSTRUCTED_FROM_PERIOD_SCREENSHOT[\s\S]+width="64" height="55"[\s\S]+M0 7C6 4 18 0 32 0s26 4 32 7v48H0V7Z/, "the Share housing SVG must retain the normalized dome and vertical side-wall silhouette");
  assert.match(instagramShareHousingSource, /<rect x="1" y="28" width="62" height="1"[\s\S]+<rect x="1" y="29" width="62" height="26"/, "the Share housing must retain its measured filled divider and continuous lower field");
  assert.match(instagramShareHousingSource, /<linearGradient id="housing-outer"[\s\S]+<linearGradient id="housing-rim"[\s\S]+<linearGradient id="housing-upper-shell"[\s\S]+<linearGradient id="housing-upper-field"[\s\S]+<linearGradient id="housing-lower-field"/, "the Share housing must preserve its reconstructed smoked-plastic material layers");
  assert.doesNotMatch(instagramShareHousingSource, /\bstroke=(?!"none")|<filter\b|<radialGradient\b|\bfilter=|\b(?:blur|drop-shadow|backdrop-filter)\b/i, "the Share housing must remain fill-only without outlines, filters, blur, or shadows");
  assert.match(deviceCssSource, /\.instagram-share-housing \.instagram-tab-icon \{[^}]*left: 18px; top: 10px; width: 28px; height: 22px;/, "the Share camera must preserve its tab-global position inside the taller housing");
  assert.doesNotMatch(deviceCssSource, /\.instagram-share-tab \.instagram-tab-label/, "Share must not retain an independent label baseline rule");
  assert.doesNotMatch(`${instagramChromeSource}\n${instagramContainerSource}`, /shareDisabled|className="instagram-share-tab" disabled=/, "player post count must never disable the Instagram Share tab");
  assert.doesNotMatch(deviceCssSource, /instagram-share-tab:disabled/, "Share must not acquire a post-count disabled opacity treatment");
  assert.doesNotMatch(instagramStateSource, /state\.photos\.length\s*[>=]|instagram-first-photo/, "Instagram Share and Post must not retain the one-post guards or fixed first-photo ID");
  assert.match(instagramStateSource, /function nextInstagramPhotoId[\s\S]+instagram-user-photo-[\s\S]+photos: \[\.\.\.state\.photos, \{[\s\S]+selectedPhotoId: photoId/, "player Instagram posts must append with deterministic unique session-local IDs");
  assert.match(instagramContainerSource, /<InstagramProfileStats photos=\{state\.photos\.length\}/, "Player Profile Photos count must continue deriving from the complete post array");
  assert.match(deviceCssSource, /\.instagram-period-empty-root \{[^}]*flex: 0 0 368px;[^}]*width: 320px;[^}]*height: 368px;[^}]*background: #e7e7e7;[^}]*font: 12px\/16px/, "News must fill the approved 320-by-368 content region with the shared neutral background and period-scale type");
  assert.match(deviceCssSource, /\.instagram-period-empty-root > p \{ margin: 0; \}/, "News empty copy must remain optically centered without browser paragraph margins");
  assert.match(deviceCssSource, /\.instagram-profile-summary \{ height: 96px; min-height: 96px; padding: 10px;[^}]*grid-template-columns: 74px 215px; gap: 11px;[^}]*background-color: #303335;[^}]*background-size: 2px 2px;/, "Profile must use the direct-raster 96pt summary and restrained deterministic graphite micro-pattern");
  assert.match(deviceCssSource, /\.instagram-profile-avatar,\.instagram-profile-avatar-placeholder \{ width: 74px; height: 74px;[^}]*border: 1px solid #c4c4c4;/, "player and known-account Profile avatars must retain 74pt geometry with the measured narrow pale boundary");
  assert.match(deviceCssSource, /\.instagram-profile-summary-content \{[^}]*grid-template-rows: 24px 48px;[^}]*gap: 4px;[\s\S]+\.instagram-profile-summary-content > strong \{[^}]*font-size: 20px;[^}]*line-height: 24px;/, "Profile display names must use the screenshot-measured position and 20px by 24px typography");
  assert.match(deviceCssSource, /\.instagram-profile-stats \{ width: 215px; height: 48px;[^}]*grid-template-columns: repeat\(3,67px\); gap: 7px;/, "Profile statistics must occupy three 67pt blocks at the measured 7pt pitch gaps");
  assert.match(deviceCssSource, /\.instagram-profile-stats > div \{[^}]*height: 48px;[^}]*grid-template-rows: 30px 16px;[^}]*border: 1px solid #183a58;[^}]*background: #386b98;[\s\S]+font-size: 24px;[^}]*line-height: 27px;[\s\S]+background: #214d76;[^}]*font-size: 11px;[^}]*line-height: 14px;/, "Profile statistics must retain the reconstructed two-field material and measured number/label typography");
  assert.match(deviceCssSource, /\.instagram-profile-photo-stream article > header \{ height: 42px;[^}]*grid-template-columns: 27px 1fr auto;[\s\S]+header strong \{[^}]*font-size: 14px; line-height: 16px;[\s\S]+header time \{[^}]*font-size: 14px; line-height: 16px;[\s\S]+header time > img \{ width: 9px; height: 9px;/, "Profile post metadata must use the measured 42pt row, 14px type and shared 9pt clock");
  const instagramOwnerProfileSource = instagramContainerSource.match(/state\.currentView === "profile"[\s\S]*?state\.currentView === "following"/)?.[0] ?? "";
  const instagramKnownProfileTimestampSource = instagramContainerSource.match(/selectedKnownPosts\.map[\s\S]*?state\.currentView === "knownConnections"/)?.[0] ?? "";
  assert.match(instagramOwnerProfileSource, /formatInstagramRelativeTimestamp\(photo\.createdAt, currentDeviceDateTime\)/, "player Profile posts must derive relative time from the simulated clock and persisted post timestamp");
  assert.doesNotMatch(instagramOwnerProfileSource, /instagramVisibleFilterLabel/, "player Profile metadata must not display filter identity in the timestamp slot");
  assert.match(instagramKnownProfileTimestampSource, /formatInstagramRelativeTimestamp\(post\.timestamp, currentDeviceDateTime\)/, "known-account Profile posts must share simulated relative-time presentation");
  assert.match(instagramContainerSource, /POST_FIRST_PHOTO[^}]+createdAt: currentDeviceDateTime\.getTime\(\)/, "new Instagram posts must record the simulated device clock rather than host time");
  assert.doesNotMatch(instagramContainerSource, /createdAt: Date\.now\(\)/, "Instagram post timestamps must not depend on host time");
  assert.equal((instagramContainerSource.match(/<time><img src=\{instagramClockSrc\}/g) ?? []).length, 3, "Feed plus player and known-account Profile metadata must reuse the one reconstructed clock asset");
  assert.match(deviceCssSource, /\.instagram-owner-profile > \.instagram-find-facebook-friends \{ width: 190px; min-width: 190px; height: 28px; min-height: 28px; margin: 7px auto;[^}]*background: linear-gradient\(#709abd,#47779d 49%,#38688e 51%,#3d6b8f\)/, "Find Friends must use the approved restrained centered steel-blue control geometry");
  assert.match(deviceScreenSource, /<InstagramContainer[\s\S]+cameraRoll=\{cameraRoll\}/, "Instagram must receive only App's authorized runtime Camera Roll collection");
  assert.match(instagramContainerSource, /<PhotosContainer[\s\S]+mode="picker"[\s\S]+onPickerSelect/, "Instagram Share must enter the system Camera Roll picker mode");
  assert.match(instagramStateSource, /export type InstagramFilter = "Original" \| "X-Pro II" \| "Lomo-fi" \| "Earlybird" \| "1977";/, "Instagram filter state must expose exactly the five evidenced launch filter identities");
  assert.match(instagramFilteredImageSource, /Original[\s\S]+Normal[\s\S]+X-Pro II[\s\S]+Lomo-fi[\s\S]+Earlybird[\s\S]+1977/, "the shared renderer registry must retain evidenced filter order and the Normal display label");
  assert.match(instagramFilteredImageSource, /className="instagram-filtered-image"[\s\S]+<img src=\{src\}[\s\S]+instagram-filtered-image-wash[\s\S]+instagram-filtered-image-vignette/, "all filtered surfaces must share the square crop, CSS treatment, wash, then vignette renderer pipeline");
  assert.equal((instagramContainerSource.match(/<InstagramFilteredImage/g) ?? []).length, 5, "filter thumbnails, preview, Share confirmation, player Feed, and player Profile must use the one shared renderer call site");
  const instagramKnownMediaSource = instagramContainerSource.match(/followedKnownPosts\.map[\s\S]*?state\.photos\.map/)?.[0] ?? "";
  const instagramKnownProfileMediaSource = instagramContainerSource.match(/selectedKnownPosts\.map[\s\S]*?knownConnections/)?.[0] ?? "";
  assert.doesNotMatch(`${instagramKnownMediaSource}\n${instagramKnownProfileMediaSource}`, /InstagramFilteredImage/, "seeded and known-account Instagram media must remain outside the player-filter renderer");
  assert.doesNotMatch(instagramFilteredImageSource, /canvas|toBlob|toDataURL|Blob|indexedDB|createObjectURL|revokeObjectURL/, "Instagram filtering must not create or persist derivative media");
  assert.match(deviceCssSource, /\.instagram-filter-filmstrip-track \{ width: 350px; height: 96px;[\s\S]+flex: 0 0 70px; width: 70px; height: 96px;/, "the five filters must use a real 350pt horizontal track at the approved 70pt pitch");
  assert.match(deviceCssSource, /\.instagram-filter-filmstrip \{[^}]*overflow-x: auto;[^}]*scrollbar-width: none;/, "the filter strip must scroll horizontally without visible modern scroll chrome");
  assert.doesNotMatch(deviceCssSource, /instagram-filter-filmstrip[^}]*(?:scroll-snap|overscroll-behavior)|instagram-filter-(?:arrow|carousel)/, "the period filmstrip must not add snap, arrow, or carousel behavior");
  assert.match(deviceCssSource, /data-instagram-filter="X-Pro II"[\s\S]+contrast\(1\.24\)[\s\S]+data-instagram-filter="Lomo-fi"[\s\S]+contrast\(1\.28\)[\s\S]+data-instagram-filter="Earlybird"[\s\S]+sepia\(\.34\)[\s\S]+data-instagram-filter="1977"[\s\S]+hue-rotate\(-12deg\)/, "every non-Normal filter must retain its approved deterministic reconstructed transform");
  assert.doesNotMatch(deviceCssSource.match(/\.instagram-filtered-image \{[\s\S]*?\.instagram-share-confirmation/)?.[0] ?? "", /blur\(|drop-shadow|mix-blend-mode|background-blend-mode/, "the shared Instagram filter pipeline must not add blur, shadow, grain, or blend-mode variance");
  assert.doesNotMatch(instagramContainerSource, /DEV Fixture|DEV fixture|dev-fixture|Choose a source|No approved photographic fixture/, "normal Instagram runtime must not expose the development fixture path");
  assert.doesNotMatch(instagramContainerSource, /cameraRollPersistence|indexedDB|IDBDatabase/, "Instagram must not bypass App's Camera Roll ownership boundary");
  assert.match(photosContainerSource, /props\.mode === "picker"[\s\S]+backLabel="Cancel"[\s\S]+onOpenPhoto=\{props\.onPickerSelect\}/, "Photos picker mode must select a stable Camera Roll ID without opening the viewer");
  assert.match(photosContainerSource, /function PhotosBrowseContainer[\s\S]+function PhotoViewer/, "normal Photos browsing and viewer paths must remain present beside picker mode");
  assert.match(deviceCssSource, /\.instagram-popular-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,80px\)[^}]*overflow-y:\s*auto/, "Popular must use a vertically scrolling four-column grid at the confirmed 80pt pitch");
  assert.match(deviceCssSource, /\.instagram-popular-grid\s*>\s*button\s*\{[^}]*width:\s*80px;[^}]*height:\s*80px;/, "Popular thumbnails must retain square 80pt outer cells");
  assert.doesNotMatch(`${instagramContainerSource}\n${instagramChromeSource}`, /Explore|category chips|Suggested for You|Reels|instagram-popular-search/, "Popular must not introduce modern Explore UI");
  assert.match(deviceCssSource, /\.instagram-square-photo\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/, "June Instagram media must use a square presentation surface");
  assert.match(deviceCssSource, /\.instagram-square-photo img\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*cover/, "square Instagram images must fill their 1:1 surface without stretching");
  assert.match(facebookContainerSource, /getFacebookStoryMedia\(mediaId\)/, "Facebook Feed must resolve local and shared story media through the centralized registry resolver");
  assert.match(facebookContainerSource, /getFacebookAlbumByStoryId\(item\.id\)/, "Feed media must route through the centralized album registry");
  assert.match(facebookProfileSource, /wallItems\.map\(item => <FacebookStoryView/, "Profile Wall must reuse the canonical Feed story renderer");
  assert.equal([...facebookContainerSource.matchAll(/function FacebookCommentRow\(/g)].length, 1, "Post Detail and Photo Detail must share one comment-row component");
  assert.match(facebookContainerSource, /selectFacebookLikes\(state, item\.id, elapsedSeconds\)/, "Wall must consume current canonical and live Like state");
  assert.doesNotMatch(facebookContainerSource, /assets\/facebook\/characters|assets\/characters/, "Facebook UI components must not import character image files directly");
  assert.match(facebookProfileSource, /const profileMediaId = authorIdentity\?\.profileMediaId \?\? \(canonicalCharacter \? getFacebookCanonicalProfileMediaId\(canonicalCharacter\.id\) : null\) \?\? ephemeralProfileMediaId/, "Facebook Profile media ID must derive from author, canonical, or ephemeral actor-media mapping");
  assert.match(facebookProfileSource, /const profileMedia = profileMediaId \? getFacebookStoryMedia\(profileMediaId\) : null/, "Facebook Profile must resolve its actor-derived media ID through the shared story-media resolver");
  assert.match(facebookProfileIdentitySource, /data-profile-identity-source="actor-media"[\s\S]+facebook-profile-identity-media[\s\S]+profileMedia[\s\S]+facebook-profile-photo[\s\S]+facebook-profile-photo-hold[\s\S]+facebook-profile-identity-copy[\s\S]+profileName/, "Profile must bind canonical media and display name into one explicit identity block with a placeholder fallback");
  assert.doesNotMatch(facebookProfileIdentitySource, /<span>Friend<\/span>/, "already-friended Profiles must not render an unsupported passive Friend label");
  assert.doesNotMatch(facebookProfileIdentitySource, /getFacebookPhotosOfActor|getFacebookAlbumPhoto|taggedPhotos|cover|timeline/i, "Profile identity must not source arbitrary, tagged, cover, or Timeline media");
  assert.doesNotMatch(facebookProfileIdentitySource, /birthday|location|school|employer|relationship|interests/i, "Profile identity must not invent user biography fields");
  const profileSectionDefinition = facebookProfileSource.match(/\(\[([^\]]+)\] as const\)\.map\(section =>/)?.[1] ?? "";
  const profileSectionOrder = [...profileSectionDefinition.matchAll(/"([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(profileSectionOrder, ["wall", "info", "photos"], "Profile must preserve the exact Wall, Info, Photos section order without a Profile-level Friends tab");
  assert.equal(new Set(profileSectionOrder).size, 3, "Profile must render exactly three unique sections");
  assert.match(deviceCssSource, /\.facebook-profile-sections \{[^}]*grid-template-columns: repeat\(3,1fr\);/, "Profile sections must occupy three equal-width columns");
  assert.doesNotMatch(facebookProfileSource, /profileSection === "friends"|aria-label=\{`\$\{profileName\} Friends`\}/, "Profile-specific Friends content must not render");
  assert.match(facebookContainerSource, /state\.currentView === "friends" && <FacebookFriends/, "the global Facebook Friends route must remain rendered");
  assert.match(facebookContainerSource, /case "friends": dispatch\(\{ type: "SHOW_FRIENDS" \}\);/, "the global Friends launcher must retain its route");
  assert.doesNotMatch(facebookProfileSource, /cover-photo|timeline|profile-actions/i, "Profile must remain pre-Timeline without modern cover or action UI");
  assert.equal(deviceCssSource.split("\n").some(line => line.includes(".facebook-profile") && line.includes(".is-feed")), false, "Feed-only media selectors must not leak into Profile geometry");
  assert.match(deviceCssSource, /\.facebook-profile-wall \.facebook-story-photo-media \{[^}]*width:/, "Profile Wall single-photo scale must remain explicitly Profile-scoped");
  assert.match(deviceCssSource, /\.facebook-profile-wall \.facebook-story-photo-media \{ width: 82%; max-width: 212px;/, "Profile Wall single photos must retain the approved 82-percent, 212-pixel ceiling");
  assert.match(deviceCssSource, /\.facebook-profile-wall \.facebook-story-album-media \{ width: 80%; max-width: 212px;/, "Profile Wall multi-photo previews must retain their Wall-scoped compact width");
  assert.match(deviceCssSource, /\.facebook-profile-wall \.facebook-story-album-media img \{[^}]*height: auto;[^}]*aspect-ratio: auto;[^}]*object-fit: contain;/, "Profile Wall multi-photo previews must preserve intrinsic image aspect ratios without cover cropping");
  assert.match(deviceCssSource, /\.facebook-profile-wall \{ --facebook-wall-avatar-size: 36px;/, "Profile Wall must keep its compact Wall-specific avatar token");
  assert.match(deviceCssSource, /\.facebook-profile-header \{[^}]*min-height: 64px;[^}]*padding: 6px 8px;[^}]*grid-template-columns: 52px minmax\(0,1fr\);/, "Profile identity header geometry must remain frozen");
  assert.match(deviceCssSource, /\.facebook-profile-photo-hold,\.facebook-profile-photo \{[^}]*width: 52px; height: 52px;/, "Profile identity media must remain at the frozen 52-pixel size");
  assert.match(facebookProfileSource, /onToggleLike=\{\(\) => dispatch\(\{ type: "TOGGLE_LIKE", itemId: item\.id, displayName: currentUserName \}\)\}/, "Wall Like must retain the canonical handler");
  assert.match(facebookProfileSource, /onComment=\{\(\) => dispatch\(\{ type: "OPEN_COMMENTS", itemId: item\.id,[^\n]+origin: "profileWall", profileName \}\)\}/, "Wall Comment must open the dedicated Comments route with its Wall restoration context");
  assert.doesNotMatch(facebookProfileSource, /onOpen=|OPEN_FEED_ITEM|role=\{surface === "wall"|tabIndex=\{surface === "wall"/, "Profile Wall generic story bodies must not expose the retired Generic Post route");
  assert.match(deviceCssSource, /\.facebook-feed \.facebook-story-view\.is-feed \.facebook-story-photo-media \{[^}]*width: 68%;/, "the frozen News Feed single-photo scale must remain unchanged");
  assert.match(deviceCssSource, /\.facebook-photo-albums > button \{[^}]*min-height: 60px;[^}]*grid-template-columns: 48px minmax\(0,1fr\);/, "album collections must use compact list rows with square thumbnail columns");
  assert.match(deviceCssSource, /\.facebook-photo-albums > button > img \{[^}]*width: 48px; height: 48px;[^}]*object-fit: cover;/, "album-row cover media must use square preview cropping without changing canonical media");
  assert.match(deviceCssSource, /\.facebook-album-gallery > div \{[^}]*grid-template-columns: repeat\(3,minmax\(0,1fr\)\); gap: 3px;/, "album and tagged collections must share the compact three-column grid");
  assert.match(deviceCssSource, /\.facebook-photo-viewer > \.facebook-photo-viewer-image \{[^}]*max-width: 100%;[^}]*height: auto;[^}]*object-fit: contain;/, "Photo Detail must preserve the canonical source aspect ratio");
  assert.doesNotMatch(deviceCssSource, /\.facebook-photo-viewer > \.facebook-photo-viewer-image \{[^}]*object-fit: cover/, "Photo Detail must never crop its main canonical image");
  assert.match(facebookContainerSource, /className="is-tagged-collection"[\s\S]*OPEN_TAGGED_PHOTOS/, "Photos of an actor must remain a distinct selector-driven collection entry");
  assert.match(facebookContainerSource, /className="facebook-photo-viewer-image" src=\{media\.src\}/, "Photo Detail must render the exact centrally resolved media source");
  assert.match(facebookContainerSource, /facebook-photo-viewer[\s\S]*album\.ownerActor\.displayName[\s\S]*TOGGLE_LIKE[\s\S]*BEGIN_COMMENT/, "Photo Detail must retain canonical owner context and Like/Comment handlers");
  for (const [characterId, mapping] of Object.entries(facebookActorMedia.FACEBOOK_CANONICAL_ACTOR_MEDIA)) {
    assert.equal(facebookActorMedia.getFacebookCanonicalProfileMediaId(characterId), mapping.profileMediaId, `${characterId} Profile must retain its canonical actor-media mapping`);
    assert.ok(facebookStoryMedia.getFacebookStoryMedia(mapping.profileMediaId), `${characterId} canonical Profile media must resolve without placeholder fallback`);
  }
  assert.doesNotMatch(facebookContainerSource, /Reply unavailable in v0\.2/, "all open Facebook message threads must expose the shared reply composer");
  assert.match(facebookContainerSource, /SUBMIT_MESSAGE_REPLY/, "Facebook Messages must use the shared thread reply mechanism");
  assert.match(facebookContainerSource, /OPEN_COMMENT_AUTHOR/, "Facebook comment author names must route through the shared actor-profile event");
  assert.match(facebookContainerSource, /facebook-comment-author/, "Facebook comment author names must expose a usable tap target");
  assert.match(facebookContainerSource, /FacebookInlineEntityText/, "curated Facebook story text must use the reusable inline-entity renderer");
  assert.match(facebookContainerSource, /FacebookInlineEntityText text=\{comment\.text\} mentions=\{comment\.mentions\}/, "structured curated comment mentions must reuse the Facebook inline-entity renderer");
  assert.doesNotMatch(facebookContainerSource + facebookProfileSource + seedSource, /Math\.random\s*\(/, "Facebook actor avatar assignment must never randomize at runtime or render time");
  assert.match(facebookContainerSource, /SESSION_START_ISO[^\n]+elapsedMs/, "Facebook story metadata must derive simulated now from the existing global clock");
  assert.doesNotMatch(facebookStoryTimeSource, /Date\.now\(|new Date\(\s*\)/, "Facebook story metadata must never read real system time");
  assert.doesNotMatch(facebookStoryTimeSource, /Math\.max\(0,\s*simulatedNowMs\s*-\s*storyTimeMs\)/, "future timestamps must not be silently clamped to just now");
  assert.match(facebookStoryTimeSource, /Future story[^`]+story=/, "DEV future-time warning must identify the story and timestamps");
  assert.doesNotMatch(facebookStoryTimeSource, /setInterval|setTimeout/, "Facebook story metadata must not create a second timer");
  assert.match(facebookContainerSource, /facebook-inline-mention/, "structured Facebook mention tokens must expose a dedicated tap target");
  assert.match(facebookContainerSource, /OPEN_COMMENT_AUTHOR/, "inline mentions must reuse the existing Facebook actor/profile router");
  assert.doesNotMatch(facebookContainerSource, /match\([^)]*@|split\([^)]*@|@\[A-Za-z/, "Facebook mentions must not auto-link arbitrary @name text through naive parsing");
  assert.match(facebookContainerSource, /surface === "feed"[\s\S]+facebook-feed-action-disclosure[\s\S]+<summary aria-label="Show Like and Comment actions"><FacebookStoryActionBubble \/><\/summary>/, "News Feed stories must default to the shared period-style action bubble disclosure");
  assert.match(facebookContainerSource, /surface === "feed" \|\| surface === "wall"[\s\S]+\{ glyph: "comment" as const, label: commentLabel \}, \{ glyph: "like" as const, label: likeLabel \}[\s\S]+\{ glyph: "like" as const, label: likeLabel \}, \{ glyph: "comment" as const, label: commentLabel \}/, "Feed and Profile Wall summaries must order comments before people without changing Detail ordering");
  assert.match(facebookContainerSource, /likeCount > 0[\s\S]+commentLabel && !likeLabel|if \(!commentLabel && !likeLabel\) return null/, "News Feed engagement summaries must omit meaningless zero-count output");
  assert.match(facebookContainerSource, /facebook-feed-actions-expanded[\s\S]+aria-pressed=\{liked\}[\s\S]+onClick=\{onComment\}/, "revealed Feed actions must reuse the existing Like and Comment handlers in that order");
  assert.equal((facebookContainerSource.match(/className="facebook-feed-actions"/g) ?? []).length, 0, "Profile Wall stories must not retain a permanently rendered naked Feed-actions group");
  assert.match(facebookContainerSource, /surface === "wall" && <details className="facebook-profile-wall-action-disclosure">[\s\S]*<summary aria-label="Show Like and Comment actions"><FacebookStoryActionBubble \/><\/summary>[\s\S]*facebook-profile-wall-actions-expanded[\s\S]*aria-pressed=\{liked\} onClick=\{onToggleLike\}[\s\S]*onClick=\{onComment\}/, "Profile Wall must use the shared action artwork in an independent disclosure that reuses Like then Comment handlers");
  assert.match(facebookContainerSource, /surface === "feed" \|\| surface === "wall"[\s\S]*likeCount > 0 \? `\$\{likeCount\} \$\{likeCount === 1 \? "person" : "people"\}` : null/, "Wall Like summaries must use compact person/people labels and omit zero values");
  assert.match(facebookContainerSource, /: \(commentCount > 0 \|\| likeCount > 0\) && <span className="facebook-profile-wall-engagement-summary">/, "Wall must not reserve an engagement-summary container when both counts are zero");
  assert.doesNotMatch(facebookContainerSource, /dispatch\(\{[^}]*wallActionDisclosure|expandedWallActionStoryId/, "Wall disclosure must remain native UI state outside canonical Facebook state");
  assert.match(facebookContainerSource, /visibleFeed\.map\(item => <FacebookStoryView\s+key=\{item\.id\}/, "Feed action disclosure must preserve stable canonical story keys");
  assert.doesNotMatch(facebookContainerSource, /dispatch\(\{[^}]*feedActionDisclosure|expandedFeedActionStoryId/, "Feed action disclosure must remain native UI state and must not dispatch canonical Facebook state");
  assert.match(deviceCssSource, /\.facebook-feed \.facebook-story-view\.is-feed \{ position: relative; \}/, "each News Feed story must provide the positioning context for its action trigger");
  assert.match(deviceCssSource, /\.facebook-feed \.facebook-feed-action-disclosure > summary \{[^}]*top: 50%;[^}]*transform: translateY\(-50%\);/, "the collapsed plus trigger must remain vertically centered against its Feed story");
  assert.match(deviceCssSource, /\.facebook-feed \.facebook-feed-action-disclosure > summary \{ right: 7px; \}/, "the Feed action bubble must use the measured artwork-relative right offset");
  assert.match(deviceCssSource, /\.facebook-feed \.facebook-story-view\.is-feed \.facebook-story-photo-media \{ width: 68%; max-width: 68%; \}/, "single-photo Feed attachments must use the conservative 68-percent scale when no orientation metadata exists");
  assert.match(deviceCssSource, /\.facebook-feed \.facebook-story-view\.is-feed \.facebook-story-album-media \{ width: 76%; max-width: 76%; \}/, "three-photo Feed attachments must use the compact 76-percent scale");
  assert.match(deviceCssSource, /\.facebook-feed \.facebook-story-view\.is-feed \.facebook-story-album-media\.is-two-photo \{ width: 74%; max-width: 74%; \}/, "two-photo Feed attachments must use the compact 74-percent scale");
  assert.match(deviceCssSource, /\.facebook-feed \.facebook-story-view\.is-feed \.facebook-feed-action-disclosure > \.facebook-feed-actions-expanded \{[^}]*min-height: 32px;[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\);[^}]*border-top: 1px solid #1d365f;/, "expanded Feed actions must render as the period-style full-row blue Like and Comment bar");
  assert.match(deviceCssSource, /\.facebook-profile-wall-action-disclosure > summary \{[^}]*top: 50%;[^}]*right: 8px;[^}]*transform: translateY\(-50%\);/, "the collapsed Wall plus trigger must remain vertically centered at the story's right edge");
  assert.match(deviceCssSource, /\.facebook-profile-wall-actions-expanded \{[^}]*min-height: 32px;[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\);[^}]*border-top: 1px solid #1d365f;/, "expanded Wall actions must use the scoped period-style two-column bar");
  assert.match(deviceCssSource, /\.facebook-feed \.facebook-feed-action-disclosure > summary,\.facebook-profile-wall-action-disclosure > summary \{[^}]*width: 30px; height: 30px;[^}]*background: transparent;/, "Feed and Wall must share one compact non-nav-button story-action hit frame");
  assert.match(deviceCssSource, /\.facebook-story-action-bubble \{ width: 23px; height: 28px;[^}]*pointer-events: none;/, "the shared visible story-action artwork must retain its reference-matched bounds without intercepting story clicks");
  assert.equal(deviceCssSource.split("\n").some(line => line.includes("facebook-feed-actions-expanded") && line.includes("facebook-profile-wall-actions-expanded")), false, "Feed and Wall expanded action bars must retain their independent surface geometry");
  assert.doesNotMatch(deviceCssSource, /\.facebook-feed-detail[^}]*68%|\.facebook-photo-viewer[^}]*68%/, "News Feed compact media percentages must never leak into Post Detail or Photo Detail");
  assert.match(deviceCssSource, /\.facebook-feed-detail > \.facebook-story-photo-media img \{ width: 100%; height: auto; max-height: none; object-fit: contain; \}/, "Post Detail single photos must preserve intrinsic aspect ratio at the larger detail width");
  assert.doesNotMatch(deviceCssSource, /\.facebook-feed-detail[^}]*object-fit: cover/, "Post Detail must never introduce a surface-specific cover crop");
  let commentsDetailState = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "SHOW_FEED" });
  commentsDetailState = facebook.facebookStateTransition(commentsDetailState, { type: "OPEN_COMMENTS", itemId: "alex-jacks-party-friday", scrollPosition: 84 });
  assert.deepEqual([commentsDetailState.currentView, commentsDetailState.selectedFeedItemId, commentsDetailState.scrollPosition], ["commentsDetail", "alex-jacks-party-friday", 84], "Feed Comment must open the dedicated canonical Comments route");
  commentsDetailState = facebook.facebookStateTransition(commentsDetailState, { type: "GO_BACK" });
  assert.deepEqual([commentsDetailState.currentView, commentsDetailState.scrollPosition], ["feed", 84], "Comments Back must restore the exact Feed origin");
  let wallCommentsState = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "OPEN_PROFILE", profileName: "Ben Dawson" });
  wallCommentsState = facebook.facebookStateTransition(wallCommentsState, { type: "OPEN_COMMENTS", itemId: "ben-long-day", scrollPosition: 912, origin: "profileWall", profileName: "Ben Dawson" });
  assert.deepEqual([wallCommentsState.currentView, wallCommentsState.profileWallScrollPositions["Ben Dawson"], wallCommentsState.scrollPosition], ["commentsDetail", 912, 0], "Wall Comment must preserve the exact Wall snapshot without contaminating Feed scroll");
  wallCommentsState = facebook.facebookStateTransition(wallCommentsState, { type: "GO_BACK" });
  assert.deepEqual([wallCommentsState.currentView, wallCommentsState.selectedProfileName, wallCommentsState.profileWallScrollPositions["Ben Dawson"], wallCommentsState.scrollPosition], ["profile", "Ben Dawson", 912, 0], "Comments Back must restore the originating Profile Wall without a Post intermediary");
  assert.match(facebookContainerSource, /onComment=\{\(\) => dispatch\(\{ type: "OPEN_COMMENTS"/, "Feed Comment must not route through generic Post Detail");
  assert.match(facebookContainerSource, /case "commentsDetail": return "Comments";/, "dedicated comment navigation must use the centered Comments title");
  assert.match(facebookContainerSource, /facebook-comments-like-control[\s\S]+TOGGLE_LIKE/, "Comments header Like must reuse the canonical Like action");
  assert.match(facebookContainerSource, /facebook-comments-scroll[\s\S]+facebook-comments-panel[\s\S]+facebook-comments-like-summary[\s\S]+placeholder="Write a comment\.\.\."/, "Comments must retain one scroll area, an always-present shared interaction panel, a separate Likes summary, and a compact composer");
  assert.match(facebookCommentsDetailSource, /<div className="facebook-comments-panel">[\s\S]+selectFacebookLikes[\s\S]+<div className="facebook-comments-list">/, "every dedicated Comments route must retain one unconditional shared panel below the normalized timestamp row");
  assert.equal((facebookContainerSource.match(/className="facebook-comments-panel"/g) ?? []).length, 1, "dedicated Comments must define exactly one shared panel rather than actor-specific pointer markup");
  assert.match(deviceCssSource, /--facebook-micro-glyph-blue: #71839a;/, "comment and Like artwork must share one muted gray-blue token distinct from navigation blue");
  assert.match(deviceCssSource, /\.facebook-micro-glyph\.is-comment,\.facebook-micro-glyph\.is-like \{[^}]*background-color: var\(--facebook-micro-glyph-blue\);[^}]*mask-size: contain;/, "shared engagement glyphs must use the same tokenized, raster-scaled artwork treatment");
  assert.match(deviceCssSource, /\.facebook-comments-panel \{[^}]*--facebook-comments-panel-fill: #f1f3f6;[^}]*--facebook-comments-panel-border: #d0d4da;[^}]*border-top: 1px solid var\(--facebook-comments-panel-border\);[^}]*background: var\(--facebook-comments-panel-fill\);/, "the shared Comments panel must own the refined near-white cool fill and subtle border source");
  assert.match(deviceCssSource, /--facebook-comments-source-mark-center-x: calc\([^;]+\);[^}]*--facebook-comments-fallback-notch-center-x: calc\(var\(--facebook-comments-story-content-start-x\) \+ 5px\);/, "Comments must derive both source and fallback notch anchors from shared story layout measurements");
  assert.match(deviceCssSource, /\.facebook-comments-panel::before \{[^}]*left: calc\(var\(--facebook-comments-fallback-notch-center-x\) - var\(--facebook-comments-pointer-half-width\)\);[^}]*top: -6px;[^}]*width: var\(--facebook-comments-pointer-width\); height: 7px;[^}]*background: var\(--facebook-comments-panel-fill\);[^}]*var\(--facebook-comments-panel-border\)/, "the shared Comments panel must always own one measured top notch at the stable story-content fallback anchor");
  assert.match(deviceCssSource, /\.facebook-comments-panel\.has-mobile-source::before \{ left: calc\(var\(--facebook-comments-source-mark-center-x\) - var\(--facebook-comments-pointer-half-width\)\); \}/, "a supported source mark may only override the always-present notch's horizontal anchor");
  assert.equal((deviceCssSource.match(/\.facebook-comments-panel::before/g) ?? []).length, 1, "Comments must own exactly one unconditional shared top-notch geometry rule");
  assert.equal((deviceCssSource.match(/\.facebook-comments-panel\.has-mobile-source::before/g) ?? []).length, 1, "Comments must own exactly one source-alignment override without conditional notch creation");
  assert.doesNotMatch(deviceCssSource, /\.facebook-comments-like-summary::before/, "the notch must not disappear with the conditional Likes summary");
  assert.doesNotMatch(facebookCommentsDetailSource, /alex|june|jack|matt|jay|ben|katie|chris|luca|sophie|feedDetail|OPEN_FEED_ITEM/i, "Comments panel/notch markup must remain actor-independent and isolated from Generic Post Detail");
  assert.match(deviceCssSource, /\.facebook-comment\.is-comments-detail \{[^}]*min-height: 43px;[^}]*padding: 5px 8px;[^}]*border-bottom-color: #d6d9de;[^}]*background: #f3f4f6;[^}]*box-shadow: inset 0 1px rgba\(255,255,255,\.82\);/, "Comments rows must retain compact geometry with the refined near-white fill and subtle separators");
  assert.match(facebookContainerSource, /FacebookCommentsOriginalStory[\s\S]+<FacebookStoryMedia item=\{item\} dispatch=\{dispatch\} \/>/, "Comments must resolve the original story through canonical media");
  assert.match(deviceCssSource, /\.facebook-comments-detail \{[^}]*grid-template-rows: minmax\(0,1fr\) auto;[^}]*overflow: hidden;/, "Comments must dock its compact composer outside the authoritative scroll area");
  assert.match(facebookContainerSource, /<FacebookNotificationActionBubble count=\{1\} \/><span>\{activeNotification\.text\}<\/span>/, "Home transient notifications must use their dedicated action-bubble component without changing canonical text");
  assert.match(deviceCssSource, /\.facebook-notification-action-bubble \{[^}]*width: 23px; height: 24px;/, "the transient notification action bubble must retain its measured body-plus-tail display bounds");
  assert.match(deviceCssSource, /\.facebook-home-notification-banner \{[^}]*gap: 7px; padding: 0 13px;/, "the transient notification banner must retain measured bubble spacing and left inset");
  const feedStoryInvocationSource = facebookContainerSource.match(/visibleFeed\.map\(item => <FacebookStoryView[\s\S]*?dispatch=\{dispatch\}\s*\/>\)\}/)?.[0] ?? "";
  const facebookStoryMediaSource = facebookContainerSource.match(/function FacebookStoryMedia[\s\S]*?function FacebookInlineEntityText/)?.[0] ?? "";
  assert.doesNotMatch(feedStoryInvocationSource, /OPEN_FEED_ITEM/, "News Feed story bodies must not retain Generic Post Detail as their primary route");
  assert.match(feedStoryInvocationSource, /OPEN_COMMENTS/, "News Feed Comment must retain the dedicated Comments route");
  assert.match(feedStoryInvocationSource, /onBeforeMediaNavigate[^\n]+SET_SCROLL_POSITION/, "Feed media navigation must capture the canonical Feed scroll snapshot");
  assert.doesNotMatch(facebookContainerSource, /type: "OPEN_FEED_ITEM"/, "Generic Post Detail must have no normal runtime caller in Facebook UI");
  assert.match(facebookContainerSource, /facebook-story-link"><FacebookInlineEntityText/, "Feed and Wall generic story bodies must remain inert while structured mentions keep their narrow Profile targets");
  assert.match(facebookContainerSource, /facebook-event-wall-story" data-route-classification="NO_ACTION"/, "the Event Wall Alex story body must be explicitly classified as NO_ACTION");
  assert.doesNotMatch(facebookContainerSource, /facebook-event-wall[\s\S]{0,320}OPEN_FEED_ITEM/, "Event Wall must not expose the deprecated Generic Post internal fallback");
  assert.match(deviceCssSource, /\.facebook-event-wall-story \{[^}]*width: 100%;[^}]*padding: 10px 12px;[^}]*background: #fff;[^}]*text-align: left;/, "retiring Event Wall navigation must preserve the existing row presentation");
  assert.match(facebookStateSource, /@deprecated Internal fallback only; Generic Post Detail has no normal user-facing caller/, "the retained Generic Post transition must be explicitly deprecated as an internal fallback");
  assert.match(facebookStateSource, /case "OPEN_NOTIFICATION":[\s\S]+facebook-notification-jack-request[\s\S]+OPEN_MESSAGE[\s\S]+OPEN_PARTY_EVENT/, "Facebook notification targets must remain on Requests, Messages, or Event Detail rather than Generic Post");
  assert.match(facebookStoryMediaSource, /OPEN_ALBUM_PHOTO[\s\S]+OPEN_PHOTO[\s\S]+media\.length === 1[\s\S]+openPhoto\(media\[0\]\.id\)/, "single Feed photos must converge on canonical Photo Detail with or without album context using their exact media ID");
  assert.match(facebookStoryMediaSource, /media\.map\(record => <button[\s\S]+openPhoto\(record\.id\)/, "each multi-photo thumbnail must open its exact canonical media ID");
  assert.doesNotMatch(facebookStoryMediaSource, /type: "OPEN_FEED_ITEM"|item\.kind === "album" \? \{ type: "OPEN_ALBUM"/, "Feed media must never route through Generic Post Detail or an album-wide primary action");
  assert.match(deviceCssSource, /\.facebook-story-album-media > button \{[^}]*overflow: hidden;[^}]*border: 0;/, "multi-photo previews must expose independent compact thumbnail controls");
  assert.match(facebookContainerSource, /visibleFriends[\s\S]+sort\(\(left, right\) => left\.name\.localeCompare\(right\.name\)\)[\s\S]+friendSections = visibleFriends\.reduce/, "Friends must use deterministic display-name sorting and populated alphabetical sections");
  const facebookNavigationHeaderSource = facebookContainerSource.match(/function FacebookNavigationHeader[\s\S]*?function FacebookChatConversation/)?.[0] ?? "";
  const facebookHomeSource = facebookContainerSource.match(/function FacebookHome[\s\S]*?function HomeDestination/)?.[0] ?? "";
  assert.match(facebookNavigationHeaderSource, /currentView === "home"[\s\S]*facebook-home-chrome[\s\S]*facebook-navigation-bar is-home[\s\S]*facebook-home-search-row[\s\S]*facebook-search-field facebook-home-search[\s\S]*placeholder="Search"/, "Home Search must be structurally inside the extended Home chrome beneath the Home navbar");
  assert.match(facebookNavigationHeaderSource, /value=\{state\.homeSearchQuery\}[\s\S]*EDIT_HOME_SEARCH/, "Home Search must retain its canonical state and edit handler after the chrome move");
  assert.doesNotMatch(facebookHomeSource, /facebook-home-search-row|facebook-home-search/, "the pale launcher body must begin below rather than contain Home Search");
  assert.match(facebookContainerSource, /facebook-search-field facebook-friends-search[\s\S]+facebook-search-glyph[\s\S]+Search Friends[\s\S]+Search Pages[\s\S]+EDIT_FRIEND_SEARCH/, "Friends and Pages Search must retain the light list-header field and canonical handler");
  assert.match(deviceCssSource, /\.facebook-search-field input \{[^}]*text-align: left;/, "shared Search field geometry must left-align placeholder and content without sharing container chrome");
  const facebookHomeChromeCss = deviceCssSource.match(/\.facebook-home-chrome \{[^}]*\}/)?.[0] ?? "";
  assert.match(facebookHomeChromeCss, /grid-template-rows: 44px 44px;[^}]*background: linear-gradient\(to bottom,/, "one continuous vertical Home parent gradient must own both rows");
  assert.ok((facebookHomeChromeCss.match(/\d+%/g) ?? []).length >= 6, "the Home parent gradient must retain a visible multi-stop highlight, middle, Search-zone, and terminal-edge progression");
  assert.match(facebookHomeChromeCss, /box-shadow: inset 0 -1px #1d365f;/, "the Home parent must own the sole outer bottom edge");
  assert.match(deviceCssSource, /\.facebook-home-chrome > \.facebook-navigation-bar \{[^}]*border-bottom: 0;[^}]*background: transparent;[^}]*box-shadow: none;/, "the Home navbar must expose the shared parent background without an intermediate divider");
  assert.match(deviceCssSource, /\.facebook-home-search-row \{[^}]*border-bottom: 0;[^}]*background: transparent;[^}]*box-shadow: none;/, "the Home Search row must expose the shared parent background without a second edge or gradient");
  assert.doesNotMatch(deviceCssSource, /\.facebook-home-search-row[^\n]*facebook-friends-search|\.facebook-friends-search[^\n]*facebook-home-search-row/, "Friends and Pages Search must never inherit Home blue-row chrome");
  const frozenFeedViewStart = facebookContainerSource.indexOf('{state.currentView === "feed" && <>');
  const frozenFeedViewEnd = facebookContainerSource.indexOf('{state.currentView === "feedDetail"', frozenFeedViewStart);
  assert.ok(frozenFeedViewStart >= 0 && frozenFeedViewEnd > frozenFeedViewStart, "the frozen News Feed source boundary must remain identifiable");
  const frozenFeedViewSource = facebookContainerSource.slice(frozenFeedViewStart, frozenFeedViewEnd);
  assert.doesNotMatch(frozenFeedViewSource, /facebook-(?:home|friends)-search|placeholder="Search(?: Facebook| Friends| Pages)?"/, "News Feed must not gain a Search field");
  assert.match(frozenFeedViewSource, /facebook-feed-composer-strip[\s\S]+facebook-feed-camera-control[\s\S]+What's on your mind\?/, "the frozen News Feed composer structure must remain intact");
  assert.equal(deviceCssSource.split("\n").some(line => line.includes(".facebook-feed") && /search/i.test(line)), false, "no Search-specific CSS may target the frozen News Feed");
  assert.match(facebookContainerSource, /friend\.actor\.kind === "canonical"[\s\S]+getFacebookCanonicalProfileMediaId\(friend\.actor\.characterId\)[\s\S]+getFacebookEphemeralProfileMediaId\(friend\.actor\.ephemeralId\)[\s\S]+profileMediaId \? getFacebookStoryMedia\(profileMediaId\) : null[\s\S]+facebook-friend-avatar[\s\S]+facebook-friend-avatar is-placeholder/, "Friends rows must narrow their typed actor and resolve avatars through the centralized actor-media and story-media paths");
  const canonicalFriendMediaIds = facebookA.friends
    .filter(friend => friend.actor.kind === "canonical")
    .map(friend => {
      const actorMediaId = facebookActorMedia.getFacebookCanonicalProfileMediaId(friend.actor.characterId);
      assert.equal(actorMediaId, facebookActorMedia.FACEBOOK_CANONICAL_ACTOR_MEDIA[friend.actor.characterId]?.profileMediaId ?? null, `${friend.name} must use the canonical actor-media mapping`);
      assert.ok(actorMediaId, `${friend.name} must not fall back to a placeholder avatar`);
      assert.ok(facebookStoryMedia.getFacebookStoryMedia(actorMediaId), `${friend.name} profile media must resolve through the canonical story-media registry`);
      return actorMediaId;
    });
  assert.equal(new Set(canonicalFriendMediaIds).size, canonicalFriendMediaIds.length, "canonical Friends must not accidentally share duplicate profile-media mappings");
  assert.match(facebookContainerSource, /facebook-friend-list[\s\S]+<nav className="facebook-alphabet-index"/, "the Friends alphabet rail must sit beside rather than inside the authoritative list scroll node");
  assert.match(facebookContainerSource, /state\.friendsSection === "pages"[\s\S]+Search Pages[\s\S]+facebook-page-list[\s\S]+OPEN_PAGE/, "Pages must reuse the shared searchable list shell and open a Page-specific route");
  assert.match(deviceCssSource, /--facebook-contact-row-height: 50px;[^}]*--facebook-contact-avatar-size: 42px;/, "Friends and Pages must use compact 50-pixel rows and 42-pixel square avatars");
  assert.match(deviceCssSource, /\.facebook-alphabet-index \{[^}]*position: absolute;[^}]*top: 2px;[^}]*bottom: 2px;/, "the A-Z rail must remain fixed to the Friends list region while content scrolls independently");
  let pageState = facebook.facebookStateTransition(facebook.createInitialFacebookState("Zoey"), { type: "SHOW_FRIENDS" });
  pageState = facebook.facebookStateTransition(pageState, { type: "SET_FRIENDS_SECTION", section: "pages" });
  assert.deepEqual(facebook.selectFacebookVisiblePages(pageState).map(page => page.name), ["Gelato Roma", "High School Festival", "Main Street Diner"], "empty Page search must return all Pages alphabetically");
  pageState = facebook.facebookStateTransition(pageState, { type: "EDIT_FRIEND_SEARCH", value: "DINER" });
  assert.deepEqual(facebook.selectFacebookVisiblePages(pageState).map(page => page.id), ["facebook-page-main-street-diner"], "Search Pages must filter real Page records case-insensitively");
  const friendsBeforePage = pageState.friends.map(friend => friend.id);
  const feedCountBeforePage = pageState.feed.length;
  pageState = facebook.facebookStateTransition(pageState, { type: "OPEN_PAGE", pageId: "facebook-page-main-street-diner" });
  assert.deepEqual([pageState.currentView, pageState.selectedPageId, pageState.pageFanIds], ["pageDetail", "facebook-page-main-street-diner", []], "Page rows must open Page identity rather than a Profile actor");
  pageState = facebook.facebookStateTransition(pageState, { type: "BECOME_PAGE_FAN", pageId: "facebook-page-main-street-diner" });
  assert.deepEqual([pageState.pageFanIds, pageState.friends.map(friend => friend.id), pageState.feed.length], [["facebook-page-main-street-diner"], friendsBeforePage, feedCountBeforePage], "Become a Fan must update only session-local Page fan state");
  assert.deepEqual(facebook.facebookStateTransition(pageState, { type: "RESET", displayName: "Zoey" }).pageFanIds, [], "session reset must restore the non-fan Page baseline");
  assert.doesNotMatch(facebookContainerSource, /HomeDestination[^\n]+label="Groups"/, "Groups must not appear as an October 20 launcher destination");
  assert.doesNotMatch(facebookContainerSource, /facebook-home-empty-slot/, "Facebook Home page 1 must no longer contain an empty launcher slot");
  assert.match(facebookContainerSource, /FACEBOOK_HOME_LAUNCHER_PAGES\[state\.homeLauncherPage\]/, "Facebook Home must render both pages from one canonical launcher definition");
  assert.match(facebookContainerSource, /<FacebookHomeIcon destinationId=\{destinationId\} \/>/, "Home destinations must render through the centralized historical icon registry");
  assert.doesNotMatch(facebookContainerSource, /facebook-home-icon-hold|\{iconLabel\}/, "rendered Home destinations must not fall back to letter-tile placeholders");
  assert.match(facebookHomeIconsSource, /satisfies Record<FacebookHomeLauncherDestinationId,/, "the Home icon registry must be exhaustive over the frozen launcher destination type");
  assert.match(facebookHomeIconsSource, /sourceType: FacebookHomeIconSourceType;[\s\S]*confidence: FacebookHomeIconConfidence;[\s\S]*assetSrc: string;[\s\S]*originalFilename: string;[\s\S]*sourcePackage: "Facebook 3\.2\.1 \(3210\)";[\s\S]*intrinsicSize: readonly \[128, 128\];[\s\S]*displaySize: readonly \[64, 64\];[\s\S]*sha256: string;[\s\S]*opticalOffset:/, "launcher provenance metadata must retain package, filename, intrinsic size, display scale, checksum, confidence, and optical offset");
  assert.equal((facebookHomeIconsSource.match(/assets\/facebook\/home\/3\.2\.1\/[a-zA-Z]+Button@2x\.png/g) ?? []).length, 10, "all ten launcher modules must import their named Facebook 3.2.1 Retina source");
  for (const [destinationId, [filename, expectedHash]] of Object.entries(recoveredFacebookHomeIconHashes)) {
    assert.match(facebookHomeIconsSource, new RegExp(`^  ${destinationId}: Object\\.freeze`, "m"), `${destinationId} must have one centralized launcher icon registry entry`);
    assert.match(facebookHomeIconsSource, new RegExp(`${destinationId}: Object\\.freeze\\(\\{[^\\n]+sourceType: "historical-asset"[^\\n]+originalFilename: "${filename.replace("@", "@")}"[^\\n]+intrinsicSize: FACEBOOK_HOME_ORIGINAL_INTRINSIC_SIZE[^\\n]+sha256: "${expectedHash}"`), `${destinationId} must register its verified original filename, size, and checksum`);
    const recoveredAssetBytes = await readFile(resolve(projectRoot, "src/assets/facebook/home/3.2.1", filename));
    assert.equal(recoveredAssetBytes.subarray(1, 4).toString("ascii"), "PNG", `${filename} must remain a PNG payload`);
    assert.deepEqual([recoveredAssetBytes.readUInt32BE(16), recoveredAssetBytes.readUInt32BE(20)], [128, 128], `${filename} must remain the exact 128x128 Retina canvas`);
    assert.equal(createHash("sha256").update(recoveredAssetBytes).digest("hex"), expectedHash, `${filename} must remain byte-identical to the recovered Facebook 3.2.1 resource`);
  }
  assert.match(facebookHomeIconsSource, /<img className="facebook-home-icon__original"[\s\S]+onError=\{\(\) => setFailedAssetSrc\(icon\.assetSrc\)\}/, "verified originals must render through the registry with a scoped load-failure fallback");
  assert.match(facebookHomeIconsSource, /function FacebookHomeIconFallback[\s\S]+facebook-home-icon__paper[\s\S]+facebook-home-icon__chat/, "the isolated CSS reconstructions must remain available only as load-failure fallbacks");
  assert.doesNotMatch(facebookHomeIconsSource, /<svg|from ["'][^"']+\.(?:jpe?g|gif|webp|svg)["']|https?:\/\//, "launcher originals must not come from screenshots, modern libraries, vectors, or runtime external URLs");
  assert.match(deviceCssSource, /\.facebook-home-icon\.is-historical-asset \{ filter: none; \}[\s\S]*\.facebook-home-icon__original \{[^}]*top: -3px;[^}]*width: 64px; height: 64px;/, "original Retina assets must render at 64x64 without adding reconstructed shadow treatment or changing launcher geometry");
  assert.doesNotMatch(deviceCssSource, /\.facebook-home-icon-hold/, "the unsupported uniform blue letter-tile treatment must remain removed");
  assert.match(facebookContainerSource, /onPointerDown[\s\S]+onPointerUp/, "Facebook launcher paging must use one pointer path for touch and desktop drag gestures");
  assert.doesNotMatch(facebookContainerSource, /onPointerDown=\{event => \{[\s\S]{0,300}setPointerCapture/, "launcher paging must not capture an ordinary button tap on pointerdown");
  assert.match(facebookContainerSource, /onPointerMove=\{event => \{[\s\S]+isFacebookHomeHorizontalSwipe[\s\S]+setPointerCapture/, "launcher paging may capture the pointer only after a real horizontal drag");
  assert.match(facebookContainerSource, /onClick=\{\(\) => openDestination\(destination\.id\)\}/, "launcher destination buttons must retain their normal click route");
  assert.doesNotMatch(facebookContainerSource, /className="facebook-home-notifications"|>Notifications<\/span>/, "Home must not render a permanent Notifications footer");
  assert.match(facebookContainerSource, /facebook-home-notification-banner[\s\S]*OPEN_NOTIFICATION[\s\S]*activeNotification\.id[\s\S]*activeNotification\.text/, "the transient Home banner must use canonical notification copy and the existing notification target event");
  assert.match(facebookContainerSource, /newlyDelivered = notifications\.filter\(notification => !knownNotificationIds\.has\(notification\.id\)\)/, "banner presentation must trigger only for newly derived notification IDs");
  assert.match(facebookContainerSource, /window\.setTimeout\(\(\) => setActiveHomeNotificationBannerId\(null\), FACEBOOK_HOME_NOTIFICATION_BANNER_DURATION_MS\)/, "the reconstructed timeout must dismiss presentation state without changing notification records");
  assert.doesNotMatch(facebookStateSource, /activeHomeNotificationBanner|HOME_NOTIFICATION_BANNER/, "transient banner visibility must remain outside canonical Facebook state");
  assert.doesNotMatch(seedSource, /activeHomeNotificationBanner|home-notification-banner/, "transient presentation must not create or duplicate seed notification records");
  assert.match(facebookContainerSource, /const destinationCounts[^}]*inbox: inboxUnreadCount,[^}]*requests: requestCount,[^}]*events: eventInviteUnseenCount,/s, "Inbox, Requests, and Events launcher badges must retain their independent canonical selectors");
  assert.match(facebookContainerSource, /facebook-home-page-dots[\s\S]*SET_HOME_LAUNCHER_PAGE[\s\S]*page: 0[\s\S]*page: 1/, "Home page dots and both paging targets must remain intact");
  assert.doesNotMatch(facebookContainerSource, />Menu<|>Exit<|className="facebook-(?:menu|exit)-/, "native Facebook Home must not gain feature-phone Menu or Exit chrome");
  assert.match(facebookStateSource, /case "SHOW_NOTIFICATIONS":[\s\S]*case "OPEN_NOTIFICATION":/, "the dedicated Notifications route and canonical target mapping must remain preserved even without a permanent Home footer");
  assert.match(deviceCssSource, /\.facebook-home \{ grid-template-rows: minmax\(0,1fr\) 16px;[^}]*background:/, "the pale launcher body must begin below Home Search and reserve no permanent notification-footer row");
  assert.match(deviceCssSource, /\.facebook-home\.has-notification-banner \{ grid-template-rows: minmax\(0,1fr\) 16px 36px; \}/, "Home may add compact banner space only while transient presentation is visible");
  assert.match(deviceCssSource, /\.facebook-home-grid \{[^}]*grid-template-rows: repeat\(3,103px\);[^}]*align-content: start;[^}]*touch-action: pan-y;/, "both Home pages must share the measured fixed 3-row launcher rhythm and scoped gesture handling");
  assert.match(deviceCssSource, /\.facebook-home-destination strong \{[^}]*white-space: nowrap;/, "all canonical Home labels must remain on one centered line");
  assert.match(deviceCssSource, /\.facebook-unread-badge \{[^}]*left: calc\(50% \+ var\(--facebook-home-column-offset,0px\) \+ 20px\);/, "launcher badges must remain optically anchored to the visible icon artwork");
  assert.doesNotMatch(facebookContainerSource, /facebook-internal-count/, "Home destinations must not retain the obsolete plain-red badge markup");
  assert.match(deviceCssSource, /\.facebook-home \{[^}]*background:/, "Facebook Home must own the shared launcher background surface");
  assert.match(deviceCssSource, /\.facebook-home-secondary-page \{[^}]*background: transparent;/, "the sparse Notes page must expose the shared Home launcher background");
  assert.doesNotMatch(deviceCssSource, /\.facebook-home-secondary-page,\.facebook-people-search-results/, "launcher Page 2 must not inherit the lighter people-search results fill");
  assert.doesNotMatch(deviceCssSource, /\.facebook-home-secondary-page \{[^}]*(?:place-items|align-content|justify-content): center/, "the sparse Notes page must never vertically center its launcher item");
  assert.match(facebookContainerSource, /facebook-notes-empty[\s\S]+No notes\./, "Notes must expose a functional biography-free empty state");
  const facebookPlacesHomeStart = facebookContainerSource.indexOf("function FacebookPlacesHome");
  const facebookNearbyPlacesStart = facebookContainerSource.indexOf("function FacebookNearbyPlaces", facebookPlacesHomeStart);
  const facebookPlaceFlowEnd = facebookContainerSource.indexOf("function FacebookPhotos", facebookNearbyPlacesStart);
  assert.ok(facebookPlacesHomeStart >= 0 && facebookNearbyPlacesStart > facebookPlacesHomeStart && facebookPlaceFlowEnd > facebookNearbyPlacesStart, "the scoped Facebook Places flow source must remain identifiable");
  const facebookPlacesHomeSource = facebookContainerSource.slice(facebookPlacesHomeStart, facebookNearbyPlacesStart);
  const facebookPlacesFlowSource = facebookContainerSource.slice(facebookPlacesHomeStart, facebookPlaceFlowEnd);
  assert.equal((facebookPlacesHomeSource.match(/>Check In<\/button>/g) ?? []).length, 1, "Places Home must expose exactly one Check In entry");
  assert.match(facebookPlacesHomeSource, /OPEN_NEARBY_PLACES/, "Places Home Check In must route to Nearby Places");
  assert.doesNotMatch(facebookPlacesHomeSource, /FACEBOOK_PLACE_OPTIONS|type: "CHECK_IN"/, "Places Home must not render or submit the legacy venue-directory Check In rows");
  assert.match(facebookPlacesFlowSource, /function FacebookNearbyPlaces[\s\S]*FACEBOOK_PLACE_OPTIONS\.map[\s\S]*SELECT_PLACE_FOR_CHECK_IN[\s\S]*venueId: venue\.id/, "Nearby Places must select from existing canonical venue IDs in deterministic order");
  assert.match(facebookPlacesFlowSource, /type: "CHECK_IN"[\s\S]*new Date\(simulatedNowMs\)\.toISOString\(\)[\s\S]*What are you doing\?[\s\S]*Tag Friends With You/, "venue Check In must expose the period form and submit simulated time");
  assert.match(facebookPlacesFlowSource, /function FacebookPlaceTagFriends[\s\S]*state\.friends\.map/, "Tag Friends must derive only from the current Facebook friends collection");
  assert.match(facebookStateSource, /TOGGLE_PLACE_TAGGED_FRIEND[\s\S]*state\.friends\.some\(friend => friend\.id === event\.friendId\)/, "tag mutations must reject identities outside current Facebook friends");
  assert.doesNotMatch(facebookStateSource, /placeCheckIns|nearbyCheckIns|userPlaceCheckIns/, "Places routing must not introduce a duplicate check-in store");
  assert.match(facebookStateSource, /case "CHECK_IN":[\s\S]*state\.currentView !== "placeCheckIn"[\s\S]*selectedPlaceId !== event\.venueId[\s\S]*feed: \[\.\.\.state\.feed\.filter\(item => item\.id !== "facebook-user-checkin"\)/, "the existing CHECK_IN path must validate canonical selection and replace its stable Feed record once");
  assert.match(facebookStateSource, /export function isFacebookNewsFeedEligible[\s\S]*return isFacebookStoryVisibleToUser\(state, item\);/, "Places must continue through the centralized frozen News Feed eligibility helper");
  assert.match(facebookPlacesFlowSource, /\["activity", "info"\][\s\S]*Here Now[\s\S]*Recent Activity/, "Place Detail must retain Here Now, Recent Activity, and Activity | Info structure");
  assert.doesNotMatch(facebookPlacesFlowSource, /Date\.now|setTimeout|setInterval|deviceEventScheduler|facebook-feed|visibleFeed/i, "Places UI must not couple to wall-clock, scheduler, or News Feed presentation");
  assert.doesNotMatch(`${facebookStateSource}\n${facebookContainerSource}`, /from ["'][^"']*foursquareState|dispatchFoursquare|foursquareStateTransition/, "Facebook Places must not couple to Foursquare state");
  assert.match(deviceCssSource, /\.facebook-places-home \{[^}]*grid-template-rows: auto minmax\(0,1fr\);/, "Places Home must bound its single activity scroll region");
  assert.match(deviceCssSource, /\.facebook-nearby-places \{[^}]*overflow-y: auto;/, "Nearby Places must own one bounded venue-list scroll container");
  assert.match(deviceCssSource, /\.facebook-place-detail-content \{[^}]*overflow-y: auto;/, "Place Detail must own one bounded content scroll container");
  assert.ok(["Timeline", "Mentions", "Messages", "Search", "More"].every(label => twitterContainerSource.includes(`"${label}"`)), "Twitter must expose the five period tab destinations");
  assert.match(twitterContainerSource, /twitter-tweet-action-row/, "Twitter must render the swipe-revealed action row");
  const b2ActionPaneSource = timelineCellSource.match(/revealed && <div className="twitter-tweet-action-row"[\s\S]*?<\/div>/)?.[0] ?? "";
  assert.equal((b2ActionPaneSource.match(/<button\b/g) ?? []).length, 4, "B2 must expose exactly four functional Tweet action buttons");
  assert.equal((b2ActionPaneSource.match(/twitter-tweet-action-hold/g) ?? []).length, 2, "B2 must retain exactly two visually evidenced HOLD slots");
  assert.match(b2ActionPaneSource, /is-reply[\s\S]+aria-label="Reply"[\s\S]+onClick=\{onReply\}/, "B2 Reply icon must reuse the existing Reply callback");
  assert.match(b2ActionPaneSource, /is-retweet[\s\S]+aria-pressed=\{retweeted\}[\s\S]+onClick=\{onRetweet\}/, "B2 Retweet icon must remain driven by existing Retweet state and behavior");
  assert.match(b2ActionPaneSource, /is-favorite[\s\S]+aria-pressed=\{favorite\}[\s\S]+onClick=\{onFavorite\}/, "B2 Favorite icon must remain driven by existing Favorite state and behavior");
  assert.match(b2ActionPaneSource, /is-profile[\s\S]+onClick=\{\(\) => onOpenProfile\(tweet\.authorHandle \|\| tweet\.displayName\)\}/, "B2 Profile icon must reuse the existing Timeline profile route");
  const b2HoldSlotsSource = b2ActionPaneSource.match(/<span className="twitter-tweet-action-hold is-slot5"[\s\S]*?<span className="twitter-tweet-action-hold is-slot6"[\s\S]*?<\/span>/)?.[0] ?? "";
  assert.match(b2HoldSlotsSource, /is-slot5" aria-hidden="true"[\s\S]+is-slot6" aria-hidden="true"/, "both B2 HOLD slots must be hidden from accessibility APIs");
  assert.doesNotMatch(b2HoldSlotsSource, /<button|onClick|aria-label|title=|tabIndex|tabindex/, "B2 HOLD slots must remain nonfunctional, unlabeled, and unfocusable");
  assert.match(timelineCellSource, /favorite && <span className="twitter-favorite-marker" aria-hidden="true" \/>/, "favorited Timeline rows must render only the reconstructed corner marker");
  assert.doesNotMatch(timelineCellSource, /twitter-favorite-marker[^\n>]*>\s*Favorite/, "Timeline rows must not leak a literal Favorite state label");
  assert.match(tweetDetailSource, />\{favorite \? "Favorited" : "Favorite"\}<\/button>/, "Tweet Detail's known textual Favorite HOLD mismatch must remain untouched in B2");
  assert.match(deviceCssSource, /\.twitter-timeline-item\.is-revealed \.twitter-timeline-row \{ transform: translateX\(320px\); \}/, "B2 must reveal the full 320-point pane beneath the displaced Tweet row");
  assert.match(deviceCssSource, /\.twitter-timeline-row \{[^}]*transition: transform 160ms cubic-bezier\(\.25,\.1,\.25,1\);/, "B2 must retain the documented conservative reconstructed reveal timing");
  assert.match(deviceCssSource, /\.twitter-tweet-action-row \{[^}]*grid-area: 1 \/ 1; min-height: 58px;[^}]*grid-template-columns: repeat\(6,minmax\(0,1fr\)\);[^}]*align-self: stretch;/, "B2 pane must share row height with six equal 53.33-point slots and the B1 minimum");
  assert.match(deviceCssSource, /\.twitter-tweet-action-hold \{ pointer-events: none; \}/, "B2 HOLD slots must reject pointer interaction");
  assert.match(deviceCssSource, /\.twitter-tweet-action\.is-favorite\[aria-pressed="true"\] > span \{[^}]*twitter-action-favorite-selected-2010-reconstructed\.svg/, "B2 selected Favorite state must use its filled reconstructed star asset");
  assert.match(deviceCssSource, /\.twitter-favorite-marker \{[^}]*top: 0; right: 0; width: 15px; height: 15px;[^}]*twitter-favorite-corner-2010-reconstructed\.svg/, "B2 favorited Timeline marker must retain the reconstructed 15-point corner geometry");
  assert.match(twitterContainerSource, /import \{ TwitterAvatar \} from "\.\/TwitterAvatar";/, "Twitter surfaces must use the shared avatar renderer");
  assert.doesNotMatch(twitterContainerSource, /fallbackText=|function initials\(/, "production Twitter surfaces must not retain visible generated-initial fallback paths");
  assert.doesNotMatch(twitterAvatarSource, /fallbackText|avatar fixture|DEV-HOLD|>\{[^}]*initial/i, "shared Twitter avatar rendering must not expose prototype fallback language or initials");
  assert.match(twitterAvatarSource, /alt=""[\s\S]*aria-hidden="true"/, "Twitter avatar images must remain decorative when adjacent identity text is present");
  assert.match(twitterContainerSource, /aria-label=\{`Profile image for \$\{profile\.displayName\}`\}/, "Profile fallback accessibility must use neutral identity-aware image wording");
  assert.match(timelineCellSource, /data-row-anatomy-status="RECONSTRUCTED_FROM_PERIOD_SCREENSHOT"/, "Timeline row geometry must retain explicit screenshot-reconstruction provenance");
  assert.match(timelineCellSource, /<TwitterAvatar[\s\S]+className="twitter-profile-link twitter-timeline-avatar"[\s\S]+className="twitter-tweet-copy"[\s\S]+<strong[\s\S]+<time>[\s\S]+<span>\{tweet\.text\}<\/span>/, "Timeline rows must retain avatar, display name, timestamp, and Tweet text anatomy in period order");
  assert.match(deviceCssSource, /\.twitter-timeline-row \{[^}]*min-height: 58px; padding: 5px;[^}]*grid-template-columns: 48px minmax\(0,1fr\); gap: 7px;[^}]*align-items: start;/, "Timeline rows must use the measured x=5 avatar and x=60 text geometry with content-driven height");
  assert.match(deviceCssSource, /\.twitter-avatar-fixture \{ width: 48px; height: 48px;[^}]*border: 1px solid #878787; border-radius: 4px;/, "Timeline avatar fixtures must retain the measured 48-point framed geometry");
  assert.match(deviceCssSource, /\.twitter-tweet-copy strong \{[^}]*font-size: 14px; line-height: 17px;/, "Timeline display names must retain the reconstructed compact period typography");
  assert.match(deviceCssSource, /\.twitter-tweet-copy > span \{[^}]*padding-top: 2px;[^}]*font-size: 14px; line-height: 18px;/, "Timeline Tweet bodies must retain the measured two-line 65-point row rhythm");
  assert.match(deviceCssSource, /\.twitter-tweet-copy time \{[^}]*color: #8a8a8a; font-size: 11px; line-height: 17px;/, "Timeline timestamps must remain compact, light, and top-aligned");
  assert.match(deviceCssSource, /\.twitter-timeline-item \{[^}]*border-bottom: 1px solid #c5c5c5;/, "Timeline rows must retain a restrained full-width one-pixel separator");
  assert.match(twitterMentionsSource, /className=\{`twitter-social-row twitter-mention-row \$\{item\.unread \? "is-unread" : ""\}`\}[\s\S]*onClick=\{\(\) => onOpen\(item\.id, ref\.current\?\.scrollTop \?\? scrollPosition\)\}/, "B3 Mention rows must derive pale-blue presentation from canonical unread state while remaining whole-row Detail controls");
  assert.doesNotMatch(twitterMentionsSource, /View Tweet|twitter-tweet-action-row|twitter-tweet-action is-/, "B3 Mentions must not restore the list CTA or add Timeline-only swipe actions");
  assert.match(twitterMentionsSource, /TwitterAvatar[\s\S]*twitter-mention-copy[\s\S]*<strong>\{tweet\.displayName\}<\/strong>[\s\S]*<small>\{tweet\.timestamp\}<\/small>[\s\S]*twitter-mention-body[^>]*>\{tweet\.text\}/, "B3 Mentions must retain avatar, display name, timestamp, and Tweet body anatomy");
  assert.match(deviceCssSource, /\.twitter-social-row\.twitter-mention-row \{[^}]*min-height: 58px; padding: 5px;[^}]*grid-template-columns: 48px minmax\(0,1fr\); gap: 7px;[^}]*align-items: start;[^}]*border-bottom-color: #c5c5c5;/, "B3 Mentions must use the approved content-driven 58-point minimum, x=5 avatar, x=60 copy origin, and separator");
  assert.match(deviceCssSource, /\.twitter-social-row\.twitter-mention-row\.is-unread \{ background: #edf4fa; \}/, "B3 unread Mentions must retain the approved pale-blue row without changing Tweet-list geometry");
  assert.match(deviceCssSource, /\.twitter-mention-row strong \{[^}]*font-size: 14px;[^}]*line-height: 17px;/, "B3 Mention display names must use 14/17 bold typography");
  assert.match(deviceCssSource, /\.twitter-mention-row small \{[^}]*grid-column: 2; grid-row: 1;[^}]*font-size: 11px; line-height: 17px;/, "B3 Mention timestamps must remain compact and upper-right");
  assert.match(deviceCssSource, /\.twitter-mention-row \.twitter-mention-body \{[^}]*padding-top: 2px;[^}]*font-size: 14px; line-height: 18px;/, "B3 Mention bodies must use the approved 14/18 Tweet typography");
  assert.match(twitterMessagesSource, /className=\{`twitter-social-row twitter-message-row \$\{thread\.unread \? "is-unread" : ""\}`\}[\s\S]*onClick=\{\(\) => onOpen\(thread\.id, ref\.current\?\.scrollTop \?\? scrollPosition\)\}/, "B4a Message rows must remain whole-row controls driven by canonical unread state");
  assert.match(twitterMessagesSource, /TwitterAvatar[\s\S]*twitter-message-copy[\s\S]*twitter-message-sender[^>]*>\{thread\.sender\}[\s\S]*twitter-message-timestamp[^>]*>\{thread\.timestamp\}[\s\S]*twitter-message-preview[^>]*>\{thread\.messages\[thread\.messages\.length - 1\]\?\.text\}/, "B4a Messages must retain avatar, sender, timestamp, and latest-preview anatomy");
  assert.match(deviceCssSource, /\.twitter-social-row \{[^}]*min-height: 62px;[^}]*grid-template-columns: 42px 1fr; gap: 8px; padding: 7px 10px;[^}]*border-bottom: 1px solid #c7c7c7; background: #fff;/, "B4a must preserve the intentional 62-point row, 42-point track/48-point avatar relationship, 7/10 padding, white field, and separator");
  assert.match(deviceCssSource, /\.twitter-social-row\.is-unread \{ background: #edf4fa; \}/, "B4a unread Messages must retain the reconstructed pale-blue field");
  assert.match(deviceCssSource, /\.twitter-message-sender \{ font-size: 15px; font-weight: 700; line-height: 18px; \}/, "B4a Message senders must use deterministic 15/18 bold typography");
  assert.match(deviceCssSource, /\.twitter-message-timestamp \{[^}]*grid-column: 2; grid-row: 1;[^}]*font-size: 11px; font-weight: 400; line-height: 17px;/, "B4a Message timestamps must use deterministic upper-right 11/17 regular typography");
  assert.match(deviceCssSource, /\.twitter-message-preview \{ grid-column: 1 \/ -1; font-size: 13px; font-weight: 400; line-height: 17px; \}/, "B4a Message previews must use deterministic 13/17 regular typography");
  assert.doesNotMatch(deviceCssSource, /\.twitter-message-row\.is-unread[^}]*(?:font-weight|::before|::after)/, "B4a unread rows must not introduce weight changes, dots, or badges");
  assert.equal(createHash("sha256").update(twitterDMThreadSource).digest("hex"), "2ed96e1e645730d649f1572f98a212fd977776a70db4ce328a97b22b97457a7c", "B4a must leave the known-HOLD DM detail renderer source unchanged");
  assert.match(tweetDetailSource, /className="twitter-linked-status"[\s\S]*>View linked Tweet<\/button>/, "B3 must leave the existing Detail-level linked Tweet route and HOLD presentation untouched");
  assert.match(timelineCellSource, /retweetAttribution && <small>\{retweetAttribution\}<\/small>/, "manual Retweets must remain plain wrapped attribution text");
  assert.doesNotMatch(timelineCellSource, /twitter-(?:retweet-card|native-retweet-card|quote-card)/, "Timeline fidelity must not introduce a native Retweet or Quote card");
  assert.doesNotMatch(timelineCellSource, /twitter-tweet-handle/, "Timeline cells must not render a redundant second @handle line");
  assert.match(twitterContainerSource, /Suggested Users/, "Search must expose the period Suggested Users destination");
  assert.match(twitterContainerSource, /label="Suggested Users"\s+variant="suggested-users"/, "C1b-1 must scope its typography correction to Suggested Users rather than the shared Following list");
  assert.match(deviceCssSource, /\.twitter-people-list\.is-suggested-users \.twitter-person-copy strong \{ font-size: 16px; font-weight: 700; line-height: 19px; \}/, "C1b-1 Suggested Users display names must use reconstructed 16/19 bold typography");
  assert.match(deviceCssSource, /\.twitter-people-list\.is-suggested-users \.twitter-follow-button \{[^}]*width: 58px; min-width: 58px; height: 27px;[^}]*color: #fff;[^}]*border: 1px solid #246486;[^}]*border-radius: 5px;[^}]*background: linear-gradient\(#68acd2[^}]*font-size: 10px; font-weight: 700; line-height: 12px;/, "Suggested Users FOLLOW must use its scoped reconstructed blue 58-by-27 control with compact white typography");
  assert.match(deviceCssSource, /\.twitter-people-list\.is-suggested-users \.twitter-follow-button\[aria-pressed="true"\] \{ width: 74px; min-width: 74px; color: #fff; \}/, "Suggested Users UNFOLLOW must retain the same blue family with a label-driven 74px width and white text");
  assert.match(deviceCssSource, /\.twitter-person-row > \.twitter-follow-button \{ position: absolute; right: 8px; top: 18px; min-width: 66px; \}/, "Suggested Users material pass must preserve shared row placement and Following-list geometry");
  assert.match(deviceCssSource, /\.twitter-profile-control button,\.twitter-follow-button \{ height: 27px; padding: 0 8px; color: #286d91; border: 1px solid #999;/, "Suggested Users material pass must leave the shared Profile and Following Follow-control rule unchanged");
  assert.match(twitterContainerSource, /className="twitter-follow-button" aria-pressed=\{user\.following\} onClick=\{\(\) => onToggleFollow\(user\.id\)\}[\s\S]*\{user\.following \? "UNFOLLOW" : "FOLLOW"\}/, "Suggested Users Follow controls must retain existing labels, callback, and graph semantics");
  assert.match(deviceCssSource, /\.twitter-person-copy small \{ color: #777; font-size: 10px; line-height: 13px; \}[\s\S]*\.twitter-person-copy > span \{[^}]*font-size: 11px; line-height: 14px;/, "C1b-1 must preserve the HOLD handle and project-curated subtitle metrics");
  assert.match(twitterContainerSource, /function TwitterMoreLanding[\s\S]*className="twitter-more-landing"[\s\S]*>My Profile<\/button>/, "C3a More root must expose only the canonical My Profile row");
  assert.doesNotMatch(twitterContainerSource.match(/function TwitterMoreLanding[\s\S]*?\n\}/)?.[0] ?? "", /Favorites|Drafts|Lists|Accounts & Settings|Go to User|Settings|Help|About/, "C3a More root must not add unresolved historical rows");
  assert.match(twitterContainerSource, /originView: "more"/, "C3a More must open the canonical Profile with an explicit More origin");
  assert.match(deviceCssSource, /\.twitter-more-landing > button \{[^}]*height: 44px;[^}]*padding: 0 34px 0 15px;[^}]*border-bottom: 1px solid #b8b8b8;[^}]*font-size: 17px;[^}]*line-height: 20px;/, "C3a More row must retain the reconstructed 44-point period table geometry");
  assert.doesNotMatch(twitterProfileSource, /✓ verified|Session owner profile\.|Account counts are session-local CURATED values\.|Public figure timeline \(partial profile metadata\)\./, "C2a Profile must not expose verification text or project/provenance explanations");
  assert.match(twitterContainerSource, /profileBio=\{state\.suggestedUsers\.some\(user => user\.id === selectedProfile\.id\) \|\| selectedProfile\.statsHold \? undefined : selectedProfile\.bio\}/, "C2a must not reinterpret Suggested Users category copy or public-figure provenance copy as Profile biography");
  assert.match(twitterProfileSource, /const bio = sessionOwner \? undefined : profileBio;[\s\S]*const location = sessionOwner \? undefined : profile\.location;[\s\S]*const web = sessionOwner \? undefined : profile\.web;/, "C2a owner Profile must omit noncanonical fallback metadata without altering the underlying record");
  assert.match(twitterProfileSource, /bio && <div className="twitter-profile-metadata-row is-bio">[\s\S]*location && <div className="twitter-profile-metadata-row is-location">[\s\S]*web && <div className="twitter-profile-metadata-row is-web">/, "C2a grouped metadata must render only rows backed by available Profile values");
  assert.doesNotMatch(twitterProfileSource, /twitter-profile-verified|>location<|>web</, "C2a must omit the unresolved badge and avoid unsupported metadata labels");
  assert.deepEqual(
    [twitter.getTwitterUserProfile("session-owner", "Zoey").bio, twitter.getTwitterUserProfile("session-owner", "Zoey").location],
    ["Session owner profile.", "United States"],
    "C2a must preserve underlying owner data while suppressing noncanonical fallback metadata in presentation",
  );
  assert.equal(twitter.getTwitterUserProfile("Kanye West", "Zoey").verified, true, "C2a must preserve underlying verified account data while holding visible badge presentation");
  assert.deepEqual(
    [twitter.getTwitterUserProfile("June", "Zoey").followingCount, twitter.getTwitterUserProfile("June", "Zoey").tweetCount, twitter.getTwitterUserProfile("June", "Zoey").followerCount, twitter.getTwitterUserProfile("June", "Zoey").favoriteCount],
    [84, 814, 220, 96],
    "C2a must leave canonical Profile statistic values unchanged",
  );
  assert.match(deviceCssSource, /\.twitter-profile-view \{[^}]*padding: 0;[^}]*repeating-linear-gradient\(90deg,#e9ebec 0,#e9ebec 1px,#eff0f1 1px,#eff0f1 3px\);/, "C2a Profile content must use the scoped restrained vertical pinstripe material");
  assert.match(deviceCssSource, /\.twitter-profile-header \{ height: 74px; padding: 13px 12px;[^}]*grid-template-columns: 48px minmax\(0,1fr\); gap: 10px;/, "C2a identity must place the 48-point avatar at x=12/y=13 and text at x=70");
  assert.match(deviceCssSource, /\.twitter-profile-header h2 \{[^}]*font-size: 17px; font-weight: 700; line-height: 20px;/, "C2a Profile display name must use reconstructed 17/20 bold typography");
  assert.match(deviceCssSource, /\.twitter-profile-handle \{ font-size: 14px; line-height: 17px; \}/, "C2a Profile handle must use reconstructed subdued 14/17 typography");
  assert.match(deviceCssSource, /\.twitter-profile-metadata \{ width: 300px; margin: 9px 9px 0;[^}]*border: 1px solid #afb3b6; border-radius: 7px;/, "C2a metadata must use the reconstructed 300-point grouped period container");
  assert.match(deviceCssSource, /\.twitter-profile-metadata-row \{ min-height: 44px;[^}]*border-bottom: 1px solid #c9ccce;[\s\S]*?\.twitter-profile-metadata-row\.is-bio \{ min-height: 56px;/, "C2a metadata rows must retain reconstructed 44-point detail and 56-point biography minima");
  assert.match(deviceCssSource, /\.twitter-profile-stats \{ width: 300px; height: 90px; margin: 9px 9px 0;[^}]*grid-template-columns: repeat\(2, minmax\(0,1fr\)\); grid-template-rows: repeat\(2,minmax\(0,1fr\)\);/, "C2a Profile stats must use the reconstructed 300-by-90 two-by-two geometry");
  assert.match(deviceCssSource, /\.twitter-profile-stats strong \{[^}]*font-size: 21px; font-weight: 700; line-height: 23px;[^}]*\}[\s\S]*?\.twitter-profile-stats span \{[^}]*color: #36779c; font-size: 12px;[^}]*line-height: 14px;/, "C2a statistics must use reconstructed 21/23 number and 12/14 label typography");
  assert.match(deviceCssSource, /\.twitter-profile-control button,\.twitter-follow-button \{ height: 27px; padding: 0 8px;/, "C2a must leave the existing Follow control geometry unchanged for C2b");
  assert.match(twitterContainerSource, /state\.currentView === "profileFollowing"[\s\S]*BACK_FROM_PROFILE_FOLLOWING[\s\S]*>Profile<\/button>[\s\S]*<strong>Following<\/strong>/, "C2b-2 Profile Following must use the existing Back silhouette with reconstructed Profile wording and a Following title");
  assert.match(twitterContainerSource, /state\.currentView === "profileFollowing" && state\.selectedUserId === "session-owner"[\s\S]*label="Following"[\s\S]*users=\{followingPeople\}/, "C2b-2 must mount the truthful Following collection only for the selected session owner");
  assert.match(twitterContainerSource, /const followingPeople = selectTwitterFollowingUsers\(state, sessionIdentity\.name\)\.map\(user => \(\{[\s\S]*subtitle: "",/, "C2b-2 Following rows must omit Suggested Users category and generic placeholder subtitles");
  assert.match(twitterProfileSource, /<button type="button" disabled=\{!sessionOwner\} onClick=\{sessionOwner \? onOpenFollowing : undefined\}>/, "C2b-2 Following statistics must remain interactive only for the session owner");
  assert.doesNotMatch(twitterContainerSource, /profileFollowing[\s\S]{0,500}No accounts followed\./, "C2b-2 owner Following must not expose unsupported empty-state copy");
  assert.match(twitterContainerSource, /UNFOLLOW/, "Suggested Users and Profile must expose period-style Follow terminology");
  assert.match(twitterContainerSource, /toLocaleString\("en-US"/, "Twitter profile counts must use full en-US integer grouping");
  assert.match(deviceCssSource, /\.twitter-profile-stats \{[^}]*grid-template-columns: repeat\(2,/, "Twitter Profile stats must use a 2-column grid");
  assert.match(deviceCssSource, /\.twitter-container \{[^}]*display: grid;[^}]*grid-template-rows: 44px minmax\(0,1fr\) 43px;/, "Twitter shell must reserve the measured 44/373/43 header/content/footer grid");
  assert.match(deviceCssSource, /\.twitter-container > nav \{ grid-row: 3; \}/, "Twitter tab bar must remain in the fixed third shell row");
  assert.match(deviceCssSource, /\.twitter-tab-bar \{[^}]*height: 43px;[^}]*grid-template-columns: repeat\(5,64px\);/, "Twitter must retain five fixed icon-only 64-point tab slots in a 43-point body");
  assert.match(deviceCssSource, /\.twitter-tab-bar button\[aria-current="page"\]::before \{[^}]*top: -7px;[^}]*width: 14px; height: 7px;/, "Twitter selected tabs must retain the conservative six-to-seven-point upper pointer");
  assert.match(twitterContainerSource, /<span className="twitter-tab-icon" aria-hidden="true" \/>/, "Twitter tabs must render reconstructed icon artwork instead of visible text labels");
  assert.equal(twitterChromeSources.every(source => source.includes("RECONSTRUCTED_FROM_PERIOD_SCREENSHOT")), true, "every Twitter chrome asset must retain explicit screenshot-reconstruction provenance");
  assert.match(deviceCssSource, /\.twitter-account-button \{ left: 5px; width: 75px;/, "Twitter Accounts must retain the measured 75-point navigation frame");
  assert.match(deviceCssSource, /\.twitter-compose-button \{ right: 5px; width: 34px;/, "Twitter Compose must retain the measured 34-point icon-control frame");
  assert.match(deviceCssSource, /\.twitter-back-button \{ left: 5px; min-width: 70px;[^}]*twitter-back-control-2010-reconstructed\.svg/, "Twitter Back controls must use the local reconstructed chevron material");
  assert.match(twitterContainerSource, /\{state\.currentView === "composer" && <>/, "Twitter Composer navigation must mount from the active view regardless of originating tab");
  assert.match(twitterContainerSource, /\{state\.currentView === "composer" && <TwitterComposer/, "Twitter Composer content must mount from the active view regardless of originating tab");
  assert.doesNotMatch(twitterContainerSource, /state\.activeTab === "timeline" && state\.currentView === "composer"/, "Twitter Composer rendering must not regress to Timeline-only gating");
  assert.match(deviceCssSource, /\.twitter-social-list \{ position: relative; inset: auto; overflow-y: auto;/, "Mentions and Messages must scroll inside the bounded content row");
  assert.match(twitterContainerSource, /selectTwitterMentionsUnreadCount\(state\)/, "Mentions tab indicator must derive from unread records");
  assert.match(twitterContainerSource, /selectTwitterDirectMessagesUnreadCount\(state\)/, "Messages tab indicator must derive from unread records");
  assert.match(deviceCssSource, /\.twitter-tab-unread-indicator \{[^}]*left: 50%; bottom: 2px; width: 13px; height: 4px;[^}]*radial-gradient\(ellipse,#70e9ff/, "Twitter unread treatment must remain an icon-associated electric-blue dock indicator");
  const profileStatsSource = twitterContainerSource.match(/<section className="twitter-profile-stats"[\s\S]*?<\/section>/)?.[0] ?? "";
  assert.ok(
    profileStatsSource.indexOf("following") < profileStatsSource.indexOf("tweets")
      && profileStatsSource.indexOf("tweets") < profileStatsSource.indexOf("followers")
      && profileStatsSource.indexOf("followers") < profileStatsSource.indexOf("favorites"),
    "Twitter Profile stats order must be following/tweets then followers/favorites",
  );
  assert.doesNotMatch(twitterContainerSource, /twitter-composer-identity/, "New Tweet must not use the rejected large avatar/name composer row");
  assert.match(twitterContainerSource, /twitter-new-tweet-title[\s\S]*<strong>New Tweet<\/strong>[\s\S]*twitterReplyHandle\(sessionIdentity\.name \|\| "owner"\)/, "D1 New Tweet must place its title and session-derived handle together inside the Compose navigation bar");
  assert.match(twitterContainerSource, /\{replyTarget && <div className="twitter-composer-account">/, "D1 must preserve the existing Reply recipient context without retaining a standalone New Tweet account strip");
  assert.match(deviceCssSource, /\.twitter-new-tweet-title \{[^}]*top: 5px;[^}]*grid-template-rows: 19px 12px;/, "D1 New Tweet title stack must retain reconstructed 17\/19 and 10\/12 navigation geometry");
  assert.match(deviceCssSource, /\.twitter-new-tweet-title > strong \{[^}]*font-size: 17px; font-weight: 700; line-height: 19px;/, "D1 New Tweet title must use reconstructed 17\/19 bold typography");
  assert.match(deviceCssSource, /\.twitter-new-tweet-title > small \{[^}]*font-size: 10px; font-weight: 400; line-height: 12px;/, "D1 New Tweet handle must use reconstructed 10\/12 subdued typography");
  assert.match(deviceCssSource, /\.twitter-new-tweet-navigation \.twitter-close-button \{ left: 5px; width: 50px;[^}]*\}/, "D1 Close must use its deterministic reconstructed 50-by-30 Compose frame");
  assert.match(deviceCssSource, /\.twitter-new-tweet-navigation \.twitter-send-button \{ right: 5px; width: 48px;[^}]*\}/, "D1 Send must use its deterministic reconstructed 48-by-30 Compose frame");
  assert.match(deviceCssSource, /\.twitter-composer \{[^}]*grid-row: 2 \/ 4;/, "D1 Compose must span the hidden tab row so the white field and frozen lower controls retain their historical vertical bounds");
  assert.match(twitterContainerSource, /<span className="twitter-attachments-capsule" aria-hidden="true">[\s\S]*twitter-attachments-paperclip[\s\S]*<span>attachments<\/span>[\s\S]*twitter-attachments-disclosure/, "D2 must expose a count-neutral inert attachments capsule with reconstructed period artwork");
  assert.doesNotMatch(twitterContainerSource, /attachments \((?:0|3|\.\.\.)\)/, "D2 must not fabricate attachment count state");
  assert.doesNotMatch(twitterContainerSource, /twitter-attachments-capsule[^>]*onClick|<button[^>]*twitter-attachments-capsule/, "D2 unsupported attachment control must remain non-interactive and unfocusable");
  assert.match(twitterContainerSource, /twitter-character-count" aria-label=\{`\$\{140 - value\.length\} characters remaining`\}>\{140 - value\.length\}/, "D2 counter must preserve the existing remaining UTF-16 code-unit calculation");
  assert.match(deviceCssSource, /\.twitter-attachments-capsule \{[^}]*width: 148px; height: 26px;[^}]*border-radius: 13px;/, "D2 attachments capsule must retain reconstructed native-scale geometry");
  assert.match(deviceCssSource, /\.twitter-character-count \{[^}]*width: 52px; height: 26px;[^}]*font-size: 13px; font-weight: 700; line-height: 16px;/, "D2 counter must retain reconstructed capsule geometry and compact typography");
  assert.match(deviceCssSource, /\.twitter-character-count::before \{[^}]*border-right: 5px solid #dce5ea;/, "D2 counter detail must remain decorative filled artwork without behavior");
  assert.match(twitterContainerSource, /<div className="twitter-composer-tools"[\s\S]*is-camera[\s\S]*Camera[\s\S]*is-photo-library[\s\S]*Photo Library[\s\S]*is-geotag[\s\S]*Geotag[\s\S]*is-usernames[\s\S]*Usernames[\s\S]*is-hashtags[\s\S]*Hashtags[\s\S]*is-shrink-urls[\s\S]*Shrink URLs/, "D3 must preserve the confirmed six-tool order");
  assert.equal((twitterContainerSource.match(/<img src=\{composeTool(?:Camera|PhotoLibrary|Geotag|Usernames|Hashtags|ShrinkUrls)Src\} alt="" \/>/g) ?? []).length, 6, "D3 must render all six reconstructed tool assets through deterministic direct SVG images");
  assert.deepEqual([...twitterContainerSource.matchAll(/<button[^>]*className="twitter-compose-tool is-([\w-]+)"/g)].map(match => match[1]), ["camera", "photo-library"], "only the approved shared-media tools may become interactive");
  assert.match(twitterContainerSource, /is-camera" onClick=\{\(\) => onRequestMedia\("camera"\)\}/, "Twitter Camera must request the shared Camera source");
  assert.match(twitterContainerSource, /is-photo-library" onClick=\{\(\) => onRequestMedia\("library"\)\}/, "Twitter Photos must request the shared library source");
  assert.match(deviceCssSource, /\.twitter-composer-tools \{[^}]*width: 320px; height: 92px;[^}]*grid-template-columns: repeat\(3,1fr\); grid-template-rows: repeat\(2,46px\);/, "D3 panel must retain the locked 320-by-92 three-by-two geometry");
  assert.match(deviceCssSource, /\.twitter-compose-tool \{[^}]*grid-template-rows: 31px 13px;[^}]*color: #e4e9eb;[^}]*font-size: 11px; font-weight: 500; line-height: 13px;/, "D3.1 icons and labels must retain reconstructed native-scale alignment and brighter typography");
  assert.match(deviceCssSource, /\.twitter-compose-tool\.is-camera > img \{ width: 28px; height: 21px; \}[\s\S]*\.twitter-compose-tool\.is-photo-library > img \{ width: 30px; height: 24px; \}[\s\S]*\.twitter-compose-tool\.is-geotag > img \{ width: 25px; height: 27px; \}[\s\S]*\.twitter-compose-tool\.is-usernames > img \{ width: 29px; height: 27px; \}[\s\S]*\.twitter-compose-tool\.is-hashtags > img \{ width: 28px; height: 27px; \}[\s\S]*\.twitter-compose-tool\.is-shrink-urls > img \{ width: 30px; height: 24px; \}/, "D3.1 must preserve independently measured icon bounds rather than one universal scale");
  assert.doesNotMatch(deviceCssSource, /\.twitter-compose-tool[^}]*\b(?:-webkit-)?mask(?:-image)?\s*:|\.twitter-compose-tool[^}]*\bfilter\s*:/, "D3 tool icons must not depend on CSS masks or filter-based recoloring");
  assert.match(deviceCssSource, /radial-gradient\(circle,rgba\(255,255,255,\.035\)[^}]*2px 2px[\s\S]*radial-gradient\(circle,rgba\(0,0,0,\.035\)[^}]*2px 2px/, "D3.1 panel must use deterministic fine micro-dot texture without vertical stripe bands");
  assert.match(deviceCssSource, /\.twitter-compose-tool:not\(:nth-child\(3n\)\)[^}]*border-right: 1px solid rgba\(20,36,46,\.16\);[\s\S]*\.twitter-compose-tool:nth-child\(-n\+3\)[^}]*border-bottom: 1px solid rgba\(20,36,46,\.18\);/, "D3.1 separators must remain low-contrast shared-panel dividers rather than boxed cards");
  assert.doesNotMatch(twitterContainerSource, /Quote Tweet|Explore|Spaces|Notifications/, "Twitter IA must not introduce later navigation/features");
  assert.ok(Object.isFrozen(seed) && Object.isFrozen(seed.messages) && Object.isFrozen(seed.twitter), "seed definitions must remain immutable");

  // T0-M1 validates runtime-derived values only. Static narrative seeds remain
  // intentionally outside this block until T0-M2.
  const readSource = relativePath => readFile(resolve(projectRoot, relativePath), "utf8");
  const canonicalVenueGeographySource = await readSource("src/data/canonicalVenueGeography.ts");
  const canonicalMapGeometrySource = await readSource("src/data/canonicalMapGeometry.ts");
  const shared2010MapSource = await readSource("src/device/Shared2010Map.tsx");
  const foursquareMapOverlaySource = await readSource("src/device/FoursquareMapOverlay.tsx");
  const facebookMapOverlaySource = await readSource("src/device/FacebookMapOverlay.tsx");
  const facebookContainerSourceForGeography = await readSource("src/device/FacebookContainer.tsx");
  const foursquareTodosSource = await readSource("src/data/foursquareTodos.ts");
  const foursquareStateSourceForTodos = await readSource("src/state/foursquareState.ts");
  const foursquareContainerSourceForTodos = await readSource("src/device/FoursquareContainer.tsx");
  const deviceCssSourceForTodos = await readSource("src/styles/device.css");
  const expectedCanonicalVenueGeography = {
    "downtown-coffee": { xMiles: 0.15, yMiles: 0.15 },
    "community-courts": { xMiles: -0.75, yMiles: -0.55 },
    "main-street-diner": { xMiles: 0.45, yMiles: 0.10 },
    "riverside-park": { xMiles: -0.50, yMiles: 0.10 },
    "westside-library": { xMiles: -0.90, yMiles: 0.90 },
    "gelato-roma": { xMiles: 0.80, yMiles: -0.60 },
  };
  const canonicalGeographyIds = Object.keys(canonicalVenueGeography.CANONICAL_VENUE_GEOGRAPHY).sort();
  const canonicalVenueIds = Object.keys(canonicalVenues.CANONICAL_VENUES).sort();
  assert.equal(canonicalVenueGeography.SM2010_GEOGRAPHY_VERSION, "sm2010-la-local-v1", "F7b geography version must remain explicit and exact");
  assert.deepEqual(canonicalGeographyIds, canonicalVenueIds, "F7b geography must contain six and only six canonical venue IDs");
  assert.equal(canonicalGeographyIds.length, 6, "F7b geography must contain exactly six venue records");
  assert.deepEqual(canonicalVenueGeography.SM2010_SESSION_PLAYER_MAP_POINT, { xMiles: 0, yMiles: 0 }, "F7b player point must remain the neutral session origin");
  assert.deepEqual(canonicalVenueGeography.SM2010_LOCAL_MAP_BOUNDS, { minXMiles: -1, maxXMiles: 1, minYMiles: -1, maxYMiles: 1 }, "F7b local map extent must remain the approved two-mile square");
  for (const venueId of canonicalVenueIds) {
    const record = canonicalVenueGeography.CANONICAL_VENUE_GEOGRAPHY[venueId];
    assert.deepEqual(record.point, expectedCanonicalVenueGeography[venueId], `F7b ${venueId} coordinates must remain exact`);
    assert.equal(record.venueId, venueId, `F7b ${venueId} geography must preserve canonical identity`);
    assert.equal(record.classification, "PROJECT-CURATED-FICTION", `F7b ${venueId} geography must retain project-fiction classification`);
    assert.equal(Number.isFinite(record.point.xMiles) && Number.isFinite(record.point.yMiles), true, `F7b ${venueId} coordinates must be finite`);
    assert.equal(record.point.xMiles >= -1 && record.point.xMiles <= 1 && record.point.yMiles >= -1 && record.point.yMiles <= 1, true, `F7b ${venueId} must remain inside the approved local extent`);
  }
  assert.deepEqual(
    canonicalVenueGeography.getCanonicalVenuesByDistanceFromPlayer().map(record => record.venueId),
    ["downtown-coffee", "main-street-diner", "riverside-park", "community-courts", "gelato-roma", "westside-library"],
    "F7b nearby sorting must follow raw player distance with canonical ID tie-breaking",
  );
  const expectedPlayerDistances = {
    "downtown-coffee": 0.212,
    "main-street-diner": 0.461,
    "riverside-park": 0.510,
    "community-courts": 0.930,
    "gelato-roma": 1.000,
    "westside-library": 1.273,
  };
  for (const [venueId, expectedDistance] of Object.entries(expectedPlayerDistances)) {
    const actualDistance = canonicalVenueGeography.getCanonicalVenueDistanceFromPlayer(venueId);
    assert.equal(Math.abs(actualDistance - expectedDistance) < 0.001, true, `F7b ${venueId} player distance must remain approximately ${expectedDistance} miles`);
  }
  assert.equal(canonicalVenueGeography.hasCanonicalVenueGeography("night-owl"), false, "F7b Night Owl must remain legacy and map-ineligible");
  assert.equal(canonicalVenueGeography.hasCanonicalVenueGeography("cedar-books"), false, "F7b Cedar Books must remain legacy and map-ineligible");
  assert.doesNotMatch(canonicalVenueGeographySource, /214 4th Street|38 Market Street|91 Cedar Avenue|Riverside Drive/, "F7b shared geography must not migrate legacy addresses");
  assert.doesNotMatch(canonicalVenueGeographySource, /0\.[2357] mi/, "F7b shared geography must not consume legacy Foursquare distance strings");
  assert.doesNotMatch(canonicalVenueGeographySource, /Night Owl Cafe|Cedar Books|Downtown Coffee|Community Courts|Main Street Diner|Riverside Park|Westside Library|Gelato Roma/, "F7b geography must not duplicate venue display names");
  assert.doesNotMatch(canonicalVenueGeographySource, /navigator\.geolocation|Date\.now\s*\(|Math\.random\s*\(/, "F7b geography must not use browser location, host time, or randomness");
  assert.doesNotMatch(`${foursquareContainerSourceForTodos}\n${facebookContainerSourceForGeography}`, /canonicalVenueGeography/, "F7b shared geography must remain disconnected from visible app UI");
  assert.match(shared2010MapSource, /canonicalVenueGeography/, "F7c renderer must consume the shared canonical geography contract");
  assert.doesNotMatch(`${canonicalMapGeometrySource}\n${shared2010MapSource}`, /sessionSeedContent|foursquareContent|navigator\.geolocation|Date\.now\s*\(|Math\.random\s*\(/, "F7c renderer must not consume legacy session geography, browser location, host time, or randomness");
  assert.equal(canonicalMapGeometry.SM2010_CANONICAL_MAP_ROADS.filter(road => road.kind === "primary").length, 2, "F7c map must retain exactly two authored primary roads");
  assert.equal(canonicalMapGeometry.SM2010_CANONICAL_MAP_ROADS.filter(road => road.kind === "local").length >= 4, true, "F7c map must retain several authored local roads");
  assert.equal(canonicalMapGeometry.SM2010_CANONICAL_MAP_BLOCKS.length >= 4, true, "F7c map must retain a sparse authored block field");
  assert.equal(shared2010Map.isLocalMapPointInRegion(canonicalVenueGeography.CANONICAL_VENUE_GEOGRAPHY["riverside-park"].point, canonicalMapGeometry.SM2010_RIVERSIDE_PARK_REGION), true, "F7c Riverside Park geography must contain its canonical venue point");
  assert.equal([...canonicalMapGeometry.SM2010_CANONICAL_MAP_ROADS, ...canonicalMapGeometry.SM2010_CANONICAL_MAP_BLOCKS, canonicalMapGeometry.SM2010_RIVERSIDE_PARK_REGION].every(feature => feature.points.every(point => Number.isFinite(point.xMiles) && Number.isFinite(point.yMiles))), true, "F7c authored geometry must remain finite local-map coordinates");
  const playerNearbyViewport = shared2010Map.resolveMapViewport({ mode: "PLAYER_NEARBY" });
  assert.ok(playerNearbyViewport, "F7c PLAYER_NEARBY must always resolve");
  assert.equal(canonicalVenueIds.every(venueId => shared2010Map.isPointInsideViewport(canonicalVenueGeography.CANONICAL_VENUE_GEOGRAPHY[venueId].point, playerNearbyViewport)), true, "F7c PLAYER_NEARBY must include all six canonical venues");
  const northernProjection = shared2010Map.projectLocalMapPoint({ xMiles: 0, yMiles: 0.5 }, playerNearbyViewport, 320, 200);
  const southernProjection = shared2010Map.projectLocalMapPoint({ xMiles: 0, yMiles: -0.5 }, playerNearbyViewport, 320, 200);
  assert.equal(northernProjection.y < southernProjection.y, true, "F7c projection must invert local Y so north renders upward");
  assert.deepEqual(shared2010Map.projectLocalMapPoint(canonicalVenueGeography.SM2010_SESSION_PLAYER_MAP_POINT, playerNearbyViewport, 320, 200), { x: 160, y: 100 }, "F7c player must project consistently in a 320 by 200 viewport");
  assert.deepEqual(shared2010Map.projectLocalMapPoint(canonicalVenueGeography.SM2010_SESSION_PLAYER_MAP_POINT, playerNearbyViewport, 320, 240), { x: 160, y: 120 }, "F7c player must project consistently in a 320 by 240 viewport");
  for (const venueId of canonicalVenueIds) {
    const detailViewport = shared2010Map.resolveMapViewport({ mode: "VENUE_DETAIL", venueId });
    assert.ok(detailViewport, `F7c VENUE_DETAIL must resolve ${venueId}`);
    const venuePoint = canonicalVenueGeography.CANONICAL_VENUE_GEOGRAPHY[venueId].point;
    assert.equal(Math.abs((detailViewport.bounds.minXMiles + detailViewport.bounds.maxXMiles) / 2 - venuePoint.xMiles) < 1e-9, true, `F7c ${venueId} detail viewport must center on the venue X coordinate`);
    assert.equal(Math.abs((detailViewport.bounds.minYMiles + detailViewport.bounds.maxYMiles) / 2 - venuePoint.yMiles) < 1e-9, true, `F7c ${venueId} detail viewport must center on the venue Y coordinate`);
    for (const [width, height] of [[320, 200], [320, 240]]) {
      const projected = shared2010Map.getProjectedVenuePoint(venueId, detailViewport, width, height);
      assert.equal(Number.isFinite(projected.x) && Number.isFinite(projected.y), true, `F7c ${venueId} detail projection must remain finite at ${width} by ${height}`);
    }
  }
  assert.equal(shared2010Map.resolveMapViewport({ mode: "VENUE_DETAIL", venueId: "night-owl" }), null, "F7c Night Owl must not resolve a canonical detail viewport");
  assert.equal(shared2010Map.resolveMapViewport({ mode: "VENUE_DETAIL", venueId: "cedar-books" }), null, "F7c Cedar Books must not resolve a canonical detail viewport");
  assert.equal(shared2010Map.getProjectedVenuePoint("night-owl", playerNearbyViewport, 320, 200), null, "F7c Night Owl must not resolve a canonical marker");
  assert.equal(shared2010Map.getProjectedVenuePoint("cedar-books", playerNearbyViewport, 320, 200), null, "F7c Cedar Books must not resolve a canonical marker");
  assert.equal(shared2010Map.resolveMapViewport({ mode: "MULTI_VENUE", venueIds: [] }), null, "F7c empty MULTI_VENUE input must resolve explicitly to null");
  const singleVenueViewport = shared2010Map.resolveMapViewport({ mode: "MULTI_VENUE", venueIds: ["downtown-coffee"] });
  assert.ok(singleVenueViewport && singleVenueViewport.bounds.maxXMiles > singleVenueViewport.bounds.minXMiles && singleVenueViewport.bounds.maxYMiles > singleVenueViewport.bounds.minYMiles, "F7c single-point MULTI_VENUE must retain a finite nonzero span");
  const requestedMultiVenueIds = ["westside-library", "gelato-roma", "community-courts"];
  const multiVenueViewport = shared2010Map.resolveMapViewport({ mode: "MULTI_VENUE", venueIds: requestedMultiVenueIds });
  assert.ok(multiVenueViewport, "F7c eligible MULTI_VENUE input must resolve");
  assert.equal(requestedMultiVenueIds.every(venueId => shared2010Map.isPointInsideViewport(canonicalVenueGeography.CANONICAL_VENUE_GEOGRAPHY[venueId].point, multiVenueViewport)), true, "F7c MULTI_VENUE bounds must include every requested venue");
  assert.equal([[320, 200], [320, 240]].every(([width, height]) => canonicalVenueIds.every(venueId => {
    const projected = shared2010Map.getProjectedVenuePoint(venueId, playerNearbyViewport, width, height);
    return Number.isFinite(projected.x) && Number.isFinite(projected.y);
  })), true, "F7c rectangular projections must remain finite for all canonical venues");
  assert.doesNotMatch(`${canonicalMapGeometrySource}\n${shared2010MapSource}`, /fetch\s*\(|axios|https?:\/\/|Google Maps|Mapbox|Apple Maps|facebookMode|foursquareMode|#3b5998|#3b5999|#1769ff/i, "F7c shared renderer must contain no provider dependency, network call, app mode, or app-specific color");
  assert.doesNotMatch(canonicalMapGeometrySource, /(?:x|y|left|top)(?:Px|Pixels)|streetName|roadName/, "F7c road and park geometry must remain unnamed local-map coordinates rather than screen pixels");
  assert.doesNotMatch(`${foursquareContainerSourceForTodos}\n${facebookContainerSourceForGeography}`, /Shared2010Map|canonicalMapGeometry/, "F7c renderer must remain disconnected from Facebook and Foursquare UI");
  assert.ok(foursquareMapOverlay.FoursquareMapOverlay({ venueId: "main-street-diner" }), "F7d-1 Main Street Diner must resolve a Foursquare Venue Info map");
  assert.ok(foursquareMapOverlay.FoursquareMapOverlay({ venueId: "riverside-park" }), "F7d-1 Riverside Park must resolve a Foursquare Venue Info map");
  assert.equal(foursquareMapOverlay.FoursquareMapOverlay({ venueId: "night-owl" }), null, "F7d-1 Night Owl must remain map-ineligible");
  assert.equal(foursquareMapOverlay.FoursquareMapOverlay({ venueId: "cedar-books" }), null, "F7d-1 Cedar Books must remain map-ineligible");
  assert.match(foursquareMapOverlaySource, /resolveMapViewport\(\{ mode: "VENUE_DETAIL", venueId \}\)/, "F7d-1 overlay must use the canonical VENUE_DETAIL viewport");
  assert.match(foursquareMapOverlaySource, /<Shared2010Map[\s\S]*venueIds=\{\[\]\}/, "F7d-1 overlay must compose Shared2010Map without exposing neutral QA venue markers");
  assert.match(foursquareMapOverlaySource, /foursquare-venue-map-pin[\s\S]*<path[\s\S]*<circle/, "F7d-1 must provide one minimal Foursquare-specific reconstructed pin");
  assert.doesNotMatch(foursquareMapOverlaySource, /showPlayer|distance|address|label|callout|onClick|button|fetch\s*\(|navigator\.geolocation|Date\.now|Math\.random/i, "F7d-1 map must expose no player, distance, address, label, callout, interaction, network, location, host-time, or random behavior");
  const f7dVenueInfoSource = foursquareContainerSourceForTodos.match(/\{state\.venueSubview === "info" && <section className="foursquare-venue-info"[\s\S]*?<FoursquareMapOverlay venueId=\{venue\.id\} \/>[\s\S]*?<\/section>\}/)?.[0] ?? "";
  assert.match(f7dVenueInfoSource, /<FoursquareMapOverlay venueId=\{venue\.id\} \/>/, "F7d-1 map must exist only inside the current Venue Info branch");
  assert.equal((foursquareContainerSourceForTodos.match(/<FoursquareMapOverlay/g) ?? []).length, 1, "F7d-1 Foursquare UI must mount exactly one map integration point");
  const f7dNonInfoSource = foursquareContainerSourceForTodos.replace(f7dVenueInfoSource, "");
  assert.doesNotMatch(f7dNonInfoSource, /<FoursquareMapOverlay/, "F7d-1 must add no Places, Check-in, To-Dos, Tips, Friends, or Result map");
  assert.doesNotMatch(foursquareContainerSourceForTodos, /mapList|mapMode|SHOW_MAP|PLAYER_NEARBY|TODO_MAP|TIPS_MAP|MULTI_VENUE/, "F7d-1 must add no map/list, Places, To-Dos, Tips, or Friends map state");
  assert.doesNotMatch(facebookContainerSourceForGeography, /FoursquareMapOverlay|Shared2010Map/, "F7d-1 must not modify Facebook map integration");
  assert.match(deviceCssSourceForTodos, /\.foursquare-venue-map \{[^}]*height: 176px;[^}]*overflow: hidden;/, "F7d-1 Venue Info map must retain deterministic reconstructed frame geometry");
  assert.doesNotMatch(deviceCssSourceForTodos, /\.foursquare-venue-map[^}]*box-shadow/, "F7d-1 map must not introduce modern shadow treatment");
  const facebookPlaceIds = facebookStateForMap.FACEBOOK_PLACE_OPTIONS.map(venue => venue.id);
  assert.deepEqual(facebookPlaceIds, ["downtown-coffee", "community-courts", "main-street-diner", "riverside-park", "westside-library", "gelato-roma"], "F7f-1 must retain the exact six-row Facebook Nearby Places coverage and order");
  assert.equal(facebookPlaceIds.every(venueId => canonicalVenueGeography.hasCanonicalVenueGeography(venueId)), true, "F7f-1 every Facebook place option must have canonical geography");
  assert.equal(facebookPlaceIds.every(venueId => shared2010Map.resolveMapViewport({ mode: "VENUE_DETAIL", venueId }) !== null), true, "F7f-1 every Facebook place option must resolve a canonical VENUE_DETAIL viewport");
  assert.equal(facebookPlaceIds.every(venueId => facebookMapOverlay.FacebookMapOverlay({ venueId }) !== null), true, "F7f-1 every selected Facebook place must resolve a map preview");
  assert.equal(facebookPlaceIds.includes("night-owl") || facebookPlaceIds.includes("cedar-books"), false, "F7f-1 must not leak legacy Foursquare venues into Facebook map coverage");
  assert.match(facebookMapOverlaySource, /resolveMapViewport\(\{ mode: "VENUE_DETAIL", venueId \}\)/, "F7f-1 overlay must use the canonical VENUE_DETAIL viewport");
  assert.match(facebookMapOverlaySource, /<Shared2010Map[\s\S]*venueIds=\{\[\]\}/, "F7f-1 overlay must compose Shared2010Map without neutral QA markers");
  assert.match(facebookMapOverlaySource, /facebook-place-map-pin[\s\S]*<path[\s\S]*<circle/, "F7f-1 must provide one compact Facebook-specific reconstructed pin");
  assert.doesNotMatch(facebookMapOverlaySource, /FoursquareMapOverlay|showPlayer|distance|address|label|callout|onClick|button|fetch\s*\(|navigator\.geolocation|Date\.now|Math\.random/i, "F7f-1 map must expose no Foursquare overlay, player, metadata, interaction, provider, location, host-time, or random behavior");
  const f7fCheckInSource = facebookContainerSourceForGeography.match(/function FacebookPlaceCheckIn[\s\S]*?(?=function FacebookPlaceTagFriends)/)?.[0] ?? "";
  assert.match(f7fCheckInSource, /<FacebookMapOverlay venueId=\{venue\.id\} \/>/, "F7f-1 map must replace the HOLD slot inside Facebook Place Check In");
  assert.match(f7fCheckInSource, /placeStatusDraft[\s\S]*OPEN_PLACE_TAG_FRIENDS[\s\S]*type="submit"/, "F7f-1 must preserve status, Tag Friends, and Check In controls after the map");
  assert.equal((facebookContainerSourceForGeography.match(/<FacebookMapOverlay/g) ?? []).length, 1, "F7f-1 Facebook UI must mount exactly one map integration point");
  assert.doesNotMatch(facebookContainerSourceForGeography.replace(f7fCheckInSource, ""), /<FacebookMapOverlay/, "F7f-1 must add no Places Home, Nearby Places, Place Detail, or Info map");
  assert.doesNotMatch(facebookContainerSourceForGeography, /Map \/ Location view unavailable|Location view unavailable|mapMode|mapList|SHOW_MAP|PLAYER_NEARBY|MULTI_VENUE|eventCheckIn/i, "F7f-1 must remove placeholder copy without adding root Map View, map/list state, player map, multi-pin map, or event check-ins");
  assert.match(deviceCssSourceForTodos, /\.facebook-place-map \{[^}]*height: 68px;[^}]*overflow: hidden;/, "F7f-1 Facebook check-in map must retain the exact 68px HOLD-slot geometry");
  assert.doesNotMatch(deviceCssSourceForTodos, /\.facebook-place-map[^}]*box-shadow/, "F7f-1 map must not introduce modern shadow treatment");
  assert.doesNotMatch(shared2010MapSource, /facebookMode|FacebookMapOverlay|facebook-place-map/, "F7f-1 must keep Shared2010Map app-neutral");
  assert.doesNotMatch(`${foursquareTodosSource}\n${foursquareStateSourceForTodos}`, /Date\.now\s*\(/, "F5a To-Do creation must never use host time");
  assert.match(foursquareContainerSourceForTodos, /state\.activeTab === "todos" && <TodosRoot/, "F5c must render a dedicated To-Dos root from the existing root tab");
  assert.match(foursquareContainerSourceForTodos, /Add to To-Dos/, "F5c venue summary must expose Add to To-Dos");
  assert.match(foursquareContainerSourceForTodos, /Remove from To-Dos/, "F5c saved venue summary must expose Remove from To-Dos");
  assert.match(foursquareContainerSourceForTodos, /simulatedCreatedAt: currentDeviceDateTime\.getTime\(\)/, "F5c venue saves must use the simulated device clock");
  const f5cTodosRootSource = foursquareContainerSourceForTodos.match(/function TodosRoot[\s\S]*?(?=function QuietRoot)/)?.[0] ?? "";
  assert.match(f5cTodosRootSource, /todo\.kind === "venue"/, "F5d To-Dos root must retain the distinct venue To-Do row branch");
  assert.match(f5cTodosRootSource, /selectFoursquareVenueTips\(todo\.venueId\)[\s\S]*candidate\.id === todo\.tipId/, "F5d To-Dos root must resolve Tip content from the canonical Tip reference");
  assert.match(f5cTodosRootSource, /<strong>\{venue\.name\}<\/strong>/, "F5c To-Do rows must render the canonical venue name");
  assert.match(f5cTodosRootSource, /onOpenVenue\(venue\.id\)/, "F5c To-Do rows must open the existing venue route");
  assert.match(f5cTodosRootSource, /className="foursquare-todo-tip-row"[\s\S]*<strong>\{tip\.text\}<\/strong><small>\{venue\.name\}<\/small>/, "F5d Tip To-Do row must render only Tip text and venue name");
  assert.match(f5cTodosRootSource, /onOpenTipVenue\(todo\.venueId\)/, "F5d Tip To-Do row must route through its canonical venue identity");
  assert.match(foursquareContainerSourceForTodos, /onOpenTipVenue=\{venueId => \{ dispatch\(\{ type: "OPEN_VENUE"[\s\S]*dispatch\(\{ type: "SHOW_VENUE_TIPS" \}\); \}\}/, "F5d Tip To-Do row must open the existing venue Tips surface without a Tip detail route");
  assert.doesNotMatch(f5cTodosRootSource, /authorDisplayName|completed|checkbox|checkmark|distance|address|category|timestamp|disclosure|done count/i, "F5d To-Do rows must not expose deferred metadata or completion controls");
  const f5dVenueTipsSource = foursquareContainerSourceForTodos.match(/state\.venueSubview === "tips"[\s\S]*?(?=state\.venueSubview === "checkIn")/)?.[0] ?? "";
  assert.match(f5dVenueTipsSource, /tip\.authorDisplayName[\s\S]*tip\.text/, "F5d must preserve the existing Tip author and text presentation");
  assert.match(f5dVenueTipsSource, /tipTodo \? "Remove from To-Dos" : "Add to To-Dos"/, "F5d Tip surface must expose exactly the approved save/remove wording");
  assert.match(f5dVenueTipsSource, /type: "ADD_TIP_TODO"[\s\S]*tipId: tip\.id[\s\S]*simulatedCreatedAt: currentDeviceDateTime\.getTime\(\)/, "F5d Tip save must use ADD_TIP_TODO and the simulated device clock");
  assert.match(f5dVenueTipsSource, /type: "REMOVE_TODO"[\s\S]*todoId: tipTodo\.id/, "F5d Tip removal must use the existing REMOVE_TODO action");
  assert.doesNotMatch(`${f5cTodosRootSource}\n${f5dVenueTipsSource}`, /I've done this|\bDone\b|Completed|checkbox|checkmark|done count/i, "F5d must keep completion UI hidden");
  assert.match(foursquareContainerSourceForTodos, /state\.activeTab === "tips" && <QuietRoot label="Tips" \/>/, "F5c must leave the Tips root blank");
  assert.doesNotMatch(foursquareContainerSourceForTodos, /TOGGLE_TODO_COMPLETED|getCompletedFoursquareTodos|foursquare-completed/, "F5g visible Foursquare UI must not consume the internal-only completion model");
  assert.equal(foursquareContainerSourceForTodos.match(/state\.activeTab === "tips" && <QuietRoot label="Tips" \/>/g)?.length, 1, "F5g Tips root must remain exactly one blank HOLD branch with no Tip projection");
  assert.doesNotMatch(f5cTodosRootSource, /No To-Dos|Nothing here|Add places/i, "F5c blank To-Dos state must not introduce empty-state copy");
  assert.match(deviceCssSourceForTodos, /\.foursquare-todo-venue-row \{[^}]*height: 44px;/, "F5c To-Do rows must use compact reconstructed iPhone list geometry");
  const t0M1DeviceMachine = await readSource("src/state/deviceMachine.ts");
  const t0M1Timeline = await readSource("src/data/sessionTimeline.ts");
  const t0M1FacebookState = await readSource("src/state/facebookState.ts");
  const t0M1PublicTwitterRepository = await readSource("src/data/publicTwitterRepository.ts");
  const t0M1PublicTwitterFixtures = await readSource("src/data/publicTwitterFixtures.ts");
  const t0M1Foursquare = await readSource("src/data/foursquareContent.ts");
  const t0M1SharedMedia = await readSource("src/data/sharedCharacterMedia.ts");
  const canonicalT0M1Start = "2010-10-20T00:02:00-07:00";

  assert.match(t0M1DeviceMachine, new RegExp(`SESSION_START_ISO = "${canonicalT0M1Start}"`), "T0-M1 must set the canonical session start");
  assert.equal(new Date(Date.parse(canonicalT0M1Start) + 15 * 60_000).toISOString(), "2010-10-20T07:17:00.000Z", "T0-M1 runtime must end at 00:17 PDT");
  for (const offset of [60, 75, 200, 210, 510, 630, 890]) {
    assert.match(t0M1Timeline, new RegExp(`atElapsedSeconds:\\s*${offset}\\b`), `T0-M1 must preserve T+${offset}`);
  }
  assert.match(t0M1Timeline, /simulatedDeviceDateTime\(210 \* 1000\)/, "T0-M1 Instagram replacement must remain T+210");
  assert.match(t0M1SharedMedia, /2010-10-20T00:05:30-07:00/, "T0-M1 Instagram replacement media must remain atomic with T+210");
  assert.match(t0M1Foursquare, /2010-10-20T00:10:30-07:00/, "T0-M1 Night Owl must remain T+510");
  assert.match(t0M1Timeline, /simulatedClock\(630 \* 1000\)/, "T0-M1 Tumblr timestamp must remain T+630");
  assert.match(t0M1Timeline, /timestamp: simulatedClock\(890 \* 1000\)/, "T0-M1 terminal Tweet must remain T+890");
  assert.doesNotMatch(`${t0M1Timeline}\n${t0M1FacebookState}`, /timestamp:\s*"10:(03|06|07|08|11|13|17) PM"/, "T0-M1 runtime labels must not retain stale PM times");
  assert.match(t0M1PublicTwitterRepository, /Date\.parse\(SESSION_START_ISO\)/, "T0-M1 public Twitter must derive from the master clock");
  for (const time of ["00:04", "00:05", "00:07", "00:09", "00:11", "00:13"]) {
    assert.match(t0M1PublicTwitterFixtures, new RegExp(`2010-10-20T${time}:00-07:00`), `T0-M1 public fixture must include ${time}`);
  }
  assert.match(t0M1Foursquare, /FOURSQUARE_F1_REFERENCE_NOW = SESSION_START_ISO/, "T0-M1 Foursquare reference-now must derive from the master clock");
  const t0M1JuneFriendsActivity = foursquare.createInitialFoursquareState().socialActivities.find(
    activity => activity.id === "foursquare-history-june-2010-10-19-main-street-diner",
  );
  assert.deepEqual(
    t0M1JuneFriendsActivity && [t0M1JuneFriendsActivity.id, t0M1JuneFriendsActivity.friendId, t0M1JuneFriendsActivity.venueId, t0M1JuneFriendsActivity.simulatedCreatedAt, t0M1JuneFriendsActivity.shout, t0M1JuneFriendsActivity.visible],
    ["foursquare-history-june-2010-10-19-main-street-diner", "june", "main-street-diner", "2010-10-19T22:52:00-07:00", "Late dinner.", true],
    "T0-M1 must retain June's valid pre-T0 Friends activity",
  );
  for (const [name, source] of [["deviceMachine", t0M1DeviceMachine], ["sessionTimeline", t0M1Timeline], ["publicTwitterRepository", t0M1PublicTwitterRepository], ["foursquareContent", t0M1Foursquare]]) {
    assert.doesNotMatch(source, /2010-10-19T22:0[2]:00-07:00/, `T0-M1 ${name} must not retain the stale runtime master`);
  }

  const foursquareHistoricalActivity = await vite.ssrLoadModule("/src/data/foursquareHistoricalActivity.ts");
  const historicalActivitySource = await readSource("src/data/foursquareHistoricalActivity.ts");
  assert.deepEqual(
    [foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_START, foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_END, foursquareHistoricalActivity.FOURSQUARE_HISTORY_TIME_ZONE],
    ["2010-08-22T00:00:00-07:00", "2010-10-20T00:02:00-07:00", "America/Los_Angeles"],
    "F6a history window and timezone must remain exact",
  );
  assert.deepEqual(foursquareHistoricalActivity.FOURSQUARE_NPC_IDS, ["alex", "katie", "june", "luca", "mia"], "F6a history must remain NPC-only");
  assert.deepEqual(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_VENUE_IDS, ["main-street-diner", "riverside-park", "downtown-coffee", "community-courts", "westside-library", "gelato-roma"], "F6a must whitelist only canonical historical venues");
  assert.equal(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS.length, 39, "F6d must preserve Alex/Katie and add exactly 6 June plus 5 Luca historical check-ins");
  assert.deepEqual(
    foursquareHistoricalActivity.FOURSQUARE_FRIENDS_FEED_HISTORY_IDS,
    [
      "foursquare-history-june-2010-10-19-main-street-diner",
      "foursquare-history-alex-2010-10-19-riverside-park",
      "foursquare-history-katie-2010-10-19-riverside-park",
      "foursquare-history-luca-2010-10-19-main-street-diner",
    ],
    "F6e Friends-feed historical projection must contain exactly the four approved canonical historical activity IDs",
  );

  const historicalRecord = (overrides = {}) => ({
    id: "foursquare-history-alex-2010-10-09-riverside-park",
    characterId: "alex",
    venueId: "riverside-park",
    simulatedCreatedAt: "2010-10-09T16:40:00-07:00",
    shout: null,
    source: "seed",
    classification: "PROJECT-CURATED-FICTION",
    validForGameMechanics: true,
    validityClassification: "PROJECT-RECONSTRUCTED-VALID",
    ...overrides,
  });
  assert.doesNotThrow(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckin(historicalRecord()));
  for (const simulatedCreatedAt of ["2010-10-09 16:40:00", "2010-10-09T16:40:00Z", "2010-10-09T16:40:00-08:00", "2010-02-30T16:40:00-07:00"]) {
    assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckin(historicalRecord({ simulatedCreatedAt })), /foursquare-history/, `F6a must reject non-contract timestamp ${simulatedCreatedAt}`);
  }
  assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckin(historicalRecord({ simulatedCreatedAt: "2010-08-21T23:59:59-07:00", id: "foursquare-history-alex-2010-08-21-riverside-park" })), /outside the F6 window/);
  assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckin(historicalRecord({ simulatedCreatedAt: "2010-10-20T00:02:01-07:00", id: "foursquare-history-alex-2010-10-20-riverside-park" })), /outside the F6 window/);
  assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckin(historicalRecord({ characterId: "player" })), /approved NPC/);
  assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoryCompleteness({ characterId: "player", windowStart: foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_START, windowEnd: foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_END, level: "complete-for-game-window", mechanicsCoverage: [], lifetimeHistoryComplete: false }), /approved NPC/);
  for (const venueId of ["night-owl", "cedar-books", "unknown-venue"]) {
    assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckin(historicalRecord({ venueId })), /approved historical venue/, `F6a must reject ${venueId}`);
  }
  assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckin(historicalRecord({ source: "live" })), /source must be seed/);
  assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckin(historicalRecord({ classification: "CURATED" })), /PROJECT-CURATED-FICTION/);
  assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckin(historicalRecord({ validityClassification: "NARRATIVE-ONLY" })), /PROJECT-RECONSTRUCTED-VALID/);
  assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckin(historicalRecord({ validForGameMechanics: false })), /NARRATIVE-ONLY/);
  assert.throws(() => foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckins([historicalRecord(), historicalRecord()]), /duplicate historical check-in id/);

  const sameDayLater = historicalRecord({ id: "foursquare-history-alex-2010-10-09-riverside-park-2010", simulatedCreatedAt: "2010-10-09T20:10:00-07:00" });
  const differentDay = historicalRecord({ id: "foursquare-history-alex-2010-10-10-riverside-park", simulatedCreatedAt: "2010-10-10T08:15:00-07:00" });
  const narrativeOnly = historicalRecord({ id: "foursquare-history-alex-2010-10-11-riverside-park", simulatedCreatedAt: "2010-10-11T08:15:00-07:00", validForGameMechanics: false, validityClassification: "NARRATIVE-ONLY" });
  const otherVenue = historicalRecord({ id: "foursquare-history-alex-2010-10-09-downtown-coffee", venueId: "downtown-coffee", simulatedCreatedAt: "2010-10-09T18:40:00-07:00" });
  const unsortedHistory = [differentDay, narrativeOnly, otherVenue, sameDayLater, historicalRecord()];
  const originalHistoryOrder = unsortedHistory.map(record => record.id);
  assert.deepEqual(foursquareHistoricalActivity.getUniqueValidVisitDaysForVenue(unsortedHistory, "alex", "riverside-park"), ["2010-10-09", "2010-10-10"], "same-day valid visits must collapse while separate dates remain");
  assert.deepEqual(foursquareHistoricalActivity.getUniqueValidFoursquareVenueIds(unsortedHistory, "alex"), ["downtown-coffee", "riverside-park"], "valid venue derivation must exclude narrative-only records");
  assert.deepEqual(foursquareHistoricalActivity.sortFoursquareHistoricalCheckinsOldestFirst(unsortedHistory).map(record => record.simulatedCreatedAt), ["2010-10-09T16:40:00-07:00", "2010-10-09T18:40:00-07:00", "2010-10-09T20:10:00-07:00", "2010-10-10T08:15:00-07:00", "2010-10-11T08:15:00-07:00"], "F6a sorting must be deterministic and oldest-first");
  assert.deepEqual(unsortedHistory.map(record => record.id), originalHistoryOrder, "F6a sorting must not mutate authored arrays");

  foursquareHistoricalActivity.assertValidFoursquareHistoricalCheckins(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS);
  const alexHistory = foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS.filter(record => record.characterId === "alex");
  const expectedAlexHistory = [
    ["2010-08-22T11:20:00-07:00", "riverside-park", null],
    ["2010-08-27T08:10:00-07:00", "downtown-coffee", "Needed coffee."],
    ["2010-09-01T12:35:00-07:00", "main-street-diner", null],
    ["2010-09-04T10:15:00-07:00", "downtown-coffee", null],
    ["2010-09-09T18:10:00-07:00", "community-courts", null],
    ["2010-09-14T18:35:00-07:00", "riverside-park", null],
    ["2010-09-18T19:20:00-07:00", "main-street-diner", "Food then home."],
    ["2010-09-24T08:45:00-07:00", "downtown-coffee", null],
    ["2010-09-29T17:40:00-07:00", "westside-library", null],
    ["2010-10-02T21:05:00-07:00", "gelato-roma", null],
    ["2010-10-06T18:50:00-07:00", "main-street-diner", null],
    ["2010-10-09T16:10:00-07:00", "riverside-park", null],
    ["2010-10-13T12:25:00-07:00", "downtown-coffee", null],
    ["2010-10-16T15:30:00-07:00", "community-courts", null],
    ["2010-10-19T20:41:00-07:00", "riverside-park", "Evening walk with the dogs."],
  ];
  assert.deepEqual(alexHistory.map(record => [record.simulatedCreatedAt, record.venueId, record.shout]), expectedAlexHistory, "F6b Alex records must retain exact chronology, venue, and shout values");
  assert.equal(alexHistory.every(record => record.characterId === "alex" && record.source === "seed" && record.classification === "PROJECT-CURATED-FICTION" && record.validForGameMechanics === true && record.validityClassification === "PROJECT-RECONSTRUCTED-VALID"), true, "F6b records must remain Alex-only, seed-authored, project-curated, and game-valid");
  assert.deepEqual(alexHistory.map(record => record.id), foursquareHistoricalActivity.sortFoursquareHistoricalCheckinsOldestFirst(alexHistory).map(record => record.id), "F6b Alex records must remain stored oldest-first");
  assert.deepEqual(Object.fromEntries(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_VENUE_IDS.map(venueId => [venueId, alexHistory.filter(record => record.venueId === venueId).length])), { "main-street-diner": 3, "riverside-park": 4, "downtown-coffee": 4, "community-courts": 2, "westside-library": 1, "gelato-roma": 1 }, "F6b Alex venue distribution must remain exact");
  assert.deepEqual(Object.fromEntries(["2010-08", "2010-09", "2010-10"].map(month => [month, alexHistory.filter(record => record.simulatedCreatedAt.startsWith(month)).length])), { "2010-08": 2, "2010-09": 7, "2010-10": 6 }, "F6b Alex month distribution must remain 2/7/6");
  assert.deepEqual(alexHistory.filter(record => record.shout !== null).map(record => record.shout), ["Needed coffee.", "Food then home.", "Evening walk with the dogs."], "F6b Alex history must contain exactly three approved shouts");
  assert.deepEqual(foursquareHistoricalActivity.getUniqueValidFoursquareVenueIds(alexHistory, "alex"), ["community-courts", "downtown-coffee", "gelato-roma", "main-street-diner", "riverside-park", "westside-library"], "F6b Alex history must derive all six approved venues");
  assert.deepEqual(Object.fromEntries(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_VENUE_IDS.map(venueId => [venueId, foursquareHistoricalActivity.getUniqueValidVisitDaysForVenue(alexHistory, "alex", venueId).length])), { "main-street-diner": 3, "riverside-park": 4, "downtown-coffee": 4, "community-courts": 2, "westside-library": 1, "gelato-roma": 1 }, "F6b Alex history must derive 15 unique valid venue visit-days");
  const katieHistory = foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS.filter(record => record.characterId === "katie");
  const expectedKatieHistory = [
    ["2010-08-24T16:10:00-07:00", "westside-library", null],
    ["2010-08-29T13:40:00-07:00", "riverside-park", null],
    ["2010-09-02T16:25:00-07:00", "gelato-roma", null],
    ["2010-09-07T17:05:00-07:00", "westside-library", "Finally done studying."],
    ["2010-09-11T12:15:00-07:00", "downtown-coffee", null],
    ["2010-09-16T16:45:00-07:00", "riverside-park", null],
    ["2010-09-22T18:10:00-07:00", "main-street-diner", null],
    ["2010-09-26T15:20:00-07:00", "westside-library", null],
    ["2010-10-01T16:05:00-07:00", "westside-library", null],
    ["2010-10-05T17:35:00-07:00", "gelato-roma", "Getting gelato :)"],
    ["2010-10-10T18:15:00-07:00", "main-street-diner", null],
    ["2010-10-15T18:40:00-07:00", "gelato-roma", null],
    ["2010-10-19T17:18:00-07:00", "riverside-park", null],
  ];
  assert.deepEqual(katieHistory.map(record => [record.simulatedCreatedAt, record.venueId, record.shout]), expectedKatieHistory, "F6c Katie records must retain exact chronology, venue, and shout values");
  assert.equal(katieHistory.every(record => record.source === "seed" && record.classification === "PROJECT-CURATED-FICTION" && record.validForGameMechanics === true && record.validityClassification === "PROJECT-RECONSTRUCTED-VALID"), true, "F6c Katie records must remain seed-authored, project-curated, and game-valid");
  assert.deepEqual(Object.fromEntries(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_VENUE_IDS.map(venueId => [venueId, katieHistory.filter(record => record.venueId === venueId).length])), { "main-street-diner": 2, "riverside-park": 3, "downtown-coffee": 1, "community-courts": 0, "westside-library": 4, "gelato-roma": 3 }, "F6c Katie venue distribution must remain exact");
  assert.deepEqual(Object.fromEntries(["2010-08", "2010-09", "2010-10"].map(month => [month, katieHistory.filter(record => record.simulatedCreatedAt.startsWith(month)).length])), { "2010-08": 2, "2010-09": 6, "2010-10": 5 }, "F6c Katie month distribution must remain 2/6/5");
  assert.deepEqual(katieHistory.filter(record => record.shout !== null).map(record => record.shout), ["Finally done studying.", "Getting gelato :)"], "F6c Katie history must contain exactly two approved shouts");
  assert.deepEqual(foursquareHistoricalActivity.getUniqueValidFoursquareVenueIds(katieHistory, "katie"), ["downtown-coffee", "gelato-roma", "main-street-diner", "riverside-park", "westside-library"], "F6c Katie history must derive exactly five approved venues");
  assert.equal(new Set(katieHistory.map(record => foursquareHistoricalActivity.getFoursquareHistoricalVisitDayKey(record))).size, 13, "F6c Katie history must contain 13 unique NPC/venue/Pacific-date visit-day facts");
  assert.deepEqual(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS.map(record => record.id), foursquareHistoricalActivity.sortFoursquareHistoricalCheckinsOldestFirst(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS).map(record => record.id), "F6c combined history must remain stored oldest-first");
  const juneHistory = foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS.filter(record => record.characterId === "june");
  const expectedJuneHistory = [
    ["2010-09-03T12:20:00-07:00", "downtown-coffee", null],
    ["2010-09-12T18:30:00-07:00", "main-street-diner", null],
    ["2010-09-27T17:25:00-07:00", "riverside-park", null],
    ["2010-10-04T13:05:00-07:00", "downtown-coffee", null],
    ["2010-10-12T19:10:00-07:00", "gelato-roma", null],
    ["2010-10-19T22:52:00-07:00", "main-street-diner", "Late dinner."],
  ];
  assert.deepEqual(juneHistory.map(record => [record.simulatedCreatedAt, record.venueId, record.shout]), expectedJuneHistory, "F6d June records must retain exact chronology, venue, and shout values");
  assert.equal(juneHistory.every(record => record.source === "seed" && record.classification === "PROJECT-CURATED-FICTION" && record.validForGameMechanics === true && record.validityClassification === "PROJECT-RECONSTRUCTED-VALID"), true, "F6d June records must remain seed-authored, project-curated, and game-valid");
  assert.deepEqual(Object.fromEntries(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_VENUE_IDS.map(venueId => [venueId, juneHistory.filter(record => record.venueId === venueId).length])), { "main-street-diner": 2, "riverside-park": 1, "downtown-coffee": 2, "community-courts": 0, "westside-library": 0, "gelato-roma": 1 }, "F6d June venue distribution must remain exact");
  assert.deepEqual(juneHistory.filter(record => record.shout !== null).map(record => record.shout), ["Late dinner."], "F6d June history must contain exactly one approved shout");
  assert.deepEqual(foursquareHistoricalActivity.getUniqueValidFoursquareVenueIds(juneHistory, "june"), ["downtown-coffee", "gelato-roma", "main-street-diner", "riverside-park"], "F6d June history must derive exactly four approved venues");
  assert.equal(new Set(juneHistory.map(record => foursquareHistoricalActivity.getFoursquareHistoricalVisitDayKey(record))).size, 6, "F6d June history must contain six unique valid visit-day facts");
  assert.ok(juneHistory.some(record => record.id === "foursquare-history-june-2010-10-19-main-street-diner" && record.shout === "Late dinner."), "F6d must retain the preferred future June Friends-feed replacement candidate");
  assert.equal(juneHistory.some(record => ["night-owl", "cedar-books"].includes(record.venueId)), false, "F6d June history must exclude Night Owl and Cedar Books");

  const lucaHistory = foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS.filter(record => record.characterId === "luca");
  const expectedLucaHistory = [
    ["2010-09-05T16:30:00-07:00", "community-courts", "One more game."],
    ["2010-09-20T18:20:00-07:00", "riverside-park", null],
    ["2010-10-03T19:00:00-07:00", "gelato-roma", null],
    ["2010-10-11T17:45:00-07:00", "community-courts", null],
    ["2010-10-19T15:06:00-07:00", "main-street-diner", null],
  ];
  assert.deepEqual(lucaHistory.map(record => [record.simulatedCreatedAt, record.venueId, record.shout]), expectedLucaHistory, "F6d Luca records must retain exact chronology, venue, and shout values");
  assert.equal(lucaHistory.every(record => record.source === "seed" && record.classification === "PROJECT-CURATED-FICTION" && record.validForGameMechanics === true && record.validityClassification === "PROJECT-RECONSTRUCTED-VALID"), true, "F6d Luca records must remain seed-authored, project-curated, and game-valid");
  assert.deepEqual(Object.fromEntries(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_VENUE_IDS.map(venueId => [venueId, lucaHistory.filter(record => record.venueId === venueId).length])), { "main-street-diner": 1, "riverside-park": 1, "downtown-coffee": 0, "community-courts": 2, "westside-library": 0, "gelato-roma": 1 }, "F6d Luca venue distribution must remain exact");
  assert.deepEqual(lucaHistory.filter(record => record.shout !== null).map(record => record.shout), ["One more game."], "F6d Luca history must contain exactly one approved shout");
  assert.deepEqual(foursquareHistoricalActivity.getUniqueValidFoursquareVenueIds(lucaHistory, "luca"), ["community-courts", "gelato-roma", "main-street-diner", "riverside-park"], "F6d Luca history must derive exactly four approved venues");
  assert.equal(new Set(lucaHistory.map(record => foursquareHistoricalActivity.getFoursquareHistoricalVisitDayKey(record))).size, 5, "F6d Luca history must contain five unique valid visit-day facts");
  assert.equal(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS.some(record => record.characterId === "mia"), false, "F6d must not canonicalize Mia's legacy Cedar activity");
  assert.deepEqual(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS.map(record => record.id), foursquareHistoricalActivity.sortFoursquareHistoricalCheckinsOldestFirst(foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS).map(record => record.id), "F6d combined history must remain stored oldest-first");

  assert.deepEqual(foursquareHistoricalActivity.FOURSQUARE_HISTORY_COMPLETENESS, [
    { characterId: "alex", windowStart: foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_START, windowEnd: foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_END, level: "complete-for-game-window", mechanicsCoverage: ["rolling-visit-days", "weekly-repeat-visits", "consecutive-nights", "same-night-stops"], lifetimeHistoryComplete: false },
    { characterId: "katie", windowStart: foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_START, windowEnd: foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_END, level: "complete-for-game-window", mechanicsCoverage: ["rolling-visit-days", "weekly-repeat-visits", "consecutive-nights", "same-night-stops"], lifetimeHistoryComplete: false },
    { characterId: "june", windowStart: foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_START, windowEnd: foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_END, level: "complete-for-game-window", mechanicsCoverage: ["rolling-visit-days", "weekly-repeat-visits", "consecutive-nights", "same-night-stops"], lifetimeHistoryComplete: false },
    { characterId: "luca", windowStart: foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_START, windowEnd: foursquareHistoricalActivity.FOURSQUARE_HISTORY_WINDOW_END, level: "complete-for-game-window", mechanicsCoverage: ["rolling-visit-days", "weekly-repeat-visits", "consecutive-nights", "same-night-stops"], lifetimeHistoryComplete: false },
  ], "F6d must preserve Alex/Katie completeness and add only June/Luca declarations");

  const fixedAlexRiverside = alexHistory.find(record => record.simulatedCreatedAt === "2010-10-19T20:41:00-07:00");
  const foursquareHistoricalContent = await vite.ssrLoadModule("/src/data/foursquareContent.ts");
  const fixedKatieRiverside = katieHistory.find(record => record.simulatedCreatedAt === "2010-10-19T17:18:00-07:00");
  const fixedLucaMainStreet = lucaHistory.find(record => record.simulatedCreatedAt === "2010-10-19T15:06:00-07:00");
  const legacyMiaCedar = foursquareHistoricalContent.FOURSQUARE_F1_CHECKIN_ACTIVITIES.find(activity => activity.id === "mia-cedar-books");
  assert.deepEqual([legacyMiaCedar?.friendId, legacyMiaCedar?.venueId, legacyMiaCedar?.simulatedCreatedAt, legacyMiaCedar?.shout ?? null, legacyMiaCedar?.visible], ["foursquare-mia", "cedar-books", "2010-10-19T20:42:00-07:00", null, true], "F6d must leave Mia's unresolved Cedar legacy row unchanged");
  assert.deepEqual(foursquareHistoricalActivity.FOURSQUARE_FRIENDS_FEED_HISTORY_IDS, [
    "foursquare-history-june-2010-10-19-main-street-diner",
    "foursquare-history-alex-2010-10-19-riverside-park",
    "foursquare-history-katie-2010-10-19-riverside-park",
    "foursquare-history-luca-2010-10-19-main-street-diner",
  ], "F6e must select exactly four canonical historical Friends-feed IDs");
  assert.deepEqual(foursquareHistoricalContent.FOURSQUARE_F1_CHECKIN_ACTIVITIES.map(activity => activity.id), ["mia-cedar-books"], "F6e must retain only Mia as the deliberate legacy Friends-feed exception");
  const projectedActivities = foursquareHistoricalContent.FOURSQUARE_HISTORICAL_FRIENDS_FEED_ACTIVITIES;
  assert.equal(projectedActivities.length, 4, "F6e must resolve four historical-backed Friends rows");
  for (const historicalId of foursquareHistoricalActivity.FOURSQUARE_FRIENDS_FEED_HISTORY_IDS) {
    const historical = foursquareHistoricalActivity.FOURSQUARE_HISTORICAL_CHECKINS.filter(record => record.id === historicalId);
    const projected = projectedActivities.filter(activity => activity.id === historicalId);
    assert.equal(historical.length, 1, `F6e projection ID ${historicalId} must resolve exactly once in history`);
    assert.equal(projected.length, 1, `F6e projection ID ${historicalId} must resolve exactly once in Friends activity`);
    assert.deepEqual([projected[0].friendId, projected[0].venueId, projected[0].simulatedCreatedAt, projected[0].shout ?? null], [historical[0].characterId, historical[0].venueId, historical[0].simulatedCreatedAt, historical[0].shout], `F6e ${historicalId} fields must derive from canonical history`);
  }
  assert.equal(foursquareHistoricalActivity.FOURSQUARE_FRIENDS_FEED_HISTORY_IDS.some(id => /mia|night-owl/.test(id)), false, "F6e historical projection must exclude Mia and Night Owl");
  assert.deepEqual([foursquareHistoricalContent.FOURSQUARE_HIDDEN_LIVE_ACTIVITIES["june-night-owl-checkin"].source, foursquareHistoricalContent.FOURSQUARE_HIDDEN_LIVE_ACTIVITIES["june-night-owl-checkin"].visible], ["live", false], "F6e Night Owl must remain hidden realtime activity");

  const foursquareHistoricalGameFacts = await vite.ssrLoadModule("/src/data/foursquareHistoricalGameFacts.ts");
  const factsByCharacter = Object.fromEntries(foursquareHistoricalGameFacts.FOURSQUARE_HISTORICAL_GAME_FACTS.map(facts => [facts.characterId, facts]));
  assert.deepEqual(Object.fromEntries(["alex", "katie", "june", "luca", "mia"].map(characterId => [characterId, [factsByCharacter[characterId].recordCount, factsByCharacter[characterId].validRecordCount, factsByCharacter[characterId].uniqueVenueIds.length, factsByCharacter[characterId].uniqueValidVisitDays.length]])), {
    alex: [15, 15, 6, 15], katie: [13, 13, 5, 13], june: [6, 6, 4, 6], luca: [5, 5, 4, 5], mia: [0, 0, 0, 0],
  }, "F6e historical facts must derive exact record, valid, venue, and visit-day counts");
  assert.deepEqual(factsByCharacter.alex.validVisitDaysByVenue, { "main-street-diner": 3, "riverside-park": 4, "downtown-coffee": 4, "community-courts": 2, "westside-library": 1, "gelato-roma": 1 });
  assert.deepEqual(factsByCharacter.katie.validVisitDaysByVenue, { "main-street-diner": 2, "riverside-park": 3, "downtown-coffee": 1, "community-courts": 0, "westside-library": 4, "gelato-roma": 3 });
  assert.deepEqual(factsByCharacter.june.validVisitDaysByVenue, { "main-street-diner": 2, "riverside-park": 1, "downtown-coffee": 2, "community-courts": 0, "westside-library": 0, "gelato-roma": 1 });
  assert.deepEqual(factsByCharacter.luca.validVisitDaysByVenue, { "main-street-diner": 1, "riverside-park": 1, "downtown-coffee": 0, "community-courts": 2, "westside-library": 0, "gelato-roma": 1 });
  assert.deepEqual(factsByCharacter.katie.weeklyRepeatVisitFacts, [{ venueId: "westside-library", weekStartDate: "2010-09-26", visitDays: ["2010-09-26", "2010-10-01"] }], "F6e must derive Katie's sole Sunday-start Pacific weekly repeat fact");
  assert.equal(["alex", "june", "luca"].every(characterId => factsByCharacter[characterId].weeklyRepeatVisitFacts.length === 0), true, "F6e must not invent weekly repeat facts");
  assert.equal(["alex", "katie", "june", "luca"].every(characterId => factsByCharacter[characterId].consecutiveNightFacts.maximumRunLength === 1 && factsByCharacter[characterId].sameNightDistinctStopFacts.maximumDistinctStops === 1), true, "F6e histories must factually derive one-night and one-stop maxima");
  assert.equal(factsByCharacter.mia.completeness, null, "F6e Mia must have no canonical complete mechanics dataset");
  assert.equal(["alex", "katie", "june", "luca"].every(characterId => ["rolling-visit-days", "weekly-repeat-visits", "consecutive-nights", "same-night-stops"].every(coverage => foursquareHistoricalGameFacts.isFoursquareHistoricalMechanicsCoverageComplete(characterId, coverage))), true, "F6e complete NPCs must expose exhaustive in-window mechanics coverage only");
  assert.equal(Object.keys(foursquareHistoricalGameFacts).some(key => /badge|mayor/i.test(key)), false, "F6e facts must expose no badge or mayor result");
  assert.equal(foursquareHistoricalGameFacts.FOURSQUARE_HISTORICAL_GAME_FACTS.some(facts => facts.characterId === "player"), false, "F6e facts must prohibit player history");
  assert.equal(foursquareHistoricalActivity.FOURSQUARE_HISTORY_COMPLETENESS.some(entry => entry.characterId === "mia"), false, "F6d must not make a false Mia completeness claim");
  assert.equal(Object.keys(foursquareHistoricalActivity).some(key => /badge|mayor/i.test(key)), false, "F6a exports must contain no badge or mayor derivation");
  assert.doesNotMatch(historicalActivitySource, /foursquareGameSeed|foursquareGameModel|sessionTimeline/, "F6a history must remain isolated from F3/F4 and realtime domains");
  console.log("F6a historical activity contract checks: PASS");

  console.log("T0-M1 runtime timeline checks: PASS");

  const t0M2Seed = await readSource("src/data/sessionSeedContent.ts");
  const t0M2Albums = await readSource("src/data/facebookAlbums.ts");
  const assertM2Record = (source, id, value) => {
    const recordStart = source.indexOf('id: "' + id + '"');
    assert.ok(recordStart >= 0 && source.slice(recordStart, recordStart + 1800).includes(value), "T0-M2 must migrate " + id);
  };
  for (const pair of [["ben-long-day","2010-10-19T23:58:00-07:00"],["mike-anil-question","2010-10-19T23:54:00-07:00"],["june-show-photos-oct19","2010-10-19T23:51:00-07:00"],["jack-movie","2010-10-19T23:52:00-07:00"],["alex-jacks-party-friday","2010-10-19T23:47:00-07:00"],["katie-coffee","2010-10-19T23:41:00-07:00"],["jay-reading","2010-10-19T23:33:00-07:00"],["luca-pickup-basketball-photos","2010-10-19T22:58:00-07:00"],["luca-profile-picture-current","2010-10-20T00:00:00-07:00"],["luca-main-street-diner-checkin","2010-10-19T22:44:00-07:00"],["june-ig-04","2010-10-20T00:00:00-07:00"]]) assertM2Record(t0M2Seed, pair[0], pair[1]);
  assert.match(t0M2Albums, /june-show-photos-oct19[\s\S]{0,300}2010-10-19T23:51:00-07:00/, "T0-M2 June show album must match its parent");
  assert.match(t0M1SharedMedia, /june-ig-04[\s\S]{0,300}2010-10-20T00:00:00-07:00/, "T0-M2 IG04 media must preserve T-2 freshness");
  assert.match(t0M2Seed, /id: "apple-event"[\s\S]{0,300}Apple event tomorrow morning[\s\S]{0,300}timestamp: "10:47 PM"/, "T0-M2 Apple tomorrow invariant must remain true");
  assert.match(t0M2Seed, /id: "katie-tomorrow"[\s\S]{0,300}see you tomorrow[\s\S]{0,300}timestamp: "10:14 PM"/, "T0-M2 Katie inbox must remain pre-T0 without changing copy");
  console.log("T0-M2 static narrative and atomic media checks: PASS");

  console.log("Historical seed-content state checks: PASS");
} finally {
  await vite.close();
}
