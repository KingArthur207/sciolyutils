import { test } from "node:test";
import assert from "node:assert/strict";
import { ALPHABET, shuffle, Deck, judge, answerLabelOf, Round } from "../assets/js/drill-engine.js";

/* deterministic rng (mulberry32) so deck/round tests are repeatable */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* a tiny letter ↔ number drill, enough to exercise the engine */
const numDir = (base = 0) => ({
  id: "a2n", label: "Letter → number",
  cards: [...ALPHABET].map((L, i) => ({ key: L, shown: L, answer: String(i + base) })),
});
const letDir = () => ({
  id: "n2a", label: "Number → letter",
  cards: [...ALPHABET].map((L, i) => ({ key: L, shown: String(i), answer: L })),
});

test("shuffle is a permutation and leaves the input alone", () => {
  const src = [...Array(26).keys()];
  const out = shuffle(src, seeded(1));
  assert.deepEqual(src, [...Array(26).keys()]);
  assert.deepEqual([...out].sort((a, b) => a - b), src);
});

test("deck deals every card once per cycle and never repeats across a reshuffle", () => {
  for (const size of [24, 26, 36]) {
    for (let seed = 1; seed <= 25; seed++) {
      const d = new Deck({ size, rng: seeded(seed) });
      const draws = Array.from({ length: size * 6 }, () => d.draw());
      for (let c = 0; c < 6; c++) {
        const cycle = draws.slice(c * size, c * size + size).sort((a, b) => a - b);
        assert.deepEqual(cycle, [...Array(size).keys()], `size ${size} seed ${seed} cycle ${c}`);
      }
      for (let i = 1; i < draws.length; i++) assert.notEqual(draws[i], draws[i - 1], `size ${size} seed ${seed} repeat at ${i}`);
    }
  }
  assert.throws(() => new Deck({ size: 0 }));
});

test("judge: exact, prefix, impossible, and multiple accepted answers", () => {
  const eleven = { answer: "11" };
  assert.equal(judge(eleven, ""), "pending");
  assert.equal(judge(eleven, "1"), "pending");
  assert.equal(judge(eleven, "11"), "correct");
  assert.equal(judge(eleven, "12"), "wrong");
  assert.equal(judge(eleven, "2"), "wrong");
  assert.equal(judge({ answer: "1" }, "1"), "correct");     // B is done the moment you type 1
  assert.equal(judge({ answer: "5" }, "0"), "wrong");       // no leading zeros
  const ij = { answer: "I", accept: ["I", "J"] };
  assert.equal(judge(ij, "I"), "correct");
  assert.equal(judge(ij, "J"), "correct");
  assert.equal(judge(ij, "K"), "wrong");
  const code = { answer: "ABBBB" };
  assert.equal(judge(code, "ABB"), "pending");
  assert.equal(judge(code, "ABA"), "wrong");
  assert.equal(judge(code, "ABBBB"), "correct");
});

test("answerLabelOf prefers the card label, then the direction's display", () => {
  assert.equal(answerLabelOf({}, { answer: "16" }), "16");
  assert.equal(answerLabelOf({ display: (m) => m.replace(/\./g, "•") }, { answer: ".." }), "••");
  assert.equal(answerLabelOf({ display: (m) => m }, { answer: "I", answerLabel: "I/J" }), "I/J");
});

test("Round refuses bad setups", () => {
  assert.throws(() => new Round({ directions: [] }));
  assert.throws(() => new Round({ directions: [{ id: "x", cards: [] }] }));
  assert.throws(() => new Round({ directions: [numDir()] }).submit("0"));
});

test("Round: single direction deals only that direction; mixed deals both", () => {
  const r = new Round({ directions: [numDir()], rng: seeded(3) });
  for (let i = 0; i < 60; i++) assert.equal(r.next(i).dir.id, "a2n");
  const r2 = new Round({ directions: [numDir(), letDir()], rng: seeded(7) });
  const ids = new Set();
  for (let i = 0; i < 40; i++) ids.add(r2.next(i).dir.id);
  assert.deepEqual([...ids].sort(), ["a2n", "n2a"]);
});

