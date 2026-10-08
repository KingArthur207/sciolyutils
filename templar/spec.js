/* Knights Templar cipher, Codebusters (Division A) version: the Maltese-cross alphabet
   on the DaVinci Decoder resource sheet. 25 symbols; I and J share one. Rendered with
   the KnightsTemplar font from the toebes/ciphers tools (see assets/fonts/LICENSE). */
import { makeSymbolSpec } from "../assets/js/symbols.js";

export const TEMPLAR_PAIRS = [
  "A", "B", "C", "D", "E", "F", "G", "H", ["I", "J"], "K", "L", "M", "N",
  "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
].map((x) => (Array.isArray(x) ? { glyph: x[0], letters: x } : { glyph: x, letters: [x] }));

export const spec = makeSymbolSpec({
  id: "templar",
  name: "templar",
  cipherName: "Knights Templar",
  fontClass: "font-templar",
  pairs: TEMPLAR_PAIRS,
});
