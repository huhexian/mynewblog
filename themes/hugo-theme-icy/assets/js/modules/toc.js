/**
 * Table of contents: mark the current section in every [data-toc] list and
 * close the bottom sheet after a jump. Both TOC presentations already work
 * without this script.
 *
 * The current section is the last heading whose top has passed a reading
 * line ~25% down the viewport. Recomputed at most once per animation frame
 * while scrolling (passive listener + rAF): the work is a handful of layout
 * reads with no writes in between, and it stays correct across long jumps
 * (anchor links, Home/End) where intersection notifications can be skipped.
 */
const READING_LINE = 0.25;

export function initToc() {
  const tocs = [...document.querySelectorAll("[data-toc]")];
  if (!tocs.length) return;

  const links = new Map(); // id -> [a, a]
  for (const toc of tocs) {
    for (const a of toc.querySelectorAll('a[href^="#"]')) {
      const id = decodeURIComponent(a.hash.slice(1));
      if (!links.has(id)) links.set(id, []);
      links.get(id).push(a);
    }
  }

  const headings = [...links.keys()]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
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

  // Scroll the rail itself (never the page) so the current item stays visible.
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
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; recompute(); });
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  recompute();

  // Close the sheet after choosing a section; on opening, bring the current
  // section into view inside the sheet (never scrolling the page).
  const sheet = document.getElementById("toc-sheet");
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
