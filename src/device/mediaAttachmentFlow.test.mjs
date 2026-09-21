// Actual App controller/reducers/effects with deterministic host hooks and time.
// DOM projection, visual continuity and Safari gestures still require browser QA.
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let clock = 100000, slots = [], cursor = 0, dirty = true, pending = [], view, tree;
let captureSequence = 0;
const persistedOwners=[];
const timers = new Map(), listeners = new Map();
let nextTimer = 0, eraseCount = 0, initializeCount = 0, sceneSelections = 0;
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const hooks = {
  useState(initial) {
    const i = cursor++;
    slots[i] ??= { value: typeof initial === "function" ? initial() : initial };
    return [slots[i].value, value => { const next = typeof value === "function" ? value(slots[i].value) : value; if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; } }];
  },
  useReducer(reducer, initial, initialize) {
    const [value, set] = hooks.useState(() => initialize ? initialize(initial) : initial);
    const i = cursor - 1;
    slots[i].dispatch ??= action => set(state => reducer(state, action));
    return [value, slots[i].dispatch];
  },
  useRef(value) { const i = cursor++; slots[i] ??= { current: value }; return slots[i]; },
  useCallback(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
  useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) { pending.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); } },
};
globalThis.__lifecycleHooks = hooks;
hooks.useLayoutEffect = hooks.useEffect;
globalThis.__sceneSelected = () => sceneSelections++;
const persistence = {
  eraseCurrentCameraRoll: async () => { eraseCount++; }, initializeCameraRollPersistence: async () => { initializeCount++; return []; },
  deleteStalePlayerCameraRolls: async () => {}, eraseAllPlayerCameraRolls: async () => { throw Error("must not erase world stores"); },
  discardPersistedCameraPhoto: async () => {}, persistCameraCapturedArtifact: async (artifact, owner) => (persistedOwners.push(owner), { ...artifact.snapshot, blob: artifact.blob, id: `capture-${++captureSequence}`, filename: `IMG_${captureSequence}.JPG`, captureSequence, origin: "player-camera" }),
  isCameraCaptureOwnerCurrent: (a, b) => a === b,
};
globalThis.__lifecyclePersistence = persistence;
const realDateNow = Date.now; Date.now = () => clock;
const realPerformanceNow = performance.now; performance.now = () => clock;
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
globalThis.window = {
  location: { search: "" },
  setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: clock + delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
  setInterval(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: clock + delay, delay }); return id; },
  clearInterval(id) { timers.delete(id); },
  requestAnimationFrame(fn) { return this.setTimeout(fn, 16); }, cancelAnimationFrame(id) { timers.delete(id); },
  addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener(name) { listeners.delete(name); },
};
globalThis.location = window.location;
globalThis.clearTimeout = window.clearTimeout;
globalThis.clearInterval = window.clearInterval;
globalThis.cancelAnimationFrame = window.cancelAnimationFrame;
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window);
globalThis.document = { hidden: false, body: { style: {} } };
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent", plugins: [{
  name: "lifecycle-controller-host", enforce: "pre",
  resolveId(id) {
    if (id === "virtual:lifecycle-hooks" || id.endsWith("/state/cameraRollPersistence")) return "\0" + (id === "virtual:lifecycle-hooks" ? "lifecycle-hooks" : "lifecycle-persistence");
  },
  load(id) {
    if (id === "\0lifecycle-hooks") return Object.keys(hooks).map(key => `export const ${key}=globalThis.__lifecycleHooks.${key};`).join("\n");
    if (id === "\0lifecycle-persistence") return Object.keys(persistence).map(key => `export const ${key}=globalThis.__lifecyclePersistence.${key};`).join("\n");
  },
  transform(code, id) {
    if (id.endsWith("/src/device/useVoiceMemos.ts")) return code.replace('from "react";', 'from "virtual:lifecycle-hooks";');
    if (id.endsWith("/src/device/App.tsx")) return code.replace('from "react";', 'from "virtual:lifecycle-hooks";').replaceAll("import.meta.env.DEV", process.argv.includes("--production") ? "false" : "true");
    if (/\/src\/device\/(TwitterContainer|FacebookContainer|MobileSMSContainer|FlickrContainer|TumblrContainer)\.tsx$/.test(id)) return code.replace('from "react";', 'from "virtual:lifecycle-hooks";').replaceAll('useSessionIdentity()', '({ name: "Media Visitor" })');
    if (id.endsWith("/src/device/DeviceScreen.tsx")) return code.replace('  useDeviceScreenDiagnostics(presentation.presenter, presentation.experienceSessionId);', '');
    if (id.endsWith("/src/world/cameraVideoScenes.ts")) return code.replace("  const random = options.random ?? Math.random;", "  globalThis.__sceneSelected();\n  const random = options.random ?? Math.random;");
  },
}] });


