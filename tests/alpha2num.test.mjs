import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALPHABET, KINDS, letterToNumber, numberToLetter, shuffle, Deck,
  makePrompt, normalizeTyped, judge, directionLabel, Round,
} from "../alpha2num/engine.js";

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

test("letter <-> number, base 0 and base 1", () => {
  assert.equal(letterToNumber("A"), 0);
  assert.equal(letterToNumber("z"), 25);
  assert.equal(letterToNumber("Q", 1), 17);
  assert.equal(numberToLetter(0), "A");
  assert.equal(numberToLetter(25), "Z");
  assert.equal(numberToLetter(26, 1), "Z");
  assert.equal(numberToLetter(1, 1), "A");
  for (let i = 0; i < 26; i++) assert.equal(numberToLetter(letterToNumber(ALPHABET[i])), ALPHABET[i]);
  assert.throws(() => letterToNumber("1"));
  assert.throws(() => numberToLetter(26));
  assert.throws(() => numberToLetter(0, 1));
  assert.throws(() => numberToLetter(1.5));
});

test("shuffle is a permutation and leaves the input alone", () => {
  const src = [...Array(26).keys()];
  const out = shuffle(src, seeded(1));
  assert.deepEqual(src, [...Array(26).keys()]);
  assert.deepEqual([...out].sort((a, b) => a - b), src);
});

test("deck deals every card once per cycle and never repeats across a reshuffle", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const d = new Deck(seeded(seed));
    const draws = Array.from({ length: 26 * 8 }, () => d.draw());
    for (let c = 0; c < 8; c++) {
      const cycle = draws.slice(c * 26, c * 26 + 26).sort((a, b) => a - b);
      assert.deepEqual(cycle, [...Array(26).keys()], `seed ${seed} cycle ${c}`);
    }
    for (let i = 1; i < draws.length; i++) assert.notEqual(draws[i], draws[i - 1], `seed ${seed} repeat at ${i}`);
  }
});

test("makePrompt builds both directions with the right base", () => {
  assert.deepEqual(makePrompt(KINDS.A2N, 16), { kind: "a2n", index: 16, shown: "Q", answer: "16" });
  assert.deepEqual(makePrompt(KINDS.N2A, 16), { kind: "n2a", index: 16, shown: "16", answer: "Q" });
  assert.deepEqual(makePrompt(KINDS.A2N, 0, 1), { kind: "a2n", index: 0, shown: "A", answer: "1" });
  assert.deepEqual(makePrompt(KINDS.N2A, 25, 1), { kind: "n2a", index: 25, shown: "26", answer: "Z" });
  assert.throws(() => makePrompt("x", 0));
  assert.throws(() => makePrompt(KINDS.A2N, 26));
});

test("normalizeTyped strips what the direction cannot use", () => {
  assert.equal(normalizeTyped(KINDS.A2N, "1a2 "), "12");
  assert.equal(normalizeTyped(KINDS.N2A, "q1"), "Q");
  assert.equal(normalizeTyped(KINDS.N2A, " é "), "");
  assert.equal(normalizeTyped(KINDS.A2N, null), "");
});

test("judge: exact, prefix, and impossible answers", () => {
  assert.equal(judge("11", ""), "pending");
  assert.equal(judge("11", "1"), "pending");
  assert.equal(judge("11", "11"), "correct");
  assert.equal(judge("11", "12"), "wrong");
  assert.equal(judge("11", "2"), "wrong");
  assert.equal(judge("1", "1"), "correct");        // B is done the moment you type 1
  assert.equal(judge("0", "0"), "correct");
  assert.equal(judge("5", "0"), "wrong");          // no leading zeros
  assert.equal(judge("Q", "Q"), "correct");
  assert.equal(judge("Q", "R"), "wrong");
});

test("directionLabel", () => {
  assert.equal(directionLabel(true, true), "both");
  assert.equal(directionLabel(true, false), "a2n");
  assert.equal(directionLabel(false, true), "n2a");
  assert.throws(() => directionLabel(false, false));
});

test("Round refuses to start with no direction or a bad base", () => {
  assert.throws(() => new Round({ a2n: false, n2a: false }));
  assert.throws(() => new Round({ base: 2 }));
  assert.throws(() => new Round().submit("A"));
});

test("Round: single-direction rounds only deal that direction", () => {
  const r = new Round({ a2n: true, n2a: false, rng: seeded(3) });
  for (let i = 0; i < 60; i++) assert.equal(r.next(i).kind, "a2n");
  const r2 = new Round({ a2n: false, n2a: true, rng: seeded(3) });
  for (let i = 0; i < 60; i++) assert.equal(r2.next(i).kind, "n2a");
});

