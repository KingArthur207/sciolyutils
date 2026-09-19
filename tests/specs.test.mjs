import { test } from "node:test";
import assert from "node:assert/strict";
import { ALPHABET, judge, Round } from "../assets/js/drill-engine.js";
import { spec as alpha, alphaDirections } from "../alpha2num/spec.js";
import { spec as bacon, baconCode, baconTable, baconDirections, ALPHA24 } from "../baconian/spec.js";
import { spec as morse, MORSE, pretty, normalizeMorse, spell, morseDirections } from "../morse/spec.js";
import { spec as caesar, shiftLetter, caesarDirections, clampN } from "../caesar/spec.js";

/** every card a direction can produce (fixed list, or generated for every context) */
const allCards = (d) => {
  if (d.cards) return d.cards;
  const contexts = d.run ? Array.from({ length: d.run.size }, (_, j) => d.run.context(j)) : [undefined];
  return contexts.flatMap((ctx) => Array.from({ length: d.size }, (_, i) => d.card(i, ctx)));
};

/* every spec must produce two directions with well-formed cards and round-trip through the engine */
for (const [name, s, settings] of [
  ["alpha2num", alpha, { base: 0 }], ["alpha2num base 1", alpha, { base: 1 }],
  ["baconian 24", bacon, { alpha: 24 }], ["baconian 26", bacon, { alpha: 26 }],
  ["morse", morse, { digits: false }], ["morse + digits", morse, { digits: true }],
  ["caesar", caesar, { n: 5, keyAs: "number" }], ["caesar n=1 letter keys", caesar, { n: 1, keyAs: "letter" }],
]) {
  test(`${name}: directions are well-formed and playable`, () => {
    const dirs = s.directions(settings);
    assert.equal(dirs.length, 2);
    for (const d of dirs) {
      assert.ok(d.id && d.label && typeof d.normalize === "function");
      const cards = allCards(d);
      const keys = new Set(cards.map((c) => c.key));
      assert.equal(keys.size, cards.length, `${d.id} keys unique`);
      for (const c of cards) {
        assert.ok(c.shown.length > 0 && c.answer.length > 0);
        // the canonical answer survives the direction's own normalizer
        assert.equal(d.normalize(c.answer), c.answer, `${d.id} ${c.key} normalize(answer)`);
        // and typing the displayed form gives it back too
        if (d.display) assert.equal(d.normalize(d.display(c.answer)), c.answer);
        assert.equal(judge(c, c.answer), "correct");
        assert.ok(c.answer.length <= (d.maxlength || 2), `${d.id} ${c.key} fits maxlength`);
      }
    }
    const r = new Round({ directions: dirs });
    for (let i = 0; i < 80; i++) { const { card } = r.next(i); assert.equal(r.submit(card.answer, i + 1), "correct"); }
    assert.equal(r.score, 80);
    const strip = s.strip(settings);
    assert.ok(Array.isArray(strip) && strip.length >= 24);
    assert.ok(s.extrasKey(settings).length > 0 && s.extrasLabel(settings).length > 0);
  });
}

test("alpha2num: cards and normalizers", () => {
  const [a2n, n2a] = alphaDirections(0);
  assert.deepEqual(a2n.cards[16], { key: "Q", shown: "Q", answer: "16" });
  assert.deepEqual(n2a.cards[16], { key: "Q", shown: "16", answer: "Q" });
  assert.equal(alphaDirections(1)[0].cards[0].answer, "1");
  assert.equal(alphaDirections(1)[1].cards[25].shown, "26");
  assert.equal(a2n.normalize("1a2 "), "12");
  assert.equal(n2a.normalize("q1"), "Q");
  assert.equal(a2n.inputmode, "numeric");
  assert.equal(alpha.extrasKey({ base: 0 }), "0");
});

