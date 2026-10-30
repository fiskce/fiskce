// Draws the README's pictures into assets/: `npm run build`. Everything here changes only when the words do;
// the live numbers (stats.svg) are drawn every day by scripts/stats.mjs in the profile workflow.
// The words are fiskce.com's own (app/page.tsx and lib/projects.ts there), so keep them in step with the site.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  C, F, doodle, fit, icon, markedPara, measure, para, paper, penArrow, ruled, star, sticky, svg, tape, text, tilted,
} from "./lib/notebook.mjs";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
mkdirSync(OUT, { recursive: true });
const write = (name, s) => {
  writeFileSync(join(OUT, name), s);
  console.log(`assets/${name}  ${(s.length / 1024).toFixed(0)} KB`);
};

// Every full-width picture is 1280 wide and every card 410 (shown at 32%), so the README keeps one scale throughout.
const W = 1280;

// The squiggle draws itself once, and nothing moves for anyone who asked for less motion.
const DRAW_ON = `.draw path{stroke-dasharray:700;stroke-dashoffset:700;animation:draw 1.2s .3s ease-out forwards}
@keyframes draw{to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){.draw path{animation:none;stroke-dashoffset:0}}`;

// ---------- the hero: "Hi, I'm Mathias!" ----------
function hero() {
  const H = 730;
  const x0 = 72;
  let b = paper(8, 8, W - 16, H - 28, 18);

  // the header: the wordmark (its i dotted with the fish) and where you are, as on every page of the site
  b += icon("fiskce-wordmark.svg", x0 - 8, 30, 108);
  b += text(F.hand, "/ github", x0 + 112, 84, 34, C.pencil);

  // the headline, its squiggle and the a.k.a. with its arrow
  const h1 = "Hi, I'm Mathias!";
  const h1Size = 128;
  b += text(F.hand, h1, x0, 232, h1Size);
  b += doodle("squiggle", x0 + 6, 254, 540, 34, { cls: "draw" });
  const akaX = x0 + measure(F.hand, h1, h1Size) + 40;
  b += `<g transform="rotate(-5 ${akaX + 120} 140)">${doodle("arrowLeft", akaX, 128, 110, 56)}${text(F.hand, "(a.k.a. fiskce)", akaX + 110, 128, 36, C.pen)}</g>`;

  // the intro, with the site's highlighter on the same words
  const intro = markedPara(F.sans, [
    ["I'm Mathias Fiskbæk, a developer and network operator in Copenhagen. I made "],
    ["BERIFFA", true],
    [": the brand, the beriffa.com website and BERIFFANET, the network behind it. I also build "],
    ["game engines", true],
    [", "],
    ["a casino platform", true],
    [", game-server tooling, computer-vision pipelines and 3D worlds, plus websites for clients. And I run "],
    ["my own network", true],
    [", AS219271, and an IPv6 internet exchange."],
  ], x0, 352, 25, 700, { lh: 1.62 });
  b += intro.svg;
  b += text(F.hand, "games, servers and the odd fish, all below", x0, intro.bottom + 76, 32, C.pencil);
  b += doodle("arrow", x0 + measure(F.hand, "games, servers and the odd fish, all below", 32) + 14, intro.bottom + 46, 76, 40);

  // four highlights on stickies, as under the site's hero
  const notes = [
    ["17", "stars on DayZ Server Manager", "yellow", -2.5, true],
    ["1,330", "unit tests in Mossbell", "pink", 2],
    ["4M", "simulated spins behind Sebastian", "mint", -1.5],
    ["AS219271", "BERIFFANET, my very own network", "sky", 2.5],
  ];
  const nw = 180;
  const nh = 172;
  notes.forEach(([big, small, color, deg, isStar], i) => {
    const x = 846 + (i % 2) * (nw + 26);
    const y = 290 + Math.floor(i / 2) * (nh + 34);
    const size = big.length > 6 ? 36 : 54;
    let inside = text(F.hand, big, 18, 26 + size, size);
    if (isStar) inside += starAfter(18 + measure(F.hand, big, size) + 6, 26 + size - size * 0.36, size * 0.3);
    inside += para(F.sans, small, 18, 26 + size + 34, 19, nw - 30, { lh: 1.35 }).svg;
    b += tilted(x, y, nw, nh, deg, sticky(nw, nh, color, inside));
  });

  write("hero.svg", svg(W, H, "Hi, I'm Mathias! (a.k.a. fiskce)", b, DRAW_ON));
}

// the star after "17"
const starAfter = (x, cy, r) => star(x + r, cy, r);

// ---------- a section's title, on a scrap of paper taped in ----------
function title(file, words, count, intro) {
  const size = 66;
  const tw = measure(F.hand, words, size);
  const cw = count ? measure(F.hand, `(${count})`, 30) + 16 : 0;
  const iw = intro ? measure(F.hand, intro, 30) : 0;
  const w = Math.max(tw + cw, iw) + 92;
  const H = intro ? 196 : 150;
  let inside = paper(0, 0, w, H - 30, 6);
  inside += text(F.hand, words, 44, 82, size);
  if (count) inside += text(F.hand, `(${count})`, 44 + tw + 16, 82, 30, C.pencil);
  inside += doodle("underline", 44, 92, Math.min(tw, 340), 18);
  if (intro) inside += text(F.hand, intro, 44, 150, 30, C.pencil);
  inside += tape(64, 4, 80, 24, -8);
  const b = tilted(20, 14, w, H - 30, -0.8, inside);
  write(file, svg(W, H, intro ? `${words}: ${intro}` : words, b));
}

