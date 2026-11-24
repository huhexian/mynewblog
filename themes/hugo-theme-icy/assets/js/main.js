/**
 * Icy core script (ES module, deferred): runs on every page.
 * Progressive enhancement only; the site stays usable without it.
 * Page-specific behavior lives in assets/js/features/<name>.js and loads only
 * where the feature is registered (layouts/_partials/assets/registry.html).
 */
import { initColorScheme } from "./modules/color-scheme.js";
import { initMediaLoaded } from "./modules/media-loaded.js";
import { initBackToTop } from "./modules/back-to-top.js";
import { initMenu } from "./modules/menu.js";

initColorScheme();
initMediaLoaded();
initBackToTop();
initMenu();
