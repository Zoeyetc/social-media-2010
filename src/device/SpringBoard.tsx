import { WEATHER } from "../state/smallApps";
import { CSSProperties, Dispatch, PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import appStoreIconSrc from "../assets/historical/ios4.1/springboard/apps/AppStore@2x.browser.png";
import calculatorIconSrc from "../assets/historical/ios4.1/springboard/apps/Calculator@2x.browser.png";
import calendarIconSrc from "../assets/historical/ios4.1/springboard/apps/Calendar@2x.browser.png";
import cameraIconSrc from "../assets/historical/ios4.1/springboard/apps/Camera@2x.browser.png";
import clockIconSrc from "../assets/historical/ios4.1/springboard/apps/Clock@2x.browser.png";
import compassIconSrc from "../assets/historical/ios4.1/springboard/apps/Compass@2x.browser.png";
import gameCenterIconSrc from "../assets/historical/ios4.1/springboard/apps/GameCenter@2x.browser.png";
import mapsIconSrc from "../assets/historical/ios4.1/springboard/apps/Maps@2x.browser.png";
import messagesIconSrc from "../assets/historical/ios4.1/springboard/apps/Messages@2x.browser.png";
import notesIconSrc from "../assets/historical/ios4.1/springboard/apps/Notes@2x.browser.png";
import photosIconSrc from "../assets/historical/ios4.1/springboard/apps/Photos@2x.browser.png";
import safariIconSrc from "../assets/historical/ios4.1/springboard/apps/Safari@2x.browser.png";
import settingsIconSrc from "../assets/historical/ios4.1/springboard/apps/Settings@2x.browser.png";
import stocksIconSrc from "../assets/historical/ios4.1/springboard/apps/Stocks@2x.browser.png";
import skypeIconSrc from "../assets/historical/ios4.1/springboard/apps/Skype-2010-AppStore.jpg";
import voiceMemosIconSrc from "../assets/historical/ios4.1/springboard/apps/VoiceMemos@2x.browser.png";
import weatherIconSrc from "../assets/historical/ios4.1/springboard/apps/Weather@2x.browser.png";
import whatsAppIconSrc from "../assets/historical/ios4.1/springboard/apps/WhatsApp-2010-AppStore.jpg";
import youtubeIconSrc from "../assets/historical/ios4.1/springboard/apps/YouTube@2x.browser.png";
import iTunesIconSrc from "../assets/historical/ios4.1/springboard/apps/iTunes@2x.browser.png";
import dockSrc from "../assets/historical/ios4.1/springboard/system/SBDockBG@2x.browser.png";
import pageIndicatorSrc from "../assets/historical/ios4.1/springboard/system/UIPageIndicator.png";
import pageIndicatorCurrentSrc from "../assets/historical/ios4.1/springboard/system/UIPageIndicatorCurrent.png";
import searchIndicatorSrc from "../assets/historical/ios4.1/springboard/system/SBSearchPageIndicator@2x.browser.png";
import searchIndicatorCurrentSrc from "../assets/historical/ios4.1/springboard/system/SBSearchPageIndicatorCurrent@2x.browser.png";
import badgeBackgroundSrc from "../assets/historical/ios4.1/springboard/system/SBBadgeBG@2x.browser.png";
import badgeMaskSrc from "../assets/historical/ios4.1/springboard/system/SBBadgeBGMask@2x.browser.png";
import folderIconSrc from "../assets/historical/ios4.1/springboard/folder/FolderIconBG@2x.browser.png";
import folderLinenSrc from "../assets/historical/ios4.1/springboard/folder/chrome/FolderSwitcherBG@2x.browser.png";
import folderShadowBottomSrc from "../assets/historical/ios4.1/springboard/folder/chrome/FolderShadowBottom@2x.browser.png";
import folderShadowTopSrc from "../assets/historical/ios4.1/springboard/folder/chrome/FolderShadowTop@2x.browser.png";
import { SPRINGBOARD_SOCIAL_APPS } from "../data/springBoardSocialApps";
import { FolderEvent, FolderState } from "../state/folderState";
import type { NotificationApp } from "../state/notificationState";

type SpringBoardProps = {
  currentPage: 0 | 1;
  onPageChange: (page: 0 | 1) => void;
  folderState: FolderState;
  dispatchFolderEvent: Dispatch<FolderEvent>;
  activeFolderSlotIndex: number;
  onActiveFolderSlotChange: (slotIndex: number) => void;
  onLaunchApp: (appId: string) => void;
  messagesBadgeCount: number;
  flickrUploadCount?: number;
  notificationBadgeCounts?: Partial<Record<NotificationApp, number>>;
};

type SwipeStart = {
  pointerId: number;
  x: number;
  y: number;
  axis: "pending" | "horizontal";
};

const PAGE_WIDTH = 320;
const SWIPE_THRESHOLD = 48;
const AXIS_LOCK_THRESHOLD = 6;
const SPRINGBOARD_GRID_LEFT = 16;
const SPRINGBOARD_GRID_TOP = 36;
const SPRINGBOARD_COLUMN_COUNT = 4;
const SPRINGBOARD_ROW_COUNT = 4;
const SPRINGBOARD_SLOT_WIDTH = 59;
const SPRINGBOARD_SLOT_HEIGHT = 74;
const SPRINGBOARD_COLUMN_GAP = 17;
const SPRINGBOARD_ROW_GAP = 14;
const FOLDER_TRAY_BASE_HEIGHT = 125;
const FOLDER_POINTER_WIDTH = 24;
const FOLDER_POINTER_HEIGHT = 12;
const FOLDER_LINEN_TOP_OFFSET = 30;

type SpringBoardSplitStyle = CSSProperties & {
  "--folder-upper-offset": string;
  "--folder-lower-offset": string;
};

type SocialAppId = (typeof SPRINGBOARD_SOCIAL_APPS)[number]["id"];
type FolderId = "utilities";
type FolderApp = { name: string; iconSrc: string; launchId: string };
type SpringBoardApp = {
  name: string;
  iconSrc?: string;
  iconPresentation?: "app-store-artwork";
  socialAppId?: SocialAppId;
  launchId?: string;
  kind?: "folder";
  folderId?: FolderId;
  folderApps?: readonly FolderApp[];
  calendarDay?: string;
};

const UTILITIES_APPS = [
  { name: "Clock", iconSrc: clockIconSrc, launchId: "clock" },
  { name: "Compass", iconSrc: compassIconSrc, launchId: "compass" },
  { name: "Calculator", iconSrc: calculatorIconSrc, launchId: "calculator" },
  { name: "Voice Memos", iconSrc: voiceMemosIconSrc, launchId: "voice-memos" },
] as const;

const PAGE_ONE_APPS: readonly (SpringBoardApp | undefined)[] = [
  { name: "Calendar", iconSrc: calendarIconSrc, calendarDay: "20", launchId: "calendar" },
  { name: "Photos", iconSrc: photosIconSrc, launchId: "photos" },
  { name: "Stocks", iconSrc: stocksIconSrc, launchId: "stocks" },
  { name: "Maps", iconSrc: mapsIconSrc, launchId: "maps" },
  { name: "Weather", iconSrc: weatherIconSrc, launchId: "weather" },
  { name: "Notes", iconSrc: notesIconSrc, launchId: "notes" },
  { name: "Utilities", iconSrc: folderIconSrc, kind: "folder", folderId: "utilities", folderApps: UTILITIES_APPS },
  { name: "iTunes", iconSrc: iTunesIconSrc, launchId: "itunes" },
  { name: "App Store", iconSrc: appStoreIconSrc, launchId: "app-store" },
  { name: "Game Center", iconSrc: gameCenterIconSrc, launchId: "game-center" },
  { name: "Settings", iconSrc: settingsIconSrc, launchId: "settings" },
  { name: "Facebook", socialAppId: "facebook", launchId: "facebook" },
  { name: "Twitter", socialAppId: "twitter", launchId: "twitter" },
  { name: "Instagram", socialAppId: "instagram", launchId: "instagram" },
  { name: "Foursquare", socialAppId: "foursquare", launchId: "foursquare" },
  { name: "Flickr", socialAppId: "flickr", launchId: "flickr" },
] as const;
const PAGE_TWO_APPS: readonly (SpringBoardApp | undefined)[] = [
  { name: "Tumblr", socialAppId: "tumblr", launchId: "tumblr" },
  { name: "WhatsApp", iconSrc: whatsAppIconSrc, iconPresentation: "app-store-artwork", launchId: "whatsapp" },
  { name: "Skype", iconSrc: skypeIconSrc, iconPresentation: "app-store-artwork", launchId: "skype" },
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
] as const;
const DOCK_APPS = [
  { name: "Messages", iconSrc: messagesIconSrc },
  { name: "Safari", iconSrc: safariIconSrc },
  { name: "Camera", iconSrc: cameraIconSrc },
  { name: "YouTube", iconSrc: youtubeIconSrc },
] as const;

export function SpringBoard({ currentPage, onPageChange, folderState, dispatchFolderEvent, activeFolderSlotIndex, onActiveFolderSlotChange, onLaunchApp, messagesBadgeCount, notificationBadgeCounts, flickrUploadCount = 0 }: SpringBoardProps) {
  const swipeStart = useRef<SwipeStart | null>(null);
  const suppressIconActivation = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const openFolder = (slotIndex: number) => {
    if (folderState !== "closed") return;
    onActiveFolderSlotChange(slotIndex);
    dispatchFolderEvent("OPEN");
  };

  const beginSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (folderState !== "closed") return;
    if (!event.isPrimary || event.button !== 0) return;
    suppressIconActivation.current = false;
    swipeStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, axis: "pending" };
    setDragOffset(0);
    setIsDragging(false);
  };

  const moveSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (start.axis === "pending") {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < AXIS_LOCK_THRESHOLD) return;
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        swipeStart.current = null;
        setDragOffset(0);
        setIsDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
      start.axis = "horizontal";
      setIsDragging(true);
    }

    event.preventDefault();
    const boundedDelta = currentPage === 0 ? Math.min(0, deltaX) : Math.max(0, deltaX);
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      suppressIconActivation.current = true;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
    }
    setDragOffset(boundedDelta);
  };

  const finishSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.x;
    if (start.axis === "horizontal" && Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      onPageChange(deltaX < 0 ? 1 : 0);
    }
    swipeStart.current = null;
    setDragOffset(0);
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const cancelSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (swipeStart.current?.pointerId !== event.pointerId) return;
    swipeStart.current = null;
    setDragOffset(0);
    setIsDragging(false);
  };

  const folderIsActive = folderState !== "closed";
  const activateIcon = (activate: () => void) => (event?: ReactMouseEvent<HTMLButtonElement>) => {
    if ((event?.detail ?? 0) > 0 && suppressIconActivation.current) return;
    activate();
  };
  const activeFolderRow = Math.floor(activeFolderSlotIndex / SPRINGBOARD_COLUMN_COUNT);
  const splitDistance = FOLDER_TRAY_BASE_HEIGHT - SPRINGBOARD_ROW_GAP;
  const upperShift = Math.round(splitDistance * (activeFolderRow + 1) / (SPRINGBOARD_ROW_COUNT + 1));
  const lowerShift = splitDistance - upperShift;
  const folderTrayTop = SPRINGBOARD_GRID_TOP
    + activeFolderRow * (SPRINGBOARD_SLOT_HEIGHT + SPRINGBOARD_ROW_GAP)
    + SPRINGBOARD_SLOT_HEIGHT
    - upperShift;
  const splitStyle: SpringBoardSplitStyle = {
    "--folder-upper-offset": `${-upperShift}px`,
    "--folder-lower-offset": `${lowerShift}px`,
  };

  return <div className={`springboard is-folder-${folderState}`} style={splitStyle}>
    {folderIsActive && <div className="springboard-folder-wallpaper-dim" aria-hidden="true" />}
    <div
      className="springboard-pages"
      onPointerDown={beginSwipe}
      onPointerMove={moveSwipe}
      onPointerUp={finishSwipe}
      onPointerCancel={cancelSwipe}
    >
      <div
        className={`springboard-pages-track${isDragging ? " is-dragging" : ""}`}
        style={{ transform: `translateX(${-currentPage * PAGE_WIDTH + dragOffset}px)` }}
      >
        <SpringBoardPage apps={PAGE_ONE_APPS} pageNumber={1} badgeCounts={Object.fromEntries(PAGE_ONE_APPS.map((app, index) => [index, app?.launchId === "flickr" ? flickrUploadCount : notificationBadgeCounts?.[app?.launchId as NotificationApp] ?? 0]))} folderSourceSlotIndex={folderIsActive ? activeFolderSlotIndex : undefined} onAppActivate={index => {
          const app = PAGE_ONE_APPS[index];
          if (app?.folderId) openFolder(index);
          else if (app?.launchId) onLaunchApp(app.launchId);
        }} onIconActivate={activateIcon} />
        <SpringBoardPage apps={PAGE_TWO_APPS} pageNumber={2} onAppActivate={index => {
          const app = PAGE_TWO_APPS[index];
          if (app?.folderId) openFolder(index);
          else if (app?.launchId) onLaunchApp(app.launchId);
        }} onIconActivate={activateIcon} />
      </div>
    </div>
    <SpringBoardPageIndicator currentPage={currentPage} />
    <div className="springboard-dock">
      <img className="springboard-dock-artwork" src={dockSrc} alt="" aria-hidden="true" />
      {DOCK_APPS.map(app => <SpringBoardIcon
        key={app.name}
        {...app}
        dock
        badgeCount={app.name === "Messages" ? messagesBadgeCount : 0}
        onActivate={app.name === "Messages"
          ? () => onLaunchApp("messages")
          : app.name === "Camera"
            ? () => onLaunchApp("camera")
            : app.name === "Safari" ? () => onLaunchApp("safari")
              : app.name === "YouTube" ? () => onLaunchApp("youtube")
                : undefined}
      />)}
    </div>
    <SpringBoardFolder sourceSlotIndex={activeFolderSlotIndex} panelTop={folderTrayTop} state={folderState} dispatch={dispatchFolderEvent} onLaunchApp={onLaunchApp} />
  </div>;
}

