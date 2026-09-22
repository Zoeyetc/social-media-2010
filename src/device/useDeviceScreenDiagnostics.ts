import { useEffect, useRef } from "react";
import type { DevicePresenter } from "./DevicePresentation";

type Report = {
  semanticInstanceId: number | null;
  rawMounts: number; rawUnmounts: number; semanticMounts: number; semanticUnmounts: number;
  presenter: DevicePresenter; experienceSessionId: string | null;
  sessions: Record<string, number[]>; transitions: string[];
};
const visible = import.meta.env.DEV && (new URLSearchParams(location.search).get("deviceScreenDebug") === "1" || new URLSearchParams(location.search).get("heroLifecycleDebug") === "1");
const enabled = visible || (import.meta.env.DEV && new URLSearchParams(location.search).get("performanceDebug") === "1");
let nextInstance = 0;
const seen = new Set<number>();
const active = new Set<number>();
const report: Report = { semanticInstanceId: null, rawMounts: 0, rawUnmounts: 0, semanticMounts: 0, semanticUnmounts: 0, presenter: "legacy", experienceSessionId: null, sessions: {}, transitions: [] };
let output: HTMLOutputElement | null = null;
function publish() {
  if (!enabled) return;
  (window as Window & { __SM2010_DEVICE_SCREEN_QA__?: Report }).__SM2010_DEVICE_SCREEN_QA__ = report;
  if (output) output.textContent = `DeviceScreen ${report.presenter} · session ${report.experienceSessionId ?? "not started"}\nraw setup/cleanup ${report.rawMounts}/${report.rawUnmounts} · semantic instances/unmounts ${report.semanticMounts}/${report.semanticUnmounts}\n${report.transitions.slice(-4).join(" → ")}\nStrictMode replay reuses an instance; local app state still requires interaction QA.`;
}

/** Instrument the actual DeviceScreen, not merely its parent or portal host. */
export function useDeviceScreenDiagnostics(presenter: DevicePresenter, experienceSessionId: string | null) {
  const instance = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const id = instance.current ??= ++nextInstance;
    report.semanticInstanceId = id;
    report.rawMounts++;
    seen.add(id); active.add(id); report.semanticMounts = seen.size;
    if (visible && !output) {
      output = document.createElement("output");
      output.setAttribute("aria-label", "DeviceScreen continuity diagnostics");
      Object.assign(output.style, { position: "fixed", left: "8px", top: "8px", zIndex: "300", whiteSpace: "pre-wrap", maxWidth: "90vw", background: "#101010e8", color: "#bbb", padding: "6px", font: "10px monospace", pointerEvents: "none" });
      document.body.append(output);
    }
    publish();
    const observePresentation = () => {
      const phase = document.querySelector(".hero-sandbox")?.getAttribute("data-phase");
      const host = document.querySelector(".hero-screen-portal")?.getAttribute("data-state");
      const entry = phase ? `hero:${phase}/${host ?? "host pending"}` : "legacy:device";
      if (report.transitions[report.transitions.length - 1] !== entry) report.transitions.push(entry);
      publish();
    };
    const observer = new MutationObserver(observePresentation);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-phase", "data-state"] });
    observePresentation();
    return () => {
      observer.disconnect();
      report.rawUnmounts++; active.delete(id); publish();
      queueMicrotask(() => {
        // StrictMode immediately replays setup on the same instance.
        if (!active.has(id)) report.semanticUnmounts++;
        publish();
        if (active.size === 0) { output?.remove(); output = null; }
      });
    };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    report.presenter = presenter; report.experienceSessionId = experienceSessionId;
    const id = instance.current;
    if (id !== null) {
      const session = report.sessions[experienceSessionId ?? "pre-session"] ??= [];
      if (!session.includes(id)) session.push(id);
    }
    const entry = `${presenter}:${experienceSessionId ?? "pre-session"}`;
    if (report.transitions[report.transitions.length - 1] !== entry) report.transitions.push(entry);
    publish();
  }, [presenter, experienceSessionId]);
}
