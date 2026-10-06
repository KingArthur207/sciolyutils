/* =========================================================================
   anagram/app.js — page controller for the anagram drill.
   Uses the shared word pool (assets/js/words.js) and the pure engine
   (./engine.js). Settings: word length (one length, or any from 4 to 12) and
   duration. URL presets: ?mode=fixed|any&len=5&t=60
   ========================================================================= */
import { wordIndex, scramble, signature, MIN_LENGTH, MAX_LENGTH } from "../assets/js/words.js";
import { AnagramRound, lettersOnly } from "./engine.js";
import {
  store, bestsFor, clampSeconds, esc, fmtSec, pct, fmtInt,
  createTimer, personalBestHTML, statsHTML, wireCopyButton, flashClass,
} from "../assets/js/shell.js";

const ID = "anagram";
const STORE_SETTINGS = `sciolyutils:${ID}:settings`;
const DEFAULTS = Object.freeze({ mode: "fixed", len: 5, seconds: 60 });
const ANY_MIN = 4, ANY_MAX = 12;
/* how often each length comes up in "any length" mode (4–8 letters are what
   Patristocrats and transposition ciphers mostly throw at you) */
const ANY_WEIGHTS = { 4: 3, 5: 4, 6: 4, 7: 4, 8: 3, 9: 2, 10: 1.5, 11: 1, 12: 1 };
const bests = bestsFor(ID);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clampLen = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, n)) : DEFAULTS.len; };
const sanitize = (s) => ({ mode: s.mode === "any" ? "any" : "fixed", len: clampLen(s.len), seconds: clampSeconds(s.seconds, DEFAULTS.seconds) });
const lengthsFor = (s) => (s.mode === "any" ? Array.from({ length: ANY_MAX - ANY_MIN + 1 }, (_, i) => ANY_MIN + i) : [s.len]);
const bestKey = (s) => `${s.mode === "any" ? "any" : `len${s.len}`}:${s.seconds}`;
const modeLabel = (s) => (s.mode === "any" ? `any length (${ANY_MIN}–${ANY_MAX})` : `${s.len}-letter words`);

