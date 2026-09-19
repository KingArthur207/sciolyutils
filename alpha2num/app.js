/* =========================================================================
   alpha2num/app.js — wires the engine to the page.
   Three views inside .trainer: #setup (form), #play, #done.
   Settings persist in localStorage; personal bests are stored per
   (directions, numbering, duration). URL params can preset a round:
     /alpha2num/?dir=a2n|n2a|both&t=60&base=0|1&strip=1
   ========================================================================= */
import { ALPHABET, KINDS, Round, normalizeTyped, directionLabel } from "./engine.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const STORE_SETTINGS = "sciolyutils:alpha2num:settings";
const STORE_BESTS = "sciolyutils:alpha2num:bests";
const MIN_SECONDS = 5, MAX_SECONDS = 3600;
const DEFAULTS = Object.freeze({ a2n: true, n2a: true, base: 0, seconds: 60, strip: false });

/* ---- storage (all guarded: private mode / blocked storage must not break the game) ---- */
const store = {
  get(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
};
const clampSeconds = (v) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return DEFAULTS.seconds;
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n));
};
const bestKey = (s) => `${directionLabel(s.a2n, s.n2a)}:${s.base}:${s.seconds}`;
const getBest = (s) => store.get(STORE_BESTS, {})[bestKey(s)] || null;
const setBest = (s, score) => {
  const all = store.get(STORE_BESTS, {});
  all[bestKey(s)] = { score, at: new Date().toISOString() };
  store.set(STORE_BESTS, all);
};

function loadSettings() {
  const saved = store.get(STORE_SETTINGS, {});
  const s = { ...DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
  // URL presets win over saved settings (lets a coach link a specific drill)
  const q = new URLSearchParams(location.search);
  const dir = q.get("dir");
  if (dir === "a2n") { s.a2n = true; s.n2a = false; }
  else if (dir === "n2a") { s.a2n = false; s.n2a = true; }
  else if (dir === "both") { s.a2n = true; s.n2a = true; }
  if (q.has("t")) s.seconds = clampSeconds(q.get("t"));
  if (q.get("base") === "1") s.base = 1; else if (q.get("base") === "0") s.base = 0;
  if (q.has("strip")) s.strip = q.get("strip") !== "0";
  // sanity
  s.a2n = !!s.a2n; s.n2a = !!s.n2a; s.strip = !!s.strip;
  if (!s.a2n && !s.n2a) { s.a2n = true; s.n2a = true; }
  s.base = s.base === 1 ? 1 : 0;
  s.seconds = clampSeconds(s.seconds);
  return s;
}

/* ---- elements ---- */
const el = {
  body: document.body,
  trainer: $("#trainer"),
  setup: $("#setup"), play: $("#play"), done: $("#done"),
  optA2n: $("#opt-a2n"), optN2a: $("#opt-n2a"), optStrip: $("#opt-strip"), optSeconds: $("#opt-seconds"),
  dirHelp: $("#dir-help"), chips: $$(".chip[data-seconds]"), pbLine: $("#pb-line"), start: $("#start"),
  time: $("#time"), timeStat: $("#time-stat"), score: $("#score"), end: $("#end"),
  progress: $("#progress"), progressBar: $("#progress-bar"),
  stage: $("#stage"), kicker: $("#kicker"), tile: $("#tile"), tileText: $("#tile-text"), tileSr: $("#tile-sr"),
  answer: $("#answer"), reveal: $("#reveal"), strip: $("#strip"),
  doneEyebrow: $("#done-eyebrow"), doneHeading: $("#done-heading"), doneScore: $("#done-score"), doneSub: $("#done-sub"),
  donePb: $("#done-pb"), doneStats: $("#done-stats"), trouble: $("#trouble"),
  again: $("#again"), settingsBtn: $("#settings"), copy: $("#copy"),
};

const state = {
  settings: loadSettings(),
  round: null,
  startedAt: 0,
  endAt: 0,
  timer: 0,
  lastShownSeconds: -1,
  lastSummary: null,
  flashTimer: 0,
};

/* ---- setup view ---- */
function applySettingsToForm(s) {
  el.optA2n.checked = s.a2n;
  el.optN2a.checked = s.n2a;
  el.optStrip.checked = s.strip;
  el.optSeconds.value = String(s.seconds);
  const base = $$('input[name="base"]', el.setup).find((r) => Number(r.value) === s.base);
  if (base) base.checked = true;
  syncChips();
  refreshPbLine();
}

function readForm() {
  const baseInput = $$('input[name="base"]', el.setup).find((r) => r.checked);
  return {
    a2n: el.optA2n.checked,
    n2a: el.optN2a.checked,
    base: baseInput && Number(baseInput.value) === 1 ? 1 : 0,
    seconds: clampSeconds(el.optSeconds.value),
    strip: el.optStrip.checked,
  };
}

function syncChips() {
  const v = String(clampSeconds(el.optSeconds.value));
  el.chips.forEach((c) => c.setAttribute("aria-pressed", c.dataset.seconds === v ? "true" : "false"));
}

function refreshPbLine() {
  const s = readForm();
  const best = getBest(s);
  const label = { both: "both directions", a2n: "letter → number", n2a: "number → letter" }[directionLabel(s.a2n, s.n2a)];
  el.pbLine.innerHTML = best
    ? `Your best for ${label}, ${s.seconds}s: <b>${best.score}</b>`
    : `No rounds yet for ${label}, ${s.seconds}s. Set the bar.`;
}

function guardDirections(changed) {
  if (!el.optA2n.checked && !el.optN2a.checked) {
    changed.checked = true;                       // refuse to turn off the last direction
    el.dirHelp.textContent = "Keep at least one direction on.";
    el.dirHelp.classList.add("is-warn");
    const track = changed.nextElementSibling;
    track?.animate?.(
      [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }],
      { duration: 260, easing: "ease-out" }
    );
    return false;
  }
  el.dirHelp.textContent = "Turn on one or both. With both on, prompts alternate at random.";
  el.dirHelp.classList.remove("is-warn");
  return true;
}

