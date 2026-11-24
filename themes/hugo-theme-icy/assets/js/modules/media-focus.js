/**
 * Media focus: at most one audible media element plays at a time.
 * Any player that starts playback with sound calls claimMediaFocus(element);
 * the others subscribe with onMediaFocus() and pause themselves.
 * Shared by Live Photos and the audio and video players.
 */
const EVENT = "icy:media-focus";

export function claimMediaFocus(element) {
  document.dispatchEvent(new CustomEvent(EVENT, { detail: element }));
}

export function onMediaFocus(callback) {
  document.addEventListener(EVENT, (event) => callback(event.detail));
}
