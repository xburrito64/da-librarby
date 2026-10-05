// Temporary, plain library screen. Replaced by the real cover grid and show pages in step 4.
import { useCallback, useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  library,
  metadata,
  guessKind,
  img,
  sortName,
  type Library,
  type LibraryKind,
  type MetadataStatus,
  type TitleSummary,
} from "./api";
import TitlePage from "./TitlePage";
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
  const [fetching, setFetching] = useState<MetadataStatus | null>(null);
  const [panel, setPanel] = useState<"folders" | "settings" | null>(null);
  const [openTitle, setOpenTitle] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    library.list().then(setLibraries).catch((e) => setError(String(e)));
    library.titles().then(setTitles).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    refresh();
    library.scanning().then((running) => running && setScanning(""));
    metadata.status().then(setFetching);
    const offs = [
      library.onChanged(refresh),
      library.onScan((s) => {
        setScanning(s.running ? (s.library ?? "") : null);
        if (!s.running) refresh();
      }),
      metadata.onStatus(setFetching),
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
  const status =
    scanning != null
      ? `Scanning${scanning ? ` ${scanning}` : ""}…`
      : fetching?.running
        ? `Getting info from AniList: ${fetching.current ?? ""} (${fetching.done + 1}/${fetching.total})`
        : (fetching?.error ?? "");

  return (
    <div className="lib">
      <header className="lib__header">
        <h1>Da Librarby</h1>
        <span className="lib__status">{status}</span>
        <button onClick={() => library.rescan()}>Rescan</button>
        <button onClick={() => setPanel((p) => (p === "folders" ? null : "folders"))}>Folders</button>
        <button onClick={() => setPanel((p) => (p === "settings" ? null : "settings"))}>Settings</button>
      </header>

      {error && <p className="lib__error" onClick={() => setError(null)}>{error}</p>}

      {(panel === "folders" || noLibraries) && libraries && (
        <Folders libraries={libraries} onChange={setLibraries} onError={setError} />
      )}
      {panel === "settings" && <Settings onError={setError} />}

      {groups.map((group) => (
        <section key={group.kind}>
          <h2>
            {KIND_LABELS[group.kind]} <span className="muted">{group.titles.length}</span>
          </h2>
          <div className="lib__titles">
            {group.titles.map((t) => (
              <button
                key={t.id}
                className={`lib__card ${t.online ? "" : "lib__card--offline"}`}
                onClick={() => setOpenTitle(t.id)}
              >
                <div className="lib__poster" style={{ background: t.color ?? undefined }}>
                  {t.thumb && <img src={img(t.thumb)} alt="" loading="lazy" decoding="async" />}
                </div>
                <strong>{t.name}</strong>
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
  const parts = [];
  if (t.year != null) parts.push(t.year);
  if (t.isMovie) parts.push("Movie");
  else {
    if (t.seasons) parts.push(`${t.seasons} season${t.seasons === 1 ? "" : "s"}`);
    if (t.episodes) parts.push(`${t.episodes} ep`);
    if (t.movies) parts.push(`${t.movies} movie${t.movies === 1 ? "" : "s"}`);
  }
  if (t.kind === "anime" && t.matched === false) parts.push("no match");
  if (!t.online) parts.push("drive offline");
  return parts.join(" · ");
}

function Settings({ onError }: { onError: (message: string) => void }) {
  const [saved, setSaved] = useState<string | null>(null);
  const [key, setKey] = useState("");

  useEffect(() => {
    metadata.tmdbKey().then(setSaved);
  }, []);

  const save = (value: string | null) =>
    metadata
      .setTmdbKey(value)
      .then(() => metadata.tmdbKey())
      .then((k) => {
        setSaved(k);
        setKey("");
      })
      .catch((e) => onError(String(e)));

  return (
    <div className="lib__folders">
      <h2>Settings</h2>
      <p className="muted small">
        TMDB API key (for covers and info of shows and movies). It's stored only on this computer.
      </p>
      <div className="lib__folder">
        <span>{saved ? `Saved key ${saved}` : "No key saved"}</span>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={saved ? "Paste a new key to replace it" : "Paste your TMDB API key"}
          autoComplete="off"
          spellCheck={false}
        />
        <button disabled={!key.trim()} onClick={() => save(key)}>
          Save
        </button>
        {saved && <button onClick={() => save(null)}>Remove</button>}
      </div>
    </div>
  );
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
