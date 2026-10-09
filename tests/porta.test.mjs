import { test } from "node:test";
import assert from "node:assert/strict";
import { ALPHABET, Round } from "../assets/js/drill-engine.js";
import { spec, KEYWORDS, KEYWORD_PASSES, num, row, pairOf, half, halfIndex, porta, numbersHint, steps, portaDirections, portaTableHTML } from "../porta/spec.js";
import { KEYWORDS as SHARED } from "../assets/js/keywords.js";

/* the toebes test generator's mapping, verbatim */
const toebes = (pt, key) => {
  const keyval = key.charCodeAt(0) - 65, ptval = pt.charCodeAt(0) - 65;
  const ctval = ptval < 13 ? ((Math.floor(keyval / 2) + ptval) % 13) + 13 : (13 - Math.floor(keyval / 2) + ptval) % 13;
  return String.fromCharCode(65 + ctval);
};

test("porta matches the Codebusters generator for every letter and key, and is its own inverse", () => {
  for (const L of ALPHABET) for (const K of ALPHABET) {
    assert.equal(porta(L, K), toebes(L, K), `${L} ${K}`);
    assert.equal(porta(porta(L, K), K), L, `inverse ${L} ${K}`);
    assert.notEqual(half(L), half(porta(L, K)), "halves always swap");
  }
  assert.equal(porta("R", "E"), "C"); assert.equal(porta("C", "E"), "R");
  assert.equal(porta("A", "A"), "N"); assert.equal(porta("A", "B"), "N"); assert.equal(porta("A", "Y"), "Z");
  assert.equal(porta("N", "Y"), "B");                      // 0 − 12 → +13 → 1 → B
  assert.throws(() => porta("1", "A"));
});

test("rows, pairs, halves, hints", () => {
  assert.equal(row("A"), 0); assert.equal(row("B"), 0); assert.equal(row("E"), 2); assert.equal(row("Z"), 12);
  assert.equal(pairOf("E"), "E,F"); assert.equal(pairOf("Z"), "Y,Z");
  assert.equal(half("M"), "A"); assert.equal(half("N"), "N"); assert.equal(halfIndex("R"), 4); assert.equal(halfIndex("C"), 2);
  assert.equal(numbersHint("R", "E"), "R = N+4 · key E → row 2 (E,F)");
  assert.equal(steps("R", "E"), "R 4 − row 2 = ?");
  assert.equal(steps("C", "E"), "C 2 + row 2 = ?");
  for (const L of ALPHABET) for (const K of ALPHABET) assert.ok(!/= [A-Z0-9]/.test(steps(L, K)), "no answer given");
  assert.equal(num("c"), 2);
});

test("directions: cards, key rows in weak spots, hint bubble per level, keyword cycling", () => {
  const [dec, enc] = portaDirections({ key: "letter", help: "none" });
  assert.equal(dec.run.length, 1); assert.equal(dec.run.size, 26);
  for (let k = 0; k < 26; k++) {
    const ctx = dec.run.context(k);
    assert.equal(dec.run.label(ctx), ALPHABET[k]);
    assert.equal(dec.run.hint(ctx), `row ${pairOf(ALPHABET[k]).replace(",", "·")}`);
    for (let i = 0; i < 26; i++) {
      const c = dec.card(i, ctx);
      assert.equal(c.answer, porta(ALPHABET[i], ALPHABET[k]));
      assert.equal(enc.card(i, enc.run.context(k)).answer, c.answer);     // same move both ways
      assert.equal(c.statKey, pairOf(ALPHABET[k])); assert.equal(c.statAnswer, "");
      assert.equal(dec.hintFor(c), "");
    }
  }
  const [decN] = portaDirections({ help: "numbers" });
  assert.equal(decN.hintFor(decN.card(17, decN.run.context(4))), "R = N+4 · key E → row 2 (E,F)");
  const [decS] = portaDirections({ help: "steps" });
  assert.equal(decS.hintFor(decS.card(17, decS.run.context(4))), "R 4 − row 2 = ?   (count in A–M · under 0? +13)");
  assert.equal(decS.hintFor(decS.card(2, decS.run.context(4))), "C 2 + row 2 = ?   (count in N–Z · over 12? −13)");
  assert.match(dec.sr(dec.card(17, dec.run.context(4))), /^Key E, row E,F\. Decrypt the cipher letter R\.$/);

  assert.equal(KEYWORDS, SHARED);
  const [decW] = portaDirections({ key: "word" });
  assert.equal(decW.run.length, KEYWORD_PASSES * 5);
  const ctx = decW.run.context(0);
  const keys = [];
  for (let i = 0; i < 10; i++) { const c = decW.card(i, ctx); keys.push(c.context.key); assert.equal(c.answer, porta(ALPHABET[i], c.context.key)); }
  assert.equal(keys.join(""), KEYWORDS[0] + KEYWORDS[0]);
  assert.equal(decW.run.hint(ctx), `${KEYWORDS[0]} 5/5 · ${pairOf(KEYWORDS[0][4]).replace(",", "·")}`);
  for (const key of ["letter", "word"]) {
    const r = new Round({ directions: portaDirections({ key }) });
    for (let i = 0; i < 80; i++) { const { card } = r.next(i); assert.equal(r.submit(card.answer, i), "correct"); }
    assert.equal(r.score, 80);
  }
});

test("spec extras and the Porta table", () => {
  assert.equal(spec.defaults.dirB, false);
  const s = { key: "x", help: "y" }; spec.sanitizeExtras(s); assert.deepEqual(s, { key: "letter", help: "none" });
  assert.equal(spec.extrasKey({ key: "word", help: "numbers" }), "word:numbers");
  assert.deepEqual(spec.scrollOnStart({ strip: true }), { selector: "#stage", block: "end" });
  const html = portaTableHTML();
  assert.equal((html.match(/<tr>/g) || []).length, 14);
  assert.equal((html.match(/<td>/g) || []).length, 169);
  const rowEF = html.split("<tr><th>E,F</th>")[1].split("</tr>")[0].match(/<td>(\w)<\/td>/g).map((x) => x[4]).join("");
  assert.equal(rowEF, "PQRSTUVWXYZNO");
  const rowAB = html.split("<tr><th>A,B</th>")[1].split("</tr>")[0].match(/<td>(\w)<\/td>/g).map((x) => x[4]).join("");
  assert.equal(rowAB, "NOPQRSTUVWXYZ");
  assert.equal(spec.renderStrip(), html);
});
