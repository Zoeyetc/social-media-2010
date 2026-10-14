import { useEffect, useState } from "react";

export function PasscodeScreen({ lockedUntilElapsedMs, elapsedMs, failedAttempts, onCancel, onAttempt, inactive = false }: {
  inactive?: boolean;
  lockedUntilElapsedMs: number | null;
  elapsedMs: number;
  failedAttempts: number;
  onCancel: () => void;
  onAttempt: (code: string) => void;
}) {
  const [digits, setDigits] = useState("");
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const locked = lockedUntilElapsedMs !== null && elapsedMs < lockedUntilElapsedMs;
  const remaining = lockedUntilElapsedMs === null ? 0 : Math.max(0, lockedUntilElapsedMs - elapsedMs);
  useEffect(() => { if (locked) setDigits(""); }, [locked]);
  // RECONSTRUCTED neutral feedback duration, separate from canonical lockout time.
  useEffect(() => {
    if (!failedAttempts || locked) { setFeedbackVisible(false); return; }
    setFeedbackVisible(true);
    const timer = window.setTimeout(() => setFeedbackVisible(false), 1200);
    return () => window.clearTimeout(timer);
  }, [failedAttempts]);
  const add = (digit: string) => {
    if (inactive || locked || digits.length === 4) return;
    const next = digits + digit;
    if (next.length === 4) { setDigits(""); onAttempt(next); }
    else setDigits(next);
  };
  return <section className="passcode-screen" inert={inactive} data-passcode-locked={locked || undefined} aria-label="Passcode Lock" data-visual-status="RECONSTRUCTED">
    <header className="passcode-title-band"><h1 className="passcode-title">Enter Passcode</h1></header>
    <div className="passcode-keypad-panel">
    <div className="passcode-cell-row">
    <div className="passcode-cells" aria-label={`${digits.length} of 4 digits entered`}>{[0, 1, 2, 3].map(index => <span key={index} aria-hidden="true">{index < digits.length ? "•" : ""}</span>)}</div>
    </div>
    <p className="passcode-feedback" role="status" data-visual-status="RECONSTRUCTED">{locked ? `Try again in ${Math.ceil(remaining / 1000)} seconds` : feedbackVisible ? "Incorrect Passcode" : ""}</p>
    <div className="passcode-keypad">{["", "ABC", "DEF", "GHI", "JKL", "MNO", "PQRS", "TUV", "WXYZ"].map((letters, index) => <button type="button" key={index + 1} aria-label={String(index + 1)} disabled={inactive || locked} onClick={() => add(String(index + 1))}><span className="passcode-digit">{index + 1}</span><small>{letters || "\u00a0"}</small></button>)}<button type="button" className="passcode-keypad-action" aria-disabled="true" disabled={inactive}>{"Emergency\nCall"}</button><button type="button" aria-label="0" disabled={inactive || locked} onClick={() => add("0")}><span className="passcode-digit">0</span></button><button type="button" className="passcode-keypad-action" disabled={inactive} onClick={() => { if (!inactive) onCancel(); }}>Cancel</button></div>
    </div>
  </section>;
}
