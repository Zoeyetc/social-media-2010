// RECONSTRUCTED EXPERIENCE DATA, not verified market observations.
export const STOCKS = Object.freeze([
  {symbol:"AAPL",name:"Apple Inc.",price:309.49,change:-8.51,percent:-2.68,chart:[318,316,310,312,309,311,309.49]},
  {symbol:"GOOG",name:"Google Inc.",price:607.83,change:-10.17,percent:-1.65,chart:[618,615,610,613,608,610,607.83]},
  {symbol:"YHOO",name:"Yahoo! Inc.",price:15.49,change:0.09,percent:0.58,chart:[15.4,15.3,15.35,15.5,15.45,15.5,15.49]},
].map(stock=>Object.freeze({...stock,chart:Object.freeze(stock.chart)})));
export type SettingsRoute = "root" | "sounds" | "wallpaper" | "general";
export const SETTINGS_ROWS = Object.freeze([
  {title:"Airplane Mode",detail:"Off"}, {title:"Wi-Fi",detail:""}, {title:"Notifications",detail:""},
  {title:"Sounds",route:"sounds"}, {title:"Brightness",detail:""}, {title:"Wallpaper",route:"wallpaper"}, {title:"General",route:"general"},
] as const);
export const initialRCSystemApps = () => ({stockSymbol:STOCKS[0].symbol,settingsRoute:"root" as SettingsRoute});
export type RCSystemAppsState = ReturnType<typeof initialRCSystemApps>;
export type RCSystemAppsEvent = {type:"RESET"} | {type:"STOCK_SELECT";symbol:string} | {type:"SETTINGS_ROUTE";route:SettingsRoute};
export function rcSystemAppsTransition(state:RCSystemAppsState,event:RCSystemAppsEvent):RCSystemAppsState {
  if(event.type === "RESET") return initialRCSystemApps();
  if(event.type === "STOCK_SELECT") return STOCKS.some(stock=>stock.symbol===event.symbol) ? {...state,stockSymbol:event.symbol} : state;
  return ["root","sounds","wallpaper","general"].includes(event.route) ? {...state,settingsRoute:event.route} : state;
}
