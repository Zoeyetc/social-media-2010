// Real keyboard provider/binding code with deterministic hooks and focus events.
// Does not certify Safari hit testing or paint.
import assert from "node:assert/strict";
import { createServer } from "vite";
import { execFileSync } from "node:child_process";

let current, context, changed, input, draft, element;
const frames=[];
globalThis.document={activeElement:null};
globalThis.requestAnimationFrame=fn=>frames.push(fn);
const same=(a,b)=>a && b && a.length===b.length && a.every((v,i)=>Object.is(v,b[i]));
const host=()=>({slots:[],cursor:0,layout:[],passive:[]});
const effect=(fn,deps,kind)=>{
  const owner=current,i=owner.cursor++,previous=owner.slots[i];
  if(!same(previous?.deps,deps))owner[kind].push(()=>{previous?.cleanup?.();owner.slots[i]={deps,cleanup:fn()};});
};
const hooks={
  createContext:()=>({Provider:"test-context"}), forwardRef:fn=>fn, useContext:()=>context,
  useState(initial){const owner=current,i=owner.cursor++;owner.slots[i]??={value:typeof initial==="function"?initial():initial};return [owner.slots[i].value,value=>{const next=typeof value==="function"?value(owner.slots[i].value):value;if(!Object.is(next,owner.slots[i].value)){owner.slots[i].value=next;changed=true;}}];},
  useRef(value){const owner=current,i=owner.cursor++;return owner.slots[i]??={current:value};},
  useCallback(fn,deps){const owner=current,i=owner.cursor++;if(!same(owner.slots[i]?.deps,deps))owner.slots[i]={value:fn,deps};return owner.slots[i].value;},
  useEffect:(fn,deps)=>effect(fn,deps,"passive"),useLayoutEffect:(fn,deps)=>effect(fn,deps,"layout"),
};
globalThis.__mediaKeyboardHooks=hooks;
const server=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent",plugins:[{
  name:"keyboard-focus-host",enforce:"pre",
  resolveId:id=>id==="virtual:media-keyboard-hooks"?"\0media-keyboard-hooks":undefined,
  load:id=>id==="\0media-keyboard-hooks"?Object.keys(hooks).map(key=>`export const ${key}=globalThis.__mediaKeyboardHooks.${key};`).join("\n"):undefined,
  transform(code,id){if(id.endsWith("/src/device/IOS4KeyboardSystem.tsx")){
    if(process.env.MEDIA_KEYBOARD_BASELINE==="1")code=execFileSync("git",["show","HEAD:src/device/IOS4KeyboardSystem.tsx"],{encoding:"utf8"});
    return code.replace('from "react";','from "virtual:media-keyboard-hooks";');
  }},
}]});
try {
  const {IOS4KeyboardSystem,IOS4Textarea}=await server.ssrLoadModule("/src/device/IOS4KeyboardSystem.tsx");
  const walk=node=>!node||typeof node!=="object"?[]:Array.isArray(node)?node.flatMap(walk):[node,...walk(node.props?.children)];
  for(let loop=0;loop<2;loop++)for(const inputId of ["facebook-status","twitter-compose","messages-compose","flickr-upload-description","flickr-search","flickr-comment-photo","tumblr-photo-caption","tumblr-composer-text","tumblr-search"]){
    const provider=host(),binding=host();let tree,suspended=false,visible=false;
    draft="preserved draft";
    element={isConnected:true,selectionStart:4,selectionEnd:4,closest:()=>null,
      blur(){if(document.activeElement===this)document.activeElement=null;},
      focus(){document.activeElement=this;input.props.onFocus({});},
      setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;},
    };
    const render=()=>{
      for(let pass=0;pass<30;pass++){
        changed=false;current=provider;current.cursor=0;
        tree=IOS4KeyboardSystem({children:null,suspended,suspendReason:"navigation",onVisibilityChange:value=>{visible=value;}});
        context=tree.props.value;current=binding;current.cursor=0;
        input=IOS4Textarea({keyboardInputId:inputId,autoFocus:inputId==="facebook-status",value:draft,onValueChange:value=>{draft=value;changed=true;}},null);
        input.props.ref(element);
        for(const owner of [binding,provider]){const queue=owner.layout.splice(0);queue.forEach(fn=>fn());}
        for(const owner of [binding,provider]){const queue=owner.passive.splice(0);queue.forEach(fn=>fn());}
        if(!changed)return;
      }
      throw Error("keyboard registration did not settle");
    };
    render();element.focus();render();assert.equal(visible,true);
    assert.equal(context.state.activeInputId,inputId);
    for(const stage of ["source","camera","library"]){
      suspended=true;render();
      assert.equal(visible,false,`${inputId}/${stage}: media must own keyboard visibility`);
      assert.equal(context.state.activeInputId,null);
      assert.equal(document.activeElement,null,"suspension actually blurs, not just CSS hides");
      assert.equal(walk(tree).filter(node=>node.props?.className==="ios4-keyboard").length,0,"no media-obscuring keyboard subtree");
      element.focus();render();assert.equal(visible,false,"focus event cannot reacquire during media");
      while(frames.length)frames.shift()();render();assert.equal(visible,false);
      assert.equal(draft,"preserved draft");assert.equal(element.selectionStart,4);
      suspended=false;render();assert.equal(visible,false,"return does not force autofocus back open");
      element.focus();render();assert.equal(visible,true,"explicit refocus still works");
    }
    // A queued key-edit focus callback must not steal focus from a newly opened picker.
    const key=walk(tree).find(node=>node.props?.label==="Q");key.props.onPress();
    suspended=true;render();while(frames.length)frames.shift()();render();
    assert.equal(visible,false);assert.equal(document.activeElement,null);
    assert.equal(draft,"presqerved draft");
    [...binding.slots,...provider.slots].forEach(slot=>slot?.cleanup?.());
  }
  console.log("PASS: actual shared keyboard + bindings, 6 input owners × 3 media stages × 2 loops; blur, no reacquisition, no forced return focus, caret/draft retention, stale key-frame cancellation.");
}finally{await server.close();}
