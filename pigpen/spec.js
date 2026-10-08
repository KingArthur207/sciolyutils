/* Pigpen (Masonic) cipher, Codebusters (Division A) version: the standard table on the
   DaVinci Decoder resource sheet. Grid A–I, dotted grid J–R, X for S T U V (top, left,
   right, bottom), dotted X for W X Y Z. Rendered with the Pigpen Cipher font
   (Jérémie Dupuis, SIL OFL; see assets/fonts/LICENSE-PigpenCipher-OFL.txt). */
import { makeSymbolSpec } from "../assets/js/symbols.js";

export const PIGPEN_PAIRS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((L) => ({ glyph: L, letters: [L] }));

export const spec = makeSymbolSpec({
  id: "pigpen",
  name: "pigpen",
  cipherName: "Pigpen",
  fontClass: "font-pigpen",
  pairs: PIGPEN_PAIRS,
});
