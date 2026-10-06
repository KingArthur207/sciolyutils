import { test } from "node:test";
import assert from "node:assert/strict";
import { signature, pattern, scramble, WordIndex, MIN_LENGTH, MAX_LENGTH } from "../assets/js/words.js";

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const fixture5 = {
  length: 5,
  words: "least steal stale slate tales hello drops jolly about world",
  tiers: "1122233114",
  extra: "setal stela taels teals",
};
const fixture4 = { length: 4, words: "stop pots tops spot post opts", tiers: "111122", extra: "" };

test("signature and pattern", () => {
  assert.equal(signature("stale"), "AELST");
  assert.equal(signature("Least"), "AELST");
  assert.equal(pattern("hello"), "ABCCD");
  assert.equal(pattern("jolly"), "ABCCD");
  assert.equal(pattern("stale"), "ABCDE");
  assert.equal(pattern("banana"), "ABCBCB");
  assert.equal(pattern("MISSISSIPPI"), "ABCCBCCBDDB");
  assert.equal(pattern(""), "");
});

test("scramble keeps the letters and avoids the originals when it can", () => {
  const rng = seeded(3);
  for (let i = 0; i < 50; i++) {
    const s = scramble("stale", rng, ["least", "steal", "slate", "tales"]);
    assert.equal(signature(s), "AELST");
    assert.ok(!["STALE", "LEAST", "STEAL", "SLATE", "TALES"].includes(s), s);
  }
  assert.equal(scramble("aaa", rng), "AAA");          // impossible to change: returns the letters anyway
});

test("WordIndex: anagrams, extras, patterns, counts", () => {
  const idx = new WordIndex();
  idx.add(fixture5); idx.add(fixture4);
  assert.ok(idx.has(5) && idx.has(4) && !idx.has(6));
  assert.equal(idx.count(5), 10);
  assert.deepEqual(idx.anagrams("stale"), ["least", "steal", "stale", "slate", "tales"]);
  assert.deepEqual(idx.anagrams("AELST"), ["least", "steal", "stale", "slate", "tales"]);
  assert.deepEqual(idx.anagrams("tsop"), ["stop", "pots", "tops", "spot", "post", "opts"]);
  assert.deepEqual(idx.anagrams("zzzzz"), []);
  assert.deepEqual(idx.anagrams("abc"), []);                        // length not loaded -> empty, no throw
  assert.deepEqual(idx.extraAnagrams("stale"), ["setal", "stela", "taels", "teals"]);
  assert.ok(idx.isWord("Hello") && !idx.isWord("teals") && idx.isExtraWord("teals") && !idx.isExtraWord("hello"));
  assert.deepEqual(idx.byPattern("ABCCD", 5), ["hello", "jolly"]);
  assert.deepEqual(idx.byPattern("abccd"), ["hello", "jolly"]);
  assert.deepEqual(idx.byPattern("AAAAA", 5), []);
  assert.throws(() => idx.byPattern("ABC", 3));
  assert.equal(idx.anagramGroups(5, { minSize: 2 }).length, 1);
  assert.equal(idx.anagramGroups(5).length, 6);
  assert.deepEqual(idx.words(5, { maxTier: 1 }), ["least", "steal", "jolly", "about"]);
  assert.equal(idx.words(5).length, 10);
});

test("WordIndex: sampling respects skip and bias", () => {
  const idx = new WordIndex(); idx.add(fixture5);
  const rng = seeded(9);
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(idx.sample(5, { rng }));
  assert.equal(seen.size, 10);                                        // every word reachable
  const used = new Set(["least", "steal", "stale", "slate", "tales", "hello", "drops", "jolly", "about"]);
  for (let i = 0; i < 20; i++) assert.equal(idx.sample(5, { rng, skip: (w) => used.has(w) }), "world");
  assert.equal(idx.sample(5, { rng, skip: () => true }), null);
  // bias > 1 favours the front of the (most-common-first) list
  const front = { biased: 0, uniform: 0 };
  const r1 = seeded(5), r2 = seeded(5);
  for (let i = 0; i < 2000; i++) {
    if (idx.words(5).indexOf(idx.sample(5, { rng: r1, bias: 2 })) < 3) front.biased++;
    if (idx.words(5).indexOf(idx.sample(5, { rng: r2, bias: 1 })) < 3) front.uniform++;
  }
  assert.ok(front.biased > front.uniform * 1.3, JSON.stringify(front));
});

test("WordIndex: load fetches each length once and ignores out-of-range lengths", async () => {
  const calls = [];
  const idx = new WordIndex({ base: "/x", fetcher: async (url) => { calls.push(url); return url.endsWith("/5.json") ? fixture5 : fixture4; } });
  await Promise.all([idx.load([5, 4, 5, 2, 99]), idx.load([5])]);
  assert.deepEqual(calls.sort(), ["/x/4.json", "/x/5.json"]);
  await idx.load([4, 5]);
  assert.equal(calls.length, 2);
  assert.equal(MIN_LENGTH, 3); assert.equal(MAX_LENGTH, 12);
  const bad = new WordIndex({ fetcher: async () => { throw new Error("offline"); } });
  await assert.rejects(() => bad.load([5]), /offline/);
  assert.ok(!bad.has(5));
});
