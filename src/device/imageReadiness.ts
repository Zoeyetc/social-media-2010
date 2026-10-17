/** Session-owned decoded images. App rendering reuses these exact stable asset URLs.
 * Holding Image references improves reuse; browser memory eviction remains possible. */
export class ImageReadinessCache {
  private sessionId: string | null = null;
  private entries = new Map<string, { image: HTMLImageElement; promise: Promise<void>; ready: boolean; users: number; cancel: () => void }>();
  reset(sessionId: string | null) {
    if (this.sessionId === sessionId) return;
    this.entries.forEach(entry => entry.cancel());
    this.entries.clear(); this.sessionId = sessionId;
  }
  isReady(src: string) { return this.entries.get(src)?.ready === true; }
  decode(src: string, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(new Error("Image preparation cancelled"));
    if (typeof Image === "undefined") return Promise.resolve(); // Headless controller hosts have no image decoder.
    let entry = this.entries.get(src);
    if (entry?.ready && typeof entry.image.decode === "function") {
      // Recheck a retained image at first open: a browser may evict decoded pixels
      // even while the stable URL and Image object remain in the session cache.
      const retained = entry, previousCancel = retained.cancel;
      retained.ready = false;
      let cancelled = false;
      retained.promise = new Promise<void>((resolve, reject) => {
        retained.cancel = () => { cancelled = true; previousCancel(); reject(new Error("Image preparation cancelled")); };
        void retained.image.decode().then(() => {
          if (cancelled) return;
          retained.ready = true; retained.cancel = previousCancel; resolve();
        }, reject);
      });
      void retained.promise.catch(() => { if (this.entries.get(src) === retained) this.entries.delete(src); });
    }
    if (!entry) {
      const image = new Image();
      let rejectLoad: (error: Error) => void = () => {};
      const created = { image, ready: false, users: 0, promise: null! as Promise<void>, cancel: () => {} };
      const cleanup = () => { image.onload = null; image.onerror = null; };
      created.cancel = () => { cleanup(); image.removeAttribute("src"); rejectLoad(new Error("Image preparation cancelled")); };
      created.promise = new Promise<void>((resolve, reject) => {
        rejectLoad = reject;
        image.onload = () => {
          void (image.decode?.() ?? Promise.resolve()).then(() => {
            cleanup(); created.ready = true; resolve();
          }, () => { cleanup(); reject(new Error("Image decode failed")); });
        };
        image.onerror = () => { cleanup(); reject(new Error("Image preparation failed")); };
      });
      this.entries.set(src, created); entry = created;
      // Rejected loads can be retried at first open; never retain a broken entry.
      void created.promise.catch(() => { if (this.entries.get(src) === created) this.entries.delete(src); });
      image.decoding = "async"; image.src = src;
    }
    const current = entry;
    current.users++;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return; settled = true;
        signal.removeEventListener("abort", cancelled); current.users--;
        if (error) {
          reject(error);
          if (!current.ready && current.users === 0 && this.entries.get(src) === current) {
            this.entries.delete(src); current.cancel();
          }
        } else resolve();
      };
      const cancelled = () => finish(new Error("Image preparation cancelled"));
      signal.addEventListener("abort", cancelled, { once: true });
      void current.promise.then(() => finish(), error => finish(error));
    });
  }
}
export const firstViewportImageCache = new ImageReadinessCache();
