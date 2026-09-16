import type { FlickrPhoto } from "../state/flickrState";
import { MAIL_BODY_MAX, MAIL_IMAGE_MAX, MAIL_SUBJECT, MAIL_SUBJECT_MAX, validMailRecipient, type MailConfiguration, type MailImage, type MailPayload, type MailResult } from "./flickrMailContract";

export type FlickrMailDraft = {
  photo: Readonly<Pick<FlickrPhoto, "id" | "mediaId" | "src" | "title">>;
  sessionId: string; requestId: string; to: string; subject: string; body: string;
  status: "editing" | "sending" | "error"; error: string; config: MailConfiguration | null;
  locked: boolean;
};
export type MailTransport = {
  configuration: (signal: AbortSignal) => Promise<MailConfiguration>;
  image: (photo: FlickrMailDraft["photo"], signal: AbortSignal) => Promise<MailImage>;
  send: (payload: MailPayload, signal: AbortSignal) => Promise<MailResult>;
};
export function createMailTransport(): MailTransport {
  return {
    async configuration(signal) {
      const response = await fetch("/api/flickr-mail/config", { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Email is unavailable. Please try again later.");
      return response.json();
    },
    async image(photo, signal) {
      const url = new URL(photo.src, location.origin);
      // Only the already-selected local project resource or Camera Roll blob.
      if (url.origin !== location.origin || !(["http:", "https:", "blob:"].includes(url.protocol))) throw new Error("This photo cannot be attached.");
      const response = await fetch(url.href, { signal, redirect: "error" });
      if (!response.ok) throw new Error("The photo could not be loaded.");
      const blob = await response.blob();
      if (blob.size > MAIL_IMAGE_MAX) throw new Error("This photo is too large to email (6 MB maximum).");
      if (!["image/jpeg", "image/png"].includes(blob.type)) throw new Error("Only JPEG and PNG photos can be emailed.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
      const extension = blob.type === "image/png" ? "png" : "jpg";
      return { mediaId: photo.mediaId, filename: `Flickr-photo.${extension}`, contentType: blob.type, base64: btoa(binary) };
    },
    async send(payload, signal) {
      const response = await fetch("/api/flickr-mail", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof result?.error === "string" ? result.error : "Email could not be sent. Please try again.");
      if (typeof result?.accepted !== "boolean" || !["real", "mock"].includes(result?.mode)) throw new Error("Email delivery could not be confirmed. Please retry.");
      return result;
    },
  };
}

// Volatile action controller: never saved in Flickr records, Session or public stores.
export class FlickrMailController {
  state: FlickrMailDraft | null = null;
  private listeners = new Set<() => void>();
  private abort: AbortController | null = null;
  private generation = 0;
  private payload: MailPayload | null = null;
  private transport: MailTransport;
  constructor(transport: MailTransport = createMailTransport()) { this.transport = transport; }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private changed() { this.listeners.forEach(fn => fn()); }
  async open(photo: FlickrPhoto, sessionId: string) {
    if (!sessionId || this.state) return;
    this.abort = new AbortController(); const generation = ++this.generation;
    this.state = { photo: { id: photo.id, mediaId: photo.mediaId, src: photo.src, title: photo.title }, sessionId,
      requestId: crypto.randomUUID(), to: "", subject: MAIL_SUBJECT, body: "", status: "editing", error: "", config: null, locked: false };
    this.changed();
    try {
      const config = await this.transport.configuration(this.abort.signal);
      if (this.generation !== generation || !this.state) return;
      this.state = { ...this.state, config, error: config.enabled ? "" : "Email delivery is not configured yet." }; this.changed();
    } catch { if (this.generation === generation && this.state) { this.state = { ...this.state, error: "Email is unavailable. You can retry Send later." }; this.changed(); } }
  }
  edit(field: "to" | "subject" | "body", value: string) {
    if (!this.state || this.state.status === "sending" || this.state.locked) return;
    const limit = field === "to" ? 254 : field === "subject" ? MAIL_SUBJECT_MAX : MAIL_BODY_MAX;
    this.state = { ...this.state, [field]: value.slice(0, limit), status: "editing", error: "" }; this.changed();
  }
  get canSend() {
    const s = this.state;
    return Boolean(s && s.status !== "sending" && validMailRecipient(s.to.trim()) && s.subject.trim() && !/[\r\n]/.test(s.subject));
  }
  cancel() { if (this.state?.status !== "sending") this.reset(); }
  reset() { this.generation++; this.abort?.abort(); this.abort = null; this.payload = null; this.state = null; this.changed(); }
  async send() {
    if (!this.state || !this.canSend) return;
    const generation = this.generation;
    const draft = this.state;
    this.state = { ...draft, status: "sending", error: "" }; this.changed(); // synchronous double-tap guard
    this.abort?.abort(); this.abort = new AbortController(); const signal = this.abort.signal;
    try {
      const config = await this.transport.configuration(signal);
      if (this.generation !== generation || !this.state) return;
      this.state = { ...this.state, config }; this.changed();
      if (!config.enabled) throw new Error("Email delivery is not configured yet.");
      if (!this.payload) {
        const image = await this.transport.image(draft.photo, signal);
        if (this.generation !== generation || !this.state) return;
        this.payload = { requestId: draft.requestId, sessionId: draft.sessionId, to: draft.to.trim(), subject: draft.subject.trim(), body: draft.body, image };
      }
      // Freeze the payload after dispatch: retry uses the same idempotency key/bytes.
      this.state = { ...this.state, locked: true }; this.changed();
      const result = await this.transport.send(this.payload, signal);
      if (this.generation !== generation || !this.state) return;
      if (result.accepted && result.mode === "real") this.reset();
      else throw new Error("Test mode: no real email was sent.");
    } catch (error) {
      if (this.generation !== generation || !this.state) return;
      this.state = { ...this.state, status: "error", error: error instanceof Error ? error.message : "Email could not be sent. Please retry." }; this.changed();
    }
  }
}
