/* Standard Galactic Alphabet, Codebusters (Division A) version: the 26-symbol table on the
   DaVinci Decoder resource sheet. Rendered with the StandardGalacticAlphabetSO font from
   the toebes/ciphers tools (see assets/fonts/LICENSE). */
import { makeSymbolSpec } from "../assets/js/symbols.js";

export const SGA_PAIRS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((L) => ({ glyph: L, letters: [L] }));

export const spec = makeSymbolSpec({
  id: "sga",
  name: "sga",
  cipherName: "Standard Galactic Alphabet",
  fontClass: "font-sga",
  pairs: SGA_PAIRS,
});