test("baconian: 24-letter table matches the classic Science Olympiad table", () => {
  const classic = {
    A: "AAAAA", B: "AAAAB", C: "AAABA", D: "AAABB", E: "AABAA", F: "AABAB", G: "AABBA", H: "AABBB",
    I: "ABAAA", J: "ABAAA", K: "ABAAB", L: "ABABA", M: "ABABB", N: "ABBAA", O: "ABBAB", P: "ABBBA", Q: "ABBBB",
    R: "BAAAA", S: "BAAAB", T: "BAABA", U: "BAABB", V: "BAABB", W: "BABAA", X: "BABAB", Y: "BABBA", Z: "BABBB",
  };
  for (const L of ALPHABET) assert.equal(baconCode(L, 24), classic[L], L);
  assert.equal(ALPHA24.length, 24);
  const table = baconTable(24);
  assert.equal(table.length, 24);
  assert.equal(new Set(table.map((t) => t.code)).size, 24);
  assert.deepEqual(table.find((t) => t.code === "ABAAA").letters, ["I", "J"]);
  assert.equal(table.find((t) => t.code === "BAABB").label, "U/V");
  assert.throws(() => baconCode("1"));
});

test("baconian: 26-letter table is the binary index, A = 0", () => {
  for (let i = 0; i < 26; i++) {
    const expect = i.toString(2).padStart(5, "0").replace(/0/g, "A").replace(/1/g, "B");
    assert.equal(baconCode(ALPHABET[i], 26), expect);
  }
  assert.equal(baconCode("Z", 26), "BBAAB");
  assert.equal(baconTable(26).length, 26);
  assert.equal(baconTable(26).find((t) => t.code === "ABAAA").label, "I");
});

test("baconian: directions accept I/J and U/V, and 0/1 for A/B", () => {
  const [l2b, b2l] = baconDirections(24);
  assert.equal(l2b.cards.length, 26);
  assert.equal(l2b.cards.find((c) => c.key === "J").answer, "ABAAA");
  assert.equal(b2l.cards.length, 24);
  const ij = b2l.cards.find((c) => c.key === "ABAAA");
  assert.equal(judge(ij, "J"), "correct");
  assert.equal(judge(ij, "I"), "correct");
  assert.equal(ij.answerLabel, "I/J");
  assert.equal(l2b.normalize("a0b1x"), "AABB");
  assert.equal(l2b.normalize("01101"), "ABBAB");
  assert.equal(b2l.normalize("q2"), "Q");
  assert.equal(bacon.strip({ alpha: 24 }).find((c) => c.bottom === "BAABB").top, "U/V");
  assert.equal(baconDirections(26)[1].cards.length, 26);
});

test("morse: table, pretty form, normalizer, and spelling", () => {
  assert.equal(Object.keys(MORSE).length, 36);
  assert.equal(new Set(Object.values(MORSE)).size, 36);
  assert.equal(MORSE.Q, "--.-"); assert.equal(MORSE.E, "."); assert.equal(MORSE[0], "-----");
  for (const m of Object.values(MORSE)) assert.match(m, /^[.-]{1,5}$/);
  assert.equal(pretty("--.-"), "––•–");
  assert.equal(normalizeMorse("––•–"), "--.-");
  assert.equal(normalizeMorse(" .,-_ = — − • · x"), "..-----.."); // 2 dots, 5 dashes, 2 dots
  assert.equal(normalizeMorse("abc"), "");
  assert.equal(spell("-.."), "dah dit dit");
});

test("morse: directions, digits toggle, and the tap pad", () => {
  const [l2m, m2l] = morseDirections(false);
  assert.equal(l2m.cards.length, 26); assert.equal(m2l.cards.length, 26);
  assert.equal(l2m.cards.find((c) => c.key === "Q").answerLabel, "––•–");
  assert.equal(l2m.display(".-"), "•–");
  assert.deepEqual(l2m.pad.map((k) => k.value), [".", "-"]);
  assert.equal(m2l.cards.find((c) => c.key === "Q").shown, "––•–");
  assert.equal(m2l.normalize("q."), "Q");
  const withDigits = morseDirections(true);
  assert.equal(withDigits[0].cards.length, 36);
  assert.equal(withDigits[1].cards.find((c) => c.key === "7").shown, "––•••");
  assert.equal(withDigits[1].normalize("7"), "7");
  assert.equal(morse.extrasKey({ digits: true }), "digits");
  assert.equal(morse.strip({ digits: true }).length, 36);
});

