// The fiskce.com notebook look, drawn as plain SVG for places that can't load the site's CSS or fonts (a GitHub
// README shows every picture through an <img>, so no web fonts and no stylesheet). Every word is turned into
// outlines here, so it looks the same everywhere. Colours, tape, stickies and doodles are the site's own
// (app/globals.css and lib/doodles.ts on fiskce.com); the scribbles come from its icon pack (scripts/icons/).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FONTS = join(HERE, "..", "fonts");
const ICONS = join(HERE, "..", "icons");

// ---------- the palette (app/globals.css :root) ----------
export const C = {
  paper: "#fbf8f1",
  dot: "rgba(43,42,51,.14)",
  ink: "#2b2a33",
  pencil: "#6b6a75",
  pen: "#2f5bd3",
  margin: "#eaa7a7",
  card: "#ffffff",
  rule: "rgba(47,91,211,.16)",
  tape: "rgba(255,238,170,.75)",
  hl: "rgba(255,222,80,.75)",
  yellow: "#fff1a8",
  pink: "#ffd6e2",
  mint: "#cfeedd",
  sky: "#d3e7ff",
};

// ---------- fonts: Caveat for the hand, Nunito for the rest, as on the site ----------
function load(file) {
  const b = readFileSync(join(FONTS, file));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
export const F = {
  hand: load("caveat-latin-700-normal.woff"),
  handLight: load("caveat-latin-600-normal.woff"),
  sans: load("nunito-latin-600-normal.woff"),
  sansBold: load("nunito-latin-700-normal.woff"),
  sansHeavy: load("nunito-latin-800-normal.woff"),
};

const r1 = (n) => Math.round(n * 10) / 10;

export const measure = (font, str, size) => font.getAdvanceWidth(str, size);

// Each glyph is outlined once per file, in <defs>, and every letter is a <use> of it: a fraction of the size of
// outlining every word. svg() writes out the glyphs the file used and starts the next file afresh.
const glyphs = new Map();
const FONT_IDS = new Map();
const fontId = (font) => {
  if (!FONT_IDS.has(font)) FONT_IDS.set(font, `f${FONT_IDS.size}`);
  return FONT_IDS.get(font);
};

// One line of text as outlines. align: start, middle or end of the line at x.
export function text(font, str, x, y, size, fill = C.ink, align = "start") {
  const w = measure(font, str, size);
  const x0 = align === "middle" ? x - w / 2 : align === "end" ? x - w : x;
  const k = size / font.unitsPerEm;
  const uses = [];
  font.forEachGlyph(str, x0, y, size, undefined, (g, gx, gy) => {
    if (!g.path || !g.path.commands.length) return;
    const id = `${fontId(font)}g${g.index}`;
    if (!glyphs.has(id)) glyphs.set(id, g.getPath(0, 0, font.unitsPerEm).toPathData(0));
    uses.push(`<use href="#${id}" transform="translate(${r1(gx)} ${r1(gy)}) scale(${k.toFixed(4)})"/>`);
  });
  return uses.length ? `<g fill="${fill}">${uses.join("")}</g>` : "";
}

// The largest size up to max at which str fits in maxW.
export const fit = (font, str, max, maxW) => Math.min(max, (maxW / measure(font, str, max)) * max);

// Greedy word wrap: the lines of str that fit in maxW.
export function wrap(font, str, size, maxW) {
  const lines = [];
  let line = "";
  for (const word of str.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(font, next, size) > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// A wrapped paragraph. Returns the drawing and where its last baseline ended up.
export function para(font, str, x, y, size, maxW, { fill = C.ink, lh = 1.5, align = "start" } = {}) {
  const lines = wrap(font, str, size, maxW);
  const out = lines.map((l, i) => text(font, l, x, y + i * size * lh, size, fill, align));
  const last = measure(font, lines.at(-1) ?? "", size);
  return { svg: out.join(""), lines: lines.length, bottom: y + (lines.length - 1) * size * lh, last };
}

// A paragraph with highlighted words, like the site's <mark>: segments are [text, marked?].
export function markedPara(font, segments, x, y, size, maxW, { fill = C.ink, lh = 1.6 } = {}) {
  // a segment that doesn't start with a space carries on the word before it ("BERIFFA" + ": the brand")
  const words = [];
  segments.forEach(([t, mark], i) => {
    t.split(/\s+/).filter(Boolean).forEach((w, j) => {
      const glue = i > 0 && j === 0 && !/^\s/.test(t) && !/\s$/.test(segments[i - 1][0]);
      words.push({ w, mark: !!mark, glue });
    });
  });
  const space = measure(font, " ", size);
  const marks = [];
  const ink = [];
  let cx = x;
  let cy = y;
  let prev = null;
  for (const word of words) {
    const ww = measure(font, word.w, size);
    if (word.glue) cx -= space;
    if (cx > x && cx + ww > x + maxW && !word.glue) {
      cx = x;
      cy += size * lh;
      prev = null;
    }
    if (word.mark) {
      // one stroke of the highlighter per run of marked words on a line
      if (prev && prev.mark && prev.y === cy) prev.x2 = cx + ww;
      else marks.push((prev = { x1: cx, x2: cx + ww, y: cy, mark: true }));
    } else prev = { mark: false };
    ink.push(text(font, word.w, cx, cy, size, fill));
    cx += ww + space;
  }
  const hl = marks.map((m) => highlight(m.x1 - 4, m.x2 + 2, m.y, size)).join("");
  return { svg: hl + ink.join(""), bottom: cy };
}

// A highlighter stroke behind a word whose baseline is y: the lower two thirds of its x-height and a bit,
// slightly ragged at the ends as on the site.
export function highlight(x1, x2, y, size) {
  const top = y - size * 0.62;
  const bot = y + size * 0.12;
  return `<path d="M${r1(x1 + 3)} ${r1(top + 1)} L${r1(x2 - 2)} ${r1(top)} L${r1(x2)} ${r1(bot - 1)} L${r1(x1)} ${r1(bot)} Z" fill="${C.hl}"/>`;
}

// ---------- the site's doodles (lib/doodles.ts) ----------
export const DOODLES = {
  squiggle: { box: [300, 22], d: ["M4 14 C 34 4, 58 20, 92 11 S 152 3, 186 12 S 248 21, 296 8"] },
  underline: { box: [220, 16], d: ["M4 10 C 50 6, 120 4, 216 8", "M30 14 C 80 11, 140 10, 190 12"] },
  arrow: { box: [110, 56], d: ["M6 8 C 34 2, 74 10, 96 42", "M82 40 L97 44 L96 28"] },
  arrowLeft: { box: [110, 56], d: ["M104 10 C 80 2, 40 4, 12 38", "M10 22 L11 39 L27 37"] },
  arrowUpLeft: { box: [60, 64], d: ["M52 60 C 50 38, 38 18, 12 9", "M24 4 L11 9 L19 20"] },
  circle: { box: [400, 150], d: ["M44 78 C 40 26, 360 8, 384 70 C 400 126, 70 148, 24 92 C 6 66, 70 26, 150 20"] },
  tick: { box: [20, 20], d: ["M3 11 C 5 13, 7 15, 8 17 C 10 11, 13 7, 18 3"] },
};

// A doodle stretched into the box x, y, w, h (stroked like .doodle: 3.2 at its own size, kept that thick).
export function doodle(name, x, y, w, h, { color = C.pen, width = 3.2, cls = "" } = {}) {
  const { box, d } = DOODLES[name];
  const sx = w / box[0];
  const sy = h / box[1];
  return `<g transform="translate(${r1(x)} ${r1(y)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})"${cls ? ` class="${cls}"` : ""}>${d
    .map((p) => `<path d="${p}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`)
    .join("")}</g>`;
}

// A small pen arrow after a link's words ("play it →"), since Caveat has no arrow of its own. Sits on the baseline y.
export function penArrow(x, y, size, color = C.pen) {
  const s = size / 26;
  const p = (a, b) => `${r1(x + a * s)} ${r1(y + b * s)}`;
  return `<path d="M${p(1, -7)} C${p(7, -8)} ${p(13, -7)} ${p(20, -8)} M${p(14, -13)} L${p(21, -8)} L${p(14, -2)}" fill="none" stroke="${color}" stroke-width="${r1(2.6 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// A hand-drawn star, for the stars a repo has (Caveat has no ★ either). Centred at cx, cy.
export function star(cx, cy, r, color = C.ink) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${r1(cx + Math.cos(a) * rr + (i % 3 ? 0.4 : -0.3))} ${r1(cy + Math.sin(a) * rr)}`);
  }
  return `<path d="M${pts.join(" L")} Z" fill="${color}" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/>`;
}

// ---------- the icon pack ----------
// A scribble from scripts/icons/ (40 x 40, ink in currentColor), placed at x, y and drawn size big.
export function icon(file, x, y, size, color = C.ink) {
  const src = readFileSync(join(ICONS, file), "utf8");
  const [, vb] = src.match(/viewBox="([^"]+)"/);
  const [vx, vy, vw, vh] = vb.split(/\s+/).map(Number);
  const inner = src
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .trim();
  const k = size / Math.max(vw, vh);
  return `<g color="${color}" transform="translate(${r1(x)} ${r1(y)}) scale(${k.toFixed(4)}) translate(${-vx} ${-vy})">${inner}</g>`;
}

// ---------- props (app/globals.css: .sticky, .taped, .ruled, the dotted paper) ----------
export const defs = () => `<defs>
<pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.3" fill="${C.dot}"/></pattern>
<filter id="shadow" x="-10%" y="-10%" width="120%" height="135%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#000" flood-opacity=".06"/><feDropShadow dx="0" dy="9" stdDeviation="8" flood-color="#000" flood-opacity=".2"/></filter>
</defs>`;

// A sheet of the notebook's dotted paper.
export const paper = (x, y, w, h, rx = 14) =>
  `<g filter="url(#shadow)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${C.paper}"/></g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#dots)"/>`;

// A strip of masking tape, centred at cx, cy.
export const tape = (cx, cy, w = 96, h = 26, rot = -3) =>
  `<rect x="${r1(cx - w / 2)}" y="${r1(cy - h / 2)}" width="${w}" height="${h}" fill="${C.tape}" transform="rotate(${rot} ${r1(cx)} ${r1(cy)})"/>`;

// Something stuck down at a slight angle, like .tilt: body is drawn in the box's own coordinates (0, 0 at its corner).
export const tilted = (x, y, w, h, deg, body) =>
  `<g transform="translate(${r1(x)} ${r1(y)}) rotate(${deg} ${r1(w / 2)} ${r1(h / 2)})">${body}</g>`;

// A taped sticky note, w x h, in one of the four marker colours.
export const sticky = (w, h, color, inside = "") =>
  `<g filter="url(#shadow)"><rect width="${w}" height="${h}" fill="${C[color]}"/></g>${inside}${tape(w / 2, 0)}`;

// A ruled index card: white, a red margin line under the heading and pale blue rules every 32 px, as .ruled.
export function ruled(w, h, inside = "") {
  const rules = [];
  for (let y = 52 + 32; y < h - 6; y += 32) rules.push(`<path d="M0 ${y} H${w}" stroke="${C.rule}" stroke-width="1"/>`);
  return `<g filter="url(#shadow)"><rect width="${w}" height="${h}" fill="${C.card}"/></g>${rules.join("")}<path d="M0 52 H${w}" stroke="${C.margin}" stroke-width="2"/>${inside}${tape(w / 2, 0)}`;
}

// ---------- the file ----------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function svg(w, h, title, body, css = "") {
  const used = [...glyphs].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join("");
  glyphs.clear();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
<!-- Drawn by scripts/build.mjs in the fiskce.com notebook style. Icons by Mathias Fiskbæk (fiskce), https://fiskce.com/design-system/, CC BY 4.0. Caveat and Nunito, SIL OFL 1.1. -->
<title>${esc(title)}</title>
${css ? `<style>${css}</style>\n` : ""}${defs()}
<defs>${used}</defs>
${body}
</svg>
`;
}
