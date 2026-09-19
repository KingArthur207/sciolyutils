/* =========================================================================
   Applet registry: the single source of truth for the hub, the header
   navigation and the footer links. Add a new applet here and it shows up
   everywhere. Each applet lives in its own folder (e.g. /alpha2num/).
   `group` is the styled heading the applet is listed under on the hub;
   applets with the same group share one grid, so a new event just needs a
   new group name (e.g. "Fermi Questions Training").
   ========================================================================= */

export const SITE = {
  name: "sciolyutils",
  tagline: "Science Olympiad training tools",
  author: "Arthur Armaing",
  email: "arthur.armaing@gmail.com",
  year: 2026,
};

export const APPLETS = [
  {
    slug: "alpha2num",
    title: "alpha2num",
    group: "Codebusters Training",
    href: "/alpha2num/",
    glyph: "A0",
    badge: "Speed drill",
    badgeTone: "teal",
    desc: "Zetamac-style sprint: a letter flashes up, you type its number (A = 0 … Z = 25), or the other way round. Race the clock, beat your best.",
    tags: ["Timed", "Both directions", "Personal bests", "Weak-spot report"],
  },
  {
    slug: "baconian",
    title: "baconian",
    group: "Codebusters Training",
    href: "/baconian/",
    glyph: "AB",
    badge: "Speed drill",
    badgeTone: "teal",
    desc: "Letters to five-letter Baconian codes and back (A = AAAAA … Z = BABBB), using the 24-letter I/J, U/V table Science Olympiad tests print. 26-letter mode too.",
    tags: ["Timed", "Both directions", "24- or 26-letter", "Weak-spot report"],
  },
  {
    slug: "morse",
    title: "morse",
    group: "Codebusters Training",
    href: "/morse/",
    glyph: "•–",
    badge: "Speed drill",
    badgeTone: "teal",
    desc: "Letters to Morse and back, the way Fractionated Morse, Morbit and Pollux need it. Type dots and dashes or tap them on the pad.",
    tags: ["Timed", "Both directions", "Tap pad for phones", "Weak-spot report"],
  },
  {
    slug: "caesar",
    title: "caesar",
    group: "Codebusters Training",
    href: "/caesar/",
    glyph: "+3",
    badge: "Speed drill",
    badgeTone: "teal",
    desc: "A shift key is dealt and held for a run of letters; encrypt or decrypt each one. Choose how many letters share a key (five by default, like classic cipher groups).",
    tags: ["Timed", "Encrypt & decrypt", "Key runs", "Weak spots per key"],
  },
];

export const FOOTER_LINKS = [
  {
    title: "Elsewhere",
    links: [
      { label: "ScioVirtual Codebusters", href: "https://code.sciovirtual.org/" },
      { label: "ScioVirtual", href: "https://www.sciovirtual.org/" },
      { label: "Science Olympiad", href: "https://www.soinc.org/" },
    ],
  },
  {
    title: "Contact",
    links: [
      { label: SITE.email, href: `mailto:${SITE.email}` },
      { label: "Suggest an applet", href: `mailto:${SITE.email}?subject=sciolyutils%20applet%20idea` },
    ],
  },
];
