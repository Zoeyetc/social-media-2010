import { matchesPreview } from "./itunesPreviewMatcher.mjs";
export { matchesPreview, approvedPreviewURL } from "./itunesPreviewMatcher.mjs";
export type PreviewTrack = {id:string;title:string;artist:string};
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
    // Production metadata crosses the same-origin Worker boundary. The remote
    // preview URL itself remains on Apple's host for direct HTMLAudio playback.
    const lookup=import.meta.env.PROD ? `/api/itunes-preview/resolve?id=${encodeURIComponent(track.id)}` : `https://itunes.apple.com/search?${query}`;
    const response=await fetch(lookup,{signal:controller.signal,credentials:"omit",referrerPolicy:"no-referrer"});
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
