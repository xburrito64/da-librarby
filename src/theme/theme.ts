// The current theme: applied to the page, remembered in the library database, and cached in the
// browser storage so the right theme is there from the very first frame on the next start.
// In October, Hollow's Eve takes over by itself (an option), without replacing the theme you chose:
// that one is back in November, or as soon as you pick it (or another one) yourself.
import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DEFAULT_THEME, findTheme, type Theme } from "./themes";
import { loadThemeOptions } from "./options";

const KEY = "ui.theme";
/** "off" turns the October switch off. */
const SEASONAL_KEY = "ui.seasonal";
/** The year you picked a theme yourself during October: the switch leaves you alone until next year. */
const SKIP_KEY = "ui.seasonalSkip";
const SEASONAL_THEME = "hollow";

const listeners = new Set<() => void>();

function stored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Only a startup speed-up; the database copy is the real one.
  }
}

/** The theme you picked. */
let chosen = findTheme(stored(KEY)) ? stored(KEY)! : DEFAULT_THEME;
let seasonalOn = stored(SEASONAL_KEY) !== "off";
let skipYear = stored(SKIP_KEY);
let current = shown();

/** October and the switch is on (and you haven't picked a theme yourself this October). */
function seasonNow() {
  const now = new Date();
  return now.getMonth() === 9 && seasonalOn && skipYear !== String(now.getFullYear());
}

function shown() {
  return seasonNow() && findTheme(SEASONAL_THEME) ? SEASONAL_THEME : chosen;
}

function apply(id: string) {
  document.documentElement.dataset.theme = id;
  loadThemeOptions(id);
  const theme = findTheme(id);
  getCurrentWindow()
    .setTheme(theme?.dark === false ? "light" : "dark")
    .catch(() => {});
}

function refresh() {
  const next = shown();
  if (next === current) return;
  current = next;
  apply(current);
  listeners.forEach((l) => l());
}

/** Call once at startup, before the first render. */
export function initTheme() {
  apply(current);
  Promise.all([KEY, SEASONAL_KEY, SKIP_KEY].map((key) => invoke<string | null>("ui_setting", { key }).catch(() => null)))
    .then(([saved, seasonal, skip]) => {
      if (saved && findTheme(saved)) chosen = saved;
      seasonalOn = seasonal !== "off";
      skipYear = skip;
      store(KEY, chosen);
      store(SEASONAL_KEY, seasonalOn ? "on" : "off");
      if (skip) store(SKIP_KEY, skip);
      refresh();
      listeners.forEach((l) => l());
    })
    .catch(() => {});
}

export function setTheme(id: string, save = true) {
  if (!findTheme(id)) return;
  chosen = id;
  // Picking a theme yourself during the October switch: it stays until next year.
  if (save && seasonNow()) {
    skipYear = String(new Date().getFullYear());
    store(SKIP_KEY, skipYear);
    invoke("set_ui_setting", { key: SKIP_KEY, value: skipYear }).catch(() => {});
  }
  store(KEY, id);
  if (save) invoke("set_ui_setting", { key: KEY, value: id }).catch(() => {});
  current = "";
  refresh();
}

/** Whether Hollow's Eve takes over in October. */
export function seasonalSwitch() {
  return seasonalOn;
}

export function setSeasonalSwitch(on: boolean) {
  seasonalOn = on;
  // Turning it back on lets it take over again this October.
  if (on) {
    skipYear = null;
    store(SKIP_KEY, "");
    invoke("set_ui_setting", { key: SKIP_KEY, value: "" }).catch(() => {});
  }
  store(SEASONAL_KEY, on ? "on" : "off");
  invoke("set_ui_setting", { key: SEASONAL_KEY, value: on ? "on" : "off" }).catch(() => {});
  refresh();
  listeners.forEach((l) => l());
}

/** The current theme's id, outside of React. */
export function currentTheme() {
  return current;
}

/** The current theme's full entry (name, extras...). */
export function useThemeInfo(): Theme | undefined {
  return findTheme(useTheme());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () => current);
}

export function useSeasonalSwitch() {
  return useSyncExternalStore(subscribe, () => seasonalOn);
}
