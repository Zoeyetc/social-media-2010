import { useEffect, useRef, useState } from "react";

// HISTORICALLY GROUNDED RECONSTRUCTION. The period video supports the sequence,
// but neither this duration nor the CSS easing is an authenticated Apple value.
export const PASSCODE_ENTRY_DURATION_MS = 280;
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

/** DeviceScreen owns presentation completion, including cancellation on cover/reset. */
export function usePasscodeEntryTransition(entering: boolean, sessionId: string | null, onComplete: () => void) {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" && Boolean(window.matchMedia?.(reducedMotionQuery).matches));
  const completion = useRef(onComplete);
  completion.current = onComplete;
  const finish = useRef<(() => void) | null>(null);
  // One millisecond is an accessibility completion boundary, not historical timing.
  const durationMs = reducedMotion ? 1 : PASSCODE_ENTRY_DURATION_MS;
  useEffect(() => {
    const query = window.matchMedia?.(reducedMotionQuery);
    if (!query) return;
    const changed = () => setReducedMotion(query.matches);
    changed();
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    if (!entering) return;
    let active = true;
    const complete = () => {
      if (!active) return;
      active = false;
      window.clearTimeout(timer);
      completion.current();
    };
    // Same bound as the CSS timeline; also completes if animation events are lost.
    const timer = window.setTimeout(complete, durationMs);
    finish.current = complete;
    return () => {
      active = false;
      window.clearTimeout(timer);
      if (finish.current === complete) finish.current = null;
    };
  }, [entering, sessionId, durationMs]);
  return { durationMs, reducedMotion, complete: () => finish.current?.() };
}
