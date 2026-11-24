/**
 * Back to top: the button appears once the reader is about a screen down
 * and its ring fills with reading progress. One passive scroll listener,
 * at most one update per frame, compositor-friendly property changes.
 */
export function initBackToTop() {
  const button = document.querySelector("[data-back-to-top]");
  if (!button) return;
  button.hidden = false;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;

  const update = () => {
    frame = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const y = window.scrollY;
    button.toggleAttribute("data-visible", y > window.innerHeight * 0.8);
    button.style.setProperty("--progress", max > 0 ? Math.min(1, y / max).toFixed(4) : "0");
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  update();

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: reduced.matches ? "auto" : "smooth" });
    // Keyboard users land on the page start, not on a vanished button.
    document.getElementById("main")?.focus({ preventScroll: true });
  });
}
