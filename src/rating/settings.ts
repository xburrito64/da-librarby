// How ratings look, kept in the library database as "ui.rating": the style, how covers and season
// tabs show them, whether episode pictures do, and whether Home has a row of favourites.
import { useSyncExternalStore } from "react";
import { getSetting, setSetting } from "../ui/settings";
import type { CoverMode, RatingStyle, TabMode } from "./scale";

export interface RatingSettings {
  style: RatingStyle;
  covers: CoverMode;
  tabs: TabMode;
  /** A small rating on each rated episode's picture. */
  episodes: boolean;
  /** A "Your favourites" row on Home. */
  favourites: boolean;
}

const DEFAULTS: RatingSettings = { style: "stars", covers: "row", tabs: "corner", episodes: true, favourites: false };
const KEY = "ui.rating";

let current = DEFAULTS;
const listeners = new Set<() => void>();
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  getSetting<Partial<RatingSettings> & { small?: boolean }>(KEY).then((saved) => {
    if (!saved) return;
    // (Season tabs and episodes were one switch at first.)
    const { small, ...rest } = saved;
    const before = small === false ? { tabs: "off" as const, episodes: false } : {};
    current = { ...DEFAULTS, ...before, ...rest };
    listeners.forEach((l) => l());
  });
}

export function setRatingSettings(patch: Partial<RatingSettings>) {
  current = { ...current, ...patch };
  setSetting(KEY, current);
  listeners.forEach((l) => l());
}

export function useRatingSettings(): RatingSettings {
  load();
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