/* ---- play view ---- */
function setView(name) {
  el.setup.hidden = name !== "setup";
  el.play.hidden = name !== "play";
  el.done.hidden = name !== "done";
  el.body.classList.toggle("is-playing", name === "play");
}

function renderStrip(base) {
  el.strip.innerHTML = [...ALPHABET].map((L, i) =>
    `<span class="ref-col"><span class="ref-cell l">${L}</span><span class="ref-cell n">${i + base}</span></span>`
  ).join("");
}

function showPrompt() {
  const p = state.round.next(performance.now());
  const isA2n = p.kind === KINDS.A2N;
  el.kicker.textContent = isA2n ? "Letter → number" : "Number → letter";
  el.kicker.classList.toggle("n2a", !isA2n);
  el.tileText.textContent = p.shown;
  el.tileSr.textContent = isA2n ? `Letter ${p.shown}. Type its number.` : `Number ${p.shown}. Type its letter.`;
  el.reveal.textContent = "";
  el.answer.value = "";
  el.answer.setAttribute("aria-label", isA2n ? `Number for ${p.shown}` : `Letter for ${p.shown}`);
}

function flash(cls) {
  el.stage.classList.remove("is-correct", "is-wrong");
  void el.stage.offsetWidth;                       // restart the animation even on rapid repeats
  el.stage.classList.add(cls);
  clearTimeout(state.flashTimer);
  state.flashTimer = setTimeout(() => el.stage.classList.remove(cls), 400);
}

function onAnswerInput(e) {
  if (!state.round) return;
  const p = state.round.current;
  const typed = normalizeTyped(p.kind, el.answer.value);
  if (typed !== el.answer.value) el.answer.value = typed;   // drop characters this direction cannot use
  handleVerdict(state.round.submit(typed, performance.now()));
}

function onAnswerKeydown(e) {
  if (e.key === "Escape") { e.preventDefault(); finish(true); return; }
  if (e.key !== "Enter" || !state.round) return;
  e.preventDefault();
  const p = state.round.current;
  const typed = normalizeTyped(p.kind, el.answer.value);
  if (!typed) return;
  handleVerdict(state.round.submit(typed, performance.now(), { commit: true }));
}

