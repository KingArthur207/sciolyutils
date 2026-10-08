import { test } from "node:test";
import assert from "node:assert/strict";
import { ALPHABET, judge, Round } from "../assets/js/drill-engine.js";
import { COMMON_LETTERS, makeSymbolSpec } from "../assets/js/symbols.js";
import { spec as templar, TEMPLAR_PAIRS } from "../templar/spec.js";
import { spec as sga, SGA_PAIRS } from "../sga/spec.js";

test("Knights Templar: 25 symbols, I and J share one, every letter has a symbol", () => {
  assert.equal(TEMPLAR_PAIRS.length, 25);
  const ij = TEMPLAR_PAIRS.find((p) => p.letters.length > 1);
  assert.deepEqual(ij, { glyph: "I", letters: ["I", "J"] });
  const covered = new Set(TEMPLAR_PAIRS.flatMap((p) => p.letters));
  assert.deepEqual([...covered].sort().join(""), ALPHABET);
  assert.deepEqual(templar.letters.join(""), ALPHABET);
  const [read, write] = templar.directions({ focus: "all" });
  assert.equal(read.cards.length, 25);
  assert.equal(write.cards.length, 26);
  const ijCard = read.cards.find((c) => c.key === "I");
  assert.equal(judge(ijCard, "I"), "correct");
  assert.equal(judge(ijCard, "J"), "correct");
  assert.equal(judge(ijCard, "K"), "wrong");
  assert.equal(ijCard.answerLabel, "I/J");
  const jWrite = write.cards.find((c) => c.key === "J");
  assert.equal(jWrite.answer, "I");                     // tapping the I/J symbol answers J
  assert.equal(jWrite.answerLabel, "I/J symbol");
  assert.equal(write.pad.length, 25);
  assert.deepEqual(write.pad.map((k) => k.value).join(""), "ABCDEFGHIKLMNOPQRSTUVWXYZ");
  assert.equal(templar.strip({}).length, 25);
  assert.deepEqual(templar.strip({})[8], { top: "I", bottom: "I/J" });
  assert.equal(read.shownClass, "is-glyph font-templar");
  assert.equal(write.answerClass, "is-glyph font-templar");
});

test("Standard Galactic Alphabet: 26 one-to-one symbols", () => {
  assert.equal(SGA_PAIRS.length, 26);
  const [read, write] = sga.directions({ focus: "all" });
  assert.equal(read.cards.length, 26);
  assert.equal(write.cards.length, 26);
  for (const c of read.cards) assert.equal(c.answer, c.key);
  for (const c of write.cards) assert.equal(c.answer, c.key);
  assert.equal(write.pad.length, 26);
  assert.equal(sga.strip({}).length, 26);
  assert.equal(sga.extrasKey({ focus: "all" }), "all");
});

test("symbol drills: the write direction ignores the keyboard, the read direction takes letters", () => {
  const [read, write] = sga.directions({ focus: "all" });
  assert.equal(read.normalize("q1"), "Q");
  assert.equal(write.normalize("Q"), "");
  assert.equal(write.inputmode, "none");
  for (const c of read.cards) assert.equal(judge(c, c.answer), "correct");
  for (const c of write.cards) assert.equal(judge(c, c.answer), "correct");
  const r = new Round({ directions: [read, write] });
  for (let i = 0; i < 60; i++) { const { card } = r.next(i); assert.equal(r.submit(card.answer, i), "correct"); }
  assert.equal(r.score, 60);
});

test("symbol drills: the 12-most-common focus", () => {
  assert.equal(COMMON_LETTERS, "ETAOINSRHLDC");
  for (const s of [templar, sga]) {
    const [read, write] = s.directions({ focus: "common" });
    assert.equal(write.cards.length, 12);
    assert.ok(write.cards.every((c) => COMMON_LETTERS.includes(c.key)));
    assert.equal(read.cards.length, 12);
    assert.ok(read.cards.every((c) => c.accept.some((L) => COMMON_LETTERS.includes(L))));
    assert.equal(s.extrasLabel({ focus: "common" }), "12 most common letters");
    const q = new URLSearchParams("focus=common"); const st = { focus: "all" }; s.urlExtras(q, st); assert.equal(st.focus, "common");
    const bad = { focus: "weird" }; s.sanitizeExtras(bad); assert.equal(bad.focus, "all");
  }
  assert.ok(templar.directions({ focus: "common" })[0].cards.some((c) => c.key === "I"));   // I/J symbol stays (I is common)
});

test("makeSymbolSpec rejects nothing silly and labels pairs", () => {
  const s = makeSymbolSpec({ id: "x", name: "x", cipherName: "X", fontClass: "font-x", pairs: [{ glyph: "A", letters: ["A", "B"] }, { glyph: "C", letters: ["C"] }] });
  const [read, write] = s.directions({ focus: "all" });
  assert.equal(read.cards.length, 2);
  assert.equal(write.cards.length, 3);
  assert.equal(write.cards.find((c) => c.key === "B").answer, "A");
  assert.match(read.sr(read.cards[1]), /symbol number 2 of 2/);
});
