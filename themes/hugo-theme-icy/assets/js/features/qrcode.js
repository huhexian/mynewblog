/* Feature bundle "qrcode" (QR code buttons above the copyright card). */
import { initQrcodes } from "../modules/qrcode.js";
import { onContent } from "../modules/content-ready.js";

onContent(initQrcodes);
