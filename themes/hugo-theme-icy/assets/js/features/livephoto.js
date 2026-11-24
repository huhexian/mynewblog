/* Feature bundle "livephoto" (also enhances content inserted later, e.g. unlocked protected posts). */
import { initLivePhotos } from "../modules/live-photo.js";
import { onContent } from "../modules/content-ready.js";

onContent(initLivePhotos);
