/* =========================================================================
   alpha2num/engine.js — pure game logic, no DOM.
   Letters <-> numbers, a reshuffling deck so every letter comes up evenly,
   a prefix-aware judge for zetamac-style "advance the instant it's right",
   and a Round that keeps score plus per-letter stats for the weak-spot report.
   Exercised by tests/alpha2num.test.mjs (npm test).
   ========================================================================= */

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const KINDS = Object.freeze({ A2N: "a2n", N2A: "n2a" });

/** 'Q' -> 16 (base 0) or 17 (base 1). */
export function letterToNumber(letter, base = 0) {
  const i = ALPHABET.indexOf(String(letter).toUpperCase());
  if (i < 0) throw new RangeError(`not a letter: ${letter}`);
  return i + base;
}

/** 16 -> 'Q' (base 0); 17 -> 'Q' (base 1). */
export function numberToLetter(n, base = 0) {
  const i = Number(n) - base;
  if (!Number.isInteger(i) || i < 0 || i > 25) throw new RangeError(`out of range: ${n}`);
  return ALPHABET[i];
}

/** Fisher–Yates; returns a new array. `rng` returns [0, 1). */
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A shuffled deck of 0..size-1. Deals every card once before reshuffling, so
 * over 26 prompts every letter appears exactly once. It never deals the same
 * card twice in a row across a reshuffle.
 */
export class Deck {
  constructor(rng = Math.random, size = 26) {
    this.rng = rng;
    this.size = size;
    this.cards = [];
    this.last = -1;
  }
  draw() {
    if (this.cards.length === 0) {
      this.cards = shuffle([...Array(this.size).keys()], this.rng);
      // draw() pops from the end; if the next card repeats the previous one,
      // tuck it somewhere that is not the top of the deck.
      if (this.size > 1 && this.cards[this.cards.length - 1] === this.last) {
        const c = this.cards.pop();
        const k = Math.floor(this.rng() * this.cards.length); // 0 .. size-2
        this.cards.splice(k, 0, c);
      }
    }
    this.last = this.cards.pop();
    return this.last;
  }
}

/** Build a prompt for a direction and a 0-based letter index. */
export function makePrompt(kind, index, base = 0) {
  if (kind !== KINDS.A2N && kind !== KINDS.N2A) throw new RangeError(`bad kind: ${kind}`);
  if (!Number.isInteger(index) || index < 0 || index > 25) throw new RangeError(`bad index: ${index}`);
  const letter = ALPHABET[index];
  const num = String(index + base);
  return kind === KINDS.A2N
    ? { kind, index, shown: letter, answer: num }
    : { kind, index, shown: num, answer: letter };
}

/** Keep only the characters a direction can use: digits for a2n, letters for n2a (upper-cased). */
export function normalizeTyped(kind, raw) {
  const s = String(raw ?? "");
  return kind === KINDS.A2N ? s.replace(/\D+/g, "") : s.replace(/[^a-z]/gi, "").toUpperCase();
}

/**
 * 'correct'  — typed equals the answer
 * 'pending'  — typed is empty or a prefix of the answer ("1" on the way to "11")
 * 'wrong'    — typed can no longer become the answer
 */
export function judge(answer, typed) {
  if (!typed) return "pending";
  if (typed === answer) return "correct";
  if (answer.startsWith(typed)) return "pending";
  return "wrong";
}

/** Which direction(s) a round mixes, as a short stable label (used for personal-best keys). */
export function directionLabel(a2n, n2a) {
  if (a2n && n2a) return "both";
  if (a2n) return "a2n";
  if (n2a) return "n2a";
  throw new Error("at least one direction must be on");
}

/**
 * One timed round. Time is passed in explicitly (ms) so this stays testable.
 *
 *   const r = new Round({ a2n: true, n2a: true, base: 0 });
 *   r.next(now);                    // -> prompt { kind, index, shown, answer }
 *   r.submit(typed, now);           // -> 'correct' | 'pending' | 'wrong'
 *   r.summary({ durationSec: 60 }); // -> stats for the results screen
 *
 * After `revealAfter` misses on one prompt the answer is revealed; typing it
 * then moves on but does not score.
 */
