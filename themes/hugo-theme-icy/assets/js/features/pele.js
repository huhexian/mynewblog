/* Feature bundle "pele" (also renders diagrams in unlocked protected posts). */
import { initPele } from "../modules/pele.js";
import { onContent } from "../modules/content-ready.js";

onContent(initPele);
