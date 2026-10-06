// The library: navigation, home screen, cover grids, show pages and settings.
// How it looks is entirely up to the theme (src/theme); this file only lays out the pieces.
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { RefreshIcon, SettingsIcon } from "../ui/icons";

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

  const sorted = useMemo(
    () => (titles ?? []).slice().sort((a, b) => sortName(a.name).localeCompare(sortName(b.name))),
    [titles],
  );
  const kinds = KINDS.filter((k) => sorted.some((t) => t.kind === k));

  const status =
    scanning != null
      ? `Scanning${scanning ? ` ${scanning}` : ""}…`
      : fetching?.running
        ? `Getting info from ${fetching.source ?? "online"} · ${fetching.done + 1} of ${fetching.total}`
        : null;

  const goTo = (next: Tab) => {
    setOpenTitle(null);
    setTab(next);
  };

  return (
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
              className={`nav__tab ${tab === t && openTitle == null ? "is-active" : ""}`}
              onClick={() => goTo(t)}
            >
              {t === "home" ? "Home" : KIND_LABELS[t]}
            </button>
          ))}
        </div>
        <div className="nav__end">
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
      {error && (
        <button className="toast" onClick={() => setError(null)} title="Dismiss">
          {error}
        </button>
      )}
    </div>
  );
}
