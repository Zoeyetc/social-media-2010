import { DeviceAudio } from "../audio/deviceAudio";
import { activeNotification, notificationBadges, type NotificationContext, type NotificationState } from "../state/notificationState";

// Read-only diagnostics use the controller's existing render clock; no debug scheduler.
export function NotificationDebug({ state, context }: { state: NotificationState; context: NotificationContext }) {
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get("notificationDebug") !== "1") return null;
  return <aside aria-label="Notification diagnostics" style={{ position: "fixed", left: 8, bottom: 8, zIndex: 10000, maxWidth: 340, maxHeight: "40vh", overflow: "auto", padding: 8, background: "#111e", color: "#ccc", font: "11px monospace", pointerEvents: "none" }}>
    <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{JSON.stringify({
      presentationOwner: state.presentationOwner ? `${state.presentationOwner.app}:${state.presentationOwner.id}` : null,
      active: activeNotification(state, context)?.id ?? null,
      badges: notificationBadges(state), lastDelivered: state.lastDelivered?.id ?? null,
      lastSuppressedNotificationSound: state.lastSuppressedSound,
      foreground: context.foregroundApp, lockState: context.phase,
      systemAlert: context.systemAlert, keyboard: context.keyboard, multitasking: context.multitasking,
      muteMode: DeviceAudio.diagnostics.muteMode, audioGateOpen: DeviceAudio.canPlayAudio,
    }, null, 2)}</pre>
  </aside>;
}
