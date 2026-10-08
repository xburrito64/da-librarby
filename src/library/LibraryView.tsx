// The library: navigation, home screen, cover grids, show pages and settings.
// How it looks is entirely up to the theme (src/theme); this file only lays out the pieces.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  library,
  metadata,
  img,
  sortName,
  KIND_LABELS,
  watch,
  type ContinueItem,
  type FinishedSeason,
  type Library,
  type LibraryKind,
  type MetadataStatus,
  type TitleDetail,
  type TitleSummary,
} from "./api";
import Browse from "./Browse";
import { ShuffleContext } from "./shuffle";
import TitlePage from "./TitlePage";
import Settings, { type SettingsSection } from "./Settings";
import Typed from "../ui/Typed";
import { CloseIcon, RefreshIcon, SearchIcon, SettingsIcon } from "../ui/icons";
import { ContextMenuProvider } from "../ui/ContextMenu";
import { useThemeInfo } from "../theme/theme";
import { useThemeOptions } from "../theme/options";
import { useCopy } from "../theme/copy";
import { playSound } from "../theme/sound";
import { COVER, canTransition, ready, transition } from "../ui/transition";
import { arrowMove, choose, usingKeyboard } from "../ui/keyboardNav";

export type Tab = "home" | LibraryKind | "stats";

const KINDS: LibraryKind[] = ["anime", "shows", "movies"];

