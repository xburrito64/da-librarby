// The watch-time page: how much was watched this month, this year or ever, when, and what.
import { useEffect, useMemo, useState } from "react";
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
      {flavor && (
        <p className="stats__flavor">
          {/* A leading "* " gets the theme's own asterisk, like typed text. */}
          {flavor.startsWith("* ") ? (
            <>
              <span className="typed__mark">*</span> {flavor.slice(2)}
            </>
          ) : (
            flavor
          )}
        </p>
      )}

      {empty ? (
        <p className="stats__empty">{copy.statsEmpty}</p>
      ) : (
        <>
          <div className="stats__tiles">
            <Tile label="Time watched" value={formatDuration(view.seconds)} />
            <Tile label="Episodes finished" value={String(view.episodes)} />
            <Tile label="Movies finished" value={String(view.movies)} />
            <Tile
              label="Day streak"
              value={`${view.streak} ${view.streak === 1 ? "day" : "days"}`}
              note={view.longest > view.streak ? `Longest: ${view.longest} days` : view.streak > 1 ? "Your longest yet!" : undefined}
            />
          </div>

          <div className="stats__panel">
            <h2 className="stats__heading">{view.barsTitle}</h2>
            <div className="stats__chart" role="list">
              {view.bars.map((b) => (
                <div key={b.label} className={`stats__col ${b.current ? "is-current" : ""}`} role="listitem" data-tip={`${b.long}: ${b.seconds ? formatDuration(b.seconds) : "nothing"}`}>
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
              {view.seconds > 0 && (
                <p className="stats__habit">
                  Mostly on <strong>{WEEKDAYS[view.topWeekday]}</strong>, around <strong>{String(view.topHour).padStart(2, "0")}:00</strong>.
                </p>
              )}
            </div>
          </div>
          <p className="stats__note">Time from before this page existed is estimated from what you had watched.</p>
        </>
      )}
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stats__tile">
      <span className="stats__tile-label">{label}</span>
      <span className="stats__tile-value">{value}</span>
      {note && <span className="stats__tile-note">{note}</span>}
    </div>
  );
}

/** Adds everything up for one period, in local time. */
function summarize(stats: Stats, period: Period) {
  const now = new Date();
  const start =
    period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1) : period === "year" ? new Date(now.getFullYear(), 0, 1) : new Date(0);
  const from = start.getTime() / 1000;

  let seconds = 0;
  const perTitle = new Map<number, number>();
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
    if (hour * 3600 < from) continue;
    seconds += s;
    perTitle.set(titleId, (perTitle.get(titleId) ?? 0) + s);
    hours[d.getHours()] += s;
    weekdays[d.getDay()] += s;
    buckets.set(bucketOf(d), (buckets.get(bucketOf(d)) ?? 0) + s);
  }

  let episodes = 0;
  let movies = 0;
  for (const [, role, at] of stats.finished) {
    if (at < from) continue;
    if (role === "movie") movies += 1;
    else episodes += 1;
  }

  type Bar = { label: string; long: string; seconds: number; current: boolean };
  const bars: Bar[] = [];
  let barsTitle: string;
  if (period === "month") {
    barsTitle = `${MONTHS[now.getMonth()]} ${now.getFullYear()}, day by day`;
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const label = String(day);
      bars.push({ label, long: `${MONTHS[now.getMonth()]} ${day}`, seconds: buckets.get(label) ?? 0, current: day === now.getDate() });
    }
  } else if (period === "year" || !allByYear) {
    const months = period === "year" ? 12 : Math.max(1, monthsSpan);
    const startMonth = period === "year" ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    barsTitle = period === "year" ? `${now.getFullYear()}, month by month` : "Month by month";
    for (let i = 0; i < months; i++) {
      const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const current = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      bars.push({ label: MONTHS[d.getMonth()], long: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, seconds: buckets.get(key) ?? 0, current });
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
  return { seconds, episodes, movies, streak, longest: Math.max(longest, streak), bars, barsTitle, top, hours, topHour, topWeekday };
}
