/* =========================================================================
   anagram/engine.js — pure logic for the anagram drill, no DOM.
   A *set* is a jumble of letters with K target words (every pool word made of
   exactly those letters). The player types whole words; a word is accepted the
   moment it is complete, so there is nothing to submit. Typing a letter the rack
   does not have is wrong at once; otherwise nothing is judged until the word is
   full length, so prefixes leak no hints. Rarer dictionary anagrams count as
   bonus words. Tests: tests/anagram.test.mjs.
   ========================================================================= */

/**
 * Which rack tiles the typed text uses (greedy, left to right).
 * Returns { ok, used } — ok is false when typed needs a letter the rack lacks.
 */
export function rackUse(letters, typed) {
  const rack = [...String(letters).toUpperCase()];
  const used = rack.map(() => false);
  let ok = true;
  for (const ch of String(typed).toUpperCase()) {
    const i = rack.findIndex((r, k) => r === ch && !used[k]);
    if (i < 0) { ok = false; break; }
    used[i] = true;
  }
  return { ok, used };
}

export const lettersOnly = (raw) => String(raw ?? "").replace(/[^a-z]/gi, "").toUpperCase();

/**
 * One timed round.
 *   const r = new AnagramRound({ deal });   // deal(rng) -> { letters, answers: [...], extra: [...] }
 *   r.next(now);                            // -> current set { letters, answers, extra, found, bonus, target }
 *   r.submit(typed, now);                   // -> 'pending' | 'wrong' | 'found' | 'complete' | 'repeat' | 'bonus'
 *   r.skip(now);                            // -> missed words; the set is over, call next() for a new one
 *   r.summary({ durationSec });
 */
export class AnagramRound {
  constructor({ deal, rng = Math.random } = {}) {
    if (typeof deal !== "function") throw new Error("deal(rng) is required");
    this.deal = deal;
    this.rng = rng;

    this.score = 0;          // words found (pool answers + bonus words)
    this.wordsFound = 0;     // pool answers found
    this.bonus = 0;          // rarer valid anagrams typed
    this.setsDone = 0;
    this.setsSkipped = 0;
    this.misses = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.wordMs = 0;         // time spent on found words (set shown or previous word -> this word)

    this.current = null;
    this.over = false;       // current set finished (complete or skipped); next() needed
    this.lastEvent = 0;
    this.history = [];       // { letters, answers, found, bonus, missed, skipped, ms }
  }

  next(now = 0) {
    const d = this.deal(this.rng);
    if (!d || !d.letters || !Array.isArray(d.answers) || d.answers.length === 0) throw new Error("deal() must return { letters, answers[] }");
    const letters = String(d.letters).toUpperCase();
    const answers = d.answers.map((w) => String(w).toUpperCase());
    const extra = new Set((d.extra || []).map((w) => String(w).toUpperCase()));
    this.current = {
      letters, length: letters.length, answers, extra,
      remaining: new Set(answers), found: [], bonus: [],
      target: answers.length, shownAt: now, misses: 0,
    };
    this.over = false;
    this.lastEvent = now;
    return this.current;
  }

  /** Rack feedback for the text typed so far (no side effects). */
  typing(typed) {
    return rackUse(this.current ? this.current.letters : "", lettersOnly(typed));
  }

  submit(raw, now = 0) {
    const cur = this.current;
    if (!cur) throw new Error("call next() before submit()");
    if (this.over) return "pending";
    const typed = lettersOnly(raw);
    if (!typed) return "pending";
    if (!rackUse(cur.letters, typed).ok) return this._miss(cur);
    if (typed.length < cur.length) return "pending";

    if (cur.remaining.has(typed)) {
      cur.remaining.delete(typed);
      cur.found.push(typed);
      this._hit(now);
      this.wordsFound++;
      if (cur.remaining.size === 0) {
        this.setsDone++;
        this.over = true;
        this._record(cur, now, false);
        return "complete";
      }
      return "found";
    }
    if (cur.found.includes(typed) || cur.bonus.includes(typed)) return "repeat";
    if (cur.extra.has(typed)) {
      cur.bonus.push(typed);
      this._hit(now);
      this.bonus++;
      return "bonus";
    }
    return this._miss(cur);
  }

  /** Give up on the current set. Returns the words that were still missing. */
  skip(now = 0) {
    const cur = this.current;
    if (!cur || this.over) return [];
    const missed = [...cur.remaining];
    this.setsSkipped++;
    this.streak = 0;
    this.over = true;
    this._record(cur, now, true);
    return missed;
  }

  _hit(now) {
    this.score++;
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.wordMs += Math.max(0, now - this.lastEvent);
    this.lastEvent = now;
  }

  _miss(cur) {
    this.misses++;
    cur.misses++;
    this.streak = 0;
    return "wrong";
  }

  _record(cur, now, skipped) {
    this.history.push({
      letters: cur.letters, answers: cur.answers.slice(), found: cur.found.slice(), bonus: cur.bonus.slice(),
      missed: [...cur.remaining], skipped, misses: cur.misses, ms: Math.max(0, now - cur.shownAt),
    });
  }

  summary({ durationSec = 0, endedEarly = false, elapsedSec = durationSec } = {}) {
    const denom = this.score + this.misses;
    const trouble = this.history
      .filter((h) => h.skipped || h.misses >= 2)
      .map((h) => ({ ...h, weight: h.missed.length * 1000 + h.misses * 100 + h.ms / 1000 }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
    return {
      score: this.score,
      wordsFound: this.wordsFound,
      bonus: this.bonus,
      setsDone: this.setsDone,
      setsSkipped: this.setsSkipped,
      misses: this.misses,
      accuracy: denom ? this.score / denom : null,
      avgMs: this.score ? this.wordMs / this.score : null,
      bestStreak: this.bestStreak,
      trouble,
      durationSec,
      elapsedSec,
      endedEarly,
    };
  }
}
