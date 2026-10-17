import { firstViewportImageCache } from "./imageReadiness";
export const CORE_FIRST_FRAME_APPS = ["messages", "facebook", "twitter", "instagram", "foursquare", "flickr"] as const;
export type CoreFirstFrameApp = typeof CORE_FIRST_FRAME_APPS[number];
export const CORE_FIRST_FRAME_HOLD_MS = 150;

export function isCoreFirstFrameApp(appId: string): appId is CoreFirstFrameApp {
  return (CORE_FIRST_FRAME_APPS as readonly string[]).includes(appId);
}

export type CoreFirstFramePlan = Readonly<{ source: string; imageSrcs?: readonly string[] }>;
export type CoreFirstFrameRecord = Readonly<{
  expectedImages: number;
  readyImages: number;
  firstViewportReady: boolean;
  firstOpenRequestedAt: number;
  firstFrameReadyAt: number | null;
  revealedAt: number | null;
  firstOpenLatencyMs: number | null;
  firstFrameSource: string;
  timeoutFallbackUsed: boolean;
}>;

type Host = Readonly<{
  now: () => number;
  timer: (callback: () => void, delay: number) => () => void;
  decode: (src: string, signal: AbortSignal) => Promise<void>;
  mark: (name: string) => void;
}>;

/** A single pending icon launch; no inactive app tree or recurring work. */
export function createCoreAppFirstFrameGate(host: Host) {
  let sessionId: string | null = null;
  let pending: { app: CoreFirstFrameApp; cancelTimer: () => void; abort: AbortController } | null = null;
  const opened = new Set<CoreFirstFrameApp>();
  const records: Partial<Record<CoreFirstFrameApp, CoreFirstFrameRecord>> = {};

  const cancelPending = () => {
    if (!pending) return;
    pending.cancelTimer(); pending.abort.abort(); pending = null;
  };
  const reset = (nextSessionId: string | null) => {
    if (sessionId === nextSessionId) return;
    cancelPending(); sessionId = nextSessionId;
    opened.clear();
    for (const app of CORE_FIRST_FRAME_APPS) delete records[app];
  };
  const request = (app: CoreFirstFrameApp, nextSessionId: string | null, plan: CoreFirstFramePlan, open: () => void) => {
    reset(nextSessionId);
    cancelPending();
    if (opened.has(app)) { open(); return; }
    const requestedAt = host.now();
    host.mark(`sm2010:${app}-open-request`);
    records[app] = { expectedImages: plan.imageSrcs?.length ?? 0, readyImages: 0, firstViewportReady: false, firstOpenRequestedAt: requestedAt, firstFrameReadyAt: null, revealedAt: null,
      firstOpenLatencyMs: null, firstFrameSource: plan.source, timeoutFallbackUsed: false };
    const abort = new AbortController();
    const finish = (fallback: boolean) => {
      if (pending?.abort !== abort) return;
      cancelPending();
      opened.add(app);
      records[app] = { ...records[app]!, firstFrameReadyAt: fallback ? null : host.now(), firstViewportReady: !fallback,
        firstFrameSource: fallback ? `${plan.source}:fixed-geometry-fallback` : plan.source,
        timeoutFallbackUsed: fallback };
      open();
    };
    pending = { app, abort, cancelTimer: host.timer(() => finish(true), CORE_FIRST_FRAME_HOLD_MS) };
    if (plan.imageSrcs?.length) {
      void Promise.all(plan.imageSrcs.map(src => host.decode(src, abort.signal).then(() => {
        if (pending?.abort === abort) records[app] = { ...records[app]!, readyImages: records[app]!.readyImages + 1 };
      }))).then(() => finish(false), () => finish(true));
    } else {
      queueMicrotask(() => finish(false));
    }
  };
  const revealed = (app: CoreFirstFrameApp, nextSessionId: string | null) => {
    if (sessionId !== nextSessionId || !records[app] || records[app]!.revealedAt !== null) return;
    const at = host.now();
    records[app] = { ...records[app]!, revealedAt: at, firstOpenLatencyMs: at - records[app]!.firstOpenRequestedAt };
    host.mark(`sm2010:${app}-first-frame`);
  };
  return { request, revealed, cancelPending, reset,
    snapshot: () => Object.fromEntries(CORE_FIRST_FRAME_APPS.map(app => [app, records[app] ?? null])) as Record<CoreFirstFrameApp, CoreFirstFrameRecord | null> };
}

export function browserCoreFirstFrameHost(): Host {
  return {
    now: () => performance.now(),
    timer: (callback, delay) => { const id = window.setTimeout(callback, delay); return () => window.clearTimeout(id); },
    mark: name => performance.mark?.(name),
    decode: (src, signal) => firstViewportImageCache.decode(src, signal),
  };
}
