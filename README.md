# sciolyutils

Science Olympiad training tools: a hub of small, timed drill applets, grouped by
event (Codebusters first). Static site, no build step, hosted on Vercel.

- **Hub** (`/`): applets grouped under a styled heading per event ("Codebusters
  Training"). Every applet is its own page with a way back.
- **alpha2num** (`/alpha2num/`): zetamac-style sprint for letter ↔ number conversion
  (A = 0 … Z = 25, or A = 1 … Z = 26).
- **baconian** (`/baconian/`): letter ↔ five-letter A/B code, 24-letter (I/J, U/V) or
  26-letter table.
- **morse** (`/morse/`): letter ↔ Morse as Fractionated Morse uses it, with a tap pad for
  dots and dashes on phones; digits optional.

Every drill has the same shell: settings, timer, live score, instant advance on a right
answer, personal bests per setting, a weak-spot report, and a shareable summary.

The look matches [code.sciovirtual.org](https://code.sciovirtual.org/) (flat `#3b53d9`
blue, `#44cab2` teal, `#202525` footer, Poppins + Lato + Space Mono, pill buttons).

## Run it locally

Needs [Node.js](https://nodejs.org) 18+. No dependencies to install.

```bash
npm start
```

Open <http://localhost:8000>. (`npm run serve` does the same with Python's `http.server`
if you prefer.) The site must be served over http, not opened as a `file://` path,
because it uses JavaScript modules and root-absolute URLs.

```bash
npm test
```

Runs the unit tests for the shared engine and each applet's spec (`tests/*.test.mjs`)
with Node's built-in test runner.

## Layout

```
index.html                 Hub: hero + applet groups (rendered from the registry)
404.html                   Themed not-found page (Vercel picks it up automatically)
alpha2num/ baconian/ morse/
  index.html               The applet page (settings → play → results)
  spec.js                  What this drill converts: directions, cards, extras (pure, tested)
  app.js                   Two lines: createDrill(spec)
assets/
  css/base.css             Design system: tokens, header/nav, buttons, cards, footer
  css/trainer.css          Shared applet UI: settings panel, HUD, tiles, tap pad, results
  js/applets.js            <- applet registry: single source of truth for nav + hub + footer
  js/site.js               Renders header, footer and the hub groups on every page
  js/drill-engine.js       Shared pure game logic: decks, prefix judging, scoring, weak spots
  js/drill.js              Shared page controller: settings, timer, views, bests, presets
  img/                     Favicon and brand mark
tests/                     node:test unit tests
tools/serve.mjs            Tiny static dev server (mirrors Vercel: index.html, 404.html)
PROMPT.md                  The build brief: goals, theme rules, conventions, applet specs
vercel.json                Vercel config (static, trailing slashes, asset caching)
```

## Add an applet

1. Copy an applet folder (`baconian/` is a good template). Edit the copy in `index.html`
   and the extra settings fieldset if you need one.
2. Write `spec.js`: two directions with their cards (`{ key, shown, answer, accept?,
   answerLabel? }`), a `normalize` per direction, and any extra settings. `app.js` stays
   two lines. See the header comment in `assets/js/drill.js` for the full spec shape.
3. Register it in `assets/js/applets.js` with a `group` (e.g. `"Codebusters Training"`;
   a new event just needs a new group name). That adds it to the hub, the header nav
   and the footer.
4. Add a test file in `tests/` and run `npm test`.

See `PROMPT.md` for the full conventions and the quality bar (mobile, keyboard,
accessibility, no build step).

## Deploy to Vercel

Import the repo in Vercel: framework preset **Other**, no build command, output
directory `.`. Or from the repo root:

```bash
npx vercel
```

All links are root-absolute (`/alpha2num/`, `/assets/...`), so serve from the domain
root. To link a specific drill from elsewhere, use URL presets, for example
`/alpha2num/?dir=a2n&t=60` (`dir` = `a2n` | `n2a` | `both`, `t` = seconds,
`base` = `0` | `1`, `strip` = `1`).
