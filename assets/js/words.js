/* =========================================================================
   words.js — the shared English word pool and its indexes.
   Data lives in /assets/data/words/<length>.json (built by tools/build-words.mjs):
     { length, words: "space separated, most common first", tiers: "digits per word",
       extra: "rarer dictionary words that are anagrams of a pool word" }
   This module loads only the lengths an applet asks for, then answers:
     • words by length (optionally only the commonest tiers)
     • anagrams: every pool word with the same letters (plus "extra" ones)
     • letter patterns: hello -> ABCCD, and all words of a length with a pattern
   Pure functions (signature, pattern, scramble) are exported for tests.
   ========================================================================= */

export const WORDS_BASE = "/assets/data/words";
export const MIN_LENGTH = 3;
export const MAX_LENGTH = 12;

/** Letters sorted: a key shared by all anagrams of a word. "stale" -> "AELST". */
export const signature = (word) => [...String(word).toUpperCase()].sort().join("");

/** Repetition pattern, letters named in order of first appearance. "hello" -> "ABCCD". */
export function pattern(word) {
  const seen = new Map();
  let out = "";
  for (const ch of String(word).toUpperCase()) {
    if (!seen.has(ch)) seen.set(ch, String.fromCharCode(65 + seen.size));
    out += seen.get(ch);
  }
  return out;
}

/** Fisher–Yates on the letters; retries so the result differs from every string in `avoid`. */
export function scramble(word, rng = Math.random, avoid = []) {
  const letters = [...String(word).toUpperCase()];
  const forbidden = new Set([String(word).toUpperCase(), ...avoid.map((w) => String(w).toUpperCase())]);
  let out = word.toUpperCase();
  for (let attempt = 0; attempt < 30; attempt++) {
    const a = letters.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    out = a.join("");
    if (!forbidden.has(out)) break;
  }
  return out;
}

/** Index for one word length. */
class LengthIndex {
  constructor(data) {
    this.length = data.length;
    this.words = data.words ? data.words.split(" ").filter(Boolean) : [];
    this.tiers = data.tiers || "";
    this.extra = data.extra ? data.extra.split(" ").filter(Boolean) : [];
    this.set = new Set(this.words);
    this.extraSet = new Set(this.extra);
    this.bySig = new Map();
    for (const w of this.words) {
      const s = signature(w);
      const list = this.bySig.get(s);
      if (list) list.push(w); else this.bySig.set(s, [w]);
    }
    this.extraBySig = new Map();
    for (const w of this.extra) {
      const s = signature(w);
      const list = this.extraBySig.get(s);
      if (list) list.push(w); else this.extraBySig.set(s, [w]);
    }
    this._byPattern = null;      // built on first use
  }
  tier(i) { return this.tiers ? Number(this.tiers[i]) || 9 : 9; }
  byPattern(pat) {
    if (!this._byPattern) {
      this._byPattern = new Map();
      this.words.forEach((w) => {
        const p = pattern(w);
        const list = this._byPattern.get(p);
        if (list) list.push(w); else this._byPattern.set(p, [w]);
      });
    }
    return this._byPattern.get(String(pat).toUpperCase()) || [];
  }
}

export class WordIndex {
  constructor({ base = WORDS_BASE, fetcher } = {}) {
    this.base = base;
    this.fetcher = fetcher || ((url) => fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }));
    this.byLen = new Map();
    this.pending = new Map();
  }

  /** Add a length's data directly (tests, or preloaded data). */
  add(data) {
    const idx = new LengthIndex(data);
    this.byLen.set(idx.length, idx);
    return idx;
  }

  has(length) { return this.byLen.has(length); }

  /** Fetch (once) and index every requested length. Resolves when all are ready. */
  async load(lengths) {
    const want = [...new Set(lengths)].filter((L) => L >= MIN_LENGTH && L <= MAX_LENGTH && !this.byLen.has(L));
    await Promise.all(want.map((L) => {
      if (!this.pending.has(L)) {
        const p = this.fetcher(`${this.base}/${L}.json`).then((data) => { this.add(data); this.pending.delete(L); });
        p.catch(() => this.pending.delete(L));
        this.pending.set(L, p);
      }
      return this.pending.get(L);
    }));
    return this;
  }

  _idx(length) {
    const idx = this.byLen.get(length);
    if (!idx) throw new Error(`length ${length} is not loaded`);
    return idx;
  }

  /** Pool words of a length, most common first. `maxTier` keeps only the commonest tiers (1 = most common). */
  words(length, { maxTier = 9 } = {}) {
    const idx = this._idx(length);
    if (maxTier >= 9) return idx.words;
    return idx.words.filter((_, i) => idx.tier(i) <= maxTier);
  }

  /** Number of pool words of a length. */
  count(length) { return this._idx(length).words.length; }

  /** Is this a pool word? */
  isWord(word) {
    const w = String(word).toLowerCase();
    const idx = this.byLen.get(w.length);
    return !!idx && idx.set.has(w);
  }

  /** Is this a rarer dictionary word we still accept (an anagram of some pool word)? */
  isExtraWord(word) {
    const w = String(word).toLowerCase();
    const idx = this.byLen.get(w.length);
    return !!idx && idx.extraSet.has(w);
  }

  /** Pool words sharing these letters (a word or a jumble), most common first. */
  anagrams(letters) {
    const s = String(letters).replace(/[^a-z]/gi, "");
    const idx = this.byLen.get(s.length);
    return idx ? (idx.bySig.get(signature(s)) || []).slice() : [];
  }

  /** Rarer dictionary words sharing these letters. */
  extraAnagrams(letters) {
    const s = String(letters).replace(/[^a-z]/gi, "");
    const idx = this.byLen.get(s.length);
    return idx ? (idx.extraBySig.get(signature(s)) || []).slice() : [];
  }

  /** All anagram groups of a length as [signature, words[]], optionally only groups with ≥ minSize words. */
  anagramGroups(length, { minSize = 1 } = {}) {
    return [...this._idx(length).bySig.entries()].filter(([, ws]) => ws.length >= minSize);
  }

  patternOf(word) { return pattern(word); }

  /** Pool words of a length with this letter pattern, e.g. byPattern("ABCCD", 5). */
  byPattern(pat, length) {
    const L = length ?? String(pat).length;
    return this._idx(L).byPattern(pat).slice();
  }

  /**
   * Pick a pool word of a length. `bias` > 1 favours common words (index = n·u^bias);
   * 1 is uniform. `skip` is a predicate for words to avoid (e.g. already used).
   */
  sample(length, { rng = Math.random, bias = 1.3, skip } = {}) {
    const words = this._idx(length).words;
    if (!words.length) return null;
    for (let attempt = 0; attempt < 60; attempt++) {
      const w = words[Math.min(words.length - 1, Math.floor(words.length * Math.pow(rng(), bias)))];
      if (!skip || !skip(w)) return w;
    }
    const left = skip ? words.filter((w) => !skip(w)) : words;
    return left.length ? left[Math.floor(rng() * left.length)] : null;
  }
}

/** Shared instance for pages (each page loads only the lengths it needs). */
export const wordIndex = new WordIndex();
