// The library: navigation, home screen, cover grids, show pages and settings.
// How it looks is entirely up to the theme (src/theme); this file only lays out the pieces.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  library,
  metadata,
  sortName,
  KIND_LABELS,
  watch,
  type ContinueItem,
  type Library,
  type LibraryKind,
  type MetadataStatus,
  type TitleSummary,
} from "./api";
import Browse from "./Browse";
import TitlePage from "./TitlePage";
import Settings, { type SettingsSection } from "./Settings";
import { CloseIcon, RefreshIcon, SearchIcon, SettingsIcon } from "../ui/icons";
import { ContextMenuProvider } from "../ui/ContextMenu";
import { useThemeInfo } from "../theme/theme";
import { useThemeOptions } from "../theme/options";
import { useCopy } from "../theme/copy";

export type Tab = "home" | LibraryKind;

const KINDS: LibraryKind[] = ["anime", "shows", "movies"];

/** `active` is false while the player is showing on top. */
export default function LibraryView({ active, onPlay }: { active: boolean; onPlay: (fileId: number) => void }) {
  const [libraries, setLibraries] = useState<Library[] | null>(null);
  const [titles, setTitles] = useState<TitleSummary[] | null>(null);
  const [continueList, setContinueList] = useState<ContinueItem[]>([]);
  const [scanning, setScanning] = useState<string | null>(null);
  const [fetching, setFetching] = useState<MetadataStatus | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [openTitle, setOpenTitle] = useState<number | null>(null);
  const [settings, setSettings] = useState<SettingsSection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const copy = useCopy();
  const Decor = useThemeInfo()?.extras?.Decor;
  const themeOptions = useThemeOptions();

  const refresh = useCallback(() => {
    library.list().then(setLibraries).catch((e) => setError(String(e)));
    library.titles().then(setTitles).catch((e) => setError(String(e)));
    watch.continueList().then(setContinueList).catch(() => {});
  }, []);

  // Back from the player: progress and "continue watching" have changed.
  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  useEffect(() => {
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

  // Esc or the mouse's back button leaves a show page (unless a dialog is open; Esc closes that first).
  useEffect(() => {
    if (!active || openTitle == null || settings) return;
    const back = () => !document.querySelector(".modal") && setOpenTitle(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && back();
    const onMouse = (e: MouseEvent) => e.button === 3 && back();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mouseup", onMouse);
    };
  }, [active, openTitle, settings]);

  // Coming back to the app (after a download, say) looks for new files.
  useEffect(() => {
    const onFocus = () => library.focused().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Typing anywhere starts a search.
  useEffect(() => {
    if (!active || settings) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1 || e.key === " ") return;
      if (target.closest("input, textarea, select") || document.querySelector(".modal, .ctx-menu")) return;
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, settings]);

  const search = (text: string) => {
    setQuery(text);
    if (text.trim()) setOpenTitle(null);
  };

  const sorted = useMemo(
    () => (titles ?? []).slice().sort((a, b) => sortName(a.name).localeCompare(sortName(b.name))),
    [titles],
  );
  const kinds = KINDS.filter((k) => sorted.some((t) => t.kind === k));

  const status =
    scanning != null
      ? copy.scanning(scanning)
      : fetching?.running
        ? `Getting info from ${fetching.source ?? "online"} · ${fetching.done + 1} of ${fetching.total}`
        : null;

  const goTo = (next: Tab) => {
    setOpenTitle(null);
    setQuery("");
    setTab(next);
  };

  return (
    <ContextMenuProvider>
    <div className={`app ${scrolled ? "app--scrolled" : ""} ${openTitle != null ? "app--title" : ""}`}>
      <nav className="nav">
        <button className="nav__brand" onClick={() => goTo("home")}>
          <span className="nav__logo" aria-hidden="true" />
          <span className="nav__name">Da Librarby</span>
        </button>
        <div className="nav__tabs">
          {(["home", ...kinds] as Tab[]).map((t) => (
            <button
              key={t}
              className={`nav__tab ${tab === t && openTitle == null && !query.trim() ? "is-active" : ""}`}
              onClick={() => goTo(t)}
            >
              {t === "home" ? "Home" : KIND_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="nav__end">
          <label className={`nav__search ${query ? "has-text" : ""}`}>
            <SearchIcon />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => search(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setQuery("");
                  e.currentTarget.blur();
                }
              }}
              placeholder={copy.searchPlaceholder}
              spellCheck={false}
              aria-label="Search the library"
            />
            {query && (
              <button className="nav__search-clear" onClick={() => setQuery("")} title="Clear search" data-sfx="back">
                <CloseIcon />
              </button>
            )}
          </label>
          {status && (
            <span className="nav__status" title={fetching?.running ? (fetching.current ?? status) : status}>
              <span className="nav__pulse" />
              <span className="nav__status-text">{status}</span>
            </span>
          )}
          <button className="icon-btn" title="Look for new files" onClick={() => library.rescan()}>
            <RefreshIcon />
          </button>
          <button className="icon-btn" title="Settings" onClick={() => setSettings("appearance")}>
            <SettingsIcon />
          </button>
        </div>
      </nav>

      <Browse
        tab={tab}
        titles={sorted}
        offline={(libraries ?? []).filter((l) => !l.online)}
        query={query.trim()}
        continueList={continueList}
        loaded={titles != null && libraries != null}
        hasLibraries={(libraries?.length ?? 0) > 0}
        active={openTitle == null}
        onTab={goTo}
        onOpen={setOpenTitle}
        onPlay={onPlay}
        onScrolled={setScrolled}
        onAddFolder={() => setSettings("library")}
      />
      {openTitle != null && (
        <TitlePage
          key={openTitle}
          id={openTitle}
          onBack={() => setOpenTitle(null)}
          onPlay={onPlay}
          onScrolled={setScrolled}
        />
      )}

      {settings && (
        <Settings
          section={settings}
          onSection={setSettings}
          libraries={libraries ?? []}
          titles={sorted}
          onLibraries={setLibraries}
          onError={setError}
          onClose={() => setSettings(null)}
        />
      )}
      {Decor && <Decor active={active} options={themeOptions} />}
      {error && (
        <button className="toast" onClick={() => setError(null)} title="Dismiss">
          {error}
        </button>
      )}
    </div>
    </ContextMenuProvider>
  );
}
