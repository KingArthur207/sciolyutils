/* =========================================================================
   drill.js — the shared page controller for speed-drill applets.
   Wires drill-engine.js to the standard applet page (three views inside
   .trainer: #setup form, #play, #done). Each applet supplies a small `spec`:

     id, name                     storage namespace + display name
     defaults                     extra settings (merged over dirA/dirB/seconds/strip)
     directions(settings)         -> [dirA, dirB] (or a single direction for drills
                                  like Atbash; then the page needs no direction switches):
        { id, label, tone, cards:[{key, shown, answer, accept?, answerLabel?}]
          (or size + card(index, context) to generate them),
          run?: { length, size, context(i), label(ctx), hint?(ctx) }  — a key held for
          `length` prompts, shown in the #context banner when the page has one,
          normalize(raw), display?(canonical), sr?(card), answerLabel?(card),
          inputmode, maxlength, shownWide?, answerWide?, shownClass?, answerClass?,
          pad?: [{label, value}] }
     Cards may set statKey/statShown/statAnswer to group the weak-spot report.
     readExtras(form) / applyExtras(form, s) / urlExtras(params, s) / sanitizeExtras(s)
     extrasKey(s) / extrasLabel(s) / urlQuery(s)
     strip(settings)              -> [{ top, bottom }] columns for the reference strip

   Settings persist in localStorage; personal bests are stored per
   (directions, extras, duration). URL params can preset a round:
     ?dir=<dirA id>|<dirB id>|both&t=60&strip=1  (+ applet extras)
   ========================================================================= */
import { Round, answerLabelOf } from "./drill-engine.js";
import { store, bestsFor, clampSeconds as clampSecondsTo, esc, fmtSec, pct, createTimer, personalBestHTML, statsHTML, wireCopyButton, flashClass } from "./shell.js";

