// Snowdin's little sprites and pixel icons. The sprites reach the stylesheet as CSS variables
// (--sd-heart, --sd-town, ...); the icons replace the usual line icons while Snowdin is on.
import { forestScene, lightsTile, paint, townScene } from "./scenes";

const PALETTE: Record<string, string> = {
  R: "#ff0000", // the heart (its colour can be changed, see setHeartColors)
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
    setVar("--sd-heart", sprite(HEART, palette));
    setVar("--sd-heart-outlined", sprite(outlined(HEART), palette));
    document.documentElement.style.setProperty("--sd-soul", hearts);
  }
  if (pointer !== drawn.pointer) {
    // 3 screen pixels per dot (6 on high-resolution screens), pointing from its middle.
    const palette = { ...PALETTE, R: pointer };
    const image = (scale: number) => `url("${sprite(outlined(HEART), palette, scale)}") ${scale / 3}x`;
    document.documentElement.style.setProperty("--sd-pointer", `image-set(${image(3)}, ${image(6)}) 13 10`);
  }
  drawn = { hearts, pointer };
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

/** The town and forest are as wide as the window; redrawn when it changes size. */
export function drawScenes(width: number) {
  setVar("--sd-town", townScene(width, festive()));
  setVar("--sd-forest", forestScene(width, festive()));
}

setHeartColors(PALETTE.R);
setVar("--sd-star", sprite(STAR));
setVar("--sd-cap", sprite(CAP));
setVar("--sd-dog", sprite(DOG));
setVar("--sd-asterisk", sprite(ASTERISK));
setVar("--sd-lights", lightsTile());
setVar("--sd-lights-glow-a", lightsTile("a"));
setVar("--sd-lights-glow-b", lightsTile("b"));
setVar("--sd-town-small", townScene(0, festive()));
setVar("--sd-snow-far", snowTile(3, 40, false));
setVar("--sd-snow-near", snowTile(9, 14, true));
drawScenes(window.innerWidth);
