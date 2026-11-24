/**
 * Queue Plausible's init call with the configured endpoint. Runs before
 * Plausible's own deferred script (document order), so the stub is in place
 * when it loads; if Plausible somehow ran first, plausible.init is already
 * the real one and this simply calls it.
 */
const raw = document.getElementById("icy-analytics")?.textContent;
let settings = {};
try {
  settings = JSON.parse(raw || "{}");
} catch {
  // Malformed settings: fall back to Plausible's defaults.
}

window.plausible ??= (...args) => {
  window.plausible.q ??= [];
  window.plausible.q.push(args);
};
window.plausible.init ??= (options) => {
  window.plausible.o = options || {};
};
window.plausible.init(settings.endpoint ? { endpoint: settings.endpoint } : {});
