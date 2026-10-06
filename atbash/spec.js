/* atbash — mirror the alphabet: A ↔ Z, B ↔ Y, C ↔ X … Encoding and decoding are the
   same move, so this drill has one direction and no extras. Pure spec, no DOM. */
import { ALPHABET } from "../assets/js/drill-engine.js";

/** 'A' -> 'Z', 'B' -> 'Y', … (an involution: atbash(atbash(x)) === x). */
export function atbash(letter) {
  const i = ALPHABET.indexOf(String(letter).toUpperCase());
  if (i < 0) throw new RangeError(`not a letter: ${letter}`);
  return ALPHABET[25 - i];
}

const lettersOnly = (raw) => String(raw ?? "").replace(/[^a-z]/gi, "").toUpperCase();

export function atbashDirections() {
  return [{
    id: "atbash", label: "Atbash · A ↔ Z", tone: "indigo", inputmode: "text", maxlength: 1,
    cards: [...ALPHABET].map((L) => ({ key: L, shown: L, answer: atbash(L) })),
    normalize: lettersOnly,
    sr: (c) => `Letter ${c.shown}. Type its Atbash partner.`,
    answerLabel: (c) => `Atbash partner of ${c.shown}`,
  }];
}

export const spec = {
  id: "atbash",
  name: "atbash",
  directions: () => atbashDirections(),
};
