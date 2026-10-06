// The current theme: applied to the page, remembered in the library database, and cached in the
// browser storage so the right theme is there from the very first frame on the next start.
import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { DEFAULT_THEME, findTheme, type Theme } from "./themes";
import { loadThemeOptions } from "./options";

const KEY = "ui.theme";
const listeners = new Set<() => void>();
let current = cached() ?? DEFAULT_THEME;

function cached() {
  try {
    const id = localStorage.getItem(KEY);
    return findTheme(id) ? id : null;
  } catch {
    return null;
  }
}

function apply(id: string) {
  document.documentElement.dataset.theme = id;
  loadThemeOptions(id);
  const theme = findTheme(id);
  getCurrentWindow()
    .setTheme(theme?.dark === false ? "light" : "dark")
    .catch(() => {});
}

/** Call once at startup, before the first render. */
export function initTheme() {
  apply(current);
  invoke<string | null>("ui_setting", { key: KEY })
    .then((saved) => {
      if (saved && saved !== current && findTheme(saved)) setTheme(saved, false);
    })
    .catch(() => {});
}

export function setTheme(id: string, save = true) {
  if (!findTheme(id)) return;
  current = id;
  apply(id);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Only a startup speed-up; the database copy is the real one.
  }
  if (save) invoke("set_ui_setting", { key: KEY, value: id }).catch(() => {});
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

export function useTheme() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
