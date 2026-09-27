// Canonical normalized iPhone 4 chassis: 2.82 scene units tall. Width and
// thickness follow its 115.2 × 58.6 × 9.3 mm proportions.
const PHONE_HEIGHT = 2.82;
const PHONE_WIDTH = PHONE_HEIGHT * 58.6 / 115.2;
const PHONE_DEPTH = PHONE_HEIGHT * 9.3 / 115.2;

export const DESKTOP_INSPECT_SCALE = 1.04;
export const DESKTOP_SOFTWARE_SCALE = 1.18 * 1.30;

export type MobileFitViewport = Readonly<{
  width: number;
  height: number;
  fovDegrees: number;
  cameraDistance: number;
}>;

/** Fit the entire chassis in the measured Canvas area, allowing for the
 * closest face and a small physical margin. Rotation needs more clearance. */
export function mobilePhoneScale(viewport: MobileFitViewport, mode: "inspect" | "software"): number {
  const { width, height, fovDegrees, cameraDistance } = viewport;
  if (![width, height, fovDegrees, cameraDistance].every(Number.isFinite)
    || width <= 0 || height <= 0 || fovDegrees <= 0 || fovDegrees >= 180
    || cameraDistance <= PHONE_HEIGHT / 2 + PHONE_DEPTH) return 0;

  const focalPixels = height / (2 * Math.tan(fovDegrees * Math.PI / 360));
  const closestDepth = mode === "inspect" ? PHONE_HEIGHT / 2 + PHONE_DEPTH / 2 : PHONE_DEPTH / 2;
  const margin = mode === "inspect" ? 18 : 10;
  const safeWidth = Math.max(0, width - 2 * margin);
  const safeHeight = Math.max(0, height - 2 * margin);
  const projectedWidth = mode === "inspect" ? Math.hypot(PHONE_WIDTH, PHONE_DEPTH) : PHONE_WIDTH;
  // The near face approaches the camera as the whole phone scales. Solve the
  // perspective inequality directly rather than treating near depth as fixed.
  const fit = Math.min(
    safeWidth * cameraDistance / (focalPixels * projectedWidth + safeWidth * closestDepth),
    safeHeight * cameraDistance / (focalPixels * PHONE_HEIGHT + safeHeight * closestDepth),
  );
  return Math.max(0, Math.min(fit, 3));
}

export function inspectScale(narrow: boolean, viewport?: MobileFitViewport) {
  return narrow && viewport ? mobilePhoneScale(viewport, "inspect") : DESKTOP_INSPECT_SCALE;
}
