import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const server=await createServer({server:{middlewareMode:true},appType:"custom",logLevel:"silent"});
try {
 const m=await server.ssrLoadModule("/src/state/basicSystemApps.ts");
 const {CANONICAL_VENUES}=await server.ssrLoadModule("/src/data/canonicalVenues.ts");
 const {CANONICAL_VENUE_GEOGRAPHY}=await server.ssrLoadModule("/src/data/canonicalVenueGeography.ts");
 const f=await server.ssrLoadModule("/src/state/foursquareState.ts");
 const {FoursquareContainer}=await server.ssrLoadModule("/src/device/FoursquareContainer.tsx");
 const ui=await server.ssrLoadModule("/src/device/BasicSystemApps.tsx");
 const press=keys=>keys.reduce((s,key)=>m.calculatorKey(s,key),m.initialCalculator());
 for(const [keys,value] of [["2+3=","5"],["9−4=","5"],["6×7=","42"],["8÷2=","4"],["1.5+2.25=","3.75"],["0.1+0.2=","0.3"],["2+3×4=","20"],["8÷0=","Error"],["1..5+2=","3.5"]]) assert.equal(press([...keys]).display,value);
 assert.equal(m.calculatorKey(press([..."8÷0="]),"2").display,"2");
 assert.equal(m.calculatorKey(press([..."12"]),"C").display,"0");
 assert.deepEqual(m.calculatorKey(press([..."12+"]),"AC"),m.initialCalculator());
 assert.equal(press(["8","+","9","C","2","="]).display,"10");
 const initial=m.createInitialBasicSystemApps();
 assert.deepEqual(initial.calendar,{year:2010,month:9,day:20});
 const cells=m.calendarMonthCells(2010,9);
 assert.equal(cells.indexOf(1),5); assert.equal(cells.indexOf(20)%7,3);
 assert.deepEqual(cells.filter(Boolean),Array.from({length:31},(_,i)=>i+1));
 assert.equal(m.daysInCalendarMonth(2012,1),29); assert.equal(m.daysInCalendarMonth(2100,1),28); assert.equal(m.daysInCalendarMonth(2000,1),29);
 let state=m.basicSystemAppsTransition(initial,{type:"CALENDAR_MONTH",delta:-1}); assert.equal(state.calendar.month,8);
 state=m.basicSystemAppsTransition(state,{type:"CALENDAR_MONTH",delta:2}); assert.equal(state.calendar.month,10);
 state=m.basicSystemAppsTransition(state,{type:"CALENDAR_MONTH",delta:2}); assert.deepEqual(state.calendar,{year:2011,month:0,day:20});
 state=m.basicSystemAppsTransition(state,{type:"CALENDAR_DAY",day:31});
 state=m.basicSystemAppsTransition(state,{type:"CALENDAR_MONTH",delta:1}); assert.equal(state.calendar.day,28);
 const now=Date.now; Date.now=()=>Date.parse("2026-09-16T00:00:00Z");
 assert.deepEqual(m.createInitialBasicSystemApps().calendar,initial.calendar); Date.now=now;
 assert.equal(initial.maps.selectedVenueId,null);
 const edgeState=m.basicSystemAppsTransition(initial,{type:"MAP_VENUE",venueId:"gelato-roma"});
 const edgeMap=renderToStaticMarkup(React.createElement(ui.MapsContainer,{state:edgeState,dispatch(){}}));
 const blankTiles=edgeMap.match(/data-map-boundary="unavailable">([\s\S]*?)<\/g>/)?.[1];
 assert.ok(blankTiles);assert.ok([...blankTiles.matchAll(/width="([0-9.]+)"/g)].some(match=>Number(match[1])>0 && Number(match[1])<320));
 assert.doesNotMatch(edgeMap,/spinner|Loading|world map unavailable/i);

 for(let run=0;run<2;run++) {
  for(const id of [...m.MAP_ELIGIBLE_FOURSQUARE_IDS,"unknown"]) {
   const target=m.resolveSystemMapVenue(id),eligible=m.MAP_ELIGIBLE_FOURSQUARE_IDS.includes(id);
   let venueState=f.foursquareStateTransition(f.createInitialFoursquareState(),{type:"OPEN_VENUE",venueId:id,scrollPosition:40});
   venueState=f.foursquareStateTransition(venueState,{type:"SHOW_VENUE_INFO"});
   const html=renderToStaticMarkup(React.createElement(FoursquareContainer,{state:venueState,dispatch:()=>{},currentDeviceDateTime:new Date("2010-10-20T07:02:00Z"),onOpenMap:()=>{}}));
   assert.equal(html.includes("Open in Maps"),eligible,id);
   const selected=m.basicSystemAppsTransition(initial,{type:"MAP_VENUE",venueId:id});
   if(eligible) {
    assert.equal(target.venue,CANONICAL_VENUES[id]); assert.equal(target.geography,CANONICAL_VENUE_GEOGRAPHY[id]);
    assert.equal(selected.maps.selectedVenueId,id);
    const map=renderToStaticMarkup(React.createElement(ui.MapsContainer,{state:selected,dispatch:()=>{}}));
    assert.ok(map.includes(target.venue.name)); assert.ok(map.includes('data-venue-id="'+id+'"'));
   } else { assert.equal(target,null); assert.equal(CANONICAL_VENUE_GEOGRAPHY[id],undefined); assert.equal(selected,initial); }
  }
  state=m.basicSystemAppsTransition(state,{type:"RESET"}); assert.deepEqual(state,initial);
 }
 for(const component of [ui.CalculatorContainer,ui.CalendarContainer,ui.MapsContainer]) {
  const html=renderToStaticMarkup(React.createElement(component,{state:initial,dispatch:()=>{}}));
  assert.doesNotMatch(html,/<input|<textarea|<select/);
 }
 console.log("PASS: Calculator arithmetic/clear/errors; Calendar Gregorian boundaries/canonical today; Maps shared identity, eligibility, rendered affordances and two resets");
} finally {await server.close();}
