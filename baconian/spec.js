/* baconian — letters ↔ five-letter A/B codes. Pure spec, no DOM.
   24-letter table (default, what Science Olympiad tests use): I/J share ABAAA
   and U/V share BAABB. 26-letter table: A = AAAAA … Z = BBAAB (index in binary). */
import { ALPHABET } from "../assets/js/drill-engine.js";

export const ALPHA24 = "ABCDEFGHIKLMNOPQRSTUWXYZ";        // no J, no V

const toCode = (n) => n.toString(2).padStart(5, "0").replace(/0/g, "A").replace(/1/g, "B");

/** Baconian code for a letter in the 24- or 26-letter table. */
export function baconCode(letter, alpha = 24) {
  const L = String(letter).toUpperCase();
  if (alpha === 26) {
    const i = ALPHABET.indexOf(L);
    if (i < 0) throw new RangeError(`not a letter: ${letter}`);
    return toCode(i);
  }
  const k = L === "J" ? "I" : L === "V" ? "U" : L;
  const i = ALPHA24.indexOf(k);
  if (i < 0) throw new RangeError(`not a letter: ${letter}`);
  return toCode(i);
}

/** The code → letter table: one entry per distinct code. */
export function baconTable(alpha = 24) {
  if (alpha === 26) return [...ALPHABET].map((L) => ({ code: baconCode(L, 26), letters: [L], label: L }));
  return [...ALPHA24].map((L) => {
    const letters = L === "I" ? ["I", "J"] : L === "U" ? ["U", "V"] : [L];
    return { code: baconCode(L, 24), letters, label: letters.join("/") };
  });
}

const abOnly = (raw) => String(raw ?? "").toUpperCase().replace(/0/g, "A").replace(/1/g, "B").replace(/[^AB]/g, "");
const lettersOnly = (raw) => String(raw ?? "").replace(/[^a-z]/gi, "").toUpperCase();
const spell = (code) => code.split("").join(" ");

export function baconDirections(alpha = 24) {
  const l2b = {
    id: "l2b", label: "Letter → Baconian", tone: "indigo", inputmode: "text", maxlength: 5, answerWide: true,
    cards: [...ALPHABET].map((L) => ({ key: L, shown: L, answer: baconCode(L, alpha) })),
    normalize: abOnly,
    sr: (c) => `Letter ${c.shown}. Type its five-letter Baconian code using A and B.`,
    answerLabel: (c) => `Baconian code for ${c.shown}`,
  };
  const b2l = {
    id: "b2l", label: "Baconian → letter", tone: "teal", inputmode: "text", maxlength: 1, shownWide: true,
    cards: baconTable(alpha).map((t) => ({ key: t.code, shown: t.code, answer: t.letters[0], accept: t.letters, answerLabel: t.label })),
    normalize: lettersOnly,
    sr: (c) => `Code ${spell(c.shown)}. Type its letter.`,
    answerLabel: (c) => `Letter for ${spell(c.shown)}`,
  };
  return [l2b, b2l];
}

export const spec = {
  id: "baconian",
  name: "baconian",
  defaults: { alpha: 24 },
  readExtras: (form) => ({ alpha: Number(form.elements.alpha.value) === 26 ? 26 : 24 }),
  applyExtras: (form, s) => { form.elements.alpha.value = String(s.alpha); },
  urlExtras: (q, s) => { if (q.get("alpha") === "26") s.alpha = 26; else if (q.get("alpha") === "24") s.alpha = 24; },
  sanitizeExtras: (s) => { s.alpha = s.alpha === 26 ? 26 : 24; },
  extrasKey: (s) => `alpha${s.alpha}`,
  extrasLabel: (s) => (s.alpha === 26 ? "26-letter" : "24-letter (I/J, U/V)"),
  urlQuery: (s) => `alpha=${s.alpha}`,
  directions: (s) => baconDirections(s.alpha),
  strip: (s) => baconTable(s.alpha).map((t) => ({ top: t.label, bottom: t.code })),
};
