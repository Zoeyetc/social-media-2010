import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'vite';
let gate;
globalThis.__smallHooks={useReducer(reducer,_,init){gate??=init();return [gate,event=>{gate=reducer(gate,event)}]},useEffect(fn){fn()}};
const server=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent',plugins:[{name:'small-app-hooks',enforce:'pre',transform(code,id){if(id.endsWith('/src/device/SmallApps.tsx'))return code.replace('import { useEffect, useReducer, type Dispatch } from "react";','import type { Dispatch } from "react"; const {useEffect,useReducer}=globalThis.__smallHooks;')}}]});
const walk=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)];
try{
 const m=await server.ssrLoadModule('/src/state/smallApps.ts');
 const ui=await server.ssrLoadModule('/src/device/SmallApps.tsx');
 const seed=readFileSync(new URL('../data/sessionSeedContent.ts',import.meta.url),'utf8');
 assert.match(seed,/author: juneCanonicalCommentAuthor\("jack"\), text: "Nope\."/);assert.doesNotMatch(seed,/拒絕/);
 const weatherTree=ui.WeatherContainer({state:m.initialSmallApps(),simulatedTime:new Date("2010-10-20T07:02:00Z")});
 assert.ok(walk(weatherTree).some(n=>n.props?.["aria-label"]=== "62 degrees Fahrenheit"));
 for(const file of ["../device/SpringBoard.tsx","../device/MultitaskingBar.tsx"]){const source=readFileSync(new URL(file,import.meta.url),"utf8");assert.match(source,/import \{ WEATHER \}/);assert.match(source,/weather-icon-temperature/);if(file.includes("MultitaskingBar")) assert.match(source,/\{WEATHER.temperature\}°/);else { assert.match(source,/className="weather-icon-digits" aria-hidden="true">\{WEATHER.temperature\}<span className="weather-icon-degree">°<\/span>/); }}
 const weatherCss=readFileSync(new URL('../styles/device.css',import.meta.url),'utf8');
 assert.match(weatherCss,/\.weather-icon-digits \{[^}]*left:50%;[^}]*transform:translateX\(-50%\)/);
 assert.match(weatherCss,/\.weather-icon-degree \{[^}]*position:absolute; left:100%; top:-1px; margin-left:\.5px; font-size:8px/);
 const springboardTemperature=weatherCss.match(/\.springboard-icon-slot\[data-app-name="Weather"\] > \.weather-icon-temperature \{([^}]+)\}/)?.[1];
 assert.ok(springboardTemperature);assert.match(springboardTemperature,/background:none/);assert.match(springboardTemperature,/font:300 11px\/13px/);assert.match(springboardTemperature,/top:43px/);assert.match(springboardTemperature,/width:59px/);assert.match(springboardTemperature,/text-align:center/);assert.match(springboardTemperature,/text-shadow:0 1px 0 /);
 let state=m.initialSmallApps();const dispatch=e=>state=m.smallAppsTransition(state,e);
 assert.equal(weatherTree.props['data-board'],'night');
 const {simulatedDeviceDateTime}=await server.ssrLoadModule('/src/state/deviceMachine.ts');
 for(const elapsed of [0,450000,900000]) assert.equal(m.weatherBoardForTime(simulatedDeviceDateTime(elapsed)),'night');
 for(const [time,board] of [['2010-10-20T12:59:00Z','night'],['2010-10-20T13:00:00Z','day'],['2010-10-21T00:59:00Z','day'],['2010-10-21T01:00:00Z','night']]) assert.equal(m.weatherBoardForTime(new Date(time)),board);
 const realNow=Date.now;Date.now=()=>Date.parse('2026-07-20T19:00:00Z');
 try{assert.equal(m.weatherBoardForTime(simulatedDeviceDateTime(0)),'night')}finally{Date.now=realNow}
 assert.equal(m.WEATHER_FORECAST.length,6);assert.deepEqual(m.WEATHER_DAY_RANGE,{high:66,low:61});
 assert.deepEqual(m.WEATHER_FORECAST.map(day=>[day.date,day.high,day.low,day.precipitation]),[
  ['2010-10-20',66,61,.10],['2010-10-21',66,62,0],['2010-10-22',67,61,0],['2010-10-23',68,60,.01],['2010-10-24',68,58,.10],['2010-10-25',75,62,.08]]);
 assert.deepEqual(m.WEATHER_FORECAST.map(day=>day.condition),['Light Rain','Cloudy','Cloudy','Chance of Rain','Light Rain','Showers']);
 const rows=walk(weatherTree).filter(n=>n.type==='li');assert.equal(rows.length,6);
 rows.forEach((row,index)=>{assert.equal(walk(row).find(n=>n.type==='b').props.children[0],m.WEATHER_FORECAST[index].high);assert.ok(!JSON.stringify(row).includes('—'))});
 const forecastSnapshot=JSON.stringify(m.WEATHER_FORECAST);
 assert.deepEqual(m.smallAppsTransition(m.initialSmallApps(),{type:'RESET'}),m.initialSmallApps());
 assert.equal(JSON.stringify(m.WEATHER_FORECAST),forecastSnapshot);
 assert.match(readFileSync(new URL('../device/DeviceScreen.tsx',import.meta.url),'utf8'),/WeatherContainer state=\{apps.smallApps\} simulatedTime=\{deviceDateTime\}/);
 assert.deepEqual(state.weather,{city:'Los Angeles',temperature:62,condition:'Light Rain'});
 for(let run=0;run<2;run++){
  dispatch({type:'CREATE'});const id=state.selected;
  let tree=ui.NotesContainer({state,dispatch});const editor=walk(tree).find(n=>n.props?.keyboardInputId===`notes-${id}`);assert.ok(editor);
  editor.props.onValueChange('Hello\nworld');assert.equal(state.notes[0].text,'Hello\nworld');
  dispatch({type:'LIST'});dispatch({type:'OPEN',id});assert.equal(state.selected,id);assert.equal(state.notes[0].text,'Hello\nworld');
  dispatch({type:'CREATE'});dispatch({type:'DELETE',id:state.selected});assert.equal(state.notes.length,1);
  dispatch({type:'RESET'});assert.deepEqual(state,m.initialSmallApps());
 }
 // Exercise both actual gate components with all network/persistence/log sinks forbidden.
 const oldFetch=globalThis.fetch, oldConsole=globalThis.console;
 const forbid=()=>{throw Error('credential side effect')};
 globalThis.fetch=forbid;globalThis.XMLHttpRequest=function(){forbid()};globalThis.localStorage=globalThis.sessionStorage={getItem:forbid,setItem:forbid};
 globalThis.console={...oldConsole,log:forbid,info:forbid,warn:forbid,error:forbid};
 try {for(const app of ['app-store','game-center']){
  gate=undefined;let active=true;const render=()=>ui.AppleAccountGate({app,active});
  const click=(label)=>{const n=walk(render()).find(n=>n.type==='button'&&(n.props['aria-label']===label||n.props.children===label));assert.ok(n,label);n.props.onClick()};
  click('Sign In');click('Use example Apple ID');click('Use example password');assert.equal(gate.examplePassword,true);
  const dialog=walk(render()).find(n=>n.props?.role==='dialog');const sign=walk(dialog).find(n=>n.type==='button'&&n.props.children==='Sign In');sign.props.onClick();
  assert.deepEqual(gate,{phase:'failed',exampleId:false,examplePassword:false});assert.ok(walk(render()).find(n=>n.props?.role==='alert'));
  click('OK');click('Sign In');click('Use example password');click('Cancel');assert.deepEqual(gate,m.initialAccountGate());
  click('Sign In');click('Use example password');active=false;render();assert.deepEqual(gate,m.initialAccountGate());
  gate=m.accountGateTransition(gate,'RESET');assert.deepEqual(gate,m.initialAccountGate());
  assert.ok(walk(render()).every(n=>!['input','textarea','form'].includes(n.type)),'no actual credential input/autofill surface');
 }}finally{globalThis.fetch=oldFetch;globalThis.console=oldConsole;}
 for(const file of ['smallApps.ts','../device/SmallApps.tsx']){const source=readFileSync(new URL(file,import.meta.url),'utf8');assert.doesNotMatch(source,/\b(fetch|XMLHttpRequest|localStorage|sessionStorage|indexedDB|console|sendBeacon|geolocation)\b/)}
 const app=readFileSync(new URL('../device/App.tsx',import.meta.url),'utf8');assert.match(app,/dispatchSmallApps\(\{ type: "RESET" \}\)/);
 for(const [id,name] of [['weather','Weather'],['notes','Notes'],['app-store','App Store'],['game-center','Game Center']]){
  const board=readFileSync(new URL('../device/SpringBoard.tsx',import.meta.url),'utf8');assert.match(board,new RegExp(`name: "${name}"[^\\n]+launchId: "${id}"`));
  const bar=readFileSync(new URL('../device/MultitaskingBar.tsx',import.meta.url),'utf8');assert.ok(bar.includes(`id:"${id}"`));
 }
 console.log('PASS: Jack copy; Weather defaults/reset; Notes keyboard create/edit/list/delete/reset; both actual account gates reject sign-in, clear example state on cancel/leave/reset, and invoke no credential sinks.');
}finally{await server.close();delete globalThis.__smallHooks;}
