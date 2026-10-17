export type WarmupTask = { id: string; tier: 0 | 1 | 2; bytes?: number; firstViewportApps?: readonly string[]; run: (signal: AbortSignal) => void | Promise<void> };
export type FirstViewportSnapshot = {
  totalTasks: number; completedTasks: number; deferredTasks: number; totalBytes: number; completedBytes: number;
  perApp: Record<string, { status: "ready" | "pending" | "deferred"; totalTasks: number; completedTasks: number; deferredTasks: number }>;
  gracePeriodUsed: boolean; bootExitWithIncompleteFirstViewport: boolean;
};
export const FIRST_VIEWPORT_MIN_BOOT_MS = 20_000;
export const FIRST_VIEWPORT_MAX_EXTENSION_MS = 2_000;
export const FIRST_VIEWPORT_PROGRESS_WINDOW_MS = 1_500;
export type WarmupSnapshot = {
  firstViewport: FirstViewportSnapshot;
  startedAt: number; tier: number | null; completedTaskIds: string[]; deferredTaskIds: string[];
  bootCriticalReady: boolean; keyboardPrewarmMs: number | null; tier0CompleteMs: number | null;
  tier1CompleteMs: number | null; bootExitMs: number | null; failure: string | null;
};
export const BOOT_CRITICAL_DEADLINE_MS = 30_000;
export const OPTIONAL_TASK_TIMEOUT_MS = 1500;
export type WarmupHost = {
  now: () => number;
  idle: (run: (budget: number) => void) => () => void;
  timer: (run: () => void, ms: number) => () => void;
  mark: (name: string) => void;
};

