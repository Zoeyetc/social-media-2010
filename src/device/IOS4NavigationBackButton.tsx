import { useId } from "react";

type IOS4NavigationBackButtonProps = {
  label: string;
  onClick: () => void;
  className?: string;
};

/** System-only iOS 4-era directional control. Exact 8B117 artwork remains HOLD. */
export function IOS4NavigationBackButton({ label, onClick, className }: IOS4NavigationBackButtonProps) {
  const gradientId = `ios4-navigation-back-${useId().replace(/:/g, "")}`;
  const bodyWidth = Math.max(48, Math.ceil(label.length * 7.3) + 17);
  const width = bodyWidth + 10;
  const rightEdge = width - 1;
  const rightShoulder = width - 6;
  const shape = `M10 1H${rightShoulder}Q${rightEdge} 1 ${rightEdge} 6V24Q${rightEdge} 29 ${rightShoulder} 29H10L1 15Z`;
  const highlight = `M2.8 15L10.7 2.7H${rightShoulder}Q${width - 2.7} 2.7 ${width - 2.7} 6`;

  return <button
    type="button"
    className={`ios4-navigation-back-button${className ? ` ${className}` : ""}`}
    style={{ width }}
    aria-label={label === "Back" ? "Back" : `Back to ${label}`}
    onClick={onClick}
  >
    <svg className="ios4-navigation-back-artwork" width={width} height="30" viewBox={`0 0 ${width} 30`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#849bb4" />
          <stop offset=".49" stopColor="#617c9b" />
          <stop offset=".52" stopColor="#3f6083" />
          <stop offset="1" stopColor="#4e6d8e" />
        </linearGradient>
      </defs>
      <path className="ios4-navigation-back-shape" d={shape} fill={`url(#${gradientId})`} stroke="#29425f" strokeWidth="1.2" strokeLinejoin="round" />
      <path className="ios4-navigation-back-highlight" d={highlight} fill="none" stroke="#fff" strokeWidth=".7" strokeLinecap="round" opacity=".4" />
    </svg>
    <span className="ios4-navigation-back-label">{label}</span>
  </button>;
}
