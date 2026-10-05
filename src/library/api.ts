// Frontend side of the library (see src-tauri/src/library).
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type LibraryKind = "anime" | "shows" | "movies";

export interface Library {
  id: number;
  path: string;
  kind: LibraryKind;
  online: boolean;
  lastScan: number | null;
  titleCount: number;
}

export interface TitleSummary {
  id: number;
  libraryId: number;
  kind: LibraryKind;
  parentId: number | null;
  isMovie: boolean;
  name: string;
  year: number | null;
  online: boolean;
  seasons: number;
  episodes: number;
  movies: number;
  extras: number;
}

export interface SeasonRow {
  id: number;
  number: number | null;
  label: string;
}

export interface FileRow {
  id: number;
  path: string;
  role: "episode" | "movie" | "extra";
  seasonId: number | null;
  episode: number | null;
  episodeEnd: number | null;
  name: string | null;
  year: number | null;
  size: number;
}

export interface TitleDetail {
  id: number;
  name: string;
  year: number | null;
  isMovie: boolean;
  folder: string;
  seasons: SeasonRow[];
  files: FileRow[];
}

export const library = {
  list: () => invoke<Library[]>("library_list"),
  add: (path: string, kind: LibraryKind) => invoke<Library[]>("library_add", { path, kind }),
  remove: (id: number) => invoke<Library[]>("library_remove", { id }),
  rescan: () => invoke<void>("library_rescan"),
  scanning: () => invoke<boolean>("library_scanning"),
  titles: () => invoke<TitleSummary[]>("library_titles"),
  title: (id: number) => invoke<TitleDetail | null>("library_title", { id }),

  onScan: (callback: (status: { running: boolean; library: string | null }) => void) =>
    listen<{ running: boolean; library: string | null }>("library:scan", (e) => callback(e.payload)),
  onChanged: (callback: () => void) => listen("library:changed", () => callback()),
};

/** Guesses what kind of library a folder is from its name. */
export function guessKind(path: string): LibraryKind {
  const name = path.split(/[\\/]/).filter(Boolean).pop()?.toLowerCase() ?? "";
  if (/anime/.test(name)) return "anime";
  if (/movie|mobie|film/.test(name)) return "movies";
  return "shows";
}

/** "S1E3", "E58", "E1-3", or "" */
export function episodeCode(file: FileRow, seasonNumber: number | null) {
  if (file.episode == null) return "";
  const ep = file.episodeEnd != null ? `${file.episode}-${file.episodeEnd}` : `${file.episode}`;
  return seasonNumber != null && seasonNumber > 0 ? `S${seasonNumber}E${ep}` : `E${ep}`;
}

/** Sort key that ignores a leading "The"/"A". */
export function sortName(name: string) {
  return name.replace(/^(the|a|an)\s+/i, "").toLowerCase();
}
