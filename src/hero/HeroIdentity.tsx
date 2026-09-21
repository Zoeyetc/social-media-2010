import { FormEvent, useState } from "react";

type HeroIdentityProps = Readonly<{
  active: boolean;
  name: string;
  passcode: string | null;
  onNameChange: (name: string) => void;
  onRevealCode: (name: string) => void;
  onConfirm: () => void;
}>;

export function HeroIdentity({ active, name, passcode, onNameChange, onRevealCode, onConfirm }: HeroIdentityProps) {
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!active) return;
    if (!name.trim()) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (passcode) {
      onConfirm();
      return;
    }
    onRevealCode(name.trim());
  };

  return (
    <section className="hero-identity hero-note-copy" aria-hidden={!active} data-note-status="RECONSTRUCTED EXPERIENCE-LAYER OBJECT">
      <form onSubmit={submit}>
        <label htmlFor="hero-name">NAME</label>
        <input
          id="hero-name"
          value={name}
          onChange={(event) => {
            onNameChange(event.target.value);
            if (invalid) setInvalid(false);
          }}
          autoFocus={!passcode}
          autoComplete="name"
          readOnly={Boolean(passcode)}
          disabled={!active}
          aria-invalid={invalid}
          aria-describedby={invalid ? "hero-name-error" : undefined}
          tabIndex={active ? 0 : -1}
        />
        <label className="hero-code-label">CODE</label>
        <output className="hero-code" aria-live="polite">{passcode ?? ""}</output>
        <span className="hero-note-reminder">don't lose this.</span>
        {passcode && <button type="submit" className="hero-note-continue" disabled={!active}>enter →</button>}
        <span id="hero-name-error" className="hero-name-error" role="alert">
          {invalid ? "Enter a name to continue." : ""}
        </span>
      </form>
    </section>
  );
}
