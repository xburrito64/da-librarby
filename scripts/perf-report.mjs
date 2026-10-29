// Turns the stress test's results (src/perf/stress.ts) into a page: for each routine and theme how
// smooth it was (missed frames, against the goal), how much of the processor and graphics card the
// app used, the video's dropped frames, and what changed since the run before.
// Usage:  node scripts/perf-report.mjs [results folder]   (default .debug/perf; writes report.html there)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] ?? ".debug/perf");
const runs = readdirSync(dir)
  .filter((f) => /^run-.*\.json$/.test(f))
  .sort()
  .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), "utf8")) }));
if (runs.length === 0) throw new Error(`No results in ${dir}`);
const run = runs[runs.length - 1];
const before = runs.length > 1 ? runs[runs.length - 2] : null;

/** Steady: should be smooth all the way. Moments: something new appearing, a looser goal. */
const GOAL = { steady: 0.1, moment: 1 };

const NAMES = {
  idle: ["Home screen, left alone", "10 seconds of the theme's animations and the spotlight"],
  "home-scroll": ["Scrolling the home screen", "down to the end and back up, like a quick mouse wheel"],
  "row-paging": ["Paging a row of covers", "the arrows, three pages along and back"],
  "grid-scroll": ["Scrolling the cover grid", "the biggest kind's page, down and back up"],
  "show-scroll": ["Scrolling a show page", "the show with the most seasons, down through its episodes"],
  "settings-scroll": ["Scrolling Settings", "Appearance, with the theme previews"],
  "player-controls": ["Video with its controls", "the mouse moving over the player"],
  "player-idle": ["Video on its own", "controls hidden"],
  "corner-browse": ["Corner player while browsing", "scrolling the home screen with the video in the corner"],
  "theme-switch": ["Switching to the theme", ""],
  "tab-switch": ["Opening the cover grid", "from the home screen"],
  "show-open": ["Opening a show page", "from its cover, three different shows"],
  "show-seasons": ["Season tabs", "clicking through them"],
  "show-close": ["Closing a show page", "back into its cover"],
  search: ["Typing a search", "letter by letter, then deleting it"],
  "settings-open": ["Opening Settings", ""],
  "settings-close": ["Closing Settings", ""],
  "play-start": ["Starting a video", "the theme's intro included"],
  "corner-open": ["Going to the corner player", ""],
};
const ORDER = Object.keys(NAMES);
const THEME_NAMES = { velvet: "Velvet", paper: "Paper", neon: "Neon", mochi: "Mochi", snowdin: "Snowdin", hollow: "Hollow's Eve" };

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmtPct = (n) => (n < 0.01 && n > 0 ? "<0.01" : n < 10 ? n.toFixed(2) : n.toFixed(1));
const themesOf = (r, big) => [...new Set(r.results.filter((x) => x.big === big).map((x) => x.theme))];
const find = (r, big, theme, scenario) => r?.results.find((x) => x.big === big && x.theme === theme && x.scenario === scenario);

function tier(x) {
  const goal = GOAL[x.kind];
  return x.frames.missedPct <= goal ? "good" : x.frames.missedPct <= goal * 10 ? "close" : "bad";
}

function cell(x, prev) {
  if (!x) return `<td class="none">–</td>`;
  const t = tier(x);
  let change = "";
  if (prev) {
    const d = x.frames.missedPct - prev.frames.missedPct;
    if (Math.abs(d) >= Math.max(0.05, prev.frames.missedPct * 0.15))
      change = `<span class="chg ${d < 0 ? "up" : "down"}">${d < 0 ? "▼" : "▲"} was ${fmtPct(prev.frames.missedPct)}%</span>`;
  }
  const took = x.took ? ` · ${x.took.avg} ms` : "";
  const tip = `${x.frames.frames} frames over ${x.frames.seconds} s · typical ${x.frames.p50} ms · 99% under ${x.frames.p99} ms · slowest ${x.frames.worst} ms · processor ${x.cpu}% · graphics ${x.gpu ?? "?"}%`;
  return `<td class="c ${t}" title="${esc(tip)}"><span class="miss">${fmtPct(x.frames.missedPct)}%</span><span class="sub">${Math.round(x.frames.fps)} fps · worst ${Math.round(x.frames.worst)} ms${took}</span>${change}</td>`;
}

