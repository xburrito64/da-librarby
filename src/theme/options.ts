// A theme's own settings (see `extras.options` in themes.ts), saved per theme in the library
// database as `ui.theme.<id>`.
import { useSyncExternalStore } from "react";
import { getSetting, setSetting } from "../ui/settings";
import { findTheme } from "./themes";
import { currentTheme, useTheme } from "./theme";

type Values = Record<string, boolean | string>;

const saved = new Map<string, Values>();
const saveTimers = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version += 1;
  listeners.forEach((l) => l());
}

/** Reads a theme's saved options (once). */
export function loadThemeOptions(themeId: string) {
  if (saved.has(themeId)) return;
  saved.set(themeId, {});
  getSetting<Values>(`ui.theme.${themeId}`)
    .then((values) => {
      if (values) {
        saved.set(themeId, { ...values, ...saved.get(themeId) });
        changed();
      }
    })
    .catch(() => {});
}

export function themeOption(themeId: string, optionId: string): boolean | string | undefined {
  const value = saved.get(themeId)?.[optionId];
  if (value !== undefined) return value;
  return findTheme(themeId)?.extras?.options?.find((o) => o.id === optionId)?.default;
}

/** An option of the current theme, outside of React. */
export function currentThemeOption(optionId: string) {
  return themeOption(currentTheme(), optionId);
}

export function setThemeOption(themeId: string, optionId: string, value: boolean | string) {
  const values = { ...saved.get(themeId), [optionId]: value };
  saved.set(themeId, values);
  // Saved a moment later, so dragging around a colour picker doesn't write on every step.
  clearTimeout(saveTimers.get(themeId));
  saveTimers.set(
    themeId,
    window.setTimeout(() => setSetting(`ui.theme.${themeId}`, saved.get(themeId)), 400),
  );
  changed();
}

/** All options of the current theme, by id. */
export function useThemeOptions(): Record<string, boolean | string | undefined> {
  const theme = useTheme();
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
  const options = findTheme(theme)?.extras?.options ?? [];
  return Object.fromEntries(options.map((o) => [o.id, themeOption(theme, o.id)]));
}

/** An option of the current theme (undefined if it has no such option). */
export function useThemeOption(optionId: string) {
  const theme = useTheme();
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => version,
  );
  return themeOption(theme, optionId);
}
