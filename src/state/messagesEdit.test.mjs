import assert from "node:assert/strict";
import {createServer} from "vite";
const server=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent",plugins:[{name:"sms-test-hooks",enforce:"pre",transform(code,id){if(id.endsWith("/src/device/MobileSMSContainer.tsx"))return code.replace('import { Dispatch, useEffect, useRef } from "react";','import type { Dispatch } from "react"; const useRef=(value)=>({current:value}); const useEffect=()=>{};');}}]});
const walk=n=>!n||typeof n!=="object"?[]:Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)];
try {
 const m=await server.ssrLoadModule("/src/state/messagesState.ts");const {MobileSMSContainer}=await server.ssrLoadModule("/src/device/MobileSMSContainer.tsx");
 let s=m.createInitialMessagesState();const initial=s;const dispatch=e=>s=m.messagesStateTransition(s,e);
 const render=()=>MobileSMSContainer({state:s,dispatch,currentElapsedMs:0,currentDeviceDateTime:new Date("2010-10-20T07:02:00Z"),currentDeviceTime:"12:02",cameraPickerActive:false});
 const edit=()=>walk(render()).find(n=>n.props?.className==="mobilesms-list-edit-control");
 assert.equal(edit().props.children,"Edit");edit().props.onClick();assert.equal(edit().props.children,"Done");
 walk(render()).find(n=>n.props?.["aria-label"]==="Delete conversation with Dad").props.onClick();
 walk(render()).find(n=>n.props?.className==="mobilesms-delete-confirm").props.onClick();
 assert.ok(!s.messages.some(m=>m.conversationId==="dad"));assert.deepEqual(s.messages,initial.messages.filter(m=>m.conversationId!=="dad"));
 edit().props.onClick();assert.equal(s.editingConversations,false);
 dispatch({type:"RECEIVE_MESSAGE",id:"mom-home-yet",sender:"Mom",message:"Home yet?",timestamp:"12:03"});assert.equal(s.messages.filter(m=>m.conversationId==="mom").length,1);
 dispatch({type:"OPEN_CONVERSATION",conversationId:"mom"});dispatch({type:"EDIT_DRAFT",value:"yes"});dispatch({type:"SEND"});assert.equal(s.momReply,"pending");
 dispatch({type:"BACK_TO_LIST"});dispatch({type:"TOGGLE_LIST_EDIT"});dispatch({type:"SELECT_DELETE_CONVERSATION",conversationId:"mom"});dispatch({type:"DELETE_CONVERSATION",conversationId:"mom"});assert.equal(s.momReply,"pending");
 dispatch({type:"DELIVER_MOM_REPLY"});assert.equal(s.messages.find(m=>m.id==="mom-sleep-early").text,"Good. Sleep early.");
 dispatch({type:"OPEN_CONVERSATION",conversationId:"dad"});dispatch({type:"EDIT_DRAFT",value:"hello"});dispatch({type:"SEND"});assert.ok(s.messages.some(m=>m.id==="user-message-2"),"deletion cannot recycle outgoing IDs");
 for(let run=0;run<2;run++){dispatch({type:"RESET_RUNTIME"});assert.deepEqual(s,initial);dispatch({type:"TOGGLE_LIST_EDIT"});dispatch({type:"SELECT_DELETE_CONVERSATION",conversationId:"dad"});dispatch({type:"DELETE_CONVERSATION",conversationId:"dad"});assert.ok(!s.messages.some(m=>m.conversationId==="dad"));}
 console.log("PASS: actual Edit/Done/delete handlers, per-thread removal, later incoming resurrection, pending reply preservation, unique outgoing IDs and canonical reset");
}finally{await server.close();}
