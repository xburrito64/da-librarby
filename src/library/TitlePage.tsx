// Show and movie pages: artwork, description, seasons and episodes, movies, extras; for movies
// also "About", the cast and more like it (MovieParts.tsx).
import { useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  library,
  metadata,
  img,
  episodeCode,
  episodeName,
  fileName,
  upNext,
  canResume,
  fileInfo,
  episodeFrames,
  watch,
  reveal,
  KIND_LABELS,
  type FileRow,
  type MatchSource,
  type SeasonRow,
  type TitleDetail,
  type TitleSummary,
} from "./api";
import MatchPicker from "./MatchPicker";
import { BackIcon, CheckIcon, ChevronDown, EditIcon, FolderIcon, InfoIcon, PlayIcon, PlusIcon, ShuffleIcon, UndoIcon } from "../ui/icons";
import { useShuffle } from "./shuffle";
import { useContextMenu, type MenuEntry } from "../ui/ContextMenu";
import Typed from "../ui/Typed";
import { formatDuration } from "./WatchStats";
import { About, Cast, MoreLikeThis, movieDetails, useFileInfo } from "./MovieParts";
import { Card } from "./Browse";
import EpisodeInfo from "./EpisodeInfo";
import { useCopy } from "../theme/copy";

type Picking = { kind: "title" } | { kind: "season"; season: SeasonRow } | { kind: "file"; file: FileRow };

interface Props {
  id: number;
  /** Already loaded, so the page shows complete straight away. */
  initial?: TitleDetail | null;
  /** Opened with a view transition, which already fades it in: no fade of its own. */
  still?: boolean;
  onBack: () => void;
  onPlay: (fileId: number) => void;
  /** Opens another show or movie ("more like this"). */
  onOpen: (id: number, from?: HTMLElement | null) => void;
  onScrolled: (scrolled: boolean) => void;
}

