// Show page: artwork, description, seasons and episodes, movies, extras.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  library,
  metadata,
  img,
  episodeCode,
  episodeName,
  fileName,
  upNext,
  canResume,
  watch,
  reveal,
  KIND_LABELS,
  type FileRow,
  type MatchSource,
  type SeasonRow,
  type TitleDetail,
} from "./api";
import MatchPicker from "./MatchPicker";
import { BackIcon, CheckIcon, ChevronDown, EditIcon, FolderIcon, PlayIcon, UndoIcon } from "../ui/icons";
import { useContextMenu, type MenuEntry } from "../ui/ContextMenu";
import Typed from "../ui/Typed";

type Picking = { kind: "title" } | { kind: "season"; season: SeasonRow } | { kind: "file"; file: FileRow };

interface Props {
  id: number;
  onBack: () => void;
  onPlay: (fileId: number) => void;
  onScrolled: (scrolled: boolean) => void;
}

export default function TitlePage({ id, onBack, onPlay, onScrolled }: Props) {
  const [title, setTitle] = useState<TitleDetail | null>(null);
  /** The open tab: a season's id, or the movies. null = pick automatically. */
  const [tab, setTab] = useState<number | "movies" | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [fullDescription, setFullDescription] = useState(false);
  const [picking, setPicking] = useState<Picking | null>(null);
  const openMenu = useContextMenu();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    library.title(id).then(setTitle);
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

  if (!title) return <div className="view view--hero tp" />;

  const anime = title.kind === "anime";
  const titleSource: MatchSource = anime ? "anilist" : title.isMovie ? "tmdb-movie" : "tmdb-tv";
  const movieSource: MatchSource = anime ? "anilist" : "tmdb-movie";
  const movies = title.isMovie ? [] : title.files.filter((f) => f.role === "movie");
  const extras = title.files.filter((f) => f.role === "extra");
  const up = upNext(title);
  // Opens on the season being watched (else the first season, else the movies).
  const current =
    tab ?? (up?.file.role === "episode" ? up.file.seasonId : null) ?? title.seasons[0]?.id ?? (movies.length > 0 ? "movies" : null);
  const season = current === "movies" ? undefined : (title.seasons.find((s) => s.id === current) ?? title.seasons[0]);
  const showMovies = current === "movies" || (!season && movies.length > 0);
  const tabCount = title.seasons.length + (movies.length > 0 ? 1 : 0);
  const episodes = season && !showMovies ? title.files.filter((f) => f.role === "episode" && f.seasonId === season.id) : [];
  const upCode = up && up.file.role === "episode" ? episodeCode(up.file, title.seasons.find((s) => s.id === up.file.seasonId)?.number ?? null) : "";
  const upLeft =
    up?.mode === "resume" && up.file.progress && up.file.progress.duration > 0
      ? Math.max(1, Math.round((up.file.progress.duration - up.file.progress.position) / 60))
      : null;
  const year = title.year ?? meta?.year;
  const close = () => setPicking(null);
  const playFile = (file: FileRow) => onPlay(file.id);
  const seasonWatched = episodes.length > 0 && episodes.every((f) => f.progress?.watched);
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
      className="view view--hero tp"
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
        <div className="tp__cover">
          {meta?.cover ? <img src={img(meta.cover)} alt="" decoding="async" /> : <span className="card__placeholder">{title.name}</span>}
        </div>
        <div className="tp__info">
          <div className="tp__eyebrow">{[KIND_LABELS[title.kind], year, meta?.studio].filter(Boolean).join(" · ")}</div>
          <h1 className="tp__title">{title.name}</h1>
          {meta?.name && meta.name.toLowerCase() !== title.name.toLowerCase() && <div className="tp__alt">{meta.name}</div>}
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
          {meta?.description && (
            <div className="tp__desc-box">
              <Typed
                as="p"
                className={`tp__desc ${fullDescription ? "is-open" : ""}`}
                onClick={() => setFullDescription((v) => !v)}
                title={fullDescription ? undefined : "Show all"}
                text={meta.description}
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
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : (
              <h2 className="section-title">{showMovies ? "Movies & Specials" : season?.label}</h2>
            )}

            {showMovies ? (
              <div className="posters">
                {movies.map((f) => (
                  <div key={f.id} className="poster">
                    <button
                      className="card"
                      onClick={() => playFile(f)}
                      onContextMenu={(e) => fileMenu(e, f)}
                      title={f.meta?.name ?? f.name ?? undefined}
                    >
                      <span className="card__art">
                        {f.meta?.thumb ? (
                          <img src={img(f.meta.thumb)} alt="" loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.add("is-loaded")} />
                        ) : (
                          <span className="card__placeholder">{f.meta?.name ?? f.name ?? fileName(f.path)}</span>
                        )}
                        <span className="card__play">
                          <PlayIcon />
                        </span>
                        <WatchMarks file={f} />
                      </span>
                      <span className="card__text">
                        <span className="card__name">{f.meta?.name ?? f.name ?? fileName(f.path)}</span>
                        <span className="card__sub">{f.meta?.year ?? f.year ?? ""}</span>
                      </span>
                    </button>
                    <button className="link poster__change" onClick={() => setPicking({ kind: "file", file: f })}>
                      Change match
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              season && (
                <>
                  <div className="tp__seasonbar">
                    {anime && (
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
                    )}
                    <button
                      className="link tp__markall"
                      onClick={() => watch.set(episodes.map((f) => f.id), !seasonWatched)}
                      data-sfx={seasonWatched ? undefined : "save"}
                    >
                      {seasonWatched ? "Mark season as unwatched" : "Mark season as watched"}
                    </button>
                  </div>
                  <div className="eps">
                    {episodes.map((f) => (
                      <Episode
                        key={f.id}
                        file={f}
                        code={episodeCode(f, season.number)}
                        onPlay={() => playFile(f)}
                        onMenu={(e) => fileMenu(e, f)}
                      />
                    ))}
                  </div>
                </>
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
            {showExtras && (
              <div className="extras">
                {extras.map((f) => (
                  <button key={f.id} className="extra" onClick={() => playFile(f)} onContextMenu={(e) => fileMenu(e, f)}>
                    <PlayIcon />
                    <span>{f.name ?? fileName(f.path)}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

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

function Episode({ file, code, onPlay, onMenu }: { file: FileRow; code: string; onPlay: () => void; onMenu: (e: React.MouseEvent) => void }) {
  const watched = !!file.progress?.watched;
  return (
    <div
      className={`ep ${watched ? "is-watched" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onPlay}
      onKeyDown={(e) => e.key === "Enter" && onPlay()}
      onContextMenu={onMenu}
    >
      <span className="ep__still">
        {file.meta?.thumb && (
          <img src={img(file.meta.thumb)} alt="" loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.add("is-loaded")} />
        )}
        <span className="ep__play">
          <PlayIcon />
        </span>
        <WatchMarks file={file} />
      </span>
      <span className="ep__main">
        <span className="ep__top">
          {code && <span className="ep__code">{code}</span>}
          <span className="ep__name">{episodeName(file)}</span>
          {file.isNew && <span className="ep__new">New</span>}
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
    </div>
  );
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
