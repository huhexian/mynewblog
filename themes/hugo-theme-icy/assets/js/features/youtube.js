/* Feature bundle "youtube" (also enhances content inserted later, e.g. unlocked protected posts). */
import { initYouTube } from "../modules/youtube.js";
import { onContent } from "../modules/content-ready.js";

onContent(initYouTube);
