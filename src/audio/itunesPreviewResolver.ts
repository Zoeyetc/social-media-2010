export type PreviewTrack = {id:string;title:string;artist:string};
const normalize = (value:string) => value.toLocaleLowerCase("en-US").replace(/[’‘]/g,"'").replace(/\s+/g," ").trim();
export function approvedPreviewURL(value:unknown):value is string {
  if(typeof value!=="string")return false;
  try {const url=new URL(value);return url.protocol==="https:" && url.hostname==="audio-ssl.itunes.apple.com" && !url.username && !url.password && !url.port && url.pathname.startsWith("/itunes-assets/AudioPreview");}catch{return false;}
}
export function matchesPreview(track:PreviewTrack,result:Record<string,unknown>):boolean {
 if(result.wrapperType!=="track" || result.kind!=="song" || result.country!=="USA" || typeof result.trackName!=="string" || typeof result.artistName!=="string" || !approvedPreviewURL(result.previewUrl))return false;
 if(typeof result.collectionName==="string" && /karaoke|tribute|\blive\b|re-record|taylor.s version/i.test(result.collectionName))return false;
 const title=normalize(result.trackName),artist=normalize(result.artistName);
 if(track.id!=="like-a-g6")return title===normalize(track.title) && artist===normalize(track.artist);
 // Apple distributes featured credits across title/artist fields. Accept only this
 // audited equivalence, never general fuzzy substring matching or remix suffixes.
 const match=title.match(/^like a g6(?: \(feat\. (?:the )?cataracs & dev\))?$/);
 if(!match)return false;
 const credits=artist.split(/,| & /).map(s=>s.trim().replace(/^the cataracs$/,"cataracs")).sort();
 return JSON.stringify(credits)===JSON.stringify(["cataracs","dev","far east movement"]) || (artist==="far east movement" && title!=="like a g6");
}
export const PREVIEW_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
export const PREVIEW_FAILURE_COOLDOWN_MS = 45 * 1000;
export const PREVIEW_LOOKUP_TIMEOUT_MS = 12000;
type CacheEntry = {expiresAt:number;result:Record<string,unknown>};
export class ITunesPreviewResolver {
 private cache=new Map<string,CacheEntry>();
 private inFlight=new Map<string,Promise<string|null>>();
 private controllers=new Set<AbortController>();
 private failures=new Map<string,number>();
 private generation=0;
 constructor(private now:()=>number=Date.now) {}
 private key(track:PreviewTrack) {return `sm2010:itunes-preview:v1:US:${JSON.stringify([track.id,track.title,track.artist])}`;}
 private storage():Storage|null {try{return typeof localStorage!=="undefined" ? localStorage : null;}catch{return null;}}
 private removeStored(key:string) {try{this.storage()?.removeItem(key);}catch{/* Optional cache may be blocked. */}}
 private valid(track:PreviewTrack,entry:unknown):entry is CacheEntry {
  if(!entry || typeof entry!=="object")return false;
  const value=entry as CacheEntry,now=this.now();
  return Number.isFinite(value.expiresAt) && value.expiresAt>now && value.expiresAt<=now+PREVIEW_CACHE_TTL_MS && !!value.result && typeof value.result==="object" && matchesPreview(track,value.result);
 }
 private cached(track:PreviewTrack):string|null {
  const key=this.key(track);let entry:unknown=this.cache.get(key);
  if(!entry){try{entry=JSON.parse(this.storage()?.getItem(key) ?? "null");}catch{/* Corrupt/blocked storage is a cache miss. */}}
  if(this.valid(track,entry)){this.cache.set(key,entry);return entry.result.previewUrl as string;}
  this.cache.delete(key);this.removeStored(key);return null;
 }
 isCoolingDown(track:PreviewTrack) {return (this.failures.get(this.key(track)) ?? 0)>this.now();}
 markFailure(track:PreviewTrack) {this.failures.set(this.key(track),this.now()+PREVIEW_FAILURE_COOLDOWN_MS);}
 invalidate(track:PreviewTrack) {const key=this.key(track);this.cache.delete(key);this.removeStored(key);}
 clear() {
  this.generation++;this.controllers.forEach(c=>c.abort());this.controllers.clear();
  this.inFlight.clear();this.cache.clear();this.failures.clear();
  // Only validated, expiring transport metadata may survive in browser storage.
 }
 resolve(track:PreviewTrack,signal:AbortSignal):Promise<string|null> {
  if(signal.aborted || this.isCoolingDown(track))return Promise.resolve(null);
  const key=this.key(track),existing=this.inFlight.get(key);
  if(existing)return existing;
  const cached=this.cached(track);if(cached)return Promise.resolve(cached);
  // Requests belong to the resolver, not one playback consumer. A track change
  // must not spawn another same-track request; DeviceAudio guards stale consumers.
  const generation=this.generation,controller=new AbortController();this.controllers.add(controller);
  let timeout:ReturnType<typeof setTimeout>;
  const cancelled=new Promise<never>((_,reject)=>{
    controller.signal.addEventListener("abort",()=>reject(new Error("Preview unavailable")),{once:true});
    timeout=setTimeout(()=>controller.abort(),PREVIEW_LOOKUP_TIMEOUT_MS);
  });
  const work=(async()=>{
    const query=new URLSearchParams({term:`${track.title} ${track.artist}`,country:"US",media:"music",entity:"song",limit:"10"});
    const response=await fetch(`https://itunes.apple.com/search?${query}`,{signal:controller.signal,credentials:"omit",referrerPolicy:"no-referrer"});
    if(!response.ok)throw new Error("Preview unavailable");
    const data:unknown=await response.json();
    const results=data && typeof data==="object" && "results" in data && Array.isArray(data.results) ? data.results : [];
    return results.find(item=>item && typeof item==="object" && matchesPreview(track,item)) as Record<string,unknown>|undefined;
 })();
  let pending:Promise<string|null>;
  pending=Promise.race([work,cancelled]).then(result=>{
    if(generation!==this.generation || controller.signal.aborted)return null;
    if(!result){this.markFailure(track);return null;}
    const entry:CacheEntry={expiresAt:this.now()+PREVIEW_CACHE_TTL_MS,result:{wrapperType:result.wrapperType,kind:result.kind,country:result.country,trackName:result.trackName,artistName:result.artistName,collectionName:result.collectionName,previewUrl:result.previewUrl}};
    this.cache.set(key,entry);try{this.storage()?.setItem(key,JSON.stringify(entry));}catch{/* Memory cache remains usable. */}
    return result.previewUrl as string;
  }).catch(()=>{if(generation===this.generation)this.markFailure(track);return null;}).finally(()=>{
    clearTimeout(timeout);this.controllers.delete(controller);if(this.inFlight.get(key)===pending)this.inFlight.delete(key);
  });
  this.inFlight.set(key,pending);return pending;
 }
}
