// Physical-scale approximation for the 115.2 mm tall iPhone 4 chassis.
// This is a viewport projection, not a claim of CSS millimeter accuracy.
export const MOBILE_INSPECT_SCALE = 1.2;
export const DESKTOP_INSPECT_SCALE = 1.04;
export function inspectScale(narrow: boolean) {
  return narrow ? MOBILE_INSPECT_SCALE : DESKTOP_INSPECT_SCALE;
}
