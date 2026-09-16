import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { CAMERA_LOOK_NOMINAL_LIMITS, clampCameraLookPointerOffset } from "../state/cameraRuntime";
import type { CameraLookOffset, CameraOwner, CameraSession } from "../state/cameraRuntime";
import type { CameraPhotoRecord } from "../state/cameraCaptureState";
import cameraIconSrc from "../assets/historical/ios4.1/camera/CameraButtonIcon@2x.browser.png";
import cameraModeIconSrc from "../assets/historical/ios4.1/camera/CameraSwitchIcon@2x.browser.png";
import cameraLaunchSrc from "../assets/historical/ios4.1/camera/Default-Camera@2x.browser.png";
import videoModeIconSrc from "../assets/historical/ios4.1/camera/Video@2x.browser.png";
import switchWellSrc from "../assets/historical/ios4.1/camera/cameraButtonBarSwitchWell@2x.browser.png";
import switchWellBackgroundSrc from "../assets/historical/ios4.1/camera/cameraButtonBarSwitchWellBackground@2x.browser.png";
import shutterSrc from "../assets/historical/ios4.1/camera/cameraButtonSilver@2x.browser.png";
import shutterPressedSrc from "../assets/historical/ios4.1/camera/cameraButtonSilver_pressed@2x.browser.png";
import previewPlaceholderSrc from "../assets/historical/ios4.1/camera/cameraPreviewPlaceholder@2x.browser.png";
import previewWellSrc from "../assets/historical/ios4.1/camera/cameraPreviewWell@2x.browser.png";
import flashLeftSrc from "../assets/historical/ios4.1/camera/vc~cameraFlashBackgroundLeft.browser.png";
import flashRightSrc from "../assets/historical/ios4.1/camera/vc~cameraFlashBackgroundRight.browser.png";
import hdrLeftSrc from "../assets/historical/ios4.1/camera/vc~cameraHDRButtonLeft.browser.png";
import hdrRightSrc from "../assets/historical/ios4.1/camera/vc~cameraHDRButtonRight.browser.png";
import cameraToggleSrc from "../assets/historical/ios4.1/camera/vc~cameraToggle.browser.png";

type CameraContainerProps = {
  owner: CameraOwner;
  session: CameraSession;
  onCancel?: () => void;
  mediaAttachment?: boolean;
  previewCanvasRef?: (canvas: HTMLCanvasElement | null) => void;
  onLookPointerOffsetChange?: (offset: CameraLookOffset) => void;
  onCapture?: () => void;
  latestPhoto?: CameraPhotoRecord | null;
  onOpenLatestPhoto?: () => void;
};

type CameraLookDrag = {
  pointerId: number;
  clientX: number;
  clientY: number;
  pointerOffset: CameraLookOffset;
};

