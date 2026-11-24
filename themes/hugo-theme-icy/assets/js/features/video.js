/* Feature bundle "video" (also enhances content inserted later, e.g. unlocked protected posts). */
import { initVideoPlayers } from "../modules/video-player.js";
import { onContent } from "../modules/content-ready.js";

onContent(initVideoPlayers);
