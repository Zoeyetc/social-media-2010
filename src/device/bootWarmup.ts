export type WarmupTask = { id: string; tier: 0 | 1 | 2; run: (signal: AbortSignal) => void | Promise<void> };
export type WarmupSnapshot = {
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
export function createBootWarmup(tasks: readonly WarmupTask[], host: WarmupHost, onReady: () => void, onFailure: () => void) {
  const queue = [...tasks].sort((a, b) => a.tier - b.tier);
  const completed = new Set<string>(), deferred = new Set<string>(), marks = new Set<string>();
  const abort = new AbortController();
  let cancelIdle = () => {}, cancelDeadline = () => {}, cancelTask = () => {};
  let index = 0, started = false, stopped = false;
  const state: WarmupSnapshot = { startedAt: 0, tier: null, completedTaskIds: [], deferredTaskIds: [],
    bootCriticalReady: false, keyboardPrewarmMs: null, tier0CompleteMs: null, tier1CompleteMs: null, bootExitMs: null, failure: null };
  const mark = (name: string) => { if (!marks.has(name)) { marks.add(name); host.mark(`sm2010:${name}`); } };
  const elapsed = () => host.now() - state.startedAt;
  const cancel = () => { stopped = true; cancelIdle(); cancelDeadline(); cancelTask(); abort.abort(); };
  const failCritical = (id: string) => {
    if (stopped) return;
    state.failure = id;
    cancel();
    onFailure();
  };
  const schedule = () => {
    if (stopped || index >= queue.length) { state.tier = null; return; }
    cancelIdle = host.idle(budget => {
      if (stopped) return;
      if (budget < 4) { schedule(); return; }
      const task = queue[index++];
      state.tier = task.tier;
      const taskStart = host.now();
      const taskAbort = new AbortController();
      const abortTask = () => taskAbort.abort();
      abort.signal.addEventListener("abort", abortTask, { once: true });
      let settled = false;
      const finish = (success: boolean) => {
        if (stopped || settled) return;
        settled = true; cancelTask(); taskAbort.abort();
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
        schedule();
      };
      cancelTask = task.tier > 0 ? host.timer(() => finish(false), OPTIONAL_TASK_TIMEOUT_MS) : () => {};
      try { Promise.resolve(task.run(taskAbort.signal)).then(() => finish(true), () => finish(false)); }
      catch { finish(false); }
    });
  };
  return {
    start() {
      if (started) return;
      started = true; state.startedAt = host.now(); mark("boot-warmup-start");
      cancelDeadline = host.timer(() => failCritical("tier0-deadline"), BOOT_CRITICAL_DEADLINE_MS);
      schedule();
    },
    cancel,
    get ready() { return state.bootCriticalReady && !stopped; },
    markBootExit() {
      if (!state.bootCriticalReady || stopped || state.bootExitMs !== null) return;
      state.bootExitMs = elapsed(); mark("boot-exit");
      queue.filter(task => task.tier > 0 && !completed.has(task.id)).forEach(task => deferred.add(task.id));
    },
    markFirstApp() { if (!stopped && state.bootExitMs !== null) mark("first-app-open"); },
    markFirstKeyboard() { if (!stopped && state.bootExitMs !== null) mark("first-keyboard-visible"); },
    snapshot(): WarmupSnapshot { return { ...state, completedTaskIds: [...completed], deferredTaskIds: [...deferred] }; },
  };
}

export function browserWarmupHost(): WarmupHost {
  return {
    now: () => performance.now(),
    idle(run) {
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(deadline => run(deadline.timeRemaining()));
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
