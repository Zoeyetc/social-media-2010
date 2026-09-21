import type { DeviceEvent } from "./deviceEventScheduler";
import { emptySessionIdentity } from "./sessionIdentity";
import type { SessionIdentity } from "./sessionIdentity";
import { passcodeForExperienceSession } from "./passcode";

export const BOOT_DURATION_MS = 30_000;
export const POWER_HOLD_MS = 1_000;
export const SESSION_DURATION_MS = 15 * 60_000;
export const SESSION_KEY = "social-media-2010.session.v1";
export const SESSION_START_ISO = "2010-10-20T00:02:00-07:00";
export const SESSION_END_MS = Date.parse(SESSION_START_ISO) + SESSION_DURATION_MS;
export const DEVICE_TIME_ZONE = "America/Los_Angeles";
export const DEVICE_LOCALE = "en-US";

export type DevicePhase = "hero" | "poweredOff" | "booting" | "locked" | "passcode" | "springboard" | "app" | "sleeping" | "powerOffConfirm" | "shutdown" | "lowBatteryWarning";
export type WarningLevel = 20 | 10;
export type ShutdownReason = "battery" | "manual" | null;
export type Session = {
  sessionIdentity: SessionIdentity;
  experienceSessionId: string | null;
  passcode: string | null;
  passcodeAttempts: number;
  passcodeLockoutUntilElapsedMs: number | null;
  phase: DevicePhase;
  shutdownReason: ShutdownReason;
  returnToHeroPending: boolean;
  previousPhase: DevicePhase | null;
  activeWarning: WarningLevel | 1 | null;
  batteryCriticalPending: boolean;
  batteryCriticalRevealAtMs: number | null;
  sessionStartEpochMs: number | null;
  deviceEvents: DeviceEvent[];
  deliveredTimelineEventIds: string[];
  dismissedWarnings: WarningLevel[];
  badges: Record<string, number>;
};

export const initialSession: Session = {
  sessionIdentity: emptySessionIdentity,
  experienceSessionId: null,
  passcode: null,
  passcodeAttempts: 0,
  passcodeLockoutUntilElapsedMs: null,
  phase: "hero",
  shutdownReason: null,
  returnToHeroPending: false,
  previousPhase: null,
  activeWarning: null,
  batteryCriticalPending: false,
  batteryCriticalRevealAtMs: null,
  sessionStartEpochMs: null,
  deviceEvents: [],
  deliveredTimelineEventIds: [],
  dismissedWarnings: [],
  badges: { Facebook: 3, Twitter: 12, Instagram: 1, Foursquare: 1 },
};

export function createExperienceSessionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }
  throw new Error("Secure experience-session identity generation is unavailable.");
}

export function resolveExperienceSessionId(value: unknown, activeExperience: boolean) {
  if (typeof value === "string" && value.trim()) return value;
  return activeExperience ? createExperienceSessionId() : null;
}

export function homeButtonTransition(session: Session): Partial<Session> | null {
  switch (session.phase) {
    case "sleeping":
      return { phase: "locked" };
    case "app":
      return { phase: "springboard" };
    case "locked":
    case "passcode":
    case "springboard":
    case "booting":
    case "hero":
    case "poweredOff":
    case "powerOffConfirm":
    case "shutdown":
    case "lowBatteryWarning":
      return null;
  }
}

export function shortPowerTransition(session: Session): Partial<Session> | null {
  switch (session.phase) {
    case "locked":
    case "passcode":
    case "springboard":
    case "app":
      return { phase: "sleeping" };
    case "sleeping":
      return { phase: "locked" };
    default:
      return null;
  }
}

export function longPowerTransition(session: Session): Partial<Session> | null {
  switch (session.phase) {
    case "locked":
    case "passcode":
    case "springboard":
    case "app":
    case "sleeping":
    case "lowBatteryWarning":
      return { previousPhase: session.phase, phase: "powerOffConfirm" };
    default:
      return null;
  }
}

