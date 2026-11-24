/**
 * Two-state color scheme override (modern-web-guidance: ui-components/dark-mode-toggle).
 *
 * Data model (localStorage "color-scheme"):
 *   no value -> follow the system ("light dark")
 *   "light"  -> pinned light
 *   "dark"   -> pinned dark
 *
 * The toggle switches to the opposite of the rendered scheme. If that target
 * equals the system preference, the stored value is removed (back to "system")
 * instead of being pinned invisibly. The scheme is written to
 * <html data-color-scheme> (and the meta, for the browser UI); CSS sets
 * color-scheme from the attribute, so colors update through light-dark().
 *
 * The switch is animated. Where same-document view transitions exist, the
 * new scheme spreads from the toggle's corner as a growing circle over the
 * old one (reveal()). Otherwise — or with reduced motion — all page colors
 * cross over together (a temporary .is-theme-fading class enables short color
 * transitions everywhere) while the toggle's sun turns into a moon; with
 * reduced motion the fade is shorter and the glyph eases without overshoot.
 */
const STORAGE_KEY = "color-scheme";
const SYSTEM = "light dark";

const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function writeStored(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, value);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the override still applies for this page view.
  }
}

export function initColorScheme() {
  const meta = document.querySelector('meta[name="color-scheme"]');
  const button = document.querySelector("[data-theme-toggle]");
  // The menu panel's three-way choice (light / dark / follow the system).
  const choices = [...document.querySelectorAll("[data-scheme-set]")];
  if (!meta || (!button && !choices.length)) return;

  const apply = (value) => {
    meta.content = value ?? SYSTEM;
    if (value) document.documentElement.dataset.colorScheme = value;
    else delete document.documentElement.dataset.colorScheme;
  };

  // Rendered scheme = the active override (from the meta, which also covers
  // blocked storage) or the system preference.
  const rendered = () => {
    const override = meta.content.trim();
    if (override === "light" || override === "dark") return override;
    return systemDark.matches ? "dark" : "light";
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // A color cross-fade is not motion, so it stays (shorter) with reduced motion.
  const FADE_MS = 450;
  const FADE_MS_REDUCED = 250;
  let fadeTimer = 0;

  // Every color glides to the new scheme together (a class switches on short
  // color transitions for the whole page), while the toggle's glyph morphs
  // between sun and moon with its own transitions.
  const fade = (value) => {
    const root = document.documentElement;
    window.clearTimeout(fadeTimer);
    root.classList.add("is-theme-fading");
    apply(value);
    fadeTimer = window.setTimeout(
      () => root.classList.remove("is-theme-fading"),
      (reducedMotion.matches ? FADE_MS_REDUCED : FADE_MS) + 50,
    );
  };

  // The new scheme spreads from the toggle's corner as a growing circle over
  // the old one (a same-document view transition). Falls back to the fade
  // where view transitions are missing or motion is reduced.
  const REVEAL_MS = 650;
  const reveal = (value) => {
    const root = document.documentElement;
    const box = button.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    // The whole page, header included, is one snapshot during the reveal.
    root.classList.add("is-theme-revealing");
    const transition = document.startViewTransition(() => apply(value));
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: REVEAL_MS, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
    transition.finished.finally(() => root.classList.remove("is-theme-revealing"));
  };

  button?.addEventListener("click", () => {
    const system = systemDark.matches ? "dark" : "light";
    const target = rendered() === "dark" ? "light" : "dark";
    const value = target === system ? null : target;
    writeStored(value);
    if (document.startViewTransition && !reducedMotion.matches) reveal(value);
    else fade(value);
    markChoices();
  });

  // The choice buttons show the stored state: an override, or "system".
  const markChoices = () => {
    const current = readStored() ?? "system";
    for (const choice of choices) choice.setAttribute("aria-pressed", String(choice.dataset.schemeSet === current));
  };
  for (const choice of choices) {
    choice.addEventListener("click", () => {
      const value = choice.dataset.schemeSet === "system" ? null : choice.dataset.schemeSet;
      writeStored(value);
      fade(value);
      markChoices();
    });
  }
  markChoices();

  // Keep tabs in sync.
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      apply(readStored());
      markChoices();
    }
  });

  if (button) button.hidden = false;
}