function loadSettings() {
  const saved = store.get(STORE_SETTINGS, {});
  const s = { ...DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
  const q = new URLSearchParams(location.search);
  if (q.get("mode") === "any") s.mode = "any";
  else if (q.get("mode") === "fixed" || q.has("len")) s.mode = "fixed";
  if (q.has("len")) s.len = clampLen(q.get("len"));
  if (q.has("t")) s.seconds = clampSeconds(q.get("t"), DEFAULTS.seconds);
  return sanitize(s);
}

/* ---- elements ---- */
const el = {
  body: document.body, trainer: $("#trainer"),
  setup: $("#setup"), play: $("#play"), done: $("#done"),
  lenRow: $("#len-row"), optLen: $("#opt-len"), optSeconds: $("#opt-seconds"), chips: $$(".chip[data-field]"),
  pbLine: $("#pb-line"), poolLine: $("#pool-line"), start: $("#start"),
  time: $("#time"), timeStat: $("#time-stat"), score: $("#score"), skip: $("#skip"), end: $("#end"),
  progress: $("#progress"), progressBar: $("#progress-bar"),
  stage: $("#stage"), kicker: $("#kicker"), rack: $("#rack"), rackSr: $("#rack-sr"), answer: $("#answer"),
  next: $("#next"), slots: $("#slots"), last: $("#last"),
  doneEyebrow: $("#done-eyebrow"), doneHeading: $("#done-heading"), doneScore: $("#done-score"), doneSub: $("#done-sub"),
  donePb: $("#done-pb"), doneStats: $("#done-stats"), trouble: $("#trouble"),
  again: $("#again"), settingsBtn: $("#settings"), copy: $("#copy"),
};

const state = {
  settings: loadSettings(),
  round: null,
  awaitingNext: false,     // a skipped set is on screen; waiting for the player to continue
  used: new Set(),         // signatures dealt this round
  lastSummary: null,
  loading: null,
};

const timer = createTimer({
  onTick(secs, fraction, changed) {
    if (changed) {
      el.time.textContent = String(secs);
      el.timeStat.classList.toggle("is-urgent", secs <= 5);
      el.progress.classList.toggle("is-urgent", secs <= 5);
    }
    el.progressBar.style.width = `${fraction * 100}%`;
  },
  onDone: () => finish(false),
});

/* ---- setup ---- */
function readForm() {
  const mode = $$('input[name="mode"]', el.setup).find((r) => r.checked)?.value;
  return sanitize({ mode, len: el.optLen.value, seconds: el.optSeconds.value });
}
function applySettingsToForm(s) {
  el.setup.elements.mode.value = s.mode;
  el.optLen.value = String(s.len);
  el.optSeconds.value = String(s.seconds);
  el.lenRow.hidden = s.mode !== "fixed";
  syncChips();
  refreshPbLine();
}
const chipTarget = (c) => el.setup.elements[c.dataset.field];
function syncChips() {
  el.chips.forEach((c) => { const t = chipTarget(c); c.setAttribute("aria-pressed", t && String(t.value) === c.dataset.value ? "true" : "false"); });
}
function refreshPbLine() {
  const s = readForm();
  const best = bests.get(bestKey(s));
  const what = `${modeLabel(s)}, ${s.seconds}s`;
  el.pbLine.innerHTML = best ? `Your best for ${esc(what)}: <b>${best.score}</b> words` : `No rounds yet for ${esc(what)}. Set the bar.`;
}

/* ---- word pool loading ---- */
function describePool(s) {
  const lengths = lengthsFor(s).filter((L) => wordIndex.has(L));
  const words = lengths.reduce((n, L) => n + wordIndex.count(L), 0);
  const multi = lengths.reduce((n, L) => n + wordIndex.anagramGroups(L, { minSize: 2 }).length, 0);
  return s.mode === "any"
    ? `${fmtInt(words)} words of ${ANY_MIN}–${ANY_MAX} letters loaded · ${fmtInt(multi)} sets with 2+ anagrams`
    : `${fmtInt(words)} ${s.len}-letter words loaded · ${fmtInt(multi)} sets with 2+ anagrams`;
}
async function ensurePool(s) {
  const need = lengthsFor(s).filter((L) => !wordIndex.has(L));
  if (need.length) {
    el.poolLine.textContent = "Loading words…";
    el.poolLine.classList.remove("is-warn");
    try {
      await wordIndex.load(need);
    } catch (err) {
      el.poolLine.textContent = "Couldn't load the word list. Check your connection and press Start to retry.";
      el.poolLine.classList.add("is-warn");
      throw err;
    }
  }
  if (lengthsFor(s).some((L) => !wordIndex.has(L))) throw new Error("word list missing");
  el.poolLine.textContent = describePool(s);
}

/* ---- dealing sets ---- */
function pickLength(s, rng) {
  if (s.mode !== "any") return s.len;
  const lengths = lengthsFor(s).filter((L) => wordIndex.has(L) && wordIndex.count(L) > 0);
  const total = lengths.reduce((n, L) => n + (ANY_WEIGHTS[L] || 1), 0);
  let r = rng() * total;
  for (const L of lengths) { r -= ANY_WEIGHTS[L] || 1; if (r <= 0) return L; }
  return lengths[lengths.length - 1];
}
function deal(rng) {
  const s = state.settings;
  for (let attempt = 0; attempt < 3; attempt++) {
    const L = pickLength(s, rng);
    const word = wordIndex.sample(L, { rng, skip: (w) => state.used.has(signature(w)) });
    if (!word) { state.used.clear(); continue; }           // this length is exhausted: allow repeats
    const answers = wordIndex.anagrams(word);
    state.used.add(signature(word));
    return { letters: scramble(word, rng, answers), answers, extra: wordIndex.extraAnagrams(word) };
  }
  const w = wordIndex.sample(s.mode === "any" ? ANY_MIN : s.len, { rng });
  return { letters: scramble(w, rng), answers: wordIndex.anagrams(w), extra: wordIndex.extraAnagrams(w) };
}

/* ---- play ---- */
function setView(name) {
  el.setup.hidden = name !== "setup";
  el.play.hidden = name !== "play";
  el.done.hidden = name !== "done";
  el.body.classList.toggle("is-playing", name === "play");
}

function renderRack(used) {
  const cur = state.round.current;
  el.rack.innerHTML = [...cur.letters].map((ch, i) =>
    `<button type="button" class="rack-tile${used && used[i] ? " is-used" : ""}" data-i="${i}" aria-label="${ch}" tabindex="-1">${ch}</button>`
  ).join("");
  el.rack.classList.toggle("is-long", cur.length > 8);
}
function renderSlots() {
  const cur = state.round.current;
  const found = cur.found.map((w) => `<li class="slot is-found">${esc(w)}</li>`);
  const blanks = Array.from({ length: cur.remaining.size }, () => `<li class="slot is-empty" aria-label="unfound word">${"·".repeat(cur.length)}</li>`);
  const bonus = cur.bonus.map((w) => `<li class="slot is-bonus" title="A rarer dictionary word: counts as a bonus">${esc(w)} <small>bonus</small></li>`);
  el.slots.innerHTML = [...found, ...blanks, ...bonus].join("");
}
function renderKicker() {
  const cur = state.round.current;
  const k = cur.target;
  el.kicker.textContent = `Find ${k} ${k === 1 ? "word" : "words"}${cur.found.length ? ` · ${cur.found.length} found` : ""}`;
}

function nextSet() {
  const set = state.round.next(performance.now());
  state.awaitingNext = false;
  el.answer.value = "";
  el.answer.disabled = false;
  el.next.hidden = true;
  el.skip.hidden = false;
  renderKicker();
  renderRack(null);
  renderSlots();
  el.rackSr.textContent = `Letters: ${[...set.letters].join(" ")}. Find ${set.target} ${set.target === 1 ? "word" : "words"}.`;
  el.answer.focus({ preventScroll: true });
}

function paintRack(typed) {
  const { ok, used } = state.round.typing(typed);
  $$(".rack-tile", el.rack).forEach((t, i) => t.classList.toggle("is-used", ok && used[i]));
}

function judge(typed, now = performance.now()) {
  const verdict = state.round.submit(typed, now);
  const cur = state.round.current;
  if (verdict === "pending") { paintRack(typed); return; }
  el.answer.value = "";
  paintRack("");
  if (verdict === "wrong") {
    flashClass(el.stage, "is-wrong", 400, ["is-wrong", "is-correct", "is-repeat"]);
  } else if (verdict === "repeat") {
    flashClass(el.stage, "is-repeat", 400, ["is-wrong", "is-correct", "is-repeat"]);
  } else if (verdict === "found" || verdict === "bonus") {
    el.score.textContent = String(state.round.score);
    renderSlots();
    renderKicker();
    flashClass(el.stage, "is-correct", 400, ["is-wrong", "is-correct", "is-repeat"]);
  } else if (verdict === "complete") {
    el.score.textContent = String(state.round.score);
    el.last.innerHTML = `<b class="ok">✓</b> ${esc(cur.letters)} → ${cur.answers.map((w) => `<span class="w">${esc(w)}</span>`).join(" ")}`;
    flashClass(el.stage, "is-correct", 400, ["is-wrong", "is-correct", "is-repeat"]);
    nextSet();
  }
}

function onAnswerInput() {
  if (!state.round || state.awaitingNext) return;
  const typed = lettersOnly(el.answer.value);
  if (el.answer.value !== typed) el.answer.value = typed;
  judge(typed);
}

function onAnswerKeydown(e) {
  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(true); return; }
  if (e.key !== "Enter" || !state.round) return;
  e.preventDefault();
  e.stopPropagation();                      // the document listener must not see this same Enter
  if (state.awaitingNext) { nextSet(); return; }
  const typed = lettersOnly(el.answer.value);
  if (!typed) { skipSet(); return; }
  // Enter on a partial word: the player thinks it is done, so it is a miss
  judge(typed.padEnd(state.round.current.length + 1, "?"));
}

