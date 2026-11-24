/**
 * Drop the image placeholder (surface tint + blurred LQIP) once the real
 * image has loaded, so images with transparency sit directly on the page
 * instead of on a tinted box. One capturing listener covers every image,
 * including ones inserted later (unlocked protected posts, galleries).
 */
const mark = (img) => {
  if (img.complete && img.naturalWidth) img.closest(".media-frame")?.setAttribute("data-loaded", "");
};

export function initMediaLoaded() {
  document.addEventListener("load", (event) => {
    if (event.target instanceof HTMLImageElement) mark(event.target);
  }, true);
  for (const img of document.querySelectorAll(".media-frame img")) mark(img);
}
