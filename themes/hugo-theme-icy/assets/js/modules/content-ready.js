/**
 * "Content ready" protocol for content inserted after page load (unlocked
 * protected posts today). Each feature bundle registers its initializer with
 * onContent(); it runs once for the document and again for every root passed
 * to contentReady(). Initializers must be idempotent: they mark the elements
 * they enhance (data-enhanced) and skip marked ones.
 */
const EVENT = "icy:content";

export function onContent(init) {
  init(document);
  document.addEventListener(EVENT, (event) => init(event.detail.root));
}

export function contentReady(root) {
  document.dispatchEvent(new CustomEvent(EVENT, { detail: { root } }));
}

/** querySelectorAll on root (including root itself) skipping already enhanced elements; marks them. */
export function claim(root, selector, key) {
  const found = [...root.querySelectorAll(selector)];
  if (root instanceof Element && root.matches(selector)) found.unshift(root);
  return found.filter((el) => {
    const marks = (el.dataset.enhanced ?? "").split(" ");
    if (marks.includes(key)) return false;
    el.dataset.enhanced = [...marks.filter(Boolean), key].join(" ");
    return true;
  });
}
