import { ITunesPreviewResolver, type PreviewTrack } from "./itunesPreviewResolver";
import { DEVICE_AUDIO_REGISTRY, DeviceAudioEvent } from "./deviceAudioRegistry";

export type NotificationType = "message";

export type PreviewState = {trackId:string|null;status:"idle"|"loading"|"playing"|"paused"|"unavailable";position:number;duration:number};
const initialPreviewState = ():PreviewState => ({trackId:null,status:"idle",position:0,duration:0});
class DeviceAudioService {
  private previewAudio: HTMLAudioElement | null = null;
  private previewResolver = new ITunesPreviewResolver();
  private previewAbort: AbortController | null = null;
  private previewGeneration = 0;
  private previewRetried = false;
  private previewPlayTimer: ReturnType<typeof setTimeout> | null = null;
  private previewState = initialPreviewState();
  private previewListeners = new Set<(state:PreviewState)=>void>();
  getPreviewState = () => this.previewState;
  subscribePreview = (listener:(state:PreviewState)=>void) => {this.previewListeners.add(listener);return ()=>{this.previewListeners.delete(listener);};};
  private updatePreview(next:PreviewState) {this.previewState=next;this.previewListeners.forEach(listener=>listener(next));}
  stopPreview() {
    if(this.previewPlayTimer!==null)clearTimeout(this.previewPlayTimer);this.previewPlayTimer=null;
    this.previewGeneration++;this.previewAbort?.abort();this.previewAbort=null;
    const audio=this.previewAudio;this.previewAudio=null;
    if(audio){audio.onended=null;audio.onerror=null;audio.ontimeupdate=null;audio.onloadedmetadata=null;audio.pause();audio.removeAttribute("src");audio.load();}
    this.updatePreview(initialPreviewState());
  }
  resetPreview() {this.stopPreview();this.previewResolver.clear();}
  pausePreview() {
    if(this.previewPlayTimer!==null)clearTimeout(this.previewPlayTimer);this.previewPlayTimer=null;
    if(this.previewState.status==="loading") {this.stopPreview();return;}
    if(this.previewAudio){this.previewGeneration++;this.previewAudio.pause();this.updatePreview({...this.previewState,status:"paused"});}
  }
  private previewFailed(track:PreviewTrack,audio:HTMLAudioElement) {
    if(audio!==this.previewAudio)return;
    const retry=!this.previewRetried;
    this.previewResolver.invalidate(track);
    this.stopPreview();
    if(retry && this.canPlayAudio) void this.playPreview(track,true);
    else {
      this.previewResolver.markFailure(track);
      this.updatePreview({trackId:track.id,status:"unavailable",position:0,duration:0});
    }
  }
  async playPreview(track:PreviewTrack,retrying=false) {
    if(!this.canPlayAudio || typeof Audio==="undefined")return;
    if(this.previewState.trackId===track.id && this.previewState.status==="loading")return;
    if(this.previewResolver.isCoolingDown(track)) {
      this.stopPreview();this.updatePreview({trackId:track.id,status:"unavailable",position:0,duration:0});return;
    }
    let audio=this.previewAudio;
    if(!audio || this.previewState.trackId!==track.id || !audio.src) {
      this.stopPreview();audio=new Audio();this.previewAudio=audio;audio.preload="none";this.previewRetried=retrying;
      const token=this.previewGeneration,controller=new AbortController();this.previewAbort=controller;

      this.updatePreview({trackId:track.id,status:"loading",position:0,duration:0});
      try {
        const url=await this.previewResolver.resolve(track,controller.signal);
        if(token!==this.previewGeneration)return;
        if(!url)throw new Error("Preview unavailable");
        audio.src=url;
      } catch {
        if(token===this.previewGeneration){this.stopPreview();this.updatePreview({trackId:track.id,status:"unavailable",position:0,duration:0});}
        return;
      }
    }
    if(!this.canPlayAudio || audio!==this.previewAudio)return;
    const token=++this.previewGeneration;
    audio.volume=this.volume;audio.muted=false;
    const updateTime=()=>{if(audio===this.previewAudio)this.updatePreview({...this.previewState,position:Number.isFinite(audio.currentTime)?audio.currentTime:0,duration:Number.isFinite(audio.duration)?audio.duration:0});};
    audio.ontimeupdate=updateTime;audio.onloadedmetadata=updateTime;
    audio.onended=()=>{if(audio===this.previewAudio)this.updatePreview({...this.previewState,status:"paused"});};
    audio.onerror=()=>this.previewFailed(track,audio);
    if(this.previewPlayTimer!==null)clearTimeout(this.previewPlayTimer);
    this.previewPlayTimer=setTimeout(()=>{if(token===this.previewGeneration)this.previewFailed(track,audio);},12000);
    try {
      await audio.play();
      if(token===this.previewGeneration && this.previewPlayTimer!==null){clearTimeout(this.previewPlayTimer);this.previewPlayTimer=null;}
      if(token===this.previewGeneration && audio===this.previewAudio && this.canPlayAudio)this.updatePreview({...this.previewState,trackId:track.id,status:"playing"});
    } catch(error) {
      if(token!==this.previewGeneration || audio!==this.previewAudio)return;
      if(this.previewPlayTimer!==null)clearTimeout(this.previewPlayTimer);this.previewPlayTimer=null;
      // Safari may require a second explicit tap after asynchronous resolution.
      // Keep the resolved source for that user gesture; never bypass autoplay policy.
      if(error instanceof Error && error.name==="NotAllowedError")this.updatePreview({...this.previewState,status:"paused"});
      else this.previewFailed(track,audio);
    }
  }

