export type ClockTab = "World Clock" | "Alarm" | "Stopwatch" | "Timer";
export type RunningTime = { accumulated: number; startedAt: number | null };
export type RemainingBasicAppsState = {
  tab: ClockTab;
  stopwatch: RunningTime;
  timer: { duration: number; remaining: number; startedAt: number | null };
  alarm: { hour: number; minute: number; enabled: boolean } | null;
  alarmEditing: boolean; alarmHour: number; alarmMinute: number;
  heading: number;
};
export function createInitialRemainingBasicApps(): RemainingBasicAppsState {
  return {tab:"World Clock",stopwatch:{accumulated:0,startedAt:null},timer:{duration:60000,remaining:60000,startedAt:null},alarm:null,alarmEditing:false,alarmHour:0,alarmMinute:0,heading:0};
}
export const normalizeHeading = (value:number) => Number.isFinite(value) ? ((value%360)+360)%360 : 0;
export const cardinalHeading = (value:number) => ["N","NE","E","SE","S","SW","W","NW"][Math.round(normalizeHeading(value)/45)%8];
export const stopwatchElapsed = (s:RunningTime,now:number) => s.accumulated+(s.startedAt === null ? 0 : Math.max(0,now-s.startedAt));
export const timerRemaining = (s:RemainingBasicAppsState["timer"],now:number) => Math.max(0,s.remaining-(s.startedAt === null ? 0 : Math.max(0,now-s.startedAt)));
export type RemainingBasicAppsEvent =
 | {type:"RESET"} | {type:"CLOCK_TAB";tab:ClockTab}
 | {type:"STOPWATCH_START"|"STOPWATCH_STOP"|"TIMER_START"|"TIMER_PAUSE";now:number}
 | {type:"STOPWATCH_RESET"|"TIMER_CANCEL"|"ALARM_EDIT"|"ALARM_SAVE"|"ALARM_CANCEL"|"ALARM_TOGGLE"|"ALARM_DELETE"}
 | {type:"TIMER_DURATION";duration:number} | {type:"HEADING";heading:number}
 | {type:"ALARM_HOUR"|"ALARM_MINUTE";delta:number};
export function remainingBasicAppsTransition(s:RemainingBasicAppsState,e:RemainingBasicAppsEvent):RemainingBasicAppsState {
 switch(e.type) {
  case "RESET":return createInitialRemainingBasicApps();
  case "CLOCK_TAB":return {...s,tab:e.tab};
  case "HEADING":return {...s,heading:normalizeHeading(e.heading)};
  case "STOPWATCH_START":return s.stopwatch.startedAt !== null ? s : {...s,stopwatch:{...s.stopwatch,startedAt:e.now}};
  case "STOPWATCH_STOP":return {...s,stopwatch:{accumulated:stopwatchElapsed(s.stopwatch,e.now),startedAt:null}};
  case "STOPWATCH_RESET":return {...s,stopwatch:{accumulated:0,startedAt:null}};
  case "TIMER_DURATION":return s.timer.startedAt !== null ? s : {...s,timer:{duration:Math.max(1000,Math.min(86399000,e.duration)),remaining:Math.max(1000,Math.min(86399000,e.duration)),startedAt:null}};
  case "TIMER_START":return s.timer.startedAt !== null && timerRemaining(s.timer,e.now)>0 ? s : {...s,timer:{...s.timer,remaining:s.timer.remaining>0 && s.timer.startedAt === null ? s.timer.remaining : s.timer.duration,startedAt:e.now}};
  case "TIMER_PAUSE":return {...s,timer:{...s.timer,remaining:timerRemaining(s.timer,e.now),startedAt:null}};
  case "TIMER_CANCEL":return {...s,timer:{...s.timer,remaining:s.timer.duration,startedAt:null}};
  case "ALARM_EDIT":return {...s,alarmEditing:true,alarmHour:s.alarm?.hour ?? 0,alarmMinute:s.alarm?.minute ?? 0};
  case "ALARM_HOUR":return {...s,alarmHour:((s.alarmHour+e.delta)%24+24)%24};
  case "ALARM_MINUTE":return {...s,alarmMinute:((s.alarmMinute+e.delta)%60+60)%60};
  case "ALARM_SAVE":return {...s,alarmEditing:false,alarm:{hour:s.alarmHour,minute:s.alarmMinute,enabled:true}};
  case "ALARM_CANCEL":return {...s,alarmEditing:false};
  case "ALARM_TOGGLE":return s.alarm ? {...s,alarm:{...s.alarm,enabled:!s.alarm.enabled}} : s;
  case "ALARM_DELETE":return {...s,alarm:null};
 }
}
export function durationText(ms:number) { const seconds=Math.floor(Math.max(0,ms)/1000);return `${String(Math.floor(seconds/3600)).padStart(2,"0")}:${String(Math.floor(seconds/60)%60).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`; }
