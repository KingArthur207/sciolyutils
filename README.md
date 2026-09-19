# sciolyutils

Science Olympiad training tools: a hub of small, timed drill applets, grouped by
event (Codebusters first). Static site, no build step, hosted on Vercel.

- **Hub** (`/`): applets grouped under a styled heading per event ("Codebusters
  Training"). Every applet is its own page with a way back.
- **alpha2num** (`/alpha2num/`): zetamac-style sprint for letter ↔ number conversion
  (A = 0 … Z = 25, or A = 1 … Z = 26). Settings, timer, live score, personal bests,
  weak-spot report, shareable summary.

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

Runs the unit tests for the applet engines (`tests/*.test.mjs`) with Node's built-in
test runner.

## Layout

```
index.html                 Hub: hero + applet groups (rendered from the registry)
404.html                   Themed not-found page (Vercel picks it up automatically)
alpha2num/
  index.html               The applet page (settings → play → results)
  engine.js                Pure game logic, no DOM (tested)
  app.js                   Wires the engine to the page, localStorage, URL presets
assets/
  css/base.css             Design system: tokens, header/nav, buttons, cards, footer
  css/trainer.css          Shared applet UI: settings panel, HUD, tiles, results
  js/applets.js            <- applet registry: single source of truth for nav + hub + footer
  js/site.js               Renders header, footer and the hub grid on every page
  img/                     Favicon and brand mark
tests/                     node:test unit tests
tools/serve.mjs            Tiny static dev server (mirrors Vercel: index.html, 404.html)
PROMPT.md                  The build brief: goals, theme rules, conventions, applet specs
vercel.json                Vercel config (static, trailing slashes, asset caching)
```

## Add an applet

1. Create a folder with an `index.html` (copy `alpha2num/index.html` for the shell:
   `page-head` with crumbs + back link, a `.trainer` card, the `notes` cards).
2. Keep the logic in a pure `engine.js` you can unit-test, and a thin `app.js` for the DOM.
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
