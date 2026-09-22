import type {Dispatch} from "react";
import {STOCKS, SETTINGS_ROWS, type RCSystemAppsState, type RCSystemAppsEvent} from "../state/rcSystemApps";
import {DeviceAudio} from "../audio/deviceAudio";
import wallpaper from "../assets/historical/ios4.1/lockscreen/DefaultWallpaper@2x~iphone.browser.png";
import "../styles/rcSystemApps.css";
export type RCSystemAppsProps={state:RCSystemAppsState;dispatch:Dispatch<RCSystemAppsEvent>};
export function StocksContainer({state,dispatch}:RCSystemAppsProps) {
  const selected=STOCKS.find(stock=>stock.symbol===state.stockSymbol) ?? STOCKS[0];
  const min=Math.min(...selected.chart), span=Math.max(...selected.chart)-min || 1;
  const points=selected.chart.map((value,i)=>`${10+i*280/(selected.chart.length-1)},${140-(value-min)/span*120}`).join(" ");
  return <section className="rc-stocks" aria-label="Stocks" data-classification="RECONSTRUCTED EXPERIENCE DATA">
    <header>Stocks</header><div className="rc-stock-list">{STOCKS.map(stock=><button type="button" key={stock.symbol} aria-pressed={stock.symbol===selected.symbol} onClick={()=>dispatch({type:"STOCK_SELECT",symbol:stock.symbol})}><strong>{stock.symbol}</strong><span>{stock.price.toFixed(2)}</span><span className={stock.change<0 ? "loss" : "gain"}>{stock.change>0?"+":""}{stock.change.toFixed(2)}<small>{stock.percent>0?"+":""}{stock.percent.toFixed(2)}%</small></span></button>)}</div>
    <div className="rc-stock-detail"><strong>{selected.name}</strong><svg viewBox="0 0 300 160" role="img" aria-label={`${selected.symbol} reconstructed price chart`}><path d="M10 20H290M10 60H290M10 100H290M10 140H290" stroke="#465464"/><polyline points={points} fill="none" stroke="#7db9ef" strokeWidth="2"/></svg><div className="rc-stock-period">1D</div></div>
  </section>;
}
export function SettingsContainer({state,dispatch}:RCSystemAppsProps) {
  const route=state.settingsRoute, audio=DeviceAudio.diagnostics;
  const title=route==="root" ? "Settings" : route==="general" ? "About" : route[0].toUpperCase()+route.slice(1);
  return <section className="rc-settings" aria-label="Settings"><header>{route!=="root" && <button type="button" onClick={()=>dispatch({type:"SETTINGS_ROUTE",route:"root"})}>Settings</button>}<strong>{title}</strong></header>
    {route==="root" ? <div className="rc-settings-group">{SETTINGS_ROWS.map(row=>"route" in row ? <button type="button" key={row.title} onClick={()=>dispatch({type:"SETTINGS_ROUTE",route:row.route})}>{row.title}<span>›</span></button> : <div className="rc-settings-inactive" aria-disabled="true" key={row.title}>{row.title}<span>{row.detail}</span></div>)}</div>
    : route==="sounds" ? <div className="rc-settings-group"><div>Ringer<span>{audio.muteMode==="silent"?"Silent":"On"}</span></div><div>Volume<span className="rc-settings-volume" role="meter" aria-label="Hardware volume" aria-valuemin={0} aria-valuemax={1} aria-valuenow={audio.volume}><i style={{width:`${audio.volume*100}%`}}/></span></div></div>
    : route==="wallpaper" ? <img className="rc-settings-wallpaper" src={wallpaper} alt="Current wallpaper"/>
    : <div className="rc-settings-group"><div>Model<span>iPhone 4</span></div><div>Version<span>4.1</span></div></div>}
  </section>;
}
