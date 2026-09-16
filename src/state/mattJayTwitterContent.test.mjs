import assert from "node:assert/strict";
import { createServer } from "vite";
const server = await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent"});
try {
  const tw = await server.ssrLoadModule("/src/state/twitterState.ts");
  const {CORE_SOCIAL_CHARACTERS} = await server.ssrLoadModule("/src/data/coreSocialFriends.ts");
  const {buildSessionTimelineEvents} = await server.ssrLoadModule("/src/data/sessionTimeline.ts");
  const {nextDueDeviceEvent,removeDeviceEvent,scheduleDeviceEvents} = await server.ssrLoadModule("/src/state/deviceEventScheduler.ts");
  const {simulatedDeviceDateTime} = await server.ssrLoadModule("/src/state/deviceMachine.ts");
  const baseline = tw.createInitialTwitterState("Zoey");
  const ids = ["late-night-matt","matt-jacks-party","matt-back-to-the-mac","matt-phone-battery","jay-halcyon-digest","jay-new-sufjan-record","jay-cmj-bands"];
  for (const id of ids) {
    const rows = baseline.timeline.filter(t=>t.id===id);
    assert.equal(rows.length,1,id);
    assert.equal(rows[0].displayName,CORE_SOCIAL_CHARACTERS[rows[0].friendId].displayName);
  }
  const locked = [
    ["late-night-matt", "11:41 PM", "one missing semicolon and suddenly nothing works"],
    ["matt-jacks-party", "8:30 PM", "jack's party sounds exhausting lol"],
    ["matt-back-to-the-mac", "10:47 PM", "really curious what apple means by “back to the mac”"],
    ["matt-phone-battery", "11:16 PM", "my phone battery is somehow worse when i actually need it"],
    ["jay-halcyon-digest", "9:38 PM", "halcyon digest sounds way better with headphones"],
    ["jay-new-sufjan-record", "10:21 PM", "the new sufjan record is completely insane"],
    ["jay-cmj-bands", "11:23 PM", "spent an hour looking up bands playing cmj and now i want to be in new york"],
  ];
  for(const [id,time,text] of locked) {
    const tweet=baseline.timeline.find(t=>t.id===id);
    assert.deepEqual([tweet.timestamp,tweet.text],[time,text]);
    assert.equal(tweet.origin,"seed");
  }
  const {resolveTwitterAvatar} = await server.ssrLoadModule("/src/data/twitterAvatarRegistry.ts");
  assert.equal(resolveTwitterAvatar({identityId:"jay",displayName:"Jay Diaz"}).identityId,"twitter-default");
  assert.deepEqual(baseline.timeline,tw.sortTwitterTimeline([...baseline.timeline].reverse()));
  assert.equal(baseline.replies.length,1);
  assert.deepEqual(baseline.replies[0],{id:"jay-reply-matt-nerd",targetTweetId:"matt-back-to-the-mac",friendId:"jay",displayName:"Jay Diaz",text:"nerd",timestamp:"2010-10-19T22:51:00-07:00",origin:"seed"});
  const detail=tw.twitterStateTransition(baseline,{type:"OPEN_TWEET",tweetId:"matt-back-to-the-mac",scrollPosition:120});
  assert.equal(detail.replies.filter(r=>r.targetTweetId===detail.selectedTweetId)[0].text,"nerd");
  const jay=tw.selectTwitterUserProfile(baseline,"jay","Zoey");
  assert.equal(jay.handle,"@jaydiaz");
  assert.equal(tw.getTwitterUserProfile("Jay Diaz","Zoey").id,"jay");
  for(const field of ["bio","followerCount","followingCount"]) assert.equal(jay[field],undefined);
  const expected=[["twitter-matt-mac-rumors","matt-mac-rumors",220],["twitter-jay-headphones","jay-headphones-late",760]];
  let state=baseline;
  for(let run=0;run<2;run++) {
    state=tw.twitterStateTransition(state,{type:"RESET",displayName:"Zoey"});
    assert.deepEqual(state.timeline,baseline.timeline);
    assert.deepEqual(state.replies,baseline.replies);
    let queue=scheduleDeviceEvents(buildSessionTimelineEvents(),buildSessionTimelineEvents());
    for(const [id,postId,second] of expected) {
      const event=queue.find(e=>e.id===id);
      assert.equal(event.dueElapsedMs,second*1000);
      assert.equal(event.payload.post.createdAt,simulatedDeviceDateTime(second*1000).getTime());
      assert.equal(event.payload.post.displayName,CORE_SOCIAL_CHARACTERS[event.payload.post.friendId].displayName);
      assert.ok(!state.timeline.some(t=>t.id===postId));
    }
    for(const time of [219000,220000,220000,759000,760000,899000,899000]) {
      let event;
      while((event=nextDueDeviceEvent(queue,time))) {
        if(event.payload?.kind==="twitter-post") {
          state=tw.twitterStateTransition(state,{type:"DELIVER_TIMELINE_TWEET",tweet:event.payload.post});
          state=tw.twitterStateTransition(state,{type:"DELIVER_TIMELINE_TWEET",tweet:event.payload.post});
        }
        queue=removeDeviceEvent(queue,event.id);
      }
      state=tw.twitterStateTransition(state,{type:"SHOW_TAB",tab:"messages"});
      state=tw.twitterStateTransition(state,{type:"SHOW_TAB",tab:"timeline"});
    }
    for(const [,id] of expected) assert.equal(state.timeline.filter(t=>t.id===id).length,1);
    assert.deepEqual(state.timeline,tw.sortTwitterTimeline(state.timeline));
    assert.equal(nextDueDeviceEvent(buildSessionTimelineEvents(),900000),null);
    assert.equal(nextDueDeviceEvent(buildSessionTimelineEvents(),950000),null);
  }
  console.log("PASS: Matt/Jay seeds, reply, identity, ordering, exactly-once delivery, two runs and terminal cutoff");
} finally {await server.close();}
