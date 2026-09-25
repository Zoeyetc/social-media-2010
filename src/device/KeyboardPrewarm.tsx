import { useEffect, useRef, useState } from "react";
import { IOS4KeyboardSystem } from "./IOS4KeyboardSystem";
import { markKeyboardPrewarmed, needsKeyboardPrewarm } from "./keyboardPrewarmState";

/** Mount the real keyboard chrome during SpringBoard idle, before first text focus. */
export function KeyboardPrewarm({ sessionId }: { sessionId: string }) {
  const [ready, setReady] = useState(false);
  const startedAt = useRef(0);
  useEffect(() => {
    setReady(false);
    if (!needsKeyboardPrewarm(sessionId)) return;
    const hasIdleCallback = typeof window.requestIdleCallback === "function";
    const schedule = hasIdleCallback
      ? (callback: () => void) => window.requestIdleCallback(callback, { timeout: 1500 })
      : (callback: () => void) => window.setTimeout(callback, 120);
    const cancel = hasIdleCallback
      ? (id: number) => window.cancelIdleCallback(id)
      : (id: number) => window.clearTimeout(id);
    const id = schedule(() => {
      markKeyboardPrewarmed(sessionId);
      startedAt.current = performance.now();
      setReady(true);
    });
    return () => cancel(id);
  }, [sessionId]);
  useEffect(() => {
    if (!ready || !import.meta.env.DEV) return;
    const id = requestAnimationFrame(() => {
      console.info("[IOS4Keyboard] idle cold mount/layout ms", Math.round(performance.now() - startedAt.current));
    });
    return () => cancelAnimationFrame(id);
  }, [ready]);
  return ready ? <div className="ios4-keyboard-prewarm" aria-hidden="true" inert>
    <IOS4KeyboardSystem><></></IOS4KeyboardSystem>
  </div> : null;
}