function skipSet() {
  if (!state.round || state.awaitingNext) return;
  const cur = state.round.current;
  const missed = state.round.skip(performance.now());
  state.awaitingNext = true;
  el.answer.value = "";
  el.answer.disabled = true;
  paintRack("");
  el.slots.innerHTML = [
    ...cur.found.map((w) => `<li class="slot is-found">${esc(w)}</li>`),
    ...missed.map((w) => `<li class="slot is-missed">${esc(w)}</li>`),
    ...cur.bonus.map((w) => `<li class="slot is-bonus">${esc(w)} <small>bonus</small></li>`),
  ].join("");
  el.kicker.textContent = `Skipped · ${missed.length} ${missed.length === 1 ? "word" : "words"} missed`;
  el.last.innerHTML = `<b class="no">✗</b> ${esc(cur.letters)} → missed ${missed.map((w) => `<span class="w miss">${esc(w)}</span>`).join(" ")}`;
  el.skip.hidden = true;
  el.next.hidden = false;
  el.next.focus({ preventScroll: true });
}

function onRackClick(e) {
  const tile = e.target.closest(".rack-tile");
  if (!tile || !state.round || state.awaitingNext || tile.classList.contains("is-used")) return;
  el.answer.value = lettersOnly(el.answer.value) + tile.textContent;
  judge(lettersOnly(el.answer.value));
  el.answer.focus({ preventScroll: true });
}

