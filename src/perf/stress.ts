// The stress test: the same routines in every theme (sitting on the home screen, scrolling it and
// the cover grids, opening show pages, searching, Settings, the player and the corner player),
// each measured for smoothness (recorder.ts) and for how much of the processor, graphics card and
// memory the app used. Optionally again with the library made many times bigger. The results are
// saved as a file for the report (scripts/perf-report.mjs).
// Started with `da-librarby.exe --stress` (see src-tauri/src/perf.rs). It changes nothing of
// yours: watch progress isn't saved, sounds and the video are muted, and your theme is back after.
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { library, tabOf, watch, KIND_LABELS, type TitleSummary } from "../library/api";
import { mpv } from "../player/mpv";
import { THEMES } from "../theme/themes";
import { forceTheme } from "../theme/theme";
import { silenceSounds } from "../theme/sound";
import { holdMusic } from "../theme/music";
import { getSetting } from "../ui/settings";
import { CORNER_SETTING } from "../player/corner";
import { calibrate, record, refreshInterval, summarize, type FrameStats, type Recording } from "./recorder";

export interface StressArgs {
  out: string | null;
  themes: string[] | null;
  only: string[] | null;
  big: number | null;
  label: string | null;
  stay: boolean;
}

interface Usage {
  cpuMs: number;
  atMs: number;
  cores: number;
  memory: number;
  gpu: number | null;
}

/** mpv's counts of video frames it dropped or showed late. */
interface VideoStats {
  /** Frames dropped to keep up, by the video output and by the decoder. */
  dropped: number;
  decoderDropped: number;
  /** Frames shown late. */
  delayed: number;
  /** The video's frame rate, and the screen's as mpv sees it. */
  videoFps: number | null;
  displayFps: number | null;
  seconds: number;
}

export interface Result {
  theme: string;
  /** The library's size in this round (titles), when it was made bigger. */
  big: number | null;
  scenario: string;
  /** "steady": something moving that should be smooth all the way; "moment": something new appearing. */
  kind: "steady" | "moment";
  frames: FrameStats;
  /** Moments: how long until it was there (ms), on average and at most. */
  took?: { avg: number; max: number };
  /** Share of the whole processor (as Task Manager shows it) and of the graphics card (%). */
  cpu: number;
  gpu: number | null;
  /** Memory in use afterwards (MB). */
  memory: number;
  video?: VideoStats;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

async function until<T>(check: () => T | null | undefined | false, what: string, timeout = 10000): Promise<T> {
  const end = performance.now() + timeout;
  for (;;) {
    const v = check();
    if (v) return v;
    if (performance.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await sleep(40);
  }
}

function key(name: string) {
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: name, bubbles: true }));
}

