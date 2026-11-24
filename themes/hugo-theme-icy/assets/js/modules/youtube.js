/**
 * Lite YouTube embeds. Nothing is requested from YouTube until the reader
 * clicks the poster. Then a quick reachability probe runs: if YouTube can be
 * reached, a youtube-nocookie.com player replaces the poster and starts;
 * otherwise a message offers Retry and a direct link (the poster link itself
 * also works without JS).
 * Starting a video claims media focus; when another player claims it, the
 * embed is paused through the IFrame API's postMessage interface.
 */
import { claimMediaFocus, onMediaFocus } from "./media-focus.js";
import { claim } from "./content-ready.js";

const PROBE_URL = "https://www.youtube-nocookie.com/favicon.ico";
const PROBE_TIMEOUT_MS = 5000;

export function initYouTube(scope = document) {
  for (const root of claim(scope, "[data-youtube]", "youtube")) setup(root);
}

function reachable() {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => done(false), PROBE_TIMEOUT_MS);
    function done(ok) {
      window.clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok);
    }
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.referrerPolicy = "no-referrer";
    img.src = `${PROBE_URL}?_=${Date.now()}`;
  });
}

function setup(root) {
  const frame = root.querySelector(".youtube-frame");
  const poster = root.querySelector(".youtube-poster");
  const message = root.querySelector(".youtube-message");
  const retry = root.querySelector("[data-youtube-retry]");
  if (!frame || !poster) return;
  let iframe = null;

  const load = async () => {
    root.classList.add("is-loading");
    if (message) message.hidden = true;
    const ok = await reachable();
    root.classList.remove("is-loading");
    if (!ok) {
      if (message) message.hidden = false;
      retry?.focus();
      return;
    }
    const params = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1", enablejsapi: "1" });
    if (root.dataset.start) params.set("start", root.dataset.start);
    if (root.dataset.end) params.set("end", root.dataset.end);
    iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${root.dataset.id}?${params}`;
    iframe.title = root.dataset.title || "YouTube";
    iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    poster.replaceWith(iframe);
    root.classList.add("is-playing");
    iframe.focus();
    claimMediaFocus(iframe);
  };

  poster.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    load();
  });
  retry?.addEventListener("click", load);

  onMediaFocus((owner) => {
    if (iframe && owner !== iframe) {
      iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
    }
  });
}
