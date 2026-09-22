import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createServer} from "vite";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
const server=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent"});
try {
 const tw=await server.ssrLoadModule('/src/state/twitterState.ts');
 const events=(await server.ssrLoadModule('/src/data/sessionTimeline.ts')).buildSessionTimelineEvents();
 let state=tw.createInitialTwitterState('Z');
 const profile=id=>tw.selectTwitterUserProfile(state,id,'Z');
 assert.deepEqual([profile('session-owner').tweetCount,profile('session-owner').followingCount,profile('session-owner').followerCount,profile('session-owner').favoriteCount],[0,4,12,7]);
 for(let i=1;i<=2;i++) {
  state=tw.twitterStateTransition(state,{type:'BEGIN_NEW_TWEET'});
  state=tw.twitterStateTransition(state,{type:'EDIT_COMPOSER',value:`hello ${i}`});
  state=tw.twitterStateTransition(state,{type:'SUBMIT_NEW_TWEET',displayName:'Z',createdAt:i,timestamp:'12:02 AM'});
  assert.equal(profile('session-owner').tweetCount,i);
 }
 for(const id of ['matt','alex','jay']) {
  const count=new Set([...state.timeline,...state.mentionTweets,...state.linkedTweets].filter(t=>t.friendId===id).map(t=>t.id)).size;
  assert.equal(profile(id).tweetCount,count);assert.ok(count>0);
  for(const field of ['followingCount','followerCount','favoriteCount'])assert.equal(profile(id)[field],undefined);
  const duplicated={...state,timeline:[...state.timeline,...state.timeline],mentionTweets:[...state.mentionTweets,...state.timeline]};
  assert.equal(tw.selectTwitterUserProfile(duplicated,id,'Z').tweetCount,count);
 }
 for(const id of ['matt','jay']) {
  const old=profile(id).tweetCount, event=events.find(e=>e.payload?.kind==='twitter-post' && e.payload.post.friendId===id);
  for(let i=0;i<2;i++)state=tw.twitterStateTransition(state,{type:'DELIVER_TIMELINE_TWEET',tweet:event.payload.post});
  assert.equal(profile(id).tweetCount,old+1);
 }
 state=tw.twitterStateTransition(state,{type:'RESET',displayName:'Z'});assert.equal(profile('session-owner').tweetCount,0);
 const rc=await server.ssrLoadModule('/src/state/rcSystemApps.ts');
 const ui=await server.ssrLoadModule('/src/device/RCSystemApps.tsx');
 const initial=rc.initialRCSystemApps();let apps=initial;
 for(const stock of rc.STOCKS){apps=rc.rcSystemAppsTransition(apps,{type:'STOCK_SELECT',symbol:stock.symbol});assert.equal(apps.stockSymbol,stock.symbol);assert.ok(stock.chart.length>2);assert.ok(renderToStaticMarkup(React.createElement(ui.StocksContainer,{state:apps,dispatch(){}})).includes(stock.symbol+' reconstructed price chart'));}
 assert.equal(rc.rcSystemAppsTransition(apps,{type:'STOCK_SELECT',symbol:'unapproved'}),apps);
 const {DeviceAudio}=await server.ssrLoadModule('/src/audio/deviceAudio.ts');let mode='silent';const unbind=DeviceAudio.bindAudioMode(()=>mode);DeviceAudio.setVolume(.5);
 apps=rc.rcSystemAppsTransition(apps,{type:'SETTINGS_ROUTE',route:'sounds'});
 const sounds=()=>renderToStaticMarkup(React.createElement(ui.SettingsContainer,{state:apps,dispatch(){}}));
 assert.match(sounds(),/Silent/);assert.match(sounds(),/aria-valuenow="0.5"/);
 mode='ringer';DeviceAudio.setVolume(.625);assert.match(sounds(),/>On</);assert.match(sounds(),/aria-valuenow="0.625"/);unbind();
 for(const route of ['wallpaper','general','root']){apps=rc.rcSystemAppsTransition(apps,{type:'SETTINGS_ROUTE',route});assert.equal(apps.settingsRoute,route);}
 const settings=renderToStaticMarkup(React.createElement(ui.SettingsContainer,{state:apps,dispatch(){}}));assert.equal((settings.match(/aria-disabled="true"/g)||[]).length,4);
 assert.deepEqual(rc.rcSystemAppsTransition(apps,{type:'RESET'}),initial);
 for(const path of ['src/state/rcSystemApps.ts','src/device/RCSystemApps.tsx'])assert.doesNotMatch(readFileSync(path,'utf8'),/fetch\(|XMLHttpRequest|setVolume\(|bindAudioMode\(/);
 const fs=await server.ssrLoadModule('/src/state/foursquareState.ts'), map=await server.ssrLoadModule('/src/state/basicSystemApps.ts');
 const venues=fs.createInitialFoursquareState().venues;
 for(const id of map.MAP_ELIGIBLE_FOURSQUARE_IDS){assert.equal(venues.filter(v=>v.id===id).length,1);assert.equal(venues.find(v=>v.id===id).name,map.resolveSystemMapVenue(id).venue.name);}
 for(const [id,name] of [['gelato-roma','Gelato Roma'],['hk','HK']])assert.equal(venues.find(v=>v.id===id).name,name);
 assert.deepEqual(fs.foursquareStateTransition({...fs.createInitialFoursquareState(),selectedVenueId:'hk'},{type:'RESET'}),fs.createInitialFoursquareState());
 console.log('PASS: derived Twitter counts; six shared venues; reconstructed Stocks; read-only shared Settings and resets');
} finally {await server.close();}
