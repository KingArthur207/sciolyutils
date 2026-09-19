/* caesar — shift letters by a key that is dealt for a run of N consecutive
   letters, then redrawn. Classic parameters: 26-letter alphabet, keys 1–25,
   five letters per key (like classic five-letter cipher groups).
   Encrypt: plain + key → cipher. Decrypt: cipher − key → plain. Pure spec, no DOM. */
import { ALPHABET } from "../assets/js/drill-engine.js";

export const MIN_N = 1, MAX_N = 99;
export const clampN = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(MAX_N, Math.max(MIN_N, n)) : 5;
};

/** Shift a letter by k places (k may be negative). */
export function shiftLetter(letter, k) {
  const i = ALPHABET.indexOf(String(letter).toUpperCase());
  if (i < 0) throw new RangeError(`not a letter: ${letter}`);
  return ALPHABET[(((i + k) % 26) + 26) % 26];
}

const lettersOnly = (raw) => String(raw ?? "").replace(/[^a-z]/gi, "").toUpperCase();

export function caesarDirections({ n = 5, keyAs = "number" } = {}) {
  const length = clampN(n);
  const keyLabel = (k) => (keyAs === "letter" ? ALPHABET[k] : String(k));
  const keyHint = (k) => (keyAs === "letter" ? `A → ${ALPHABET[k]} · shift ${k}` : `A → ${ALPHABET[k]}`);
  const make = (id, label, tone, sign) => ({
    id, label, tone, inputmode: "text", maxlength: 1,
    size: 26,
    run: {
      length,
      size: 25,                                   // keys 1–25, each dealt once per cycle
      context: (i) => ({ key: i + 1 }),
      label: (c) => keyLabel(c.key),
      hint: (c) => keyHint(c.key),
    },
    card: (i, ctx) => {
      const L = ALPHABET[i];
      const k = ctx.key;
      return {
        key: `${L}@${k}`,
        shown: L,
        answer: shiftLetter(L, sign * k),
        statKey: `${sign > 0 ? "+" : "-"}${k}`,
        statShown: `shift ${sign > 0 ? "+" : "−"}${k}`,
        statAnswer: "",
        context: ctx,
      };
    },
    normalize: lettersOnly,
    sr: (c) => `Key ${c.context.key}. ${sign > 0 ? "Encrypt" : "Decrypt"} the letter ${c.shown}.`,
    answerLabel: (c) => `${sign > 0 ? "Cipher" : "Plain"} letter for ${c.shown} with key ${c.context.key}`,
  });
  return [
    make("enc", "Encrypt · plain → cipher", "indigo", +1),
    make("dec", "Decrypt · cipher → plain", "teal", -1),
  ];
}

export const spec = {
  id: "caesar",
  name: "caesar",
  defaults: { n: 5, keyAs: "number" },
  readExtras: (form) => ({ n: clampN(form.elements.n.value), keyAs: form.elements.keyAs.value === "letter" ? "letter" : "number" }),
  applyExtras: (form, s) => { form.elements.n.value = String(s.n); form.elements.keyAs.value = s.keyAs; },
  urlExtras: (q, s) => {
    if (q.has("n")) s.n = clampN(q.get("n"));
    if (q.get("key") === "letter") s.keyAs = "letter"; else if (q.get("key") === "number") s.keyAs = "number";
  },
  sanitizeExtras: (s) => { s.n = clampN(s.n); s.keyAs = s.keyAs === "letter" ? "letter" : "number"; },
  extrasKey: (s) => `n${s.n}:${s.keyAs}`,
  extrasLabel: (s) => `${s.n} per key${s.keyAs === "letter" ? ", key as letter" : ""}`,
  urlQuery: (s) => `n=${s.n}&key=${s.keyAs}`,
  directions: (s) => caesarDirections(s),
  strip: () => [...ALPHABET].map((L, i) => ({ top: L, bottom: String(i) })),
};