/** One small task per idle turn, including a yield between async completions. */
export function createBootWarmup(tasks: readonly WarmupTask[], host: WarmupHost, onReady: () => void, onFailure: () => void, onChange: () => void = () => {}) {
  const queue = [...tasks].sort((a, b) => a.tier - b.tier);
  const viewport = queue.filter(task => task.firstViewportApps?.length);
  let lastProgressAt = -Infinity, activeViewport = false;
  let gracePeriodUsed = false, exitIncomplete = false;
  const completed = new Set<string>(), deferred = new Set<string>(), marks = new Set<string>();
  const abort = new AbortController();
  let cancelIdle = () => {}, cancelDeadline = () => {}, cancelTask = () => {};
  let cancelMinimum = () => {}, cancelMaximum = () => {}, cancelBusyYield = () => {};
  let index = 0, started = false, stopped = false;
  const state: Omit<WarmupSnapshot, "firstViewport"> = { startedAt: 0, tier: null, completedTaskIds: [], deferredTaskIds: [],
    bootCriticalReady: false, keyboardPrewarmMs: null, tier0CompleteMs: null, tier1CompleteMs: null, bootExitMs: null, failure: null };
  const mark = (name: string) => { if (!marks.has(name)) { marks.add(name); host.mark(`sm2010:${name}`); } };
  const elapsed = () => host.now() - state.startedAt;
  const cancel = () => { stopped = true; cancelIdle(); cancelDeadline(); cancelTask(); cancelMinimum(); cancelMaximum(); cancelBusyYield(); abort.abort(); };
  const failCritical = (id: string) => {
    if (stopped) return;
    state.failure = id;
    cancel();
    onFailure();
  };
  const viewportReady = () => viewport.every(task => completed.has(task.id));
  const canExit = () => {
    if (!state.bootCriticalReady || stopped) return false;
    if (viewportReady()) return true;
    if (elapsed() < FIRST_VIEWPORT_MIN_BOOT_MS) return false;
    if (elapsed() >= FIRST_VIEWPORT_MIN_BOOT_MS + FIRST_VIEWPORT_MAX_EXTENSION_MS) return true;
    const progressing = (activeViewport || viewport.some(task => !completed.has(task.id) && !deferred.has(task.id))) && host.now() - lastProgressAt < FIRST_VIEWPORT_PROGRESS_WINDOW_MS;
    if (progressing) { gracePeriodUsed = true; return false; }
    return true;
  };
  const schedule = () => {
    if (stopped || index >= queue.length) { state.tier = null; return; }
    cancelIdle = host.idle(budget => {
      if (stopped) return;
      if (budget < 4) { cancelBusyYield = host.timer(() => runTask(), 32); return; }
      runTask();
    });
  };
  const runTask = () => {
    if (stopped || index >= queue.length) return;
    const task = queue[index++];
    state.tier = task.tier;
    const taskStart = host.now();
    activeViewport = Boolean(task.firstViewportApps?.length);
    const taskAbort = new AbortController();
    const abortTask = () => taskAbort.abort();
    abort.signal.addEventListener("abort", abortTask, { once: true });
    let settled = false;
    const finish = (success: boolean) => {
      if (stopped || settled) return;
      settled = true; cancelTask(); taskAbort.abort();
      if (activeViewport && success) lastProgressAt = host.now();
      activeViewport = false;
      abort.signal.removeEventListener("abort", abortTask);
      if (!success && task.tier === 0) { failCritical(task.id); return; }
      if (success) { completed.add(task.id); deferred.delete(task.id); }
      else deferred.add(task.id);
      if (success && task.id === "keyboard-structure") {
        state.keyboardPrewarmMs = host.now() - taskStart; mark("keyboard-prewarm-ready");
      }
      if (!state.bootCriticalReady && queue.filter(item => item.tier === 0).every(item => completed.has(item.id))) {
        state.bootCriticalReady = true; state.tier0CompleteMs = elapsed(); cancelDeadline(); mark("tier0-ready"); onReady();
      }
      if (state.tier1CompleteMs === null && queue.filter(item => item.tier === 1).every(item => completed.has(item.id))) {
        state.tier1CompleteMs = elapsed(); mark("tier1-ready");
      }
      onChange();
      schedule();
    };
    cancelTask = task.tier > 0 ? host.timer(() => finish(false), OPTIONAL_TASK_TIMEOUT_MS) : () => {};
    try { Promise.resolve(task.run(taskAbort.signal)).then(() => finish(true), () => finish(false)); }
    catch { finish(false); }
  };
  return {
    start(startedAt = host.now()) {
      if (started) return;
      started = true; state.startedAt = startedAt; mark("boot-warmup-start");
      cancelDeadline = host.timer(() => failCritical("tier0-deadline"), Math.max(0, BOOT_CRITICAL_DEADLINE_MS - elapsed()));
      cancelMinimum = host.timer(onChange, Math.max(0, FIRST_VIEWPORT_MIN_BOOT_MS - elapsed()));
      cancelMaximum = host.timer(onChange, Math.max(0, FIRST_VIEWPORT_MIN_BOOT_MS + FIRST_VIEWPORT_MAX_EXTENSION_MS - elapsed()));
      schedule();
    },
    cancel,
    canExit,
    get firstViewportReady() { return viewportReady(); },
    get ready() { return state.bootCriticalReady && !stopped; },
    markBootExit() {
      if (!canExit() || state.bootExitMs !== null) return;
      exitIncomplete = !viewportReady();
      state.bootExitMs = elapsed(); mark("boot-exit");
      queue.filter(task => task.tier > 0 && !completed.has(task.id)).forEach(task => deferred.add(task.id));
    },
    markFirstApp() { if (!stopped && state.bootExitMs !== null) mark("first-app-open"); },
    markFirstKeyboard() { if (!stopped && state.bootExitMs !== null) mark("first-keyboard-visible"); },
    snapshot(): WarmupSnapshot {
      const apps = ["facebook", "twitter", "instagram", "foursquare", "flickr", "tumblr", "photos", "messages"];
      const counts = (items: typeof viewport) => ({ totalTasks: items.length, completedTasks: items.filter(task => completed.has(task.id)).length, deferredTasks: items.filter(task => deferred.has(task.id)).length });
      return { ...state, completedTaskIds: [...completed], deferredTaskIds: [...deferred], firstViewport: {
        ...counts(viewport), totalBytes: viewport.reduce((sum, task) => sum + (task.bytes ?? 0), 0),
        completedBytes: viewport.filter(task => completed.has(task.id)).reduce((sum, task) => sum + (task.bytes ?? 0), 0),
        perApp: Object.fromEntries(apps.map(app => {
          const count = counts(viewport.filter(task => task.firstViewportApps!.includes(app)));
          return [app, { ...count, status: count.completedTasks === count.totalTasks ? "ready" : count.deferredTasks ? "deferred" : "pending" }];
        })), gracePeriodUsed, bootExitWithIncompleteFirstViewport: exitIncomplete,
      } };
    },
  };
}

export function browserWarmupHost(): WarmupHost {
  return {
    now: () => performance.now(),
    idle(run) {
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(deadline => run(deadline.didTimeout ? 4 : deadline.timeRemaining()), { timeout: 100 });
        return () => window.cancelIdleCallback(id);
      }
      const id = window.setTimeout(() => run(4), 32);
      return () => window.clearTimeout(id);
    },
    timer(run, ms) { const id = window.setTimeout(run, ms); return () => window.clearTimeout(id); },
    mark(name) {
      if (name === "sm2010:boot-warmup-start") {
        for (const suffix of ["tier0-ready", "keyboard-prewarm-ready", "tier1-ready", "boot-exit", "first-app-open", "first-keyboard-visible"]) {
          performance.clearMarks?.(`sm2010:${suffix}`); performance.clearMeasures?.(`sm2010:${suffix}:duration`);
        }
      }
      performance.clearMarks?.(name); performance.mark?.(name);
      if (name !== "sm2010:boot-warmup-start" && performance.getEntriesByName?.("sm2010:boot-warmup-start").length) {
        performance.clearMeasures?.(`${name}:duration`);
        performance.measure?.(`${name}:duration`, "sm2010:boot-warmup-start", name);
      }
    },
  };
}
