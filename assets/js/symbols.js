/* =========================================================================
   symbols.js — spec factory for symbol-alphabet drills (Knights Templar,
   Standard Galactic Alphabet, …). The glyphs come from a cipher font: a card's
   `shown` is the plain letter, and a CSS class renders it as the symbol.
   Two directions: read a symbol and type its letter, or see a letter and tap
   its symbol on a palette. Letters that share a symbol (Templar I/J) are one
   card when reading and accept either letter. Pure, no DOM.
   ========================================================================= */
import { ALPHABET } from "./drill-engine.js";

/** The twelve most frequent letters, in the order the DaVinci Decoder resource sheet lists them. */
export const COMMON_LETTERS = "ETAOINSRHLDC";

const lettersOnly = (raw) => String(raw ?? "").replace(/[^a-z]/gi, "").toUpperCase();

/**
 * pairs: [{ glyph: "I", letters: ["I", "J"] }, …] in table order; `glyph` is the
 * character the cipher font maps to that symbol.
 */
export function makeSymbolSpec({ id, name, cipherName, fontClass, pairs, readLabel = "Symbol → letter", writeLabel = "Letter → symbol" }) {
  const byLetter = new Map();
  pairs.forEach((p, i) => p.letters.forEach((L) => byLetter.set(L, { ...p, index: i })));
  const letters = [...ALPHABET].filter((L) => byLetter.has(L));
  const label = (p) => p.letters.join("/");

  const inFocus = (s, p) => s.focus !== "common" || p.letters.some((L) => COMMON_LETTERS.includes(L));

  function directions(s) {
    const read = {
      id: "s2l", label: readLabel, tone: "indigo", inputmode: "text", maxlength: 1,
      shownClass: `is-glyph ${fontClass}`,
      cards: pairs.filter((p) => inFocus(s, p)).map((p) => ({
        key: p.glyph, shown: p.glyph, answer: p.letters[0], accept: p.letters, answerLabel: label(p),
      })),
      normalize: lettersOnly,
      sr: (c) => `${cipherName} symbol number ${byLetter.get(c.answer).index + 1} of ${pairs.length}. Type its letter.`,
      answerLabel: () => "Letter for this symbol",
    };
    const write = {
      id: "l2s", label: writeLabel, tone: "teal", inputmode: "none", maxlength: 1,
      answerClass: `is-glyph ${fontClass}`,
      cards: letters.filter((L) => s.focus !== "common" || COMMON_LETTERS.includes(L)).map((L) => {
        const p = byLetter.get(L);
        return { key: L, shown: L, answer: p.glyph, answerLabel: `${label(p)} symbol`, statShown: L, statAnswer: `${label(p)} symbol` };
      }),
      normalize: () => "",                       // the keyboard cannot answer this one; the palette can
      pad: pairs.map((p) => ({ label: p.glyph, value: p.glyph })),
      sr: (c) => `Letter ${c.shown}. Tap its ${cipherName} symbol on the palette.`,
      answerLabel: (c) => `Symbol for ${c.shown}`,
    };
    return [read, write];
  }

  return {
    id, name,
    defaults: { focus: "all" },
    readExtras: (form) => ({ focus: form.elements.focus.value === "common" ? "common" : "all" }),
    applyExtras: (form, s) => { form.elements.focus.value = s.focus; },
    urlExtras: (q, s) => { if (q.get("focus") === "common") s.focus = "common"; else if (q.get("focus") === "all") s.focus = "all"; },
    sanitizeExtras: (s) => { s.focus = s.focus === "common" ? "common" : "all"; },
    extrasKey: (s) => s.focus,
    extrasLabel: (s) => (s.focus === "common" ? "12 most common letters" : "all letters"),
    urlQuery: (s) => `focus=${s.focus}`,
    directions,
    strip: () => pairs.map((p) => ({ top: p.glyph, bottom: label(p) })),
    pairs, letters, fontClass, cipherName,
  };
}
