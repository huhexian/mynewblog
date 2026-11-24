/* Feature bundle "audio" (also enhances content inserted later, e.g. unlocked protected posts). */
import { initAudioPlayers } from "../modules/audio-player.js";
import { onContent } from "../modules/content-ready.js";

onContent(initAudioPlayers);