try {
  const { App } = await server.ssrLoadModule("/src/device/App.tsx");
  const device = await server.ssrLoadModule("/src/state/deviceMachine.ts");
  const { SessionIdentityContext } = await server.ssrLoadModule("/src/state/sessionIdentity.ts");
  const { DeviceScreen } = await server.ssrLoadModule("/src/device/DeviceScreen.tsx");
  const renderComponent = (component, props) => {
    const saved=[slots,cursor,pending,dirty];slots=[];cursor=0;pending=[];
    try { return component(props); } finally { [slots,cursor,pending,dirty]=saved; }
  };
  const clickMedia = (requester, source) => {
    const surface=DeviceScreen(view.screen.props);
    const container=walk(surface).find(node=>node.type?.name===({messages:"MobileSMSContainer",facebook:"FacebookContainer",twitter:"TwitterContainer",flickr:"FlickrContainer",tumblr:"TumblrContainer"}[requester]));
    assert.ok(container);
    let content=renderComponent(container.type,container.props);
    if(requester==="twitter") {
      const composer=walk(content).find(node=>node.type?.name==="TwitterComposer");assert.ok(composer);
      content=renderComponent(composer.type,composer.props);
    }
    const className=requester==="tumblr"?"tumblr-photo-row":requester==="flickr"?"flickr-right flickr-upload-icon":requester==="messages"?"mobilesms-camera-slot":requester==="facebook"?"facebook-feed-camera-control":`twitter-compose-tool is-${source==="camera"?"camera":"photo-library"}`;
    const button=walk(content).find(node=>node.type==="button" && node.props.className===className);
    assert.ok(button && !button.props.disabled);assert.equal(typeof button.props.onClick,"function");
    button.props.onClick();
  };
  const markup = () => renderComponent(() => renderToStaticMarkup(createElement(SessionIdentityContext.Provider, {value:{name:"Media Visitor"}}, view.screen)), {});
  const walk = node => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
  const flush = async () => {
    for(let n=0;n<100;n++) {
      if(dirty) { dirty=false; cursor=0; tree=App({presenter:"hero",renderHero: props => {view=props;return null;}}); const effects=pending;pending=[];effects.forEach(fn=>fn()); }
      await Promise.resolve();
      if(!dirty && !pending.length && n>5)return;
    }
    throw Error("controller did not settle");
  };
  const tick = async ms => { clock+=ms; for(const [id,timer] of [...timers])if(timer.at<=clock){if(timer.delay)timer.at=clock+timer.delay;else timers.delete(id);timer.fn();}await flush(); };
  const screen = () => view.screen.props;
  const home = async () => {
    view.onHomePress();await tick(310);
    screen().navigation.dispatchAppRuntime({type:"ANIMATION_COMPLETE"});screen().actions.completeScreenAppClose();await flush();
    assert.equal(view.lifecycleDiagnostics.softwarePhase,"springboard");
  };
  const open = async app => {
    if(view.lifecycleDiagnostics.softwarePhase==="app")await home();
    screen().navigation.launchSpringBoardApp(app);await flush();
    screen().navigation.dispatchAppRuntime({type:"ANIMATION_COMPLETE"});await flush();
  };
  const remove = async requester => {
    if(requester==="messages")screen().apps.dispatchMessages({type:"REMOVE_ATTACHMENT",contextId:"mom"});
    if(requester==="facebook")screen().apps.dispatchFacebookEvent({type:"REMOVE_ATTACHMENT"});
    if(requester==="twitter")screen().apps.dispatchTwitter({type:"REMOVE_ATTACHMENT"});
    await flush();
  };
  const attachment = requester => requester==="messages" ? screen().apps.messagesState.pendingAttachments.mom : requester==="facebook" ? screen().apps.facebookState.pendingAttachment : screen().apps.twitterState.pendingAttachment;
  const draft = requester => requester==="messages" ? screen().apps.messagesState.draft : requester==="facebook" ? screen().apps.facebookState.statusDraft : screen().apps.twitterState.newTweetDraft;
  const request = async (requester,source) => {
    if(requester==="twitter" || source==="camera-or-library") clickMedia(requester,source);
    else screen().media.requestAttachment({requester,source,mode:"photo",contextId:requester==="messages"?"mom":"status"});
    await flush();
    if(source==="camera-or-library"){screen().media.chooseSource("camera");await flush();}
  };
  let previousCapture = null;
  await flush();
  for(let run=0;run<2;run++) {
    view.startExperience({name:"Media Visitor "+run});await flush();
    view.onLifecycleAction({type:"DETACH_COMPLETE"});await flush();
    view.onLifecycleAction({type:"PRESS_POWER",startedAt:clock});await flush();
    view.onLifecycleAction({type:"ALIGN_COMPLETE"});await flush();
    await tick(20000);view.onHandoff();view.onLifecycleAction({type:"BOOT_COMPLETE",now:clock});await flush();
    screen().actions.completeScreenUnlock();await flush();screen().actions.attemptScreenPasscode(screen().display.session.passcode);await flush();
    const sessionId=view.lifecycleDiagnostics.experienceSessionId;
    assert.equal(sceneSelections,run+1);
    const ambient=walk(tree).find(node=>node.type?.name==="AmbientWorld");
    ambient.props.onCameraCaptureReady(async snapshot=>({snapshot,blob:new Blob(["jpeg"],{type:"image/jpeg"})}));
    await flush();
    for(const requester of ["messages","facebook","twitter"]) {
      await open(requester);
      if(requester==="messages"){screen().apps.dispatchMessages({type:"OPEN_CONVERSATION",conversationId:"mom"});screen().apps.dispatchMessages({type:"EDIT_DRAFT",value:"draft-messages"});}
      if(requester==="facebook"){screen().apps.dispatchFacebookEvent({type:"SHOW_FEED"});screen().apps.dispatchFacebookEvent({type:"OPEN_STATUS_COMPOSER"});}
      if(requester==="twitter")screen().apps.dispatchTwitter({type:"BEGIN_NEW_TWEET"});
      await flush();
      if(requester==="facebook")screen().apps.dispatchFacebookEvent({type:"EDIT_STATUS",value:"draft-facebook"});
      if(requester==="twitter")screen().apps.dispatchTwitter({type:"EDIT_COMPOSER",value:"draft-twitter"});
      await flush();
      const expectedDraft=draft(requester);assert.ok(expectedDraft);
      await request(requester,requester==="twitter"?"camera":"camera-or-library");
      assert.equal(screen().media.request.requester,requester);
      assert.equal(screen().media.cameraActive,true);
      assert.equal(screen().camera.cameraRuntime.cameraApp.phase,"previewing");
      assert.equal(screen().camera.cameraRuntime.cameraPicker.phase,"none","placeholder picker never launches");
      const cameraMarkup=markup();
      assert.equal((cameraMarkup.match(/data-camera-owner="cameraApp"/g)??[]).length,1);
      assert.equal((cameraMarkup.match(/<canvas/g)??[]).length,1,"one live preview canvas");
      assert.match(cameraMarkup,/data-media-camera="true"/);
      assert.match(cameraMarkup,/aria-label="Take Picture"/);
      // Sleep/wake retains the request and scene, and does not resolve it.
      const requestId=screen().media.request.id;
      screen().media.requestAttachment({requester,source:"library",mode:"photo",contextId:"wrong-context"});await flush();
      assert.equal(screen().media.request.id,requestId,"one active request cannot be overwritten");
      view.powerControl.begin();view.powerControl.end();await flush();
      assert.equal(screen().media.visible,false);assert.equal(screen().media.request.id,requestId);
      view.powerControl.begin();view.powerControl.end();await flush();
      screen().actions.completeScreenUnlock();await flush();screen().actions.attemptScreenPasscode(screen().display.session.passcode);await flush();
      assert.equal(screen().media.request.id,requestId);assert.equal(screen().media.cameraActive,true);
      const freshCapture = screen().camera.captureCameraPhoto();
      if (previousCapture) {
        const old=previousCapture;const before=persistedOwners.filter(id=>id===old.sessionId).length;
        old.release();await old.promise;previousCapture=null;
        assert.equal(persistedOwners.filter(id=>id===old.sessionId).length,before,"stale previous-session capture never persists");
      }
      await freshCapture;await flush();

      assert.equal(screen().media.request,null);
      assert.ok(attachment(requester)?.objectUrl.startsWith("blob:"));
      assert.match(markup(),/alt="Pending photo"/);
      assert.equal(draft(requester),expectedDraft);
      assert.equal(screen().navigation.appRuntime.activeAppId,requester);
      assert.equal(view.lifecycleDiagnostics.cameraSceneSessionId,sessionId);
      assert.equal(sceneSelections,run+1,"cross-app captures never reroll");
      if(requester==="messages") {
        const before=screen().apps.messagesState.messages.length;
        const image=attachment(requester);
        screen().apps.dispatchMessages({type:"SEND",elapsedMs:screen().display.elapsed,createdAt:screen().display.deviceDateTime.toISOString(),timestamp:screen().display.deviceStatusTime});
        screen().apps.dispatchMessages({type:"SEND",elapsedMs:screen().display.elapsed});await flush();
        assert.equal(screen().apps.messagesState.messages.length,before+1);
        const sent=screen().apps.messagesState.messages.at(-1);
        assert.equal(sent.attachment.id,image.id);assert.equal(sent.conversationId,"mom");assert.equal(sent.direction,"outgoing");assert.ok(sent.createdAt.startsWith("2010-10-20T07:"));
        assert.equal((markup().match(/class="mobilesms-image-message"/g)??[]).length,1);
        screen().apps.dispatchMessages({type:"EDIT_DRAFT",value:expectedDraft});await flush();
      } else {
        const before=requester==="facebook"?screen().apps.facebookState.feed.length:screen().apps.twitterState.timeline.length;
        const image=attachment(requester);
        const container=walk(DeviceScreen(view.screen.props)).find(node=>node.type?.name===(requester==="facebook"?"FacebookContainer":"TwitterContainer"));
        const content=renderComponent(container.type,container.props);
        if(requester==="facebook")walk(content).find(node=>node.props?.className==="facebook-status-composer").props.onSubmit({preventDefault(){}});
        else walk(content).find(node=>node.type?.name==="TwitterComposer").props.onSubmit();
        await flush();
        const posts=requester==="facebook"?screen().apps.facebookState.feed:screen().apps.twitterState.timeline;
        assert.equal(posts.length,before+1,"media publishes through the existing feed/timeline");
        assert.equal(posts.find(post=>post.attachment?.id===image.id)?.attachment.objectUrl,image.objectUrl);
        assert.equal(attachment(requester),null);
        if(requester==="facebook") {
          screen().apps.dispatchFacebookEvent({type:"OPEN_STATUS_COMPOSER"});
          screen().apps.dispatchFacebookEvent({type:"EDIT_STATUS",value:expectedDraft});
        } else {
          screen().apps.dispatchTwitter({type:"BEGIN_NEW_TWEET"});
          screen().apps.dispatchTwitter({type:"EDIT_COMPOSER",value:expectedDraft});
        }
        await flush();
      }
      await remove(requester);
      // Library result comes from the same Camera Roll, never a new app library.
      if(requester==="twitter") await request(requester,"library");
      else {
        screen().media.requestAttachment({requester,source:"camera-or-library",mode:"photo"});await flush();
        assert.match(markup(),/Choose from Camera Roll/);
        screen().media.chooseSource("library");await flush();
      }
      screen().media.selectPhoto("missing");await flush();assert.equal(screen().media.request.stage,"library");
      const photo=screen().camera.cameraRoll.records[0];
      screen().media.selectPhoto(photo.id);await flush();
      assert.equal(attachment(requester).id,photo.id);assert.equal(draft(requester),expectedDraft);
      await remove(requester);
      await request(requester,"camera");
      const retained=screen().media.request.id;
      await home();assert.equal(screen().media.request.id,retained);assert.equal(screen().media.visible,false);
      await open(requester);assert.equal(screen().media.request.id,retained);
      screen().actions.cancelScreenCameraPicker();await flush();
      assert.equal(screen().media.request,null);assert.equal(draft(requester),expectedDraft);assert.equal(attachment(requester)??null,null);
      await request(requester,"library");screen().media.selectPhoto(photo.id);await flush();
      assert.ok(attachment(requester)); // Keep unsent attachments in all three apps for reset.
    }
    // Tumblr v0.3: actual Photo row -> shared Camera/Library -> same reducer.
    await open("tumblr");
    const tumblr = () => screen().apps.tumblrState;
    const sendTumblr = async event => { screen().apps.dispatchTumblr(event); await flush(); };
    await sendTumblr({type:"SELECT_TAB",tab:"post-types"});
    clickMedia("tumblr","camera-or-library");await flush();
    assert.equal(tumblr().composerKind,"photo");
    assert.equal(screen().media.request.requester,"tumblr");
    assert.equal(screen().media.request.contextId,`photo:${tumblr().composerSubmissionToken}`);
    assert.equal(walk(DeviceScreen(view.screen.props)).find(n=>n.type?.name==="IOS4KeyboardSystem").props.suspended,true);
    await sendTumblr({type:"EDIT_COMPOSER_CONTENT",value:"Tumblr caption survives picker"});
    screen().media.chooseSource("camera");await flush();
    assert.equal(screen().media.cameraActive,true);
    assert.equal(view.lifecycleDiagnostics.cameraSceneSessionId,sessionId);
    await screen().camera.captureCameraPhoto();await flush();
    assert.equal(screen().media.request,null);
    const tumblrImage=tumblr().pendingAttachment;
    assert.ok(tumblrImage);
    const tumblrRollSource=screen().camera.cameraRoll.records.find(p=>p.id===tumblrImage.id);
    assert.ok(tumblrRollSource);
    assert.equal(tumblrImage.objectUrl,tumblrRollSource.objectUrl);
    assert.equal(tumblr().composerContent,"Tumblr caption survives picker");
    screen().media.requestAttachment({requester:"tumblr",mode:"photo",source:"library",contextId:`photo:${tumblr().composerSubmissionToken}`});await flush();
    screen().actions.cancelScreenCameraPicker();await flush();
    assert.strictEqual(tumblr().pendingAttachment,tumblrImage);
    const tumblrNode=walk(DeviceScreen(view.screen.props)).find(n=>n.type?.name==="TumblrContainer");
    const tumblrUi=renderComponent(tumblrNode.type,tumblrNode.props);
    const postButton=walk(tumblrUi).find(n=>n.type==="button"&&n.props.className==="tumblr-nav-right");
    const tumblrCount=tumblr().posts.length;
    assert.ok(postButton&&!postButton.props.disabled);
    postButton.props.onClick();postButton.props.onClick();await flush();
    assert.equal(tumblr().posts.length,tumblrCount+1);
    assert.strictEqual(tumblr().posts[0].attachment,tumblrImage);
    assert.equal(tumblr().posts[0].timestamp,`${device.simulatedDeviceDateTime(screen().display.elapsed).toISOString().slice(0,10)} ${device.simulatedClock(screen().display.elapsed)}`);
    assert.equal(tumblr().pendingAttachment,null);
    assert.strictEqual(screen().camera.cameraRoll.records.find(p=>p.id===tumblrRollSource.id),tumblrRollSource);
    await sendTumblr({type:"SELECT_TAB",tab:"post-types"});
    clickMedia("tumblr","camera-or-library");await flush();
    await sendTumblr({type:"EDIT_COMPOSER_CONTENT",value:"Unsent library caption"});
    screen().media.chooseSource("library");await flush();
    screen().media.selectPhoto(tumblrRollSource.id);await flush();
    assert.equal(tumblr().pendingAttachment.id,tumblrRollSource.id);
    assert.equal(tumblr().composerContent,"Unsent library caption");
    assert.equal(sceneSelections,run+1,"Tumblr Camera and Library never reroll");
    assert.equal(walk(tree).filter(n=>n.type?.name==="AmbientWorld").length,1);
    // Leave the unsent attachment/draft for the existing end-of-session reset.
    // Flickr A–L through the same App, Camera, Camera Roll, DeviceScreen and UI control.
    await open("flickr");
    const flickr = () => screen().apps.flickrState;
    const sendFlickr = async event => { screen().apps.dispatchFlickr(event); await flush(); };
    assert.equal(flickr().currentView, "home");
    assert.equal(flickr().pendingUpload, null);
    await sendFlickr({type:"EDIT_UPLOAD",field:"description",value:"Kept across Camera"});
    clickMedia("flickr","camera-or-library");await flush();
    assert.equal(screen().media.request.requester,"flickr");
    assert.equal(screen().media.request.contextId,"upload");
    assert.match(markup(),/Upload from Library/);
    const sourceScreen=DeviceScreen(view.screen.props);
    assert.equal(walk(sourceScreen).find(n=>n.type?.name==="IOS4KeyboardSystem").props.suspended,true);
    screen().media.chooseSource("camera");await flush();
    assert.equal(screen().media.cameraActive,true);
    assert.equal((markup().match(/data-camera-owner="cameraApp"/g)??[]).length,1);
    await screen().camera.captureCameraPhoto();await flush();
    assert.equal(screen().media.request,null);
    assert.equal(flickr().currentView,"upload");
    const pendingFlickr=flickr().pendingUpload;
    assert.ok(pendingFlickr);
    const retainedPhoto=screen().camera.cameraRoll.records.find(p=>p.id===pendingFlickr.attachment.id);
    assert.ok(retainedPhoto);assert.equal(pendingFlickr.takenAt,retainedPhoto.createdAt);
    assert.equal(pendingFlickr.attachment.objectUrl,retainedPhoto.objectUrl);
    const originalCount=flickr().photos.length;
    assert.equal(flickr().photos.filter(p=>p.origin==="live").length,0,"selection is not publication");
    screen().media.requestAttachment({requester:"flickr",source:"library",mode:"photo"});await flush();
    screen().actions.cancelScreenCameraPicker();await flush();
    assert.strictEqual(flickr().pendingUpload,pendingFlickr);
    assert.equal(flickr().uploadDraft.description,"Kept across Camera");
    const flickrNode=walk(DeviceScreen(view.screen.props)).find(n=>n.type?.name==="FlickrContainer");
    const flickrUi=renderComponent(flickrNode.type,flickrNode.props);
    const uploadButton=walk(flickrUi).find(n=>n.props?.className==="flickr-publish");
    assert.ok(uploadButton&&!uploadButton.props.disabled);uploadButton.props.onClick();uploadButton.props.onClick();await flush();
    const job=flickr().upload;assert.ok(job);
    assert.equal(flickr().photos.length,originalCount,"upload must finish before publication");
    assert.equal(job.photo.uploadedAt,device.simulatedDeviceDateTime(job.dueElapsedMs).toISOString());
    assert.ok(Date.parse(job.photo.takenAt)<=Date.parse(job.photo.uploadedAt));
    await home();
    assert.equal(walk(DeviceScreen(view.screen.props)).find(n=>n.type?.name==="SpringBoard").props.flickrUploadCount,1);
    await open("facebook");await tick(3500);
    assert.equal(flickr().photos.length,originalCount+1);assert.equal(flickr().upload,null);
    assert.equal(flickr().pendingUpload,null);
    assert.equal(flickr().photos.filter(p=>p.id===job.photo.id).length,1);
    assert.strictEqual(screen().camera.cameraRoll.records.find(p=>p.id===retainedPhoto.id),retainedPhoto);
    await home();assert.equal(walk(DeviceScreen(view.screen.props)).find(n=>n.type?.name==="SpringBoard").props.flickrUploadCount,0);
    await open("flickr");assert.equal(flickr().currentView,"upload","Home/app switching preserves location");
    await sendFlickr({type:"SHOW_PHOTOSTREAM"});
    assert.match(markup(),/Kept across Camera|YOUR PHOTOSTREAM/);
    await sendFlickr({type:"SEARCH_QUERY",value:"Guitar"});await sendFlickr({type:"NAVIGATE",view:"search"});await sendFlickr({type:"SEARCH"});
    view.powerControl.begin();view.powerControl.end();await flush();
    view.powerControl.begin();view.powerControl.end();await flush();screen().actions.completeScreenUnlock();await flush();screen().actions.attemptScreenPasscode(screen().display.session.passcode);await flush();
    assert.equal(flickr().currentView,"search");assert.equal(flickr().searchQuery,"Guitar");
    await home();await open("messages");await open("flickr");
    assert.equal(flickr().currentView,"search");assert.equal(flickr().searchedQuery,"Guitar");
    screen().media.requestAttachment({requester:"flickr",source:"library",mode:"photo"});await flush();
    assert.equal(screen().media.request.stage,"library");
    screen().media.selectPhoto(retainedPhoto.id);await flush();
    assert.equal(flickr().pendingUpload.attachment.id,retainedPhoto.id);
    assert.equal(flickr().photos.length,originalCount+1);
    assert.equal(sceneSelections,run+1,"Flickr never rerolls the shared Camera scene");
    assert.equal(view.lifecycleDiagnostics.cameraSceneSessionId,sessionId);
    // Leave an unfinished second upload for the normal end-of-session reset below.
    await sendFlickr({type:"EDIT_UPLOAD",field:"tags",value:"test"});
    await open("twitter");
    // Safari sequence: leave an unfinished app request, then tap another app's real control.
    await request("twitter","camera");
    await open("messages");clickMedia("messages","camera-or-library");await flush();
    assert.equal(screen().media.request.requester,"messages","background request must not silently block Messages");
    assert.equal(screen().media.request.contextId,"mom");assert.equal(screen().media.request.stage,"source");
    screen().actions.cancelScreenCameraPicker();await flush();
    screen().apps.dispatchMessages({type:"OPEN_CONVERSATION",conversationId:"dad"});await flush();
    clickMedia("messages","camera-or-library");await flush();
    assert.equal(screen().media.request.contextId,"dad");assert.equal(screen().media.request.stage,"source");
    screen().actions.cancelScreenCameraPicker();await flush();
    assert.equal(screen().apps.messagesState.activeConversationId,"dad");assert.equal(draft("messages"),"draft-messages");
    await open("facebook");clickMedia("facebook","camera-or-library");await flush();
    await open("twitter");clickMedia("twitter","library");await flush();
    assert.equal(screen().media.request.requester,"twitter","background request must not silently block Twitter");
    assert.equal(screen().media.request.source,"library");
    screen().actions.cancelScreenCameraPicker();await flush();
    // Late capture after cancellation cannot attach to a newer request.
    await remove("twitter");await request("twitter","camera");
    let release;
    walk(tree).find(node=>node.type?.name==="AmbientWorld").props.onCameraCaptureReady(snapshot=>new Promise(resolve=>{release=()=>resolve({snapshot,blob:new Blob(["late"])});}));
    const capturing=screen().camera.captureCameraPhoto();await flush();
    screen().actions.cancelScreenCameraPicker();await flush();
    await request("twitter","library");const newerId=screen().media.request.id;
    release();await capturing;await flush();
    assert.equal(screen().media.request.id,newerId);assert.equal(screen().media.request.selectedMediaId,null);assert.equal(attachment("twitter"),null);
    view.onUserActivity();await tick(60000);
    assert.equal(screen().media.request.id,newerId,"scheduled notifications and auto-sleep preserve request ownership");
    assert.equal(draft("twitter"),"draft-twitter");
    assert.equal(sceneSelections,run+1);
    // Keep an unresolved capture across reset; it must not block session two.
    if(screen().display.session.phase==='sleeping'){view.powerControl.begin();view.powerControl.end();await flush();screen().actions.completeScreenUnlock();await flush();screen().actions.attemptScreenPasscode(screen().display.session.passcode);await flush();}
    if(screen().display.session.phase==='locked'){screen().actions.completeScreenUnlock();await flush();screen().actions.attemptScreenPasscode(screen().display.session.passcode);await flush();}
    screen().actions.cancelScreenCameraPicker();await flush();await request('twitter','camera');
    let releaseAcrossSession;
    walk(tree).find(node=>node.type?.name==='AmbientWorld').props.onCameraCaptureReady(snapshot=>new Promise(resolve=>{releaseAcrossSession=()=>resolve({snapshot,blob:new Blob(['stale-session'])});}));
    const acrossSession=screen().camera.captureCameraPhoto();await flush();
    previousCapture={release:releaseAcrossSession,promise:acrossSession,sessionId};
    // End with an active request. Same completed reset boundary clears everything.
    await tick(900000-screen().display.elapsed);
    assert.equal(view.lifecycle.phase,"power-loss");
    for(const from of ["power-loss","returning","recharging"]){view.onLifecycleAction({type:"ADVANCE_RETURN",from});await flush();}
    // A published user tweet correctly invokes the existing optional text-only outro.
    const outro=walk(tree).find(node=>node.type?.name==="PublicTwitterOutro");
    if (process.argv.includes("--production")) {
      assert.equal(outro,undefined,"production never waits for a disabled public preview");
    } else {
      assert.ok(outro,"media tweet retains existing public-intent/reset semantics");
      outro.props.onComplete();await flush();
    }
    assert.equal(view.lifecycle.phase,"identity");assert.equal(screen().media.request,null);
    assert.deepEqual(screen().apps.messagesState.pendingAttachments,{});
    assert.equal(screen().apps.facebookState.pendingAttachment,null);
    assert.equal(screen().apps.twitterState.pendingAttachment,null);
    assert.equal(screen().apps.tumblrState.pendingAttachment,null);
    assert.equal(screen().apps.tumblrState.composerContent,"");
    assert.equal(screen().apps.tumblrState.posts.some(p=>p.attachment),false);
    assert.equal(screen().apps.flickrState.pendingUpload,null);
    assert.equal(screen().apps.flickrState.upload,null);
    assert.equal(screen().apps.flickrState.currentView,"home");
    assert.equal(screen().apps.flickrState.photos.filter(p=>p.origin==="live").length,0);
    assert.deepEqual(screen().apps.flickrState.recentSearches,[]);
  }
  if(previousCapture){const before=captureSequence;previousCapture.release();await previousCapture.promise;await flush();assert.equal(captureSequence,before);}
  assert.equal(sceneSelections,2);assert.equal(initializeCount,2);
  slots.forEach(slot=>slot?.cleanup?.());
  assert.equal(timers.size,0);
  console.log("PASS: Shared Media A–R + routing through real Facebook/Twitter/Messages controls; Mom/Dad context, background request supersession, capture/library/cancel/draft/publication, Home/Power, stale capture, same scene, public outro and two resets. Safari pixels pending.");
} finally { Date.now=realDateNow;performance.now=realPerformanceNow;await server.close(); }
