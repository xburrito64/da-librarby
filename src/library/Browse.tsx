// Home screen (spotlight + one row per kind) and the full cover grid of each kind.
import { useEffect, useMemo, useRef, useState } from "react";
import { library, img, describe, firstPlayable, KIND_LABELS, type LibraryKind, type PlayRequest, type TitleSummary } from "./api";
import type { Tab } from "./LibraryView";
import { ChevronLeft, ChevronRight, InfoIcon, PlayIcon } from "../ui/icons";

const KINDS: LibraryKind[] = ["anime", "shows", "movies"];
const SPOTLIGHT_SIZE = 6;
const SPOTLIGHT_SECONDS = 9;

interface Props {
  tab: Tab;
  titles: TitleSummary[];
  loaded: boolean;
  hasLibraries: boolean;
  /** False while a show page covers it; it stays put underneath so its scroll position is kept. */
  active: boolean;
  onTab: (tab: Tab) => void;
  onOpen: (id: number) => void;
  onPlay: (request: PlayRequest) => void;
  onScrolled: (scrolled: boolean) => void;
  onAddFolder: () => void;
}

export default function Browse({ tab, titles, loaded, hasLibraries, active, onTab, onOpen, onPlay, onScrolled, onAddFolder }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo(0, 0);
    onScrolled(false);
  }, [tab, onScrolled]);

  useEffect(() => {
    if (active) onScrolled((ref.current?.scrollTop ?? 0) > 8);
  }, [active, onScrolled]);

  const byKind = useMemo(() => {
    const map = new Map<LibraryKind, TitleSummary[]>();
    for (const t of titles) map.set(t.kind, [...(map.get(t.kind) ?? []), t]);
    return map;
  }, [titles]);

  const play = (id: number) =>
    library.title(id).then((detail) => {
      const first = detail && firstPlayable(detail);
      if (first) onPlay(first.request);
      else onOpen(id);
    });

  let content;
  if (!loaded) content = null;
  else if (!hasLibraries || titles.length === 0) content = <Empty hasLibraries={hasLibraries} onAddFolder={onAddFolder} />;
  else if (tab === "home")
    content = (
      <>
        <Spotlight titles={titles} onOpen={onOpen} onPlay={play} />
        <div className="home__rows">
          {KINDS.filter((k) => byKind.has(k)).map((k) => (
            <Row key={k} label={KIND_LABELS[k]} titles={byKind.get(k)!} onOpen={onOpen} onMore={() => onTab(k)} />
          ))}
        </div>
      </>
    );
  else
    content = (
      <section className="grid-page">
        <header className="grid-page__head">
          <h1 className="grid-page__title">{KIND_LABELS[tab]}</h1>
          <span className="grid-page__count">
            {byKind.get(tab)?.length ?? 0} title{byKind.get(tab)?.length === 1 ? "" : "s"}
          </span>
        </header>
        <div className="grid">
          {(byKind.get(tab) ?? []).map((t) => (
            <Card key={t.id} title={t} onOpen={onOpen} />
          ))}
        </div>
      </section>
    );

  return (
    <div
      ref={ref}
      className={`view browse ${tab === "home" ? "view--hero" : ""} ${active ? "" : "is-covered"}`}
      onScroll={(e) => onScrolled(e.currentTarget.scrollTop > 8)}
    >
      {content}
    </div>
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
      <div className="hero__shade" />
      <div className="hero__content" key={current.id}>
        <div className="hero__eyebrow">{eyebrow}</div>
        <h1 className="hero__title">{current.name}</h1>
        <p className="hero__desc">{descriptions[current.id] ?? ""}</p>
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

/** A sideways-scrolling row of covers. */
function Row({ label, titles, onOpen, onMore }: { label: string; titles: TitleSummary[]; onOpen: (id: number) => void; onMore: () => void }) {
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
  }, [titles.length]);

  const page = (direction: number) => {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="row">
      <div className="row__head">
        <h2 className="row__title">{label}</h2>
        <span className="row__count">{titles.length}</span>
        <button className="row__more" onClick={onMore}>
          See all
        </button>
      </div>
      <div className="row__wrap">
        <button className="row__arrow row__arrow--left" disabled={edges.start} onClick={() => page(-1)} aria-label="Scroll left">
          <ChevronLeft />
        </button>
        <div className="row__track" ref={track} onScroll={measure}>
          {titles.map((t) => (
            <Card key={t.id} title={t} onOpen={onOpen} />
          ))}
        </div>
        <button className="row__arrow row__arrow--right" disabled={edges.end} onClick={() => page(1)} aria-label="Scroll right">
          <ChevronRight />
        </button>
      </div>
    </section>
  );
}

export function Card({ title, onOpen }: { title: TitleSummary; onOpen: (id: number) => void }) {
  return (
    <button
      className={`card ${title.online ? "" : "card--offline"}`}
      style={{ "--c": title.color ?? undefined } as React.CSSProperties}
      onClick={() => onOpen(title.id)}
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
      </span>
      <span className="card__text">
        <span className="card__name">{title.name}</span>
        <span className="card__sub">{describe(title)}</span>
      </span>
    </button>
  );
}

function Empty({ hasLibraries, onAddFolder }: { hasLibraries: boolean; onAddFolder: () => void }) {
  return (
    <div className="empty">
      <h1 className="empty__title">{hasLibraries ? "Nothing here yet" : "Your library is empty"}</h1>
      <p className="empty__text">
        {hasLibraries
          ? "No videos were found in your folders so far. If a scan is running, they'll show up in a moment."
          : "Add the folders or drives where your anime, shows and movies live, and they'll appear here."}
      </p>
      {!hasLibraries && (
        <button className="btn btn--primary" onClick={onAddFolder}>
          Add a folder
        </button>
      )}
    </div>
  );
}
