// Frontend side of the library (see src-tauri/src/library).
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

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
  genres: string[];
  /** Full path of the wide artwork, if downloaded. */
  banner: string | null;
  score: number | null;
  /** Episodes and movies watched. */
  watched: number;
  /** Episodes and movies added recently and not started yet. */
  newCount: number;
  /** The show itself was added recently. */
  isNew: boolean;
  /** When its newest file was added / something of it was last watched (seconds). */
  addedAt: number;
  lastWatched: number | null;
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
  progress: Progress | null;
  /** Added recently and not started yet. */
  isNew: boolean;
}

/** How far a file has been played. Times in seconds. */
export interface Progress {
  position: number;
  duration: number;
  watched: boolean;
  updatedAt: number;
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
  search: (query: string) => invoke<SearchResults>("library_search", { query }),

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

export const KIND_LABELS: Record<LibraryKind, string> = { anime: "Anime", shows: "Shows", movies: "Movies" };

/** "2019 · 3 seasons · 59 episodes" */
export function describe(t: TitleSummary) {
  const parts: (string | number)[] = [];
  if (t.year != null) parts.push(t.year);
  if (t.isMovie) parts.push("Movie");
  else {
    if (t.seasons > 1) parts.push(`${t.seasons} seasons`);
    if (t.episodes) parts.push(`${t.episodes} episode${t.episodes === 1 ? "" : "s"}`);
    else if (t.movies) parts.push(`${t.movies} movie${t.movies === 1 ? "" : "s"}`);
  }
  if (!t.online) parts.push("drive offline");
  return parts.join(" · ");
}

export function fileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Everything the player needs to play one file. */
export interface PlayItem {
  fileId: number;
  titleId: number;
  titleName: string;
  path: string;
  role: "episode" | "movie" | "extra";
  seasonNumber: number | null;
  episode: number | null;
  episodeEnd: number | null;
  name: string | null;
  /** Episode still, else the show's artwork. */
  image: string | null;
  /** Where it was stopped last time. */
  resume: number | null;
  duration: number | null;
}

export interface ContinueItem extends PlayItem {
  /** "resume" = stopped part-way, "next" = the episode after the last one finished. */
  reason: "resume" | "next";
  updatedAt: number;
}

export const watch = {
  item: (fileId: number) => invoke<PlayItem | null>("watch_item", { fileId }),
  next: (fileId: number) => invoke<PlayItem | null>("watch_next", { fileId }),
  save: (fileId: number, position: number, duration: number, done: boolean) =>
    invoke<void>("watch_save", { fileId, position, duration, done }),
  set: (fileIds: number[], watched: boolean) => invoke<void>("watch_set", { fileIds, watched }),
  continueList: () => invoke<ContinueItem[]>("watch_continue"),
  /** Removes a show from "continue watching" until something of it is watched again. */
  hide: (titleId: number) => invoke<void>("watch_hide", { titleId }),
  setTitle: (titleId: number, watched: boolean) => invoke<void>("watch_set_title", { titleId, watched }),
};

/** "S1E3" / "E3" / "" for a play item. */
export function itemCode(item: PlayItem) {
  if (item.role !== "episode" || item.episode == null) return "";
  const ep = item.episodeEnd != null ? `${item.episode}-${item.episodeEnd}` : `${item.episode}`;
  return item.seasonNumber != null && item.seasonNumber > 0 ? `S${item.seasonNumber}E${ep}` : `E${ep}`;
}

/** Episode or movie name, never empty. */
export function itemName(item: PlayItem) {
  return item.name ?? (item.episode != null ? `Episode ${item.episode}` : item.role === "movie" ? item.titleName : fileName(item.path));
}

/** Part-way through (worth resuming)? Same rule as the app's watch history. */
export function canResume(p: Progress | null | undefined) {
  return !!p && p.position >= 30 && (p.duration <= 0 || p.position < p.duration * 0.9);
}

export function episodeName(file: FileRow) {
  return file.name ?? file.meta?.name ?? (file.episode != null ? `Episode ${file.episode}` : fileName(file.path));
}

/**
 * What the big Play button on a show page starts: the episode stopped part-way, else the
 * next unwatched one after the last finished, else the first.
 */
export function upNext(title: TitleDetail): { file: FileRow; mode: "resume" | "next" | "start" } | null {
  const regular = title.seasons.filter((s) => s.number !== 0);
  const ordered = [
    ...regular.flatMap((s) => title.files.filter((f) => f.role === "episode" && f.seasonId === s.id)),
    ...title.files.filter((f) => f.role === "movie" && (title.isMovie || regular.length === 0)),
  ];
  if (ordered.length === 0) {
    const any = title.files.find((f) => f.role === "episode");
    return any ? { file: any, mode: "start" } : null;
  }
  const latest = ordered
    .filter((f) => f.progress)
    .sort((a, b) => (b.progress!.updatedAt - a.progress!.updatedAt) || (b.id - a.id))[0];
  if (latest && canResume(latest.progress)) return { file: latest, mode: "resume" };
  if (latest?.progress?.watched) {
    const after = ordered.slice(ordered.indexOf(latest) + 1).find((f) => !f.progress?.watched);
    if (after) return { file: after, mode: "next" };
  } else if (latest) {
    // Opened but left within the first moments: still the one up next.
    return { file: latest, mode: "next" };
  }
  return { file: ordered[0], mode: "start" };
}

export interface FoundFile {
  fileId: number;
  titleId: number;
  titleName: string;
  role: "episode" | "movie";
  seasonNumber: number | null;
  episode: number | null;
  episodeEnd: number | null;
  name: string | null;
  thumb: string | null;
}

export interface SearchResults {
  titles: number[];
  files: FoundFile[];
}

/** Opens Explorer at a file (selected) or folder. */
export function reveal(path: string) {
  return revealItemInDir(path);
}

/** Shows a title's folder in Explorer (with its first video selected). */
export async function revealTitle(titleId: number) {
  const detail = await library.title(titleId);
  const file = detail?.files.find((f) => f.role !== "extra") ?? detail?.files[0];
  if (file) await reveal(file.path);
}
