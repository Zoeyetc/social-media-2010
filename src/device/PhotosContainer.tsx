import { Dispatch, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, TransitionEvent } from "react";
import { cameraMediaThumbnail, type CameraMediaRecord, type CameraVideoRecord } from "../state/cameraCaptureState";
import type { CameraRollInitialization, PhotosEvent, PhotosState } from "../state/cameraRollState";

type PhotosBrowseProps = Readonly<{
  mode?: "browse";
  state: PhotosState;
  dispatch: Dispatch<PhotosEvent>;
  cameraRoll: CameraRollInitialization;
}>;

type PhotosPickerProps = Readonly<{
  mode: "picker";
  cameraRoll: CameraRollInitialization;
  onPickerCancel: () => void;
  onPickerSelect: (photoId: string) => void;
}>;

type PhotosContainerProps = PhotosBrowseProps | PhotosPickerProps;

export function PhotosContainer(props: PhotosContainerProps) {
  if (props.mode === "picker") {
    return <CameraRollGrid
      cameraRoll={{...props.cameraRoll,records:props.cameraRoll.records.filter(record=>record.mediaKind !== "video")}}
      backLabel="Cancel"
      mode="picker"
      onBack={props.onPickerCancel}
      onOpenPhoto={props.onPickerSelect}
    />;
  }

  return <PhotosBrowseContainer {...props} />;
}

function PhotosBrowseContainer({ state, dispatch, cameraRoll }: PhotosBrowseProps) {
  const selectedPhoto = state.selectedPhotoId
    ? cameraRoll.records.find(record => record.id === state.selectedPhotoId) ?? null
    : null;

  useEffect(() => {
    if (state.view !== "photo" || !state.selectedPhotoId || selectedPhoto) return;
    const fallbackPhoto = cameraRoll.records[cameraRoll.records.length - 1];
    dispatch(fallbackPhoto
      ? { type: "PAGE_PHOTO", photoId: fallbackPhoto.id }
      : { type: "OPEN_CAMERA_ROLL" });
  }, [cameraRoll.records, dispatch, selectedPhoto, state.selectedPhotoId, state.view]);

  if (state.view === "photo" && selectedPhoto) {
    const selectedIndex = cameraRoll.records.findIndex(record => record.id === selectedPhoto.id);
    if(selectedPhoto.mediaKind === "video") return <VideoViewer key={selectedPhoto.id} video={selectedPhoto} onBack={()=>dispatch({type:"BACK"})}/>;
    return <PhotoViewer
      photo={selectedPhoto}
      previousPhoto={selectedIndex > 0 ? cameraRoll.records[selectedIndex - 1] : null}
      nextPhoto={selectedIndex >= 0 && selectedIndex < cameraRoll.records.length - 1
        ? cameraRoll.records[selectedIndex + 1]
        : null}
      controlsVisible={state.viewerControlsVisible}
      onBack={() => dispatch({ type: "BACK" })}
      onToggleControls={() => dispatch({ type: "TOGGLE_VIEWER_CONTROLS" })}
      onPage={photoId => dispatch({ type: "PAGE_PHOTO", photoId })}
    />;
  }

  if (state.view === "cameraRoll" || state.view === "photo") {
    return <CameraRollGrid
      cameraRoll={cameraRoll}
      onBack={() => dispatch({ type: "BACK" })}
      onOpenPhoto={photoId => dispatch({ type: "OPEN_PHOTO", photoId })}
    />;
  }

  const latestPhoto = cameraRoll.records[cameraRoll.records.length - 1] ?? null;
  return <section className="photos-container" aria-label="Photos">
    <PhotosNavigationBar title="Photos" />
    <div className="photos-album-list" data-visual-status="RECONSTRUCTED">
      {cameraRoll.status === "loading"
        ? <p className="photos-state-message" role="status">Loading Camera Roll…</p>
        : cameraRoll.status === "error"
          ? <p className="photos-state-message is-error" role="alert">Camera Roll Unavailable</p>
          : <button
            type="button"
            className="photos-album-row"
            data-ordering-status="PROBABLE"
            onClick={() => dispatch({ type: "OPEN_CAMERA_ROLL" })}
          >
            <span className="photos-album-cover">
              {latestPhoto
                ? <img src={cameraMediaThumbnail(latestPhoto)} alt="" />
                : <span className="photos-album-cover-empty" aria-hidden="true" />}
            </span>
            <strong>Camera Roll</strong>
            <span className="photos-album-count">{cameraRoll.records.length}</span>
            <span className="photos-disclosure" aria-hidden="true">›</span>
          </button>}
    </div>
  </section>;
}

