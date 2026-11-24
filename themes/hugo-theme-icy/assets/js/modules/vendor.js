/**
 * Third-party libraries, loaded on demand. head/assets.html lists the vendor
 * scripts of the page's features in the #icy-vendor JSON block (fingerprinted
 * URL and Subresource Integrity hash). loadVendor(name) inserts a feature's
 * scripts once, in order, and resolves when the last one has run.
 */
const loading = new Map();

function scriptsFor(name) {
  try {
    const data = JSON.parse(document.getElementById("icy-vendor")?.textContent || "{}");
    return Array.isArray(data[name]) ? data[name] : [];
  } catch {
    return [];
  }
}

function insert({ src, integrity }) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    if (integrity) {
      script.integrity = integrity;
      script.crossOrigin = "anonymous";
    }
    script.onload = resolve;
    script.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.append(script);
  });
}

export function loadVendor(name) {
  if (!loading.has(name)) {
    const scripts = scriptsFor(name);
    loading.set(
      name,
      scripts.length
        ? scripts.reduce((ready, script) => ready.then(() => insert(script)), Promise.resolve())
        : Promise.reject(new Error(`no vendor scripts for "${name}"`)),
    );
  }
  return loading.get(name);
}
