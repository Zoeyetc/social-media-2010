import assert from "node:assert/strict";
import { createServer } from "vite";
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:"custom",logLevel:"silent"});
try {
  const {createSystemAppLaunch,launchDuration,launchGeometry,captureIconOrigin,logicalPoint}=await server.ssrLoadModule("/src/device/systemAppLaunch.ts");
  const {screenQuadMatrix}=await server.ssrLoadModule("/src/hero/screenPortalMath.ts");
  let now=10, view=null, changes=0;
  const owner=createSystemAppLaunch(state=>{view=state;changes++;},()=>now);
  const origin={x:17,y:405,width:59,height:60,center:{x:46.5,y:435}};
  const token=owner.begin("messages",origin,false);
  assert.equal(view.phase,"preparing"); assert.equal(view.originRect,origin);
  assert.equal(owner.begin("camera",origin,false),null,"synchronous claim blocks double tap before React commits");
  assert.equal(owner.complete(token),false,"readiness boundary cannot be skipped");
  now=45; assert.equal(owner.prepared(token,false),true);
  assert.equal(view.phase,"animating"); assert.equal(owner.snapshot().liveAppReadyAt,45);
  assert.equal(owner.prepared(token,false),false,"late decode cannot restart animation");
  now+=launchDuration(false); assert.equal(owner.complete(token),true);
  assert.equal(view,null,"one state update removes snapshot and releases live input");
  assert.equal(owner.snapshot().animationCompletedAt,325);
  const count=changes; assert.equal(owner.complete(token),false); assert.equal(changes,count);
  const reduced=owner.begin("photos",origin,true); assert.equal(launchDuration(true),1);
  assert.equal(view.phase,"preparing"); assert.equal(owner.complete(reduced),false);
  owner.prepared(reduced,true); assert.equal(owner.snapshot().fallbackUsed,true); owner.complete(reduced);
  for(const reason of ["Home","Power","reset","session end","resize","orientation"]) {
    const old=owner.begin(reason,origin,false); owner.reset();
    assert.equal(view,null); assert.equal(owner.snapshot(),null);
    assert.equal(owner.prepared(old,false),false); assert.equal(owner.complete(old),false);
  }
  owner.observe("twitter","resume"); assert.equal(owner.snapshot().launchKind,"resume"); assert.equal(owner.active,null);
  owner.observe("facebook","notification"); assert.equal(owner.snapshot().originRect,null); assert.equal(owner.active,null);
  const geometry=launchGeometry(origin); assert.equal(geometry.top,20); assert.equal(geometry.height,460);
  assert.equal(geometry.end,"translate(0px, 0px) scale(1)"); assert.match(geometry.start,/translate\(-113.5px, 185px\) scale\(/);
  assert.equal(launchGeometry(origin,true).height,480);

  // Real capture API with projected DOM probes. No app-name lookup or grid/dock constants.
  const matrix=screenQuadMatrix([{x:150,y:50},{x:650,y:90},{x:590,y:720},{x:110,y:660}],320,480);
  function projected(x,y) {const w=matrix[3]*x+matrix[7]*y+matrix[15];return{left:(matrix[0]*x+matrix[4]*y+matrix[12])/w,top:(matrix[1]*x+matrix[5]*y+matrix[13])/w};}
  function element(logicalX,logicalY) {
    return {ownerDocument:{createElement:()=>({style:{cssText:""},remove(){}})},appendChild(probe){
      const left=Number(probe.style.cssText.match(/left:([^p]+)px/)[1]),top=Number(probe.style.cssText.match(/top:([^p]+)px/)[1]);
      probe.getBoundingClientRect=()=>projected(logicalX+left,logicalY+top);
    }};
  }
  const screen=element(0,0);
  for(const [x,y,width,height] of [[17,36,59,60],[245,300,57,57],[17,405,59,60],[100,190,59,60]]) {
    const button=element(x,y),icon={offsetLeft:1,offsetTop:1,offsetWidth:width,offsetHeight:height,offsetParent:button};
    button.closest=()=>screen; button.querySelector=()=>icon;
    const rect=captureIconOrigin(button);
    for(const [actual,expected] of [[rect.x,x+1],[rect.y,y+1],[rect.width,width],[rect.height,height]]) assert.ok(Math.abs(actual-expected)<1e-8);
    const point=projected(x,y),logical=logicalPoint(matrix,point.left,point.top);
    assert.ok(Math.abs(logical.x-x)<1e-8 && Math.abs(logical.y-y)<1e-8);
  }
  console.log("PASS: system cold-launch ownership, synchronous tap claim, readiness/handoff ordering, stale completion/reset, reduced motion, separate resume/notification records, grid/page/dock/folder perspective origins and full viewport geometry.");
} finally {await server.close();}
