// ns-hugo-imp:/Users/huhexian/Desktop/mynewblog/themes/hugo-theme-icy/assets/js/modules/content-ready.js
var EVENT = "icy:content";
function onContent(init) {
  init(document);
  document.addEventListener(EVENT, (event) => init(event.detail.root));
}
function claim(root, selector, key) {
  const found = [...root.querySelectorAll(selector)];
  if (root instanceof Element && root.matches(selector)) found.unshift(root);
  return found.filter((el) => {
    const marks = (el.dataset.enhanced ?? "").split(" ");
    if (marks.includes(key)) return false;
    el.dataset.enhanced = [...marks.filter(Boolean), key].join(" ");
    return true;
  });
}

// ns-hugo-imp:/Users/huhexian/Desktop/mynewblog/themes/hugo-theme-icy/assets/js/modules/code-copy.js
var RESET_MS = 2e3;
var status = null;
function initCodeCopy(root = document) {
  if (!navigator.clipboard) return;
  const buttons = claim(root, "[data-code-copy]", "copy");
  if (!buttons.length) return;
  if (!status) {
    status = document.createElement("span");
    status.className = "visually-hidden";
    status.setAttribute("role", "status");
    document.body.append(status);
  }
  for (const button of buttons) {
    const block = button.closest("[data-code-block]");
    let timer = 0;
    button.addEventListener("click", async () => {
      const code = block?.querySelector("pre code");
      if (!code) return;
      const clone = code.cloneNode(true);
      for (const el of clone.querySelectorAll(".ln, .lnt")) el.remove();
      const cells = block.querySelectorAll(".lntd:last-child code");
      const text = cells.length ? [...cells].map((c) => c.textContent).join("") : clone.textContent;
      let state;
      try {
        await navigator.clipboard.writeText(text.replace(/\n$/, ""));
        state = "copied";
      } catch {
        state = "failed";
      }
      delete button.dataset.state;
      void button.offsetWidth;
      button.dataset.state = state;
      status.textContent = state === "copied" ? button.dataset.labelCopied : button.dataset.labelFailed;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        delete button.dataset.state;
        status.textContent = "";
      }, RESET_MS);
    });
    button.hidden = false;
  }
}

// <stdin>
onContent(initCodeCopy);
//# sourceMappingURL=code.js.map