export function CameraContainer({
  owner,
  session,
  onCancel,
  mediaAttachment = false,
  previewCanvasRef,
  onLookPointerOffsetChange,
  onCapture,
  latestPhoto = null,
  onOpenLatestPhoto,
}: CameraContainerProps) {
  const isStandaloneCamera = owner === "cameraApp";
  const isLaunchingStandaloneCamera = isStandaloneCamera && session.phase === "launching";
  const lookDrag = useRef<CameraLookDrag | null>(null);
  const [shutterPressed, setShutterPressed] = useState(false);
  const cameraLookEnabled = isStandaloneCamera
    && session.phase === "previewing"
    && !session.suspended
    && Boolean(onLookPointerOffsetChange);
  const shutterEnabled = isStandaloneCamera
    && session.phase === "previewing"
    && !session.suspended
    && session.mode === "photo"
    && session.cameraDevice === "rear"
    && Boolean(onCapture);

  useEffect(() => {
    if (lookDrag.current) {
      lookDrag.current.pointerOffset = session.cameraLook.pointerOffset;
    }
  }, [session.cameraLook.pointerOffset]);

  const beginCameraLook = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!cameraLookEnabled || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    lookDrag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      pointerOffset: session.cameraLook.pointerOffset,
    };
  };

  const moveCameraLook = (event: PointerEvent<HTMLCanvasElement>) => {
    const drag = lookDrag.current;
    if (!drag || drag.pointerId !== event.pointerId || !onLookPointerOffsetChange) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const nextOffset = clampCameraLookPointerOffset({
      x: drag.pointerOffset.x
        + ((event.clientX - drag.clientX) / bounds.width) * CAMERA_LOOK_NOMINAL_LIMITS.x * 2,
      y: drag.pointerOffset.y
        - ((event.clientY - drag.clientY) / bounds.height) * CAMERA_LOOK_NOMINAL_LIMITS.y * 2,
    });
    drag.clientX = event.clientX;
    drag.clientY = event.clientY;
    drag.pointerOffset = nextOffset;
    onLookPointerOffsetChange(nextOffset);
  };

  const endCameraLook = (event: PointerEvent<HTMLCanvasElement>) => {
    if (lookDrag.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    lookDrag.current = null;
  };

  const pressShutter = (event: PointerEvent<HTMLButtonElement>) => {
    if (!shutterEnabled || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    setShutterPressed(true);
  };

  const pressShutterKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (shutterEnabled && (event.key === " " || event.key === "Enter")) setShutterPressed(true);
  };

  return <section
    className="camera-runtime-container"
    aria-label={owner === "cameraApp" ? "Camera" : "Camera attachment picker"}
    data-camera-owner={owner}
    data-media-attachment={mediaAttachment || undefined}
    data-camera-launch-mode={session.cameraLaunchMode}
    data-camera-phase={session.phase}
    data-camera-mode={session.mode}
    data-camera-device={session.cameraDevice}
    data-camera-suspended={session.suspended || undefined}
  >
    {isLaunchingStandaloneCamera
      ? <img className="camera-runtime-launch-raster" src={cameraLaunchSrc} alt="" />
      : previewCanvasRef
        ? <canvas
          ref={previewCanvasRef}
          className="camera-runtime-preview-surface"
          aria-hidden="true"
          data-camera-look-input={cameraLookEnabled || undefined}
          onPointerDown={beginCameraLook}
          onPointerMove={moveCameraLook}
          onPointerUp={endCameraLook}
          onPointerCancel={endCameraLook}
          onLostPointerCapture={() => { lookDrag.current = null; }}
        />
        : <div className="camera-runtime-preview-surface" aria-hidden="true" />}
    {isStandaloneCamera && !isLaunchingStandaloneCamera && <>
      <div className="camera-runtime-top-chrome" aria-hidden="true">
        <div className="camera-runtime-top-control is-flash" data-visual-status="RECONSTRUCTED">
          <img className="camera-runtime-control-cap is-left" src={flashLeftSrc} alt="" />
          <span className="camera-runtime-control-fill" aria-hidden="true">
            <img src={flashRightSrc} alt="" />
          </span>
          <img className="camera-runtime-control-cap is-right" src={flashRightSrc} alt="" />
          <span className="camera-runtime-control-label">Auto</span>
        </div>
        <div className="camera-runtime-top-control is-hdr" data-visual-status="RECONSTRUCTED">
          <img className="camera-runtime-control-cap is-left" src={hdrLeftSrc} alt="" />
          <span className="camera-runtime-control-fill" aria-hidden="true">
            <img src={hdrRightSrc} alt="" />
          </span>
          <img className="camera-runtime-control-cap is-right" src={hdrRightSrc} alt="" />
          <span className="camera-runtime-control-label">HDR Off</span>
        </div>
        <img
          className="camera-runtime-camera-toggle"
          data-visual-status="RECONSTRUCTED"
          src={cameraToggleSrc}
          alt=""
        />
      </div>
      <div className="camera-runtime-bottom-chrome">
        <img className="camera-runtime-preview-well" src={previewWellSrc} alt="" />
        {latestPhoto
          ? <img
            className="camera-runtime-preview-thumbnail"
            data-visual-status="RECONSTRUCTED"
            src={latestPhoto.objectUrl}
            alt=""
          />
          : <img className="camera-runtime-preview-placeholder" src={previewPlaceholderSrc} alt="" />}
        {latestPhoto && onOpenLatestPhoto && <button
          type="button"
          className="camera-runtime-preview-control"
          aria-label={`View ${latestPhoto.filename}`}
          onClick={onOpenLatestPhoto}
        />}
        <button
          type="button"
          className="camera-runtime-shutter"
          data-visual-status="RECONSTRUCTED"
          data-shutter-pressed={shutterPressed || undefined}
          aria-label="Take Picture"
          disabled={!shutterEnabled}
          style={{ borderImageSource: `url("${shutterPressed ? shutterPressedSrc : shutterSrc}")` }}
          onPointerDown={pressShutter}
          onPointerUp={() => setShutterPressed(false)}
          onPointerCancel={() => setShutterPressed(false)}
          onPointerLeave={() => setShutterPressed(false)}
          onKeyDown={pressShutterKey}
          onKeyUp={() => setShutterPressed(false)}
          onBlur={() => setShutterPressed(false)}
          onClick={() => {
            setShutterPressed(false);
            if (shutterEnabled) onCapture?.();
          }}
        />
        <img className="camera-runtime-shutter-icon" src={cameraIconSrc} alt="" />
        {!onCancel && <>
        <img className="camera-runtime-mode-background" src={switchWellBackgroundSrc} alt="" />
        <img className="camera-runtime-mode-well" src={switchWellSrc} alt="" />
        <img
          className="camera-runtime-mode-thumb"
          data-visual-status="RECONSTRUCTED"
          src={shutterSrc}
          alt=""
        />
        <img className="camera-runtime-mode-icon is-photo" src={cameraModeIconSrc} alt="" />
        <img className="camera-runtime-mode-icon is-video" src={videoModeIconSrc} alt="" />
        </>}
      </div>
    </>}
    {onCancel && <button
      type="button"
      className="camera-picker-cancel"
      data-visual-status="RECONSTRUCTED"
      onClick={onCancel}
    >Cancel</button>}
  </section>;
}
