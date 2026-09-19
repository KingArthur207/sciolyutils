import { test } from "node:test";
import assert from "node:assert/strict";
import { ALPHABET, judge, Round } from "../assets/js/drill-engine.js";
import { spec as alpha, alphaDirections } from "../alpha2num/spec.js";
import { spec as bacon, baconCode, baconTable, baconDirections, ALPHA24 } from "../baconian/spec.js";
import { spec as morse, MORSE, pretty, normalizeMorse, spell, morseDirections } from "../morse/spec.js";

/* every spec must produce two directions with well-formed cards and round-trip through the engine */
for (const [name, s, settings] of [
  ["alpha2num", alpha, { base: 0 }], ["alpha2num base 1", alpha, { base: 1 }],
  ["baconian 24", bacon, { alpha: 24 }], ["baconian 26", bacon, { alpha: 26 }],
  ["morse", morse, { digits: false }], ["morse + digits", morse, { digits: true }],
]) {
  test(`${name}: directions are well-formed and playable`, () => {
    const dirs = s.directions(settings);
    assert.equal(dirs.length, 2);
    for (const d of dirs) {
      assert.ok(d.id && d.label && typeof d.normalize === "function");
      const keys = new Set(d.cards.map((c) => c.key));
      assert.equal(keys.size, d.cards.length, `${d.id} keys unique`);
      for (const c of d.cards) {
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