export class Round {
  constructor({ a2n = true, n2a = true, base = 0, rng = Math.random, revealAfter = 3 } = {}) {
    this.kinds = [...(a2n ? [KINDS.A2N] : []), ...(n2a ? [KINDS.N2A] : [])];
    if (this.kinds.length === 0) throw new Error("at least one direction must be on");
    if (base !== 0 && base !== 1) throw new RangeError(`base must be 0 or 1, got ${base}`);
    this.base = base;
    this.rng = rng;
    this.revealAfter = revealAfter;
    this.decks = { [KINDS.A2N]: new Deck(rng), [KINDS.N2A]: new Deck(rng) };

    this.score = 0;        // correct answers that were not revealed
    this.answered = 0;     // prompts completed, revealed or not
    this.misses = 0;       // wrong entries
    this.revealed = 0;     // prompts that had to be revealed
    this.streak = 0;
    this.bestStreak = 0;
    this.scoredMs = 0;     // total time across scored answers

    this.perKey = new Map();
    this.history = [];
    this.current = null;
    this.currentMisses = 0;
    this.currentRevealed = false;
    this.shownAt = 0;
  }

  get isRevealed() { return this.currentRevealed; }

  next(now = 0) {
    const kind = this.kinds.length === 1 ? this.kinds[0] : this.kinds[Math.floor(this.rng() * this.kinds.length)];
    const index = this.decks[kind].draw();
    this.current = makePrompt(kind, index, this.base);
    this.currentMisses = 0;
    this.currentRevealed = false;
    this.shownAt = now;
    return this.current;
  }

  _rec(p) {
    const key = `${p.kind}:${p.index}`;
    let r = this.perKey.get(key);
    if (!r) {
      r = { key, kind: p.kind, index: p.index, shown: p.shown, answer: p.answer, attempts: 0, misses: 0, revealed: 0, ms: 0 };
      this.perKey.set(key, r);
    }
    return r;
  }

  _miss(rec) {
    this.misses++;
    this.currentMisses++;
    rec.misses++;
    this.streak = 0;
    if (this.revealAfter > 0 && !this.currentRevealed && this.currentMisses >= this.revealAfter) {
      this.currentRevealed = true;
      this.revealed++;
      rec.revealed++;
    }
  }

  /**
   * Feed the normalized typed text. With `commit` (the player pressed Enter),
   * a non-empty partial answer counts as wrong instead of pending.
   */
  submit(typed, now = 0, { commit = false } = {}) {
    const p = this.current;
    if (!p) throw new Error("call next() before submit()");
    let verdict = judge(p.answer, typed);
    if (commit && verdict === "pending" && typed) verdict = "wrong";
    const rec = this._rec(p);

    if (verdict === "wrong") {
      this._miss(rec);
    } else if (verdict === "correct") {
      const ms = Math.max(0, now - this.shownAt);
      rec.attempts++;
      rec.ms += ms;
      this.answered++;
      if (this.currentRevealed) {
        this.streak = 0;
      } else {
        this.score++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        this.scoredMs += ms;
      }
      this.history.push({ ...p, ms, misses: this.currentMisses, revealed: this.currentRevealed });
    }
    return verdict;
  }

  /** Stats for the results screen. */
  summary({ durationSec = 0, endedEarly = false, elapsedSec = durationSec } = {}) {
    const avgMs = this.score ? this.scoredMs / this.score : null;
    const denom = this.score + this.misses;
    const accuracy = denom ? this.score / denom : null;

    const rows = [...this.perKey.values()].map((r) => ({
      ...r,
      avgMs: r.attempts ? r.ms / r.attempts : null,
    }));
    const slowCut = avgMs ? avgMs * 1.6 : Infinity;
    const trouble = rows
      .filter((r) => r.revealed > 0 || r.misses > 0 || (r.avgMs !== null && r.avgMs > slowCut && r.avgMs > 1500))
      .map((r) => ({ ...r, weight: r.revealed * 10000 + r.misses * 2000 + (r.avgMs ?? 0) }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);

    return {
      score: this.score,
      answered: this.answered,
      misses: this.misses,
      revealed: this.revealed,
      accuracy,
      avgMs,
      bestStreak: this.bestStreak,
      trouble,
      durationSec,
      elapsedSec,
      endedEarly,
      base: this.base,
      directions: directionLabel(this.kinds.includes(KINDS.A2N), this.kinds.includes(KINDS.N2A)),
    };
  }
}
