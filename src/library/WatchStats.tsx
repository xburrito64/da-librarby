// The watch-time page: how much was watched this month, this year or ever, when, and what; a few
// facts about it, and charms to collect.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { library, img, type TitleSummary } from "./api";
import { useCopy } from "../theme/copy";

interface Stats {
  /** [title id, hour since 1970, seconds] */
  time: [number, number, number][];
  /** [title id, "episode" | "movie", finished at (seconds since 1970)] */
  finished: [number, string, number][];
}

type Period = "month" | "year" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
  { id: "all", label: "All time" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Finished before this hour (local time) counts as after midnight. */
const LATE_UNTIL = 5;
/** Episodes of a show finished at most this far apart are one sitting (an episode and a break). */
const SITTING_GAP = 75 * 60;
/** Tally marks shown on a theme's episode count, at most. */
const TALLY_MAX = 25;
/** Candles shown on a theme's day streak, at most. */
const CANDLES_MAX = 7;
/** A day counts towards a streak with at least this much watched. */
const STREAK_SECONDS = 60;
const TOP_COUNT = 6;

/** 9000 -> "2 h 30 min", 300 -> "5 min". */
export function formatDuration(seconds: number) {
  if (seconds > 0 && seconds < 60) return "<1 min";
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Shorter, for bar labels: "2.5 h", "40 min". */
function shortDuration(seconds: number) {
  if (seconds < 60) return "<1 min";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const h = seconds / 3600;
  return `${h < 10 ? h.toFixed(1).replace(/\.0$/, "") : Math.round(h)} h`;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export default function WatchStats({ titles, onOpen }: { titles: TitleSummary[]; onOpen: (id: number) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const copy = useCopy();

  useEffect(() => {
    const load = () => invoke<Stats>("watch_stats").then(setStats).catch(() => {});
    load();
    const off = library.onChanged(load);
    return () => void off.then((f) => f());
  }, []);

  const view = useMemo(() => (stats ? summarize(stats, period) : null), [stats, period]);
  const byId = useMemo(() => new Map(titles.map((t) => [t.id, t])), [titles]);
  const lifetime = useMemo(() => (stats ? stats.time.reduce((sum, [, , s]) => sum + s, 0) : 0), [stats]);

  if (!stats || !view) return null;
  const empty = stats.time.length === 0;
  const top = view.top.filter((t) => byId.has(t.id)).slice(0, TOP_COUNT);
  const peak = Math.max(1, ...view.bars.map((b) => b.seconds));
  const hourPeak = Math.max(1, ...view.hours);
  const flavor = copy.statsLine?.(lifetime);
  const names = copy.statsFacts;
  const longestTitle = view.longestDay ? byId.get(view.longestDay.titleId)?.name : undefined;
  const bingeTitle = view.binge.count > 0 ? byId.get(view.binge.titleId)?.name : undefined;

  return (
    <section className="grid-page stats">
      <header className="grid-page__head">
        <h1 className="grid-page__title">{copy.statsTab}</h1>
        <span className="spacer" />
        <div className="seasons stats__periods" role="tablist">
          {PERIODS.map((p) => (
            <button key={p.id} role="tab" className={`seasons__tab ${period === p.id ? "is-active" : ""}`} onClick={() => setPeriod(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      </header>
      {flavor && <p className="stats__flavor">{withMark(flavor)}</p>}

      {empty ? (
        <p className="stats__empty">{withMark(copy.statsEmpty)}</p>
      ) : (
        <>
          <div className="stats__tiles">
            <Tile label="Time watched" value={formatDuration(view.seconds)} art="time" />
            <Tile label="Episodes finished" value={String(view.episodes)} art="episodes">
              <Tally count={view.episodes} />
            </Tile>
            <Tile label="Movies finished" value={String(view.movies)} art="movies" />
            <Tile
              label="Day streak"
              value={`${view.streak} ${view.streak === 1 ? "day" : "days"}`}
              note={view.longest > view.streak ? `Longest: ${view.longest} days` : view.streak > 1 ? "Your longest yet!" : undefined}
              art="streak"
            >
              <span className="stats__candles">
                {Array.from({ length: Math.min(CANDLES_MAX, Math.max(view.streak, view.longest)) }, (_, i) => (
                  <i key={i} className={i < view.streak ? "is-lit" : ""} />
                ))}
              </span>
            </Tile>
          </div>

          {view.seconds > 0 && (
            <div className="stats__facts">
              {view.longestDay && (
                <Tile
                  label={names.longest}
                  value={`${MONTHS[view.longestDay.date.getMonth()]} ${view.longestDay.date.getDate()}`}
                  note={`${formatDuration(view.longestDay.seconds)}${longestTitle ? ` of ${longestTitle}` : ""}`}
                  fact
                />
              )}
              <Tile label={names.late} value={`${view.late} ${view.late === 1 ? "episode" : "episodes"}`} note="finished after midnight" fact />
              <Tile label={names.day} value={DAY_NAMES[view.topWeekday]} note={`mostly around ${String(view.topHour).padStart(2, "0")}:00`} fact />
              <Tile
                label={names.binge}
                value={view.binge.count > 1 ? `${view.binge.count} episodes` : "Not yet"}
                note={view.binge.count > 1 ? (bingeTitle ? `of ${bingeTitle} in one sitting` : "in one sitting") : "a few episodes in a row"}
                fact
              />
            </div>
          )}

          <div className="stats__panel">
            <h2 className="stats__heading">{view.barsTitle}</h2>
            <div className="stats__chart" role="list">
              {view.bars.map((b) => (
                <div
                  key={b.label}
                  className={`stats__col ${b.current ? "is-current" : ""} ${b.seconds ? "" : "is-empty"} ${b.future ? "is-future" : ""}`}
                  role="listitem"
                  data-tip={`${b.long}: ${b.seconds ? formatDuration(b.seconds) : "nothing"}`}
                >
                  <span className="stats__bar-area">
                    <span className="stats__bar" style={{ height: b.seconds ? `max(3px, ${(b.seconds / peak) * 100}%)` : 0 }} />
                  </span>
                  <span className="stats__label">{b.label}</span>
                </div>
              ))}
            </div>
            <p className="stats__axis-note">Tallest bar: {shortDuration(peak)}</p>
          </div>

          <div className="stats__split">
            <div className="stats__panel">
              <h2 className="stats__heading">Most watched</h2>
              {top.length === 0 ? (
                <p className="stats__none">Nothing in this time yet.</p>
              ) : (
                <ol className="stats__top">
                  {top.map((t) => {
                    const title = byId.get(t.id)!;
                    return (
                      <li key={t.id}>
                        <button className="stats__show" onClick={() => onOpen(t.id)}>
                          <span className="stats__thumb">{title.thumb && <img src={img(title.thumb)} alt="" loading="lazy" />}</span>
                          <span className="stats__show-text">
                            <span className="stats__show-name">{title.name}</span>
                            <span className="stats__meter">
                              <span style={{ width: `${(t.seconds / top[0].seconds) * 100}%` }} />
                            </span>
                          </span>
                          <span className="stats__show-time">{shortDuration(t.seconds)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div className="stats__panel">
              <h2 className="stats__heading">When you watch</h2>
              <div className="stats__chart stats__chart--hours" role="list">
                {view.hours.map((s, h) => (
                  <div key={h} className="stats__col" role="listitem" data-tip={`${String(h).padStart(2, "0")}:00: ${s ? formatDuration(s) : "nothing"}`}>
                    <span className="stats__bar-area">
                      <span className="stats__bar" style={{ height: s ? `max(3px, ${(s / hourPeak) * 100}%)` : 0 }} />
                    </span>
                    <span className="stats__label">{h % 6 === 0 ? String(h).padStart(2, "0") : ""}</span>
                  </div>
                ))}
              </div>
              <div className="stats__when">
                <div className="stats__clock">
                  <HourClock hours={view.hours} />
                </div>
                {view.seconds > 0 && (
                  <div className="stats__when-text">
                    <p className="stats__peak">
                      {names.peak}
                      <strong>{String(view.topHour).padStart(2, "0")}:00</strong>
                    </p>
                    <p className="stats__habit">
                      Mostly on <strong>{WEEKDAYS[view.topWeekday]}</strong>, around <strong>{String(view.topHour).padStart(2, "0")}:00</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="stats__panel">
            <h2 className="stats__heading">Charms</h2>
            <ul className="stats__charms">
              {view.charms.map((c) => (
                <li key={c.id} className={`stats__charm ${c.earned ? "is-earned" : ""}`} title={c.earned ? `${c.name}: earned` : `${c.name}: ${c.progress}`}>
                  <span className="stats__charm-badge">{CHARM_ART[c.id]}</span>
                  <span className="stats__charm-name">{c.name}</span>
                  <span className="stats__charm-how">{c.how}</span>
                  {!c.earned && <span className="stats__charm-progress">{c.progress}</span>}
                </li>
              ))}
            </ul>
          </div>
          <p className="stats__note">Time from before this page existed is estimated from what you had watched.</p>
        </>
      )}
    </section>
  );
}

/** A leading "* " gets the theme's own asterisk, like typed text. */
function withMark(text: string) {
  if (!text.startsWith("* ")) return text;
  return (
    <>
      <span className="typed__mark">*</span> {text.slice(2)}
    </>
  );
}

/** A number with its name; `art`: a drawing beside it, for themes that show one (`children`: what
 *  it's drawn from, like tally marks); `fact`: one of the facts under the numbers. */
function Tile({ label, value, note, art, fact, children }: { label: string; value: string; note?: string; art?: string; fact?: boolean; children?: ReactNode }) {
  return (
    <div className={`stats__tile ${fact ? "stats__fact" : ""}`}>
      <span className="stats__tile-label">{label}</span>
      <span className="stats__tile-value">{value}</span>
      {note && <span className="stats__tile-note">{note}</span>}
      {art && (
        <span className="stats__tile-art" data-art={art} aria-hidden="true">
          {children}
        </span>
      )}
    </div>
  );
}

/** Tally marks, five to a bundle (the fifth across the four). */
function Tally({ count }: { count: number }) {
  const marks = Math.min(TALLY_MAX, count);
  return (
    <span className="stats__tally">
      {Array.from({ length: Math.ceil(marks / 5) }, (_, g) => {
        const n = Math.min(5, marks - g * 5);
        return (
          <span key={g} className="stats__tally-group">
            {Array.from({ length: Math.min(4, n) }, (_, i) => (
              <i key={i} />
            ))}
            {n === 5 && <s />}
          </span>
        );
      })}
    </span>
  );
}

/** The hours of the day as a round clock, each hour's slice as long as it was watched (for themes
 *  that show it in place of the bars). */
function HourClock({ hours }: { hours: number[] }) {
  const peak = Math.max(...hours);
  const C = 150;
  const R0 = 62;
  const R1 = 118;
  const at = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(1)} ${(C + r * Math.sin(a)).toFixed(1)}`;
  const angle = (h: number) => ((h / 24) * 360 - 90) * (Math.PI / 180);
  return (
    <svg className="stats__clock-face" viewBox="0 0 300 300" aria-hidden="true">
      <defs>
        <linearGradient id="stats-hour" x1="0" y1="1" x2="0" y2="0">
          <stop className="stats__hour-from" offset="0" />
          <stop className="stats__hour-to" offset="1" />
        </linearGradient>
      </defs>
      <circle className="stats__clock-sky" cx={C} cy={C} r={R1 + 6} />
      {[[60, 70, 1], [230, 60, 1.3], [250, 210, 0.9], [70, 240, 1.1], [150, 30, 0.8], [40, 150, 0.7]].map(([x, y, r], i) => (
        <circle key={i} className="stats__clock-star" cx={x} cy={y} r={r} />
      ))}
      {hours.map((s, h) => {
        const a0 = angle(h) + 0.026;
        const a1 = angle(h + 1) - 0.026;
        const r = s && peak ? R0 + 6 + (s / peak) * (R1 - R0 - 6) : R0 + 3;
        return (
          <path
            key={h}
            className={`stats__wedge ${s ? "is-on" : ""} ${s && s === peak ? "is-peak" : ""}`}
            style={s && peak ? { opacity: 0.45 + 0.55 * (s / peak) } : undefined}
            d={`M${at(R0, a0)}L${at(r, a0)}A${r} ${r} 0 0 1 ${at(r, a1)}L${at(R0, a1)}A${R0} ${R0} 0 0 0 ${at(R0, a0)}Z`}
          >
            <title>{`${String(h).padStart(2, "0")}:00: ${s ? formatDuration(s) : "nothing"}`}</title>
          </path>
        );
      })}
      {[0, 6, 12, 18].map((h) => (
        <text key={h} className="stats__clock-label" x={C + (R1 + 18) * Math.cos(angle(h))} y={C + (R1 + 18) * Math.sin(angle(h)) + 4} textAnchor="middle">
          {String(h).padStart(2, "0")}
        </text>
      ))}
      <circle className="stats__clock-hub" cx={C} cy={C} r={R0 - 6} />
      <path className="stats__clock-moon" d={`M${C + 6} ${C - 30}A30 30 0 1 0 ${C + 6} ${C + 30}A36 36 0 0 1 ${C + 6} ${C - 30}Z`} />
    </svg>
  );
}

/** The charms' little pictures (drawn in the theme's colours). */
const CHARM_ART: Record<string, ReactNode> = (() => {
  const svg = (body: ReactNode) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {body}
    </svg>
  );
  return {
    owl: svg(
      <>
        <path d="M5.5 20c0-8 1.5-13 6.5-13s6.5 5 6.5 13z" />
        <circle cx="9.5" cy="12" r="2" />
        <circle cx="14.5" cy="12" r="2" />
        <path d="M6.5 8L5 4.5l3.5 2M17.5 8L19 4.5l-3.5 2M11.3 15.2L12 16l.7-.8" />
      </>,
    ),
    marathon: svg(
      <>
        <rect x="3.5" y="8.5" width="13" height="10" rx="1.5" />
        <path d="M7 5.5h13.5v10" />
        <path d="M8.5 11.2l4 2.3-4 2.3z" fill="currentColor" />
      </>,
    ),
    seven: svg(
      <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="Georgia, serif" fill="currentColor" stroke="none">
        VII
      </text>,
    ),
    movienight: svg(
      <>
        <rect x="2.5" y="8" width="14" height="11" rx="1.5" />
        <path d="M8 11l4 2.5-4 2.5z" fill="currentColor" />
        <path d="M19.5 3a3.2 3.2 0 1 0 2.5 5.4 3.6 3.6 0 0 1-2.5-5.4z" />
      </>,
    ),
    fullmoon: svg(
      <>
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="9.5" cy="10" r="1.3" />
        <circle cx="14" cy="14.5" r="1.8" />
        <circle cx="14.6" cy="8.8" r=".8" />
      </>,
    ),
    century: svg(
      <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="800" fontFamily="Arial, sans-serif" fill="currentColor" stroke="none">
        100
      </text>,
    ),
    buff: svg(
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="1.4" />
        <circle cx="12" cy="7.5" r="1.6" />
        <circle cx="16.3" cy="13.4" r="1.6" />
        <circle cx="7.7" cy="13.4" r="1.6" />
      </>,
    ),
    halloween: svg(
      <>
        <path d="M12 8.2c5-1 8 2 8 5.8S16.4 20 12 20s-8-2.2-8-6 3-6.8 8-5.8z" />
        <path d="M12 8.2c-.2-2 .6-3.6 2.2-4.4" />
        <path d="M8.6 12.6l1.3-1.6 1.1 1.6zM15.4 12.6l-1.3-1.6-1.1 1.6zM8.8 15.6q3.2 2 6.4 0" />
      </>,
    ),
  };
})();

/** Adds everything up for one period, in local time. */
function summarize(stats: Stats, period: Period) {
  const now = new Date();
  const start =
    period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1) : period === "year" ? new Date(now.getFullYear(), 0, 1) : new Date(0);
  const from = start.getTime() / 1000;

  let seconds = 0;
  const perTitle = new Map<number, number>();
  // Each day in this time, and what was watched that day (for the day with the most watching).
  const dayTotals = new Map<string, number>();
  const dayTitles = new Map<string, Map<number, number>>();
  // Every month ever, for a charm.
  const perMonth = new Map<string, number>();
  const hours = new Array<number>(24).fill(0);
  const weekdays = new Array<number>(7).fill(0);
  const perDay = new Map<string, number>();
  const buckets = new Map<string, number>();

  // The bars: days of this month, months of this year, or (all time) months or years.
  let firstAt = Infinity;
  for (const [, hour] of stats.time) firstAt = Math.min(firstAt, hour * 3600);
  const first = new Date(Number.isFinite(firstAt) ? firstAt * 1000 : Date.now());
  // All time shows at least the last twelve months.
  const monthsSpan = Math.max(12, (now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth() + 1);
  const allByYear = period === "all" && monthsSpan > 24;
  const bucketOf = (d: Date) =>
    period === "month" ? String(d.getDate()) : period === "year" || !allByYear ? `${d.getFullYear()}-${d.getMonth()}` : String(d.getFullYear());

  for (const [titleId, hour, s] of stats.time) {
    const d = new Date(hour * 3600 * 1000);
    perDay.set(dayKey(d), (perDay.get(dayKey(d)) ?? 0) + s);
    const month = `${d.getFullYear()}-${d.getMonth()}`;
    perMonth.set(month, (perMonth.get(month) ?? 0) + s);
    if (hour * 3600 < from) continue;
    const day = dayKey(d);
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + s);
    const onDay = dayTitles.get(day) ?? new Map<number, number>();
    onDay.set(titleId, (onDay.get(titleId) ?? 0) + s);
    dayTitles.set(day, onDay);
    seconds += s;
    perTitle.set(titleId, (perTitle.get(titleId) ?? 0) + s);
    hours[d.getHours()] += s;
    weekdays[d.getDay()] += s;
    buckets.set(bucketOf(d), (buckets.get(bucketOf(d)) ?? 0) + s);
  }

  let episodes = 0;
  let movies = 0;
  let late = 0;
  // (Ever, for the charms.)
  let episodesEver = 0;
  let moviesEver = 0;
  let lateEver = 0;
  let movieNight = false;
  for (const [, role, at] of stats.finished) {
    const h = new Date(at * 1000).getHours();
    if (role === "movie") moviesEver += 1;
    else episodesEver += 1;
    if (h < LATE_UNTIL && role !== "movie") lateEver += 1;
    if (role === "movie" && (h >= 22 || h < LATE_UNTIL)) movieNight = true;
    if (at < from) continue;
    if (role === "movie") movies += 1;
    else episodes += 1;
    if (h < LATE_UNTIL && role !== "movie") late += 1;
  }

  let longestDay: { date: Date; seconds: number; titleId: number } | null = null;
  for (const [key, s] of dayTotals) {
    if (longestDay && s <= longestDay.seconds) continue;
    const [y, m, d] = key.split("-").map(Number);
    const [titleId] = [...dayTitles.get(key)!].sort((a, b) => b[1] - a[1])[0];
    longestDay = { date: new Date(y, m, d), seconds: s, titleId };
  }

  type Bar = { label: string; long: string; seconds: number; current: boolean; future?: boolean };
  const bars: Bar[] = [];
  let barsTitle: string;
  if (period === "month") {
    barsTitle = `${MONTHS[now.getMonth()]} ${now.getFullYear()}, day by day`;
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const label = String(day);
      bars.push({ label, long: `${MONTHS[now.getMonth()]} ${day}`, seconds: buckets.get(label) ?? 0, current: day === now.getDate(), future: day > now.getDate() });
    }
  } else if (period === "year" || !allByYear) {
    const months = period === "year" ? 12 : Math.max(1, monthsSpan);
    const startMonth = period === "year" ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    barsTitle = period === "year" ? `${now.getFullYear()}, month by month` : "Month by month";
    for (let i = 0; i < months; i++) {
      const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const current = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      bars.push({ label: MONTHS[d.getMonth()], long: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, seconds: buckets.get(key) ?? 0, current, future: d > now });
    }
  } else {
    barsTitle = "Year by year";
    for (let y = first.getFullYear(); y <= now.getFullYear(); y++)
      bars.push({ label: String(y), long: String(y), seconds: buckets.get(String(y)) ?? 0, current: y === now.getFullYear() });
  }

  // Streaks of days in a row with some watching (the current one may end yesterday).
  const watchedOn = (d: Date) => (perDay.get(dayKey(d)) ?? 0) >= STREAK_SECONDS;
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!watchedOn(day)) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (watchedOn(day)) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  const days = [...perDay.entries()]
    .filter(([, s]) => s >= STREAK_SECONDS)
    .map(([k]) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m, d).getTime();
    })
    .sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  days.forEach((t, i) => {
    // Next day (by the calendar, so clock changes don't break a run).
    const prev = i > 0 ? new Date(days[i - 1]) : null;
    if (prev) prev.setDate(prev.getDate() + 1);
    run = prev && prev.getTime() === t ? run + 1 : 1;
    longest = Math.max(longest, run);
  });

  const top = [...perTitle.entries()].map(([id, s]) => ({ id, seconds: s })).sort((a, b) => b.seconds - a.seconds);
  const topHour = hours.indexOf(Math.max(...hours));
  const topWeekday = weekdays.indexOf(Math.max(...weekdays));
  const binge = biggestBinge(stats.finished, from);

  // The charms (for everything ever watched): what each takes, and how far along it is.
  const bingeEver = biggestBinge(stats.finished, 0).count;
  const monthHours = Math.floor(Math.max(0, ...perMonth.values()) / 3600);
  const halloween = [...perDay.entries()].some(([key, s]) => /-9-31$/.test(key) && s >= STREAK_SECONDS);
  const ever = Math.max(longest, streak);
  const charm = (id: string, name: string, how: string, value: number, goal: number) => ({
    id,
    name,
    how,
    earned: value >= goal,
    progress: goal > 1 ? `${Math.min(value, goal)} of ${goal}` : "Not yet",
  });
  const charms = [
    charm("owl", "Night Owl", "10 episodes finished after midnight", lateEver, 10),
    charm("marathon", "Marathon", "5 episodes of a show in one sitting", bingeEver, 5),
    charm("seven", "Seven Nights", "watching 7 days in a row", ever, 7),
    charm("movienight", "Movie Night", "a movie finished after 22:00", movieNight ? 1 : 0, 1),
    charm("fullmoon", "Full Moon", "30 hours in one month", monthHours, 30),
    charm("century", "Century", "100 episodes finished", episodesEver, 100),
    charm("buff", "Film Buff", "10 movies finished", moviesEver, 10),
    charm("halloween", "Halloween", "watching something on October 31", halloween ? 1 : 0, 1),
  ];
  return { seconds, episodes, movies, late, longestDay, binge, charms, streak, longest: ever, bars, barsTitle, top, hours, topHour, topWeekday };
}

/** The most episodes of one show finished one after another (each soon after the one before), from
 *  `from` on. */
function biggestBinge(finished: Stats["finished"], from: number) {
  const episodes = finished.filter(([, role, at]) => role !== "movie" && at >= from).sort((a, b) => a[2] - b[2]);
  let best = { count: 0, titleId: 0 };
  let run = 0;
  episodes.forEach(([id, , at], i) => {
    const prev = episodes[i - 1];
    run = prev && prev[0] === id && at - prev[2] <= SITTING_GAP ? run + 1 : 1;
    if (run > best.count) best = { count: run, titleId: id };
  });
  return best;
}
