/* Feature bundle "code" (also enhances content inserted later, e.g. unlocked protected posts). */
import { initCodeCopy } from "../modules/code-copy.js";
import { onContent } from "../modules/content-ready.js";

onContent(initCodeCopy);
