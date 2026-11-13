import { invoke } from "@tauri-apps/api/core";
import { fileInfo, library, type FileInfo, type FileRow, type LibraryKind, type TitleDetail } from "./api";

/*
 * "Copy for Grimoire": the owner keeps a list of what they torrented in their Grimoire app
 * (resolution, codec, audio, size, the drive). This copies what the library knows about each
 * file, as text Grimoire reads when it's pasted on its Torrented page. Only facts go out; Grimoire
 * turns them into its own fields ("1080p", "HEVC", "DD+ 5.1") and decides what to fill in.
 *
 * What's in a file is found out once (the hidden player opens it, see fileinfo.rs) and kept, so a
 * first copy of a big library takes a while; files on a drive that isn't plugged in go out with
 * their size and drive only.
 */

export interface GrimoireAudio {
  /** mpv's name: "aac", "eac3", "truehd", "dts", "opus", "flac". */
  codec: string | null;
  channels: number | null;
  /** "LC", "DTS-HD MA". */
  profile: string | null;
  lang: string | null;
  title: string | null;
  default: boolean;
}

export interface GrimoireFile {
  role: "episode" | "movie" | "extra";
  season: number | null;
  /** The season's name here: "Season 1", "Specials", an arc's name. */
  seasonName: string | null;
  episode: number | null;
  /** A double episode's last number. */
  episodeEnd: number | null;
  /** The episode's, movie's or extra's name. */
  name: string | null;
  /** An extra's heading ("Season 15", "TV Shorts"). */
  extraGroup: string | null;
  /** "F:" */
  drive: string | null;
  bytes: number;
  /** Whether what's in it could be read (no: its drive wasn't plugged in, or it wouldn't open). */
  read: boolean;
  width: number | null;
  height: number | null;
  /** mpv's name: "hevc", "h264", "av1". */
  codec: string | null;
  bitDepth: number | null;
  hdr: boolean;
  audio: GrimoireAudio[];
}

export interface GrimoireTitle {
  name: string;
  year: number | null;
  kind: LibraryKind;
  movie: boolean;
  /** The show a movie belongs to. */
  partOf: string | null;
  files: GrimoireFile[];
}

export interface GrimoireExport {
  app: "Da Librarby";
  for: "Grimoire";
  version: 1;
  /** When it was copied. */
  made: string;
  /** The names the drives have in Windows, by letter ("F:" → "TOSHIBA EXT"). */
  drives: Record<string, string>;
  titles: GrimoireTitle[];
}

export interface Progress {
  done: number;
  total: number;
}

/** How long to wait for one file to be read (opening one from a sleeping drive can take a while). */
const READ_WAIT_MS = 30_000;

const driveOf = (path: string) => (/^[a-z]:/i.test(path) ? `${path[0].toUpperCase()}:` : null);

/** The titles to copy: these, with the movies (and spin-offs) that belong to a show among them. */
async function titlesFor(ids: number[] | "all"): Promise<TitleDetail[]> {
  const all = await library.titles();
  const wanted = ids === "all" ? all : all.filter((t) => ids.includes(t.id) || (t.parentId != null && ids.includes(t.parentId)));
  const details = await Promise.all(wanted.map((t) => library.title(t.id)));
  return details.filter((d): d is TitleDetail => d != null);
}

/** What's in each file, reading the ones not read yet, one at a time. */
async function readFiles(paths: string[], online: Set<string>, onProgress?: (p: Progress) => void) {
  const infos = new Map<string, FileInfo | null>();
  const waiting = new Map<string, (info: FileInfo | null) => void>();
  const stop = await fileInfo.onReady((path, info) => waiting.get(path)?.(info));
  try {
    let done = 0;
    for (const path of paths) {
      let info = await fileInfo.get(path).catch(() => null);
      if (!info && online.has(path)) {
        info = await new Promise<FileInfo | null>((resolve) => {
          const timer = window.setTimeout(() => resolve(null), READ_WAIT_MS);
          waiting.set(path, (got) => {
            clearTimeout(timer);
            resolve(got);
          });
        });
        waiting.delete(path);
      }
      infos.set(path, info);
      onProgress?.({ done: ++done, total: paths.length });
    }
  } finally {
    stop();
  }
  return infos;
}