function SpringBoardFolder({ sourceSlotIndex, panelTop, state, dispatch, onLaunchApp }: {
  sourceSlotIndex: number;
  panelTop: number;
  state: FolderState;
  dispatch: Dispatch<FolderEvent>;
  onLaunchApp: (appId: string) => void;
}) {
  if (state === "closed") return null;
  const apps: readonly FolderApp[] = UTILITIES_APPS;
  const rows = 1;
  const sourceColumn = sourceSlotIndex % SPRINGBOARD_COLUMN_COUNT;
  const anchorX = SPRINGBOARD_GRID_LEFT
    + sourceColumn * (SPRINGBOARD_SLOT_WIDTH + SPRINGBOARD_COLUMN_GAP)
    + SPRINGBOARD_SLOT_WIDTH / 2;
  const pointerLeft = anchorX - FOLDER_POINTER_WIDTH / 2;
  const panelHeight = 125 + (rows - 1) * 85;

  return <div
    className={`springboard-folder-overlay is-${state}`}
    aria-hidden={state === "closing"}
    onPointerDown={event => {
      if (state === "open" && event.target === event.currentTarget) dispatch("CLOSE");
    }}
  >
    <div
      className="springboard-folder-panel"
      role="group"
      aria-label="Utilities folder"
      style={{ height: panelHeight, top: panelTop }}
      onPointerDown={event => event.stopPropagation()}
      onAnimationEnd={event => {
        if (event.target === event.currentTarget) dispatch("ANIMATION_COMPLETE");
      }}
    >
      <div className="springboard-folder-tray">
        <img className="springboard-folder-linen" src={folderLinenSrc} alt="" aria-hidden="true" />
        <span
          className="springboard-folder-shadow is-top"
          style={{ backgroundImage: `url(${folderShadowTopSrc})` }}
          aria-hidden="true"
        />
        <span
          className="springboard-folder-shadow is-bottom"
          style={{ backgroundImage: `url(${folderShadowBottomSrc})` }}
          aria-hidden="true"
        />
        <div className="springboard-folder-title-layer">Utilities</div>
        <div className={`springboard-folder-grid is-${rows}-row`}>
          {apps.map(app => <SpringBoardIcon
            key={app.name}
            name={app.name}
            iconSrc={app.iconSrc}
            onActivate={state === "open" ? () => onLaunchApp(app.launchId) : undefined}
          />)}
        </div>
      </div>
      <span
        className="springboard-folder-notch is-top"
        aria-hidden="true"
        style={{
          left: pointerLeft,
          backgroundImage: `url(${folderLinenSrc})`,
          backgroundPosition: `${-pointerLeft}px ${-(FOLDER_LINEN_TOP_OFFSET - FOLDER_POINTER_HEIGHT)}px`,
        }}
      />
    </div>
  </div>;
}

