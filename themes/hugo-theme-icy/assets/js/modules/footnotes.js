/**
 * Footnote previews. Hovering (fine pointers) or focusing a footnote
 * reference shows the note beside it; the pointer can move into the preview
 * (to select text or follow a link). Escape or leaving closes it. The
 * reference still jumps to the note when activated, and touch taps keep
 * that default, so the footnotes list remains the canonical place.
 */
import { claim } from "./content-ready.js";

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 250;
const GAP = 8;

let preview = null;
let attach = null; // binds one reference; set up once with the shared preview

export function initFootnotes(root = document) {
  const refs = claim(root, 'a.footnote-ref[href^="#"]', "footnote");
  if (!refs.length) return;
  if (!attach) attach = createPreview();
  refs.forEach(attach);
}

function createPreview() {
  preview = document.createElement("div");
  preview.className = "footnote-preview";
  preview.setAttribute("popover", "manual");
  preview.setAttribute("role", "note");
  document.body.append(preview);

  let openTimer = 0;
  let closeTimer = 0;
  let owner = null;

  const position = (ref) => {
    const r = ref.getBoundingClientRect();
    const p = preview.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let left = r.left + r.width / 2 - p.width / 2;
    left = Math.max(GAP, Math.min(left, vw - p.width - GAP));
    let top = r.bottom + GAP;
    if (top + p.height > window.innerHeight - GAP && r.top - GAP - p.height > GAP) {
      top = r.top - GAP - p.height;
    }
    preview.style.left = `${Math.round(left)}px`;
    preview.style.top = `${Math.round(top)}px`;
  };

  const show = (ref) => {
    const note = document.getElementById(decodeURIComponent(ref.hash.slice(1)));
    if (!note) return;
    const content = note.cloneNode(true);
    for (const el of content.querySelectorAll(".footnote-backref")) el.remove();
    content.removeAttribute("id");
    for (const el of content.querySelectorAll("[id]")) el.removeAttribute("id");
    preview.replaceChildren(...content.childNodes);
    owner = ref;
    if (!preview.matches(":popover-open")) preview.showPopover();
    position(ref);
  };

  const hide = () => {
    owner = null;
    if (preview.matches(":popover-open")) preview.hidePopover();
  };

  const scheduleShow = (ref) => {
    window.clearTimeout(closeTimer);
    window.clearTimeout(openTimer);
    openTimer = window.setTimeout(() => show(ref), OPEN_DELAY_MS);
  };
  const scheduleHide = () => {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(hide, CLOSE_DELAY_MS);
  };

  preview.addEventListener("pointerenter", () => window.clearTimeout(closeTimer));
  preview.addEventListener("pointerleave", scheduleHide);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && owner) hide();
  });
  window.addEventListener("scroll", () => { if (owner) position(owner); }, { passive: true });

  return (ref) => {
    ref.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") scheduleShow(ref); });
    ref.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") scheduleHide(); });
    ref.addEventListener("focus", () => { if (ref.matches(":focus-visible")) show(ref); });
    ref.addEventListener("blur", scheduleHide);
  };
}