function fileOut(f: FileRow, title: TitleDetail, info: FileInfo | null | undefined): GrimoireFile {
  const season = title.seasons.find((s) => s.id === f.seasonId);
  return {
    role: f.role,
    season: season?.number ?? null,
    seasonName: season?.label ?? null,
    episode: f.episode,
    episodeEnd: f.episodeEnd,
    name: f.name,
    extraGroup: f.extraGroup,
    drive: driveOf(f.path),
    bytes: f.size,
    read: !!info,
    width: info?.width ?? null,
    height: info?.height ?? null,
    codec: info?.videoCodec ?? null,
    bitDepth: info?.bitDepth ?? null,
    hdr: info?.hdr ?? false,
    audio: (info?.audio ?? []).map((a) => ({
      codec: a.codec,
      channels: a.channels,
      profile: a.profile,
      lang: a.lang,
      title: a.title,
      default: a.default,
    })),
  };
}

/**
 * Copies these titles (or the whole library) for Grimoire: reads what isn't known yet, then puts
 * the text on the clipboard. Says how many titles and files went.
 */
export async function copyForGrimoire(
  ids: number[] | "all",
  onProgress?: (p: Progress) => void,
): Promise<{ titles: number; files: number; unread: number }> {
  const titles = await titlesFor(ids);
  // Offline titles' files aren't opened: there's nothing to open.
  const summaries = await library.titles();
  const offline = new Set(summaries.filter((t) => !t.online).map((t) => t.id));
  const files = titles.flatMap((t) => t.files.map((f) => ({ f, t })));
  const online = new Set(files.filter(({ t }) => !offline.has(t.id)).map(({ f }) => f.path));
  const infos = await readFiles(
    files.map(({ f }) => f.path),
    online,
    onProgress,
  );
  const letters = [...new Set(files.map(({ f }) => driveOf(f.path)).filter((d): d is string => !!d))];
  const drives = await invoke<Record<string, string>>("drive_labels", { letters }).catch(() => ({}));
  const out: GrimoireExport = {
    app: "Da Librarby",
    for: "Grimoire",
    version: 1,
    made: new Date().toISOString(),
    drives,
    titles: titles.map((t) => ({
      name: t.name,
      year: t.year,
      kind: t.kind,
      movie: t.isMovie,
      partOf: t.parentName,
      files: t.files.map((f) => fileOut(f, t, infos.get(f.path))),
    })),
  };
  await invoke("copy_text", { text: JSON.stringify(out) });
  const unread = out.titles.reduce((n, t) => n + t.files.filter((f) => !f.read).length, 0);
  return { titles: out.titles.length, files: files.length, unread };
}

/** What the little message says once it's copied. */
export function copiedText(r: { titles: number; files: number; unread: number }) {
  const what = `${r.titles} title${r.titles === 1 ? "" : "s"}, ${r.files} file${r.files === 1 ? "" : "s"}`;
  const unread = r.unread ? ` (${r.unread} couldn't be read: is their drive plugged in?)` : "";
  return `Copied for Grimoire: ${what}${unread}. Paste it on Grimoire's Torrented page.`;
}

const say = (text: string) => window.dispatchEvent(new CustomEvent("da:say", { detail: text }));
let busy = false;

/** From a cover's menu: copies the title (with its movies) and says how it went. */
export async function copyTitleForGrimoire(id: number, name: string) {
  if (busy) return say("Still copying for Grimoire, one moment.");
  busy = true;
  say(`Copying ${name} for Grimoire…`);
  try {
    say(copiedText(await copyForGrimoire([id])));
  } catch (e) {
    say(`Couldn't copy for Grimoire: ${String(e)}`);
  } finally {
    busy = false;
  }
}

/** Whether a copy is running (one at a time). */
export const grimoireCopy = {
  get busy() {
    return busy;
  },
  set busy(on: boolean) {
    busy = on;
  },
};
