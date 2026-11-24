/**
 * Video players: replace native controls with the theme bar.
 * Controls stay visible while paused and fade out after a short idle period
 * during playback; any pointer movement, touch or keyboard focus brings them
 * back. Fullscreen uses the frame (so the bar comes along), falling back to
 * the video element's own fullscreen on iOS.
 */
import { bindTransport } from "./media-transport.js";
import { claim } from "./content-ready.js";

const IDLE_MS = 2500;

export function initVideoPlayers(scope = document) {
  for (const root of claim(scope, "[data-video-player]", "video")) setup(root);
}

function setup(root) {
  const media = root.querySelector("video");
  const frame = root.querySelector(".video-frame");
  if (!media || !frame) return;

  // Frame the picture at its real proportions (portrait clips get a narrower
  // frame instead of black bars), unless the author fixed a ratio.
  const fitRatio = () => {
    if (root.hasAttribute("data-ratio-fixed") || !media.videoWidth || !media.videoHeight) return;
    root.style.setProperty("--ratio", `${media.videoWidth} / ${media.videoHeight}`);
    root.style.setProperty("--ratio-value", String(media.videoWidth / media.videoHeight));
  };
  media.addEventListener("loadedmetadata", fitRatio);
  fitRatio();

  media.removeAttribute("controls");
  root.querySelector("[data-controls]")?.removeAttribute("hidden");
  for (const b of root.querySelectorAll("[data-play]")) b.removeAttribute("hidden");
  root.classList.add("is-enhanced");
  const transport = bindTransport({ root, media });

  // Clicking the picture toggles playback.
  media.addEventListener("click", () => transport.toggle());

  // Mute
  const mute = root.querySelector("[data-mute]");
  const renderMute = () => {
    root.classList.toggle("is-muted", media.muted);
    mute?.setAttribute("aria-pressed", String(media.muted));
    mute?.setAttribute("aria-label", media.muted ? mute.dataset.labelUnmute : mute.dataset.labelMute);
  };
  mute?.addEventListener("click", () => { media.muted = !media.muted; });
  media.addEventListener("volumechange", renderMute);
  renderMute();

  // Fullscreen
  const fullscreen = root.querySelector("[data-fullscreen]");
  const canFrameFullscreen = Boolean(frame.requestFullscreen);
  if (!canFrameFullscreen && !media.webkitEnterFullscreen) fullscreen?.setAttribute("hidden", "");
  fullscreen?.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (canFrameFullscreen) frame.requestFullscreen().catch(() => {});
    else media.webkitEnterFullscreen?.();
  });
  document.addEventListener("fullscreenchange", () => {
    const on = document.fullscreenElement === frame;
    root.classList.toggle("is-fullscreen", on);
    fullscreen?.setAttribute("aria-label", on ? fullscreen.dataset.labelExit : fullscreen.dataset.labelEnter);
  });

  // Keyboard shortcuts while focus is inside the player (not on the seek bar).
  frame.addEventListener("keydown", (event) => {
    if (event.target.matches("input, textarea")) return;
    const key = event.key.toLowerCase();
    if (key === "k" || (key === " " && event.target === frame)) {
      event.preventDefault();
      transport.toggle();
    } else if (key === "m") {
      media.muted = !media.muted;
    } else if (key === "f") {
      fullscreen?.click();
    }
  });

  // Idle fade of the controls during playback.
  let timer = 0;
  const wake = () => {
    root.classList.add("is-active");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!frame.matches(":focus-within") && !media.paused) root.classList.remove("is-active");
    }, IDLE_MS);
  };
  for (const type of ["pointermove", "pointerdown", "focusin"]) frame.addEventListener(type, wake);
  media.addEventListener("play", wake);
  media.addEventListener("pause", () => root.classList.add("is-active"));
}
