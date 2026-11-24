/**
 * Image viewer on a native <dialog>.
 *
 * Every `a[data-viewer]` on the page (Markdown images, figures, gallery tiles,
 * Live Photo stills) joins one sequence in document order. Without JS those
 * links just open the full image. The dialog provides the top layer, Escape
 * to close and focus restoration; this module adds navigation (buttons,
 * arrow keys, Home/End, swipe), neighbour preloading and backdrop dismissal.
 *
 * A still with `data-live-video` (a Live Photo with zoom on) is shown as a Live
 * Photo: the dialog's own `[data-viewer-live]` element gets the still and the
 * clip, and live-photo.js plays it (hover, press and hold, LIVE button).
 */
import { claim } from "./content-ready.js";

// Same name as STOP_EVENT in live-photo.js, which this bundle doesn't import.
const LIVE_STOP = "icy:live-photo-stop";

/** Snapshot of every viewer link in document order, taken when the viewer opens. */
function collectItems() {
  return [...document.querySelectorAll("a[data-viewer]")].map((link) => {
    const figure = link.closest("figure");
    return {
      link,
      href: link.href,
      alt: link.querySelector("img")?.alt ?? "",
      caption: figure?.querySelector(":scope > figcaption")?.textContent.trim() ?? "",
      width: Number(link.dataset.width) || 0,
      height: Number(link.dataset.height) || 0,
      video: link.dataset.liveVideo ?? "",
    };
  });
}

export function initViewer() {
  // One delegated listener per page, so links added later (unlocked protected
  // content) join the sequence without re-initialising.
  const [dialog] = claim(document, "[data-viewer-dialog]", "viewer");
  if (!dialog) return;

  const image = dialog.querySelector(".viewer-image");
  const caption = dialog.querySelector(".viewer-caption");
  const counter = dialog.querySelector(".viewer-counter");
  const live = dialog.querySelector("[data-viewer-live]");
  const liveFrame = live?.querySelector(".live-photo-frame");
  const liveStill = live?.querySelector(".live-photo-still img");
  const liveVideo = live?.querySelector(".live-photo-video");

  const stopLive = () => live?.dispatchEvent(new CustomEvent(LIVE_STOP));

  // The Live Photo frame is sized in CSS from the still's proportions.
  const setLiveSize = (width, height) => {
    if (!width || !height) return;
    live.style.setProperty("--ratio", String(width / height));
    live.style.setProperty("--natural-width", `${width}px`);
  };
  liveStill?.addEventListener("load", () => setLiveSize(liveStill.naturalWidth, liveStill.naturalHeight));

  let items = [];
  let index = 0;

  const preload = (i) => {
    const item = items[(i + items.length) % items.length];
    if (item && !item.preloaded) {
      new Image().src = item.href;
      item.preloaded = true;
    }
  };

  const show = (i) => {
    index = (i + items.length) % items.length;
    const item = items[index];
    const isLive = Boolean(item.video && live);
    stopLive();
    image.hidden = isLive;
    if (live) live.hidden = !isLive;
    if (isLive) {
      live.style.removeProperty("--ratio");
      live.style.removeProperty("--natural-width");
      setLiveSize(item.width, item.height);
      liveStill.src = item.href;
      liveStill.alt = item.alt;
      if (liveStill.complete) setLiveSize(liveStill.naturalWidth, liveStill.naturalHeight);
      if (liveVideo.getAttribute("src") !== item.video) liveVideo.src = item.video;
    } else {
      if (item.width && item.height) {
        image.width = item.width;
        image.height = item.height;
      } else {
        image.removeAttribute("width");
        image.removeAttribute("height");
      }
      image.src = item.href;
      image.alt = item.alt;
    }
    caption.textContent = item.caption;
    caption.hidden = !item.caption;
    counter.textContent = `${index + 1} / ${items.length}`;
    if (items.length > 1) {
      preload(index + 1);
      preload(index - 1);
    }
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[data-viewer]");
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    // The photo on the page stops; the viewer's copy takes over.
    link.closest("[data-live-photo]")?.dispatchEvent(new CustomEvent(LIVE_STOP));
    items = collectItems();
    dialog.toggleAttribute("data-single", items.length < 2);
    show(Math.max(0, items.findIndex((item) => item.link === link)));
    dialog.showModal();
  });

  dialog.querySelector("[data-viewer-prev]")?.addEventListener("click", () => show(index - 1));
  dialog.querySelector("[data-viewer-next]")?.addEventListener("click", () => show(index + 1));

  dialog.addEventListener("keydown", (event) => {
    const actions = {
      ArrowLeft: () => show(index - 1),
      ArrowRight: () => show(index + 1),
      Home: () => show(0),
      End: () => show(items.length - 1),
    };
    const action = actions[event.key];
    if (action && items.length > 1) {
      event.preventDefault();
      action();
    }
  });

  // Backdrop / empty-stage click closes (fallback for closedby="any").
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target === live || event.target.classList.contains("viewer-stage")) dialog.close();
  });

  dialog.addEventListener("close", stopLive);

  // Swipe (touch / pen) to navigate. On a Live Photo, moving the finger
  // cancels the press and hold, so a swipe never starts the clip.
  let startX = null;
  for (const surface of [image, liveFrame].filter(Boolean)) {
    surface.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" && event.isPrimary) startX = event.clientX;
    });
    surface.addEventListener("pointerup", (event) => {
      if (startX === null) return;
      const dx = event.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 48 && items.length > 1) show(index + (dx < 0 ? 1 : -1));
    });
    surface.addEventListener("pointercancel", () => { startX = null; });
  }
}
