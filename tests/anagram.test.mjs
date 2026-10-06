import { test } from "node:test";
import assert from "node:assert/strict";
import { rackUse, lettersOnly, AnagramRound } from "../anagram/engine.js";

const dealer = (sets) => { let i = 0; return () => sets[i++ % sets.length]; };
const AELST = { letters: "TLSAE", answers: ["least", "steal", "stale", "slate", "tales"], extra: ["teals", "stela"] };
const HELLO = { letters: "LOHEL", answers: ["hello"], extra: [] };

test("rackUse marks tiles greedily and flags letters the rack lacks", () => {
  assert.deepEqual(rackUse("TLSAE", ""), { ok: true, used: [false, false, false, false, false] });
  assert.deepEqual(rackUse("TLSAE", "st"), { ok: true, used: [true, false, true, false, false] });
  assert.deepEqual(rackUse("TLSAE", "stx").ok, false);
  assert.deepEqual(rackUse("HELLO", "ll").used, [false, false, true, true, false]);
  assert.equal(rackUse("HELLO", "lll").ok, false);
  assert.equal(lettersOnly(" st-a 1le "), "STALE");
});

test("AnagramRound: finding every word completes a set; repeats and bonuses behave", () => {
  const r = new AnagramRound({ deal: dealer([AELST, HELLO]) });
  const set = r.next(0);
  assert.equal(set.target, 5);
  assert.equal(r.submit("s", 10), "pending");
  assert.equal(r.submit("sta", 20), "pending");
  assert.equal(r.submit("stale", 1000), "found");
  assert.equal(r.score, 1); assert.equal(r.wordsFound, 1);
  assert.equal(r.submit("stale", 1100), "repeat");            // no miss for a repeat
  assert.equal(r.misses, 0);
  assert.equal(r.submit("teals", 1500), "bonus");
  assert.equal(r.score, 2); assert.equal(r.bonus, 1);
  assert.equal(r.submit("teals", 1600), "repeat");
  assert.equal(r.submit("setal", 1700), "wrong");             // not in answers or extra
  assert.equal(r.misses, 1); assert.equal(r.streak, 0);
  assert.equal(r.submit("stx", 1800), "wrong");               // X is not on the rack: wrong at once
  assert.equal(r.misses, 2);
  assert.equal(r.submit("ss", 1900), "wrong");                // only one S on the rack
  assert.equal(r.misses, 3);
  for (const w of ["least", "steal", "slate"]) assert.equal(r.submit(w, 2000), "found");
  assert.equal(r.submit("tales", 3000), "complete");
  assert.equal(r.setsDone, 1); assert.equal(r.over, true);
  assert.equal(r.submit("stale", 3100), "pending");           // set is over until next()
  assert.equal(r.wordsFound, 5); assert.equal(r.score, 6);
  assert.equal(r.bestStreak, 4);                              // teals? no: stale(1) then miss, then 4 in a row
  const h = r.history[0];
  assert.deepEqual(h.found, ["STALE", "LEAST", "STEAL", "SLATE", "TALES"]);
  assert.deepEqual(h.bonus, ["TEALS"]); assert.deepEqual(h.missed, []); assert.equal(h.skipped, false); assert.equal(h.misses, 3);
});

test("AnagramRound: skip records the missed words and shows up in weak spots", () => {
  const r = new AnagramRound({ deal: dealer([AELST, HELLO]) });
  r.next(0);
  assert.equal(r.submit("slate", 500), "found");
  assert.equal(r.streak, 1);
  assert.deepEqual(r.skip(900), ["LEAST", "STEAL", "STALE", "TALES"]);
  assert.equal(r.setsSkipped, 1); assert.equal(r.streak, 0); assert.equal(r.over, true);
  assert.deepEqual(r.skip(950), []);                            // skipping twice is a no-op
  r.next(1000);
  assert.equal(r.submit("hello", 1400), "complete");
  const s = r.summary({ durationSec: 60 });
  assert.equal(s.score, 2); assert.equal(s.setsDone, 1); assert.equal(s.setsSkipped, 1);
  assert.equal(s.misses, 0); assert.equal(s.accuracy, 1);
  assert.equal(s.avgMs, (500 + 400) / 2);
  assert.equal(s.trouble.length, 1);
  assert.equal(s.trouble[0].letters, "TLSAE");
  assert.deepEqual(s.trouble[0].missed, ["LEAST", "STEAL", "STALE", "TALES"]);
});

test("AnagramRound: timing counts from the set or the previous word, and guards", () => {
  assert.throws(() => new AnagramRound({}));
  const r = new AnagramRound({ deal: dealer([HELLO]) });
  assert.throws(() => r.submit("hello"));
  assert.deepEqual(r.skip(), []);
  r.next(100);
  assert.equal(r.submit("hello", 700), "complete");
  r.next(1000);
  assert.equal(r.submit("hello", 1200), "complete");
  assert.equal(r.summary().avgMs, (600 + 200) / 2);
  assert.equal(r.summary().accuracy, 1);
  const bad = new AnagramRound({ deal: () => ({ letters: "", answers: [] }) });
  assert.throws(() => bad.next());
});
