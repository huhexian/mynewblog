/**
 * QR code buttons. Each button opens its card, a native popover, so a click
 * or tap works without JavaScript. This module adds the rest: the card sits
 * just above its button (below when there is no room), hovering with a mouse
 * opens it and leaving closes it, and a click while it is open from hovering
 * keeps it open until the next click, Escape or a click elsewhere.
 */
import { claim } from "./content-ready.js";

const OPEN_DELAY_MS = 80;
const CLOSE_DELAY_MS = 200;
const GAP = 8;

export function initQrcodes(root = document) {
  claim(root, "[data-qrcode]", "qrcode").forEach(enhance);
}

function enhance(item) {
  const button = item.querySelector(".qrcode-button");
  const card = item.querySelector(".qrcode-card");
  if (!button || !card || typeof card.showPopover !== "function") return;

  let hovered = false; // open from hovering, not pinned by a click
  let openTimer = 0;
  let closeTimer = 0;
  const isOpen = () => card.matches(":popover-open");

  const place = () => {
    const b = button.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const left = Math.max(GAP, Math.min(b.left + b.width / 2 - c.width / 2, vw - c.width - GAP));
    let top = b.top - GAP - c.height;
    let side = "above";
    if (top < GAP && b.bottom + GAP + c.height <= window.innerHeight - GAP) {
      top = b.bottom + GAP;
      side = "below";
    }
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(top)}px`;
    card.dataset.side = side;
  };

  // showPopover() lays the card out at once, so it is placed before the
  // first paint (no jump from the centre of the window).
  const open = (fromHover) => {
    window.clearTimeout(closeTimer);
    hovered = fromHover;
    card.dataset.placed = "";
    if (!isOpen()) card.showPopover();
    place();
  };
  const close = () => {
    window.clearTimeout(openTimer);
    if (isOpen()) card.hidePopover();
  };

  button.addEventListener("click", (event) => {
    // Handle the click here instead of through popovertarget, so the card is
    // placed before it shows and a hover-opened card is pinned, not closed.
    event.preventDefault();
    window.clearTimeout(openTimer);
    if (isOpen() && !hovered) close();
    else open(false);
  });

  const enter = (event) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(closeTimer);
    if (!isOpen()) openTimer = window.setTimeout(() => open(true), OPEN_DELAY_MS);
  };
  const leave = (event) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(openTimer);
    if (hovered) closeTimer = window.setTimeout(close, CLOSE_DELAY_MS);
  };
  for (const el of [button, card]) {
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
  }

  const follow = () => place();
  card.addEventListener("toggle", (event) => {
    if (event.newState === "open") {
      window.addEventListener("scroll", follow, { passive: true });
      window.addEventListener("resize", follow, { passive: true });
    } else {
      hovered = false;
      window.removeEventListener("scroll", follow);
      window.removeEventListener("resize", follow);
    }
  });
}
