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
