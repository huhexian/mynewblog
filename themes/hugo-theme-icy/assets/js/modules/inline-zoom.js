/**
 * Inline images (stickers and icons in a line of text) can be seen larger:
 * hovering with a mouse, or tapping on a touch screen, shows a small card with
 * the picture at a readable size and its alt text. The card sits above the
 * image (below when there is no room), so the line itself stays readable.
 *
 * Mouse: the card follows a short hover (no flicker when the pointer only
 * passes by) and leaves with the pointer. Touch: a tap shows it, the next
 * tap anywhere hides it. Escape and scrolling close it too. On touch, an
 * image inside a link is left to the link.
 *
 * The card is one manual popover on <body>: the top layer, so nothing clips
 * it and it stays above dialogs. One delegated set of listeners covers images
 * inserted later as well.
 */
const MAX_SIZE_REM = 7.5; // display height of the picture, at most
const MIN_SCALE = 2.5; // never smaller than this × the inline size
const GAP = 8; // between the card and the image, and to the viewport edge
const HOVER_IN_MS = 120;
const HOVER_OUT_MS = 80;
const AUTO_CLOSE_MS = 5000;

export function initInlineZoom() {
  let card = null;
  let picture = null;
  let label = null;
  let current = null;
  let openedAt = 0;
  let timer = 0;

  const ensureCard = () => {
    if (card) return card;
    card = document.createElement("div");
    card.className = "inline-zoom";
    card.setAttribute("aria-hidden", "true");
    if ("popover" in HTMLElement.prototype) card.popover = "manual";
    picture = document.createElement("img");
    picture.alt = "";
    picture.decoding = "async";
    label = document.createElement("span");
    label.className = "inline-zoom-label";
    card.append(picture, label);
    document.body.append(card);
    return card;
  };

  const isOpen = () => Boolean(card && (card.popover ? card.matches(":popover-open") : card.hasAttribute("data-open")));

  const show = (img) => {
    window.clearTimeout(timer);
    const el = ensureCard();
    const rect = img.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : rect.width / rect.height || 1;
    // A readable size, never upscaled past the file itself (unless the file
    // is smaller than a useful preview at all).
    let height = Math.min(MAX_SIZE_REM * rem, img.naturalHeight || Infinity);
    height = Math.max(height, rect.height * MIN_SCALE);
    let width = height * ratio;
    const maxWidth = window.innerWidth - GAP * 2 - 16;
    if (width > maxWidth) {
      width = maxWidth;
      height = width / ratio;
    }

    picture.src = img.currentSrc || img.src;
    picture.style.cssText = `inline-size:${width}px;block-size:${height}px`;
    label.textContent = img.alt.trim();
    label.hidden = !label.textContent;

    // Open first, then measure the card (offset sizes ignore the entry
    // scale) and place it.
    if (el.popover && !el.matches(":popover-open")) el.showPopover();
    else if (!el.popover) el.toggleAttribute("data-open", true);
    const box = { width: el.offsetWidth, height: el.offsetHeight };
    const above = rect.top - GAP - box.height;
    const below = rect.bottom + GAP;
    const top = above >= GAP || below + box.height > window.innerHeight - GAP ? Math.max(above, GAP) : below;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - box.width / 2, GAP), window.innerWidth - box.width - GAP);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    // Grow out of the inline image.
    el.style.transformOrigin = `${rect.left + rect.width / 2 - left}px ${rect.top + rect.height / 2 - top}px`;

    current = img;
    openedAt = window.scrollY;
  };

  const hide = () => {
    window.clearTimeout(timer);
    current = null;
    if (!card) return;
    if (card.popover) {
      if (card.matches(":popover-open")) card.hidePopover();
      return;
    }
    card.removeAttribute("data-open");
  };

  const target = (event) =>
    event.target instanceof Element ? event.target.closest(".inline-image") : null;

  // Mouse: a short hover shows it; leaving hides it.
  document.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const img = target(event);
    if (!img || img === current) return;
    window.clearTimeout(timer);
    // Moving from one inline image to the next switches at once.
    timer = window.setTimeout(() => show(img), isOpen() ? 0 : HOVER_IN_MS);
  });
  document.addEventListener("pointerout", (event) => {
    if (event.pointerType !== "mouse") return;
    const img = target(event);
    if (!img) return;
    window.clearTimeout(timer);
    if (img === current) timer = window.setTimeout(hide, HOVER_OUT_MS);
  });

  // Touch and pen: a tap toggles it; a tap anywhere else closes it.
  document.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") return;
    const img = target(event);
    if (!img || img === current || img.closest("a[href]")) {
      hide();
      return;
    }
    show(img);
    timer = window.setTimeout(hide, AUTO_CLOSE_MS);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && current) hide();
  });

  // A real scroll closes it; tiny scroll-anchoring nudges (content loading
  // above) do not.
  window.addEventListener("scroll", () => {
    if (current && Math.abs(window.scrollY - openedAt) > 24) hide();
  }, { passive: true });
  window.addEventListener("resize", hide, { passive: true });
}
