/** Keeps the 3D stage at its pre-focus size while Safari's software keyboard
 * changes the visual viewport. DeviceScreen and its keyboard remain untouched. */
export function installHeroKeyboardViewportLock(stage: HTMLElement): () => void {
  const isSoftwareEditor = (node: Element | null): node is HTMLInputElement | HTMLTextAreaElement =>
    node instanceof HTMLElement && Boolean(node.closest(".hero-screen-portal"))
    && (node instanceof HTMLTextAreaElement
      || node instanceof HTMLInputElement && ["text", "search", "email", "password"].includes(node.type));

  let lockedWidth = 0;
  let releaseFrame = 0;
  let resizeFrame = 0;
  let removalObserver: MutationObserver | null = null;
  const narrow = () => window.innerWidth < 760;
  const unlock = () => {
    removalObserver?.disconnect();
    removalObserver = null;
    stage.style.removeProperty("height");
    stage.removeAttribute("data-keyboard-viewport-locked");
    lockedWidth = 0;
  };
  const lock = () => {
    if (!narrow() || lockedWidth) return;
    const height = stage.getBoundingClientRect().height;
    if (height <= 0) return;
    lockedWidth = window.innerWidth;
    stage.style.height = `${height}px`;
    stage.setAttribute("data-keyboard-viewport-locked", "true");
    // Removing a focused editor during app navigation need not dispatch blur.
    removalObserver = new MutationObserver(() => {
      if (!isSoftwareEditor(document.activeElement)) unlock();
    });
    removalObserver.observe(stage, { childList: true, subtree: true });
  };
  const onFocusIn = (event: FocusEvent) => {
    if (!isSoftwareEditor(event.target as Element)) return;
    cancelAnimationFrame(releaseFrame);
    lock(); // focusin runs before the native keyboard's viewport resize
  };
  const onFocusOut = () => {
    cancelAnimationFrame(releaseFrame);
    releaseFrame = requestAnimationFrame(() => {
      if (!isSoftwareEditor(document.activeElement)) unlock();
    });
  };
  const onResize = () => {
    if (!lockedWidth || Math.abs(window.innerWidth - lockedWidth) < 2) return;
    // A width/orientation change is a genuine new viewport. Refit and capture
    // the new basis if an editor still owns focus.
    unlock();
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (isSoftwareEditor(document.activeElement)) lock();
    });
  };
  stage.addEventListener("focusin", onFocusIn);
  stage.addEventListener("focusout", onFocusOut);
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  return () => {
    stage.removeEventListener("focusin", onFocusIn);
    stage.removeEventListener("focusout", onFocusOut);
    window.removeEventListener("resize", onResize);
    window.visualViewport?.removeEventListener("resize", onResize);
    cancelAnimationFrame(releaseFrame);
    cancelAnimationFrame(resizeFrame);
    unlock();
  };
}
