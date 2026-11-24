/**
 * Unlock protected posts in the browser.
 *
 * Sealed page (production, after tools/protect/seal.mjs):
 *   #icy-protected-config  { version: 1, payload: "protected-content.plb" }
 *   payload  "PLB1" | u32 header length | header JSON | AES-256-GCM ciphertext
 *            header: { version, kdf: "PBKDF2-SHA-256", iterations, salt, iv, route }
 *            AAD:    "hugo-protected:v1:<route>"
 *            plaintext: u32 manifest length | manifest JSON | html | files…
 *   Files of the page bundle come back as blob: URLs; references to them in
 *   the decrypted HTML (src, href, poster, srcset, inline url()) are rewritten.
 *
 * Unsealed page (hugo server): the build markers are still present, so the
 * password is checked against them and the source is shown as is — a preview
 * of the unlock flow for authors. Never deploy unsealed output.
 *
 * After rendering, contentReady() lets every feature enhance the new content.
 */
import { contentReady } from "./content-ready.js";

const MAGIC = "PLB1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function initProtected() {
  const root = document.querySelector("[data-protected]");
  if (!root) return;
  const lock = root.querySelector("[data-protected-lock]");
  const form = root.querySelector("[data-protected-form]");
  const input = form?.querySelector('input[type="password"]');
  const button = form?.querySelector('button[type="submit"]');
  const status = root.querySelector("[data-protected-status]");
  const slot = root.querySelector("[data-protected-content]");
  if (!lock || !form || !input || !button || !status || !slot) return;
  const text = root.dataset;

  const sealed = readJSON(document.getElementById("icy-protected-config")?.textContent);
  const buildRaw = document.getElementById("icy-protected-build")?.textContent;
  const sourceRaw = document.getElementById("icy-protected-source")?.textContent;
  const blobURLs = [];

  const setState = (state, message) => {
    lock.dataset.state = state;
    status.textContent = message;
    const working = state === "working";
    input.disabled = working;
    button.disabled = working;
  };

  const fail = (message) => {
    setState("error", message);
    input.focus();
    input.select();
  };

  const render = (html, files = []) => {
    const assets = new Map();
    for (const file of files) {
      const url = URL.createObjectURL(new Blob([file.bytes], { type: file.mime }));
      blobURLs.push(url);
      assets.set(safeDecode(file.url), { url, download: !/^(image|audio|video)\//.test(file.mime), name: file.name.split("/").at(-1) });
    }
    const template = document.createElement("template");
    template.innerHTML = html;
    if (assets.size) rewriteReferences(template.content, assets);
    slot.replaceChildren(template.content);
    slot.hidden = false;
    lock.hidden = true;
    slot.focus({ preventScroll: true });
    contentReady(slot);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = input.value;
    if (!password) return fail(text.textEmpty);

    if (sealed?.payload) {
      if (!globalThis.crypto?.subtle) return fail(text.textUnsupported);
      setState("working", text.textWorking);
      try {
        const { html, files } = await decryptPayload(new URL(sealed.payload, location.href), password);
        setState("done", "");
        render(html, files);
      } catch (error) {
        fail(error?.message === "unavailable" ? text.textUnavailable : text.textWrong);
      }
      return;
    }

    // Unsealed development preview.
    const build = readJSON(buildRaw ? decodeBase64Text(buildRaw) : "");
    if (!build || sourceRaw == null) return fail(text.textUnavailable);
    if (password !== build.password) return fail(text.textWrong);
    console.warn("[icy] Unsealed protected page: preview only. Run tools/protect/seal.mjs before deploying.");
    setState("done", "");
    render(decodeBase64Text(sourceRaw));
  });

  // Release the decrypted files when the page is really discarded — not when
  // it goes into the back/forward cache, where coming back must still work.
  window.addEventListener("pagehide", (event) => {
    if (!event.persisted) for (const u of blobURLs.splice(0)) URL.revokeObjectURL(u);
  });
}

function readJSON(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function base64ToBytes(value) {
  const binary = atob(String(value).replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const decodeBase64Text = (value) => decoder.decode(base64ToBytes(value));

async function decryptPayload(url, password) {
  let response;
  try {
    response = await fetch(url, { cache: "no-cache" });
  } catch {
    throw new Error("unavailable");
  }
  if (!response.ok) throw new Error("unavailable");
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.length < 9 || decoder.decode(bytes.subarray(0, 4)) !== MAGIC) throw new Error("format");
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset + 4, 4).getUint32(0);
  const header = readJSON(decoder.decode(bytes.subarray(8, 8 + headerLength)));
  if (
    header?.version !== 1 || header.kdf !== "PBKDF2-SHA-256"
    || !Number.isSafeInteger(header.iterations) || header.iterations < 100000 || header.iterations > 10000000
    || normalizeRoute(header.route) !== normalizeRoute(location.pathname)
  ) throw new Error("format");

  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(header.salt), iterations: header.iterations },
    material, { name: "AES-GCM", length: 256 }, false, ["decrypt"],
  );
  const plaintext = new Uint8Array(await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(header.iv), tagLength: 128, additionalData: encoder.encode(`hugo-protected:v1:${header.route}`) },
    key, bytes.subarray(8 + headerLength),
  ));

  const manifestLength = new DataView(plaintext.buffer, plaintext.byteOffset, 4).getUint32(0);
  const manifest = readJSON(decoder.decode(plaintext.subarray(4, 4 + manifestLength)));
  if (!manifest?.html || !Array.isArray(manifest.files)) throw new Error("format");
  const data = plaintext.subarray(4 + manifestLength);
  const part = ({ offset, length }) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || offset + length > data.length) throw new Error("format");
    return data.subarray(offset, offset + length);
  };
  return {
    html: decoder.decode(part(manifest.html)),
    files: manifest.files.map((f) => ({ url: f.url, name: f.name, mime: f.mime, bytes: part(f) })),
  };
}

function safeDecode(path) {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function normalizeRoute(path) {
  const route = safeDecode(path.startsWith("/") ? path : `/${path}`);
  return route.endsWith("/") ? route : `${route}/`;
}

function rewriteReferences(root, assets) {
  const swap = (value) => {
    if (!value || /^(#|data:|blob:)/.test(value)) return null;
    try {
      const url = new URL(value, document.baseURI);
      const asset = assets.get(safeDecode(url.pathname));
      return asset ? { value: asset.url + url.hash, asset } : null;
    } catch {
      return null;
    }
  };
  for (const el of root.querySelectorAll("*")) {
    for (const name of ["src", "href", "poster"]) {
      const hit = swap(el.getAttribute(name));
      if (!hit) continue;
      el.setAttribute(name, hit.value);
      if (name === "href" && el.tagName === "A" && hit.asset.download) el.setAttribute("download", hit.asset.name);
    }
    const srcset = el.getAttribute("srcset");
    if (srcset) {
      el.setAttribute("srcset", srcset.split(",").map((candidate) => {
        const [first, ...rest] = candidate.trim().split(/\s+/);
        const hit = swap(first);
        return [hit ? hit.value : first, ...rest].join(" ");
      }).join(", "));
    }
    const style = el.getAttribute("style");
    if (style?.includes("url(")) {
      el.setAttribute("style", style.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (full, q, src) => {
        const hit = swap(src);
        return hit ? `url(${q}${hit.value}${q})` : full;
      }));
    }
  }
}
