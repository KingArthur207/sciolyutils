/* alpha2num — letters ↔ numbers (A = 0 … Z = 25, or A = 1 … Z = 26). Pure spec, no DOM. */
import { ALPHABET } from "../assets/js/drill-engine.js";

const digitsOnly = (raw) => String(raw ?? "").replace(/\D+/g, "");
const lettersOnly = (raw) => String(raw ?? "").replace(/[^a-z]/gi, "").toUpperCase();

export function alphaDirections(base = 0) {
  const a2n = {
    id: "a2n", label: "Letter → number", tone: "indigo", inputmode: "numeric", maxlength: 2,
    cards: [...ALPHABET].map((L, i) => ({ key: L, shown: L, answer: String(i + base) })),
    normalize: digitsOnly,
    sr: (c) => `Letter ${c.shown}. Type its number.`,
    answerLabel: (c) => `Number for ${c.shown}`,
  };
  const n2a = {
    id: "n2a", label: "Number → letter", tone: "teal", inputmode: "text", maxlength: 1,
    cards: [...ALPHABET].map((L, i) => ({ key: L, shown: String(i + base), answer: L })),
    normalize: lettersOnly,
    sr: (c) => `Number ${c.shown}. Type its letter.`,
    answerLabel: (c) => `Letter for ${c.shown}`,
  };
  return [a2n, n2a];
}

export const spec = {
  id: "alpha2num",
  name: "alpha2num",
  defaults: { base: 0 },
  readExtras: (form) => ({ base: Number(form.elements.base.value) === 1 ? 1 : 0 }),
  applyExtras: (form, s) => { form.elements.base.value = String(s.base); },
  urlExtras: (q, s) => { if (q.get("base") === "1") s.base = 1; else if (q.get("base") === "0") s.base = 0; },
  sanitizeExtras: (s) => { s.base = s.base === 1 ? 1 : 0; },
  extrasKey: (s) => String(s.base),
  extrasLabel: (s) => `A = ${s.base}`,
  urlQuery: (s) => `base=${s.base}`,
  directions: (s) => alphaDirections(s.base),
  strip: (s) => [...ALPHABET].map((L, i) => ({ top: L, bottom: String(i + s.base) })),
};