/** Types into a text field the way React notices. */
function typeInto(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Scrolls `el` to its end (down or up) like a mouse wheel turned briskly, notch by notch. */
async function wheel(el: HTMLElement, direction: 1 | -1, { step = 240, every = 90, max = 12000 } = {}) {
  const end = performance.now() + max;
  while (performance.now() < end) {
    const atEnd = direction > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 2 : el.scrollTop <= 0;
    if (atEnd) break;
    el.scrollBy({ top: direction * step, behavior: "smooth" });
    await sleep(every);
  }
  await sleep(400);
}

async function usage() {
  return invoke<Usage>("perf_usage");
}

function videoNumbers() {
  const get = (name: string) => mpv.getProperty<number>(name).catch(() => null);
  return Promise.all(
    ["frame-drop-count", "decoder-frame-drop-count", "vo-delayed-frame-count", "container-fps", "display-fps"].map(get),
  );
}

class Run {
  results: Result[] = [];
  errors: { theme: string; routine: string; message: string }[] = [];
  theme = "";
  big: number | null = null;
  private parts = new Map<string, { result: Omit<Result, "frames" | "took">; recordings: Recording[]; took: number[]; cpuMs: number; wallMs: number; gpu: number[] }>();
  private banner = document.createElement("div");
  step = 0;
  steps = 0;

  constructor() {
    Object.assign(this.banner.style, {
      position: "fixed",
      top: "6px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "99999",
      padding: "3px 10px",
      font: "12px/1.4 system-ui, sans-serif",
      color: "#fff",
      background: "rgba(0,0,0,0.65)",
      borderRadius: "4px",
      pointerEvents: "none",
    });
    document.body.append(this.banner);
  }

  status(text: string) {
    this.banner.textContent = `Stress test · ${text}`;
  }

  /** Measures `body` as `scenario`. Measured again under the same name, it adds up. */
  async measure(scenario: string, kind: Result["kind"], body: () => Promise<number | void>, video = false) {
    this.step++;
    this.status(`${this.theme}${this.big ? ` · ${this.big} titles` : ""} · ${scenario}`);
    const v0 = video ? await videoNumbers() : null;
    const u0 = await usage();
    const rec = record();
    const t0 = performance.now();
    const took = await body();
    const ms = performance.now() - t0;
    const recording = rec.stop();
    const u1 = await usage();
    const v1 = video ? await videoNumbers() : null;

    const id = `${this.theme}|${this.big}|${scenario}`;
    let part = this.parts.get(id);
    if (!part) {
      part = {
        result: { theme: this.theme, big: this.big, scenario, kind, cpu: 0, gpu: null, memory: 0 },
        recordings: [],
        took: [],
        cpuMs: 0,
        wallMs: 0,
        gpu: [],
      };
      this.parts.set(id, part);
    }
    part.recordings.push(recording);
    if (kind === "moment") part.took.push(typeof took === "number" ? took : ms);
    part.cpuMs += u1.cpuMs - u0.cpuMs;
    part.wallMs += (u1.atMs - u0.atMs) * u1.cores;
    if (u1.gpu != null) part.gpu.push(u1.gpu);
    part.result.memory = Math.round(u1.memory / 1048576);
    if (v0 && v1) {
      const prev = part.result.video;
      part.result.video = {
        dropped: (prev?.dropped ?? 0) + ((v1[0] ?? 0) - (v0[0] ?? 0)),
        decoderDropped: (prev?.decoderDropped ?? 0) + ((v1[1] ?? 0) - (v0[1] ?? 0)),
        delayed: (prev?.delayed ?? 0) + ((v1[2] ?? 0) - (v0[2] ?? 0)),
        videoFps: v1[3],
        displayFps: v1[4],
        seconds: (prev?.seconds ?? 0) + ms / 1000,
      };
    }
  }

  finish() {
    this.banner.remove();
    for (const part of this.parts.values()) {
      const round = (n: number) => Math.round(n * 10) / 10;
      this.results.push({
        ...part.result,
        frames: summarize(part.recordings),
        took: part.took.length ? { avg: Math.round(part.took.reduce((a, b) => a + b, 0) / part.took.length), max: Math.round(Math.max(...part.took)) } : undefined,
        cpu: round(part.wallMs ? (part.cpuMs / part.wallMs) * 100 : 0),
        gpu: part.gpu.length ? round(part.gpu.reduce((a, b) => a + b, 0) / part.gpu.length) : null,
      });
    }
  }
}

// ----- Getting around -----

function navTab(label: string) {
  return $$<HTMLButtonElement>(".nav__tab").find((b) => b.textContent?.trim() === label) ?? null;
}

/** Back to the home screen at its top, with nothing open. */
async function home() {
  for (let i = 0; i < 4 && $(".modal, .ctx-menu"); i++) {
    key("Escape");
    await sleep(400);
  }
  const stop = $<HTMLButtonElement>('.player button[title^="Stop"]');
  if (stop) {
    stop.click();
    await until(() => !$(".player"), "the player to close").catch(() => {});
  }
  const search = $<HTMLInputElement>(".nav__search input");
  if (search?.value) typeInto(search, "");
  navTab("Home")?.click();
  await until(() => !$(".tp") && $(".browse.view--hero"), "the home screen");
  $(".browse")?.scrollTo(0, 0);
  await sleep(1200);
}

function browse() {
  return $(".browse")!;
}

// ----- The routines -----

type Routine = (run: Run, ctx: Context) => Promise<void>;

interface Context {
  titles: TitleSummary[];
}

const ROUTINES: Record<string, Routine> = {
  /** The home screen left alone (the theme's animations, the spotlight changing). */
  idle: async (run) => {
    await home();
    await run.measure("idle", "steady", () => sleep(10000));
  },

  "home-scroll": async (run) => {
    await home();
    await run.measure("home-scroll", "steady", async () => {
      await wheel(browse(), 1);
      await wheel(browse(), -1);
    });
  },

  /** Paging along the first row of covers with its arrows. */
  rows: async (run) => {
    await home();
    const row = $$(".row").find((r) => !$<HTMLButtonElement>(".row__arrow--right", r)?.disabled);
    if (!row) return;
    await run.measure("row-paging", "steady", async () => {
      for (let i = 0; i < 3; i++) {
        $<HTMLButtonElement>(".row__arrow--right", row)?.click();
        await sleep(700);
      }
      for (let i = 0; i < 3; i++) {
        $<HTMLButtonElement>(".row__arrow--left", row)?.click();
        await sleep(700);
      }
    });
  },

  /** The biggest kind's cover grid: switching to it, then scrolling it. */
  grid: async (run, ctx) => {
    await home();
    const tab = biggestTab(ctx.titles);
    const button = tab && navTab(tab);
    if (!button) return;
    await run.measure("tab-switch", "moment", async () => {
      const t0 = performance.now();
      button.click();
      await until(() => $(".browse .grid .card"), "the grid");
      const took = performance.now() - t0;
      await sleep(1000);
      return took;
    });
    await run.measure("grid-scroll", "steady", async () => {
      await wheel(browse(), 1);
      await wheel(browse(), -1);
    });
  },

  /** A show page: opening it from its cover, scrolling it, its season tabs, closing it; and a few
   *  more opened and closed. */
  show: async (run, ctx) => {
    await home();
    const tab = biggestTab(ctx.titles);
    if (!tab) return;
    navTab(tab)?.click();
    await until(() => $(".browse .grid .card"), "the grid");
    await sleep(800);
    const kind = (Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]).find((k) => KIND_LABELS[k] === tab);
    // The one with the most seasons and episodes, and the first two others in the grid.
    const big = ctx.titles
      .filter((t) => tabOf(t) === kind && !t.isMovie)
      .sort((a, b) => b.seasons - a.seasons || b.episodes - a.episodes)[0];
    const cards = $$(".browse .grid .card");
    const ids = [big?.id, ...cards.slice(0, 3).map((c) => Number(c.dataset.id))].filter((id, i, all) => id != null && all.indexOf(id) === i).slice(0, 3);

    for (const [i, id] of ids.entries()) {
      const card = $(`.browse .grid .card[data-id="${id}"]`);
      if (!card) continue;
      card.scrollIntoView({ block: "center" });
      await sleep(700);
      await run.measure("show-open", "moment", async () => {
        const t0 = performance.now();
        card.click();
        await until(() => $(".tp .tp__cover"), "the show page");
        const took = performance.now() - t0;
        await sleep(1200);
        return took;
      });
      if (i === 0) {
        const page = $(".tp")!;
        await run.measure("show-scroll", "steady", async () => {
          await wheel(page, 1);
          await wheel(page, -1);
        });
        const tabs = $$<HTMLButtonElement>(".tp .seasons__tab").slice(0, 5);
        if (tabs.length > 1) {
          await run.measure("show-seasons", "moment", async () => {
            for (const t of [...tabs.slice(1), tabs[0]]) {
              t.click();
              await sleep(900);
            }
          });
        }
      }
      await run.measure("show-close", "moment", async () => {
        const t0 = performance.now();
        key("Escape");
        await until(() => !$(".tp"), "the show page to close");
        const took = performance.now() - t0;
        await sleep(900);
        return took;
      });
    }
  },

  /** Typing a search letter by letter, then clearing it. */
  search: async (run, ctx) => {
    await home();
    const input = $<HTMLInputElement>(".nav__search input");
    if (!input) return;
    const name = ctx.titles.slice().sort((a, b) => b.episodes - a.episodes)[0]?.name ?? "the";
    const query = name.toLowerCase().replace(/[^a-z ]/g, "").trim().slice(0, 6) || "the";
    await run.measure("search", "moment", async () => {
      input.focus();
      for (let i = 1; i <= query.length; i++) {
        typeInto(input, query.slice(0, i));
        await sleep(160);
      }
      await sleep(900);
      for (let i = query.length - 1; i >= 0; i--) {
        typeInto(input, query.slice(0, i));
        await sleep(90);
      }
      await sleep(700);
    });
    input.blur();
  },

  /** Settings: opening it (on Appearance, with the theme previews), scrolling it, closing it. */
  settings: async (run) => {
    await home();
    await run.measure("settings-open", "moment", async () => {
      const t0 = performance.now();
      $<HTMLButtonElement>('.nav button[title="Settings"]')?.click();
      await until(() => $(".settings .settings__main"), "Settings");
      const took = performance.now() - t0;
      await sleep(800);
      return took;
    });
    const main = $(".settings__main");
    if (main) {
      await run.measure("settings-scroll", "steady", async () => {
        await wheel(main, 1);
        await wheel(main, -1);
      });
    }
    await run.measure("settings-close", "moment", async () => {
      key("Escape");
      await until(() => !$(".settings"), "Settings to close");
      await sleep(600);
    });
  },

  /** Playing something (the theme's intro included), the player with and without its controls,
   *  then the corner player while browsing. With mpv's dropped and late video frames. */
  player: async (run) => {
    await home();
    let play = $<HTMLButtonElement>(".ccard__main");
    if (!play) {
      // Nothing to continue: the first episode of the first show.
      const first = $(".browse .card");
      first?.click();
      play = await until(() => $<HTMLButtonElement>(".tp .tp__actions .btn"), "a Play button").catch(() => null);
    }
    if (!play) return;
    const button = play;
    await mpv.setProperty("mute", true).catch(() => {});
    await run.measure("play-start", "moment", async () => {
      const t0 = performance.now();
      button.click();
      await until(() => $(".player"), "the player");
      await videoMoving();
      const took = performance.now() - t0;
      await sleep(2500);
      return took;
    });
    const player = $(".player");
    if (!player) return;
    await run.measure(
      "player-controls",
      "steady",
      async () => {
        const box = player.getBoundingClientRect();
        for (let i = 0; i < 30; i++) {
          const x = box.width * (0.3 + 0.4 * ((i % 10) / 10));
          player.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: x, clientY: box.height * 0.6 }));
          await sleep(250);
        }
      },
      true,
    );
    await run.measure("player-idle", "steady", () => sleep(8000), true);

    if ((await getSetting<boolean>(CORNER_SETTING)) !== false) {
      await run.measure("corner-open", "moment", async () => {
        $<HTMLButtonElement>('.player button[title="Back (Esc)"]')?.click();
        await until(() => $(".player--corner"), "the corner player");
        await sleep(900);
      });
      await run.measure(
        "corner-browse",
        "steady",
        async () => {
          await wheel(browse(), 1);
          await wheel(browse(), -1);
        },
        true,
      );
    }
    $<HTMLButtonElement>('.player button[title^="Stop"]')?.click();
    await until(() => !$(".player"), "the player to close");
    await mpv.setProperty("mute", false).catch(() => {});
  },
};

