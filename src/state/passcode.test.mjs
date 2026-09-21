import assert from "node:assert/strict";
import { formatPasscode, passcodeForExperienceSession, evaluatePasscodeAttempt, PASSCODE_LOCKOUT_MS } from "./passcode.ts";

assert.equal(formatPasscode(47), "0047");
assert.equal(formatPasscode(812), "0812");
assert.equal(formatPasscode(4817), "4817");
const first = passcodeForExperienceSession("session-a"), again = passcodeForExperienceSession("session-a"), second = passcodeForExperienceSession("session-b");
assert.equal(first, again, "one code must remain stable for one experienceSessionId");
assert.match(first, /^\d{4}$/); assert.match(second, /^\d{4}$/);
assert.notEqual(first, "0000"); assert.notEqual(first, "1111"); assert.notEqual(first, "1234");
let state = { attempts: 0, lockoutUntilElapsedMs: null };
for (let attempt = 1; attempt <= 4; attempt++) { state = evaluatePasscodeAttempt(state, "4817", "0001", 100); assert.equal(state.attempts, attempt); assert.equal(state.lockoutUntilElapsedMs, null); }
state = evaluatePasscodeAttempt(state, "4817", "0001", 100);
assert.equal(state.attempts, 5); assert.equal(state.lockoutUntilElapsedMs, 100 + PASSCODE_LOCKOUT_MS);
assert.equal(evaluatePasscodeAttempt(state, "4817", "4817", 101).locked, true, "sleep/wake does not alter elapsed lockout");
assert.equal(evaluatePasscodeAttempt(state, "4817", "4817", 100 + PASSCODE_LOCKOUT_MS).accepted, true);
assert.deepEqual(evaluatePasscodeAttempt({ attempts: 2, lockoutUntilElapsedMs: null }, "4817", "4817", 500), { attempts: 0, lockoutUntilElapsedMs: null, accepted: true, locked: false });
console.log("PASS: session-stable 4-digit passcode, five-attempt EXPERIENCE RULE lockout, canonical elapsed-time expiry, and resettable access state.");
