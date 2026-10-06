/* =========================================================================
   shell.js — small helpers shared by every drill page controller:
   guarded storage, personal bests, duration clamping, formatting, a round
   timer, result-screen fragments, and clipboard copy. No applet logic here.
   ========================================================================= */

export const MIN_SECONDS = 5, MAX_SECONDS = 3600;

/* localStorage that never throws (private mode, blocked storage) */
export const store = {
  get(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } },
};

/** Personal bests for one applet, keyed by a settings string. */
export function bestsFor(appletId) {
  const KEY = `sciolyutils:${appletId}:bests`;
  return {
    get: (k) => store.get(KEY, {})[k] || null,
    set: (k, score) => { const all = store.get(KEY, {}); all[k] = { score, at: new Date().toISOString() }; store.set(KEY, all); },
  };
}

export const clampSeconds = (v, fallback = 60) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, n));
};

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const fmtSec = (ms) => `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)}s`;
export const pct = (x) => `${Math.round(x * 100)}%`;
export const fmtInt = (n) => Number(n).toLocaleString("en-US");

/**
 * Countdown driven by performance.now(). onTick(secsLeft, fractionLeft) fires
 * about ten times a second; onDone once when time runs out.
 */
export function createTimer({ onTick, onDone }) {
  let id = 0, startedAt = 0, endAt = 0, lastSecs = -1;
  const tick = () => {
    const now = performance.now();
    const remaining = Math.max(0, endAt - now);
    const secs = Math.ceil(remaining / 1000);
    const changed = secs !== lastSecs;
    lastSecs = secs;
    onTick(secs, remaining / (endAt - startedAt), changed);
    if (remaining <= 0) { stop(); onDone(); }
  };
  const stop = () => { clearInterval(id); id = 0; };
  return {
    start(seconds) { stop(); startedAt = performance.now(); endAt = startedAt + seconds * 1000; lastSecs = -1; id = setInterval(tick, 100); },
    stop,
    get running() { return id !== 0; },
    elapsedSec() { return Math.round((performance.now() - startedAt) / 1000); },
  };
}

/** Personal-best badge for the results screen; records a new best when earned. */
export function personalBestHTML(bests, key, score, endedEarly) {
  if (endedEarly) return `<span class="badge coral">Ended early · not counted as a best</span>`;
  const prev = bests.get(key);
  if (!prev || score > prev.score) {
    bests.set(key, score);
    return prev ? `<span class="badge gold">New personal best · was ${prev.score}</span>` : `<span class="badge gold">First score on the board</span>`;
  }
  if (score === prev.score) return `<span class="badge teal">Tied your best</span>`;
  return `<span class="badge">Best for these settings: ${prev.score}</span>`;
}

export const statsHTML = (rows) =>
  rows.map(([k, v]) => `<div class="stat"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("");

/** Copy text; returns true on success. Falls back to execCommand for older browsers. */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const ta = document.createElement("textarea");
  ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();
  return ok;
}

/** Wire a "Copy summary" button: shows Copied!/Copy failed for a moment. */
export function wireCopyButton(button, getText, label = "Copy summary") {
  button.addEventListener("click", async () => {
    const ok = await copyText(getText());
    button.textContent = ok ? "Copied!" : "Copy failed";
    setTimeout(() => { button.textContent = label; }, 1600);
  });
}

/** Restart a CSS animation class on an element and clear it after `ms`. */
export function flashClass(el, cls, ms = 400, all = [cls]) {
  el.classList.remove(...all);
  void el.offsetWidth;
  el.classList.add(cls);
  clearTimeout(el._flashTimer);
  el._flashTimer = setTimeout(() => el.classList.remove(cls), ms);
}
