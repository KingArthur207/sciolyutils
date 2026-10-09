/* Vigenère, Division A version: decryption given the key (encryption optional).
   The maths, with A = 0 … Z = 25:  plain = cipher − key (mod 26),  cipher = plain + key (mod 26).
   The key is either a fresh random letter every prompt or a five-letter keyword that cycles
   over ten prompts, the way a keyword runs along a message. Help levels put the letter
   numbers, then the open equation, in a hint bubble under the letter. Pure spec, no DOM. */
import { ALPHABET } from "../assets/js/drill-engine.js";

import { KEYWORDS, KEYWORD_PASSES } from "../assets/js/keywords.js";
export { KEYWORDS, KEYWORD_PASSES };

export const num = (L) => ALPHABET.indexOf(String(L).toUpperCase());
const mod = (n) => ((n % 26) + 26) % 26;
export const encrypt = (plain, key) => ALPHABET[mod(num(plain) + num(key))];
export const decrypt = (cipher, key) => ALPHABET[mod(num(cipher) - num(key))];

/** The equation for one prompt with the result left open: "R 17 − E 4 = ?". */
export function steps(shown, key, sign) {
  return `${shown} ${num(shown)} ${sign > 0 ? "+" : "−"} ${key} ${num(key)} = ?`;
}
/** Both letters as numbers: "R = 17 · E = 4". */
export const numbersHint = (shown, key) => `${shown} = ${num(shown)} · ${key} = ${num(key)}`;

const lettersOnly = (raw) => String(raw ?? "").replace(/[^a-z]/gi, "").toUpperCase();

export function vigenereDirections({ key = "letter", help = "none" } = {}) {
  const word = key === "word";
  // the run context is mutated by card() so the banner can show the current pair
  const run = word
    ? { length: KEYWORD_PASSES * 5, size: KEYWORDS.length, context: (i) => ({ word: KEYWORDS[i], pos: 0, key: "", shown: "", sign: 1 }) }
    : { length: 1, size: 26, context: (i) => ({ key: ALPHABET[i], shown: "", sign: 1 }) };
  // the key banner only ever says which key; help lives in its own bubble under the letter
  const hint = (c) => (word ? `${c.word} · ${((c.pos - 1 + 5) % 5) + 1}/5` : "");
  const hintFor = (card) => {
    const { key: k, shown, sign } = card.context;
    if (help === "numbers") return numbersHint(shown, k);
    if (help === "steps") return `${steps(shown, k, sign)}   (${sign > 0 ? "over 25? −26" : "under 0? +26"})`;
    return "";
  };
  const make = (id, label, tone, sign) => ({
    id, label, tone, inputmode: "text", maxlength: 1, size: 26,
    run: { ...run, label: (c) => c.key, hint },
    hintFor,
    card: (i, ctx) => {
      if (word) { ctx.key = ctx.word[ctx.pos % 5]; ctx.pos++; }
      const shown = ALPHABET[i];
      ctx.shown = shown; ctx.sign = sign;
      return {
        key: `${shown}@${ctx.key}`, shown,
        answer: sign > 0 ? encrypt(shown, ctx.key) : decrypt(shown, ctx.key),
        statKey: ctx.key, statShown: `key ${ctx.key}`, statAnswer: "",
        context: { key: ctx.key, shown, sign },
      };
    },
    normalize: lettersOnly,
    sr: (c) => `Key ${c.context.key}. ${sign > 0 ? "Encrypt the plain letter" : "Decrypt the cipher letter"} ${c.shown}.`,
    answerLabel: (c) => `${sign > 0 ? "Cipher" : "Plain"} letter for ${c.shown} with key ${c.context.key}`,
  });
  return [
    make("dec", "Decrypt · cipher − key", "indigo", -1),
    make("enc", "Encrypt · plain + key", "teal", +1),
  ];
}

/** The Vigenère table from the resource sheet: key letters down the side, plain letters across. */
export function tabulaRectaHTML() {
  const head = `<tr><th class="corner"></th>${[...ALPHABET].map((L) => `<th>${L}</th>`).join("")}</tr>`;
  const rows = [...ALPHABET].map((K, r) =>
    `<tr><th>${K}</th>${[...ALPHABET].map((_, c) => `<td>${ALPHABET[(r + c) % 26]}</td>`).join("")}</tr>`
  ).join("");
  return `<table class="tabula" aria-label="Vigenère table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

export const spec = {
  id: "vigenere",
  name: "vigenere",
  defaults: { dirB: false, key: "letter", help: "none" },
  readExtras: (form) => ({
    key: form.elements.key.value === "word" ? "word" : "letter",
    help: ["numbers", "steps"].includes(form.elements.help.value) ? form.elements.help.value : "none",
  }),
  applyExtras: (form, s) => { form.elements.key.value = s.key; form.elements.help.value = s.help; },
  urlExtras: (q, s) => {
    if (q.get("key") === "word" || q.get("key") === "letter") s.key = q.get("key");
    if (["none", "numbers", "steps"].includes(q.get("help"))) s.help = q.get("help");
  },
  sanitizeExtras: (s) => { s.key = s.key === "word" ? "word" : "letter"; s.help = ["numbers", "steps"].includes(s.help) ? s.help : "none"; },
  extrasKey: (s) => `${s.key}:${s.help}`,
  extrasLabel: (s) => `${s.key === "word" ? "keyword" : "random key"}, ${s.help === "none" ? "no help" : s.help === "numbers" ? "numbers shown" : "equation shown"}`,
  urlQuery: (s) => `key=${s.key}&help=${s.help}`,
  directions: (s) => vigenereDirections(s),
  renderStrip: () => tabulaRectaHTML(),
  // with the table on it sits above the letter, so land on the letter and let the table show above it
  scrollOnStart: (s) => (s.strip ? { selector: "#stage", block: "end" } : null),
};
