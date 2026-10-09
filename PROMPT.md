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

## Theme

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

## Header

The header lists **only the groups**, as dropdowns ("Div B & C", "Div A" via `NAV_LABELS` in
the registry; unknown groups use their full name). Each dropdown lists the group's applets
and an "All … applets" link to the hub section. Hover, focus and click open a dropdown; Escape
or a click outside closes it. Below 720px the menu button opens a panel with every group
expanded. All of it is built from `APPLETS` by `site.js`, so adding an applet or a group never
touches the header.

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

## atbash (built)

Mirror the alphabet (A ↔ Z, B ↔ Y …). Atbash is an involution, so the spec exposes a
**single direction** and no extras; the page has only the Duration fieldset. The controller
treats the direction switches, strip toggle, pad and strip as optional for this reason:
a spec may return one direction, and `dir=` URL presets are ignored then.

## The shared word pool (built)

Lives in `assets/data/words/<len>.json` for lengths 3–12, built by `tools/build-words.mjs`
and committed. Pool = ENABLE words (plurals and conjugations included) that are common in
**both** Norvig's web counts and the OpenSubtitles counts, minus proper-noun look-alikes and a
blocklist; sorted most-common-first with a tier digit per word. Each file also carries
`extra`: rarer ENABLE words that are anagrams of pool words, so a student who types one is
not told they are wrong. `assets/js/words.js` is the only way pages touch it: `load(lengths)`,
`words(len)`, `anagrams(letters)`, `extraAnagrams(letters)`, `byPattern("ABCCD", len)`,
`sample(len, { bias, skip })`. Pattern drills must reuse this module and data, never a
second list. Never put word data inside an applet folder.

## anagram (built)

Multi-answer drill on the word pool. Settings: **one length** (3–12, chips 4–8 plus a field)
or **any length 4–12** (weighted toward 4–8), and duration. A set = a scrambled word's letters
with K = the number of pool anagrams; the kicker says "Find K words". Words lock in the moment
they are complete (all anagrams share a length, so there is no prefix ambiguity). A letter the
rack lacks is wrong at once; otherwise nothing is judged until the word is full, so prefixes
leak no hints. Rarer `extra` anagrams count as bonus words. Enter on an empty box or the Skip
button gives up a set: the missed words show in coral and the player presses Enter or Next to
continue. Letter tiles are tappable for phones. Score = words found; results show sets solved,
skipped, misses, accuracy, average per word, streak, bonus, and the skipped sets with their
missed words as weak spots. Own engine (`anagram/engine.js`) and controller; shares
`shell.js`.

## templar and sga (built) — Division A symbol drills

For the elementary event (DaVinci Decoder, 4th–6th graders). Both come from
`assets/js/symbols.js` (`makeSymbolSpec`) on the shared drill engine. Symbols are rendered
with the cipher fonts from toebes/ciphers (`assets/fonts/`, BSD-3): a card's `shown` is the
plain letter and a font class turns it into the symbol, so the glyphs are exactly the
Codebusters ones. Pages gate Start on `document.fonts.load` and hide glyph elements until
`html.glyphs-ready`, so the plain letter never flashes as a hint; `font-display: block`.
Directions: **Symbol → letter** (type; what the test asks) and **Letter → symbol** (tap the
palette; keyboard ignored, `inputmode="none"`). Extras: **All letters** or **12 most common**
(E T A O I N S R H L D C, the resource-sheet order), table toggle. Knights Templar has 25
symbols with I/J shared (either letter accepted; J's symbol is I's); N is the centre X. The
hub groups applets by event division: **Division B & C ciphers** (alpha2num … anagram, porta) and
**Division A ciphers** (pigpen, tapcode, templar, sga, vigenere).

## pigpen and tapcode (built) — more Division A

**pigpen** is the symbol factory again with the standard table (grid A–I, dotted grid J–R,
X S T U V top/left/right/bottom, dotted X W X Y Z) rendered with the Pigpen Cipher font
(SIL OFL). **tapcode** has its own spec: the 5 × 5 table A–E / F–J / L–P / Q–U / V–Z with K in
C's cell (never given on the test). Read direction shows the taps the way tests print them,
dot groups `●● ●●●` (row, pause, column) or optionally numbers `2 · 3`; type the letter, C or
K both accepted for `● ●●●`. Write direction: see a letter, enter row then column (digits 1–5,
a 1–5 pad for phones); the box echoes dots. The tap map is asserted against the toebes
generator's table in tests. Table toggle renders a real 5 × 5 grid.

## vigenere (built) — the Division A math one

Decrypt given the key (test framing), encrypt optional (off by default via `defaults.dirB`).
The key sits in the gold run banner above the letter tile. **Key mode**: a fresh random letter
every prompt (run length 1, 26-key deck) or a **five-letter keyword** from a built-in list that
cycles over ten prompts (banner names the keyword and the letter position). **Learning the
math** levels, shown in a second gold *hint bubble under the letter*, never in the key banner:
"No help" (default), "Show numbers" (`R = 17 · E = 4`), "Show the math" (`B 1 − E 4 = ?` plus a
wrap reminder; the result is never given). The letter tile is smaller and the key larger than
in other drills. The **Vigenère table** toggle draws the full tabula recta *above* the letter,
as on the resource sheet, no highlights, scrollable on phones; with it on, starting a round
lands on the letter so the table shows above it. Weak spots group by key letter. Controller
hooks added for this (all additive): `spec.renderStrip(s)` (a spec draws its own reference
HTML), `dir.hintFor(card, run)` rendered into an optional `#hint` bubble, `spec.scrollOnStart(s)`
to choose where a round lands, and the key banner omits "n of n" for length-1 runs.
The coach's Division A list is now complete: pigpen, tapcode, templar, sga, vigenere.

## porta (built) — Division B & C, same shell as vigenere

Porta is reciprocal: the key letter picks row `floor(index/2)` (A,B → 0 … Y,Z → 12); a letter in
A–M at position i becomes the N–Z letter at (i + row) mod 13, a letter in N–Z at position j
becomes the A–M letter at (j − row) mod 13. That is the toebes generator's mapping and the
resource-sheet table, asserted in tests. Decrypt and encrypt are the same move (both
directions offered for framing; decrypt on by default). Key banner shows the key and its row
pair ("row E·F"); hint bubble levels: "Show numbers" (`R = N+4 · key E → row 2 (E,F)`), "Show
the math" (`R 4 − row 2 = ?` with a count-in-which-half reminder). Keyword mode and the
13-row table toggle (above the letter, side-by-side cells) work exactly as in vigenere; the
keyword list is shared in `assets/js/keywords.js`.

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
