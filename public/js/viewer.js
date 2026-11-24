// ns-hugo-imp:/Users/huhexian/Desktop/mynewblog/themes/hugo-theme-icy/assets/js/modules/content-ready.js
function claim(root, selector, key) {
  const found = [...root.querySelectorAll(selector)];
  if (root instanceof Element && root.matches(selector)) found.unshift(root);
  return found.filter((el) => {
    const marks = (el.dataset.enhanced ?? "").split(" ");
    if (marks.includes(key)) return false;
    el.dataset.enhanced = [...marks.filter(Boolean), key].join(" ");
    return true;
  });
}

// ns-hugo-imp:/Users/huhexian/Desktop/mynewblog/themes/hugo-theme-icy/assets/js/modules/viewer.js
var LIVE_STOP = "icy:live-photo-stop";
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
      video: link.dataset.liveVideo ?? ""
    };
  });
}
function initViewer() {
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
      End: () => show(items.length - 1)
    };
    const action = actions[event.key];
    if (action && items.length > 1) {
      event.preventDefault();
      action();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target === live || event.target.classList.contains("viewer-stage")) dialog.close();
  });
  dialog.addEventListener("close", stopLive);
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
    surface.addEventListener("pointercancel", () => {
      startX = null;
    });
  }
}

// <stdin>
initViewer();
//# sourceMappingURL=viewer.js.map
