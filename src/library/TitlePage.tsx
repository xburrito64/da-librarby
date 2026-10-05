// Show page: artwork, description, seasons and episodes, movies, extras.
// Plain layout for now; the real design comes later.
import { useCallback, useEffect, useState } from "react";
import { library, metadata, img, episodeCode, type FileRow, type MatchSource, type SeasonRow, type TitleDetail } from "./api";
import MatchPicker from "./MatchPicker";
import type { PlayRequest } from "./LibraryView";

type Picking =
  | { kind: "title" }
  | { kind: "season"; season: SeasonRow }
  | { kind: "file"; file: FileRow };

export default function TitlePage({ id, onBack, onPlay }: { id: number; onBack: () => void; onPlay: (r: PlayRequest) => void }) {
  const [title, setTitle] = useState<TitleDetail | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [picking, setPicking] = useState<Picking | null>(null);

  const load = useCallback(() => {
    library.title(id).then(setTitle);
  }, [id]);

  useEffect(() => {
    load();
    const off = library.onChanged(load);
    return () => {
      off.then((f) => f());
    };
  }, [load]);

  if (!title) return <div className="lib" />;

  const meta = title.meta;
  const anime = title.kind === "anime";
  const titleSource: MatchSource = anime ? "anilist" : title.isMovie ? "tmdb-movie" : "tmdb-tv";
  const movieSource: MatchSource = anime ? "anilist" : "tmdb-movie";
  const movies = title.files.filter((f) => f.role === "movie");
  const extras = title.files.filter((f) => f.role === "extra");
  const close = () => setPicking(null);

  return (
    <div className="lib title">
      {meta?.banner && <img className="title__banner" src={img(meta.banner)} alt="" />}
      <header className="lib__header">
        <button onClick={onBack}>← Back</button>
        <span className="spacer" />
        <button onClick={() => setPicking({ kind: "title" })}>Fix match</button>
      </header>

      <div className="title__head">
        {meta?.cover && <img className="title__cover" src={img(meta.cover)} alt="" />}
        <div className="title__info">
          <h1>
            {title.name} {(title.year ?? meta?.year) != null && <span className="muted">({title.year ?? meta?.year})</span>}
          </h1>
          {meta?.name && meta.name !== title.name && <p className="muted">{meta.name}</p>}
          <p className="muted small">
            {[meta?.studio, meta?.genres.join(", "), meta?.score != null && `${meta.score}%`].filter(Boolean).join(" · ")}
          </p>
          {meta?.description && <p className="title__description">{meta.description}</p>}
          <p className="muted small">
            {matchNote(title)} · {title.folder}
          </p>
        </div>
      </div>

      {title.seasons.map((season) => (
        <section key={season.id}>
          <div className="title__season">
            {season.meta?.thumb && <img src={img(season.meta.thumb)} alt="" />}
            <div>
              <h2>{season.label}</h2>
              {anime && (
                <p className="muted small">
                  {season.meta?.providerIds.length
                    ? `AniList: ${season.meta.name ?? ""}${season.meta.providerIds.length > 1 ? ` + ${season.meta.providerIds.length - 1} more part${season.meta.providerIds.length > 2 ? "s" : ""}` : ""}`
                    : season.meta
                      ? "No AniList entry"
                      : "Looking up…"}
                  {season.meta?.locked && " (set by hand)"}{" "}
                  <button className="lib__link" onClick={() => setPicking({ kind: "season", season })}>
                    change
                  </button>
                </p>
              )}
            </div>
          </div>
          {title.files
            .filter((f) => f.role === "episode" && f.seasonId === season.id)
            .map((f) => {
              const code = episodeCode(f, season.number);
              const name = f.name ?? f.meta?.name ?? (f.episode != null ? `Episode ${f.episode}` : fileName(f.path));
              return (
                <button
                  key={f.id}
                  className="lib__row title__episode"
                  onClick={() => onPlay({ path: f.path, label: [title.name, code, name].filter(Boolean).join(" · ") })}
                >
                  <span className="lib__code">{code}</span>
                  <span className="title__still">{f.meta?.thumb && <img src={img(f.meta.thumb)} alt="" loading="lazy" />}</span>
                  <span className="title__epinfo">
                    <span>{name}</span>
                    {f.meta?.description && <span className="muted small title__epdesc">{f.meta.description}</span>}
                  </span>
                </button>
              );
            })}
        </section>
      ))}

      {movies.length > 0 && (
        <section>
          <h2>{title.isMovie ? "Movie" : "Movies & Specials"}</h2>
          <div className="title__movies">
            {movies.map((f) => (
              <div key={f.id} className="title__movie">
                <button className="title__poster" onClick={() => onPlay({ path: f.path, label: f.meta?.name ?? f.name ?? title.name })}>
                  {f.meta?.thumb ? <img src={img(f.meta.thumb)} alt="" /> : <div className="title__noimg" />}
                </button>
                <div className="small">{f.meta?.name ?? f.name ?? fileName(f.path)}</div>
                <div className="muted small">
                  {f.meta?.year ?? f.year}
                  {!title.isMovie && (
                    <>
                      {" "}
                      <button className="lib__link" onClick={() => setPicking({ kind: "file", file: f })}>
                        change
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {extras.length > 0 && (
        <section>
          <h2>
            <button className="lib__link" onClick={() => setShowExtras((v) => !v)}>
              Extras ({extras.length}) {showExtras ? "▾" : "▸"}
            </button>
          </h2>
          {showExtras &&
            extras.map((f) => (
              <button key={f.id} className="lib__row" onClick={() => onPlay({ path: f.path, label: f.name ?? fileName(f.path) })}>
                <span>{f.name ?? fileName(f.path)}</span>
              </button>
            ))}
        </section>
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

function matchNote(title: TitleDetail) {
  const source = title.kind === "anime" ? "AniList" : "TMDB";
  if (!title.meta) return "Not looked up yet";
  if (title.meta.providerIds.length === 0) return `No ${source} match${title.meta.locked ? " (set by hand)" : ""}`;
  return `${source} match${title.meta.locked ? " (set by hand)" : ""}`;
}

function fileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}
