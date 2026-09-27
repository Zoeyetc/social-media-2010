import { useEffect, useRef, useState } from "react";
import { browserWarmupHost, createBootWarmup, type WarmupSnapshot } from "./bootWarmup";
import { bootImageTasks } from "./bootWarmupImages";
import { buildSessionTimelineEvents } from "../data/sessionTimeline";

export type BootWarmupScreen = {
  keyboardRequested: boolean;
  onKeyboardReady: () => void;
};

/** App owns the schedule; DeviceScreen acknowledges the actual retained keyboard. */
export function useBootWarmup(sessionId: string | null, bootStartedAt: number | null, onFailure: () => void) {
  const active = useRef<{ id: string; schedule: ReturnType<typeof createBootWarmup>; keyboardReady: (() => void) | null;
    events: ReturnType<typeof buildSessionTimelineEvents> | null } | null>(null);
  const failure = useRef(onFailure); failure.current = onFailure;
  const [keyboardSession, setKeyboardSession] = useState<string | null>(null);
  const [readySession, setReadySession] = useState<string | null>(null);
  useEffect(() => {
    if (!sessionId || bootStartedAt === null) return;
    const run: NonNullable<typeof active.current> = { id: sessionId, schedule: null!, keyboardReady: null, events: null };
    run.schedule = createBootWarmup([
      { id: "canonical-runtime", tier: 0, run: () => {
        // Existing reducer/notification owners are already committed in App.
        // Prepare the canonical queue once, without starting the world clock or delivering events.
        run.events = buildSessionTimelineEvents();
      } },
      { id: "keyboard-structure", tier: 0, run: signal => new Promise<void>((resolve, reject) => {
        run.keyboardReady = resolve;
        signal.addEventListener("abort", () => reject(new Error("Keyboard warm-up cancelled")), { once: true });
        setKeyboardSession(sessionId);
      }) },
      ...bootImageTasks(),
    ], browserWarmupHost(), () => setReadySession(sessionId), () => failure.current());
    active.current = run;
    run.schedule.start();
    return () => {
      run.schedule.cancel(); run.keyboardReady = null; run.events = null;
      if (active.current === run) active.current = null;
      setKeyboardSession(null); setReadySession(null);
    };
  }, [sessionId, bootStartedAt]);
  return {
    bootCriticalReady: Boolean(sessionId && readySession === sessionId && active.current?.schedule.ready),
    screen: {
      keyboardRequested: Boolean(sessionId && keyboardSession === sessionId),
      onKeyboardReady: () => {
        if (active.current?.id !== sessionId) return;
        active.current.keyboardReady?.(); active.current.keyboardReady = null;
      },
    } satisfies BootWarmupScreen,
    preparedEvents: () => active.current?.id === sessionId ? active.current.events : null,
    canExit: () => Boolean(active.current?.id === sessionId && active.current.schedule.ready),
    bootExited: () => active.current?.schedule.markBootExit(),
    firstApp: () => active.current?.schedule.markFirstApp(),
    firstKeyboard: () => active.current?.schedule.markFirstKeyboard(),
    snapshot: (): WarmupSnapshot | null => active.current?.schedule.snapshot() ?? null,
  };
}
