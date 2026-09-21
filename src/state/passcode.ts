const DISALLOWED = new Set([0, 1111, 1234]);

export function formatPasscode(value: number): string {
  return Math.max(0, Math.min(9999, Math.floor(value))).toString().padStart(4, "0");
}

// Session IDs are already cryptographically random. A stable derivation keeps
// this experience-layer code fixed without a second persistence channel.
export function passcodeForExperienceSession(experienceSessionId: string): string {
  let hash = 2166136261;
  for (const character of experienceSessionId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  let value = (hash >>> 0) % 10000;
  while (DISALLOWED.has(value)) value = (value + 137) % 10000;
  return formatPasscode(value);
}

export const PASSCODE_LOCKOUT_ATTEMPTS = 5;
export const PASSCODE_LOCKOUT_MS = 60_000; // EXPERIENCE RULE, not a historical threshold claim.

export type PasscodeAccessState = Readonly<{ attempts: number; lockoutUntilElapsedMs: number | null }>;

export function evaluatePasscodeAttempt(state: PasscodeAccessState, expected: string, candidate: string, elapsedMs: number) {
  if (state.lockoutUntilElapsedMs !== null && elapsedMs < state.lockoutUntilElapsedMs) return { ...state, accepted: false, locked: true };
  if (candidate === expected) return { attempts: 0, lockoutUntilElapsedMs: null, accepted: true, locked: false };
  const attempts = state.attempts + 1;
  return {
    attempts,
    lockoutUntilElapsedMs: attempts >= PASSCODE_LOCKOUT_ATTEMPTS ? elapsedMs + PASSCODE_LOCKOUT_MS : state.lockoutUntilElapsedMs,
    accepted: false,
    locked: attempts >= PASSCODE_LOCKOUT_ATTEMPTS,
  };
}
