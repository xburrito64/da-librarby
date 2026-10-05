// Settings: theme, library folders, online info (TMDB key).
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { library, metadata, guessKind, img, KIND_LABELS, type Library, type LibraryKind, type TitleSummary } from "./api";
import { THEMES } from "../theme/themes";
import { setTheme, useTheme } from "../theme/theme";
import { CheckIcon, CloseIcon } from "../ui/icons";

export type SettingsSection = "appearance" | "library" | "online";

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "appearance", label: "Appearance" },
  { id: "library", label: "Library folders" },
  { id: "online", label: "Online info" },
];

interface Props {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  libraries: Library[];
  titles: TitleSummary[];
  onLibraries: (libraries: Library[]) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

export default function Settings({ section, onSection, libraries, titles, onLibraries, onError, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__panel settings" role="dialog" aria-label="Settings">
        <aside className="settings__side">
          <h2 className="settings__heading">Settings</h2>
          {SECTIONS.map((s) => (
            <button key={s.id} className={`settings__nav ${section === s.id ? "is-active" : ""}`} onClick={() => onSection(s.id)}>
              {s.label}
            </button>
          ))}
        </aside>
        <div className="settings__main">
          <button className="icon-btn settings__close" onClick={onClose} title="Close (Esc)">
            <CloseIcon />
          </button>
          {section === "appearance" && <Appearance titles={titles} />}
          {section === "library" && <Folders libraries={libraries} onChange={onLibraries} onError={onError} />}
          {section === "online" && <Online onError={onError} />}
        </div>
      </div>
    </div>
  );
}

function Appearance({ titles }: { titles: TitleSummary[] }) {
  const current = useTheme();
  // A few real covers for the little previews.
  const [sample] = useState(() => {
    const withCovers = titles.filter((t) => t.thumb);
    const withBanner = withCovers.find((t) => t.banner) ?? withCovers[0];
    return { name: withBanner?.name ?? "Da Librarby", banner: withBanner?.banner ?? null, covers: withCovers.slice(0, 4).map((t) => t.thumb) };
  });

  return (
    <section>
      <h3 className="settings__title">Theme</h3>
      <p className="settings__text">Changes the whole look of the app right away. More themes can be added later.</p>
      <div className="themes">
        {THEMES.map((t) => (
          <button key={t.id} className={`theme-card ${current === t.id ? "is-active" : ""}`} onClick={() => setTheme(t.id)}>
            <span className="theme-card__preview" data-theme={t.id}>
              <span className="tprev">
                <span className="tprev__bar">
                  <span className="tprev__brand">Da Librarby</span>
                  <span className="tprev__tabs">
                    <span className="tprev__tab is-active" />
                    <span className="tprev__tab" />
                    <span className="tprev__tab" />
                  </span>
                </span>
                <span className="tprev__hero">
                  {sample.banner && <img src={img(sample.banner)} alt="" />}
                  <span className="tprev__title">{sample.name}</span>
                  <span className="tprev__btn">Play</span>
                </span>
                <span className="tprev__row">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="tprev__cover">
                      {sample.covers[i] && <img src={img(sample.covers[i])} alt="" />}
                    </span>
                  ))}
                </span>
              </span>
            </span>
            <span className="theme-card__text">
              <span className="theme-card__name">
                {t.name}
                {current === t.id && <CheckIcon />}
              </span>
              <span className="theme-card__desc">{t.description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Online({ onError }: { onError: (message: string) => void }) {
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
    <section>
      <h3 className="settings__title">Online info</h3>
      <p className="settings__text">
        Covers, descriptions and episode names come from AniList (anime, no key needed) and TMDB (shows and movies). TMDB needs a
        free API key, which is stored only on this computer.
      </p>
      <div className="field-row">
        <span className="field-row__label">{saved ? `TMDB key saved (${saved})` : "No TMDB key saved"}</span>
        {saved && (
          <button className="btn btn--small" onClick={() => save(null)}>
            Remove
          </button>
        )}
      </div>
      <form
        className="field-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim()) save(key);
        }}
      >
        <input
          className="input"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={saved ? "Paste a new key to replace it" : "Paste your TMDB API key"}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="btn btn--small btn--primary" type="submit" disabled={!key.trim()}>
          Save
        </button>
      </form>
    </section>
  );
}

function Folders({ libraries, onChange, onError }: { libraries: Library[]; onChange: (l: Library[]) => void; onError: (m: string) => void }) {
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
    <section>
      <h3 className="settings__title">Library folders</h3>
      <p className="settings__text">
        The folders (or whole drives) where your anime, shows and movies live. Folders named Anime, Cartoons, Shows or Movies inside
        them are sorted automatically.
      </p>
      {libraries.map((lib) => (
        <div key={lib.id} className="folder">
          <span className="folder__path">{lib.path}</span>
          <span className="folder__info">
            {KIND_LABELS[lib.kind]} · {lib.titleCount} title{lib.titleCount === 1 ? "" : "s"}
            {lib.online ? "" : " · offline"}
          </span>
          <button className="btn btn--small" onClick={() => library.remove(lib.id).then(onChange).catch((e) => onError(String(e)))}>
            Remove
          </button>
        </div>
      ))}
      {pending ? (
        <div className="folder folder--new">
          <span className="folder__path">{pending.path}</span>
          <select className="input" value={pending.kind} onChange={(e) => setPending({ ...pending, kind: e.target.value as LibraryKind })}>
            <option value="anime">Anime</option>
            <option value="shows">Shows</option>
            <option value="movies">Movies</option>
          </select>
          <button className="btn btn--small btn--primary" onClick={add}>
            Add
          </button>
          <button className="btn btn--small" onClick={() => setPending(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="field-row">
          <button className="btn btn--small btn--primary" onClick={pick}>
            Add folder…
          </button>
          <button className="btn btn--small" onClick={() => library.rescan()}>
            Look for new files
          </button>
        </div>
      )}
    </section>
  );
}
