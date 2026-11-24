/**
 * Copy buttons for code blocks. Copies the code text without line numbers;
 * the result is announced through one shared polite live region, and the
 * button shows it briefly: data-state="copied" | "failed" drives the icon
 * morph (copy -> drawn check) and the label crossfade in CSS.
 */
import { claim } from "./content-ready.js";

const RESET_MS = 2000;

let status = null; // one shared polite live region

export function initCodeCopy(root = document) {
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
      // Line-number tables keep the code in the last cell.
      const cells = block.querySelectorAll(".lntd:last-child code");
      const text = cells.length ? [...cells].map((c) => c.textContent).join("") : clone.textContent;

      let state;
      try {
        await navigator.clipboard.writeText(text.replace(/\n$/, ""));
        state = "copied";
      } catch {
        state = "failed";
      }
      // Clicked again while still confirming: restart the animation.
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
