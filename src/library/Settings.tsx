// Settings: theme, library folders, online info (TMDB key).
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as autostartEnabled } from "@tauri-apps/plugin-autostart";
import { library, metadata, guessKind, img, KIND_LABELS, type Library, type LibraryKind, type TitleSummary } from "./api";
import { THEMES } from "../theme/themes";
import { setTheme, useTheme } from "../theme/theme";
import { CheckIcon, CloseIcon } from "../ui/icons";

export type SettingsSection = "appearance" | "general" | "library" | "online" | "shortcuts" | "about";

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "appearance", label: "Appearance" },
  { id: "general", label: "General" },
  { id: "library", label: "Library folders" },
  { id: "online", label: "Online info" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about", label: "About" },
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
          {section === "general" && <General onError={onError} />}
          {section === "library" && <Folders libraries={libraries} onChange={onLibraries} onError={onError} />}
          {section === "online" && <Online onError={onError} />}
          {section === "shortcuts" && <Shortcuts />}
          {section === "about" && <About />}
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

function General({ onError }: { onError: (message: string) => void }) {
  const [autostart, setAutostart] = useState<boolean | null>(null);

  useEffect(() => {
    autostartEnabled().then(setAutostart).catch(() => setAutostart(false));
  }, []);

  const toggle = () => {
    const next = !autostart;
    (next ? enableAutostart() : disableAutostart())
      .then(() => setAutostart(next))
      .catch((e) => onError(String(e)));
  };

  return (
    <section>
      <h3 className="settings__title">General</h3>
      <p className="settings__text">How the app starts and keeps itself up to date.</p>
      <button className="toggle-row" onClick={toggle} disabled={autostart == null} role="switch" aria-checked={!!autostart}>
        <span className="toggle-row__text">
          <span className="toggle-row__label">Start with Windows</span>
          <span className="toggle-row__hint">Opens minimized when you sign in, so your library is ready when you are.</span>
        </span>
        <span className={`toggle ${autostart ? "is-on" : ""}`} />
      </button>
      <div className="toggle-row toggle-row--info">
        <span className="toggle-row__text">
          <span className="toggle-row__label">Finds new files by itself</span>
          <span className="toggle-row__hint">
            Whenever you switch to the app it looks for new, renamed or deleted videos, and drives are noticed within seconds of
            being plugged in or removed. It never keeps a drive busy, so safely removing one still works.
          </span>
        </span>
      </div>
    </section>
  );
}

const SHORTCUTS: { group: string; keys: [string, string][] }[] = [
  {
    group: "While watching",
    keys: [
      ["Space / K", "Pause / play"],
      ["← / →", "Back / forward 5 seconds (with Shift: 30)"],
      ["J / L", "Back / forward 10 seconds"],
      ["↑ / ↓", "Volume up / down"],
      ["M", "Mute"],
      ["N", "Next episode"],
      ["S", "Screenshot (saved to Pictures › Da Librarby)"],
      ["F", "Fullscreen"],
      ["P", "Mini player: a small video on top of other windows"],
      ["Esc", "Leave fullscreen or the mini player, then back to the library"],
      ["Click / double-click", "Pause / fullscreen (in the mini player: back to big)"],
      ["Drag the mini player", "Move it; drag its edges to resize"],
      ["Mouse wheel", "Volume"],
    ],
  },
  {
    group: "In the library",
    keys: [
      ["Just start typing", "Search shows and episodes"],
      ["Right-click", "More options for a show, episode or card"],
      ["Esc", "Back from a show page, or clear the search"],
      ["Mouse back button", "Back from a show page or the player"],
    ],
  },
];

function Shortcuts() {
  return (
    <section>
      <h3 className="settings__title">Shortcuts</h3>
      <p className="settings__text">Keys and mouse moves that work around the app.</p>
      {SHORTCUTS.map((g) => (
        <div key={g.group} className="shortcuts">
          <h4 className="shortcuts__group">{g.group}</h4>
          {g.keys.map(([keys, what]) => (
            <div key={keys} className="shortcuts__row">
              <span className="shortcuts__keys">
                {keys.split(" / ").map((k, i) => (
                  <span key={i}>
                    {i > 0 && <span className="shortcuts__or">/</span>}
                    <kbd>{k}</kbd>
                  </span>
                ))}
              </span>
              <span className="shortcuts__what">{what}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function About() {
  const [version, setVersion] = useState("");
  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);
  return (
    <section>
      <h3 className="settings__title">Da Librarby {version && <span className="about__version">{version}</span>}</h3>
      <p className="settings__text">A personal library and player for your anime, shows and movies.</p>
      <div className="about">
        <p>
          <strong>Show and episode info</strong> comes from AniList (anime) and TMDB (shows, movies and anime episodes). This product
          uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
        <p>
          <strong>One Pace</strong> titles and descriptions come from the One Pace team's episode guide, gathered by the
          one-pace-metadata project.
        </p>
        <p>
          <strong>Da Librarby</strong> is free software under the GNU General Public License, version 3 or later. Its source code
          is on GitHub at xburrito64/da-librarby.
        </p>
        <p>
          <strong>Playback</strong> is done by mpv (GPL), whose source code is at github.com/mpv-player/mpv. Fonts: Manrope, Fraunces, Inter, Chakra Petch, JetBrains Mono, Fredoka and
          Nunito.
        </p>
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
