import { useEffect, useRef } from "react";

type ScheduleFrame = (callback: FrameRequestCallback) => number;
type CancelFrame = (handle: number) => void;

export type RafScrollPersistence = Readonly<{
  record: (position: number) => void;
  flush: () => void;
  cancel: () => void;
  sync: (position: number) => void;
  current: () => number;
}>;

export function createRafScrollPersistence(
  initialPosition: number,
  commit: (position: number) => void,
  scheduleFrame: ScheduleFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame: CancelFrame = handle => globalThis.cancelAnimationFrame(handle),
): RafScrollPersistence {
  let latestPosition = Math.max(0, initialPosition);
  let committedPosition = latestPosition;
  let pendingFrame: number | null = null;
  let dirty = false;

  const commitLatest = () => {
    pendingFrame = null;
    if (!dirty || latestPosition === committedPosition) {
      dirty = false;
      return;
    }
    dirty = false;
    committedPosition = latestPosition;
    commit(latestPosition);
  };

  return {
    record(position) {
      latestPosition = Math.max(0, position);
      dirty = latestPosition !== committedPosition;
      if (dirty && pendingFrame === null) pendingFrame = scheduleFrame(commitLatest);
    },
    flush() {
      if (pendingFrame !== null) cancelFrame(pendingFrame);
      commitLatest();
    },
    cancel() {
      if (pendingFrame !== null) cancelFrame(pendingFrame);
      pendingFrame = null;
      dirty = false;
    },
    sync(position) {
      if (pendingFrame !== null || dirty) return;
      latestPosition = Math.max(0, position);
      committedPosition = latestPosition;
    },
    current: () => latestPosition,
  };
}

export function useRafScrollPersistence(initialPosition: number, commit: (position: number) => void) {
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const persistenceRef = useRef<RafScrollPersistence | null>(null);
  if (!persistenceRef.current) {
    persistenceRef.current = createRafScrollPersistence(initialPosition, position => commitRef.current(position));
  }
  persistenceRef.current.sync(initialPosition);

  useEffect(() => {
    const persistence = persistenceRef.current!;
    return () => persistence.cancel();
  }, []);

  return persistenceRef.current;
}
