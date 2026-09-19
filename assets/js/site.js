/* =========================================================================
   site.js: renders the shared header, navigation, hub applet groups and
   footer on every page from assets/js/applets.js.
   Loaded as: <script type="module" src="/assets/js/site.js"></script>
   ========================================================================= */
import { SITE, APPLETS, FOOTER_LINKS } from "/assets/js/applets.js";

/* ---- path helpers ---- */
const norm = (p) => {
  try { p = new URL(p, location.origin).pathname; } catch { /* keep p */ }
  p = p.replace(/index\.html$/, "");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
};
const here = norm(location.pathname);
const isCurrent = (href) => !!href && norm(href) === here;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const brandHTML = () => `
  <a class="brand" href="/">
    <img class="brand-logo" src="/assets/img/mark.svg" alt="" width="36" height="36">
    <span class="brand-text"><b>${esc(SITE.name)}</b></span>
  </a>`;

const navLink = (label, href) =>
  `<li class="nav-item"><a class="nav-link" href="${esc(href)}"${isCurrent(href) ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`;

function renderHeader() {
  const skip = document.createElement("a");
  skip.className = "skip";
  skip.href = "#main";
  skip.textContent = "Skip to content";

  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <div class="wrap nav">
      ${brandHTML()}
      <button class="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="nav-links"><span></span></button>
      <ul class="nav-links" id="nav-links">
        ${navLink("Home", "/")}
        ${APPLETS.map((a) => navLink(a.title, a.href)).join("")}
      </ul>
    </div>`;

  document.body.insertAdjacentElement("afterbegin", skip);
  skip.insertAdjacentElement("afterend", header);

  const toggle = header.querySelector(".nav-toggle");
  const links = header.querySelector(".nav-links");
  const close = () => { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); };
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  document.addEventListener("click", (e) => { if (!header.contains(e.target)) close(); });
}

function renderFooter() {
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  const appletCol = {
    title: "Applets",
    links: [{ label: "All applets", href: "/" }, ...APPLETS.map((a) => ({ label: a.title, href: a.href }))],
  };
  footer.innerHTML = `
    <div class="wrap footer-grid">
      <div class="footer-brand">
        ${brandHTML()}
        <p>Small, timed drills for the mechanical skills behind Science Olympiad events, starting with Codebusters. Built for students and the people who coach them.</p>
      </div>
      ${[appletCol, ...FOOTER_LINKS].map((col) => `
        <nav class="footer-col" aria-label="${esc(col.title)}">
          <h4>${esc(col.title)}</h4>
          <ul>${col.links.map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join("")}</ul>
        </nav>`).join("")}
    </div>
    <div class="wrap footer-bottom">
      <span>Built by ${esc(SITE.author)} · ${SITE.year}</span>
      <span>Theme adapted from <a href="https://code.sciovirtual.org/">code.sciovirtual.org</a></span>
    </div>`;
  document.body.appendChild(footer);
}

/* ---- applet hub: <div data-applet-groups></div> on the home page ----
   One styled heading per `group` (in registry order) with that group's cards. */
function appletCardHTML(a) {
  return `
    <a class="card card-link applet-card" href="${esc(a.href)}" aria-label="Open ${esc(a.title)}">
      <div class="top">
        <span class="glyph" aria-hidden="true">${esc(a.glyph)}</span>
        ${a.badge ? `<span class="badge ${esc(a.badgeTone || "")}">${esc(a.badge)}</span>` : ""}
      </div>
      <h3>${esc(a.title)}</h3>
      <p>${esc(a.desc)}</p>
      ${a.tags?.length ? `<ul class="tags" aria-label="Features">${a.tags.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      <span class="go">Open ${esc(a.title)} →</span>
    </a>`;
}

const soonCardHTML = () => `
    <div class="card applet-card soon">
      <span class="glyph" aria-hidden="true">?</span>
      <h3>More drills on the way</h3>
      <p>Have one in mind? <a href="mailto:${esc(SITE.email)}?subject=sciolyutils%20applet%20idea">Suggest it.</a></p>
    </div>`;

function renderAppletGroups() {
  const mount = document.querySelector("[data-applet-groups]");
  if (!mount) return;
  const groups = [];
  for (const a of APPLETS) {
    const name = a.group || "Applets";
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, items: [] }));
    g.items.push(a);
  }
  mount.innerHTML = groups.map((g, i) => {
    const id = "group-" + g.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const last = i === groups.length - 1;
    return `
    <section class="applet-group" aria-labelledby="${id}">
      <h2 class="group-title" id="${id}"><span>${esc(g.name)}</span></h2>
      <div class="applet-grid">${g.items.map(appletCardHTML).join("")}${last ? soonCardHTML() : ""}</div>
    </section>`;
  }).join("");
}

/* ---- boot ---- */
function boot() {
  renderHeader();
  renderFooter();
  renderAppletGroups();
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