async function start() {
  const s = readForm();
  state.settings = s;
  store.set(STORE_SETTINGS, s);
  applySettingsToForm(s);

  el.start.disabled = true;
  const label = el.start.textContent;
  el.start.textContent = "Loading…";
  try { await ensurePool(s); } catch { el.start.disabled = false; el.start.textContent = label; return; }
  el.start.disabled = false;
  el.start.textContent = label;

  state.used = new Set();
  state.round = new AnagramRound({ deal });
  el.score.textContent = "0";
  el.time.textContent = String(s.seconds);
  el.timeStat.classList.remove("is-urgent");
  el.progress.classList.remove("is-urgent");
  el.progressBar.style.width = "100%";
  el.stage.classList.remove("is-correct", "is-wrong", "is-repeat");
  el.last.innerHTML = "";
  el.answer.setAttribute("maxlength", String(s.mode === "any" ? ANY_MAX : s.len));

  setView("play");
  nextSet();
  timer.start(s.seconds);
  el.trainer.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---- results ---- */
function finish(endedEarly) {
  if (!state.round) return;
  timer.stop();
  const s = state.settings;
  const elapsedSec = Math.min(s.seconds, timer.elapsedSec());
  const sum = state.round.summary({ durationSec: s.seconds, endedEarly, elapsedSec });
  state.round = null;
  state.awaitingNext = false;
  state.lastSummary = sum;

  el.doneEyebrow.textContent = endedEarly ? "Stopped" : "Time!";
  el.doneScore.textContent = String(sum.score);
  el.doneSub.textContent = `${sum.score === 1 ? "word" : "words"} found in ${endedEarly ? `${elapsedSec} of ${s.seconds}` : s.seconds} seconds`;
  el.donePb.innerHTML = personalBestHTML(bests, bestKey(s), sum.score, endedEarly);

  el.doneStats.innerHTML = statsHTML([
    ["Sets solved", String(sum.setsDone)],
    ["Skipped", String(sum.setsSkipped)],
    ["Misses", String(sum.misses)],
    ["Accuracy", sum.accuracy === null ? "—" : pct(sum.accuracy)],
    ["Avg per word", sum.avgMs === null ? "—" : fmtSec(sum.avgMs)],
    ["Best streak", String(sum.bestStreak)],
    ["Bonus words", String(sum.bonus)],
    ["Words / min", elapsedSec ? (sum.score / (elapsedSec / 60)).toFixed(1) : "—"],
  ]);

  const chips = sum.trouble.map((t) => {
    const bits = [`found ${t.found.length} of ${t.answers.length}`];
    if (t.misses) bits.push(`<b>${t.misses}</b> ${t.misses === 1 ? "miss" : "misses"}`);
    bits.push(fmtSec(t.ms));
    const a = t.missed.length ? t.missed.join(", ") : "all found";
    return `<li class="chip-stat"><span class="pair"><i class="q">${esc(t.letters)}</i><span class="arr">→</span><i class="a">${esc(a)}</i></span><small>${bits.join(" · ")}</small></li>`;
  }).join("");
  el.trouble.innerHTML = `
    <h3>Weak spots</h3>
    ${chips
      ? `<p class="lede">Sets you skipped or fumbled, with the words you did not get. Say them out loud; they will come faster next time.</p><ul class="chips">${chips}</ul>`
      : `<p class="none">No weak spots this round. Try a longer length or switch to any length.</p>`}`;

  setView("done");
  el.doneHeading.focus({ preventScroll: true });
  el.trainer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function summaryText() {
  const sum = state.lastSummary, s = state.settings;
  if (!sum) return "";
  const lines = [
    `anagram · ${modeLabel(s)} · ${sum.endedEarly ? `${sum.elapsedSec}/${s.seconds}s (ended early)` : `${s.seconds}s`}`,
    `Score ${sum.score} words · ${sum.setsDone} sets · ${sum.setsSkipped} skipped · ${sum.misses} misses · ${sum.accuracy === null ? "—" : pct(sum.accuracy)} · ${sum.avgMs === null ? "—" : fmtSec(sum.avgMs)} avg · best streak ${sum.bestStreak}`,
  ];
  if (sum.trouble.length) lines.push(`Missed: ${sum.trouble.filter((t) => t.missed.length).map((t) => `${t.letters} → ${t.missed.join(", ")}`).join("; ")}`);
  lines.push(`${location.origin}${location.pathname}?mode=${s.mode}&len=${s.len}&t=${s.seconds}`);
  return lines.join("\n");
}

/* ---- wire up ---- */
function init() {
  applySettingsToForm(state.settings);
  ensurePool(state.settings).catch(() => {});

  el.setup.addEventListener("submit", (e) => { e.preventDefault(); start(); });
  el.setup.addEventListener("change", (e) => {
    if (e.target.name === "mode") el.lenRow.hidden = e.target.value !== "fixed";
    refreshPbLine();
    ensurePool(readForm()).catch(() => {});
  });
  el.setup.addEventListener("input", (e) => { if (e.target.matches('input[type="number"]')) { syncChips(); refreshPbLine(); } });
  el.setup.addEventListener("focusout", (e) => {
    if (e.target.matches('input[type="number"]')) { applySettingsToForm(readForm()); ensurePool(readForm()).catch(() => {}); }
  });
  el.chips.forEach((c) => c.addEventListener("click", () => {
    const t = chipTarget(c);
    if (t) t.value = c.dataset.value;
    syncChips(); refreshPbLine();
    ensurePool(readForm()).catch(() => {});
  }));

  el.answer.addEventListener("input", onAnswerInput);
  el.answer.addEventListener("keydown", onAnswerKeydown);
  el.rack.addEventListener("click", onRackClick);
  el.rack.addEventListener("mousedown", (e) => e.preventDefault());
  el.skip.addEventListener("click", skipSet);
  el.next.addEventListener("click", () => { if (state.round && state.awaitingNext) nextSet(); });
  el.end.addEventListener("click", () => finish(true));
  el.stage.addEventListener("click", (e) => {
    if (state.round && !state.awaitingNext && !e.target.closest("button")) el.answer.focus({ preventScroll: true });
  });

  el.again.addEventListener("click", start);
  el.settingsBtn.addEventListener("click", () => { setView("setup"); refreshPbLine(); el.start.focus({ preventScroll: true }); });
  wireCopyButton(el.copy, summaryText);

  document.addEventListener("keydown", (e) => {
    if (!state.round) return;
    if (e.key === "Escape") { e.preventDefault(); finish(true); return; }
    // Enter/Space anywhere continues after a skipped set; buttons already turn these into clicks
    const onControl = e.target instanceof Element && e.target.closest("button, input, a");
    if (state.awaitingNext && (e.key === "Enter" || e.key === " ") && !onControl) { e.preventDefault(); nextSet(); }
  });

  setView("setup");
}

init();
