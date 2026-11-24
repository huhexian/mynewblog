/**
 * Menu panel: closing it returns focus to the menu button. WebKit shows a
 * focus ring there even when the panel was closed with a tap or a click;
 * after pointer input the ring is dropped, after keyboard input (Esc, Enter)
 * it stays. The panel itself needs no script.
 */
export function initMenu() {
  const nav = document.getElementById("site-nav");
  const toggle = document.querySelector(".menu-toggle");
  if (!nav || !toggle) return;

  let pointer = false;
  document.addEventListener("pointerdown", () => { pointer = true; }, { capture: true, passive: true });
  document.addEventListener("keydown", () => { pointer = false; }, { capture: true });

  nav.addEventListener("toggle", (event) => {
    if (event.newState === "closed" && pointer && toggle.matches(":focus-visible")) {
      toggle.blur();
    }
  });
}
