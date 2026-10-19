// How ratings look, kept in the library database as "ui.rating": the style, how covers show them,
// and whether season tabs and episodes show theirs.
import { useSyncExternalStore } from "react";
import { getSetting, setSetting } from "../ui/settings";
import type { CoverMode, RatingStyle } from "./scale";

export interface RatingSettings {
  style: RatingStyle;
  covers: CoverMode;
  /** Ratings on season tabs and episode pictures too (not only in their headers and cards). */
  small: boolean;
}

const DEFAULTS: RatingSettings = { style: "stars", covers: "row", small: true };
const KEY = "ui.rating";

let current = DEFAULTS;
const listeners = new Set<() => void>();
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  getSetting<Partial<RatingSettings>>(KEY).then((saved) => {
    if (!saved) return;
    current = { ...DEFAULTS, ...saved };
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