/** `active` is false while the player is showing on top. */
export default function LibraryView({
  active,
  onPlay,
  onShuffle,
}: {
  active: boolean;
  /** Plays a file, from where it was stopped or from `at` seconds. */
  onPlay: (fileId: number, at?: number) => void;
  /** Plays a show's episodes in a random order. */
  onShuffle: (titleId: number) => void;
}) {
  const [libraries, setLibraries] = useState<Library[] | null>(null);
  const [titles, setTitles] = useState<TitleSummary[] | null>(null);
  const [continueList, setContinueList] = useState<ContinueItem[]>([]);
  const [scanning, setScanning] = useState<string | null>(null);
  const [fetching, setFetching] = useState<MetadataStatus | null>(null);
  const [tab, setTab] = useState<Tab>("home");
  const [openTitle, setOpenTitle] = useState<number | null>(null);
  /** The show page's details, loaded before it opens so its first picture is complete. */
  const [openDetail, setOpenDetail] = useState<TitleDetail | null>(null);
  /** The cover it was opened from, to glide back to. */
  const openedFrom = useRef<HTMLElement | null>(null);
  const [settings, setSettings] = useState<SettingsSection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const copy = useCopy();
  const Decor = useThemeInfo()?.extras?.Decor;
  const brandClick = useThemeInfo()?.extras?.brandClick;
  const themeOptions = useThemeOptions();
  /** A message from the theme in a text box at the bottom (e.g. clicking the app's name). */
  const [said, setSaid] = useState<{ text: string; n: number; save?: boolean } | null>(null);
  const brandClicks = useRef(0);
  /** A season finished while watching: celebrated once the library is back on screen. */
  const [finished, setFinished] = useState<FinishedSeason | null>(null);

  useEffect(() => {
    const off = library.onFinished((f) => setFinished((prev) => (prev?.showDone && prev.titleId === f.titleId ? prev : f)));
    return () => void off.then((f) => f());
  }, []);

  useEffect(() => {
    if (!active || !finished) return;
    // A moment after the library appears (and after the player has let the sounds back on).
    const timer = window.setTimeout(() => {
      const text = finished.showDone ? copy.showDone(finished.titleName) : copy.seasonDone(finished.titleName, finished.season);
      setSaid({ text, n: Date.now(), save: true });
      playSound("save");
      setFinished(null);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [active, finished, copy]);

  useEffect(() => {
    if (!said) return;
    const timer = window.setTimeout(() => setSaid(null), said.save ? 8000 : 6000);
    return () => window.clearTimeout(timer);
  }, [said]);

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

  // A show page opens out of the cover that was clicked (if any), and goes back into it.
  const open = useCallback((id: number, from?: HTMLElement | null) => {
    library
      .title(id)
      .catch(() => null)
      .then(async (detail) => {
        await ready(img(detail?.meta?.cover));
        openedFrom.current = from ?? null;
        const byKeyboard = usingKeyboard();
        await transition(
          () => {
            setOpenDetail(detail);
            setOpenTitle(id);
          },
          from ? { name: COVER, from, to: () => document.querySelector<HTMLElement>(".tp__cover") } : undefined,
        );
        // Opened with Enter: on to its Play button, so another Enter plays.
        if (byKeyboard) choose(document.querySelector<HTMLElement>(".tp .tp__actions .btn"));
      });
  }, []);

  const close = useCallback(() => {
    const card = openedFrom.current;
    const rect = card?.isConnected ? card.getBoundingClientRect() : null;
    const visible = rect != null && rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    // Browsing with the keyboard carries on from the cover the page was opened from.
    const byKeyboard = usingKeyboard();
    transition(() => setOpenTitle(null), {
      name: COVER,
      from: document.querySelector<HTMLElement>(".tp__cover"),
      to: visible ? () => card : undefined,
    }).then(() => {
      if (byKeyboard && card?.isConnected) choose(card.closest<HTMLElement>(".card"));
    });
  }, []);

  // Esc or the mouse's back button leaves a show page (unless a dialog is open; Esc closes that first).
  useEffect(() => {
    if (!active || openTitle == null || settings) return;
    const back = () => !document.querySelector(".modal") && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && back();
    const onMouse = (e: MouseEvent) => e.button === 3 && back();
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mouseup", onMouse);
    };
  }, [active, openTitle, settings, close]);

  // Coming back to the app (after a download, say) looks for new files.
  useEffect(() => {
    const onFocus = () => library.focused().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // The arrow keys move between covers, buttons and episodes; Enter opens or plays.
  useEffect(() => {
    if (!active || settings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select") || document.querySelector(".modal, .ctx-menu")) return;
      if (arrowMove(e)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, settings]);

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
    <ShuffleContext.Provider value={onShuffle}>
    <div className={`app ${scrolled ? "app--scrolled" : ""} ${openTitle != null ? "app--title" : ""}`}>
      {Decor && <Decor active={active} options={themeOptions} />}
      <nav className="nav">
        <button
          className="nav__brand"
          onClick={() => {
            const atHome = tab === "home" && openTitle == null && !query.trim();
            const line = brandClick?.({ sound: playSound });
            if (line) setSaid({ text: line, n: Date.now() });
            else if (atHome && copy.brandLines.length > 0) {
              const n = brandClicks.current++;
              setSaid({ text: copy.brandLines[n % copy.brandLines.length], n });
            }
            goTo("home");
          }}
        >
          <span className="nav__logo" aria-hidden="true" />
          <span className="nav__name">Da Librarby</span>
          <span className="nav__decor" aria-hidden="true" />
        </button>
        <div className="nav__tabs">
          {(["home", ...kinds, "stats"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`nav__tab ${tab === t && openTitle == null && !query.trim() ? "is-active" : ""}`}
              onClick={() => goTo(t)}
            >
              {t === "home" ? "Home" : t === "stats" ? copy.statsTab : KIND_LABELS[t]}
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
        onOpen={open}
        onPlay={onPlay}
        onScrolled={setScrolled}
        onAddFolder={() => setSettings("library")}
      />
      {openTitle != null && (
        <TitlePage
          key={openTitle}
          id={openTitle}
          initial={openDetail?.id === openTitle ? openDetail : null}
          still={canTransition()}
          onBack={close}
          onPlay={onPlay}
          onOpen={open}
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
      {said && (
        <button key={said.n} className={`say ${said.save ? "say--save" : ""}`} onClick={() => setSaid(null)} data-sfx="none">
          <Typed as="span" className="say__text" text={said.text} />
        </button>
      )}
      {error && (
        <button className="toast" onClick={() => setError(null)} title="Dismiss">
          {error}
        </button>
      )}
    </div>
    </ShuffleContext.Provider>
    </ContextMenuProvider>
  );
}
