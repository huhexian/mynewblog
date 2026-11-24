/**
 * Live Photos.
 *   - Desktop (fine pointer that can hover): hovering plays the clip muted.
 *   - Touch: press and hold plays it with sound until release. A hold never
 *     opens the browser's image menu, a drag or a link preview, and moving the
 *     finger (scrolling, swiping in the viewer) cancels it.
 *   - The LIVE button plays it with sound (keyboard accessible); press again to stop.
 * A clip that ends or fails returns to the still. Starting playback with sound
 * announces itself, so other audible media on the page pause (media focus).
 * Reduced motion: no hover autoplay; explicit actions still work.
 *
 * The image viewer holds a Live Photo of its own; it sends STOP_EVENT to it
 * (and to the photo it opened from) before it swaps the clip or closes.
 */
import { claimMediaFocus, onMediaFocus } from "./media-focus.js";
import { claim } from "./content-ready.js";

export const STOP_EVENT = "icy:live-photo-stop";

const LONG_PRESS_MS = 300;
const MOVE_TOLERANCE = 10;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export function initLivePhotos(root = document) {
  claim(root, "[data-live-photo]", "livephoto").forEach(setup);
}

function setup(figure) {
  const frame = figure.querySelector(".live-photo-frame");
  const video = figure.querySelector(".live-photo-video");
  const badge = figure.querySelector(".live-photo-badge");
  if (!frame || !video || !badge) return;

  let mode = null; // null | "preview" (muted) | "full" (with sound)
  let press = null; // touch / pen press in progress: { id, x, y, timer }
  let held = false; // the current press turned into a hold

  const cancelPress = () => {
    if (press) window.clearTimeout(press.timer);
    press = null;
  };

  const stop = () => {
    mode = null;
    video.pause();
    video.muted = true;
    figure.classList.remove("is-playing");
    badge.setAttribute("aria-pressed", "false");
  };

  const start = async (withSound) => {
    mode = withSound ? "full" : "preview";
    video.muted = !withSound;
    if (withSound) claimMediaFocus(video);
    try {
      video.currentTime = 0;
    } catch {
      // Not seekable before metadata loads; playback starts at 0 anyway.
    }
    figure.classList.add("is-playing");
    badge.setAttribute("aria-pressed", "true");
    try {
      await video.play();
    } catch (error) {
      // A touch press is not a user activation until the finger lifts, so the
      // first hold on a page may not play sound: play it muted instead.
      if (withSound && error?.name === "NotAllowedError" && mode === "full") {
        video.muted = true;
        try {
          await video.play();
          return;
        } catch {
          // Fall through.
        }
      }
      if (mode) stop();
    }
  };

  video.addEventListener("ended", stop);
  video.addEventListener("error", () => {
    stop();
    figure.dataset.state = "error";
  });
  // A new clip (the viewer swapped it) gets a fresh chance to play.
  video.addEventListener("loadstart", () => {
    delete figure.dataset.state;
  });

  figure.addEventListener(STOP_EVENT, () => {
    cancelPress();
    held = false;
    stop();
  });

  // Hover preview (muted).
  frame.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse" && canHover.matches && !reduceMotion.matches && !mode) start(false);
  });
  frame.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" && mode === "preview") stop();
  });

  // Press and hold (touch / pen) plays with sound.
  frame.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || !event.isPrimary || event.target.closest(".live-photo-badge")) return;
    cancelPress();
    held = false;
    press = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      timer: window.setTimeout(() => {
        held = true;
        start(true);
      }, LONG_PRESS_MS),
    };
  });
  frame.addEventListener("pointermove", (event) => {
    if (!press || held || event.pointerId !== press.id) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE) cancelPress();
  });
  const release = (event) => {
    if (!press || event.pointerId !== press.id) return;
    cancelPress();
    if (held && mode === "full") stop();
  };
  frame.addEventListener("pointerup", release);
  frame.addEventListener("pointercancel", release);

  // A hold plays the photo: no context menu ("Save image", "Open link"), no
  // drag of the still, no text selection. CSS adds -webkit-touch-callout: none
  // for iOS, which fires no contextmenu event.
  frame.addEventListener("contextmenu", (event) => {
    if (press || held || mode === "full") event.preventDefault();
  });
  frame.addEventListener("dragstart", (event) => event.preventDefault());
  for (const img of frame.querySelectorAll("img")) img.setAttribute("draggable", "false");

  // A long press must not also open the viewer.
  frame.addEventListener("click", (event) => {
    if (held) {
      event.preventDefault();
      event.stopPropagation();
      held = false;
    }
  }, true);

  badge.addEventListener("click", (event) => {
    event.preventDefault();
    if (mode === "full") stop();
    else start(true);
  });

  onMediaFocus((owner) => {
    if (owner !== video && mode === "full") stop();
  });

  badge.hidden = false;
}
