// Show page: artwork, description, seasons and episodes, movies, extras.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  library,
  metadata,
  img,
  episodeCode,
  episodeName,
  fileName,
  firstPlayable,
  playRequest,
  KIND_LABELS,
  type FileRow,
  type MatchSource,
  type PlayRequest,
  type SeasonRow,
  type TitleDetail,
} from "./api";
import MatchPicker from "./MatchPicker";
import { BackIcon, ChevronDown, EditIcon, PlayIcon } from "../ui/icons";

type Picking = { kind: "title" } | { kind: "season"; season: SeasonRow } | { kind: "file"; file: FileRow };

interface Props {
  id: number;
  onBack: () => void;
  onPlay: (request: PlayRequest) => void;
  onScrolled: (scrolled: boolean) => void;
}

export default function TitlePage({ id, onBack, onPlay, onScrolled }: Props) {
  const [title, setTitle] = useState<TitleDetail | null>(null);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [fullDescription, setFullDescription] = useState(false);
  const [picking, setPicking] = useState<Picking | null>(null);
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
  const season = title.seasons.find((s) => s.id === seasonId) ?? title.seasons[0];
  const episodes = season ? title.files.filter((f) => f.role === "episode" && f.seasonId === season.id) : [];
  const movies = title.files.filter((f) => f.role === "movie");
  const extras = title.files.filter((f) => f.role === "extra");
  const first = firstPlayable(title);
  const firstSeason = first && title.seasons.find((s) => s.id === first.file.seasonId);
  const year = title.year ?? meta?.year;
  const close = () => setPicking(null);
  const playFile = (file: FileRow) =>
    onPlay(playRequest(title, file, title.seasons.find((s) => s.id === file.seasonId)?.number ?? null));

  return (
    <div
      ref={ref}
      className="view view--hero tp"
      style={{ "--c": color } as React.CSSProperties}
      onScroll={(e) => onScrolled(e.currentTarget.scrollTop > 8)}
    >
      <div className="tp__backdrop">{meta?.banner && <img src={img(meta.banner)} alt="" decoding="async" />}</div>

      <header className="tp__head">
        <button className="btn btn--ghost btn--small tp__back" onClick={onBack} title="Back (Esc)">
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
            <p
              className={`tp__desc ${fullDescription ? "is-open" : ""}`}
              onClick={() => setFullDescription((v) => !v)}
              title={fullDescription ? undefined : "Show all"}
            >
              {meta.description}
            </p>
          )}
          <div className="tp__actions">
            {first && (
              <button className="btn btn--primary" onClick={() => onPlay(first.request)}>
                <PlayIcon />
                {first.file.role === "episode" ? `Play ${episodeCode(first.file, firstSeason?.number ?? null)}` : "Play"}
              </button>
            )}
            <button className="btn" onClick={() => setPicking({ kind: "title" })}>
              <EditIcon />
              Fix match
            </button>
          </div>
          <div className="tp__note">
            {matchNote(title)} · {title.folder}
          </div>
        </div>
      </header>

      <div className="tp__body">
        {season && (
          <section className="tp__section">
            {title.seasons.length > 1 ? (
              <div className="seasons" role="tablist">
                {title.seasons.map((s) => (
                  <button
                    key={s.id}
                    role="tab"
                    className={`seasons__tab ${s.id === season.id ? "is-active" : ""}`}
                    onClick={() => setSeasonId(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : (
              <h2 className="section-title">{season.label}</h2>
            )}
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
            <div className="eps">
              {episodes.map((f) => (
                <Episode key={f.id} file={f} code={episodeCode(f, season.number)} onPlay={() => playFile(f)} />
              ))}
            </div>
          </section>
        )}

        {movies.length > 0 && !title.isMovie && (
          <section className="tp__section">
            <h2 className="section-title">Movies & Specials</h2>
            <div className="posters">
              {movies.map((f) => (
                <div key={f.id} className="poster">
                  <button className="card" onClick={() => playFile(f)} title={f.meta?.name ?? f.name ?? undefined}>
                    <span className="card__art">
                      {f.meta?.thumb ? (
                        <img src={img(f.meta.thumb)} alt="" loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.add("is-loaded")} />
                      ) : (
                        <span className="card__placeholder">{f.meta?.name ?? f.name ?? fileName(f.path)}</span>
                      )}
                      <span className="card__play">
                        <PlayIcon />
                      </span>
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
                  <button key={f.id} className="extra" onClick={() => playFile(f)}>
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

function Episode({ file, code, onPlay }: { file: FileRow; code: string; onPlay: () => void }) {
  return (
    <button className="ep" onClick={onPlay}>
      <span className="ep__still">
        {file.meta?.thumb && (
          <img src={img(file.meta.thumb)} alt="" loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.add("is-loaded")} />
        )}
        <span className="ep__play">
          <PlayIcon />
        </span>
      </span>
      <span className="ep__main">
        <span className="ep__top">
          {code && <span className="ep__code">{code}</span>}
          <span className="ep__name">{episodeName(file)}</span>
        </span>
        {file.meta?.description && <span className="ep__desc">{file.meta.description}</span>}
      </span>
    </button>
  );
}

function matchNote(title: TitleDetail) {
  const source = title.kind === "anime" ? "AniList" : "TMDB";
  if (!title.meta) return "Not looked up yet";
  if (title.meta.providerIds.length === 0) return `No ${source} match${title.meta.locked ? " (set by hand)" : ""}`;
  return `Info from ${source}${title.meta.locked ? " (matched by hand)" : ""}`;
}
