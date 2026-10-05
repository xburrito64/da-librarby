// Temporary, plain library screen for checking the scanner. Replaced by the real
// cover grid and show pages in step 4.
import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  library,
  guessKind,
  episodeCode,
  sortName,
  type Library,
  type LibraryKind,
  type TitleDetail,
  type TitleSummary,
} from "./api";
import "./LibraryView.css";

export interface PlayRequest {
  path: string;
  label: string;
}

const KIND_LABELS: Record<LibraryKind, string> = { anime: "Anime", shows: "Shows", movies: "Movies" };

export default function LibraryView({ onPlay }: { onPlay: (request: PlayRequest) => void }) {
  const [libraries, setLibraries] = useState<Library[] | null>(null);
  const [titles, setTitles] = useState<TitleSummary[]>([]);
  const [scanning, setScanning] = useState<string | null>(null);
  const [showFolders, setShowFolders] = useState(false);
  const [openTitle, setOpenTitle] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    library.list().then(setLibraries).catch((e) => setError(String(e)));
    library.titles().then(setTitles).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    refresh();
    library.scanning().then((running) => running && setScanning(""));
    const offs = [
      library.onChanged(refresh),
      library.onScan((s) => {
        setScanning(s.running ? (s.library ?? "") : null);
        if (!s.running) refresh();
      }),
    ];
    return () => offs.forEach((p) => p.then((off) => off()));
  }, [refresh]);

  const groups = useMemo(() => {
    const byKind = new Map<LibraryKind, TitleSummary[]>();
    for (const t of [...titles].sort((a, b) => sortName(a.name).localeCompare(sortName(b.name)))) {
      byKind.set(t.kind, [...(byKind.get(t.kind) ?? []), t]);
    }
    return (["anime", "shows", "movies"] as LibraryKind[])
      .filter((k) => byKind.has(k))
      .map((k) => ({ kind: k, titles: byKind.get(k)! }));
  }, [titles]);

  if (openTitle != null) {
    return <TitlePage id={openTitle} onBack={() => setOpenTitle(null)} onPlay={onPlay} />;
  }

  const noLibraries = libraries != null && libraries.length === 0;

  return (
    <div className="lib">
      <header className="lib__header">
        <h1>Da Librarby</h1>
        <span className="lib__status">
          {scanning != null && `Scanning${scanning ? ` ${scanning}` : ""}…`}
        </span>
        <button onClick={() => library.rescan()}>Rescan</button>
        <button onClick={() => setShowFolders((v) => !v)}>Folders</button>
      </header>

      {error && <p className="lib__error" onClick={() => setError(null)}>{error}</p>}

      {(showFolders || noLibraries) && libraries && (
        <Folders libraries={libraries} onChange={setLibraries} onError={setError} />
      )}

      {groups.map((group) => (
        <section key={group.kind}>
          <h2>
            {KIND_LABELS[group.kind]} <span className="muted">{group.titles.length}</span>
          </h2>
          <div className="lib__titles">
            {group.titles.map((t) => (
              <button
                key={t.id}
                className={`lib__title ${t.online ? "" : "lib__title--offline"}`}
                onClick={() => setOpenTitle(t.id)}
              >
                <strong>{t.name}</strong>
                {t.year != null && <span className="muted"> ({t.year})</span>}
                <div className="muted small">{describe(t)}</div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function describe(t: TitleSummary) {
  if (t.isMovie) return t.online ? "Movie" : "Movie · drive offline";
  const parts = [];
  if (t.seasons) parts.push(`${t.seasons} season${t.seasons === 1 ? "" : "s"}`);
  if (t.episodes) parts.push(`${t.episodes} episodes`);
  if (t.movies) parts.push(`${t.movies} movie${t.movies === 1 ? "" : "s"}`);
  if (!t.online) parts.push("drive offline");
  return parts.join(" · ");
}

function Folders({
  libraries,
  onChange,
  onError,
}: {
  libraries: Library[];
  onChange: (libraries: Library[]) => void;
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState<{ path: string; kind: LibraryKind } | null>(null);

  const pick = async () => {
    const path = await open({ directory: true, multiple: false, title: "Choose a library folder" });
    if (typeof path === "string") setPending({ path, kind: guessKind(path) });
  };

  const add = () => {
    if (!pending) return;
    library
      .add(pending.path, pending.kind)
      .then((libs) => {
        onChange(libs);
        setPending(null);
      })
      .catch((e) => onError(String(e)));
  };

  return (
    <div className="lib__folders">
      <h2>Library folders</h2>
      {libraries.length === 0 && <p className="muted">Add the folders where your anime, shows and movies live.</p>}
      {libraries.map((lib) => (
        <div key={lib.id} className="lib__folder">
          <span>{lib.path}</span>
          <span className="muted">
            {KIND_LABELS[lib.kind]} · {lib.titleCount} title{lib.titleCount === 1 ? "" : "s"}{lib.online ? "" : " · offline"}
          </span>
          <button onClick={() => library.remove(lib.id).then(onChange).catch((e) => onError(String(e)))}>
            Remove
          </button>
        </div>
      ))}
      {pending ? (
        <div className="lib__folder">
          <span>{pending.path}</span>
          <select
            value={pending.kind}
            onChange={(e) => setPending({ ...pending, kind: e.target.value as LibraryKind })}
          >
            <option value="anime">Anime</option>
            <option value="shows">Shows</option>
            <option value="movies">Movies</option>
          </select>
          <button onClick={add}>Add</button>
          <button onClick={() => setPending(null)}>Cancel</button>
        </div>
      ) : (
        <button onClick={pick}>Add folder…</button>
      )}
    </div>
  );
}

function TitlePage({
  id,
  onBack,
  onPlay,
}: {
  id: number;
  onBack: () => void;
  onPlay: (request: PlayRequest) => void;
}) {
  const [title, setTitle] = useState<TitleDetail | null>(null);
  const [showExtras, setShowExtras] = useState(false);

  useEffect(() => {
    library.title(id).then(setTitle);
  }, [id]);

  if (!title) return <div className="lib" />;

  const movies = title.files.filter((f) => f.role === "movie");
  const extras = title.files.filter((f) => f.role === "extra");

  return (
    <div className="lib">
      <header className="lib__header">
        <button onClick={onBack}>← Back</button>
        <h1>
          {title.name} {title.year != null && <span className="muted">({title.year})</span>}
        </h1>
      </header>
      <p className="muted small">{title.folder}</p>

      {title.seasons.map((season) => (
        <section key={season.id}>
          <h2>{season.label}</h2>
          {title.files
            .filter((f) => f.role === "episode" && f.seasonId === season.id)
            .map((f) => {
              const code = episodeCode(f, season.number);
              return (
                <button
                  key={f.id}
                  className="lib__row"
                  onClick={() => onPlay({ path: f.path, label: [title.name, code, f.name].filter(Boolean).join(" · ") })}
                >
                  <span className="lib__code">{code}</span>
                  <span>{f.name ?? fileName(f.path)}</span>
                </button>
              );
            })}
        </section>
      ))}

      {movies.length > 0 && (
        <section>
          <h2>{title.isMovie ? "Movie" : "Movies & Specials"}</h2>
          {movies.map((f) => (
            <button
              key={f.id}
              className="lib__row"
              onClick={() => onPlay({ path: f.path, label: f.name ?? title.name })}
            >
              <span>{f.name ?? fileName(f.path)}</span>
              {f.year != null && <span className="muted"> ({f.year})</span>}
            </button>
          ))}
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
              <button
                key={f.id}
                className="lib__row"
                onClick={() => onPlay({ path: f.path, label: f.name ?? fileName(f.path) })}
              >
                <span>{f.name ?? fileName(f.path)}</span>
              </button>
            ))}
        </section>
      )}
    </div>
  );
}

function fileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}