// ---------- the games, each a sticky note that links to it ----------
const CW = 410;
const CH = 380;

function gameCard(file, { name, line, icon: ic, color, deg, go, tag }) {
  const w = 350;
  const h = 320;
  let inside = icon(ic, 22, 26, 58);
  if (tag) inside += `<g transform="rotate(8 ${w - 50} 34)">${text(F.hand, tag, w - 18, 44, 30, C.pen, "end")}</g>`;
  inside += text(F.hand, name, 22, 132, fit(F.hand, name, 46, w - 44));
  inside += para(F.sans, line, 22, 170, 19.5, w - 40, { lh: 1.4 }).svg;
  inside += text(F.hand, go, 22, h - 24, 30, C.pen);
  inside += penArrow(22 + measure(F.hand, go, 30) + 8, h - 24, 30);
  write(file, svg(CW, CH, `${name}: ${line}`, tilted(30, 32, w, h, deg, sticky(w, h, color, inside))));
}

// ---------- the code, each a ruled index card that links to its repo ----------
function codeCard(file, { name, lang, line, icon: ic, deg, go = "on GitHub" }) {
  const w = 350;
  const h = 320;
  let inside = text(F.hand, name, 20, 40, fit(F.hand, name, 36, w - 92));
  if (ic) inside += icon(ic, w - 62, 8, 42);
  inside += text(F.sansBold, lang, 20, 76, 16, C.pencil);
  // the description written on the rules, by hand
  const lines = para(F.handLight, line, 20, 112, 28, w - 36, { lh: 32 / 28 });
  inside += lines.svg;
  inside += text(F.hand, go, 20, h - 18, 28, C.pen);
  inside += penArrow(20 + measure(F.hand, go, 28) + 8, h - 18, 28);
  write(file, svg(CW, CH, `${name} (${lang}): ${line}`, tilted(30, 32, w, h, deg, ruled(w, h, inside))));
}

// A link written in pen on a strip of tape, like the site's pen links. The tape is opaque here, so it reads the same
// on GitHub's dark background.
function penLink(file, words) {
  const w = 230;
  const h = 96;
  const size = 36;
  const tw = measure(F.hand, words, size);
  let b = tilted((w - tw - 40) / 2, 24, tw + 40, 46, -2,
    `<rect width="${tw + 40}" height="46" fill="#fbeeb4"/>` + text(F.hand, words, 20, 34, size, C.pen) + doodle("underline", 20, 38, tw, 10, { width: 2.6 }));
  write(file, svg(w, h, words, b));
}

hero();

title("title-games.svg", "Games I've made", 0, "More on the shelf at fiskce.com/games");
const GAMES = [
  ["game-ink-and-dust.svg", { name: "Ink & Dust", line: "An open-world Western RPG drawn in blue ballpoint: ride out of Fort Biro with friends and fight outlaws in real time.", icon: "ink-and-dust-hat.svg", color: "pink", deg: 1.3, go: "saddle up" }],
  ["game-odd-fish.svg", { name: "Odd Fish", line: "The daily word game where weird answers win: five prompts, one cast each, and 100 fish judging you.", icon: "fish.svg", color: "yellow", deg: -1.2, go: "go fishing", tag: "daily!" }],
  ["game-fiskilization.svg", { name: "Fiskilization", line: "A tiny empire game drawn in the margins: found sticky-note cities and outwit Sebastian before the bell.", icon: "crown.svg", color: "sky", deg: 1, go: "play it" }],
];
for (const [file, g] of GAMES) gameCard(file, g);

title("title-code.svg", "Code you can read", 0, "Open source, on GitHub.");
const CODE = [
  ["code-dayz.svg", { name: "DayZ Server Manager", lang: "Bash · GPL-3.0", line: "Installs, updates, backs up and watches a DayZ server on Linux, and notes what happened when it crashes.", icon: "cover-server-rack.svg", deg: -1.4 }],
  ["code-camerax.svg", { name: "CAMERAX", lang: "Python · YOLO", line: "Real-time object detection for IP cameras: YOLO on live RTSP feeds, every detection logged.", icon: "cover-detection-box.svg", deg: 1.2 }],
  ["code-sebastian.svg", { name: "Thunder Hunter Sebastian", lang: "JavaScript · HTML5 Canvas", line: "A tumbling slot game on one canvas, its maths tuned over millions of simulated spins.", icon: "slot-machine.svg", deg: -1 }],
];
for (const [file, c] of CODE) codeCard(file, c);

for (const [file, words] of [["link-site.svg", "fiskce.com"], ["link-linkedin.svg", "LinkedIn"], ["link-x.svg", "X"], ["link-beriffa.svg", "BERIFFA"], ["link-orcid.svg", "ORCID"]]) penLink(file, words);
