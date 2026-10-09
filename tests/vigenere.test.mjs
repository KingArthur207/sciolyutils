import { test } from "node:test";
import assert from "node:assert/strict";
import { ALPHABET, Round } from "../assets/js/drill-engine.js";
import { spec, KEYWORDS, KEYWORD_PASSES, num, encrypt, decrypt, steps, numbersHint, vigenereDirections, tabulaRectaHTML } from "../vigenere/spec.js";

test("vigenère maths: A = 0, encrypt and decrypt are inverses for every pair", () => {
  assert.equal(num("A"), 0); assert.equal(num("Z"), 25); assert.equal(num("e"), 4);
  assert.equal(decrypt("R", "E"), "N"); assert.equal(encrypt("N", "E"), "R");
  assert.equal(decrypt("B", "E"), "X");                 // 1 − 4 = −3 → 23
  assert.equal(encrypt("W", "E"), "A");                 // 22 + 4 = 26 → 0
  for (const p of ALPHABET) for (const k of ALPHABET) {
    assert.equal(decrypt(encrypt(p, k), k), p);
    assert.equal(num(encrypt(p, k)), (num(p) + num(k)) % 26);
  }
});

test("steps writes the equation with the result left open; numbersHint gives both numbers", () => {
  assert.equal(steps("R", "E", -1), "R 17 − E 4 = ?");
  assert.equal(steps("B", "E", -1), "B 1 − E 4 = ?");
  assert.equal(steps("N", "E", 1), "N 13 + E 4 = ?");
  assert.equal(steps("W", "E", 1), "W 22 + E 4 = ?");
  assert.equal(numbersHint("R", "E"), "R = 17 · E = 4");
  for (const a of ALPHABET) for (const k of ALPHABET) assert.ok(!/= \d/.test(steps(a, k, -1)), "never shows the answer");
});

test("random-key mode: one key per prompt, cards carry the key, weak spots group by key", () => {
  const [dec, enc] = vigenereDirections({ key: "letter", help: "none" });
  assert.equal(dec.run.length, 1); assert.equal(dec.run.size, 26);
  for (let k = 0; k < 26; k++) {
    const ctx = dec.run.context(k);
    assert.equal(dec.run.label(ctx), ALPHABET[k]);
    for (let i = 0; i < 26; i++) {
      const c = dec.card(i, ctx);
      assert.equal(c.shown, ALPHABET[i]);
      assert.equal(c.answer, decrypt(ALPHABET[i], ALPHABET[k]));
      assert.equal(c.statKey, ALPHABET[k]); assert.equal(c.statShown, `key ${ALPHABET[k]}`); assert.equal(c.statAnswer, "");
      assert.deepEqual(c.context, { key: ALPHABET[k], shown: ALPHABET[i], sign: -1 });
      const e = enc.card(i, enc.run.context(k));
      assert.equal(e.answer, encrypt(ALPHABET[i], ALPHABET[k]));
    }
    assert.equal(dec.run.hint(ctx), "");                  // random key: nothing in the banner but the key
    assert.equal(dec.hintFor(dec.card(17, ctx)), "");     // no help: no hint bubble
  }
  assert.match(dec.sr(dec.card(17, dec.run.context(4))), /^Key E\. Decrypt the cipher letter R\.$/);
});

test("help levels live in the hint bubble, never in the key banner, and never give the result", () => {
  const [decN] = vigenereDirections({ key: "letter", help: "numbers" });
  const ctx = decN.run.context(4); const card = decN.card(17, ctx);
  assert.equal(decN.run.hint(ctx), "");
  assert.equal(decN.hintFor(card), "R = 17 · E = 4");
  const [decS, encS] = vigenereDirections({ key: "letter", help: "steps" });
  const c2 = decS.run.context(4); const b = decS.card(1, c2);
  assert.equal(decS.run.hint(c2), "");
  assert.equal(decS.hintFor(b), "B 1 − E 4 = ?   (under 0? +26)");
  const c3 = encS.run.context(4); const w = encS.card(22, c3);
  assert.equal(encS.hintFor(w), "W 22 + E 4 = ?   (over 25? −26)");
  assert.ok(!decS.hintFor(b).includes("23") && !encS.hintFor(w).includes(" 0"));
});

test("keyword mode: five-letter keywords cycle over ten prompts", () => {
  assert.ok(KEYWORDS.length >= 30);
  assert.equal(new Set(KEYWORDS).size, KEYWORDS.length);
  for (const w of KEYWORDS) assert.match(w, /^[A-Z]{5}$/, w);
  const [dec] = vigenereDirections({ key: "word", help: "none" });
  assert.equal(dec.run.length, KEYWORD_PASSES * 5); assert.equal(dec.run.size, KEYWORDS.length);
  const ctx = dec.run.context(0);
  const keys = [];
  for (let i = 0; i < 10; i++) { const c = dec.card(i, ctx); keys.push(c.context.key); assert.equal(c.answer, decrypt(ALPHABET[i], c.context.key)); }
  assert.equal(keys.join(""), KEYWORDS[0] + KEYWORDS[0]);
  assert.equal(dec.run.label(ctx), KEYWORDS[0][4]);
  assert.equal(dec.run.hint(ctx), `${KEYWORDS[0]} · 5/5`);
  const [decN] = vigenereDirections({ key: "word", help: "numbers" });
  const c2 = decN.run.context(1); const first = decN.card(0, c2);
  assert.equal(decN.run.hint(c2), `${KEYWORDS[1]} · 1/5`);
  assert.equal(decN.hintFor(first), `A = 0 · ${KEYWORDS[1][0]} = ${num(KEYWORDS[1][0])}`);
});

test("a full round in both directions and both key modes", () => {
  for (const key of ["letter", "word"]) {
    const r = new Round({ directions: vigenereDirections({ key }) });
    for (let i = 0; i < 80; i++) { const { card } = r.next(i); assert.equal(r.submit(card.answer, i), "correct"); }
    assert.equal(r.score, 80);
  }
});

test("spec extras and the Vigenère table", () => {
  assert.equal(spec.defaults.dirB, false);
  const s = { key: "x", help: "y" }; spec.sanitizeExtras(s); assert.deepEqual(s, { key: "letter", help: "none" });
  const u = { key: "letter", help: "none" }; spec.urlExtras(new URLSearchParams("key=word&help=steps"), u); assert.deepEqual(u, { key: "word", help: "steps" });
  assert.equal(spec.extrasKey({ key: "word", help: "numbers" }), "word:numbers");
  assert.equal(spec.extrasLabel({ key: "letter", help: "none" }), "random key, no help");
  assert.deepEqual(spec.scrollOnStart({ strip: true }), { selector: "#stage", block: "end" });
  assert.equal(spec.scrollOnStart({ strip: false }), null);
  assert.equal(spec.urlQuery({ key: "word", help: "steps" }), "key=word&help=steps");
  const html = tabulaRectaHTML();
  assert.equal((html.match(/<td>/g) || []).length, 676);
  assert.equal((html.match(/<tr>/g) || []).length, 27);
  // row K (index 10) starts with K and reads K L M … J
  const rowK = html.split("<tr><th>K</th>")[1].split("</tr>")[0].match(/<td>(\w)<\/td>/g).map((x) => x[4]).join("");
  assert.equal(rowK, ALPHABET.slice(10) + ALPHABET.slice(0, 10));
  assert.equal(spec.renderStrip(), html);
  assert.equal(spec.strip, undefined);
});