function SpringBoardPage({ apps, pageNumber, onAppActivate, onIconActivate, badgeCounts, folderSourceSlotIndex }: {
  apps: readonly (SpringBoardApp | undefined)[];
  pageNumber: number;
  onAppActivate?: (index: number) => void;
  onIconActivate: (activate: () => void) => (event?: ReactMouseEvent<HTMLButtonElement>) => void;
  badgeCounts?: Partial<Record<number, number>>;
  folderSourceSlotIndex?: number;
}) {
  const renderGrid = (className: string, includeSlot: (index: number) => boolean) => <div className={`springboard-icon-grid ${className}`}>
    {apps.map((app, index) => <SpringBoardIcon
      key={app?.name ?? `empty-${index}`}
      {...(includeSlot(index) ? app : undefined)}
      badgeCount={includeSlot(index) ? (badgeCounts?.[index] ?? 0) : 0}
      onActivate={includeSlot(index) && app && onAppActivate ? onIconActivate(() => onAppActivate(index)) : undefined}
    />)}
  </div>;

  if (folderSourceSlotIndex !== undefined) {
    const folderRowEnd = (Math.floor(folderSourceSlotIndex / SPRINGBOARD_COLUMN_COUNT) + 1) * SPRINGBOARD_COLUMN_COUNT;
    return <div className="springboard-page is-folder-source" aria-label={`Home screen page ${pageNumber}`}>
      {renderGrid("springboard-page-split-region is-upper", index => index < folderRowEnd && index !== folderSourceSlotIndex)}
      {renderGrid("springboard-page-split-region is-active-folder-anchor", index => index === folderSourceSlotIndex)}
      {renderGrid("springboard-page-split-region is-lower", index => index >= folderRowEnd)}
    </div>;
  }

  return <div className="springboard-page" aria-label={`Home screen page ${pageNumber}`}>
    {renderGrid("", () => true)}
  </div>;
}

