/* =========================================================================
   drill-engine.js — pure game logic shared by every speed-drill applet.
   No DOM. A drill is a set of *directions*; each direction has *cards*
   ({ key, shown, answer, accept?, answerLabel? }), either as a fixed list
   (`cards`) or generated (`size` + `card(index, context)`). A direction may
   also declare a *run*: a context (e.g. a Caesar key) dealt from its own deck
   and held for `length` consecutive prompts. A Round deals from reshuffling
   decks, judges typed input prefix-wise so a right answer can advance the
   instant it is complete, and keeps per-card stats for the weak-spot report
   (grouped by `statKey` when a card sets one). Tests: tests/drill-engine.test.mjs.
   ========================================================================= */

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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
 * over `size` prompts every card appears exactly once. Never deals the same
 * card twice in a row across a reshuffle.
 */
export class Deck {
  constructor({ size, rng = Math.random }) {
    if (!Number.isInteger(size) || size < 1) throw new RangeError(`bad deck size: ${size}`);
    this.size = size;
    this.rng = rng;
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

/** All answers a card accepts (canonical strings). */
export const acceptedAnswers = (card) => (card.accept && card.accept.length ? card.accept : [card.answer]);

/**
 * 'correct'  — typed equals an accepted answer
 * 'pending'  — typed is empty or a prefix of an accepted answer ("1" on the way to "11")
 * 'wrong'    — typed can no longer become an accepted answer
 */
export function judge(card, typed) {
  if (!typed) return "pending";
  const accept = acceptedAnswers(card);
  if (accept.includes(typed)) return "correct";
  if (accept.some((a) => a.startsWith(typed))) return "pending";
  return "wrong";
}

/** Human label for a card's answer (what the reveal and weak-spot chips show). */
export function answerLabelOf(dir, card) {
  if (card.answerLabel) return card.answerLabel;
  return dir.display ? dir.display(card.answer) : card.answer;
}

/**
 * One timed round. Time is passed in explicitly (ms) so this stays testable.
 *
 *   const r = new Round({ directions: [dirA, dirB] });
 *   r.next(now);                    // -> { dir, card }
 *   r.submit(typed, now);           // -> 'correct' | 'pending' | 'wrong'
 *   r.summary({ durationSec: 60 }); // -> stats for the results screen
 *
 * After `revealAfter` misses on one prompt the answer is revealed; typing it
 * then moves on but does not score.
 */
export class Round {
  constructor({ directions, rng = Math.random, revealAfter = 3 } = {}) {
    if (!Array.isArray(directions) || directions.length === 0) throw new Error("at least one direction must be on");
    for (const d of directions) {
      if (!d || !d.id) throw new Error("direction needs an id");
      const generated = typeof d.card === "function" && Number.isInteger(d.size) && d.size > 0;
      if (!generated && (!Array.isArray(d.cards) || d.cards.length === 0)) throw new Error(`direction ${d.id} has no cards`);
      if (d.run && (!Number.isInteger(d.run.length) || d.run.length < 1 || !Number.isInteger(d.run.size) || d.run.size < 1 || typeof d.run.context !== "function")) {
        throw new Error(`direction ${d.id} has a malformed run`);
      }
    }
    this.directions = directions;
    this.rng = rng;
    this.revealAfter = revealAfter;
    this.decks = directions.map((d) => new Deck({ size: d.cards ? d.cards.length : d.size, rng }));
    this.runDecks = directions.map((d) => (d.run ? new Deck({ size: d.run.size, rng }) : null));
    this.run = null;       // { di, context, length, position } while a run is in progress

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
    let di;
    if (this.run && this.run.position < this.run.length) {
      di = this.run.di;                                   // stay inside the current run
    } else {
      di = this.directions.length === 1 ? 0 : Math.floor(this.rng() * this.directions.length);
      const d = this.directions[di];
      this.run = d.run
        ? { di, context: d.run.context(this.runDecks[di].draw()), length: d.run.length, position: 0 }
        : null;
    }
    const dir = this.directions[di];
    const idx = this.decks[di].draw();
    const card = dir.cards ? dir.cards[idx] : dir.card(idx, this.run ? this.run.context : undefined);
    if (this.run) this.run.position++;
    this.current = { dir, card, run: this.run ? { ...this.run } : null };
    this.currentMisses = 0;
    this.currentRevealed = false;
    this.shownAt = now;
    return this.current;
  }

  _rec({ dir, card }) {
    const key = `${dir.id}:${card.statKey ?? card.key}`;
    let r = this.perKey.get(key);
    if (!r) {
      r = {
        key, dirId: dir.id, cardKey: card.statKey ?? card.key,
        shown: card.statShown ?? card.shown,
        answerLabel: card.statAnswer !== undefined ? card.statAnswer : answerLabelOf(dir, card),
        attempts: 0, misses: 0, revealed: 0, ms: 0,
      };
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
    const cur = this.current;
    if (!cur) throw new Error("call next() before submit()");
    let verdict = judge(cur.card, typed);
    if (commit && verdict === "pending" && typed) verdict = "wrong";
    const rec = this._rec(cur);

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
      this.history.push({ dirId: cur.dir.id, cardKey: cur.card.key, ms, misses: this.currentMisses, revealed: this.currentRevealed });
    }
    return verdict;
  }

  /** Stats for the results screen. */
  summary({ durationSec = 0, endedEarly = false, elapsedSec = durationSec } = {}) {
    const avgMs = this.score ? this.scoredMs / this.score : null;
    const denom = this.score + this.misses;
    const accuracy = denom ? this.score / denom : null;

    const rows = [...this.perKey.values()].map((r) => ({ ...r, avgMs: r.attempts ? r.ms / r.attempts : null }));
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
      directions: this.directions.map((d) => d.id),
    };
  }
}