export function createDrill(spec) {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const STORE_SETTINGS = `sciolyutils:${spec.id}:settings`;
  const DEFAULTS = Object.freeze({ dirA: true, dirB: true, seconds: 60, strip: false, ...(spec.defaults || {}) });
  const bests = bestsFor(spec.id);
  const clampSeconds = (v) => clampSecondsTo(v, DEFAULTS.seconds);

  /* ---- settings helpers (a spec may expose one direction or two) ---- */
  const dirsOf = (s) => spec.directions(s);
  const enabledDirs = (s) => {
    const dirs = dirsOf(s);
    if (dirs.length === 1) return dirs;
    const [a, b] = dirs;
    return [s.dirA ? a : null, s.dirB ? b : null].filter(Boolean);
  };
  const dirsKey = (s) => (dirsOf(s).length === 1 ? dirsOf(s)[0].id : s.dirA && s.dirB ? "both" : enabledDirs(s)[0].id);
  const dirsLabel = (s) => (dirsOf(s).length === 1 ? "" : s.dirA && s.dirB ? "both directions" : enabledDirs(s)[0].label.toLowerCase());
  const extrasKey = (s) => (spec.extrasKey ? spec.extrasKey(s) : "");
  const extrasLabel = (s) => (spec.extrasLabel ? spec.extrasLabel(s) : "");
  const bestKey = (s) => `${dirsKey(s)}:${extrasKey(s)}:${s.seconds}`;
  const getBest = (s) => bests.get(bestKey(s));

  function sanitize(s) {
    s.dirA = !!s.dirA; s.dirB = !!s.dirB;
    if (!s.dirA && !s.dirB) { s.dirA = true; s.dirB = true; }
    s.strip = !!s.strip;
    s.seconds = clampSeconds(s.seconds);
    spec.sanitizeExtras?.(s);
    return s;
  }

  function loadSettings() {
    const saved = store.get(STORE_SETTINGS, {});
    const s = { ...DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
    // URL presets win over saved settings (lets a coach link a specific drill)
    const q = new URLSearchParams(location.search);
    const dir = q.get("dir");
    if (dir && dirsOf(s).length === 2) {
      const [a, b] = dirsOf(s);
      if (dir === "both") { s.dirA = true; s.dirB = true; }
      else if (dir === a.id) { s.dirA = true; s.dirB = false; }
      else if (dir === b.id) { s.dirA = false; s.dirB = true; }
    }
    if (q.has("t")) s.seconds = clampSeconds(q.get("t"));
    if (q.has("strip")) s.strip = q.get("strip") !== "0";
    spec.urlExtras?.(q, s);
    return sanitize(s);
  }

  /* ---- elements ---- */
  const el = {
    body: document.body,
    trainer: $("#trainer"),
    setup: $("#setup"), play: $("#play"), done: $("#done"),
    dirA: $("#opt-dirA"), dirB: $("#opt-dirB"), optStrip: $("#opt-strip"), optSeconds: $("#opt-seconds"),
    dirHelp: $("#dir-help"), chips: $$(".chip[data-field]"), pbLine: $("#pb-line"), start: $("#start"),
    time: $("#time"), timeStat: $("#time-stat"), score: $("#score"), end: $("#end"),
    progress: $("#progress"), progressBar: $("#progress-bar"),
    stage: $("#stage"), kicker: $("#kicker"), context: $("#context"), tile: $("#tile"), tileText: $("#tile-text"), tileSr: $("#tile-sr"),
    answer: $("#answer"), pad: $("#pad"), reveal: $("#reveal"), strip: $("#strip"),
    doneEyebrow: $("#done-eyebrow"), doneHeading: $("#done-heading"), doneScore: $("#done-score"), doneSub: $("#done-sub"),
    donePb: $("#done-pb"), doneStats: $("#done-stats"), trouble: $("#trouble"),
    again: $("#again"), settingsBtn: $("#settings"), copy: $("#copy"),
  };
  const DIR_HELP_DEFAULT = el.dirHelp ? el.dirHelp.textContent : "";

  const state = {
    settings: loadSettings(),
    round: null,
    lastSummary: null,
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

  /* ---- setup view ---- */
  function applySettingsToForm(s) {
    if (el.dirA) el.dirA.checked = s.dirA;
    if (el.dirB) el.dirB.checked = s.dirB;
    if (el.optStrip) el.optStrip.checked = s.strip;
    el.optSeconds.value = String(s.seconds);
    spec.applyExtras?.(el.setup, s);
    syncChips();
    refreshPbLine();
  }

  function readForm() {
    return sanitize({
      ...DEFAULTS,
      dirA: el.dirA ? el.dirA.checked : true,
      dirB: el.dirB ? el.dirB.checked : true,
      seconds: clampSeconds(el.optSeconds.value),
      strip: el.optStrip ? el.optStrip.checked : false,
      ...(spec.readExtras ? spec.readExtras(el.setup) : {}),
    });
  }

  /* quick-set chips: <button class="chip" data-field="seconds" data-value="60"> sets that form field */
  const chipTarget = (c) => el.setup.elements[c.dataset.field];
  function syncChips() {
    el.chips.forEach((c) => {
      const t = chipTarget(c);
      c.setAttribute("aria-pressed", t && String(t.value) === c.dataset.value ? "true" : "false");
    });
  }

  function refreshPbLine() {
    const s = readForm();
    const best = getBest(s);
    const what = [dirsLabel(s), extrasLabel(s), `${s.seconds}s`].filter(Boolean).join(", ");
    el.pbLine.innerHTML = best
      ? `Your best for ${esc(what)}: <b>${best.score}</b>`
      : `No rounds yet for ${esc(what)}. Set the bar.`;
  }

  function guardDirections(changed) {
    if (!el.dirA.checked && !el.dirB.checked) {
      changed.checked = true;                       // refuse to turn off the last direction
      el.dirHelp.textContent = "Keep at least one direction on.";
      el.dirHelp.classList.add("is-warn");
      changed.nextElementSibling?.animate?.(
        [{ transform: "translateX(0)" }, { transform: "translateX(-5px)" }, { transform: "translateX(5px)" }, { transform: "translateX(0)" }],
        { duration: 260, easing: "ease-out" }
      );
      return false;
    }
    el.dirHelp.textContent = DIR_HELP_DEFAULT;
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

  function renderStrip(s) {
    if (!el.strip) return;
    const cols = spec.strip ? spec.strip(s) : null;
    if (!cols) { el.strip.hidden = true; return; }
    el.strip.innerHTML = cols.map((c) =>
      `<span class="ref-col"><span class="ref-cell l${c.top.length > 1 ? " code" : ""}">${esc(c.top)}</span><span class="ref-cell n${c.bottom.length > 2 ? " code" : ""}">${esc(c.bottom)}</span></span>`
    ).join("");
    el.strip.hidden = false;
  }

  const display = (dir, canonical) => (dir.display ? dir.display(canonical) : canonical);

  function renderPad(dir) {
    if (!el.pad) return;
    if (!dir.pad?.length) { el.pad.hidden = true; el.pad.innerHTML = ""; return; }
    el.pad.innerHTML = dir.pad.map((k) =>
      `<button type="button" data-key="${esc(k.value)}" aria-label="${esc(k.label)}">${esc(k.label)}</button>`
    ).join("") + `<button type="button" class="bksp" data-key="\b" aria-label="Backspace">⌫</button>`;
    el.pad.hidden = false;
  }

  function renderRun(dir, run) {
    if (!el.context) return;
    if (!run || !dir.run) { el.context.hidden = true; el.context.innerHTML = ""; return; }
    const dots = run.length <= 10
      ? `<span class="dots" aria-hidden="true">${Array.from({ length: run.length }, (_, i) => `<i${i < run.position ? ' class="on"' : ""}></i>`).join("")}</span>`
      : "";
    el.context.innerHTML = `
      <span class="k">Key</span><b class="key">${esc(dir.run.label(run.context))}</b>
      ${dir.run.hint ? `<span class="hint">${esc(dir.run.hint(run.context))}</span>` : ""}
      <span class="pos">${dots}<span>${run.position} of ${run.length}</span></span>`;
    el.context.hidden = false;
    el.context.classList.toggle("is-new", run.position === 1);
  }

  function showPrompt() {
    const { dir, card, run } = state.round.next(performance.now());
    renderRun(dir, run);
    el.kicker.textContent = dir.label;
    el.kicker.className = `stage-kicker ${dir.tone === "teal" ? "n2a" : ""}`;
    el.tileText.textContent = card.shown;
    el.tile.className = `tile${dir.shownWide ? " is-wide" : ""}${dir.shownClass ? ` ${dir.shownClass}` : ""}`;
    el.tileSr.textContent = dir.sr ? dir.sr(card) : `${card.shown}. Type the answer.`;
    el.answer.className = `tile-input${dir.answerWide ? " is-wide" : ""}${dir.answerClass ? ` ${dir.answerClass}` : ""}`;
    el.answer.setAttribute("aria-label", dir.answerLabel ? dir.answerLabel(card) : `Answer for ${card.shown}`);
    el.answer.value = "";
    el.reveal.textContent = "";
    renderPad(dir);
  }

  const flash = (cls) => flashClass(el.stage, cls, 400, ["is-correct", "is-wrong"]);

  function feed(canonical, { commit = false } = {}) {
    const { dir } = state.round.current;
    const pretty = display(dir, canonical);
    if (el.answer.value !== pretty) el.answer.value = pretty;
    handleVerdict(state.round.submit(canonical, performance.now(), { commit }));
  }

  function onAnswerInput() {
    if (!state.round) return;
    const { dir } = state.round.current;
    feed(dir.normalize(el.answer.value));
  }

  function onAnswerKeydown(e) {
    if (e.key === "Escape") { e.preventDefault(); finish(true); return; }
    if (e.key !== "Enter" || !state.round) return;
    e.preventDefault();
    const { dir } = state.round.current;
    const typed = dir.normalize(el.answer.value);
    if (!typed) return;
    feed(typed, { commit: true });
  }

  function onPadClick(e) {
    const btn = e.target.closest("button[data-key]");
    if (!btn || !state.round) return;
    const { dir } = state.round.current;
    const cur = dir.normalize(el.answer.value);
    const key = btn.dataset.key;
    feed(key === "\b" ? cur.slice(0, -1) : cur + key);
    el.answer.focus({ preventScroll: true });
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
        const { dir, card } = state.round.current;
        el.reveal.innerHTML = `Answer: <b>${esc(answerLabelOf(dir, card))}</b> — type it to move on (no point for this one).`;
      }
    }
  }

  function start() {
    const s = readForm();
    state.settings = s;
    store.set(STORE_SETTINGS, s);
    el.optSeconds.value = String(s.seconds);
    syncChips();

    const dirs = enabledDirs(s);
    state.round = new Round({ directions: dirs });

    el.score.textContent = "0";
    el.time.textContent = String(s.seconds);
    el.timeStat.classList.remove("is-urgent");
    el.progress.classList.remove("is-urgent");
    el.progressBar.style.width = "100%";
    el.stage.classList.remove("is-correct", "is-wrong");

    // one keyboard for the whole round: a special keyboard only if every direction agrees
    const modes = new Set(dirs.map((d) => d.inputmode || "text"));
    el.answer.setAttribute("inputmode", modes.size === 1 ? [...modes][0] : "text");
    el.answer.setAttribute("maxlength", String(Math.max(...dirs.map((d) => d.maxlength || 2))));
    if (s.strip && spec.strip) renderStrip(s); else if (el.strip) el.strip.hidden = true;

    setView("play");
    showPrompt();
    timer.start(s.seconds);
    el.answer.focus({ preventScroll: true });
    el.trainer.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---- results view ---- */
  function finish(endedEarly) {
    if (!state.round) return;
    timer.stop();
    const s = state.settings;
    const elapsedSec = Math.min(s.seconds, timer.elapsedSec());
    const sum = state.round.summary({ durationSec: s.seconds, endedEarly, elapsedSec });
    state.round = null;
    state.lastSummary = sum;

    el.doneEyebrow.textContent = endedEarly ? "Stopped" : "Time!";
    el.doneScore.textContent = String(sum.score);
    el.doneSub.textContent = `${sum.score === 1 ? "correct answer" : "correct answers"} in ${endedEarly ? `${elapsedSec} of ${s.seconds}` : s.seconds} seconds`;
    el.donePb.innerHTML = personalBestHTML(bests, bestKey(s), sum.score, endedEarly);

    const stats = [
      ["Misses", String(sum.misses)],
      ["Accuracy", sum.accuracy === null ? "—" : pct(sum.accuracy)],
      ["Avg per answer", sum.avgMs === null ? "—" : fmtSec(sum.avgMs)],
      ["Best streak", String(sum.bestStreak)],
      ["Revealed", String(sum.revealed)],
      ["Per minute", elapsedSec ? (sum.score / (elapsedSec / 60)).toFixed(1) : "—"],
    ];
    el.doneStats.innerHTML = statsHTML(stats);

    const chips = sum.trouble.map((t) => {
      const bits = [];
      if (t.revealed) bits.push(`<b>revealed</b>`);
      if (t.misses) bits.push(`<b>${t.misses}</b> ${t.misses === 1 ? "miss" : "misses"}`);
      if (t.avgMs !== null) bits.push(fmtSec(t.avgMs));
      const pair = t.answerLabel
        ? `<i class="q">${esc(t.shown)}</i><span class="arr">→</span><i class="a">${esc(t.answerLabel)}</i>`
        : `<i class="q">${esc(t.shown)}</i>`;
      return `<li class="chip-stat"><span class="pair">${pair}</span><small>${bits.join(" · ")}</small></li>`;
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
    const head = [spec.name, dirsLabel(s), extrasLabel(s), sum.endedEarly ? `${sum.elapsedSec}/${s.seconds}s (ended early)` : `${s.seconds}s`].filter(Boolean).join(" · ");
    const lines = [
      head,
      `Score ${sum.score} · ${sum.misses} misses · ${sum.accuracy === null ? "—" : pct(sum.accuracy)} accuracy · ${sum.avgMs === null ? "—" : fmtSec(sum.avgMs)} avg · best streak ${sum.bestStreak}`,
    ];
    if (sum.trouble.length) lines.push(`Weak spots: ${sum.trouble.map((t) => (t.answerLabel ? `${t.shown}→${t.answerLabel}` : t.shown)).join(", ")}`);
    const extra = spec.urlQuery ? `&${spec.urlQuery(s)}` : "";
    lines.push(`${location.origin}${location.pathname}?dir=${dirsKey(s)}&t=${s.seconds}${extra}`);
    return lines.join("\n");
  }

  /* ---- wire up ---- */
  function init() {
    applySettingsToForm(state.settings);

    el.setup.addEventListener("submit", (e) => { e.preventDefault(); start(); });
    [el.dirA, el.dirB].filter(Boolean).forEach((cb) => cb.addEventListener("change", () => { guardDirections(cb); refreshPbLine(); }));
    el.setup.addEventListener("change", (e) => { if (e.target !== el.dirA && e.target !== el.dirB) refreshPbLine(); });
    el.setup.addEventListener("input", (e) => { if (e.target.matches('input[type="number"]')) { syncChips(); refreshPbLine(); } });
    // leaving a number field snaps it into range (seconds 5–3600, applet extras via sanitizeExtras)
    el.setup.addEventListener("focusout", (e) => { if (e.target.matches('input[type="number"]')) applySettingsToForm(readForm()); });
    el.chips.forEach((c) => c.addEventListener("click", () => {
      const t = chipTarget(c);
      if (t) t.value = c.dataset.value;
      syncChips(); refreshPbLine();
    }));

    el.answer.addEventListener("input", onAnswerInput);
    el.answer.addEventListener("keydown", onAnswerKeydown);
    if (el.pad) {
      el.pad.addEventListener("click", onPadClick);
      el.pad.addEventListener("mousedown", (e) => e.preventDefault()); // keep focus in the answer box on desktop
    }
    el.end.addEventListener("click", () => finish(true));
    // tapping the stage brings the keyboard back on phones
    el.stage.addEventListener("click", (e) => { if (state.round && !e.target.closest("#pad")) el.answer.focus({ preventScroll: true }); });

    el.again.addEventListener("click", start);
    el.settingsBtn.addEventListener("click", () => { setView("setup"); refreshPbLine(); el.start.focus({ preventScroll: true }); });
    wireCopyButton(el.copy, summaryText);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && state.round) { e.preventDefault(); finish(true); }
    });

    setView("setup");
  }

  init();
}
