import { PointerEvent, useRef, useState } from "react";
import { LockScreenModel } from "../state/lockScreenModel";
import { ActiveLockNotification } from "../state/lockNotificationState";

const PROVISIONAL_UNLOCK_THRESHOLD = 0.78;
type SliderState = "idle" | "dragging" | "success" | "returning";

type LockScreenProps = {
  model: LockScreenModel;
  onUnlock: () => void;
  activeLockNotification: ActiveLockNotification | null;
  onViewNotification: (notification: ActiveLockNotification) => void;
  inactive?: boolean;
};

export function LockScreen({ model, onUnlock, activeLockNotification, onViewNotification, inactive = false }: LockScreenProps) {
  const [slideProgress, setSlideProgress] = useState(0);
  const [slideOffset, setSlideOffset] = useState(0);
  const [sliderState, setSliderState] = useState<SliderState>("idle");
  const actionableNotificationVisible = activeLockNotification !== null;
  const trackRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLButtonElement>(null);
  const pointerId = useRef<number | null>(null);
  const pointerStartX = useRef(0);
  const progressAtStart = useRef(0);
  const progressRef = useRef(0);

  const setProgress = (progress: number) => {
    const next = Math.max(0, Math.min(1, progress));
    progressRef.current = next;
    setSlideProgress(next);
    setSlideOffset(next * travelDistance());
  };

  const travelDistance = () => {
    const track = trackRef.current;
    const knob = knobRef.current;
    if (!track || !knob) return 0;
    return Math.max(0, track.clientWidth - knob.offsetLeft * 2 - knob.offsetWidth);
  };

  const beginDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (inactive) return;
    setSliderState("dragging");
    pointerId.current = event.pointerId;
    pointerStartX.current = event.clientX;
    progressAtStart.current = progressRef.current;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId) return;
    const travel = travelDistance();
    if (travel === 0) return;
    setProgress(progressAtStart.current + (event.clientX - pointerStartX.current) / travel);
  };

  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerId.current = null;
    const completed = progressRef.current >= PROVISIONAL_UNLOCK_THRESHOLD;
    setSliderState(completed ? "success" : "returning");
    setProgress(0);
    if (completed) {
      if (activeLockNotification) onViewNotification(activeLockNotification);
      else onUnlock();
    } else {
      window.requestAnimationFrame(() => setSliderState("idle"));
    }
  };

  const cancelDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId) return;
    pointerId.current = null;
    setSliderState("returning");
    setProgress(0);
    window.requestAnimationFrame(() => setSliderState("idle"));
  };

  return <div className="lockscreen" inert={inactive} data-wallpaper-asset-status="READY">
    <div className="locktime">
      <time className="lock-clock-slot">{model.clock}</time>
      <time className="lock-date-slot">{model.date}</time>
    </div>
    {activeLockNotification && <section className="lockscreen-sms-alert" aria-label={activeLockNotification.payload.title} data-geometry-status="VISUAL-CROSSCHECK" data-material-status="RECONSTRUCTED">
      <strong className="lockscreen-sms-alert-title">{activeLockNotification.payload.title}</strong>
      {activeLockNotification.payload.sender && <b className="lockscreen-sms-alert-sender">{activeLockNotification.payload.sender}</b>}
      <p className="lockscreen-sms-alert-body">{activeLockNotification.payload.message}</p>
    </section>}
    <div className="lockscreen-bottom-bar">
      <div
        className="unlock-track"
        ref={trackRef}
        data-slider-state={sliderState}
        data-slider-background-asset-status="READY"
      >
        <span className="unlock-track-raster" aria-hidden="true" />
        <span className="unlock-track-label">{actionableNotificationVisible ? "slide to view" : "slide to unlock"}</span>
        <span className="unlock-track-highlight" aria-hidden="true">{actionableNotificationVisible ? "slide to view" : "slide to unlock"}</span>
        <button
          ref={knobRef}
          type="button"
          disabled={inactive}
          role="slider"
          aria-label={actionableNotificationVisible ? "Slide to view notification" : "Slide to unlock"}
          aria-valuemin={0}
          aria-valuemax={100}
          data-slider-knob-asset-status="READY"
          data-slider-arrow-source="embedded-in-knob-asset"
          aria-valuenow={Math.round(slideProgress * 100)}
          style={{ transform: `translateX(${slideOffset}px)` }}
          onPointerDown={beginDrag}
          onPointerMove={drag}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
        />
      </div>
    </div>
  </div>;
}
