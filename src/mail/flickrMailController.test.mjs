import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFile } from "node:fs/promises";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
try {
  const { FlickrMailController, createMailTransport } = await server.ssrLoadModule("/src/mail/flickrMailController.ts");
  const { memorialBody, memorialNote, MAIL_SUBJECT } = await server.ssrLoadModule("/src/mail/flickrMailContract.ts");
  const { createInitialFlickrState, flickrStateTransition } = await server.ssrLoadModule("/src/state/flickrState.ts");
  const { FlickrContainer } = await server.ssrLoadModule("/src/device/FlickrContainer.tsx");
  const { IOS4KeyboardSystem } = await server.ssrLoadModule("/src/device/IOS4KeyboardSystem.tsx");
  const { SessionIdentityContext } = await server.ssrLoadModule("/src/state/sessionIdentity.ts");
  let state = createInitialFlickrState(); const photo = state.photos[0];
  state = flickrStateTransition(state, { type: "OPEN_PHOTO", photoId: photo.id, origin: { view: "recent" } });
  const original = JSON.stringify(state), image = {mediaId:photo.mediaId,filename:"Flickr-photo.png",contentType:"image/png",base64:"cGhvdG8="};
  let sends = [], images = [], deliver = async () => ({accepted:true,mode:"real"});
  const mail = new FlickrMailController({configuration:async()=>({enabled:true,replyEnabled:true,mode:"real"}),image:async p=>{images.push(p);return image;},send:async p=>{sends.push(p);return deliver(p);}});
  const render = () => renderToStaticMarkup(createElement(SessionIdentityContext.Provider,{value:{name:"Visitor"}},createElement(IOS4KeyboardSystem,{},createElement(FlickrContainer,{state,dispatch:()=>assert.fail("Mail must not dispatch Flickr mutations"),mail,experienceSessionId:"session-a"}))));
  assert.match(render(),/<button aria-label="Email photo"/);
  const source = await readFile(new URL("../device/FlickrContainer.tsx",import.meta.url),"utf8");
  assert.match(source,/mail.open\(selected, experienceSessionId\)/);
  await mail.open(photo,"session-a");
  assert.equal(mail.state.to,""); assert.equal(mail.state.subject,MAIL_SUBJECT);assert.equal(mail.state.body,"");assert.equal(mail.canSend,false);
  assert.deepEqual(mail.state.photo,{id:photo.id,mediaId:photo.mediaId,src:photo.src,title:photo.title});
  let html=render();assert.match(html,/New Message/);assert.match(html,/inputMode="none"/i);assert.match(html,/data-media-id=/);assert.match(html,/Sent from Flickr for iPhone/);assert.match(html,/data-content-layer="product"/);assert.doesNotMatch(html,/type="email"|mailto:/);
  for (const address of ["","bad","a@","a@b","a@example.test,b@example.test","a@example.test\r\nBcc:x@y.test"]) {mail.edit("to",address);assert.equal(mail.canSend,false);await mail.send();}
  assert.equal(sends.length,0);
  mail.edit("to","recipient@example.test");mail.edit("body","Hello"); assert.equal(mail.canSend,true);
  mail.cancel();assert.equal(mail.state,null);assert.equal(sends.length,0);assert.equal(JSON.stringify(state),original);
  assert.match(render(),/flickr-toolbar/);
  await mail.open(photo,"session-a");mail.edit("to","recipient@example.test");
  let finish;deliver=()=>new Promise(resolve=>{finish=resolve;});
  const pending=mail.send();await mail.send();while(!finish)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sends.length,1);assert.equal(mail.state.status,"sending");assert.equal(sends[0].image,image);assert.equal(images[0].src,photo.src);assert.equal(images[0].mediaId,photo.mediaId);
  finish({accepted:true,mode:"real"});await pending;assert.equal(mail.state,null);assert.equal(JSON.stringify(state),original);
  await mail.open(photo,"session-b");mail.edit("to","recipient@example.test");mail.edit("body","Keep this draft");
  deliver=async()=>{throw Error("Network failed");};await mail.send();const failed=sends.at(-1);
  assert.equal(mail.state.status,"error");assert.equal(mail.state.body,"Keep this draft");assert.equal(mail.state.to,"recipient@example.test");assert.equal(mail.state.locked,true);assert.equal(mail.canSend,true);
  const imageCount=images.length;deliver=async()=>({accepted:true,mode:"real"});await mail.send();assert.strictEqual(sends.at(-1),failed);assert.equal(images.length,imageCount);assert.equal(mail.state,null);
  await mail.open(photo,"session-c");mail.edit("to","recipient@example.test");finish=null;deliver=()=>new Promise(resolve=>{finish=resolve;});const stale=mail.send();while(!finish)await new Promise(resolve=>setImmediate(resolve));mail.reset();finish({accepted:true,mode:"real"});await stale;assert.equal(mail.state,null);
  await mail.open(photo,"session-d");mail.edit("to","recipient@example.test");deliver=async()=>({accepted:false,mode:"mock"});await mail.send();assert.equal(mail.state.status,"error");assert.match(mail.state.error,/no real email/);mail.cancel();assert.equal(mail.state,null);
  const disabled=new FlickrMailController({configuration:async()=>({enabled:false,replyEnabled:false,mode:"unconfigured"}),image:()=>assert.fail(),send:()=>assert.fail()});await disabled.open(photo,"s");disabled.edit("to","recipient@example.test");await disabled.send();assert.match(disabled.state.error,/not configured/);disabled.reset();
  const formatted=memorialBody("Hello",true);assert.equal(memorialBody(formatted,true),formatted);assert.ok(formatted.endsWith(memorialNote(true)));assert.equal((formatted.match(/Sent from SOCIAL MEDIA, 2010/g)||[]).length,1);assert.match(memorialNote(false),/not monitored/);assert.doesNotMatch(memorialNote(false),/welcome to reply/);
  // Browser transport sends original local bytes; never fetch an arbitrary host.
  const oldFetch=globalThis.fetch, oldLocation=globalThis.location;
  try {globalThis.location={origin:"http://localhost:5175"};let urls=[];const bytes=new Uint8Array([137,80,78,71]);globalThis.fetch=async url=>{urls.push(url);return new Response(bytes,{headers:{"Content-Type":"image/png"}});};
    const transport=createMailTransport();const resource=await transport.image({...photo,src:"/photo.png"},new AbortController().signal);assert.equal(resource.base64,Buffer.from(bytes).toString("base64"));assert.equal(resource.mediaId,photo.mediaId);
    await assert.rejects(transport.image({...photo,src:"https://elsewhere.test/a.png"},new AbortController().signal));assert.equal(urls.length,1);
  } finally {globalThis.fetch=oldFetch;if(oldLocation===undefined)delete globalThis.location;else globalThis.location=oldLocation;}
  assert.equal(JSON.stringify(state),original);assert.ok(!original.includes("recipient@example.test"));
  console.log("PASS: Flickr mail A–N: current-photo composer/attachment, validation/defaults, footer once, cancel, single send/double tap, failure/retry, reset/privacy, mock honesty, shared keyboard SSR and local bytes.");
} finally {await server.close();}
