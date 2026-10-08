// The parts of a movie's page below its description: the details line (length, when it would
// end, picture and sound), moments from the film, the cast, and more like it from the library.
import { useEffect, useState } from "react";
import { img, library, scenes, type FileRow, type SceneInfo, type TitleDetail, type TitleSummary, type Track } from "./api";
import { Card } from "./Browse";
import { PlayIcon } from "../ui/icons";

/** The scenes of a file: undefined while they're being made, null if they can't be. */
export function useScenes(path: string | undefined) {
  const [info, setInfo] = useState<SceneInfo | null | undefined>(undefined);
  useEffect(() => {
    setInfo(undefined);
    if (!path) return;
    let alive = true;
    const off = scenes.onReady((p, i) => alive && p === path && setInfo(i));
    scenes.get(path).then((i) => alive && i && setInfo(i));
    return () => {
      alive = false;
      off.then((f) => f());
    };
  }, [path]);
  return info;
}

/** "1:02:03" / "12:34" */
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
  if (!code || code === "und") return null;
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

function quality(info: SceneInfo) {
  const w = info.width ?? 0;
  const h = info.height ?? 0;
  if (w >= 3200 || h >= 1800) return "4K";
  if (w >= 1800 || h >= 1000) return "1080p";
  if (w >= 1200 || h >= 700) return "720p";
  return h > 0 ? `${h}p` : null;
}

/** "1 h 26 min · Ends at 21:43 · 1080p · 5.1 · Audio: Japanese, English · Subtitles: English". */
export function movieDetails(file: FileRow | undefined, info: SceneInfo | null | undefined, runtime: number | null) {
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
    if (q) parts.push(q);
    const channels = Math.max(0, ...info.audio.map((a) => a.channels ?? 0));
    if (channels >= 8) parts.push("7.1");
    else if (channels >= 6) parts.push("5.1");
    const audio = languages(info.audio, 3);
    if (audio) parts.push(`Audio: ${audio}`);
    const subs = languages(info.subs, 3);
    if (subs) parts.push(`Subtitles: ${subs}`);
  }
  return parts;
}

/** Moments from the film (one per chapter, if it has chapters); a click starts it there. */
export function Scenes({ info, onPlay }: { info: SceneInfo | null | undefined; onPlay: (at: number) => void }) {
  if (info === null || (info && info.scenes.length === 0)) return null;
  const chapters = info?.scenes.some((s) => s.title) ?? false;
  return (
    <section className="tp__section">
      <h2 className="section-title">{chapters ? "Chapters" : "Scenes"}</h2>
      <div className="scenes">
        {info
          ? info.scenes.map((s) => (
              <button key={s.file} className="scene" onClick={() => onPlay(s.time)} title={`Play from ${clock(s.time)}`}>
                <span className="scene__art">
                  <img
                    src={img(`${info.dir}\\${s.file}`)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
                  />
                  <span className="scene__play">
                    <PlayIcon />
                  </span>
                  <span className="scene__time">{clock(s.time)}</span>
                </span>
                {s.title && <span className="scene__name">{s.title}</span>}
              </button>
            ))
          : // Being made: places for them, so the page doesn't jump when they arrive.
            Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="scene is-waiting">
                <span className="scene__art" />
              </span>
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

/** Other titles in the library that are like this one: the same collection or studio, shared genres, names. */
export function similarTitles(title: TitleDetail, all: TitleSummary[], max = 10) {
  const genres = new Set((title.meta?.genres ?? []).map((g) => g.toLowerCase()));
  const studio = title.meta?.studio?.toLowerCase();
  const collection = title.meta?.extra?.collectionId ?? null;
  const words = nameWords(title.name);
  return all
    .filter((t) => t.id !== title.id && t.parentId == null)
    .map((t) => {
      let score = 0;
      if (collection != null && t.collectionId === collection) score += 6;
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

export function MoreLikeThis({ title, onOpen, onPlay }: { title: TitleDetail; onOpen: (id: number, from?: HTMLElement | null) => void; onPlay: (titleId: number) => void }) {
  const [all, setAll] = useState<TitleSummary[]>([]);
  useEffect(() => {
    library.titles().then(setAll);
  }, [title.id]);
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
