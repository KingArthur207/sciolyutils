/* Tap Code, Codebusters (Division A) version. The 5 × 5 table is not given on the test:
      1 2 3 4 5
   1  A B C D E     (K shares the cell with C)
   2  F G H I J
   3  L M N O P
   4  Q R S T U
   5  V W X Y Z
   A letter is a group of taps for its row, a pause, then a group for its column, which
   tests print as ● ●●●. The tap map below is the one the toebes test generator uses.
   Pure spec, no DOM. */
import { COMMON_LETTERS } from "../assets/js/symbols.js";

export const TAP_ROWS = ["ABCDE", "FGHIJ", "LMNOP", "QRSTU", "VWXYZ"];
export const DOT = "●";

/** "H" -> "23" (row 2, column 3). K -> "13", the same as C. */
export function tapsFor(letter) {
  const L = String(letter).toUpperCase() === "K" ? "C" : String(letter).toUpperCase();
  for (let r = 0; r < 5; r++) {
    const c = TAP_ROWS[r].indexOf(L);
    if (c >= 0) return `${r + 1}${c + 1}`;
  }
  throw new RangeError(`not a letter: ${letter}`);
}

/** The 25 cells in table order: { code: "13", letters: ["C", "K"] } … */
export const TAP_CELLS = TAP_ROWS.flatMap((row, r) => [...row].map((L, c) => ({
  code: `${r + 1}${c + 1}`, letters: L === "C" ? ["C", "K"] : [L],
})));

/** "23" -> "●● ●●●" (what the test prints); a single digit gives just the first group. */
export const dots = (code) => String(code).split("").map((d) => DOT.repeat(Number(d))).join(" ");
/** "23" -> "2 · 3" for the numbers notation. */
export const numbers = (code) => String(code).split("").join(" · ");

/**
 * Whatever is in the answer box -> up to two digits 1–5. Runs of dots count as a digit,
 * typed digits pass through, so "●●3" and "23" and "●● ●●●" all mean "23".
 */
export function normalizeTaps(raw) {
  const out = [];
  let run = 0;
  const flush = () => { if (run > 0) { out.push(String(Math.min(5, run))); run = 0; } };
  for (const ch of String(raw ?? "")) {
    if (ch === DOT || ch === "•") run++;
    else if (/[1-5]/.test(ch)) { flush(); out.push(ch); }
    else flush();
  }
  flush();
  return out.join("").slice(0, 2);
}

const lettersOnly = (raw) => String(raw ?? "").replace(/[^a-z]/gi, "").toUpperCase();
const label = (cell) => cell.letters.join("/");

export function tapDirections({ focus = "all", notation = "dots" } = {}) {
  const show = notation === "numbers" ? numbers : dots;
  const cellOk = (cell) => focus !== "common" || cell.letters.some((L) => COMMON_LETTERS.includes(L));
  const read = {
    id: "t2l", label: "Taps → letter", tone: "indigo", inputmode: "text", maxlength: 1,
    shownWide: true, shownClass: notation === "numbers" ? "is-tapnums" : "is-taps",
    cards: TAP_CELLS.filter(cellOk).map((cell) => ({
      key: cell.code, shown: show(cell.code), answer: cell.letters[0], accept: cell.letters, answerLabel: label(cell),
    })),
    normalize: lettersOnly,
    sr: (c) => { const code = tapsFor(c.answer); return `${code[0]} ${code[0] === "1" ? "tap" : "taps"}, then ${code[1]} ${code[1] === "1" ? "tap" : "taps"}. Type the letter.`; },
    answerLabel: () => "Letter for these taps",
  };
  const letters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter((L) => focus !== "common" || COMMON_LETTERS.includes(L));
  const write = {
    id: "l2t", label: "Letter → taps", tone: "teal", inputmode: "numeric", maxlength: 11,
    answerWide: true, answerClass: "is-taps",
    cards: letters.map((L) => ({ key: L, shown: L, answer: tapsFor(L), answerLabel: dots(tapsFor(L)) })),
    normalize: normalizeTaps,
    display: dots,
    pad: ["1", "2", "3", "4", "5"].map((d) => ({ label: d, value: d })),
    sr: (c) => `Letter ${c.shown}. Enter its row, then its column, 1 to 5 each.`,
    answerLabel: (c) => `Taps for ${c.shown}: row then column`,
  };
  return [read, write];
}

export const spec = {
  id: "tapcode",
  name: "tapcode",
  defaults: { focus: "all", notation: "dots" },
  readExtras: (form) => ({
    focus: form.elements.focus.value === "common" ? "common" : "all",
    notation: form.elements.notation.value === "numbers" ? "numbers" : "dots",
  }),
  applyExtras: (form, s) => { form.elements.focus.value = s.focus; form.elements.notation.value = s.notation; },
  urlExtras: (q, s) => {
    if (q.get("focus") === "common") s.focus = "common"; else if (q.get("focus") === "all") s.focus = "all";
    if (q.get("show") === "numbers") s.notation = "numbers"; else if (q.get("show") === "dots") s.notation = "dots";
  },
  sanitizeExtras: (s) => { s.focus = s.focus === "common" ? "common" : "all"; s.notation = s.notation === "numbers" ? "numbers" : "dots"; },
  extrasKey: (s) => `${s.focus}:${s.notation}`,
  extrasLabel: (s) => `${s.focus === "common" ? "12 most common letters" : "all letters"}, ${s.notation}`,
  urlQuery: (s) => `focus=${s.focus}&show=${s.notation}`,
  directions: (s) => tapDirections(s),
  strip: () => TAP_CELLS.map((cell) => ({ top: label(cell), bottom: numbers(cell.code) })),
};