function SpringBoardIcon({ name, iconSrc, iconPresentation, kind, folderApps, socialAppId, calendarDay, dock = false, onActivate, badgeCount = 0 }: {
  name?: string;
  iconSrc?: string;
  iconPresentation?: "app-store-artwork";
  kind?: "folder";
  folderApps?: readonly FolderApp[];
  socialAppId?: SocialAppId;
  calendarDay?: string;
  dock?: boolean;
  onActivate?: () => void;
  badgeCount?: number;
}) {
  const content = <>
    {dock && iconSrc && <span className="springboard-dock-icon-reflection" aria-hidden="true">
      <img src={iconSrc} alt="" />
    </span>}
    {kind === "folder" && iconSrc
      ? <SpringBoardFolderIcon iconSrc={iconSrc} miniatures={folderApps ?? []} />
      : socialAppId
        ? <SpringBoardSocialIcon appId={socialAppId} />
        : name === "Weather" && iconSrc
          ? <span className="springboard-weather-artwork"><img className="springboard-system-icon" src={iconSrc} alt="Weather" /></span>
          : iconSrc && <img className={`springboard-system-icon${iconPresentation === "app-store-artwork" ? " is-app-store-artwork" : ""}`} src={iconSrc} alt={name ?? ""} />}
    {name === "Weather" && <span className="weather-icon-temperature" aria-label={`${WEATHER.temperature} degrees Fahrenheit`}><span className="weather-icon-digits" aria-hidden="true">{WEATHER.temperature}<span className="weather-icon-degree">°</span></span></span>}
    {calendarDay && <span className="springboard-calendar-date" aria-hidden="true"><small>Wednesday</small><b>{calendarDay}</b></span>}
    {(iconSrc || socialAppId) && name && <span className="springboard-icon-label">{name}</span>}
    {!!badgeCount && <SpringBoardBadge count={badgeCount} />}
  </>;

  if (onActivate) return <button
    className={`${dock ? "springboard-dock-slot" : "springboard-icon-slot"} springboard-icon-button`}
    data-app-name={name}
    onClick={onActivate}
  >{content}</button>;

  return <span className={dock ? "springboard-dock-slot" : "springboard-icon-slot"} data-app-name={name}>{content}</span>;
}

