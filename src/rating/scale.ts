// A rating is one score from 10 to 100 (1.0 to 10.0 out of 10, in tenths). Each style shows it its
// own way and turns a choice back into a score; switching styles never changes the score.

export type RatingStyle = "stars" | "score" | "thumbs" | "tier" | "theme" | "feelings";
export type CoverMode = "row" | "hover" | "corner" | "off";

export const STYLES: { id: RatingStyle; label: string; hint: string }[] = [
  { id: "stars", label: "1–5 stars", hint: "Gold stars, halves too." },
  { id: "score", label: "1–10 score", hint: "With decimals, like 8.7." },
  { id: "thumbs", label: "Thumbs", hint: "Not for me, liked it, loved it." },
  { id: "tier", label: "Tier list", hint: "S down to F." },
  { id: "theme", label: "Theme stickers", hint: "Five of the theme's own stickers, halves too." },
  { id: "feelings", label: "Feelings", hint: "One sticker: not for me, liked it, loved it." },
];

/** Out of five, in halves: 8.7 is 4½. */
export const toStars = (score: number) => Math.round(score / 10) / 2;
export const fromStars = (stars: number) => Math.round(stars * 20);

/** How full each of five stickers is (0, 0.5 or 1). */
export const stickerParts = (score: number) => {
  const halves = Math.round(score / 10);
  return [0, 1, 2, 3, 4].map((i) => Math.max(0, Math.min(1, (halves - i * 2) / 2)));
};

/** "8.7", "10". */
export const toTen = (score: number) => (score >= 100 ? "10" : (score / 10).toFixed(1));
/** From what was typed or dragged: 1.0 to 10.0, in tenths. */
export const fromTen = (value: number) => Math.round(Math.min(10, Math.max(1, value)) * 10);

/** Not for me (0), liked it (1), loved it (2). */
export const LEVELS = ["Not for me", "Liked it", "Loved it"];
export const toLevel = (score: number) => (score >= 80 ? 2 : score >= 60 ? 1 : 0);
export const fromLevel = (level: number) => [40, 70, 90][level];

export const TIERS: { tier: string; from: number; score: number; color: string }[] = [
  { tier: "S", from: 95, score: 97, color: "#ff7f7f" },
  { tier: "A", from: 85, score: 90, color: "#ffbf7f" },
  { tier: "B", from: 70, score: 77, color: "#ffdf7f" },
  { tier: "C", from: 55, score: 62, color: "#e8f080" },
  { tier: "D", from: 40, score: 47, color: "#a8e88a" },
  { tier: "F", from: 0, score: 25, color: "#8fc4ff" },
];
export const toTier = (score: number) => TIERS.find((t) => score >= t.from) ?? TIERS[TIERS.length - 1];

/** "4½", "4". */
export const starsText = (stars: number) => `${Math.floor(stars)}${stars % 1 ? "½" : ""}`.replace(/^0½$/, "½");

/** The rating in words, as the style says it: "8.7 / 10", "4½ stars", "Loved it", "A tier". */
export function describe(score: number, style: RatingStyle) {
  switch (style) {
    case "score":
      return `${toTen(score)} / 10`;
    case "thumbs":
    case "feelings":
      return LEVELS[toLevel(score)];
    case "tier":
      return `${toTier(score).tier} tier`;
    default: {
      const s = toStars(score);
      return `${starsText(s)} star${s === 1 ? "" : "s"}`;
    }
  }
}
