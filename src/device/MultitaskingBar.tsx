import gamecenterSmallIcon from "../assets/historical/ios4.1/springboard/apps/GameCenter@2x.browser.png";
import appstoreSmallIcon from "../assets/historical/ios4.1/springboard/apps/AppStore@2x.browser.png";
import notesSmallIcon from "../assets/historical/ios4.1/springboard/apps/Notes@2x.browser.png";
import weatherSmallIcon from "../assets/historical/ios4.1/springboard/apps/Weather@2x.browser.png";
import safariFinalIcon from "../assets/historical/ios4.1/springboard/apps/Safari@2x.browser.png";
import youtubeFinalIcon from "../assets/historical/ios4.1/springboard/apps/YouTube@2x.browser.png";
import itunesFinalIcon from "../assets/historical/ios4.1/springboard/apps/iTunes@2x.browser.png";
import skypeRemainingIcon from "../assets/historical/ios4.1/springboard/apps/Skype-2010-AppStore.jpg";
import whatsappRemainingIcon from "../assets/historical/ios4.1/springboard/apps/WhatsApp-2010-AppStore.jpg";
import voicememosRemainingIcon from "../assets/historical/ios4.1/springboard/apps/VoiceMemos@2x.browser.png";
import compassRemainingIcon from "../assets/historical/ios4.1/springboard/apps/Compass@2x.browser.png";
import clockRemainingIcon from "../assets/historical/ios4.1/springboard/apps/Clock@2x.browser.png";
import calculatorIcon from "../assets/historical/ios4.1/springboard/apps/Calculator@2x.browser.png";
import calendarIcon from "../assets/historical/ios4.1/springboard/apps/Calendar@2x.browser.png";
import mapsIcon from "../assets/historical/ios4.1/springboard/apps/Maps@2x.browser.png";
import { Dispatch, PointerEvent, useEffect, useRef } from "react";
import { SPRINGBOARD_SOCIAL_APPS } from "../data/springBoardSocialApps";
import { AppRuntimeState } from "../state/appRuntimeState";
import { MultitaskingBarEvent, MultitaskingBarState } from "../state/multitaskingBarState";

const SYSTEM_MULTITASKING_APPS = [
  {id:"game-center",name:"Game Center",iconSrc:gamecenterSmallIcon,iconStatus:"READY",available:true},
  {id:"app-store",name:"App Store",iconSrc:appstoreSmallIcon,iconStatus:"READY",available:true},
  {id:"notes",name:"Notes",iconSrc:notesSmallIcon,iconStatus:"READY",available:true},
  {id:"weather",name:"Weather",iconSrc:weatherSmallIcon,iconStatus:"READY",available:true},
  {id:"safari",name:"Safari",iconSrc:safariFinalIcon,iconStatus:"READY",available:true},
  {id:"youtube",name:"YouTube",iconSrc:youtubeFinalIcon,iconStatus:"READY",available:true},
  {id:"itunes",name:"iTunes",iconSrc:itunesFinalIcon,iconStatus:"READY",available:true},
  {id:"skype",name:"Skype",iconSrc:skypeRemainingIcon,iconStatus:"READY",available:true},
  {id:"whatsapp",name:"WhatsApp",iconSrc:whatsappRemainingIcon,iconStatus:"READY",available:true},
  {id:"voice-memos",name:"Voice Memos",iconSrc:voicememosRemainingIcon,iconStatus:"READY",available:true},
  {id:"compass",name:"Compass",iconSrc:compassRemainingIcon,iconStatus:"READY",available:true},
  {id:"clock",name:"Clock",iconSrc:clockRemainingIcon,iconStatus:"READY",available:true},
  {id:"calculator",name:"Calculator",iconSrc:calculatorIcon,iconStatus:"READY",available:true},
  {id:"calendar",name:"Calendar",iconSrc:calendarIcon,iconStatus:"READY",available:true},
  {id:"maps",name:"Maps",iconSrc:mapsIcon,iconStatus:"READY",available:true},
];
const EDITING_HOLD_MS = 500;

type MultitaskingBarProps = {
  state: MultitaskingBarState;
  appRuntime: AppRuntimeState;
  dispatch: Dispatch<MultitaskingBarEvent>;
  onSelectApp: (appId: string) => void;
};

export function MultitaskingBar({ state, appRuntime, dispatch, onSelectApp }: MultitaskingBarProps) {
  const editingTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (editingTimer.current !== null) window.clearTimeout(editingTimer.current);
  }, []);
  if (state === "closed") return null;

  const retainedIds = new Set([
    ...appRuntime.suspendedAppIds,
    ...(appRuntime.activeAppId ? [appRuntime.activeAppId] : []),
  ]);
  const visibleApps = appRuntime.recentAppIds
    .filter(appId => retainedIds.has(appId))
    .map(appId => SYSTEM_MULTITASKING_APPS.find(app => app.id === appId) ?? SPRINGBOARD_SOCIAL_APPS.find(app => app.id === appId))
    .filter((app): app is NonNullable<typeof app> => Boolean(
      app?.iconStatus === "READY" && app.available && app.iconSrc,
    ));

  const cancelEditingTimer = () => {
    if (editingTimer.current !== null) window.clearTimeout(editingTimer.current);
    editingTimer.current = null;
  };
  const beginEditingTimer = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || state !== "open") return;
    cancelEditingTimer();
    editingTimer.current = window.setTimeout(() => {
      editingTimer.current = null;
      dispatch("ENTER_EDITING");
    }, EDITING_HOLD_MS);
  };

  return <div
    className={`multitasking-bar is-${state}`}
    aria-label="Multitasking bar"
    onAnimationEnd={event => {
      if (event.target === event.currentTarget && state === "opening") dispatch("ANIMATION_COMPLETE");
    }}
  >
    <div className="multitasking-icon-strip">
      {visibleApps.map(app => <div
        className="multitasking-icon-slot"
        data-app-id={app.id}
        key={app.id}
        onPointerDown={beginEditingTimer}
        onPointerUp={cancelEditingTimer}
        onPointerCancel={cancelEditingTimer}
        onPointerLeave={cancelEditingTimer}
        onClick={() => {
          if (state !== "editing") onSelectApp(app.id);
        }}
      >
        <img className="multitasking-app-icon" src={app.iconSrc} alt={app.name} />
        {state === "editing" && <button
          className="multitasking-delete-control"
          aria-label={`Remove ${app.name} from multitasking`}
          onClick={event => event.preventDefault()}
        >−</button>}
      </div>)}
    </div>
  </div>;
}
