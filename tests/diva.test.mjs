import { test } from "node:test";
import assert from "node:assert/strict";
import { ALPHABET, judge, Round } from "../assets/js/drill-engine.js";
import { spec as pigpen, PIGPEN_PAIRS } from "../pigpen/spec.js";
import { spec as tapcode, TAP_ROWS, TAP_CELLS, tapsFor, dots, numbers, normalizeTaps, tapDirections } from "../tapcode/spec.js";

/* the exact map the toebes Codebusters test generator uses (O = tap) */
const TOEBES = {
  A: "O O", B: "O OO", C: "O OOO", D: "O OOOO", E: "O OOOOO", F: "OO O", G: "OO OO", H: "OO OOO", I: "OO OOOO", J: "OO OOOOO",
  K: "O OOO", L: "OOO O", M: "OOO OO", N: "OOO OOO", O: "OOO OOOO", P: "OOO OOOOO", Q: "OOOO O", R: "OOOO OO", S: "OOOO OOO",
  T: "OOOO OOOO", U: "OOOO OOOOO", V: "OOOOO O", W: "OOOOO OO", X: "OOOOO OOO", Y: "OOOOO OOOO", Z: "OOOOO OOOOO",
};

test("tap code: the table and every letter's taps match the toebes generator", () => {
  assert.deepEqual(TAP_ROWS, ["ABCDE", "FGHIJ", "LMNOP", "QRSTU", "VWXYZ"]);
  for (const L of ALPHABET) assert.equal(dots(tapsFor(L)).replace(/●/g, "O"), TOEBES[L], L);
  assert.equal(tapsFor("H"), "23"); assert.equal(tapsFor("k"), "13"); assert.equal(tapsFor("C"), "13"); assert.equal(tapsFor("Z"), "55");
  assert.throws(() => tapsFor("1"));
  assert.equal(TAP_CELLS.length, 25);
  assert.deepEqual(TAP_CELLS.find((c) => c.code === "13").letters, ["C", "K"]);
  assert.equal(dots("23"), "●● ●●●"); assert.equal(dots("2"), "●●"); assert.equal(numbers("23"), "2 · 3");
});

test("tap code: the answer box understands dots and digits", () => {
  assert.equal(normalizeTaps("23"), "23");
  assert.equal(normalizeTaps("●●3"), "23");
  assert.equal(normalizeTaps("●● ●●●"), "23");
  assert.equal(normalizeTaps("●●●●● ●●●●●"), "55");
  assert.equal(normalizeTaps("2"), "2");
  assert.equal(normalizeTaps("7a9"), "");
  assert.equal(normalizeTaps("123"), "12");
  assert.equal(normalizeTaps(""), "");
  for (const L of ALPHABET) assert.equal(normalizeTaps(dots(tapsFor(L))), tapsFor(L));
});

test("tap code: directions, C/K, focus, notation, and a full round", () => {
  const [read, write] = tapDirections({});
  assert.equal(read.cards.length, 25);
  assert.equal(write.cards.length, 26);
  const ck = read.cards.find((c) => c.key === "13");
  assert.equal(ck.shown, "● ●●●");
  assert.equal(judge(ck, "C"), "correct"); assert.equal(judge(ck, "K"), "correct"); assert.equal(judge(ck, "H"), "wrong");
  assert.equal(ck.answerLabel, "C/K");
  const k = write.cards.find((c) => c.key === "K");
  assert.equal(k.answer, "13"); assert.equal(k.answerLabel, "● ●●●");
  assert.equal(judge(k, "1"), "pending"); assert.equal(judge(k, "13"), "correct"); assert.equal(judge(k, "2"), "wrong");
  assert.deepEqual(write.pad.map((p) => p.value), ["1", "2", "3", "4", "5"]);
  assert.equal(write.inputmode, "numeric");
  assert.equal(write.display("23"), "●● ●●●");
  const [nums] = tapDirections({ notation: "numbers" });
  assert.equal(nums.cards.find((c) => c.key === "23").shown, "2 · 3");
  const [cr, cw] = tapDirections({ focus: "common" });
  assert.equal(cw.cards.length, 12);
  assert.ok(cr.cards.some((c) => c.key === "13"));                 // C is common, so the C/K cell stays
  assert.ok(!cr.cards.some((c) => c.key === "25"));                // J is not
  const r = new Round({ directions: tapDirections({}) });
  for (let i = 0; i < 60; i++) { const { card } = r.next(i); assert.equal(r.submit(card.answer, i), "correct"); }
  assert.equal(r.score, 60);
  assert.equal(tapcode.strip({}).length, 25);
  assert.deepEqual(tapcode.strip({})[2], { top: "C/K", bottom: "1 · 3" });
  assert.equal(tapcode.extrasKey({ focus: "all", notation: "dots" }), "all:dots");
  const q = new URLSearchParams("focus=common&show=numbers"); const s = { focus: "all", notation: "dots" };
  tapcode.urlExtras(q, s); assert.deepEqual(s, { focus: "common", notation: "numbers" });
  const bad = { focus: "x", notation: "y" }; tapcode.sanitizeExtras(bad); assert.deepEqual(bad, { focus: "all", notation: "dots" });
});

test("pigpen: 26 one-to-one symbols on the symbol-drill factory", () => {
  assert.equal(PIGPEN_PAIRS.length, 26);
  const [read, write] = pigpen.directions({ focus: "all" });
  assert.equal(read.cards.length, 26); assert.equal(write.cards.length, 26);
  for (const c of read.cards) assert.equal(c.answer, c.key);
  assert.equal(read.shownClass, "is-glyph font-pigpen");
  assert.equal(write.pad.length, 26);
  assert.equal(pigpen.directions({ focus: "common" })[0].cards.length, 12);
  assert.equal(pigpen.strip({}).length, 26);
});