function CameraRollGrid({
  cameraRoll,
  backLabel = "Albums",
  mode = "browse",
  onBack,
  onOpenPhoto,
}: Readonly<{
  cameraRoll: CameraRollInitialization;
  backLabel?: string;
  mode?: "browse" | "picker";
  onBack: () => void;
  onOpenPhoto: (photoId: string) => void;
}>) {
  const grid = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = grid.current;
    if (element && cameraRoll.status === "ready") element.scrollTop = element.scrollHeight;
  }, [cameraRoll.records.length, cameraRoll.status]);

  return <section className="photos-container" aria-label={mode === "picker" ? "Choose from Camera Roll" : "Camera Roll"} data-mode={mode}>
    <PhotosNavigationBar title="Camera Roll" backLabel={backLabel} onBack={onBack} />
    <div
      ref={grid}
      className="photos-camera-roll-grid"
      data-visual-status="RECONSTRUCTED"
      data-ordering-status="PROBABLE"
    >
      {cameraRoll.status === "loading"
        ? <p className="photos-state-message" role="status">Loading Camera Roll…</p>
        : cameraRoll.status === "error"
          ? <p className="photos-state-message is-error" role="alert">Camera Roll Unavailable</p>
          : cameraRoll.records.length === 0
            ? <p className="photos-state-message">No Photos</p>
            : cameraRoll.records.map(photo => <button
              type="button"
              className="photos-camera-roll-thumbnail"
              key={photo.id}
              aria-label={`Open ${photo.filename}`}
              onClick={() => onOpenPhoto(photo.id)}
            >
              <img src={cameraMediaThumbnail(photo)} alt="" />
              {photo.mediaKind === "video" && <span className="photos-video-badge">▶ {Math.ceil(photo.durationMs/1000)}s</span>}
            </button>)}
    </div>
  </section>;
}