test("Round: mixed rounds deal both directions", () => {
  const r = new Round({ rng: seeded(7) });
  const kinds = new Set();
  for (let i = 0; i < 40; i++) kinds.add(r.next(i).kind);
  assert.deepEqual([...kinds].sort(), ["a2n", "n2a"]);
});

test("Round: scoring, misses, streaks, timing", () => {
  const r = new Round({ a2n: true, n2a: false, rng: seeded(11) });
  let t = 1000;

  // three clean answers, 500ms each
  for (let i = 0; i < 3; i++) {
    const p = r.next(t);
    t += 500;
    assert.equal(r.submit(p.answer, t), "correct");
  }
  assert.equal(r.score, 3);
  assert.equal(r.streak, 3);
  assert.equal(r.bestStreak, 3);

  // a miss, then the right answer (typed partially first if two digits)
  const p = r.next(t);
  const wrong = p.answer === "9" ? "8" : "9";
  assert.equal(r.submit(wrong, t + 100), "wrong");
  assert.equal(r.misses, 1);
  assert.equal(r.streak, 0);
  if (p.answer.length === 2) assert.equal(r.submit(p.answer[0], t + 200), "pending");
  assert.equal(r.submit(p.answer, t + 300), "correct");
  assert.equal(r.score, 4);
  assert.equal(r.streak, 1);
  assert.equal(r.bestStreak, 3);
  assert.equal(r.revealed, 0);

  const s = r.summary({ durationSec: 60 });
  assert.equal(s.score, 4);
  assert.equal(s.answered, 4);
  assert.equal(s.misses, 1);
  assert.equal(s.accuracy, 4 / 5);
  assert.equal(s.avgMs, (500 * 3 + 300) / 4);
  assert.equal(s.bestStreak, 3);
  assert.equal(s.directions, "a2n");
  assert.equal(s.endedEarly, false);
  // the missed letter shows up in the weak-spot list
  assert.ok(s.trouble.some((x) => x.index === p.index && x.misses === 1));
});

test("Round: Enter commits a partial answer as wrong", () => {
  const r = new Round({ a2n: true, n2a: false, rng: seeded(5) });
  let p;
  do { p = r.next(0); } while (p.answer.length !== 2);   // find a two-digit letter
  assert.equal(r.submit(p.answer[0], 0), "pending");
  assert.equal(r.submit(p.answer[0], 0, { commit: true }), "wrong");
  assert.equal(r.misses, 1);
  assert.equal(r.submit("", 0, { commit: true }), "pending");  // empty Enter is a no-op
  assert.equal(r.misses, 1);
});

test("Round: reveal after three misses; a revealed answer moves on but does not score", () => {
  const r = new Round({ a2n: false, n2a: true, rng: seeded(9) });
  const p = r.next(0);
  const wrongLetter = p.answer === "A" ? "B" : "A";
  assert.equal(r.isRevealed, false);
  r.submit(wrongLetter, 10);
  r.submit(wrongLetter, 20);
  assert.equal(r.isRevealed, false);
  r.submit(wrongLetter, 30);
  assert.equal(r.isRevealed, true);
  assert.equal(r.revealed, 1);
  assert.equal(r.submit(p.answer, 40), "correct");
  assert.equal(r.score, 0);
  assert.equal(r.answered, 1);
  assert.equal(r.misses, 3);
  const s = r.summary({ durationSec: 30 });
  assert.equal(s.accuracy, 0);
  assert.equal(s.avgMs, null);
  assert.equal(s.trouble[0].index, p.index);
  assert.equal(s.trouble[0].revealed, 1);
});

test("Round: base 1 answers", () => {
  const r = new Round({ base: 1, rng: seeded(2) });
  for (let i = 0; i < 52; i++) {
    const p = r.next(i);
    if (p.kind === "a2n") assert.equal(Number(p.answer), p.index + 1);
    else assert.equal(Number(p.shown), p.index + 1);
    assert.equal(r.submit(p.answer, i), "correct");
  }
  assert.equal(r.score, 52);
});

test("Round: weak-spot list is capped and ordered by severity", () => {
  const r = new Round({ a2n: true, n2a: false, rng: seeded(13), revealAfter: 0 });
  // miss letter i exactly i times for the first 8 prompts
  for (let i = 0; i < 8; i++) {
    const p = r.next(0);
    for (let m = 0; m < i; m++) r.submit(p.answer === "0" ? "9" : "0", 0);
    r.submit(p.answer, 100);
  }
  const s = r.summary({ durationSec: 60 });
  assert.equal(s.revealed, 0);
  assert.ok(s.trouble.length <= 6);
  for (let i = 1; i < s.trouble.length; i++) assert.ok(s.trouble[i - 1].weight >= s.trouble[i].weight);
  assert.equal(s.trouble[0].misses, 7);
});
