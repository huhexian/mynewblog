/**
 * A popover opened from a control that only one layout shows (the menu
 * panel, the TOC sheet) sits in the top layer, out of reach of the layout
 * that takes over when the window grows. Close it once its button is hidden.
 */
export function closeWithInvoker(popover, invoker) {
  const watch = new ResizeObserver(() => {
    if (popover.matches(":popover-open") && !invoker.checkVisibility()) popover.hidePopover();
  });
  popover.addEventListener("toggle", (event) => {
    if (event.newState === "open") watch.observe(invoker);
    else watch.disconnect();
  });
}