/** Waits until the video's position moves on. */
async function videoMoving() {
  const end = performance.now() + 20000;
  let first: number | null = null;
  while (performance.now() < end) {
    const pos = await mpv.getProperty<number>("time-pos").catch(() => null);
    if (typeof pos === "number") {
      if (first == null) first = pos;
      else if (pos > first) return;
    }
    await sleep(100);
  }
  throw new Error("Timed out waiting for the video to play");
}

/** In the bigger library, only what more titles make harder. */
const BIG_ROUTINES = ["idle", "home-scroll", "grid", "search"];

function biggestTab(titles: TitleSummary[]) {
  const counts = new Map<string, number>();
  for (const t of titles) counts.set(tabOf(t), (counts.get(tabOf(t)) ?? 0) + 1);
  const kind = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] as keyof typeof KIND_LABELS | undefined;
  return kind ? KIND_LABELS[kind] : null;
}

// ----- Running it -----

/** Copies of every title (with ids of their own) until the library has `size` titles. Their pages
 *  are the originals'. */
export function biggerLibrary(size: number) {
  const titles = library.titles;
  const title = library.title;
  const SHIFT = 10_000_000;
  library.titles = async () => {
    const real = await titles();
    if (real.length === 0) return real;
    const out: TitleSummary[] = [];
    for (let i = 0; out.length < size; i++) {
      const t = real[i % real.length];
      const copy = Math.floor(i / real.length);
      out.push(copy === 0 ? t : { ...t, id: t.id + copy * SHIFT });
    }
    return out;
  };
  library.title = (id: number) => title(id % SHIFT);
  return () => {
    library.titles = titles;
    library.title = title;
  };
}