test("Round: scoring, misses, streaks, timing, weak spots", () => {
  const r = new Round({ directions: [numDir()], rng: seeded(11) });
  let t = 1000;
  for (let i = 0; i < 3; i++) { const { card } = r.next(t); t += 500; assert.equal(r.submit(card.answer, t), "correct"); }
  assert.equal(r.score, 3); assert.equal(r.streak, 3); assert.equal(r.bestStreak, 3);

  const { card } = r.next(t);
  const wrong = card.answer === "9" ? "8" : "9";
  assert.equal(r.submit(wrong, t + 100), "wrong");
  assert.equal(r.misses, 1); assert.equal(r.streak, 0);
  if (card.answer.length === 2) assert.equal(r.submit(card.answer[0], t + 200), "pending");
  assert.equal(r.submit(card.answer, t + 300), "correct");
  assert.equal(r.score, 4); assert.equal(r.streak, 1); assert.equal(r.bestStreak, 3); assert.equal(r.revealed, 0);

  const s = r.summary({ durationSec: 60 });
  assert.equal(s.score, 4); assert.equal(s.answered, 4); assert.equal(s.misses, 1);
  assert.equal(s.accuracy, 4 / 5);
  assert.equal(s.avgMs, (500 * 3 + 300) / 4);
  assert.equal(s.bestStreak, 3);
  assert.deepEqual(s.directions, ["a2n"]);
  assert.equal(s.endedEarly, false);
  assert.ok(s.trouble.some((x) => x.cardKey === card.key && x.misses === 1 && x.shown === card.shown && x.answerLabel === card.answer));
});

test("Round: Enter commits a partial answer as wrong; empty Enter is a no-op", () => {
  const r = new Round({ directions: [numDir()], rng: seeded(5) });
  let card;
  do { ({ card } = r.next(0)); } while (card.answer.length !== 2);
  assert.equal(r.submit(card.answer[0], 0), "pending");
  assert.equal(r.submit(card.answer[0], 0, { commit: true }), "wrong");
  assert.equal(r.misses, 1);
  assert.equal(r.submit("", 0, { commit: true }), "pending");
  assert.equal(r.misses, 1);
});

test("Round: reveal after three misses; a revealed answer moves on but does not score", () => {
  const r = new Round({ directions: [letDir()], rng: seeded(9) });
  const { card } = r.next(0);
  const wrongLetter = card.answer === "A" ? "B" : "A";
  r.submit(wrongLetter, 10); r.submit(wrongLetter, 20);
  assert.equal(r.isRevealed, false);
  r.submit(wrongLetter, 30);
  assert.equal(r.isRevealed, true); assert.equal(r.revealed, 1);
  assert.equal(r.submit(card.answer, 40), "correct");
  assert.equal(r.score, 0); assert.equal(r.answered, 1); assert.equal(r.misses, 3);
  const s = r.summary({ durationSec: 30 });
  assert.equal(s.accuracy, 0); assert.equal(s.avgMs, null);
  assert.equal(s.trouble[0].cardKey, card.key); assert.equal(s.trouble[0].revealed, 1);
});

test("Round: accepted alternatives score like the primary answer", () => {
  const dir = { id: "b2l", cards: [{ key: "ABAAA", shown: "ABAAA", answer: "I", accept: ["I", "J"], answerLabel: "I/J" }] };
  const r = new Round({ directions: [dir], rng: seeded(2) });
  r.next(0); assert.equal(r.submit("J", 10), "correct");
  r.next(20); assert.equal(r.submit("I", 30), "correct");
  assert.equal(r.score, 2);
});

test("Round: weak-spot list is capped and ordered by severity", () => {
  const r = new Round({ directions: [numDir()], rng: seeded(13), revealAfter: 0 });
  for (let i = 0; i < 8; i++) {
    const { card } = r.next(0);
    for (let m = 0; m < i; m++) r.submit(card.answer === "0" ? "9" : "0", 0);
    r.submit(card.answer, 100);
  }
  const s = r.summary({ durationSec: 60 });
  assert.equal(s.revealed, 0);
  assert.ok(s.trouble.length <= 6);
  for (let i = 1; i < s.trouble.length; i++) assert.ok(s.trouble[i - 1].weight >= s.trouble[i].weight);
  assert.equal(s.trouble[0].misses, 7);
});
