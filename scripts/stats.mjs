// The live numbers for the README, counted from GitHub and drawn in the notebook style:
//   node scripts/stats.mjs [out.svg]   (default dist/stats.svg)
//   node scripts/stats.mjs --sample [out.svg]   draws made-up numbers, to look at the drawing without asking GitHub
// The profile workflow runs it every day with its GITHUB_TOKEN, which also lets it count the year's contributions;
// without a token it still works (GitHub's public rate limit), just without that one.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { C, F, fit, highlight, measure, paper, para, ruled, star, sticky, svg, text, tilted } from "./lib/notebook.mjs";

const USER = process.env.PROFILE_USER || "fiskce";
const SAMPLE = process.argv.includes("--sample");
const OUT = process.argv.slice(2).find((a) => !a.startsWith("--")) || "dist/stats.svg";
const TOKEN = process.env.GITHUB_TOKEN;
const HEADERS = {
  accept: "application/vnd.github+json",
  "user-agent": `${USER}-profile`,
  ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
};

async function get(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function contributions() {
  if (!TOKEN) return null;
  const query = `query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar { totalContributions } } } }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...HEADERS, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const json = await res.json();
  return json.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions ?? null;
}

async function count() {
  if (SAMPLE) {
    return { repos: 31, stars: 42, followers: 27, year: 1234, langs: [["TypeScript", 0.41], ["JavaScript", 0.22], ["Python", 0.14], ["Shell", 0.11], ["Lua", 0.08], ["HTML", 0.04]] };
  }
  const user = await get(`/users/${USER}`);
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await get(`/users/${USER}/repos?type=owner&per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  const own = repos.filter((r) => !r.fork && !r.archived);

  // the languages I write most: bytes of code across my own repos, the top six
  const bytes = new Map();
  for (const r of own) {
    if (r.size === 0) continue;
    for (const [lang, n] of Object.entries(await get(`/repos/${r.full_name}/languages`))) bytes.set(lang, (bytes.get(lang) ?? 0) + n);
  }
  const total = [...bytes.values()].reduce((a, b) => a + b, 0) || 1;
  return {
    repos: own.length,
    stars: own.reduce((n, r) => n + r.stargazers_count, 0),
    followers: user.followers,
    year: await contributions(),
    langs: [...bytes].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([lang, n]) => [lang, n / total]),
  };
}

const { repos, stars, followers, year, langs } = await count();

// ---------- the drawing: stickies for the counts, a ruled card for the languages ----------
const W = 1280;
const H = 470;
const num = (n) => n.toLocaleString("en-US");
const notes = [
  [num(repos), "public repos of my own", "yellow", -2],
  [num(stars), "stars on them", "pink", 1.6, true],
  [num(followers), "followers", "mint", -1.2],
  ...(year === null ? [] : [[num(year), "contributions this past year", "sky", 2]]),
];

let b = paper(8, 8, W - 16, H - 28, 18);
const nw = 176;
const nh = 158;
notes.forEach(([big, small, color, deg, isStar], i) => {
  const x = 52 + (i % 2) * (nw + 30);
  const y = 50 + Math.floor(i / 2) * (nh + 36);
  const size = fit(F.hand, big, 56, nw - (isStar ? 74 : 36));
  let inside = text(F.hand, big, 18, 30 + 50, size);
  if (isStar) inside += star(18 + measure(F.hand, big, size) + 22, 30 + 50 - 18, 16);
  inside += para(F.sans, small, 18, 30 + 50 + 34, 18.5, nw - 30, { lh: 1.3 }).svg;
  b += tilted(x, y, nw, nh, deg, sticky(nw, nh, color, inside));
});

// languages: one highlighter stroke each, as long as its share, on the card's rules
const cx = 500;
const cw = 720;
const ch = 84 + 32 * langs.length + 34;
let card = text(F.hand, "the languages I write most", 22, 40, 34);
const barX = 220;
const barW = cw - barX - 90;
const longest = langs[0]?.[1] || 1;
langs.forEach(([lang, share], i) => {
  const y = 84 + 32 * (i + 1) - 7;
  card += text(F.hand, lang, 22, y, 27);
  card += highlight(barX, barX + Math.max(14, (share / longest) * barW), y, 30);
  card += text(F.hand, `${Math.round(share * 100) || "<1"}%`, barX + Math.max(14, (share / longest) * barW) + 14, y, 26, C.pencil);
});
b += tilted(cx, 60, cw, ch, 0.8, ruled(cw, ch, card));

const day = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Copenhagen" });
b += text(F.handLight, `counted on ${day}`, W - 56, H - 50, 28, C.pencil, "end");

const alt = `${repos} public repos, ${stars} stars, ${followers} followers${year === null ? "" : `, ${year} contributions this past year`}. The languages I write most: ${langs.map(([l, s]) => `${l} ${Math.round(s * 100)}%`).join(", ")}.`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg(W, H, alt, b));
console.log(`${OUT}: ${alt}`);
