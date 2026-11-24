/**
 * Pele diagrams: mount every ```pele code block. The vendored library
 * (window.pele, ~680 KB) is loaded only when the first diagram comes within
 * a screen of the viewport; each diagram is drawn as it gets near. The
 * diagram source stays in the page as the fallback: without JavaScript, when
 * the library fails to load, when a diagram has a syntax error, and in print
 * before a diagram has been drawn, the source is shown as code.
 */
import { claim } from "./content-ready.js";
import { loadVendor } from "./vendor.js";

const MARGIN = "100% 0px";

let observer;

async function render(figure) {
  const source = figure.querySelector(":scope > pre.pele-source");
  try {
    await loadVendor("pele");
  } catch {
    figure.classList.add("is-source");
    return;
  }
  if (!globalThis.pele?.mount) {
    figure.classList.add("is-source");
    return;
  }
  const container = document.createElement("div");
  container.className = "pele-diagram";
  source.after(container);
  try {
    globalThis.pele.mount(container, source.textContent, {
      fontSize: Number.parseFloat(getComputedStyle(container).fontSize) || 15,
      config: { flowchart: { nodeSpacing: 28, rankSpacing: 40 } },
      links: false,
      images: false,
      zoom: {
        labels: {
          zoomIn: figure.dataset.labelZoomIn,
          zoomOut: figure.dataset.labelZoomOut,
          reset: figure.dataset.labelReset,
        },
      },
    });
    figure.classList.add("is-mounted");
  } catch (error) {
    container.remove();
    figure.classList.add("is-source");
    console.warn("[icy] Pele diagram could not be rendered:", error);
  }
}

export function initPele(root = document) {
  const sources = claim(root, ".pele-figure > pre.pele-source", "pele");
  if (!sources.length) return;

  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        render(entry.target);
      }
    },
    { rootMargin: MARGIN },
  );
  for (const source of sources) observer.observe(source.closest(".pele-figure"));
}