function PhotoViewer({
  photo,
  previousPhoto,
  nextPhoto,
  controlsVisible,
  onBack,
  onToggleControls,
  onPage,
}: Readonly<{
  photo: CameraMediaRecord;
  previousPhoto: CameraMediaRecord | null;
  nextPhoto: CameraMediaRecord | null;
  controlsVisible: boolean;
  onBack: () => void;
  onToggleControls: () => void;
  onPage: (photoId: string) => void;
}>) {
  const viewer = useRef<HTMLButtonElement | null>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    maximumMovement: number;
  } | null>(null);
  const pendingPhotoId = useRef<string | null>(null);
  const suppressClick = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    drag.current = null;
    pendingPhotoId.current = null;
    suppressClick.current = false;
    setDragOffset(0);
    setSettling(false);
  }, [photo.id]);

  const settleToPhoto = (target: CameraMediaRecord, offset: number) => {
    pendingPhotoId.current = target.id;
    setSettling(true);
    setDragOffset(offset);
  };

  const beginDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (settling || !event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      maximumMovement: 0,
    };
    pendingPhotoId.current = null;
    suppressClick.current = false;
    setSettling(false);
  };

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const activeDrag = drag.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const deltaX = event.clientX - activeDrag.startX;
    const deltaY = event.clientY - activeDrag.startY;
    activeDrag.maximumMovement = Math.max(activeDrag.maximumMovement, Math.hypot(deltaX, deltaY));
    const width = event.currentTarget.getBoundingClientRect().width;
    const directionalOffset = deltaX < 0 && !nextPhoto
      ? 0
      : deltaX > 0 && !previousPhoto
        ? 0
        : deltaX;
    setDragOffset(Math.max(-width, Math.min(width, directionalOffset)));
  };

  const finishDrag = (event: PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const activeDrag = drag.current;
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - activeDrag.startX;
    const deltaY = event.clientY - activeDrag.startY;
    const maximumMovement = Math.max(activeDrag.maximumMovement, Math.hypot(deltaX, deltaY));
    const width = event.currentTarget.getBoundingClientRect().width;
    const pageThreshold = width * 0.2;
    const wasTap = !cancelled && maximumMovement < 8;
    suppressClick.current = !wasTap;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;

    if (!cancelled && deltaX <= -pageThreshold && nextPhoto) {
      settleToPhoto(nextPhoto, -width);
    } else if (!cancelled && deltaX >= pageThreshold && previousPhoto) {
      settleToPhoto(previousPhoto, width);
    } else if (!wasTap && dragOffset !== 0) {
      pendingPhotoId.current = null;
      setSettling(true);
      setDragOffset(0);
    } else {
      setDragOffset(0);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (settling) return;
    const width = viewer.current?.getBoundingClientRect().width ?? 320;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (previousPhoto) settleToPhoto(previousPhoto, width);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (nextPhoto) settleToPhoto(nextPhoto, -width);
    }
  };

  const finishSettling = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    const targetPhotoId = pendingPhotoId.current;
    pendingPhotoId.current = null;
    setDragOffset(0);
    setSettling(false);
    if (targetPhotoId) onPage(targetPhotoId);
  };

  return <section
    className={`photos-container photos-photo-viewer${controlsVisible ? " has-controls" : ""}`}
    aria-label={photo.filename}
    data-visual-status="RECONSTRUCTED"
    data-paging-timing-status="RECONSTRUCTED"
    onKeyDown={handleKeyDown}
  >
    {controlsVisible && <PhotosNavigationBar title="Camera Roll" backLabel="Camera Roll" onBack={onBack} />}
    <button
      ref={viewer}
      type="button"
      autoFocus
      className={`photos-photo-viewer-image${settling ? " is-settling" : ""}`}
      aria-label={controlsVisible ? "Hide photo controls" : "Show photo controls"}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={event => finishDrag(event, true)}
      onLostPointerCapture={() => { drag.current = null; }}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        onToggleControls();
      }}
    >
      <span
        className="photos-photo-viewer-track"
        style={{ transform: `translate3d(${dragOffset}px,0,0)` }}
        onTransitionEnd={finishSettling}
      >
        {previousPhoto && <span className="photos-photo-viewer-slide is-previous" aria-hidden="true">
          <img src={cameraMediaThumbnail(previousPhoto)} alt="" />
        </span>}
        <span className="photos-photo-viewer-slide is-current">
          <img src={cameraMediaThumbnail(photo)} alt={photo.filename} />
        </span>
        {nextPhoto && <span className="photos-photo-viewer-slide is-next" aria-hidden="true">
          <img src={cameraMediaThumbnail(nextPhoto)} alt="" />
        </span>}
      </span>
    </button>
  </section>;
}

function PhotosNavigationBar({
  title,
  backLabel,
  onBack,
}: Readonly<{
  title: string;
  backLabel?: string;
  onBack?: () => void;
}>) {
  return <header className="photos-navigation-bar" data-visual-status="RECONSTRUCTED">
    {backLabel && onBack && <button type="button" className="photos-back-button" onClick={onBack}>
      {backLabel}
    </button>}
    <strong>{title}</strong>
  </header>;
}

function VideoViewer({video,onBack}:{video:CameraVideoRecord;onBack:()=>void}) {
  const player=useRef<HTMLVideoElement|null>(null);
  const [playing,setPlaying]=useState(false);
  useEffect(()=>{const element=player.current;return()=>{if(element){element.pause();element.removeAttribute("src");element.load();}};},[video.id]);
  return <section className="photos-container photos-video-viewer" aria-label="Video">
    <PhotosNavigationBar title="Camera Roll" backLabel="Camera Roll" onBack={onBack}/>
    <video ref={player} src={video.objectUrl} poster={video.posterUrl} muted playsInline preload="metadata" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} aria-label={video.filename}/>
    <button type="button" className="photos-video-play" onClick={()=>{const element=player.current;if(!element)return;if(element.paused)void element.play().catch(()=>setPlaying(false));else element.pause();}}>{playing?"Pause":"Play"}</button>
  </section>;
}
