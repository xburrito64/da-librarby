// Playing a show shuffled: its episodes (specials left out, unless that's all there is) in a
// random order, one after another. Any cover or show page can start it through the context.
import { createContext, useContext } from "react";
import type { TitleDetail } from "./api";

export const ShuffleContext = createContext<((titleId: number) => void) | null>(null);

/** Starts a show shuffled, if shuffling is possible here. */
export function useShuffle() {
  return useContext(ShuffleContext);
}

/** The show's episodes in a random order (file ids). */
export function shuffledEpisodes(title: TitleDetail): number[] {
  const specials = new Set(title.seasons.filter((s) => s.number === 0).map((s) => s.id));
  const all = title.files.filter((f) => f.role === "episode");
  const regular = all.filter((f) => f.seasonId == null || !specials.has(f.seasonId));
  const ids = (regular.length > 0 ? regular : all).map((f) => f.id);
  // Fisher-Yates.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
