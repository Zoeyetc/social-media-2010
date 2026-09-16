import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { validatePageInputs } from '../../scripts/validate-page-inputs.mjs';
await validatePageInputs();
const server = await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try {
  const {scheduleDeviceEvent, nextDueDeviceEvent, removeDeviceEvent} = await server.ssrLoadModule('/src/state/deviceEventScheduler.ts');
  const {buildSessionTimelineEvents} = await server.ssrLoadModule('/src/data/sessionTimeline.ts');
  const {SESSION_DURATION_MS} = await server.ssrLoadModule('/src/state/deviceMachine.ts');
  for (let run=0; run<2; run++) {
    let queue = buildSessionTimelineEvents();
    const claims = new Set();
    function deliver(at) {
      let event;
      while ((event=nextDueDeviceEvent(queue, at))) {
        claims.add(event.id);
        queue=removeDeviceEvent(queue,event.id);
      }
    }
    deliver(890000);
    assert.ok(claims.has('twitter-terminal-goodnight-world'));
    for (const type of ['momReply','momLoveReply','dadLoveReply','facebookPartyInvite']) {
      const id=`late-${type}`;
      queue=scheduleDeviceEvent(queue,{id,type,dueElapsedMs:901000});
      assert.ok(!queue.some(e=>e.id===id));
      assert.ok(!claims.has(id));
    }
    queue=scheduleDeviceEvent(queue,{id:'valid-899',type:'momReply',dueElapsedMs:899000});
    deliver(899000); assert.ok(claims.has('valid-899'));
    queue=scheduleDeviceEvent(queue,{id:'boundary',type:'momReply',dueElapsedMs:SESSION_DURATION_MS});
    deliver(900000); deliver(901000); assert.ok(!claims.has('boundary'));
    const sleeping=[{id:'sleep-catchup',type:'momReply',dueElapsedMs:899000}];
    assert.equal(nextDueDeviceEvent(sleeping,895000),null);
    assert.equal(nextDueDeviceEvent(sleeping,901000),null);
  }
  const {createInitialTumblrState} = await server.ssrLoadModule('/src/state/tumblrState.ts');
  const seeds=createInitialTumblrState();
  assert.deepEqual(seeds.posts.map(post=>post.id), ['sunset-note','quote-post']);
  assert.deepEqual(seeds.notes, [{id:'tumblr-seed-note:sunset-note:1',sourcePostId:'sunset-note',blogName:'smallhours',type:'reblogged',origin:'seed'}]);
  const read = path => readFile(new URL(path, import.meta.url),'utf8');
  const app=await read('./App.tsx');
  assert.match(app,/session.phase === "shutdown" \|\| elapsed >= SESSION_DURATION_MS/);
  assert.match(app,/publicTwitterPreviewEnabled = import.meta.env.DEV/);
  assert.match(app,/publicTwitterPreviewEnabled \? createMockPublicTwitterRepository\(\) : null/);
  assert.match(app,/publicTwitterPreviewEnabled \? createMockPublicTwitterSubmissionRepository\(\) : null/);
  assert.match(app,/!publicTwitterPreviewEnabled \|\| eligibleTweetIds.length === 0/);
  assert.match(await read('./PublicTwitterOutro.tsx'),/has not been published to other visitors/);
  assert.match(await read('./MobileSMSContainer.tsx'),/type: "TOGGLE_LIST_EDIT"/);
  for (const path of ['./DeviceScreen.tsx','./FacebookContainer.tsx','./InstagramContainer.tsx','../data/sessionSeedContent.ts','../state/tumblrState.ts']) {
    assert.doesNotMatch(await read(path),/Power-off UI artwork: HOLD|Location HOLD|Individual rows remain HOLD/);
  }
  console.log('PASS: terminal admission/delivery, two scheduler sessions, exact input ownership and production boundaries.');
} finally { await server.close(); }
