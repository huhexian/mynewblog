/**
 * Media transport: binds one <audio> or <video> element to custom controls.
 * Shared by the audio player, playlist rows and the video player.
 *
 * Markup contract (all optional except media):
 *   [data-play]      play/pause buttons; labels from data-label-play / data-label-pause
 *   [data-seek]      <input type="range" min="0" max="1000"> (native keyboard support)
 *   [data-current]   current time text
 *   [data-duration]  duration text
 *
 * State is reflected on `root` as classes: is-playing, is-loading, is-ended,
 * has-error, has-started. The seek input exposes --progress and --buffered
 * (0–100%) for styling and a readable aria-valuetext.
 *
 * Audible playback claims media focus, so other players on the page pause.
 */
import { claimMediaFocus, onMediaFocus } from "./media-focus.js";

const SEEK_MAX = 1000;

export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function bindTransport({ root, media }) {
  const playButtons = [...root.querySelectorAll("[data-play]")];
  const seek = root.querySelector("[data-seek]");
  const current = root.querySelector("[data-current]");
  const duration = root.querySelector("[data-duration]");
  let seeking = false;

  const setState = (name, on) => root.classList.toggle(name, on);

  const renderPlay = () => {
    const playing = !media.paused && !media.ended;
    setState("is-playing", playing);
    for (const button of playButtons) {
      button.setAttribute("aria-pressed", String(playing));
      const label = playing ? button.dataset.labelPause : button.dataset.labelPlay;
      if (label) button.setAttribute("aria-label", label);
    }
  };

  const renderTime = () => {
    const total = media.duration;
    const now = media.currentTime;
    if (current) current.textContent = formatTime(now);
    if (duration && Number.isFinite(total)) duration.textContent = formatTime(total);
    if (seek) {
      const ratio = Number.isFinite(total) && total > 0 ? now / total : 0;
      if (!seeking) seek.value = String(Math.round(ratio * SEEK_MAX));
      seek.style.setProperty("--progress", `${(Number(seek.value) / SEEK_MAX) * 100}%`);
      seek.setAttribute("aria-valuetext", `${formatTime(now)} / ${formatTime(total)}`);
    }
  };

  const renderBuffered = () => {
    if (!seek || !Number.isFinite(media.duration) || media.duration <= 0) return;
    const ranges = media.buffered;
    const end = ranges.length ? ranges.end(ranges.length - 1) : 0;
    seek.style.setProperty("--buffered", `${(end / media.duration) * 100}%`);
  };

  const toggle = () => {
    if (media.paused || media.ended) play();
    else media.pause();
  };

  const play = async () => {
    try {
      await media.play();
    } catch (error) {
      // AbortError: a newer load replaced this one. NotAllowedError: the
      // browser blocked playback (autoplay policy) — the file itself is fine.
      if (error?.name !== "AbortError" && error?.name !== "NotAllowedError") setState("has-error", true);
    }
  };

  for (const button of playButtons) button.addEventListener("click", toggle);

  if (seek) {
    seek.max = String(SEEK_MAX);
    seek.addEventListener("input", () => {
      seeking = true;
      if (Number.isFinite(media.duration)) {
        media.currentTime = (Number(seek.value) / SEEK_MAX) * media.duration;
      }
      renderTime();
    });
    seek.addEventListener("change", () => { seeking = false; });
  }

  media.addEventListener("play", () => {
    setState("has-started", true);
    setState("is-ended", false);
    if (!media.muted) claimMediaFocus(media);
    renderPlay();
  });
  media.addEventListener("volumechange", () => {
    if (!media.muted && !media.paused) claimMediaFocus(media);
  });
  media.addEventListener("pause", renderPlay);
  media.addEventListener("ended", () => {
    setState("is-ended", true);
    renderPlay();
  });
  media.addEventListener("waiting", () => setState("is-loading", true));
  for (const type of ["playing", "canplay", "pause", "error"]) {
    media.addEventListener(type, () => setState("is-loading", false));
  }
  media.addEventListener("error", () => {
    setState("has-error", true);
    renderPlay();
  });
  for (const type of ["timeupdate", "durationchange", "loadedmetadata", "seeked"]) {
    media.addEventListener(type, renderTime);
  }
  media.addEventListener("progress", renderBuffered);
  media.addEventListener("loadedmetadata", renderBuffered);

  onMediaFocus((owner) => {
    if (owner !== media && !media.paused && !media.muted) media.pause();
  });

  renderPlay();
  renderTime();
  return { play, toggle, media };
}