export async function runStress(args: StressArgs) {
  const started = new Date();
  const run = new Run();
  run.status("getting ready");

  // Nothing of yours changes.
  const save = watch.save;
  watch.save = async () => {};
  silenceSounds(true);
  holdMusic("test", true);

  const win = getCurrentWindow();
  const wasMaximized = await win.isMaximized().catch(() => true);
  await win.maximize().catch(() => {});
  await win.setFocus().catch(() => {});

  // Let the start settle: the library loaded and any scan for new files done.
  await until(() => $(".browse"), "the library", 30000);
  const end = performance.now() + 60000;
  while (performance.now() < end && (await library.scanning().catch(() => false))) await sleep(500);
  await sleep(3000);

  const refreshMs = await calibrate();
  const titles = await library.titles();
  const themes = THEMES.filter((t) => !args.themes || args.themes.includes(t.id)).map((t) => t.id);
  const wanted = (name: string) => !args.only || args.only.includes(name);
  const ctx: Context = { titles };

  const rounds: { big: number | null; routines: string[] }[] = [{ big: null, routines: Object.keys(ROUTINES).filter(wanted) }];
  if (args.big) rounds.push({ big: args.big, routines: BIG_ROUTINES.filter(wanted) });

  for (const round of rounds) {
    let restore: (() => void) | null = null;
    if (round.big) {
      restore = biggerLibrary(round.big);
      await emit("library:changed");
      await until(() => $$(".card").length > 0, "the bigger library").catch(() => {});
      await sleep(2000);
    }
    run.big = round.big;
    for (const theme of themes) {
      run.theme = theme;
      await run.measure("theme-switch", "moment", async () => {
        forceTheme(theme);
        await sleep(2000);
      });
      for (const name of round.routines) {
        try {
          await ROUTINES[name](run, ctx);
        } catch (e) {
          run.errors.push({ theme, routine: name, message: String(e) });
        }
      }
    }
    if (restore) {
      restore();
      await emit("library:changed");
      await sleep(1500);
    }
  }

  await home().catch(() => {});
  forceTheme(null);
  watch.save = save;
  silenceSounds(false);
  holdMusic("test", false);
  run.finish();

  const report = {
    label: args.label,
    version: await getVersion().catch(() => null),
    startedAt: started.toISOString(),
    minutes: Math.round((Date.now() - started.getTime()) / 6000) / 10,
    screen: {
      refreshHz: Math.round(10000 / refreshMs) / 10,
      width: Math.round(window.innerWidth * devicePixelRatio),
      height: Math.round(window.innerHeight * devicePixelRatio),
      scale: devicePixelRatio,
    },
    browser: navigator.userAgent.match(/Edg\/[\d.]+/)?.[0] ?? navigator.userAgent,
    startupMs: await invoke<number | null>("perf_startup").catch(() => null),
    library: { titles: titles.length, episodes: titles.reduce((n, t) => n + t.episodes + t.movies, 0) },
    budgetMs: Math.round(refreshInterval() * 100) / 100,
    results: run.results,
    errors: run.errors,
  };
  const stamp = started.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const path = await invoke<string>("perf_save", { name: `run-${stamp}${args.label ? `-${args.label}` : ""}`, json: JSON.stringify(report, null, 1) });
  console.info(`Stress test saved to ${path}`);

  if (!wasMaximized) await win.unmaximize().catch(() => {});
  if (!args.stay) await invoke("perf_exit");
}
