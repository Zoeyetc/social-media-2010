// The physical hit targets are meshes on this surface, so Safari's native
// touch/callout events must be cancelled at their shared DOM ancestor.
export function installHeroInspectLongPressSuppression(surface: HTMLElement): () => void {
  const suppress = (event: Event) => {
    if (event.type === "pointerdown" && (event as PointerEvent).pointerType !== "touch") return;
    if (event.cancelable) event.preventDefault();
  };
  const events = ["pointerdown", "touchstart", "contextmenu", "selectstart", "dragstart"];
  for (const type of events) surface.addEventListener(type, suppress, { capture: true, passive: false });
  return () => {
    for (const type of events) surface.removeEventListener(type, suppress, { capture: true });
  };
}
