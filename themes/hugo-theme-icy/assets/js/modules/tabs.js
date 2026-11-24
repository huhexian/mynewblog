/**
 * Tabs (WAI-ARIA tabs pattern, manual activation by click / automatic by
 * arrow keys). Markup comes fully rendered from the build; this only switches
 * panels. Panels hidden with hidden="until-found" that find-in-page reveals
 * fire `beforematch`, which selects their tab.
 */
import { claim } from "./content-ready.js";

export function initTabs(scope = document) {
  for (const root of claim(scope, "[data-tabs]", "tabs")) setup(root);
}

function setup(root) {
  const tabs = [...root.querySelectorAll(':scope > .tabs-list > [role="tab"]')];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
  if (!tabs.length || panels.some((p) => !p)) return;

  const select = (index, { focus = false } = {}) => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      if (on) panels[i].removeAttribute("hidden");
      else panels[i].setAttribute("hidden", "until-found");
    });
    if (focus) tabs[index].focus();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(i));
    tab.addEventListener("keydown", (event) => {
      const last = tabs.length - 1;
      const next = {
        ArrowRight: i === last ? 0 : i + 1,
        ArrowLeft: i === 0 ? last : i - 1,
        Home: 0,
        End: last,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(next, { focus: true });
    });
  });

  panels.forEach((panel, i) => {
    panel.addEventListener("beforematch", () => select(i));
  });

  root.classList.add("is-enhanced");
}
