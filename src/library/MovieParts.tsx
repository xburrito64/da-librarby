// The parts of a movie's page below its description: the details line (length, when it would
// end, picture and sound), "About" (the film, your copy of it, your watching), the cast, and
// more like it from the library.
import { useEffect, useState } from "react";
import { img, fileInfo as fileInfoApi, watch, type FileInfo, type FileRow, type TitleDetail, type TitleSummary, type Track } from "./api";
import { Card } from "./Browse";
import { CheckIcon } from "../ui/icons";
import { formatDuration } from "./WatchStats";

/** What's in a file: undefined while it's being found out, null if it can't be. */
export function useFileInfo(path: string | undefined) {
  const [info, setInfo] = useState<FileInfo | null | undefined>(undefined);
  useEffect(() => {
    setInfo(undefined);
    if (!path) return;
    let alive = true;
    const off = fileInfoApi.onReady((p, i) => alive && p === path && setInfo(i));
    fileInfoApi.get(path).then((i) => alive && i && setInfo(i));
    return () => {
      alive = false;
      off.then((f) => f());
    };
  }, [path]);
  return info;
}

/** "12:34" / "1:02:03" */
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "1 h 26 min", "52 min" */
function length(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

// Files name languages in three letters ("jpn"); the browser knows the two-letter codes.
const THREE_LETTERS: Record<string, string> = {
  jpn: "ja", eng: "en", ger: "de", deu: "de", fre: "fr", fra: "fr", spa: "es", ita: "it", por: "pt",
  rus: "ru", kor: "ko", chi: "zh", zho: "zh", dut: "nl", nld: "nl", pol: "pl", swe: "sv", nor: "no",
  dan: "da", fin: "fi", tur: "tr", ara: "ar", hin: "hi", tha: "th", vie: "vi", ind: "id", may: "ms",
  msa: "ms", heb: "he", gre: "el", ell: "el", hun: "hu", cze: "cs", ces: "cs", rum: "ro", ron: "ro", ukr: "uk",
};

let names: Intl.DisplayNames | null = null;
function language(code: string | null) {
  if (!code || code === "und" || code === "xx") return null;
  const short = THREE_LETTERS[code.toLowerCase()] ?? code;
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "language" });
    return names.of(short) ?? code;
  } catch {
    return code;
  }
}

/** "Japanese, English", or "English +4" when there are many. */
function languages(tracks: Track[], max: number) {
  const list = [...new Set(tracks.map((t) => language(t.lang)).filter((l): l is string => !!l))];
  if (list.length === 0) return null;
  return list.length > max ? `${list.slice(0, max).join(", ")} +${list.length - max}` : list.join(", ");
}

function quality(info: FileInfo) {
  const w = info.width ?? 0;
  const h = info.height ?? 0;
  if (w >= 3200 || h >= 1800) return "4K";
  if (w >= 1800 || h >= 1000) return "1080p";
  if (w >= 1200 || h >= 700) return "720p";
  return h > 0 ? `${h}p` : null;
}

function surround(channels: number | null) {
  if (!channels) return null;
  if (channels >= 8) return "7.1";
  if (channels >= 6) return "5.1";
  return channels === 1 ? "Mono" : channels === 2 ? "Stereo" : `${channels} channels`;
}

const CODECS: Record<string, string> = {
  hevc: "HEVC", h264: "H.264", av1: "AV1", vp9: "VP9", mpeg4: "MPEG-4", mpeg2video: "MPEG-2",
  aac: "AAC", ac3: "Dolby Digital", eac3: "Dolby Digital Plus", truehd: "Dolby TrueHD", dts: "DTS",
  flac: "FLAC", opus: "Opus", mp3: "MP3", vorbis: "Vorbis", pcm_s16le: "PCM", pcm_s24le: "PCM",
};
const codec = (c: string | null) => (c ? (CODECS[c] ?? c.toUpperCase()) : null);

