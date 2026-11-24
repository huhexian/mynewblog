/* Feature bundle "tabs" (also enhances content inserted later, e.g. unlocked protected posts). */
import { initTabs } from "../modules/tabs.js";
import { onContent } from "../modules/content-ready.js";

onContent(initTabs);
