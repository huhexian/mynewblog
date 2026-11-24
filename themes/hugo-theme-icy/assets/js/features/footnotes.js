/* Feature bundle "footnotes" (also enhances content inserted later, e.g. unlocked protected posts). */
import { initFootnotes } from "../modules/footnotes.js";
import { onContent } from "../modules/content-ready.js";

onContent(initFootnotes);