  private activeAudio: HTMLAudioElement | null = null;
  private audioMode: (() => "ringer" | "silent") | null = null;
  private lastSuppressedSound: DeviceAudioEvent | null = null;
  private muted = false;
  private volume = 1;

  dispatch(event: DeviceAudioEvent): void {
    if (!this.canPlayAudio) {
      this.lastSuppressedSound = event;
      return; // Muted one-shots are discarded, never queued for replay.
    }
    const sound = DEVICE_AUDIO_REGISTRY[event];
    if (sound.assetStatus !== "READY" || typeof Audio === "undefined") return;

    this.activeAudio?.pause();
    const audio = new Audio(sound.assetUrl);
    audio.preload = "auto";
    audio.muted = false;
    audio.volume = this.volume;
    this.activeAudio = audio;
    audio.addEventListener("ended", () => {
      if (this.activeAudio === audio) this.activeAudio = null;
    }, { once: true });
    void audio.play().catch(() => {
      if (this.activeAudio === audio) this.activeAudio = null;
    });
  }

  lock(): void { this.pausePreview(); this.dispatch("lock"); }
  unlock(): void { this.dispatch("unlock"); }
  keyboardTap(): void { this.dispatch("keyboardTap"); }
  notificationReceived(type: NotificationType): void {
    if (type === "message") this.dispatch("messageReceived");
  }
  messageSent(): void { this.dispatch("messageSent"); }
  lowBatteryWarning(): void { this.dispatch("lowBattery"); }
  cameraShutter(): void { this.dispatch("cameraShutter"); }

  // Preserve the physical controller API; both callers use the same audio gate.
  bindHardwareMuteMode(readMode: () => "ringer" | "silent"): () => void {
    return this.bindAudioMode(readMode);
  }

  hardwareMuteChanged(): void { this.audioModeChanged(); }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.audioModeChanged();
  }

  get canPlayAudio(): boolean {
    return !this.muted && (this.audioMode?.() ?? "ringer") === "ringer";
  }

  // Read the existing runtime mode; no app-local copy of the mute boolean.
  bindAudioMode(readMode: () => "ringer" | "silent"): () => void {
    this.audioMode = readMode;
    this.audioModeChanged();
    return () => {
      if (this.audioMode === readMode) this.audioMode = null;
    };
  }

  audioModeChanged(): void {
    if (!this.canPlayAudio) this.pausePreview();
    if (!this.canPlayAudio && this.activeAudio) {
      this.activeAudio.muted = true;
      this.activeAudio.pause();
      this.activeAudio = null;
    }
  }

  get diagnostics() {
    return {
      volume: this.volume,
      muteMode: this.canPlayAudio ? "ringer" : "silent",
      audioGateOpen: this.canPlayAudio,
      lastSuppressedSound: this.lastSuppressedSound,
      activeChannel: this.activeAudio ? "one-shot" : this.previewAudio ? "itunes-preview" : null,
      previewState: { ...this.previewState },
    };
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.activeAudio) this.activeAudio.volume = this.volume;
    if (this.previewAudio) this.previewAudio.volume = this.volume;
  }
}

export const DeviceAudio = new DeviceAudioService();
