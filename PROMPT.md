# sciolyutils — build brief

This is the brief the site was built from, kept here so future applets are built the
same way. Read it before adding or changing anything.

## Mission

A small, fast website of **drill applets for Science Olympiad**, Codebusters first, built
by a Codebusters instructor to train "intrinsics": the mechanical sub-skills (letter ↔ number
recall, mod-26 arithmetic, table lookups) that cost seconds on every cipher. Students
should be able to open it on a phone or laptop, pick a drill, and be practising in one tap.

## Non-negotiables

- **Static, no build step, no framework.** Plain HTML/CSS/ES modules. Edit, push, done.
- **Hosted on Vercel** from the repo root (`vercel.json` is checked in). All URLs are
  root-absolute (`/alpha2num/`, `/assets/...`). Each applet is a folder with `index.html`.
- **A hub page** (`/`) lists every applet under a styled heading per event (the registry's
  `group`, e.g. "Codebusters Training"); the brand is just "sciolyutils" so other events fit later. **Every applet has its own page** named after the
  applet, and **at least two ways back** to the hub: the header brand/nav and a visible
  back link in the page head. The applet registry in `assets/js/applets.js` is the single
  source of truth for the hub grid, header nav and footer.
- **Works on phones and computers.** No horizontal scroll at 360px. Inputs are ≥16px so
  iOS does not zoom. During a round the layout stays usable with the keyboard open.
- **Keyboard-first and accessible.** Real form controls (checkbox/radio/number) styled
  with CSS, visible focus rings, labels or `aria-label` on every control, live regions for
  prompts and reveals, focus moved sensibly on view changes, reduced-motion respected.
- **Careful, tested logic.** Game logic lives in the shared pure `assets/js/drill-engine.js`
  and each applet's pure `spec.js`, with unit tests under `tests/` (`npm test`). The shared
  DOM controller `assets/js/drill.js` stays the only place that touches the page.
- Storage is best-effort `localStorage` (guarded; private mode must not break anything).

## Theme (from code.sciovirtual.org)

Tokens live in `assets/css/base.css`; never hard-code colours in a page.

- Brand blue `#3b53d9` (sticky header, page-head band, hero), teal `#44cab2` (accents,
  success), night `#202525` (footer, cipher tiles), gold `#f5b942` (reveals/PB), coral
  `#e0604a` (errors/urgency). White surfaces, `#fafafa` alternate sections.
- Type: **Poppins** for headings/labels/buttons, **Lato** for body, **Space Mono** for
  anything cipher-like (prompts, answers, applet names).
- Buttons: 25px pill, 3px border, Poppins 600. Cards: 20px radius, soft indigo shadow.
- The hub hero is a flat blue band with the faint big circle and the white notch at the
  bottom. Interior pages use the flat `page-head` band with crumbs.
- The signature motif is the **cipher cell**: dark tile for the given, white bordered tile
  for the answer, teal when solved. Reuse it (`trainer.css`) rather than inventing new UI.

## Applet conventions

Each applet = `/<slug>/index.html` + `spec.js` (directions, cards, extras; pure) + a
two-line `app.js` (`createDrill(spec)`), plus a registry entry (`slug, title, group, href,
glyph, badge, desc, tags`) and spec tests. Directions can mark long prompts/answers
`shownWide`/`answerWide`, provide a `display` for pretty output (Morse dots), accept several
answers per card (Baconian I/J), and offer a tap `pad` for symbols phones lack.

Quick-set chips are `<button class="chip" data-field="<form field>" data-value="…">`; the controller
wires them to any field in the setup form. Page structure: `page-head` (crumbs, mono title,
one-paragraph lead, back link) →
`.trainer` card with three views: **setup** (form; Enter starts), **play** (HUD with time
and score, prompt tile, small answer box, optional aids), **done** (big score, PB badge,
stat grid, weak-spot chips, Play again / Change settings / Copy summary) → three short
`notes` cards (why, how to get fast, for coaches).

Behaviour: settings persist per applet; URL params can preset a round; personal bests are
keyed by the settings that change difficulty; ending early never records a best; results
name what to practise next.

## alpha2num (built)

Zetamac-style speed drill for `A–Z ↔ 0–25`.

- Settings: **Letter → number** and **Number → letter** switches (both on by default; the
  last one on cannot be turned off, the UI says so), **numbering** A = 0 (default, the
  Codebusters convention) or A = 1, **duration** quick-set pills (30/60/90/120/180) plus a
  custom seconds field (5–3600), optional **A–Z reference strip**.
- Play: one prompt at a time in a big dark tile with a small kicker naming the direction;
  the answer goes in the small box below. A correct answer advances instantly (no Enter);
  digits typed for a two-digit number are "pending" until they can no longer match, then
  the box shakes, clears, and a miss is counted. Enter commits a partial answer as wrong.
  After three misses on one prompt the answer is revealed; typing it moves on without a
  point. Prompts come from a shuffled deck per direction so every letter appears once per
  26. The score and seconds-left counters update live; the last five seconds go coral.
- Done: score, PB per (directions, numbering, duration), misses, accuracy, average time,
  best streak, revealed count, per-minute rate, weak spots (missed, revealed, or slow
  prompts), Copy summary (plain text with a preset link).
- Keyboard: Enter starts, Esc ends early. Mobile: a numeric keypad only when every
  answer is a number; otherwise the text keyboard for the whole round.

## baconian (built)

Same shell as alpha2num for letter ↔ five-letter A/B code. Default **24-letter table**
(I/J share ABAAA, U/V share BAABB, as printed on Science Olympiad tests; either letter is
accepted), optional **26-letter** table (index in binary, A = 0). 0/1 may be typed for A/B.
Codes are shown in a wide tile; the answer box is wide.

## morse (built)

Same shell for letter ↔ Morse as Fractionated Morse, Morbit and Pollux use it. Letters only
by default, **digits 0–9** optional. Canonical answers use `.`/`-`; the page displays `•`/`–`
and accepts `.`, `,`, `•` for dots and `-`, `_`, `–`, `—` for dashes. A two-key **tap pad**
(plus backspace) sits under the answer box for phones. Screen readers hear "dit"/"dah".

## caesar (built)

Same shell for the Caesar shift, with **key runs**: a key (1–25, dealt from its own deck so
every key comes up before any repeats) is shown in a gold banner and held for **N
consecutive letters** (default 5, like classic five-letter groups; 1–99 via chips or a
field), then a new key is dealt. The direction (encrypt: plain + key; decrypt: cipher − key)
stays fixed for a whole run. The key can be shown as a shift number (default) or as the
letter A maps to. Weak spots group by signed shift ("shift +7", "shift −19"), not by letter.
Engine support: directions may generate cards (`size` + `card(index, context)`) and declare
`run { length, size, context(i), label, hint }`; cards may set `statKey/statShown/statAnswer`.

## Quality bar before shipping a change

1. `npm test` passes.
2. Open the hub and the applet at desktop and at 375px wide: no overflow, nav toggle
   works, back links work, tab order is sane, focus rings visible.
3. Play a full round with the keyboard only, then one on a phone-sized viewport.
4. Try the 404 (`/nope`) and a preset link (`/alpha2num/?dir=n2a&t=30`).

## Backlog ideas (not built)

- **mod26**: multiply mod 26 and the Affine decode step (the additive part is now `caesar`).
- **affine-inverse**: recall the multiplicative inverses mod 26 (1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25).
- **polybius**: coordinate ↔ letter for a keyed 5×5 square.
- **freq-rank**: order letters by English frequency (ETAOIN SHRDLU).