/** "1 h 26 min · Ends at 21:43 · 1080p · 5.1 · Audio: Japanese, English · Subtitles: English". */
export function movieDetails(file: FileRow | undefined, info: FileInfo | null | undefined, runtime: number | null) {
  const seconds = info?.duration || file?.progress?.duration || (runtime ? runtime * 60 : 0);
  const parts: string[] = [];
  if (seconds > 60) {
    parts.push(length(seconds / 60));
    const p = file?.progress;
    const from = p && !p.watched && p.position >= 30 ? p.position : 0;
    const end = new Date(Date.now() + (seconds - from) * 1000);
    parts.push(`Ends at ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
  }
  if (info) {
    const q = quality(info);
    if (q) parts.push(info.hdr ? `${q} HDR` : q);
    const channels = Math.max(0, ...info.audio.map((a) => a.channels ?? 0));
    if (channels >= 6) parts.push(surround(channels)!);
    const audio = languages(info.audio, 3);
    if (audio) parts.push(`Audio: ${audio}`);
    const subs = languages(info.subs, 3);
    if (subs) parts.push(`Subtitles: ${subs}`);
  }
  return parts;
}

function date(value: string | number | null | undefined) {
  if (value == null) return null;
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function money(dollars: number | null) {
  if (!dollars) return null;
  if (dollars >= 1e9) return `$${(dollars / 1e9).toFixed(2).replace(/\.?0+$/, "")} billion`;
  if (dollars >= 1e6) return `$${(dollars / 1e6).toFixed(1).replace(/\.0$/, "")} million`;
  return `$${dollars.toLocaleString("en-US")}`;
}

function bytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`;
  return `${Math.round(n / 1e6)} MB`;
}

type Row = [label: string, value: React.ReactNode];

/** All about the movie: the film itself, the file you have, and your watching of it. */
export function About({
  title,
  file,
  info,
  all,
}: {
  title: TitleDetail;
  file: FileRow | undefined;
  info: FileInfo | null | undefined;
  all: TitleSummary[];
}) {
  const [watched, setWatched] = useState<{ seconds: number; first: number | null; last: number | null } | null>(null);
  useEffect(() => {
    if (file) watch.file(file.id).then(setWatched);
  }, [file?.id, file?.progress?.updatedAt]);

  const meta = title.meta;
  const extra = meta?.extra;
  const film: Row[] = [];
  const released = date(extra?.releaseDate);
  if (released || extra?.countries.length)
    film.push(["Released", [released, extra?.countries.join(", ")].filter(Boolean).join(" · ")]);
  if (extra?.originalTitle) film.push(["Original title", extra.originalTitle]);
  const lang = language(extra?.originalLanguage ?? null);
  if (lang) film.push(["Language", lang]);
  if (extra?.certification) film.push(["Rated", extra.certification]);
  if (extra?.writers.length) film.push(["Written by", extra.writers.join(", ")]);
  if (extra?.composers.length) film.push(["Music by", extra.composers.join(", ")]);
  if (extra?.producers.length) film.push(["Produced by", extra.producers.join(", ")]);
  const studios = extra?.companies.length ? extra.companies.join(", ") : meta?.studio;
  if (studios) film.push([extra?.companies.length && extra.companies.length > 1 ? "Studios" : "Studio", studios]);
  if (extra?.budget) film.push(["Budget", money(extra.budget)]);
  if (extra?.revenue) film.push(["Box office", money(extra.revenue)]);
  if (meta?.score != null)
    film.push(["Rating", `${meta.score}%${extra?.voteCount ? ` from ${extra.voteCount.toLocaleString("en-US")} votes` : ""}`]);
  if (extra?.collection && extra.collectionParts.length > 1) {
    const owned = new Set(all.map((t) => t.tmdbMovieId).filter((id) => id != null));
    if (extra.tmdbId != null) owned.add(extra.tmdbId);
    const have = extra.collectionParts.filter((p) => owned.has(p.tmdbId)).length;
    film.push([
      "Collection",
      <>
        {extra.collection} · you have {have} of {extra.collectionParts.length}
        <span className="mabout__parts">
          {extra.collectionParts.map((p) => (
            <span key={p.tmdbId} className={owned.has(p.tmdbId) ? "is-owned" : ""}>
              {owned.has(p.tmdbId) && <CheckIcon />}
              {p.name}
              {p.year ? ` (${p.year})` : ""}
            </span>
          ))}
        </span>
      </>,
    ]);
  }

  const copy: Row[] = [];
  if (file) {
    const size = [bytes(file.size), info?.container?.split(",")[0].replace("matroska", "MKV").toUpperCase()];
    if (info?.duration) size.push(`${((file.size * 8) / info.duration / 1e6).toFixed(1)} Mbit/s`);
    copy.push(["File", size.filter(Boolean).join(" · ")]);
  }
  if (info) {
    const picture = [
      info.width && info.height ? `${quality(info)} (${info.width}×${info.height})` : null,
      codec(info.videoCodec),
      info.bitDepth && info.bitDepth > 8 ? `${info.bitDepth}-bit` : null,
      info.hdr ? "HDR" : null,
      info.fps ? `${Math.round(info.fps * 1000) / 1000} fps` : null,
    ];
    copy.push(["Picture", picture.filter(Boolean).join(" · ")]);
    if (info.audio.length > 0)
      copy.push([
        info.audio.length > 1 ? "Audio tracks" : "Audio",
        <span className="mabout__list">
          {info.audio.map((a, i) => (
            <span key={i}>{[language(a.lang) ?? "Unknown", surround(a.channels), codec(a.codec)].filter(Boolean).join(" · ")}</span>
          ))}
        </span>,
      ]);
    if (info.subs.length > 0) {
      const subs = info.subs.map((s) => `${language(s.lang) ?? s.title ?? "Unknown"}${s.forced ? " (forced)" : ""}`);
      copy.push(["Subtitles", [...new Set(subs)].join(", ")]);
    }
    if (info.chapters > 0) copy.push(["Chapters", info.chapters]);
  } else if (info === undefined) copy.push(["Picture", "Having a look…"]);
  if (file) {
    const added = date(file.addedAt);
    if (added) copy.push(["Added", added]);
  }

  const yours: Row[] = [];
  const p = file?.progress;
  if (p?.watched) yours.push(["Status", "Watched"]);
  else if (p && p.position >= 30 && p.duration > 0)
    yours.push(["Status", `Stopped at ${clock(p.position)}, ${Math.max(1, Math.round((p.duration - p.position) / 60))} min left`]);
  else yours.push(["Status", "Not watched yet"]);
  if (watched && watched.seconds >= 60) {
    yours.push(["Time watched", formatDuration(watched.seconds)]);
    const first = date(watched.first);
    const last = date(watched.last);
    if (first) yours.push([first === last ? "Watched on" : "First watched", first]);
    if (last && last !== first) yours.push(["Last watched", last]);
  }

  const groups: [string, Row[]][] = [
    ["The film", film],
    ["Your copy", copy],
    ["Your watching", yours],
  ];
  return (
    <section className="tp__section">
      <h2 className="section-title">About</h2>
      <div className="mabout">
        {groups
          .filter(([, rows]) => rows.length > 0)
          .map(([heading, rows]) => (
            <div key={heading} className="mabout__group">
              <h3 className="mabout__heading">{heading}</h3>
              <dl className="mabout__rows">
                {rows.map(([label, value]) => (
                  <div key={label} className="mabout__row">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
      </div>
    </section>
  );
}

export function Cast({ title }: { title: TitleDetail }) {
  const cast = title.meta?.extra?.cast ?? [];
  if (cast.length === 0) return null;
  return (
    <section className="tp__section">
      <h2 className="section-title">Cast</h2>
      <div className="cast">
        {cast.map((p) => (
          <div key={`${p.name}-${p.character}`} className="person">
            <span className="person__photo">
              {p.photo ? (
                <img src={img(p.photo)} alt="" loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.add("is-loaded")} />
              ) : (
                <span className="person__initials">{initials(p.name)}</span>
              )}
            </span>
            <span className="person__name">{p.name}</span>
            {p.character && <span className="person__role">{p.character}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Words in a name that say something about it ("mickey", "christmas"; not "the" or "movie"). */
function nameWords(name: string) {
  const skip = new Set(["the", "and", "movie", "film", "part", "with", "from", "into", "upon", "once"]);
  return new Set(
    name
      .toLowerCase()
      .replace(/['’]s\b/g, "")
      .replace(/['’]/g, "")
      .split(/[^\p{L}\p{N}]+/u)
      .map((w) => (w.endsWith("s") && w.length > 4 ? w.slice(0, -1) : w))
      .filter((w) => w.length >= 4 && !skip.has(w)),
  );
}

/** Other titles in the library that are like this one: the same collection, show or studio, shared genres, names. */
export function similarTitles(title: TitleDetail, all: TitleSummary[], max = 10) {
  const genres = new Set((title.meta?.genres ?? []).map((g) => g.toLowerCase()));
  const studio = title.meta?.studio?.toLowerCase();
  const collection = title.meta?.extra?.collectionId ?? null;
  const words = nameWords(title.name);
  return all
    .filter((t) => t.id !== title.id)
    .map((t) => {
      let score = 0;
      if (collection != null && t.collectionId === collection) score += 6;
      // The show it's from, and the show's other movies.
      if (title.parentId != null && (t.id === title.parentId || t.parentId === title.parentId)) score += 5;
      if (studio && t.studio?.toLowerCase() === studio) score += 3;
      score += t.genres.filter((g) => genres.has(g.toLowerCase())).length;
      if (t.isMovie && title.isMovie) score += 1;
      for (const w of nameWords(t.name)) if (words.has(w)) score += 2;
      return { t, score };
    })
    .filter((x) => x.score >= 5)
    .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name))
    .slice(0, max)
    .map((x) => x.t);
}

export function MoreLikeThis({
  title,
  all,
  onOpen,
  onPlay,
}: {
  title: TitleDetail;
  all: TitleSummary[];
  onOpen: (id: number, from?: HTMLElement | null) => void;
  onPlay: (titleId: number) => void;
}) {
  const similar = similarTitles(title, all);
  if (similar.length === 0) return null;
  return (
    <section className="tp__section">
      <h2 className="section-title">More like this</h2>
      <div className="grid tp__similar">
        {similar.map((t) => (
          <Card key={t.id} title={t} onOpen={onOpen} onPlay={onPlay} />
        ))}
      </div>
    </section>
  );
}
