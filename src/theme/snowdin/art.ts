// Snowdin's little sprites and pixel icons. The sprites reach the stylesheet as CSS variables
// (--sd-heart, --sd-town, ...); the icons replace the usual line icons while Snowdin is on.
import type { ScrollLook } from "../autoscroll";
import { forestScene, paint, sceneUrl, townScene, type Scene } from "./scenes";

const PALETTE: Record<string, string> = {
  R: "#ff0000", // the heart (its colour can be changed, see setHeartColors)
  B: "#003cff", // the blue soul (gravity), while scrolling with the middle button
  Y: "#fff200",
  y: "#ffd23a",
  W: "#ffffff",
  w: "#c9cad8",
  S: "#eef4ff",
  s: "#c9d9f0",
  K: "#14141c",
};

/** Puts a dark one-pixel outline around a sprite, so it stands out on busy backgrounds. */
function outlined(rows: string[]) {
  const h = rows.length + 2;
  const w = Math.max(...rows.map((r) => r.length)) + 2;
  const at = (x: number, y: number) => rows[y - 1]?.[x - 1] ?? ".";
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      if (at(x, y) !== ".") return at(x, y);
      const near = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => at(x + dx, y + dy) !== ".");
      return near ? "K" : ".";
    }).join(""),
  );
}

/** Draws a sprite from rows of palette letters ("." is see-through), `scale` screen pixels per dot. */
function sprite(rows: string[], palette = PALETTE, scale = 1) {
  const w = Math.max(...rows.map((r) => r.length));
  return paint(w * scale, rows.length * scale, (p) =>
    rows.forEach((row, y) => [...row].forEach((c, x) => palette[c] && p.rect(x * scale, y * scale, scale, scale, palette[c]))),
  );
}

/** The same as a vector picture (squares with crisp edges), which stays sharp at any size, even
 *  where the browser would blur a small picture (as a mask, or at an in-between zoom). */