function handleVerdict(verdict) {
  if (verdict === "correct") {
    el.score.textContent = String(state.round.score);
    flash("is-correct");
    showPrompt();
  } else if (verdict === "wrong") {
    flash("is-wrong");
    el.answer.value = "";
    if (state.round.isRevealed) {
      const p = state.round.current;
      el.reveal.innerHTML = `Answer: <b>${p.answer}</b> — type it to move on (no point for this one).`;
    }
  }
}

function tick() {
  const now = performance.now();
  const remaining = Math.max(0, state.endAt - now);
  const total = state.endAt - state.startedAt;
  const secs = Math.ceil(remaining / 1000);
  if (secs !== state.lastShownSeconds) {
    state.lastShownSeconds = secs;
    el.time.textContent = String(secs);
    const urgent = secs <= 5;
    el.timeStat.classList.toggle("is-urgent", urgent);
    el.progress.classList.toggle("is-urgent", urgent);
  }
  el.progressBar.style.width = `${(remaining / total) * 100}%`;
  if (remaining <= 0) finish(false);
}

function start() {
  const s = readForm();
  state.settings = s;
  store.set(STORE_SETTINGS, s);
  el.optSeconds.value = String(s.seconds);
  syncChips();

  state.round = new Round({ a2n: s.a2n, n2a: s.n2a, base: s.base });
  state.startedAt = performance.now();
  state.endAt = state.startedAt + s.seconds * 1000;
  state.lastShownSeconds = -1;

  el.score.textContent = "0";
  el.time.textContent = String(s.seconds);
  el.timeStat.classList.remove("is-urgent");
  el.progress.classList.remove("is-urgent");
  el.progressBar.style.width = "100%";
  el.stage.classList.remove("is-correct", "is-wrong");

  // one keyboard for the whole round: a number pad only when every answer is a number
  el.answer.setAttribute("inputmode", s.a2n && !s.n2a ? "numeric" : "text");
  el.strip.hidden = !s.strip;
  if (s.strip) renderStrip(s.base);

  setView("play");
  showPrompt();
  clearInterval(state.timer);
  state.timer = setInterval(tick, 100);
  el.answer.focus({ preventScroll: true });
  el.trainer.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---- results view ---- */
const fmtSec = (ms) => `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
const pct = (x) => `${Math.round(x * 100)}%`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function finish(endedEarly) {
  if (!state.round) return;
  clearInterval(state.timer);
  state.timer = 0;
  const s = state.settings;
  const elapsedSec = Math.min(s.seconds, Math.round((performance.now() - state.startedAt) / 1000));
  const sum = state.round.summary({ durationSec: s.seconds, endedEarly, elapsedSec });
  state.round = null;
  state.lastSummary = sum;

  // personal best (full rounds only)
  const prev = getBest(s);
  let pbHTML = "";
  if (!endedEarly) {
    if (!prev || sum.score > prev.score) {
      setBest(s, sum.score);
      pbHTML = prev
        ? `<span class="badge gold">New personal best · was ${prev.score}</span>`
        : `<span class="badge gold">First score on the board</span>`;
    } else if (sum.score === prev.score) {
      pbHTML = `<span class="badge teal">Tied your best</span>`;
    } else {
      pbHTML = `<span class="badge">Best for these settings: ${prev.score}</span>`;
    }
  } else {
    pbHTML = `<span class="badge coral">Ended early · not counted as a best</span>`;
  }

  el.doneEyebrow.textContent = endedEarly ? "Stopped" : "Time!";
  el.doneScore.textContent = String(sum.score);
  el.doneSub.textContent = `${sum.score === 1 ? "correct answer" : "correct answers"} in ${endedEarly ? `${elapsedSec} of ${s.seconds}` : s.seconds} seconds`;
  el.donePb.innerHTML = pbHTML;

  const stats = [
    ["Misses", String(sum.misses)],
    ["Accuracy", sum.accuracy === null ? "—" : pct(sum.accuracy)],
    ["Avg per answer", sum.avgMs === null ? "—" : fmtSec(sum.avgMs)],
    ["Best streak", String(sum.bestStreak)],
    ["Revealed", String(sum.revealed)],
    ["Per minute", elapsedSec ? (sum.score / (elapsedSec / 60)).toFixed(1) : "—"],
  ];
  el.doneStats.innerHTML = stats.map(([k, v]) => `<div class="stat"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("");

  const chips = sum.trouble.map((t) => {
    const bits = [];
    if (t.revealed) bits.push(`<b>revealed</b>`);
    if (t.misses) bits.push(`<b>${t.misses}</b> ${t.misses === 1 ? "miss" : "misses"}`);
    if (t.avgMs !== null) bits.push(fmtSec(t.avgMs));
    return `<li class="chip-stat"><span class="pair"><i class="q">${esc(t.shown)}</i><span class="arr">→</span><i class="a">${esc(t.answer)}</i></span><small>${bits.join(" · ")}</small></li>`;
  }).join("");
  el.trouble.innerHTML = `
    <h3>Weak spots</h3>
    ${chips
      ? `<p class="lede">Prompts you missed, needed revealed, or answered noticeably slower than your average. Drill these.</p><ul class="chips">${chips}</ul>`
      : `<p class="none">No weak spots this round. Shorten the timer or add the other direction.</p>`}`;

  el.copy.textContent = "Copy summary";
  setView("done");
  el.doneHeading.focus({ preventScroll: true });
  el.trainer.scrollIntoView({ behavior: "smooth", block: "start" });
}

