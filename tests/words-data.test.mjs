/* Validates the committed word-pool data in assets/data/words (built by tools/build-words.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { WordIndex, signature, MIN_LENGTH, MAX_LENGTH } from "../assets/js/words.js";

const DIR = new URL("../assets/data/words/", import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, DIR), "utf8"));

test("manifest and one file per length exist and agree", () => {
  assert.ok(existsSync(new URL("index.json", DIR)), "run `node tools/build-words.mjs` to build the word pool");
  const manifest = read("index.json");
  assert.equal(manifest.minLength, MIN_LENGTH);
  assert.equal(manifest.maxLength, MAX_LENGTH);
  for (let L = MIN_LENGTH; L <= MAX_LENGTH; L++) {
    const data = read(`${L}.json`);
    assert.equal(data.length, L);
    const words = data.words.split(" ");
    assert.equal(words.length, manifest.lengths[L].words, `manifest count for ${L}`);
    assert.equal(data.tiers.length, words.length, `one tier digit per word (${L})`);
  }
  assert.ok(manifest.total >= 30000, `pool is large (${manifest.total})`);
});

test("every pool word is clean, unique, lowercase a–z, of the stated length; extras are real anagrams", () => {
  const idx = new WordIndex();
  for (let L = MIN_LENGTH; L <= MAX_LENGTH; L++) {
    const data = read(`${L}.json`);
    const words = data.words.split(" ");
    const extra = data.extra ? data.extra.split(" ") : [];
    assert.equal(new Set(words).size, words.length, `no duplicate pool words (${L})`);
    assert.equal(new Set(extra).size, extra.length, `no duplicate extras (${L})`);
    for (const w of words) assert.match(w, new RegExp(`^[a-z]{${L}}$`), `${w} (${L})`);
    for (const w of extra) assert.match(w, new RegExp(`^[a-z]{${L}}$`), `${w} extra (${L})`);
    const pool = new Set(words);
    for (const w of extra) assert.ok(!pool.has(w), `${w} is both pool and extra`);
    assert.match(data.tiers, /^[1-9]+$/);
    // tiers are non-decreasing: the list is most-common-first
    for (let i = 1; i < data.tiers.length; i++) assert.ok(data.tiers[i] >= data.tiers[i - 1], `tiers sorted at ${L}:${i}`);
    idx.add(data);
    const sigs = new Set(words.map(signature));
    for (const w of extra) assert.ok(sigs.has(signature(w)), `extra ${w} must be an anagram of a pool word`);
  }
  // spot checks: everyday words with their plurals and conjugations are in, and anagram lookups work
  for (const w of ["drops", "running", "cats", "stale", "least", "house", "quickly", "temperature"]) assert.ok(idx.isWord(w), w);
  const five = idx.anagrams("stale");
  assert.ok(five.includes("stale") && five.includes("least") && five.includes("steal"), five.join(","));
  assert.ok(idx.anagramGroups(5, { minSize: 2 }).length > 300, "plenty of multi-anagram five-letter sets");
  assert.ok(idx.count(5) >= 3500 && idx.count(7) >= 5000 && idx.count(12) >= 800, "pool sizes per length");
  assert.deepEqual(idx.byPattern("ABCCD", 5).slice(0, 2).map((w) => w.length), [5, 5]);
});