function crispSprite(rows: string[], palette = PALETTE) {
  const w = Math.max(...rows.map((r) => r.length));
  let squares = "";
  rows.forEach((row, y) => {
    // One rectangle per run of the same colour.
    for (let x = 0; x < row.length; ) {
      let end = x + 1;
      while (end < row.length && row[end] === row[x]) end++;
      if (palette[row[x]]) squares += `<rect x='${x}' y='${y}' width='${end - x}' height='1' fill='${palette[row[x]]}'/>`;
      x = end;
    }
  });
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${rows.length}' viewBox='0 0 ${w} ${rows.length}' shape-rendering='crispEdges'>${squares}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const HEART = [".RR.RR.", "RRRRRRR", "RRRRRRR", ".RRRRR.", "..RRR..", "...R..."];

const STAR = ["....Y....", "....Y....", "...YYY...", "YYYYYYYYY", ".YYYYYYY.", "..YYyYY..", "..YY.YY..", ".YY...YY.", ".Y.....Y."];

/** Snow lying along a top edge (repeats sideways). */
const CAP = [
  "...SSSS..........SSSSSS..........SSS....",
  ".SSSSSSSS......SSSSSSSSSS......SSSSSSS..",
  "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
  "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
  "SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS",
  "SSSSSSsSSSSSSSSSSsSSSSSSSSSSSsSSSSSSSSSS",
  ".sSSs....sSSSs.....ssSs....sSSs...sSs...",
  "..ss......ss........s.......ss.....s....",
];

/** A small white dog, sitting with its eyes closed. */
const DOG = [
  "..........KK.......",
  ".........KWWK......",
  "........KWWWWKKKK..",
  "........KWWWWWWWWK.",
  "........KWWKKWWWWKK",
  "........KWWWWWWWKK.",
  "........KWWWWWKKK..",
  "...KK..KWWWWWWK....",
  "..KWWK.KWWWWWWK....",
  "...KWWKKWWWWWWWK...",
  "....KWWWWWWWWWWK...",
  "....KWWWWWWWWWWK...",
  "....KWwKWWWwKWWK...",
  "....KKKKKKKKKKKK...",
];

/** The dog curled up asleep (on the town sign), and the same with its eye open. */
const DOG_ASLEEP = [
  "...KK.............",
  "..KWWK....KKKKK...",
  ".KWWWWKKKKWWWWWK..",
  ".KWKKWWWWWWWWWWWKK",
  "KWWWWWWWWWWWWWWWWK",
  "KWWwWWWWWWWwWWWWWK",
  ".KKKKKKKKKKKKKKKK.",
];
const DOG_AWAKE = DOG_ASLEEP.map((row, y) => (y === 3 ? ".KWKWWWWWWWWWWWWKK" : row));

/** The game-style "*" that starts a line of text (drawn as a mask, so it takes the text colour). */
const ASTERISK = ["..W..", "W.W.W", ".WWW.", "W.W.W", "..W.."];

const mirror = (rows: string[]) => rows.map((r) => [...r].reverse().join(""));

const CHEVRON_LEFT = ["......##..", ".....##...", "....##....", "...##.....", "..##......", "..##......", "...##.....", "....##....", ".....##...", "......##.."];
const SKIP_BACK = ["..........", "....#....#", "...##...##", "..###..###", ".####.####", ".####.####", "..###..###", "...##...##", "....#....#", ".........."];

/** Pixel versions of the app's icons (names as in src/ui/icons.tsx). */
export const ICONS: Record<string, string[]> = {
  play: ["...#......", "...##.....", "...###....", "...####...", "...#####..", "...#####..", "...####...", "...###....", "...##.....", "...#......"],
  back: ["..........", "...#......", "..##......", ".#########", "##########", ".#########", "..##......", "...#......", "..........", ".........."],
  chevronLeft: CHEVRON_LEFT,
  chevronRight: mirror(CHEVRON_LEFT),
  chevronDown: ["..........", "..........", "##......##", ".##....##.", "..##..##..", "...####...", "....##....", "..........", "..........", ".........."],
  settings: ["....##....", ".##.##.##.", ".########.", "..##..##..", "####..####", "####..####", "..##..##..", ".########.", ".##.##.##.", "....##...."],
  refresh: ["...####...", "..#....#.#", ".#......##", ".#.....###", ".#........", "........#.", "###.....#.", "##......#.", "#.#....#..", "...####..."],
  close: ["##......##", "###....###", ".###..###.", "..######..", "...####...", "...####...", "..######..", ".###..###.", "###....###", "##......##"],
  info: ["....##....", "....##....", "..........", "...###....", "....##....", "....##....", "....##....", "....##....", "...####...", ".........."],
  folder: ["..........", "####......", "#..#######", "#........#", "##########", "#........#", "#........#", "#........#", "##########", ".........."],
  check: ["..........", ".........#", "........##", ".......##.", "#.....##..", "##...##...", ".##.##....", "..###.....", "...#......", ".........."],
  edit: [".......##.", "......#..#", ".....#..#.", "....#..#..", "...#..#...", "..#..#....", ".#..#.....", ".###......", ".##.......", ".........."],
  search: [".####.....", "#....#....", "#....#....", "#....#....", "#....#....", ".####.....", ".....##...", "......##..", ".......##.", "........##"],
  dice: ["##########", "#........#", "#.##..##.#", "#.##..##.#", "#........#", "#........#", "#.##..##.#", "#.##..##.#", "#........#", "##########"],
  moon: ["....####..", "..###.....", ".###......", ".##.......", "###.......", "###.......", ".###.....#", ".#####..##", "..#######.", "....####.."],
  // Two arrows crossing.
  shuffle: ["..........", ".......#..", "##....####", "..#..#.#..", "...##.....", "...##.....", "..#..#.#..", "##....####", ".......#..", ".........."],
  star: ["....##....", "....##....", "...####...", "##########", ".########.", "..######..", "..######..", ".###..###.", ".##....##.", ".#......#."],
  plus: ["..........", "....##....", "....##....", "....##....", "##########", "##########", "....##....", "....##....", "....##....", ".........."],
  undo: ["..#.......", ".##.......", "#######...", ".##....#..", "..#.....#.", "........#.", "........#.", ".......#..", "...####...", ".........."],
  pause: ["..........", ".###..###.", ".###..###.", ".###..###.", ".###..###.", ".###..###.", ".###..###.", ".###..###.", ".###..###.", ".........."],
  next: ["..........", ".#.....##.", ".##....##.", ".###...##.", ".####..##.", ".####..##.", ".###...##.", ".##....##.", ".#.....##.", ".........."],
  volume: ["..........", "...#...#..", "..##....#.", "####..#..#", "####...#.#", "####...#.#", "####..#..#", "..##....#.", "...#...#..", ".........."],
  volumeLow: ["..........", "...#......", "..##......", "####..#...", "####...#..", "####...#..", "####..#...", "..##......", "...#......", ".........."],
  mute: ["..........", "...#......", "..##......", "####.#...#", "####..#.#.", "####...#..", "####..#.#.", "..##.#...#", "...#......", ".........."],
  subtitles: ["..........", "##########", "#........#", "#........#", "#.###.##.#", "#........#", "#.##.###.#", "#........#", "##########", ".........."],
  chapters: ["..........", "##.#######", "..........", "..........", "##.#######", "..........", "..........", "##.#######", "..........", ".........."],
  speed: ["..........", "..######..", ".#......#.", "#........#", "#.....#..#", "#....#...#", "#...#....#", "#........#", ".#......#.", ".........."],
  fullscreen: ["###....###", "#........#", "#........#", "..........", "..........", "..........", "..........", "#........#", "#........#", "###....###"],
  exitFullscreen: ["..#....#..", "..#....#..", "###....###", "..........", "..........", "..........", "..........", "###....###", "..#....#..", "..#....#.."],
  miniPlayer: ["##########", "#........#", "#........#", "#........#", "#...######", "#...######", "#...######", "#...######", "##########", ".........."],
  leaveMini: ["####......", "##........", "#.#.......", "#..#......", "....#.....", ".....#####", ".....#...#", ".....#...#", ".....#####", ".........."],
  camera: ["..........", "...###....", "##########", "#........#", "#...##...#", "#..#..#..#", "#..#..#..#", "#...##...#", "##########", ".........."],
  eye: ["..........", "..........", "...####...", ".##....##.", "#...##...#", "#...##...#", ".##....##.", "...####...", "..........", ".........."],
  skip10: SKIP_BACK,
  skip10Forward: mirror(SKIP_BACK),
};

function setVar(name: string, dataUrl: string) {
  document.documentElement.style.setProperty(name, `url("${dataUrl}")`);
}

const isColor = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
let drawn = { hearts: "", pointer: "" };

/** Draws the hearts (beside things, on the seek bar...) in `hearts` and the mouse pointer in
 *  `pointer` ("#rrggbb" each). */
export function setHeartColors(hearts: string, pointer = hearts) {
  if (!isColor(hearts) || !isColor(pointer)) return;
  if (hearts !== drawn.hearts) {
    const palette = { ...PALETTE, R: hearts };
    setVar("--sd-heart", crispSprite(HEART, palette));
    setVar("--sd-heart-outlined", crispSprite(outlined(HEART), palette));
    document.documentElement.style.setProperty("--sd-soul", hearts);
  }
  if (pointer !== drawn.pointer) {
    // 3 screen pixels per dot (6 on high-resolution screens), pointing from its middle.
    const palette = { ...PALETTE, R: pointer };
    const image = (scale: number) => `url("${sprite(outlined(HEART), palette, scale)}") ${scale / 3}x`;
    document.documentElement.style.setProperty("--sd-pointer", `image-set(${image(3)}, ${image(6)}) 13 10`);
    document.documentElement.style.setProperty("--sd-text-pointer", pixelCursor(TEXT_BAR, palette));
  }
  drawn = { hearts, pointer };
}

// ---------- Scrolling with the middle button, and typing (with the heart as the pointer) ----------

/** Where you type: a bar, in the pointer's colour. */
const TEXT_BAR = ["RRR.RRR", ...Array(8).fill("...R..."), "RRR.RRR"];
const ARROW_UP = ["...W...", "..WWW..", ".WWWWW."];
const ARROW_DOWN = [...ARROW_UP].reverse();
const ARROW_LEFT = [".W", "WW", ".W"];
const ARROW_RIGHT = mirror(ARROW_LEFT);
const ROW_GAP = ["......."];
/** The heart turned into the blue soul, as when gravity pulls it in the game. */
const BLUE_HEART = HEART.map((row) => row.replace(/R/g, "B"));

/** Sprites side by side, each `top` dots down. */
function beside(...parts: [string[], number][]) {
  const h = Math.max(...parts.map(([rows, top]) => rows.length + top));
  return Array.from({ length: h }, (_, y) => parts.map(([rows, top]) => rows[y - top] ?? ".".repeat(rows[0].length)).join(""));
}

/** An outlined sprite as a CSS cursor, 2 screen pixels per dot (4 on high-resolution screens),
 *  pointing from its middle. */
function pixelCursor(rows: string[], palette: Record<string, string>) {
  const pic = outlined(rows);
  const w = Math.max(...pic.map((r) => r.length));
  return `image-set(url("${sprite(pic, palette, 2)}") 1x, url("${sprite(pic, palette, 4)}") 2x) ${w} ${pic.length}`;
}

/** The pictures for scrolling with the middle button: the heart (in the pointer's colour) between
 *  little arrows while waiting, and turned blue with the arrow it's going while scrolling. */
export function heartScroll(color: string): ScrollLook {
  const palette = { ...PALETTE, R: isColor(color) ? color : PALETTE.R };
  const waitV = [...ARROW_UP, ...ROW_GAP, ...HEART, ...ROW_GAP, ...ARROW_DOWN];
  const waitH = beside([ARROW_LEFT, 1], [["."], 0], [HEART, 0], [["."], 0], [ARROW_RIGHT, 1]);
  return {
    cursors: {
      v: pixelCursor(waitV, palette),
      h: pixelCursor(waitH, palette),
      up: pixelCursor([...ARROW_UP, ...ROW_GAP, ...BLUE_HEART], palette),
      down: pixelCursor([...BLUE_HEART, ...ROW_GAP, ...ARROW_DOWN], palette),
      left: pixelCursor(beside([ARROW_LEFT, 1], [["."], 0], [BLUE_HEART, 0]), palette),
      right: pixelCursor(beside([BLUE_HEART, 0], [["."], 0], [ARROW_RIGHT, 1]), palette),
    },
  };
}

/** The heart's colour in the game. */
export const HEART_RED = PALETTE.R;

/** A square of scattered snowflakes (repeats in every direction); `big` flakes are 2x2. */
function snowTile(seed: number, count: number, big: boolean) {
  const size = 128;
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return paint(size, size, (p) => {
    for (let i = 0; i < count; i++) {
      const n = big ? 2 : 1;
      p.rect(Math.floor(rand() * (size - n)), Math.floor(rand() * (size - n)), n, n, "#eef4ff", big ? 0.85 : 0.5 + rand() * 0.3);
    }
  });
}

/** December makes the town more festive. */
const festive = () => new Date().getMonth() === 11;

let scenes: { town: Scene; forest: Scene } | null = null;
const sceneListeners = new Set<() => void>();

/** The town and forest as they are now, for drawing them live (woods.ts). */
export function liveScenes() {
  return scenes;
}

export function onScenes(listener: () => void) {
  sceneListeners.add(listener);
  return () => void sceneListeners.delete(listener);
}

/** The town and forest are as wide as the window; redrawn when it changes size. */
export function drawScenes(width: number) {
  scenes = { town: townScene(width, festive()), forest: forestScene(width, festive()) };
  setVar("--sd-town", sceneUrl(scenes.town));
  setVar("--sd-forest", sceneUrl(scenes.forest));
  sceneListeners.forEach((l) => l());
}

setHeartColors(PALETTE.R);
setVar("--sd-star", sprite(STAR));
setVar("--sd-cap", sprite(CAP));
setVar("--sd-dog", sprite(DOG));
setVar("--sd-dog-asleep", sprite(DOG_ASLEEP));
setVar("--sd-dog-awake", sprite(DOG_AWAKE));
setVar("--sd-asterisk", sprite(ASTERISK));
setVar("--sd-town-small", sceneUrl(townScene(0, festive())));
setVar("--sd-snow-far", snowTile(3, 40, false));
setVar("--sd-snow-near", snowTile(9, 14, true));
drawScenes(window.innerWidth);