function summaryText() {
  const sum = state.lastSummary, s = state.settings;
  if (!sum) return "";
  const dir = { both: "letter↔number", a2n: "letter→number", n2a: "number→letter" }[sum.directions];
  const lines = [
    `alpha2num · ${dir} · A=${s.base} · ${sum.endedEarly ? `${sum.elapsedSec}/${s.seconds}s (ended early)` : `${s.seconds}s`}`,
    `Score ${sum.score} · ${sum.misses} misses · ${sum.accuracy === null ? "—" : pct(sum.accuracy)} accuracy · ${sum.avgMs === null ? "—" : fmtSec(sum.avgMs)} avg · best streak ${sum.bestStreak}`,
  ];
  if (sum.trouble.length) lines.push(`Weak spots: ${sum.trouble.map((t) => `${t.shown}→${t.answer}`).join(", ")}`);
  lines.push(`${location.origin}${location.pathname}?dir=${sum.directions}&t=${s.seconds}&base=${s.base}`);
  return lines.join("\n");
}

async function copySummary() {
  const text = summaryText();
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { /* fall through */ }
  if (!ok) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    ta.remove();
  }
  el.copy.textContent = ok ? "Copied!" : "Copy failed";
  setTimeout(() => { el.copy.textContent = "Copy summary"; }, 1600);
}

/* ---- wire up ---- */
function init() {
  applySettingsToForm(state.settings);

  el.setup.addEventListener("submit", (e) => { e.preventDefault(); start(); });
  [el.optA2n, el.optN2a].forEach((cb) => cb.addEventListener("change", () => { guardDirections(cb); refreshPbLine(); }));
  el.setup.addEventListener("change", (e) => { if (e.target.name === "base") refreshPbLine(); });
  el.optSeconds.addEventListener("input", () => { syncChips(); refreshPbLine(); });
  el.optSeconds.addEventListener("blur", () => { el.optSeconds.value = String(clampSeconds(el.optSeconds.value)); syncChips(); refreshPbLine(); });
  el.chips.forEach((c) => c.addEventListener("click", () => {
    el.optSeconds.value = c.dataset.seconds;
    syncChips(); refreshPbLine();
  }));

  el.answer.addEventListener("input", onAnswerInput);
  el.answer.addEventListener("keydown", onAnswerKeydown);
  el.end.addEventListener("click", () => finish(true));
  // tapping anywhere on the stage brings the keyboard back on phones
  el.stage.addEventListener("click", () => { if (state.round) el.answer.focus({ preventScroll: true }); });

  el.again.addEventListener("click", start);
  el.settingsBtn.addEventListener("click", () => { setView("setup"); refreshPbLine(); el.start.focus({ preventScroll: true }); });
  el.copy.addEventListener("click", copySummary);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.round) { e.preventDefault(); finish(true); }
  });

  setView("setup");
}

init();