export function loadSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return initialSession;
    const parsed = JSON.parse(raw) as Partial<Session> & { userName?: string; unlockEpochMs?: number | null };
    const { userName: legacyUserName, unlockEpochMs: legacyUnlockEpochMs, ...persistedSession } = parsed;
    const migratesUnlockBasedClock = parsed.sessionStartEpochMs === undefined && legacyUnlockEpochMs !== undefined;
    const sessionPhase = migratesUnlockBasedClock && (parsed.sessionIdentity?.name || legacyUserName?.trim())
      ? "booting"
      : (parsed.phase ?? initialSession.phase);
    const sessionIdentity = parsed.sessionIdentity ?? { name: legacyUserName?.trim() ?? "" };
    const activeExperience = Boolean(sessionIdentity.name)
      && sessionPhase !== "hero"
      && sessionPhase !== "shutdown"
      && !parsed.returnToHeroPending;
    const experienceSessionId = resolveExperienceSessionId(parsed.experienceSessionId, activeExperience);
    const migratedExperienceSessionId = experienceSessionId !== null && parsed.experienceSessionId !== experienceSessionId;
    const migratedPasscode = activeExperience && typeof parsed.passcode !== "string" && experienceSessionId
      ? passcodeForExperienceSession(experienceSessionId)
      : parsed.passcode ?? null;
    const session: Session = {
      ...initialSession,
      ...persistedSession,
      sessionIdentity,
      experienceSessionId,
      passcode: migratedPasscode,
      sessionStartEpochMs: migratesUnlockBasedClock ? null : (parsed.sessionStartEpochMs ?? null),
      phase: sessionPhase,
    };
    if (session.phase === "lowBatteryWarning" && session.activeWarning === 1) {
      const safePhase = session.previousPhase === "locked" || session.previousPhase === "passcode" || session.previousPhase === "springboard" || session.previousPhase === "app" || session.previousPhase === "sleeping"
        ? session.previousPhase
        : "locked";
      const recoveredSession: Session = {
        ...session,
        phase: safePhase,
        previousPhase: null,
        activeWarning: null,
        batteryCriticalPending: true,
        batteryCriticalRevealAtMs: null,
      };
      if (migratedExperienceSessionId || migratedPasscode !== parsed.passcode) saveSession(recoveredSession);
      return recoveredSession;
    }
    if (migratedExperienceSessionId || migratedPasscode !== parsed.passcode) saveSession(session);
    return session;
  } catch { return initialSession; }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function elapsedMs(session: Session, now: number) {
  return session.sessionStartEpochMs ? Math.max(0, now - session.sessionStartEpochMs) : 0;
}

export function hasReachedSessionTerminal(session: Session, now: number) {
  return session.sessionStartEpochMs !== null
    && now - session.sessionStartEpochMs >= SESSION_DURATION_MS;
}

export function batteryPercent(elapsed: number) {
  const progress = Math.min(Math.max(elapsed, 0), SESSION_DURATION_MS) / SESSION_DURATION_MS;
  return 22 - progress * 21;
}

export function currentWarning(elapsed: number, dismissed: WarningLevel[]): WarningLevel | null {
  const battery = batteryPercent(elapsed);
  if (battery <= 10 && !dismissed.includes(10)) return 10;
  if (battery <= 20 && !dismissed.includes(20)) return 20;
  return null;
}

export function simulatedDeviceDateTime(elapsed: number) {
  const base = Date.parse(SESSION_START_ISO);
  return new Date(base + elapsed);
}

const deviceTimeFormatter = new Intl.DateTimeFormat(DEVICE_LOCALE, {
  timeZone: DEVICE_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDeviceTime(deviceDateTime: Date) {
  return deviceTimeFormatter.format(deviceDateTime);
}

export function formatLockScreenTime(deviceDateTime: Date) {
  return deviceTimeFormatter.formatToParts(deviceDateTime)
    .filter(part => part.type !== "dayPeriod")
    .map(part => part.value)
    .join("")
    .trim();
}

export function formatDeviceDate(deviceDateTime: Date) {
  return new Intl.DateTimeFormat(DEVICE_LOCALE, {
    timeZone: DEVICE_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(deviceDateTime);
}

export function simulatedClock(elapsed: number) {
  return formatDeviceTime(simulatedDeviceDateTime(elapsed));
}
