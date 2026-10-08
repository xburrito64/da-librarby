// Settings: theme, library folders, online info (TMDB key).
import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { disable as disableAutostart, enable as enableAutostart, isEnabled as autostartEnabled } from "@tauri-apps/plugin-autostart";
import { library, metadata, guessKind, img, updates, KIND_LABELS, type Library, type LibraryKind, type TitleSummary, type Update } from "./api";
import { getSetting, setSetting } from "../ui/settings";
import { UPDATES_SETTING } from "../ui/UpdateNote";
import { scaleSettings, setScale } from "../ui/scale";
import { THEMES, type ThemeOption } from "../theme/themes";
import { setTheme, useTheme, useThemeInfo } from "../theme/theme";
import { setThemeOption, useThemeOptions } from "../theme/options";
import { loadOwnFiles, musicFiles, openOwnFolder, useOwnFiles } from "../theme/ownFiles";
import { CheckIcon, CloseIcon, FolderIcon, RefreshIcon } from "../ui/icons";

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
          <button className="icon-btn settings__close" onClick={onClose} title="Close (Esc)" data-sfx="back">
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

/** How big everything is: grows with the window by itself, times the size picked here. */
function InterfaceSize() {
  const [{ percent, auto }, setState] = useState(scaleSettings);
  const change = (next: { percent?: number; auto?: boolean }) => {
    setScale(next);
    setState(scaleSettings());
  };
  return (
    <>
      <h3 className="settings__title">Interface size</h3>
      <p className="settings__text">Makes everything bigger or smaller: text, covers, buttons and pictures.</p>
      <div className="size-row">
        <input
          className="size-row__slider"
          type="range"
          min={70}
          max={160}
          step={5}
          value={percent}
          onChange={(e) => change({ percent: Number(e.target.value) })}
          aria-label="Interface size"
        />
        <span className="size-row__value">{percent}%</span>
        {percent !== 100 && (
          <button className="btn btn--small" onClick={() => change({ percent: 100 })}>
            Reset
          </button>
        )}
      </div>
      <button className="toggle-row" role="switch" aria-checked={auto} onClick={() => change({ auto: !auto })}>
        <span className="toggle-row__text">
          <span className="toggle-row__label">Grow with the window</span>
          <span className="toggle-row__hint">In a big window (or full screen on a large monitor), everything gets bigger too.</span>
        </span>
        <span className={`toggle ${auto ? "is-on" : ""}`} />
      </button>
    </>
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
      <InterfaceSize />
      <h3 className="settings__title">Theme</h3>
      <p className="settings__text">Changes the whole look of the app right away. More themes can be added later.</p>
      <div className="themes">
        {THEMES.map((t) => (
          <button key={t.id} className={`theme-card ${current === t.id ? "is-active" : ""}`} onClick={() => setTheme(t.id)}>
            <span className="theme-card__preview" data-theme={t.id}>
              <span className="tprev">
                <span className="tprev__decor" aria-hidden="true" />
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
      <ThemeOptions />
      <OwnFiles />
    </section>
  );
}

/** The current theme's own settings, if it has any. */
function ThemeOptions() {
  const theme = useThemeInfo();
  const values = useThemeOptions();
  const options = theme?.extras?.options ?? [];
  if (!theme || options.length === 0) return null;
  return (
    <div className="theme-options">
      <h3 className="settings__title">{theme.name} options</h3>
      {options.map((o) =>
        o.kind === "color" ? (
          <ColorOption key={o.id} option={o} value={String(values[o.id] ?? o.default)} onChange={(v) => setThemeOption(theme.id, o.id, v)} />
        ) : o.choices ? (
          <div key={o.id} className="toggle-row choice-row">
            <span className="toggle-row__text">
              <span className="toggle-row__label">{o.label}</span>
              {o.hint && <span className="toggle-row__hint">{o.hint}</span>}
            </span>
            <span className="choice-row__choices" role="radiogroup" aria-label={o.label}>
              {o.choices.map((c) => (
                <button
                  key={c.value}
                  role="radio"
                  aria-checked={values[o.id] === c.value}
                  className={`choice ${values[o.id] === c.value ? "is-on" : ""}`}
                  onClick={() => setThemeOption(theme.id, o.id, c.value)}
                >
                  {c.label}
                </button>
              ))}
            </span>
          </div>
        ) : (
          <button
            key={o.id}
            className="toggle-row"
            role="switch"
            aria-checked={values[o.id] !== false}
            onClick={() => setThemeOption(theme.id, o.id, values[o.id] === false)}
          >
            <span className="toggle-row__text">
              <span className="toggle-row__label">{o.label}</span>
              {o.hint && <span className="toggle-row__hint">{o.hint}</span>}
            </span>
            <span className={`toggle ${values[o.id] !== false ? "is-on" : ""}`} />
          </button>
        ),
      )}
    </div>
  );
}

/** A colour: the theme's presets as swatches, and one more for any colour at all. */
function ColorOption({ option, value, onChange }: { option: ThemeOption; value: string; onChange: (value: string) => void }) {
  const presets = option.choices ?? [];
  const preset = presets.find((c) => c.value.toLowerCase() === value.toLowerCase());
  return (
    <div className="toggle-row choice-row">
      <span className="toggle-row__text">
        <span className="toggle-row__label">{option.label}</span>
        <span className="toggle-row__hint">{preset ? preset.label : `Your own colour (${value.toUpperCase()})`}</span>
      </span>
      <span className="swatches" role="radiogroup" aria-label={option.label}>
        {presets.map((c) => (
          <button
            key={c.value}
            role="radio"
            aria-checked={c === preset}
            aria-label={c.label}
            title={c.label}
            className={`swatch ${c === preset ? "is-on" : ""}`}
            style={{ "--swatch": c.value } as React.CSSProperties}
            onClick={() => onChange(c.value)}
          >
            <span className="swatch__color" />
          </button>
        ))}
        <label className={`swatch swatch--custom ${preset ? "" : "is-on"}`} title="Pick any colour" style={{ "--swatch": value } as React.CSSProperties}>
          <span className="swatch__color" />
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Pick any colour" />
        </label>
      </span>
    </div>
  );
}

/** The current theme's own-files folder: which of the files it looks for are there. */
function OwnFiles() {
  const theme = useThemeInfo();
  const own = useOwnFiles();
  const wanted = theme?.extras?.ownFiles;
  if (!theme || !wanted) return null;
  const rows = [
    ...(wanted.font ? [{ name: "font", label: "Font" }] : []),
    ...(wanted.sounds ?? []),
    ...(wanted.music ? [{ name: "music", label: "Background music", optional: true }] : []),
  ];
  const found = (name: string) => own?.files.find((f) => f.name === name);
  return (
    <div className="own-files">
      <h3 className="settings__title">Your own files</h3>
      <p className="settings__text">
        Want a different font or sounds in {theme.name}
        {wanted.music ? ", or music in the background" : ""}? Put the files in its folder, named as below (a font as .ttf,
        .otf or .woff2; sounds{wanted.music ? " and music" : ""} as .ogg, .mp3 or .wav), then press Reload. They're used
        instead of the built-in ones and stay on this PC only.
        {wanted.music && " Several music files (music-1.ogg, music-2.ogg, ...) take turns."}
      </p>
      <div className="own-files__list">
        {rows.map((r) => {
          const tracks = r.name === "music" && own ? musicFiles(own) : [];
          const file = tracks[0] ?? found(r.name);
          const names = (tracks.length > 0 ? tracks : file ? [file] : []).map((f) => f.path.split(/[\\/]/).pop());
          return (
            <div key={r.name} className="own-files__row">
              <span className="own-files__label">{r.label}</span>
              <span className="own-files__name" title={names.join("\n")}>
                {names.length > 1 ? `${names.length} tracks: ${names.join(", ")}` : (names[0] ?? `${r.name}.…`)}
              </span>
              <span className={`own-files__state ${file ? "is-found" : ""}`}>
                {file ? "In use" : "optional" in r ? "Not added" : "Built-in"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="field-row">
        <button className="btn btn--small" onClick={() => openOwnFolder(theme.id)}>
          <FolderIcon />
          Open folder
        </button>
        <button className="btn btn--small" onClick={() => loadOwnFiles(theme.id)}>
          <RefreshIcon />
          Reload
        </button>
      </div>
    </div>
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
      [", / .", "One frame back / forward (pauses)"],
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
      ["Arrow keys", "Move between covers, buttons and episodes"],
      ["Enter", "Open or play what's chosen"],
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
  const [auto, setAuto] = useState(true);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ text: string; update?: Update } | null>(null);
  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
    getSetting<boolean>(UPDATES_SETTING).then((v) => setAuto(v !== false));
  }, []);
  const check = () => {
    setChecking(true);
    updates
      .check()
      .then((u) => setResult(u ? { text: `Version ${u.version} is out.`, update: u } : { text: "This is the newest version." }))
      .catch((e) => setResult({ text: String(e) }))
      .finally(() => setChecking(false));
  };
  return (
    <section>
      <h3 className="settings__title">Da Librarby {version && <span className="about__version">{version}</span>}</h3>
      <p className="settings__text">A personal library and player for your anime, shows and movies.</p>
      <div className="update-check">
        <button className="btn btn--small" onClick={check} disabled={checking}>
          <RefreshIcon />
          {checking ? "Looking…" : "Check for updates"}
        </button>
        {result && <span className="update-check__result">{result.text}</span>}
        {result?.update && (
          <button className="btn btn--small btn--primary" onClick={() => openUrl(result.update!.download ?? result.update!.page)}>
            Download
          </button>
        )}
      </div>
      <button
        className="toggle-row"
        role="switch"
        aria-checked={auto}
        onClick={() => {
          setAuto(!auto);
          setSetting(UPDATES_SETTING, !auto);
        }}
      >
        <span className="toggle-row__text">
          <span className="toggle-row__label">Look for updates by itself</span>
          <span className="toggle-row__hint">Asks GitHub now and then whether there's a newer version, and says so in a small note.</span>
        </span>
        <span className={`toggle ${auto ? "is-on" : ""}`} />
      </button>
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
          <strong>Playback</strong> is done by mpv (GPL), whose source code is at github.com/mpv-player/mpv. Fonts: Manrope, Fraunces, Inter, Chakra Petch, JetBrains Mono, Fredoka,
          Nunito and Pixelify Sans.
        </p>
      </div>
    </section>
  );
}

const TMDB_SIGNUP = "https://www.themoviedb.org/signup";
const TMDB_API = "https://www.themoviedb.org/settings/api";

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
      {!saved && (
        <ol className="key-steps">
          <li>
            <span>
              Make a free TMDB account (and confirm it from the email TMDB sends).
            </span>
            <button className="btn btn--small" onClick={() => openUrl(TMDB_SIGNUP)}>
              Open TMDB sign-up
            </button>
          </li>
          <li>
            <span>
              Signed in, open the API page and create a key: choose <em>Developer</em>, accept the terms, and describe the use as
              "Personal media library" (any website, like github.com, is fine).
            </span>
            <button className="btn btn--small" onClick={() => openUrl(TMDB_API)}>
              Open the API page
            </button>
          </li>
          <li>
            <span>
              Copy the <em>API Read Access Token</em> (the long one) or the <em>API Key</em>, paste it here and press Save. The
              covers and descriptions start coming in right away.
            </span>
          </li>
        </ol>
      )}
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