function SpringBoardFolderIcon({ iconSrc, miniatures }: { iconSrc: string; miniatures: readonly FolderApp[] }) {
  return <span className="springboard-folder-icon" aria-hidden="true">
    <img className="springboard-system-icon is-folder" src={iconSrc} alt="" />
    <span className="springboard-folder-mini-grid">
      {miniatures.slice(0, 9).map(app => <img key={app.name} src={app.iconSrc} alt="" />)}
    </span>
  </span>;
}

function SpringBoardSocialIcon({ appId }: { appId: SocialAppId }) {
  const app = SPRINGBOARD_SOCIAL_APPS.find(candidate => candidate.id === appId);
  if (!app) return null;
  return <img
    className="springboard-social-icon"
    src={app.iconSrc}
    alt=""
    data-app-id={app.id}
    data-artwork-status={app.artworkStatus}
    aria-hidden="true"
  />;
}

function SpringBoardPageIndicator({ currentPage }: { currentPage: 0 | 1 }) {
  const spotlightCurrent = false;
  const pageCount = 2;

  return <div className="springboard-page-indicator" aria-label={`Home screen page ${currentPage + 1} of 2`}>
    <img
      className="springboard-search-indicator"
      src={spotlightCurrent ? searchIndicatorCurrentSrc : searchIndicatorSrc}
      alt=""
      aria-hidden="true"
    />
    {Array.from({ length: pageCount }, (_, page) => <img
      className="springboard-page-dot"
      src={page === currentPage ? pageIndicatorCurrentSrc : pageIndicatorSrc}
      alt=""
      aria-hidden="true"
      key={page}
    />)}
  </div>;
}

export function SpringBoardBadge({ count }: { count: number }) {
  return <span className="springboard-badge" aria-label={`${count} unread notifications`}>
    <span
      className="springboard-badge-artwork"
      style={{ backgroundImage: `url(${badgeBackgroundSrc})`, maskImage: `url(${badgeMaskSrc})`, WebkitMaskImage: `url(${badgeMaskSrc})` }}
    />
    <b>{count}</b>
  </span>;
}
