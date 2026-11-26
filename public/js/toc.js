// ns-hugo-imp:/Users/huhexian/Desktop/mynewblog/themes/hugo-theme-icy/assets/js/modules/popover-layout.js
function closeWithInvoker(popover, invoker) {
  const watch = new ResizeObserver(() => {
    if (popover.matches(":popover-open") && !invoker.checkVisibility()) popover.hidePopover();
  });
  popover.addEventListener("toggle", (event) => {
    if (event.newState === "open") watch.observe(invoker);
    else watch.disconnect();
  });
}

// ns-hugo-imp:/Users/huhexian/Desktop/mynewblog/themes/hugo-theme-icy/assets/js/modules/toc.js
var READING_LINE = 0.25;
function initToc() {
  const tocs = [...document.querySelectorAll("[data-toc]")];
  if (!tocs.length) return;
  const links = /* @__PURE__ */ new Map();
  for (const toc of tocs) {
    for (const a of toc.querySelectorAll('a[href^="#"]')) {
      const id = decodeURIComponent(a.hash.slice(1));
      if (!links.has(id)) links.set(id, []);
      links.get(id).push(a);
    }
  }
  const headings = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  if (!headings.length) return;
  const rail = document.querySelector(".toc-rail");
  let currentId = null;
  const setCurrent = (id) => {
    if (id === currentId) return;
    for (const a of links.get(currentId) ?? []) a.removeAttribute("aria-current");
    for (const a of links.get(id) ?? []) a.setAttribute("aria-current", "location");
    currentId = id;
    keepVisibleInRail(id);
  };
  const keepVisibleInRail = (id) => {
    if (!rail || rail.scrollHeight <= rail.clientHeight) return;
    const link = (links.get(id) ?? []).find((a) => rail.contains(a));
    if (!link) return;
    const r = rail.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    if (l.top < r.top || l.bottom > r.bottom) {
      rail.scrollTop += l.top - r.top - r.height / 3;
    }
  };
  const recompute = () => {
    const line = window.innerHeight * READING_LINE;
    let active = null;
    for (const h of headings) {
      if (h.getBoundingClientRect().top <= line) active = h;
      else break;
    }
    setCurrent(active?.id ?? null);
  };
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      recompute();
    });
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  recompute();
  const sheet = document.getElementById("toc-sheet");
  const fab = document.querySelector(".toc-fab");
  if (sheet && fab) closeWithInvoker(sheet, fab);
  sheet?.addEventListener("click", (event) => {
    if (event.target.closest("a")) sheet.hidePopover();
  });
  sheet?.addEventListener("toggle", (event) => {
    if (event.newState !== "open") return;
    const scroller = sheet.querySelector(".toc-sheet-scroll") ?? sheet;
    const link = (links.get(currentId) ?? []).find((a) => sheet.contains(a));
    if (!link) return;
    const s = scroller.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    scroller.scrollTop += l.top - s.top - s.height / 2 + l.height / 2;
  });
}

// <stdin>
initToc();
//# sourceMappingURL=toc.js.map
