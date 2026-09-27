import { Dispatch, ReactNode, useLayoutEffect, useRef } from "react";
import { AppRuntimeEvent, AppRuntimeState } from "../state/appRuntimeState";
import { isCoreFirstFrameApp } from "./coreAppFirstFrame";

type AppLaunchContainerProps = {
  runtime: AppRuntimeState;
  dispatch: Dispatch<AppRuntimeEvent>;
  onClosed: () => void;
  children?: ReactNode;
  retainShell?: boolean;
  inactive?: boolean;
  onCoreFirstFrame?: (appId: string) => void;
};

export function AppLaunchContainer({ runtime, dispatch, onClosed, children, retainShell = false, inactive = false, onCoreFirstFrame }: AppLaunchContainerProps) {
  const surface = useRef<HTMLDivElement>(null);
  const reported = useRef<string | null>(null);
  useLayoutEffect(() => {
    const appId = runtime.activeAppId;
    if (inactive || !appId || !isCoreFirstFrameApp(appId) || runtime.phase !== "launching") return;
    const expected = { messages: ".mobilesms-container .mobilesms-navigation-bar",
      facebook: ".facebook-container .facebook-navigation-bar",
      twitter: ".twitter-container .twitter-navigation-bar",
      instagram: ".instagram-container .instagram-navigation-bar" }[appId];
    if (!surface.current?.querySelector(expected)) return;
    if (reported.current !== appId) { reported.current = appId; onCoreFirstFrame?.(appId); }
  }, [inactive, runtime.activeAppId, runtime.phase, onCoreFirstFrame]);
  if (runtime.phase === "none" && !retainShell) return null;

  return <div
    className={`app-launch-container is-${runtime.phase}${inactive ? " is-prewarm" : ""}`}
    aria-hidden={inactive || undefined}
    inert={inactive}
    data-app-id={runtime.activeAppId ?? undefined}
    onAnimationEnd={event => {
      if (event.target !== event.currentTarget) return;
      if (inactive) return;
      if (runtime.phase === "closing") {
        dispatch({ type: "ANIMATION_COMPLETE" });
        onClosed();
      } else if (runtime.phase === "launching" || runtime.phase === "resuming") {
        dispatch({ type: "ANIMATION_COMPLETE" });
      }
    }}
  >
    <div ref={surface} className="app-runtime-surface" aria-hidden={children ? undefined : true}>{children}</div>
  </div>;
}
