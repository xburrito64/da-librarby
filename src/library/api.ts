// Frontend side of the library (see src-tauri/src/library).
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
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
  /** Full path of the small cover image, if downloaded. */
  thumb: string | null;
  color: string | null;
  /** null = not looked up yet, false = looked up but nothing found. */
  matched: boolean | null;
}

/** Information from AniList/TMDB. */
export interface Meta {
  provider: "anilist" | "tmdb" | null;
  /** Matched entries; empty = nothing found. */
  providerIds: string[];
  /** Chosen by hand. */
  locked: boolean;
  name: string | null;
  description: string | null;
  year: number | null;
  score: number | null;
  cover: string | null;
  thumb: string | null;
}

export interface TitleMeta extends Meta {
  genres: string[];
  status: string | null;
  studio: string | null;
  color: string | null;
  banner: string | null;
}

export interface SeasonRow {
  id: number;
  number: number | null;
  label: string;
  meta: Meta | null;
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
  meta: Meta | null;
  providerEpisode: number | null;
}

export interface TitleDetail {
  id: number;
  kind: LibraryKind;
  name: string;
  year: number | null;
  isMovie: boolean;
  folder: string;
  meta: TitleMeta | null;
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

export interface MetadataStatus {
  running: boolean;
  done: number;
  total: number;
  current: string | null;
  source: "AniList" | "TMDB" | null;
  error: string | null;
}

export interface Candidate {
  id: number;
  title: string;
  altTitle: string | null;
  format: string | null;
  year: number | null;
  episodes: number | null;
  coverUrl: string | null;
}

/** Where the fix-match picker searches. */
export type MatchSource = "anilist" | "tmdb-tv" | "tmdb-movie";

/** "auto" = let the app decide, "none" = no match, "pick" = use the given id. */
export type MatchMode = "auto" | "none" | "pick";

export const metadata = {
  status: () => invoke<MetadataStatus>("metadata_status"),
  search: (query: string, source: MatchSource) => invoke<Candidate[]>("metadata_search", { query, source }),
  matchTitle: (titleId: number, mode: MatchMode, id?: number) =>
    invoke<void>("metadata_match_title", { titleId, mode, id: id ?? null }),
  matchSeason: (seasonId: number, ids: number[]) => invoke<void>("metadata_match_season", { seasonId, ids }),
  matchFile: (fileId: number, mode: MatchMode, id?: number) =>
    invoke<void>("metadata_match_file", { fileId, mode, id: id ?? null }),
  tmdbKey: () => invoke<string | null>("settings_tmdb_key"),
  setTmdbKey: (key: string | null) => invoke<void>("settings_set_tmdb_key", { key }),
  onStatus: (callback: (status: MetadataStatus) => void) =>
    listen<MetadataStatus>("metadata:status", (e) => callback(e.payload)),
};

/** Image path -> URL the page can load. */
export function img(path: string | null | undefined) {
  return path ? convertFileSrc(path) : undefined;
}

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
