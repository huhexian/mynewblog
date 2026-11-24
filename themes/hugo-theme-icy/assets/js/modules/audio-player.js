/**
 * Audio players (`music`) and playlists.
 * Each [data-audio-player] swaps its native <audio controls> for the theme
 * controls. In a [data-playlist], the next playable track starts when one
 * ends (failed tracks are skipped) and durations load lazily once the list
 * scrolls into view.
 */
import { bindTransport } from "./media-transport.js";
import { claim } from "./content-ready.js";

export function initAudioPlayers(scope = document) {
  const players = new Map(); // root -> transport
  for (const root of claim(scope, "[data-audio-player]", "audio")) {
    const media = root.querySelector("audio");
    if (!media) continue;
    media.removeAttribute("controls");
    root.querySelector("[data-controls]")?.removeAttribute("hidden");
    for (const b of root.querySelectorAll("[data-play]")) b.removeAttribute("hidden");
    root.classList.add("is-enhanced");
    players.set(root, bindTransport({ root, media }));
  }

  for (const list of claim(scope, "[data-playlist]", "playlist")) {
    const roots = [...list.querySelectorAll("[data-audio-player]")];

    const playFrom = (start) => {
      for (let i = start; i < roots.length; i++) {
        if (!roots[i].classList.contains("has-error")) {
          players.get(roots[i])?.play();
          return;
        }
      }
    };

    roots.forEach((root, i) => {
      const media = root.querySelector("audio");
      media.addEventListener("ended", () => playFrom(i + 1));
      media.addEventListener("error", () => {
        // Only advance if this track was the one meant to be playing.
        if (root.classList.contains("has-started")) playFrom(i + 1);
      });
      media.addEventListener("play", () => {
        for (const other of roots) other.classList.toggle("is-current", other === root);
      });
    });

    // Lazy durations: fetch metadata once the list is near the viewport.
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      for (const root of roots) {
        const media = root.querySelector("audio");
        if (media.preload === "none") {
          media.preload = "metadata";
          media.load();
        }
      }
    }, { rootMargin: "200px 0px" });
    observer.observe(list);
  }
}
