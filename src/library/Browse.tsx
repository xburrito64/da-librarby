// Home screen (spotlight, continue watching, one row per kind) and the full cover grid of each kind.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  library,
  img,
  describe,
  itemCode,
  itemName,
  upNext,
  watch,
  reveal,
  revealTitle,
  KIND_LABELS,
  type ContinueItem,
  type FoundFile,
  type Library,
  type LibraryKind,
  type SearchResults,
  type TitleSummary,
} from "./api";
import { useContextMenu } from "../ui/ContextMenu";
import { getSetting, setSetting } from "../ui/settings";
import type { Tab } from "./LibraryView";
import { CheckIcon, ChevronLeft, ChevronRight, CloseIcon, DiceIcon, FolderIcon, InfoIcon, PlayIcon, UndoIcon } from "../ui/icons";
import Typed from "../ui/Typed";
import { useCopy } from "../theme/copy";
import { playSound } from "../theme/sound";

const KINDS: LibraryKind[] = ["anime", "shows", "movies"];
const SPOTLIGHT_SIZE = 6;
const SPOTLIGHT_SECONDS = 9;

interface Props {
  tab: Tab;
  titles: TitleSummary[];
  /** Search text; when set, search results replace the page. */
  query: string;
  /** Library folders whose drive isn't connected. */
  offline: Library[];
  continueList: ContinueItem[];
  loaded: boolean;
  hasLibraries: boolean;
  /** False while a show page covers it; it stays put underneath so its scroll position is kept. */
  active: boolean;
  onTab: (tab: Tab) => void;
  onOpen: (id: number) => void;
  onPlay: (fileId: number) => void;
  onScrolled: (scrolled: boolean) => void;
  onAddFolder: () => void;
}

type SortKey = "name" | "added" | "watched" | "year";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "name", label: "A–Z" },
  { id: "added", label: "Recently added" },
  { id: "watched", label: "Recently watched" },
  { id: "year", label: "Newest first" },
];

function sortTitles(titles: TitleSummary[], sort: SortKey) {
  const list = titles.slice();
  if (sort === "added") list.sort((a, b) => b.addedAt - a.addedAt);
  else if (sort === "watched") list.sort((a, b) => (b.lastWatched ?? 0) - (a.lastWatched ?? 0));
  else if (sort === "year") list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  return list;
}

