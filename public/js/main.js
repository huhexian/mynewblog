// ns-hugo-imp:/Users/huhexian/Desktop/mynewblog/themes/hugo-theme-icy/assets/js/modules/color-scheme.js
var STORAGE_KEY = "color-scheme";
var SYSTEM = "light dark";
var systemDark = window.matchMedia("(prefers-color-scheme: dark)");
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
  }
}
function initColorScheme() {
  const meta = document.querySelector('meta[name="color-scheme"]');
  const button = document.querySelector("[data-theme-toggle]");
  const choices = [...document.querySelectorAll("[data-scheme-set]")];
  if (!meta || !button && !choices.length) return;
  const apply = (value) => {
    meta.content = value ?? SYSTEM;
    if (value) document.documentElement.dataset.colorScheme = value;
    else delete document.documentElement.dataset.colorScheme;
  };
  const rendered = () => {
    const override = meta.content.trim();
    if (override === "light" || override === "dark") return override;
    return systemDark.matches ? "dark" : "light";
  };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const FADE_MS = 450;
  const FADE_MS_REDUCED = 250;
  let fadeTimer = 0;
  const fade = (value) => {
    const root = document.documentElement;
    window.clearTimeout(fadeTimer);
    root.classList.add("is-theme-fading");
    apply(value);
    fadeTimer = window.setTimeout(
      () => root.classList.remove("is-theme-fading"),
      (reducedMotion.matches ? FADE_MS_REDUCED : FADE_MS) + 50
    );
  };
  const REVEAL_MS = 650;
  const reveal = (value) => {
    const root = document.documentElement;
    const box = button.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add("is-theme-revealing");
    const transition = document.startViewTransition(() => apply(value));
    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: REVEAL_MS, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {
    });
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
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      apply(readStored());
      markChoices();
    }
  });
  if (button) button.hidden = false;
}

// ns-hugo-imp:/Users/huhexian/Desktop/mynewblog/themes/hugo-theme-icy/assets/js/modules/media-loaded.js
var mark = (img) => {
  if (img.complete && img.naturalWidth) img.closest(".media-frame")?.setAttribute("data-loaded", "");
};
function initMediaLoaded() {
  document.addEventListener("load", (event) => {
    if (event.target instanceof HTMLImageElement) mark(event.target);
  }, true);
  for (const img of document.querySelectorAll(".media-frame img")) mark(img);
}

// ns-hugo-imp:/Users/huhexian/Desktop/mynewblog/themes/hugo-theme-icy/assets/js/modules/back-to-top.js
function initBackToTop() {
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
    document.getElementById("main")?.focus({ preventScroll: true });
  });
}

// ns-hugo-imp:/Users/huhexian/Desktop/mynewblog/themes/hugo-theme-icy/assets/js/modules/menu.js
function initMenu() {
  const nav = document.getElementById("site-nav");
  const toggle = document.querySelector(".menu-toggle");
  if (!nav || !toggle) return;
  let pointer = false;
  document.addEventListener("pointerdown", () => {
    pointer = true;
  }, { capture: true, passive: true });
  document.addEventListener("keydown", () => {
    pointer = false;
  }, { capture: true });
  nav.addEventListener("toggle", (event) => {
    if (event.newState === "closed" && pointer && toggle.matches(":focus-visible")) {
      toggle.blur();
    }
  });
}

// <stdin>
initColorScheme();
initMediaLoaded();
initBackToTop();
initMenu();
//# sourceMappingURL=main.js.map