test("caesar: shifting, wrap-around, and both directions agree with the key", () => {
  assert.equal(shiftLetter("Q", 7), "X");
  assert.equal(shiftLetter("X", -7), "Q");
  assert.equal(shiftLetter("Z", 1), "A");
  assert.equal(shiftLetter("A", -1), "Z");
  assert.equal(shiftLetter("a", 26), "A");
  assert.throws(() => shiftLetter("1", 3));
  const [enc, dec] = caesarDirections({ n: 5 });
  assert.equal(enc.run.length, 5); assert.equal(enc.run.size, 25);
  assert.deepEqual(enc.run.context(0), { key: 1 }); assert.deepEqual(enc.run.context(24), { key: 25 });
  for (let k = 1; k <= 25; k++) {
    for (let i = 0; i < 26; i++) {
      const e = enc.card(i, { key: k }), d = dec.card(i, { key: k });
      assert.equal(e.shown, ALPHABET[i]);
      assert.equal(e.answer, ALPHABET[(i + k) % 26]);
      assert.equal(d.answer, ALPHABET[(i - k + 26) % 26]);
      assert.equal(shiftLetter(e.answer, -k), e.shown);            // decrypting the cipher gives the plain back
      assert.equal(e.statKey, `+${k}`); assert.equal(d.statKey, `-${k}`);
      assert.equal(e.statShown, `shift +${k}`); assert.equal(d.statShown, `shift −${k}`);
      assert.equal(e.statAnswer, "");
    }
  }
  assert.equal(enc.run.label({ key: 7 }), "7");
  assert.equal(enc.run.hint({ key: 7 }), "A → H");
  const [encL] = caesarDirections({ n: 3, keyAs: "letter" });
  assert.equal(encL.run.label({ key: 7 }), "H");
  assert.equal(encL.run.hint({ key: 7 }), "A → H · shift 7");
  assert.equal(encL.run.length, 3);
  assert.equal(enc.sr(enc.card(16, { key: 7 })), "Key 7. Encrypt the letter Q.");
  assert.equal(enc.normalize("x1"), "X");
});

test("caesar: N is clamped and the extras round-trip", () => {
  assert.equal(clampN(0), 1); assert.equal(clampN(500), 99); assert.equal(clampN("abc"), 5); assert.equal(clampN(7.4), 7);
  assert.equal(caesarDirections({ n: 1000 })[0].run.length, 99);
  const s = { n: 5, keyAs: "number" };
  caesar.sanitizeExtras(s); assert.deepEqual(s, { n: 5, keyAs: "number" });
  const bad = { n: -3, keyAs: "weird" };
  caesar.sanitizeExtras(bad); assert.deepEqual(bad, { n: 1, keyAs: "number" });
  const q = new URLSearchParams("n=10&key=letter"); const u = { n: 5, keyAs: "number" };
  caesar.urlExtras(q, u); assert.deepEqual(u, { n: 10, keyAs: "letter" });
  assert.equal(caesar.extrasKey({ n: 5, keyAs: "number" }), "n5:number");
  assert.equal(caesar.extrasLabel({ n: 5, keyAs: "letter" }), "5 per key, key as letter");
  assert.equal(caesar.urlQuery({ n: 3, keyAs: "number" }), "n=3&key=number");
  assert.equal(caesar.strip({}).length, 26);
  assert.deepEqual(caesar.strip({})[25], { top: "Z", bottom: "25" });
});