export default function Browse({ tab, titles, offline, query, continueList, loaded, hasLibraries, active, onTab, onOpen, onPlay, onScrolled, onAddFolder }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<SortKey>("name");

  useEffect(() => {
    getSetting<SortKey>("ui.sort").then((s) => s && SORTS.some((x) => x.id === s) && setSort(s));
  }, []);

  useEffect(() => {
    ref.current?.scrollTo(0, 0);
    onScrolled(false);
  }, [tab, query === "", onScrolled]);

  useEffect(() => {
    if (active) onScrolled((ref.current?.scrollTop ?? 0) > 8);
  }, [active, onScrolled]);

  const byKind = useMemo(() => {
    const map = new Map<LibraryKind, TitleSummary[]>();
    for (const t of titles) map.set(t.kind, [...(map.get(t.kind) ?? []), t]);
    return map;
  }, [titles]);

  // Play a whole show: pick up where it was left, like its own Play button.
  const play = (id: number) =>
    library.title(id).then((detail) => {
      const up = detail && upNext(detail);
      if (up) onPlay(up.file.id);
      else onOpen(id);
    });

  const changeSort = (next: SortKey) => {
    setSort(next);
    setSetting("ui.sort", next);
  };

  // "Surprise me": something of this kind that isn't finished yet.
  const surprise = (list: TitleSummary[]) => {
    const open = list.filter((t) => t.online && t.watched < Math.max(1, t.episodes + t.movies));
    const pool = open.length > 0 ? open : list;
    if (pool.length > 0) play(pool[Math.floor(Math.random() * pool.length)].id);
  };

  let content;
  if (!loaded) content = null;
  else if (!hasLibraries || titles.length === 0) content = <Empty hasLibraries={hasLibraries} onAddFolder={onAddFolder} />;
  else if (query) content = <Search query={query} titles={titles} onOpen={onOpen} onPlay={onPlay} onPlayTitle={play} />;
  else if (tab === "home")
    content = (
      <>
        <Spotlight titles={titles} onOpen={onOpen} onPlay={play} />
        <div className="home__rows">
          <OfflineNote offline={offline} titles={titles} />
          {continueList.length > 0 && (
            <Row label="Continue watching" count={continueList.length} wide>
              {continueList.map((c) => (
                <ContinueCard key={c.fileId} item={c} onPlay={onPlay} onOpen={onOpen} />
              ))}
            </Row>
          )}
          {KINDS.filter((k) => byKind.has(k)).map((k) => (
            <Row key={k} label={KIND_LABELS[k]} count={byKind.get(k)!.length} onMore={() => onTab(k)}>
              {byKind.get(k)!.map((t) => (
                <Card key={t.id} title={t} onOpen={onOpen} onPlay={play} />
              ))}
            </Row>
          ))}
          <HomeEnd />
        </div>
      </>
    );
  else {
    const list = sortTitles(byKind.get(tab) ?? [], sort);
    content = (
      <section className="grid-page">
        <header className="grid-page__head">
          <h1 className="grid-page__title">{KIND_LABELS[tab]}</h1>
          <span className="grid-page__count">
            {list.length} title{list.length === 1 ? "" : "s"}
          </span>
          <span className="spacer" />
          <button className="btn btn--small" onClick={() => surprise(list)} title="Play something you haven't finished">
            <DiceIcon />
            Surprise me
          </button>
          <select className="input sort-select" value={sort} onChange={(e) => changeSort(e.target.value as SortKey)} aria-label="Sort by">
            {SORTS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </header>
        <OfflineNote offline={offline} titles={list} />
        <div className="grid">
          {list.map((t) => (
            <Card key={t.id} title={t} onOpen={onOpen} onPlay={play} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div
      ref={ref}
      className={`view browse ${tab === "home" && !query ? "view--hero" : ""} ${active ? "" : "is-covered"}`}
      onScroll={(e) => onScrolled(e.currentTarget.scrollTop > 8)}
    >
      <div className="page-in" key={query ? "search" : tab}>
        {content}
      </div>
    </div>
  );
}

/** "H:\ isn't connected": explains why some covers are greyed out. */
function OfflineNote({ offline, titles }: { offline: Library[]; titles: TitleSummary[] }) {
  const notes = offline
    .map((lib) => ({ lib, count: titles.filter((t) => t.libraryId === lib.id).length }))
    .filter((n) => n.count > 0);
  if (notes.length === 0) return null;
  return (
    <div className="offline-note">
      {notes.map(({ lib, count }) => (
        <p key={lib.id}>
          <strong>{lib.path}</strong> isn't connected, so {count} title{count === 1 ? " is" : "s are"} greyed out. They'll be back as
          soon as it's plugged in.
        </p>
      ))}
    </div>
  );
}

/** Search results: shows and movies, then matching episodes. */
function Search({
  query,
  titles,
  onOpen,
  onPlay,
  onPlayTitle,
}: {
  query: string;
  titles: TitleSummary[];
  onOpen: (id: number) => void;
  onPlay: (fileId: number) => void;
  onPlayTitle: (id: number) => void;
}) {
  const [results, setResults] = useState<SearchResults | null>(null);
  const openMenu = useContextMenu();

  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(() => {
      library.search(query).then((r) => current && setResults(r)).catch(() => {});
    }, 120);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const copy = useCopy();
  const nothing = !!results && results.titles.length === 0 && results.files.length === 0;
  const secret = copy.searchSecrets[query.toLowerCase()];
  useEffect(() => {
    if (secret) playSound("save");
    else if (nothing) playSound("nope");
  }, [nothing, query, secret]);

  const byId = new Map(titles.map((t) => [t.id, t]));
  const shows = (results?.titles ?? []).map((id) => byId.get(id)).filter((t): t is TitleSummary => !!t);
  const files = results?.files ?? [];
  const code = (f: FoundFile) =>
    f.episode == null
      ? ""
      : `${f.seasonNumber != null && f.seasonNumber > 0 ? `S${f.seasonNumber}` : ""}E${f.episodeEnd != null ? `${f.episode}-${f.episodeEnd}` : f.episode}`;

  return (
    <section className="grid-page search">
      <header className="grid-page__head">
        <h1 className="grid-page__title">“{query}”</h1>
        {results && (
          <span className="grid-page__count">
            {shows.length} show{shows.length === 1 ? "" : "s"} · {files.length}
            {files.length === 60 ? "+" : ""} episode{files.length === 1 ? "" : "s"}
          </span>
        )}
      </header>
      {secret && <Typed as="p" className="search__secret" text={secret} />}
      {results && shows.length === 0 && files.length === 0 && !secret && (
        <div className="search__none">
          <span className="search__none-art" aria-hidden="true" />
          <Typed as="p" className="search__none-text" text={copy.searchNone} />
        </div>
      )}
      {shows.length > 0 && (
        <>
          <h2 className="section-title">Shows & movies</h2>
          <div className="grid search__titles">
            {shows.map((t) => (
              <Card key={t.id} title={t} onOpen={onOpen} onPlay={onPlayTitle} />
            ))}
          </div>
        </>
      )}
      {files.length > 0 && (
        <>
          <h2 className="section-title">Episodes</h2>
          <div className="search__files">
            {files.map((f) => (
              <button
                key={f.fileId}
                className="found"
                onClick={() => onPlay(f.fileId)}
                onContextMenu={(e) =>
                  openMenu(e, [
                    { label: "Play", icon: <PlayIcon />, onSelect: () => onPlay(f.fileId) },
                    { label: "Show details", icon: <InfoIcon />, onSelect: () => onOpen(f.titleId) },
                    { label: "Mark as watched", icon: <CheckIcon />, onSelect: () => watch.set([f.fileId], true), sfx: "save" },
                  ])
                }
              >
                <span className="found__still">
                  {f.thumb && <img src={img(f.thumb)} alt="" loading="lazy" decoding="async" />}
                  <span className="found__play">
                    <PlayIcon />
                  </span>
                </span>
                <span className="found__text">
                  <span className="found__show">{f.titleName}</span>
                  <span className="found__name">
                    {code(f) && <span className="found__code">{code(f)}</span>}
                    {f.name ?? (f.episode != null ? `Episode ${f.episode}` : "Movie")}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** The big rotating banner at the top of the home screen. */
function Spotlight({ titles, onOpen, onPlay }: { titles: TitleSummary[]; onOpen: (id: number) => void; onPlay: (id: number) => void }) {
  // Picked once per visit, so it doesn't reshuffle whenever new info arrives.
  const pick = () =>
    titles
      .filter((t) => t.banner)
      .map((t) => ({ id: t.id, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .slice(0, SPOTLIGHT_SIZE)
      .map((t) => t.id);
  const [ids, setIds] = useState(pick);
  useEffect(() => {
    if (ids.length === 0 && titles.some((t) => t.banner)) setIds(pick());
  }, [titles]);
  const featured = ids.map((id) => titles.find((t) => t.id === id)).filter((t): t is TitleSummary => !!t);
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [descriptions, setDescriptions] = useState<Record<number, string | null>>({});

  const show = (next: number) => {
    setPrevious(index);
    setIndex(next);
  };

  useEffect(() => {
    if (paused || featured.length < 2) return;
    const timer = window.setTimeout(() => show((index + 1) % featured.length), SPOTLIGHT_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  });

  const current = featured[index];
  useEffect(() => {
    if (!current || current.id in descriptions) return;
    library.title(current.id).then((d) => setDescriptions((all) => ({ ...all, [current.id]: d?.meta?.description ?? null })));
  }, [current, descriptions]);

  if (!current) return <div className="spotlight-spacer" />;
  const eyebrow = [KIND_LABELS[current.kind], current.year, ...current.genres.slice(0, 2)].filter(Boolean).join(" · ");

  return (
    <section
      className="hero"
      style={{ "--c": current.color ?? undefined } as React.CSSProperties}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero__art">
        {featured.map((t, i) =>
          i === index || i === previous ? (
            <img key={t.id} src={img(t.banner)} alt="" className={i === index ? "is-shown" : ""} decoding="async" />
          ) : null,
        )}
      </div>
      <span className="hero__decor hero__decor--back" aria-hidden="true" />
      <div className="hero__shade" />
      <span className="hero__decor hero__decor--top" aria-hidden="true" />
      <span className="hero__decor hero__decor--bottom" aria-hidden="true" />
      <div className="hero__content" key={current.id}>
        <div className="hero__eyebrow">{eyebrow}</div>
        <h1 className="hero__title">{current.name}</h1>
        <div className="hero__desc-box">
          <Typed as="p" className="hero__desc" text={descriptions[current.id] ?? ""} />
        </div>
        <div className="hero__actions">
          <button className="btn btn--primary" onClick={() => onPlay(current.id)}>
            <PlayIcon />
            Play
          </button>
          <button className="btn" onClick={() => onOpen(current.id)}>
            <InfoIcon />
            More info
          </button>
        </div>
      </div>
      {featured.length > 1 && (
        <div className="hero__dots">
          {featured.map((t, i) => (
            <button key={t.id} className={i === index ? "is-active" : ""} onClick={() => show(i)} aria-label={t.name} title={t.name} />
          ))}
        </div>
      )}
    </section>
  );
}

/** A sideways-scrolling row of cards. */
function Row({ label, count, wide, onMore, children }: { label: string; count: number; wide?: boolean; onMore?: () => void; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = () => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (track.current) observer.observe(track.current);
    return () => observer.disconnect();
  }, [count]);

  const page = (direction: number) => {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className={`row ${wide ? "row--wide" : ""}`}>
      <div className="row__head">
        <h2 className="row__title">{label}</h2>
        <span className="row__count">{count}</span>
        {onMore && (
          <button className="row__more" onClick={onMore}>
            See all
          </button>
        )}
      </div>
      <div className="row__wrap">
        <button className="row__arrow row__arrow--left" disabled={edges.start} onClick={() => page(-1)} aria-label="Scroll left">
          <ChevronLeft />
        </button>
        <div className="row__track" ref={track} onScroll={measure}>
          {children}
        </div>
        <button className="row__arrow row__arrow--right" disabled={edges.end} onClick={() => page(1)} aria-label="Scroll right">
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}

/** "Continue watching": a wide card that plays straight away. */
function ContinueCard({ item, onPlay, onOpen }: { item: ContinueItem; onPlay: (fileId: number) => void; onOpen: (id: number) => void }) {
  const openMenu = useContextMenu();
  const code = itemCode(item);
  const left = item.reason === "resume" && item.resume != null && item.duration ? Math.max(1, Math.round((item.duration - item.resume) / 60)) : null;
  return (
    <div
      className="ccard"
      onContextMenu={(e) =>
        openMenu(e, [
          { label: item.reason === "resume" ? "Resume" : "Play", icon: <PlayIcon />, onSelect: () => onPlay(item.fileId) },
          { label: "Show details", icon: <InfoIcon />, onSelect: () => onOpen(item.titleId) },
          "divider",
          { label: "Mark episode as watched", icon: <CheckIcon />, onSelect: () => watch.set([item.fileId], true), sfx: "save" },
          { label: "Open file location", icon: <FolderIcon />, onSelect: () => reveal(item.path) },
          "divider",
          { label: "Remove from Continue watching", icon: <CloseIcon />, onSelect: () => watch.hide(item.titleId) },
        ])
      }
    >
      <button className="ccard__main" onClick={() => onPlay(item.fileId)} title={`Play ${itemName(item)}`}>
        <span className="ccard__art">
          {item.image && <img src={img(item.image)} alt="" loading="lazy" decoding="async" onLoad={(e) => e.currentTarget.classList.add("is-loaded")} />}
          <span className="ccard__play">
            <PlayIcon />
          </span>
          {item.reason === "next" && <span className="ccard__badge">Up next</span>}
          {item.reason === "resume" && item.resume != null && item.duration ? (
            <span className="progress ccard__progress">
              <span style={{ width: `${(item.resume / item.duration) * 100}%` }} />
            </span>
          ) : null}
        </span>
        <span className="ccard__text">
          <span className="ccard__show">{item.titleName}</span>
          <span className="ccard__ep">
            {code && <span className="ccard__code">{code}</span>}
            {itemName(item)}
          </span>
          {left != null && <span className="ccard__left">{left} min left</span>}
        </span>
      </button>
      <div className="ccard__actions">
        <button className="icon-btn" onClick={() => onOpen(item.titleId)} title="Show details">
          <InfoIcon />
        </button>
        <button className="icon-btn" onClick={() => watch.hide(item.titleId)} title="Remove from Continue watching" data-sfx="back">
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

export function Card({ title, onOpen, onPlay }: { title: TitleSummary; onOpen: (id: number) => void; onPlay: (id: number) => void }) {
  const openMenu = useContextMenu();
  const total = Math.max(1, title.episodes + title.movies);
  const finished = title.watched >= total;
  const badge = title.isNew ? "New" : title.newCount > 0 ? `${title.newCount} new` : null;
  return (
    <button
      className={`card ${title.online ? "" : "card--offline"}`}
      style={{ "--c": title.color ?? undefined } as React.CSSProperties}
      onClick={() => onOpen(title.id)}
      onContextMenu={(e) =>
        openMenu(e, [
          { label: "Play", icon: <PlayIcon />, onSelect: () => onPlay(title.id) },
          { label: "Show details", icon: <InfoIcon />, onSelect: () => onOpen(title.id) },
          "divider",
          finished
            ? { label: "Mark all as unwatched", icon: <UndoIcon />, onSelect: () => watch.setTitle(title.id, false) }
            : { label: "Mark all as watched", icon: <CheckIcon />, onSelect: () => watch.setTitle(title.id, true), sfx: "save" },
          { label: "Open folder", icon: <FolderIcon />, onSelect: () => revealTitle(title.id) },
        ])
      }
      title={title.name}
    >
      <span className="card__art">
        {title.thumb ? (
          <img
            src={img(title.thumb)}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={(e) => e.currentTarget.classList.add("is-loaded")}
          />
        ) : (
          <span className="card__placeholder">{title.name}</span>
        )}
        {badge && <span className="card__badge">{badge}</span>}
        {title.watched > 0 && (
          <span className="progress card__progress" title={`${title.watched} of ${total} watched`}>
            <span style={{ width: `${Math.min(100, (title.watched / total) * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="card__text">
        <span className="card__name">{title.name}</span>
        <span className="card__sub">{describe(title)}</span>
      </span>
    </button>
  );
}

/** A theme's closing line under the home screen's rows, if it has any. */
function HomeEnd() {
  const copy = useCopy();
  const [now] = useState(() => new Date());
  const lateNight = now.getHours() < 5 && copy.lateNight.length > 0;
  const lines = lateNight ? copy.lateNight : [...copy.homeEnd, ...(now.getMonth() === 11 ? copy.december : [])];
  const [pick] = useState(() => Math.random());
  if (lines.length === 0) return null;
  return <Typed as="p" className="home__end" text={lines[Math.floor(pick * lines.length)]} />;
}

function Empty({ hasLibraries, onAddFolder }: { hasLibraries: boolean; onAddFolder: () => void }) {
  const copy = useCopy();
  return (
    <div className="empty">
      <span className="empty__art" aria-hidden="true" />
      <h1 className="empty__title">{hasLibraries ? copy.emptyScanTitle : copy.emptyTitle}</h1>
      <Typed as="p" className="empty__text" text={hasLibraries ? copy.emptyScanText : copy.emptyText} />
      {!hasLibraries && (
        <button className="btn btn--primary" onClick={onAddFolder}>
          Add a folder
        </button>
      )}
    </div>
  );
}