function table(big, kind) {
  const themes = themesOf(run, big);
  const scenarios = ORDER.filter((s) => run.results.some((x) => x.big === big && x.scenario === s && x.kind === kind));
  if (scenarios.length === 0) return "";
  const rows = scenarios
    .map((s) => {
      const [name, hint] = NAMES[s] ?? [s, ""];
      return `<tr><th scope="row"><span class="name">${esc(name)}</span>${hint ? `<span class="hint">${esc(hint)}</span>` : ""}</th>${themes
        .map((t) => cell(find(run, big, t, s), find(before, big, t, s)))
        .join("")}</tr>`;
    })
    .join("");
  return `<div class="scroll"><table><thead><tr><th></th>${themes.map((t) => `<th scope="col">${esc(THEME_NAMES[t] ?? t)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function usageTable() {
  const themes = themesOf(run, null);
  const line = (label, hint, get) =>
    `<tr><th scope="row"><span class="name">${label}</span><span class="hint">${hint}</span></th>${themes.map((t) => `<td class="u">${get(t)}</td>`).join("")}</tr>`;
  const idle = (t) => find(run, null, t, "idle");
  const peak = (t) => Math.max(...run.results.filter((x) => x.big === null && x.theme === t).map((x) => x.memory));
  return `<div class="scroll"><table><thead><tr><th></th>${themes.map((t) => `<th scope="col">${esc(THEME_NAMES[t] ?? t)}</th>`).join("")}</tr></thead><tbody>
${line("Processor, sitting still", "share of the whole processor, as Task Manager shows it", (t) => (idle(t) ? `${idle(t).cpu}%` : "–"))}
${line("Graphics card, sitting still", "the busiest part of the graphics card", (t) => (idle(t)?.gpu != null ? `${idle(t).gpu}%` : "–"))}
${line("Memory, at most", "the app, its web view and the video player together", (t) => `${peak(t)} MB`)}
</tbody></table></div>`;
}

function videoTable() {
  const rows = run.results.filter((x) => x.video && x.big === null);
  if (rows.length === 0) return "<p>No video was played.</p>";
  return `<div class="scroll"><table><thead><tr><th></th><th scope="col">Theme</th><th scope="col">Dropped</th><th scope="col">Shown late</th><th scope="col">Seconds</th></tr></thead><tbody>${rows
    .map(
      (x) =>
        `<tr><th scope="row"><span class="name">${esc(NAMES[x.scenario]?.[0] ?? x.scenario)}</span></th><td class="u">${esc(THEME_NAMES[x.theme] ?? x.theme)}</td><td class="u ${x.video.dropped + x.video.decoderDropped ? "badtext" : ""}">${x.video.dropped + x.video.decoderDropped}</td><td class="u ${x.video.delayed ? "badtext" : ""}">${x.video.delayed}</td><td class="u">${x.video.seconds.toFixed(1)}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function slowest() {
  const all = run.results
    .flatMap((x) => x.frames.slow.map((s) => ({ ...s, x })))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 12);
  if (all.length === 0) return "<p>No frame took longer than 50 ms.</p>";
  return `<ol class="slow">${all
    .map((s) => `<li><b>${s.ms} ms</b> · ${esc(THEME_NAMES[s.x.theme] ?? s.x.theme)}${s.x.big ? " (big library)" : ""} · ${esc(NAMES[s.x.scenario]?.[0] ?? s.x.scenario)} <span class="hint">${esc(s.what)}</span></li>`)
    .join("")}</ol>`;
}

const steady = run.results.filter((x) => x.kind === "steady" && x.big === null);
const met = steady.filter((x) => tier(x) === "good").length;
const moments = run.results.filter((x) => x.kind === "moment" && x.big === null);
const momentsMet = moments.filter((x) => tier(x) === "good").length;
const bigSize = run.results.find((x) => x.big)?.big;
const date = new Date(run.startedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Da Librarby Performance</title>
<style>
:root { --bg:#f6f4f1; --panel:#fff; --text:#1d1a17; --muted:#6c655d; --line:#e3ded7; --good:#1f7a4d; --good-bg:#e3f3ea; --close:#946200; --close-bg:#fbf0d6; --bad:#b3261e; --bad-bg:#fbe4e2; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg:#141311; --panel:#1d1b19; --text:#efebe6; --muted:#a39b91; --line:#33302c; --good:#6fd39b; --good-bg:#183526; --close:#f0c35a; --close-bg:#3a2f12; --bad:#ff8a80; --bad-bg:#40191a; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 "Segoe UI", system-ui, sans-serif; padding-inline:16px; }
main { max-width:1180px; margin:0 auto; padding-block:32px 64px; display:grid; gap:28px; }
h1 { font-size:28px; margin:0; letter-spacing:-0.01em; }
h2 { font-size:19px; margin:0 0 4px; }
p { margin:0; max-width:70ch; }
.meta { color:var(--muted); font-size:13.5px; }
.cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
.card b { display:block; font-size:26px; font-variant-numeric:tabular-nums; }
.card span { color:var(--muted); font-size:13px; }
section { display:grid; gap:10px; }
.scroll { overflow-x:auto; background:var(--panel); border:1px solid var(--line); border-radius:10px; }
table { border-collapse:collapse; width:100%; font-variant-numeric:tabular-nums; }
th, td { padding:8px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; }
thead th { font-size:12px; text-transform:uppercase; letter-spacing:0.06em; color:var(--muted); white-space:nowrap; }
tbody tr:last-child > * { border-bottom:0; }
th[scope=row] { min-width:220px; font-weight:400; }
.name { display:block; font-weight:600; }
.hint { display:block; color:var(--muted); font-size:12.5px; }
.c { min-width:120px; }
.c .miss { display:block; font-weight:700; font-size:16px; }
.c .sub { display:block; font-size:12px; color:var(--muted); }
.c.good .miss { color:var(--good); } .c.good { background:var(--good-bg); }
.c.close .miss { color:var(--close); } .c.close { background:var(--close-bg); }
.c.bad .miss { color:var(--bad); } .c.bad { background:var(--bad-bg); }
.chg { display:block; font-size:11.5px; font-weight:600; }
.chg.up { color:var(--good); } .chg.down { color:var(--bad); }
.u { white-space:nowrap; }
.badtext { color:var(--bad); font-weight:700; }
.legend { display:flex; flex-wrap:wrap; gap:8px 18px; font-size:13px; color:var(--muted); }
.legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; vertical-align:-1px; }
.slow { margin:0; padding-left:22px; display:grid; gap:6px; }
.errors { color:var(--bad); }
</style></head><body><main>
<header style="display:grid;gap:6px">
<h1>Da Librarby performance</h1>
<p class="meta">${esc(date)}${run.label ? ` · “${esc(run.label)}”` : ""} · version ${esc(run.version)} · ${run.screen.width}×${run.screen.height} at ${run.screen.refreshHz} Hz · ${run.library.titles} titles, ${run.library.episodes} files · took ${run.minutes} min${before ? ` · compared with ${esc(new Date(before.startedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }))}${before.label ? ` (“${esc(before.label)}”)` : ""}` : ""}</p>
</header>

<div class="cards">
<div class="card"><b>${met} of ${steady.length}</b><span>smooth moments that hit the goal (under ${GOAL.steady}% missed frames)</span></div>
<div class="card"><b>${momentsMet} of ${moments.length}</b><span>things appearing that hit theirs (under ${GOAL.moment}%)</span></div>
<div class="card"><b>${run.startupMs ? (run.startupMs / 1000).toFixed(2) + " s" : "–"}</b><span>from starting the app to its first picture</span></div>
<div class="card"><b>${run.budgetMs} ms</b><span>time per frame at ${Math.round(run.screen.refreshHz)} Hz: anything slower is a missed frame</span></div>
</div>

<p>Each box shows the share of <b>missed frames</b>: times the screen refreshed and the app hadn't drawn a new picture yet, so it showed the old one again. Below it, frames per second and the slowest single frame. Point at a box for more.</p>
<div class="legend"><span><i style="background:var(--good)"></i>goal reached</span><span><i style="background:var(--close)"></i>close (up to 10× the goal)</span><span><i style="background:var(--bad)"></i>needs work</span></div>

<section><h2>Things that should be smooth all the way</h2><p class="meta">Goal: under ${GOAL.steady}% missed frames.</p>${table(null, "steady")}</section>
<section><h2>Things appearing</h2><p class="meta">A page or picture showing up for the first time. Goal: under ${GOAL.moment}% missed frames. The milliseconds are how long until it was there.</p>${table(null, "moment")}</section>
${bigSize ? `<section><h2>With a ${bigSize}-title library</h2><p class="meta">The same library copied until it's ${bigSize} titles, to see how the app copes as it grows.</p>${table(bigSize, "steady")}${table(bigSize, "moment")}</section>` : ""}
<section><h2>The video</h2><p class="meta">Frames the video player dropped or showed late (both should be 0).</p>${videoTable()}</section>
<section><h2>Processor, graphics card and memory</h2>${usageTable()}</section>
<section><h2>The slowest frames</h2><p class="meta">Frames over 50 ms and what was going on. “Drawing” means the time went into laying out and painting the page rather than the app's own code.</p>${slowest()}</section>
${run.errors?.length ? `<section><h2>Problems during the test</h2><ul class="errors">${run.errors.map((e) => `<li>${esc(e.theme)} · ${esc(e.routine)}: ${esc(e.message)}</li>`).join("")}</ul></section>` : ""}
</main></body></html>`;

const out = join(dir, "report.html");
writeFileSync(out, html);
console.log(out);
