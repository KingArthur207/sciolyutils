/* morse — letters ↔ Morse code, as Fractionated Morse, Morbit and Pollux use it
   in Science Olympiad Codebusters (letters only by default; digits optional).
   Canonical form uses "." and "-"; the page shows "•" and "–". Pure spec, no DOM. */
import { ALPHABET } from "../assets/js/drill-engine.js";

export const MORSE = Object.freeze({
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
});
export const DIGITS = "0123456789";

/** "." and "-" → "•" and "–" for display. */
export const pretty = (m) => String(m).replace(/\./g, "•").replace(/-/g, "–");

/** Anything a person might type for a dot or a dash → canonical ".-" string. */
export const normalizeMorse = (raw) =>
  String(raw ?? "").replace(/[.•·,]/g, ".").replace(/[\-–—−_=]/g, "-").replace(/[^.-]/g, "");

/** Spoken form for screen readers: "--.-" → "dah dah dit dah". */
export const spell = (m) => String(m).split("").map((c) => (c === "." ? "dit" : "dah")).join(" ");

const alnumOnly = (raw) => String(raw ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();

export function morseSymbols(digits = false) {
  return [...ALPHABET, ...(digits ? [...DIGITS] : [])];
}

export function morseDirections(digits = false) {
  const symbols = morseSymbols(digits);
  const l2m = {
    id: "l2m", label: "Letter → Morse", tone: "indigo", inputmode: "text", maxlength: 5,
    answerWide: true, answerClass: "is-morse",
    cards: symbols.map((S) => ({ key: S, shown: S, answer: MORSE[S], answerLabel: pretty(MORSE[S]) })),
    normalize: normalizeMorse,
    display: pretty,
    pad: [{ label: "•", value: "." }, { label: "–", value: "-" }],
    sr: (c) => `${/\d/.test(c.shown) ? "Digit" : "Letter"} ${c.shown}. Type its Morse code: dot or dash.`,
    answerLabel: (c) => `Morse code for ${c.shown}`,
  };
  const m2l = {
    id: "m2l", label: "Morse → letter", tone: "teal", inputmode: "text", maxlength: 1,
    shownWide: true, shownClass: "is-morse",
    cards: symbols.map((S) => ({ key: S, shown: pretty(MORSE[S]), answer: S })),
    normalize: alnumOnly,
    sr: (c) => `Morse ${spell(normalizeMorse(c.shown))}. Type its letter.`,
    answerLabel: (c) => `Letter for ${spell(normalizeMorse(c.shown))}`,
  };
  return [l2m, m2l];
}

export const spec = {
  id: "morse",
  name: "morse",
  defaults: { digits: false },
  readExtras: (form) => ({ digits: !!form.elements.digits.checked }),
  applyExtras: (form, s) => { form.elements.digits.checked = !!s.digits; },
  urlExtras: (q, s) => { if (q.has("digits")) s.digits = q.get("digits") !== "0"; },
  sanitizeExtras: (s) => { s.digits = !!s.digits; },
  extrasKey: (s) => (s.digits ? "digits" : "letters"),
  extrasLabel: (s) => (s.digits ? "A–Z + 0–9" : "A–Z"),
  urlQuery: (s) => `digits=${s.digits ? 1 : 0}`,
  directions: (s) => morseDirections(s.digits),
  strip: (s) => morseSymbols(s.digits).map((S) => ({ top: S, bottom: pretty(MORSE[S]) })),
};
