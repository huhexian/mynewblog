/**
 * Lazy comment loading. A provider shell carries `data-comments-loader`
 * (the provider's loader script URL). The script is injected once the shell
 * is within ~one screen of the viewport — or immediately when the page is
 * opened at #comments or a comment anchor. Nothing is requested from the
 * comment service before that. A little earlier (~three screens away) the
 * browser is told to preconnect to the service, so the TLS handshake is done
 * by the time the loader is requested.
 */
const MARGIN = "100% 0px";
const WARM_MARGIN = "300% 0px";

function preconnect(urls) {
  const origins = new Set();
  for (const url of urls) {
    try {
      const { origin } = new URL(url, location.href);
      if (origin !== location.origin) origins.add(origin);
    } catch {
      // Not a URL: nothing to warm up.
    }
  }
  // Two connections per origin: the loader script is a credentialed request,
  // the comment API calls are CORS (anonymous) — browsers pool them apart.
  for (const origin of origins) {
    if (document.head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) continue;
    for (const cors of [false, true]) {
      const link = document.createElement("link");
      link.rel = "preconnect";
      link.href = origin;
      if (cors) link.crossOrigin = "anonymous";
      document.head.append(link);
    }
  }
}

/*
 * Ecoku writes its pager labels as "‹ 上一页" / "下一页 ›". A text arrow never
 * lines up with CJK text, so the arrow becomes an aria-hidden chevron the
 * stylesheet draws (components/comments-ecoku.css). Re-applied whenever
 * Ecoku re-renders the pager.
 */
const ARROW = /^\s*([‹«←])\s*|\s*([›»→])\s*$/;

function tidyPager(root) {
  for (const button of root.querySelectorAll(".ecoku-pager-button")) {
    const text = button.childNodes.length === 1 && button.firstChild.nodeType === Node.TEXT_NODE
      ? button.firstChild.data : null;
    const match = text?.match(ARROW);
    if (!match) continue;
    const chevron = document.createElement("span");
    chevron.className = "ecoku-pager-chevron";
    chevron.dataset.dir = match[1] ? "prev" : "next";
    chevron.setAttribute("aria-hidden", "true");
    const label = text.replace(ARROW, "");
    if (match[1]) button.replaceChildren(chevron, label);
    else button.replaceChildren(label, chevron);
  }
}

function watchEcoku(shell) {
  const observer = new MutationObserver(() => tidyPager(shell));
  observer.observe(shell, { childList: true, subtree: true, characterData: true });
}

export function initComments() {
  for (const shell of document.querySelectorAll("[data-comments-loader]")) {
    if (shell.matches("[data-ecoku-comments]")) watchEcoku(shell);
    const load = () => {
      if (shell.dataset.commentsLoaded) return;
      shell.dataset.commentsLoaded = "true";
      const script = document.createElement("script");
      script.src = shell.dataset.commentsLoader;
      script.async = true;
      document.body.append(script);
    };

    const wantsComments = location.hash && shell.closest("#comments") &&
      (location.hash === "#comments" || /comment/i.test(location.hash));
    if (wantsComments || !("IntersectionObserver" in window)) {
      load();
      continue;
    }
    const warm = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      warm.disconnect();
      preconnect([shell.dataset.commentsLoader, shell.dataset.serverUrl].filter(Boolean));
    }, { rootMargin: WARM_MARGIN });
    warm.observe(shell);

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: MARGIN });
    observer.observe(shell);
  }
}
