import { createDrill } from "../assets/js/drill.js";
import { spec } from "./spec.js";

/* The symbols are a web font. Never let the drill start before it is in, or the tile
   would show the plain letter (the answer) for a moment. */
const start = document.getElementById("start");
const note = document.getElementById("font-note");
const fontName = spec.fontClass === "font-templar" ? "KnightsTemplar" : "StandardGalacticAlphabetSO";
const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("font timeout")), 8000));
const loaded = document.fonts ? document.fonts.load(`1em "${fontName}"`) : Promise.resolve([]);

Promise.race([loaded, timeout])
  .then((faces) => { if (document.fonts && (!faces || faces.length === 0)) throw new Error("font missing"); })
  .then(() => {
    document.documentElement.classList.add("glyphs-ready");
    createDrill(spec);
    start.disabled = false;
    if (note) note.hidden = true;
  })
  .catch(() => {
    if (note) { note.textContent = "The symbol font did not load. Check your connection and reload the page."; note.classList.add("is-warn"); note.hidden = false; }
  });