export default function TitlePage({ id, initial, still, onBack, onPlay, onOpen, onScrolled }: Props) {
  const [title, setTitle] = useState<TitleDetail | null>(initial ?? null);
  /** The open tab: a season's id, or the movies. null = pick automatically. */
  const [tab, setTab] = useState<number | "movies" | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [fullDescription, setFullDescription] = useState(false);
  const [picking, setPicking] = useState<Picking | null>(null);
  const openMenu = useContextMenu();
  const shuffle = useShuffle();
  const copy = useCopy();
  /** The theme's "check" line is shown in place of the description. */
  const [checking, setChecking] = useState(false);
  /** The episode (or extra) whose card is open. */
  const [infoId, setInfoId] = useState<number | null>(null);
  const closeInfo = useCallback(() => setInfoId(null), []);
  const ref = useRef<HTMLDivElement>(null);
  const movieFile = title?.isMovie ? title.files.find((f) => f.role === "movie") : undefined;
  const info = useFileInfo(movieFile?.path);
  /** Everything in the library: for a show's movies, a movie's collection and "more like this". */
  const [all, setAll] = useState<TitleSummary[]>([]);

  const load = useCallback(() => {
    library.title(id).then(setTitle);
    library.titles().then(setAll);
  }, [id]);

  useEffect(() => {
    load();
    onScrolled(false);
    const off = library.onChanged(load);
    return () => {
      off.then((f) => f());
    };
  }, [load, onScrolled]);

  const meta = title?.meta;
  const color = meta?.color ?? undefined;

  if (!title) return <div className={`view view--hero tp ${still ? "tp--still" : ""}`} />;

  const anime = title.kind === "anime";
  const titleSource: MatchSource = anime ? "anilist" : title.isMovie ? "tmdb-movie" : "tmdb-tv";
  const movieSource: MatchSource = anime ? "anilist" : "tmdb-movie";
  // The show's movies are titles of their own, each with its page.
  const movies = title.isMovie
    ? []
    : all.filter((t) => t.parentId === title.id && t.isMovie).sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || a.name.localeCompare(b.name));
  const up = upNext(title);
  // Opens on the season being watched (else the first season, else the movies).
  const current =
    tab ?? (up?.file.role === "episode" ? up.file.seasonId : null) ?? title.seasons[0]?.id ?? (movies.length > 0 ? "movies" : null);
  const season = current === "movies" ? undefined : (title.seasons.find((s) => s.id === current) ?? title.seasons[0]);
  const showMovies = current === "movies" || (!season && movies.length > 0);
  // With both seasons and movies, the movies tab shows the movies' extras and the seasons the rest.
  const split = title.seasons.length > 0 && movies.length > 0;
  const extras = title.files.filter((f) => f.role === "extra" && (!split || f.extraMovie === showMovies));
  const extraGroups = groupExtras(extras);
  const extraHeadings = extraGroups.length > 1 || extraGroups[0]?.label != null;
  const tabCount = title.seasons.length + (movies.length > 0 ? 1 : 0);
  const episodes = season && !showMovies ? title.files.filter((f) => f.role === "episode" && f.seasonId === season.id) : [];
  const upCode = up && up.file.role === "episode" ? episodeCode(up.file, title.seasons.find((s) => s.id === up.file.seasonId)?.number ?? null) : "";
  const upLeft =
    up?.mode === "resume" && up.file.progress && up.file.progress.duration > 0
      ? Math.max(1, Math.round((up.file.progress.duration - up.file.progress.position) / 60))
      : null;
  const year = title.year ?? meta?.year;
  const where = whereYouAre(title, up?.file ?? null);
  const seasonDone = (id: number) => {
    const eps = title.files.filter((f) => f.role === "episode" && f.seasonId === id);
    return eps.length > 0 && eps.every((f) => f.progress?.watched);
  };
  const close = () => setPicking(null);
  const infoFile = infoId != null ? title.files.find((f) => f.id === infoId) : undefined;
  const playFile = (file: FileRow) => onPlay(file.id);
  const playTitle = (titleId: number) =>
    library.title(titleId).then((t) => {
      const next = t && upNext(t);
      if (next) onPlay(next.file.id);
    });
  const extra = meta?.extra ?? null;
  const details = title.isMovie ? movieDetails(movieFile, info, extra?.runtime ?? null) : [];
  const watchedOn =
    movieFile?.progress?.watched && !canResume(movieFile.progress)
      ? `Watched on ${new Date(movieFile.progress.updatedAt * 1000).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`
      : null;
  const checkText =
    title.isMovie && copy.check
      ? copy.check({
          name: meta?.name ?? title.name,
          score: meta?.score ?? null,
          year: year ?? null,
          minutes: info?.duration ? Math.round(info.duration / 60) : (extra?.runtime ?? null),
          tagline: extra?.tagline ?? null,
          genres: meta?.genres ?? [],
        })
      : null;
  const description = checking && checkText ? checkText : meta?.description;
  // Right-click menu of an episode or movie.
  const fileMenu = (e: React.MouseEvent, file: FileRow) => {
    const items: MenuEntry[] = [{ label: "Play", icon: <PlayIcon />, onSelect: () => playFile(file) }];
    if (canResume(file.progress))
      items.push({
        label: "Play from the beginning",
        icon: <UndoIcon />,
        onSelect: () => watch.save(file.id, 0, file.progress!.duration, false).then(() => playFile(file)),
      });
    items.push(
      { label: "More info", icon: <InfoIcon />, onSelect: () => setInfoId(file.id) },
      "divider",
      file.progress?.watched
        ? { label: "Mark as unwatched", icon: <UndoIcon />, onSelect: () => watch.set([file.id], false) }
        : { label: "Mark as watched", icon: <CheckIcon />, onSelect: () => watch.set([file.id], true), sfx: "save" },
      { label: "Open file location", icon: <FolderIcon />, onSelect: () => reveal(file.path) },
    );
    openMenu(e, items);
  };

  return (
    <div
      ref={ref}
      className={`view view--hero tp ${title.isMovie ? "tp--movie" : ""} ${still ? "tp--still" : ""}`}
      style={{ "--c": color } as React.CSSProperties}
      onScroll={(e) => onScrolled(e.currentTarget.scrollTop > 8)}
    >
      <div className="tp__backdrop">{meta?.banner && <img src={img(meta.banner)} alt="" decoding="async" />}</div>
      <span className="tp__decor tp__decor--back" aria-hidden="true" />
      <span className="tp__decor tp__decor--top" aria-hidden="true" />
      <span className="tp__decor tp__decor--bottom" aria-hidden="true" />

      <header className="tp__head">
        <button className="btn btn--ghost btn--small tp__back" onClick={onBack} title="Back (Esc)" data-sfx="back">
          <BackIcon />
          Back
        </button>
        <div className="tp__cover" data-id={title.id}>
          {meta?.cover ? <img src={img(meta.cover)} alt="" decoding="async" /> : <span className="card__placeholder">{title.name}</span>}
        </div>
        <div className="tp__info">
          <div className="tp__eyebrow">
            {[KIND_LABELS[title.kind], year, meta?.studio].filter(Boolean).join(" · ")}
            {title.parentId != null && (
              <>
                {" · "}
                <button className="tp__parent" onClick={() => onOpen(title.parentId!)} title={`Open ${title.parentName}`}>
                  From {title.parentName}
                </button>
              </>
            )}
          </div>
          <h1 className="tp__title">{title.name}</h1>
          {meta?.name && meta.name.toLowerCase() !== title.name.toLowerCase() && <div className="tp__alt">{meta.name}</div>}
          {extra?.tagline && <div className="tp__tagline">{extra.tagline}</div>}
          {(meta?.score != null || (meta?.genres.length ?? 0) > 0) && (
            <div className="tp__facts">
              {meta?.score != null && <span className="chip chip--score">{meta.score}%</span>}
              {meta?.genres.map((g) => (
                <span key={g} className="chip">
                  {g}
                </span>
              ))}
            </div>
          )}
          {details.length > 0 && (
            <div className="tp__details">
              {details.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
          )}
          {extra && extra.directors.length > 0 && (
            <div className="tp__credits">
              Directed by {extra.directors.slice(0, 3).join(", ")}
              {extra.directors.length > 3 && ` and ${extra.directors.length - 3} more`}
            </div>
          )}
          {description && (
            <div className="tp__desc-box">
              <Typed
                as="p"
                className={`tp__desc ${fullDescription || checking ? "is-open" : ""}`}
                onClick={() => (checking ? setChecking(false) : setFullDescription((v) => !v))}
                title={fullDescription || checking ? undefined : "Show all"}
                text={description}
              />
            </div>
          )}
          <div className="tp__actions">
            {up && (
              <button className="btn btn--primary" onClick={() => playFile(up.file)}>
                <PlayIcon />
                {[up.mode === "resume" ? "Resume" : "Play", upCode].filter(Boolean).join(" ")}
              </button>
            )}
            {shuffle && title.files.filter((f) => f.role === "episode").length > 1 && (
              <button className="btn" onClick={() => shuffle(title.id)} title="Play the episodes in a random order">
                <ShuffleIcon />
                Shuffle
              </button>
            )}
            <button
              className={`btn ${title.listedAt != null ? "is-listed" : ""}`}
              onClick={() => library.setListed(title.id, title.listedAt == null)}
              title={title.listedAt != null ? "Remove from My List" : "Save it for later on the home screen"}
              data-sfx={title.listedAt != null ? "back" : "save"}
            >
              {title.listedAt != null ? <CheckIcon /> : <PlusIcon />}
              My List
            </button>
            {checkText && (
              <button className={`btn ${checking ? "is-listed" : ""}`} onClick={() => setChecking((v) => !v)} title="Check it out">
                <InfoIcon />
                Check
              </button>
            )}
            <button className="btn" onClick={() => setPicking({ kind: "title" })}>
              <EditIcon />
              Fix match
            </button>
            {title.files.length > 0 && (
              <button className="btn" onClick={() => reveal((title.files.find((f) => f.role !== "extra") ?? title.files[0]).path)}>
                <FolderIcon />
                Open folder
              </button>
            )}
          </div>
          {(where ?? watchedOn) && <div className="tp__where">{where ?? watchedOn}</div>}
          {upLeft != null && (
            <div className="tp__resume">
              <span className="progress tp__resume-bar">
                <span style={{ width: `${(up!.file.progress!.position / up!.file.progress!.duration) * 100}%` }} />
              </span>
              {upLeft} min left
            </div>
          )}
          <div className="tp__note">
            {matchNote(title)} · {title.folder}
          </div>
        </div>
      </header>

      <div className="tp__body">
        {title.isMovie && movieFile && (
          <>
            <About title={title} file={movieFile} info={info} all={all} />
            <Cast title={title} />
          </>
        )}
        {tabCount > 0 && (
          <section className="tp__section">
            {tabCount > 1 ? (
              <div className="seasons" role="tablist">
                {movies.length > 0 && (
                  <button role="tab" className={`seasons__tab ${showMovies ? "is-active" : ""}`} onClick={() => setTab("movies")}>
                    Movies & Specials
                  </button>
                )}
                {title.seasons.map((s) => (
                  <button
                    key={s.id}
                    role="tab"
                    className={`seasons__tab ${!showMovies && s.id === season?.id ? "is-active" : ""}`}
                    onClick={() => setTab(s.id)}
                    title={seasonDone(s.id) ? `${s.label}: all watched` : undefined}
                  >
                    {s.label}
                    {seasonDone(s.id) && (
                      <span className="seasons__done" aria-label="all watched">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <h2 className="section-title">{showMovies ? "Movies & Specials" : season?.label}</h2>
            )}

            {showMovies ? (
              <div className="posters">
                {movies.map((m) => (
                  <div key={m.id} className="poster">
                    <Card title={m} onOpen={onOpen} onPlay={playTitle} />
                    <button className="link poster__change" onClick={() => playTitle(m.id)}>
                      <PlayIcon />
                      Play
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              season && (
                <SeasonEpisodes
                  season={season}
                  episodes={episodes}
                  next={up?.file ?? null}
                  onPlay={playFile}
                  onMenu={fileMenu}
                  onInfo={(f) => setInfoId(f.id)}
                  note={
                    anime && (
                      <p className="tp__seasonnote">
                        {season.meta?.providerIds.length
                          ? `AniList: ${season.meta.name ?? ""}${season.meta.providerIds.length > 1 ? ` + ${season.meta.providerIds.length - 1} more part${season.meta.providerIds.length > 2 ? "s" : ""}` : ""}`
                          : season.meta
                            ? "No AniList entry"
                            : "Looking up…"}
                        {season.meta?.locked && " (set by hand)"} ·{" "}
                        <button className="link" onClick={() => setPicking({ kind: "season", season })}>
                          Change
                        </button>
                      </p>
                    )
                  }
                />
              )
            )}
          </section>
        )}

        {extras.length > 0 && (
          <section className="tp__section">
            <button className={`section-title section-title--toggle ${showExtras ? "is-open" : ""}`} onClick={() => setShowExtras((v) => !v)}>
              Extras <span className="section-title__count">{extras.length}</span>
              <ChevronDown />
            </button>
            {showExtras &&
              extraGroups.map((group) => (
                <div key={group.label ?? ""} className="extras-group">
                  {extraHeadings && (
                    <h3 className="extras__heading">
                      {group.label ?? "More"}
                      <span className="extras__count">{group.files.length}</span>
                    </h3>
                  )}
                  <div className="extras">
                    {group.files.map((f) => (
                      <button key={f.id} className="extra" onClick={() => playFile(f)} onContextMenu={(e) => fileMenu(e, f)}>
                        <PlayIcon />
                        <span>{f.name ?? fileName(f.path)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </section>
        )}
        {title.isMovie && <MoreLikeThis title={title} all={all} onOpen={onOpen} onPlay={playTitle} />}
      </div>

      {infoFile && (
        <EpisodeInfo
          file={infoFile}
          title={title}
          code={infoFile.role === "episode" ? episodeCode(infoFile, title.seasons.find((s) => s.id === infoFile.seasonId)?.number ?? null) : ""}
          onPlay={playFile}
          onClose={closeInfo}
        />
      )}
      {picking?.kind === "title" && (
        <MatchPicker
          heading={`Which ${title.isMovie ? "movie" : "show"} is "${title.name}"?`}
          source={titleSource}
          initialQuery={title.name}
          current={meta?.providerIds.map(Number)}
          onSave={([pick]) => metadata.matchTitle(title.id, "pick", pick).then(close)}
          onAutomatic={() => metadata.matchTitle(title.id, "auto").then(close)}
          onNone={() => metadata.matchTitle(title.id, "none").then(close)}
          onClose={close}
        />
      )}
      {picking?.kind === "season" && (
        <MatchPicker
          heading={`${title.name}: ${picking.season.label}`}
          source="anilist"
          initialQuery={picking.season.meta?.name ?? title.meta?.name ?? title.name}
          multiple
          current={picking.season.meta?.providerIds.map(Number)}
          onSave={(ids) => metadata.matchSeason(picking.season.id, ids).then(close)}
          onAutomatic={() => metadata.matchSeason(picking.season.id, []).then(close)}
          onClose={close}
        />
      )}
      {picking?.kind === "file" && (
        <MatchPicker
          heading={`Which movie is "${picking.file.name ?? fileName(picking.file.path)}"?`}
          source={movieSource}
          initialQuery={picking.file.name ?? fileName(picking.file.path)}
          current={picking.file.meta?.providerIds.map(Number)}
          onSave={([pick]) => metadata.matchFile(picking.file.id, "pick", pick).then(close)}
          onAutomatic={() => metadata.matchFile(picking.file.id, "auto").then(close)}
          onNone={() => metadata.matchFile(picking.file.id, "none").then(close)}
          onClose={close}
        />
      )}
    </div>
  );
}

/** A picture taken from the episode itself, for one nothing else has a picture for (`path`: null
 *  for one that has): asked for once its place on the page comes into view, and kept. */
function useFrame(path: string | null, place: React.RefObject<HTMLElement | null>) {
  const [frame, setFrame] = useState<string | null>(null);
  useEffect(() => {
    setFrame(null);
    const el = place.current;
    if (!path || !el) return;
    let alive = true;
    const off = episodeFrames.onReady((p, file) => {
      if (alive && p === path && file) setFrame(file);
    });
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      seen.disconnect();
      void episodeFrames.get(path).then((file) => alive && file && setFrame(file));
    });
    seen.observe(el);
    return () => {
      alive = false;
      seen.disconnect();
      void off.then((f) => f());
    };
  }, [path, place]);
  return frame;
}

/** How long each of these files runs (seconds), as far as known: read from the files themselves
 *  (once, then kept), or from playing them. */
function useLengths(files: FileRow[]) {
  const [lengths, setLengths] = useState<Record<string, number>>({});
  const key = files.map((f) => f.path).join("\n");
  useEffect(() => {
    let alive = true;
    const paths = new Set(key ? key.split("\n") : []);
    const off = fileInfo.onReady((path, info) => {
      if (alive && paths.has(path) && info?.duration) setLengths((l) => ({ ...l, [path]: info.duration }));
    });
    const found: Record<string, number> = {};
    Promise.all(
      [...paths].map((path) =>
        fileInfo
          .get(path)
          .then((info) => {
            if (info?.duration) found[path] = info.duration;
          })
          .catch(() => {}),
      ),
    ).then(() => alive && setLengths((l) => ({ ...l, ...found })));
    return () => {
      alive = false;
      off.then((f) => f());
    };
  }, [key]);
  return (f: FileRow) => lengths[f.path] || f.progress?.duration || 0;
}

/** A season's episodes, with where you are in it at the top: how many episodes, how many watched,
 *  about how long is left, playing on from where you are, and marking it all watched. (Themes
 *  show as much of the top as suits them; `note`: what it was matched to, for anime.) */
function SeasonEpisodes({
  season,
  episodes,
  next,
  note,
  onPlay,
  onMenu,
  onInfo,
}: {
  season: SeasonRow;
  episodes: FileRow[];
  next: FileRow | null;
  note: React.ReactNode;
  onPlay: (file: FileRow) => void;
  onMenu: (e: React.MouseEvent, file: FileRow) => void;
  onInfo: (file: FileRow) => void;
}) {
  const length = useLengths(episodes);
  const allWatched = episodes.length > 0 && episodes.every((f) => f.progress?.watched);
  const watched = episodes.filter((f) => f.progress?.watched).length;
  // What's left: the episodes not watched yet (less what's been seen of one stopped part-way),
  // those whose length isn't known yet counted as long as the others.
  const known = episodes.map(length).filter((s) => s > 60);
  const typical = known.length > 0 ? known.reduce((a, b) => a + b, 0) / known.length : 0;
  const left = episodes
    .filter((f) => !f.progress?.watched || canResume(f.progress))
    .reduce((sum, f) => sum + Math.max(0, (length(f) || typical) - (canResume(f.progress) ? f.progress!.position : 0)), 0);
  // Playing on in this season: where you are, if it's here, else the first one not watched yet.
  const here = next && episodes.includes(next) ? next : (episodes.find((f) => canResume(f.progress)) ?? episodes.find((f) => !f.progress?.watched));
  const facts = [
    `${episodes.length} episode${episodes.length === 1 ? "" : "s"}`,
    allWatched ? "all watched" : watched > 0 ? `${watched} watched` : null,
    !allWatched && left > 60 ? `about ${formatDuration(left)} left` : null,
  ].filter(Boolean);
  return (
    <>
      <div className="tp__seasonbar">
        <div className="tp__seasonsum">
          <span className="tp__seasonname">{season.label}</span>
          <span className="tp__seasonfacts">{facts.join(" · ")}</span>
          <span className="progress tp__seasonprogress">
            <span style={{ width: `${(watched / Math.max(1, episodes.length)) * 100}%` }} />
          </span>
        </div>
        {note}
        <span className="tp__seasonactions">
          {here && (
            <button className="btn btn--primary tp__seasonplay" onClick={() => onPlay(here)}>
              <PlayIcon />
              {canResume(here.progress) ? "Resume" : "Play"} {episodeCode(here, season.number)}
            </button>
          )}
          <button className="link tp__markall" onClick={() => watch.set(episodes.map((f) => f.id), !allWatched)} data-sfx={allWatched ? undefined : "save"}>
            {allWatched ? "Mark season as unwatched" : "Mark season as watched"}
          </button>
        </span>
      </div>
      <div className="eps">
        {episodes.map((f) => (
          <Episode
            key={f.id}
            file={f}
            code={episodeCode(f, season.number)}
            next={f === next}
            seconds={length(f)}
            onPlay={() => onPlay(f)}
            onMenu={(e) => onMenu(e, f)}
            onInfo={() => onInfo(f)}
          />
        ))}
      </div>
    </>
  );
}

function Episode({
  file,
  code,
  next,
  seconds,
  onPlay,
  onMenu,
  onInfo,
}: {
  file: FileRow;
  code: string;
  /** The one to watch next. */
  next: boolean;
  /** How long it runs (0: not known). */
  seconds: number;
  onPlay: () => void;
  onMenu: (e: React.MouseEvent) => void;
  onInfo: () => void;
}) {
  const watched = !!file.progress?.watched;
  const p = file.progress;
  const still = useRef<HTMLSpanElement>(null);
  const frame = useFrame(file.meta?.thumb ? null : file.path, still);
  const left = canResume(p) && p!.duration > 0 ? Math.max(1, Math.round((p!.duration - p!.position) / 60)) : null;
  // How far you are with it, for themes that show it.
  const state = left ? `${left} min left` : watched ? "watched" : null;
  return (
    <div
      className={`ep ${watched ? "is-watched" : ""} ${next ? "is-next" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => e.key === "Enter" && onPlay()}
      onContextMenu={onMenu}
    >
      <span className="ep__num" aria-hidden="true">
        {file.episode != null ? (file.episodeEnd != null ? `${file.episode}–${file.episodeEnd}` : file.episode) : ""}
      </span>
      <span className="ep__still" ref={still}>
        {(file.meta?.thumb || frame) && (
          <img
            src={file.meta?.thumb ? img(file.meta.thumb) : convertFileSrc(frame!)}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
          />
        )}
        <span className="ep__play">
          <PlayIcon />
        </span>
        <WatchMarks file={file} />
      </span>
      <span className="ep__main">
        {next && <span className="ep__upnext">Up next</span>}
        <span className="ep__top">
          {code && <span className="ep__code">{code}</span>}
          <span className="ep__name">{episodeName(file)}</span>
          {file.isNew && <span className="ep__new">New</span>}
        </span>
        {/* Its code, length and how far you are, for themes that show them (the code is shown on its
            own otherwise). */}
        <span className="ep__meta">
          {code && <span>{code}</span>}
          {seconds > 60 && <span>{Math.round(seconds / 60)} min</span>}
          {state && <span className="ep__state">{state}</span>}
        </span>
        {file.meta?.description && <span className="ep__desc">{file.meta.description}</span>}
      </span>
      <button
        className={`ep__toggle ${watched ? "is-on" : ""}`}
        data-sfx={watched ? undefined : "save"}
        onClick={(e) => {
          e.stopPropagation();
          watch.set([file.id], !watched);
        }}
        title={watched ? "Mark as unwatched" : "Mark as watched"}
      >
        <CheckIcon />
      </button>
      <button
        className="ep__info"
        onClick={(e) => {
          e.stopPropagation();
          onInfo();
        }}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.stopPropagation()}
        title="More info"
      >
        <span>i</span>
      </button>
    </div>
  );
}

/** Extras under their headings ("Season 15", "TV Shorts"; null = the rest). They come sorted. */
function groupExtras(extras: FileRow[]) {
  const groups: { label: string | null; files: FileRow[] }[] = [];
  for (const f of extras) {
    const last = groups[groups.length - 1];
    if (last && last.label === f.extraGroup) last.files.push(f);
    else groups.push({ label: f.extraGroup, files: [f] });
  }
  return groups;
}

/** "Season 3 · 4 of 12 episodes left · about 1 h 30 min · 40 in total", once a show is started. */
function whereYouAre(title: TitleDetail, next: FileRow | null) {
  const episodes = title.files.filter((f) => f.role === "episode");
  if (episodes.length === 0 || !episodes.some((f) => f.progress)) return null;
  const left = episodes.filter((f) => !f.progress?.watched);
  if (left.length === 0) return `All ${episodes.length} episodes watched`;
  if (next?.role !== "episode") return null;
  const season = title.seasons.find((s) => s.id === next.seasonId);
  const inSeason = episodes.filter((f) => f.seasonId === next.seasonId);
  const seasonLeft = inSeason.filter((f) => !f.progress?.watched);
  // How long an episode usually runs, from the ones played so far.
  const lengths = episodes.map((f) => f.progress?.duration ?? 0).filter((d) => d > 60);
  const typical = lengths.length > 0 ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;
  const time = typical > 0 ? seasonLeft.reduce((sum, f) => sum + Math.max(0, (f.progress?.duration || typical) - (f.progress?.position ?? 0)), 0) : 0;
  return [
    season && title.seasons.length > 1 ? season.label : null,
    `${seasonLeft.length} of ${inSeason.length} episode${inSeason.length === 1 ? "" : "s"} left`,
    time > 60 ? `about ${formatDuration(time)}` : null,
    left.length > seasonLeft.length ? `${left.length} in total` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Progress bar for something stopped part-way, a tick for something watched. */
function WatchMarks({ file }: { file: FileRow }) {
  const p = file.progress;
  if (p?.watched && !canResume(p))
    return (
      <span className="watched-badge" title="Watched">
        <CheckIcon />
      </span>
    );
  if (canResume(p) && p!.duration > 0)
    return (
      <span className="progress">
        <span style={{ width: `${(p!.position / p!.duration) * 100}%` }} />
      </span>
    );
  return null;
}

function matchNote(title: TitleDetail) {
  const source = title.kind === "anime" ? "AniList" : "TMDB";
  if (!title.meta) return "Not looked up yet";
  if (title.meta.providerIds.length === 0) return `No ${source} match${title.meta.locked ? " (set by hand)" : ""}`;
  return `Info from ${source}${title.meta.locked ? " (matched by hand)" : ""}`;
}
