/* Porta, Codebusters (Division B & C) version: decryption given the key (encryption optional,
   but Porta is its own inverse, so it is the same move). The key letter picks a row:
   A,B → row 0, C,D → row 1, … Y,Z → row 12. Along that row the halves swap:
      a letter in A–M (position i)  →  the letter in N–Z at (i + row) mod 13
      a letter in N–Z (position j)  →  the letter in A–M at (j − row) mod 13
   which is exactly the table on the resource sheet and the toebes test generator's mapping.
   Same shell as vigenere: key banner, hint bubble, keyword mode, table toggle. Pure spec. */
import { ALPHABET } from "../assets/js/drill-engine.js";
import { KEYWORDS, KEYWORD_PASSES } from "../assets/js/keywords.js";
export { KEYWORDS, KEYWORD_PASSES };

export const num = (L) => ALPHABET.indexOf(String(L).toUpperCase());
export const row = (key) => Math.floor(num(key) / 2);                    // 0 … 12
export const pairOf = (key) => `${ALPHABET[2 * row(key)]},${ALPHABET[2 * row(key) + 1]}`;   // "E,F"
export const half = (L) => (num(L) < 13 ? "A" : "N");                    // which half the letter is in
export const halfIndex = (L) => num(L) % 13;                              // 0 … 12 within its half

/** Encrypt or decrypt (same thing) one letter with one key letter. */
export function porta(letter, key) {
  const p = num(letter), k = row(key);
  if (p < 0 || num(key) < 0) throw new RangeError(`not letters: ${letter} ${key}`);
  return p < 13 ? ALPHABET[((p + k) % 13) + 13] : ALPHABET[(p - 13 - k + 13) % 13];
}

/** "R = N+4 · key E → row 2 (E,F)" */
export const numbersHint = (shown, key) => `${shown} = ${half(shown)}+${halfIndex(shown)} · key ${key} → row ${row(key)} (${pairOf(key)})`;
/** "R 4 − row 2 = ?" for an N–Z letter, "C 2 + row 2 = ?" for an A–M letter. */
export const steps = (shown, key) =>
  (half(shown) === "A" ? `${shown} ${halfIndex(shown)} + row ${row(key)} = ?` : `${shown} ${halfIndex(shown)} − row ${row(key)} = ?`);
const wrapNote = (shown) => (half(shown) === "A" ? "count in N–Z · over 12? −13" : "count in A–M · under 0? +13");

const lettersOnly = (raw) => String(raw ?? "").replace(/[^a-z]/gi, "").toUpperCase();

export function portaDirections({ key = "letter", help = "none" } = {}) {
  const word = key === "word";
  const run = word
    ? { length: KEYWORD_PASSES * 5, size: KEYWORDS.length, context: (i) => ({ word: KEYWORDS[i], pos: 0, key: "" }) }
    : { length: 1, size: 26, context: (i) => ({ key: ALPHABET[i] }) };
  const pairShort = (k) => pairOf(k).replace(",", "·");
  const hint = (c) => (word ? `${c.word} ${((c.pos - 1 + 5) % 5) + 1}/5 · ${pairShort(c.key)}` : `row ${pairShort(c.key)}`);
  const hintFor = (card) => {
    const { key: k, shown } = card.context;
    if (help === "numbers") return numbersHint(shown, k);
    if (help === "steps") return `${steps(shown, k)}   (${wrapNote(shown)})`;
    return "";
  };
  const make = (id, label, tone, sign) => ({
    id, label, tone, inputmode: "text", maxlength: 1, size: 26,
    run: { ...run, label: (c) => c.key, hint },
    hintFor,
    card: (i, ctx) => {
      if (word) { ctx.key = ctx.word[ctx.pos % 5]; ctx.pos++; }
      const shown = ALPHABET[i];
      return {
        key: `${shown}@${ctx.key}`, shown,
        answer: porta(shown, ctx.key),
        statKey: pairOf(ctx.key), statShown: `row ${pairOf(ctx.key)}`, statAnswer: "",
        context: { key: ctx.key, shown, sign },
      };
    },
    normalize: lettersOnly,
    sr: (c) => `Key ${c.context.key}, row ${pairOf(c.context.key)}. ${sign > 0 ? "Encrypt the plain letter" : "Decrypt the cipher letter"} ${c.shown}.`,
    answerLabel: (c) => `${sign > 0 ? "Cipher" : "Plain"} letter for ${c.shown} with key ${c.context.key}`,
  });
  return [
    make("dec", "Decrypt · cipher → plain", "indigo", -1),
    make("enc", "Encrypt · plain → cipher", "teal", +1),
  ];
}

/** The Porta table from the resource sheet: A–M across the top, one row per key pair. */
export function portaTableHTML() {
  const top = ALPHABET.slice(0, 13), bottom = ALPHABET.slice(13);
  const head = `<tr><th class="corner">Key</th>${[...top].map((L) => `<th>${L}</th>`).join("")}</tr>`;
  const rows = Array.from({ length: 13 }, (_, k) =>
    `<tr><th>${ALPHABET[2 * k]},${ALPHABET[2 * k + 1]}</th>${[...Array(13).keys()].map((c) => `<td>${bottom[(c + k) % 13]}</td>`).join("")}</tr>`
  ).join("");
  return `<table class="tabula porta-table" aria-label="Porta table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

export const spec = {
  id: "porta",
  name: "porta",
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
  directions: (s) => portaDirections(s),
  renderStrip: () => portaTableHTML(),
  scrollOnStart: (s) => (s.strip ? { selector: "#stage", block: "end" } : null),
};
