//! Watch history: where each file was stopped, what has been watched, what plays next, and
//! the "continue watching" list.

use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use super::db::now;

/// A file counts as watched once this much of it has been played (the rest is usually credits).
const WATCHED_AT: f64 = 0.9;
/// Stopping earlier than this isn't worth resuming from.
const MIN_RESUME_SECONDS: f64 = 30.0;
const CONTINUE_LIMIT: usize = 20;

pub const SCHEMA_V5: &str = "
CREATE TABLE IF NOT EXISTS watch (
    file_id    INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
    position   REAL NOT NULL DEFAULT 0,
    duration   REAL NOT NULL DEFAULT 0,
    watched    INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS watch_updated ON watch (updated_at);
";

/// Shows removed from "continue watching" by hand; they come back once something of theirs
/// is watched after `hidden_at`.
pub const SCHEMA_V6: &str = "
CREATE TABLE IF NOT EXISTS continue_hidden (
    title_id  INTEGER PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
    hidden_at INTEGER NOT NULL
);
";

/// Time spent watching, per file and hour, for the watch-time page. Filled in as videos play;
/// what was watched before it existed is estimated once from the watch history (a finished file
/// counts in full, a started one up to where it was stopped, at the time it was last played).
pub const SCHEMA_V9: &str = "
CREATE TABLE IF NOT EXISTS watch_log (
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    hour    INTEGER NOT NULL,
    seconds REAL NOT NULL,
    PRIMARY KEY (file_id, hour)
);
INSERT OR IGNORE INTO watch_log (file_id, hour, seconds)
    SELECT file_id, updated_at / 3600, CASE WHEN watched = 1 THEN duration ELSE position END
    FROM watch WHERE duration > 0 AND (watched = 1 OR position > 0);
";

/// Playback moving further than this many times the time that passed (plus a little) between two
/// saves was a jump, not watching, and isn't counted.
const MAX_SPEED: f64 = 4.0;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub position: f64,
    pub duration: f64,
    pub watched: bool,
    pub updated_at: i64,
}

impl Progress {
    /// Where to pick up again, if anywhere.
    pub fn resume_at(&self) -> Option<f64> {
        let unfinished = self.duration <= 0.0 || self.position < self.duration * WATCHED_AT;
        (self.position >= MIN_RESUME_SECONDS && unfinished).then_some(self.position)
    }
}

/// Everything the player needs to play one file.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayItem {
    pub file_id: i64,
    pub title_id: i64,
    pub title_name: String,
    pub path: String,
    pub role: String,
    pub season_number: Option<i32>,
    pub episode: Option<f64>,
    pub episode_end: Option<f64>,
    /// Episode or movie name.
    pub name: Option<String>,
    /// Episode still, else the show's wide artwork, else its cover.
    pub image: Option<String>,
    pub resume: Option<f64>,
    pub duration: Option<f64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContinueItem {
    #[serde(flatten)]
    pub item: PlayItem,
    /// "resume" = stopped part-way, "next" = the episode after the last one finished.
    pub reason: &'static str,
    pub updated_at: i64,
}

pub fn progress(conn: &Connection, file_id: i64) -> rusqlite::Result<Option<Progress>> {
    conn.query_row(
        "SELECT position, duration, watched, updated_at FROM watch WHERE file_id = ?1",
        [file_id],
        |r| Ok(Progress { position: r.get(0)?, duration: r.get(1)?, watched: r.get(2)?, updated_at: r.get(3)? }),
    )
    .optional()
}

/// Progress of every file of a title.
pub fn progress_for_title(conn: &Connection, title_id: i64) -> rusqlite::Result<HashMap<i64, Progress>> {
    let mut stmt = conn.prepare(
        "SELECT w.file_id, w.position, w.duration, w.watched, w.updated_at
         FROM watch w JOIN files f ON f.id = w.file_id WHERE f.title_id = ?1",
    )?;
    let rows = stmt.query_map([title_id], |r| {
        Ok((r.get(0)?, Progress { position: r.get(1)?, duration: r.get(2)?, watched: r.get(3)?, updated_at: r.get(4)? }))
    })?;
    rows.collect()
}

/// Records how far a file has been played. Returns true when it just became watched.
pub fn save_progress(conn: &Connection, file_id: i64, position: f64, duration: f64) -> rusqlite::Result<bool> {
    let before = progress(conn, file_id)?;
    let was_watched = before.as_ref().is_some_and(|p| p.watched);
    let finished = duration > 0.0 && position >= duration * WATCHED_AT;
    let time = now();
    conn.execute(
        "INSERT INTO watch (file_id, position, duration, watched, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (file_id) DO UPDATE SET position = ?2, duration = ?3, watched = watched OR ?4, updated_at = ?5",
        params![file_id, position.max(0.0), duration.max(0.0), finished, time],
    )?;

    // Time watched since the last save (the player saves every few seconds).
    let watched = match &before {
        Some(p) => {
            let moved = position - p.position;
            let passed = (time - p.updated_at).max(0) as f64;
            if moved > 0.0 && moved <= passed * MAX_SPEED + 10.0 { moved } else { 0.0 }
        }
        None if position <= 15.0 => position.max(0.0),
        None => 0.0,
    };
    if watched > 0.0 {
        conn.execute(
            "INSERT INTO watch_log (file_id, hour, seconds) VALUES (?1, ?2, ?3)
             ON CONFLICT (file_id, hour) DO UPDATE SET seconds = seconds + ?3",
            params![file_id, time / 3600, watched],
        )?;
    }
    Ok(finished && !was_watched)
}

/// Everything the watch-time page adds up (it groups by day, month... in local time itself).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchStats {
    /// (title id, hour since 1970, seconds watched in that hour)
    pub time: Vec<(i64, i64, f64)>,
    /// (title id, "episode" or "movie", when it was finished): finished by watching, not marked by hand.
    pub finished: Vec<(i64, String, i64)>,
}

pub fn stats(conn: &Connection) -> rusqlite::Result<WatchStats> {
    let mut stmt = conn.prepare(
        "SELECT f.title_id, l.hour, SUM(l.seconds) FROM watch_log l JOIN files f ON f.id = l.file_id
         GROUP BY f.title_id, l.hour",
    )?;
    let time = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<rusqlite::Result<_>>()?;
    let mut stmt = conn.prepare(
        "SELECT f.title_id, f.role, w.updated_at FROM watch w JOIN files f ON f.id = w.file_id
         WHERE w.watched = 1 AND w.duration > 0 AND f.role IN ('episode', 'movie')",
    )?;
    let finished = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<rusqlite::Result<_>>()?;
    Ok(WatchStats { time, finished })
}

/// A season (or a whole show) finished by watching its last unwatched episode.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finished {
    pub title_id: i64,
    pub title_name: String,
    /// "Season 2", "Specials", an arc's name...
    pub season: String,
    /// Every episode of the show is watched now.
    pub show_done: bool,
}

/// After `file_id` became watched: did that complete its season (and maybe the show)?
pub fn finished_season(conn: &Connection, file_id: i64) -> rusqlite::Result<Option<Finished>> {
    let row = conn
        .query_row(
            "SELECT f.title_id, t.name, f.season_id, s.label FROM files f
             JOIN titles t ON t.id = f.title_id JOIN seasons s ON s.id = f.season_id
             WHERE f.id = ?1 AND f.role = 'episode'",
            [file_id],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?, r.get::<_, String>(3)?)),
        )
        .optional()?;
    let Some((title_id, title_name, season_id, season)) = row else { return Ok(None) };
    let unwatched = |filter: &str, id: i64| -> rusqlite::Result<i64> {
        conn.query_row(
            &format!(
                "SELECT COUNT(*) FROM files f LEFT JOIN watch w ON w.file_id = f.id
                 WHERE {filter} = ?1 AND f.present = 1 AND f.role = 'episode' AND COALESCE(w.watched, 0) = 0"
            ),
            [id],
            |r| r.get(0),
        )
    };
    if unwatched("f.season_id", season_id)? > 0 {
        return Ok(None);
    }
    let show_done = unwatched("f.title_id", title_id)? == 0;
    Ok(Some(Finished { title_id, title_name, season, show_done }))
}

/// Marks files as watched or not (by hand). Either way they start from the beginning next time.
pub fn set_watched(conn: &mut Connection, file_ids: &[i64], watched: bool) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    {
        let mut stmt = tx.prepare(
            "INSERT INTO watch (file_id, position, duration, watched, updated_at) VALUES (?1, 0, 0, ?2, ?3)
             ON CONFLICT (file_id) DO UPDATE SET position = 0, watched = ?2, updated_at = ?3",
        )?;
        let time = now();
        for id in file_ids {
            stmt.execute(params![id, watched, time])?;
        }
    }
    tx.commit()
}

pub fn hide_from_continue(conn: &Connection, title_id: i64) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO continue_hidden (title_id, hidden_at) VALUES (?1, ?2)",
        params![title_id, now()],
    )?;
    Ok(())
}

/// Marks every episode and movie of a title as watched or not.
pub fn set_title_watched(conn: &mut Connection, title_id: i64, watched: bool) -> rusqlite::Result<()> {
    let ids: Vec<i64> = {
        let mut stmt =
            conn.prepare("SELECT id FROM files WHERE title_id = ?1 AND present = 1 AND role IN ('episode', 'movie')")?;
        let ids = stmt.query_map([title_id], |r| r.get(0))?.collect::<rusqlite::Result<_>>()?;
        ids
    };
    set_watched(conn, &ids, watched)
}

/// Number of watched files (episodes and movies) per title.
pub fn watched_counts(conn: &Connection) -> rusqlite::Result<HashMap<i64, i64>> {
    let mut stmt = conn.prepare(
        "SELECT f.title_id, COUNT(*) FROM watch w JOIN files f ON f.id = w.file_id
         WHERE w.watched = 1 AND f.present = 1 AND f.role IN ('episode', 'movie') GROUP BY f.title_id",
    )?;
    let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rows.collect()
}

pub fn play_item(conn: &Connection, images: &Path, file_id: i64) -> rusqlite::Result<Option<PlayItem>> {
    let item = conn
        .query_row(
            "SELECT f.id, f.title_id, t.name, f.path, f.role, s.number, f.episode, f.episode_end,
                    COALESCE(f.name, fm.name), COALESCE(fm.thumb, tm.banner, tm.cover)
             FROM files f JOIN titles t ON t.id = f.title_id
             LEFT JOIN seasons s ON s.id = f.season_id
             LEFT JOIN file_meta fm ON fm.file_id = f.id
             LEFT JOIN title_meta tm ON tm.title_id = f.title_id
             WHERE f.id = ?1",
            [file_id],
            |r| {
                Ok(PlayItem {
                    file_id: r.get(0)?,
                    title_id: r.get(1)?,
                    title_name: r.get(2)?,
                    path: r.get(3)?,
                    role: r.get(4)?,
                    season_number: r.get(5)?,
                    episode: r.get(6)?,
                    episode_end: r.get(7)?,
                    name: r.get(8)?,
                    image: r.get::<_, Option<String>>(9)?.map(|n| images.join(n).to_string_lossy().into_owned()),
                    resume: None,
                    duration: None,
                })
            },
        )
        .optional()?;
    let Some(mut item) = item else { return Ok(None) };
    if let Some(p) = progress(conn, file_id)? {
        item.resume = p.resume_at();
        item.duration = (p.duration > 0.0).then_some(p.duration);
    }
    Ok(Some(item))
}

/// The episode after this one: the next in the show's order, staying among the regular
/// episodes (or among the specials, when watching those).
pub fn next_file(conn: &Connection, file_id: i64) -> rusqlite::Result<Option<i64>> {
    let Some((title_id, special, role)): Option<(i64, bool, String)> = conn
        .query_row(
            "SELECT f.title_id, COALESCE(s.number = 0, 0), f.role
             FROM files f LEFT JOIN seasons s ON s.id = f.season_id WHERE f.id = ?1",
            [file_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?
    else {
        return Ok(None);
    };
    if role != "episode" {
        return Ok(None);
    }
    let order = episode_order(conn, title_id)?;
    let same_kind: Vec<i64> = order.iter().filter(|(_, s)| *s == special).map(|(id, _)| *id).collect();
    Ok(same_kind.iter().position(|id| *id == file_id).and_then(|i| same_kind.get(i + 1).copied()))
}

/// A title's episodes in viewing order, each with "is a special".
fn episode_order(conn: &Connection, title_id: i64) -> rusqlite::Result<Vec<(i64, bool)>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, COALESCE(s.number = 0, 0) FROM files f LEFT JOIN seasons s ON s.id = f.season_id
         WHERE f.title_id = ?1 AND f.present = 1 AND f.role = 'episode'
         ORDER BY COALESCE(s.number = 0, 0), s.sort, f.sort",
    )?;
    let rows = stmt.query_map([title_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rows.collect()
}

/// One entry per show: the episode or movie stopped part-way, or else the next unwatched
/// episode after the last one finished (or the one only just started). Most recent first.
pub fn continue_watching(conn: &Connection, images: &Path) -> rusqlite::Result<Vec<ContinueItem>> {
    // The latest activity of each title (on files that are still there).
    let mut stmt = conn.prepare(
        "SELECT f.title_id, w.file_id, w.updated_at FROM watch w
         JOIN files f ON f.id = w.file_id JOIN titles t ON t.id = f.title_id
         WHERE f.present = 1 AND t.present = 1 AND f.role IN ('episode', 'movie')
         ORDER BY w.updated_at DESC, w.file_id DESC",
    )?;
    let rows: Vec<(i64, i64, i64)> =
        stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<rusqlite::Result<_>>()?;

    let hidden: HashMap<i64, i64> = {
        let mut stmt = conn.prepare("SELECT title_id, hidden_at FROM continue_hidden")?;
        let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<rusqlite::Result<_>>()?;
        rows
    };

    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for (title_id, file_id, updated_at) in rows {
        if !seen.insert(title_id) || hidden.get(&title_id).is_some_and(|at| *at >= updated_at) {
            continue;
        }
        let Some(progress) = progress(conn, file_id)? else { continue };
        let entry = if progress.resume_at().is_some() {
            play_item(conn, images, file_id)?.map(|item| (item, "resume"))
        } else if progress.watched {
            next_unwatched(conn, file_id)?
                .map(|next| play_item(conn, images, next))
                .transpose()?
                .flatten()
                .map(|item| (item, "next"))
        } else {
            // Opened but left within the first moments: it's still the one up next.
            play_item(conn, images, file_id)?.map(|item| (item, "next"))
        };
        if let Some((item, reason)) = entry {
            out.push(ContinueItem { item, reason, updated_at });
            if out.len() >= CONTINUE_LIMIT {
                break;
            }
        }
    }
    Ok(out)
}

fn next_unwatched(conn: &Connection, file_id: i64) -> rusqlite::Result<Option<i64>> {
    let mut current = file_id;
    while let Some(next) = next_file(conn, current)? {
        if !progress(conn, next)?.is_some_and(|p| p.watched) {
            return Ok(Some(next));
        }
        current = next;
    }
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::db;

    fn setup() -> Connection {
        let conn = db::open(Path::new(":memory:")).unwrap();
        conn.execute_batch(
            "INSERT INTO libraries (id, path, kind) VALUES (1, 'X:', 'anime');
             INSERT INTO titles (id, library_id, key, is_movie, name, folder, added_at) VALUES (1, 1, 'show', 0, 'Show', 'X:\\Show', 0);
             INSERT INTO seasons (id, title_id, key, number, label, sort) VALUES (10, 1, 's0', 0, 'Specials', 0);
             INSERT INTO seasons (id, title_id, key, number, label, sort) VALUES (11, 1, 's1', 1, 'Season 1', 1);
             INSERT INTO seasons (id, title_id, key, number, label, sort) VALUES (12, 1, 's2', 2, 'Season 2', 2);
             INSERT INTO files (id, library_id, title_id, season_id, path, size, mtime, role, episode, sort, added_at) VALUES
               (100, 1, 1, 10, 'sp1', 0, 0, 'episode', 1, 0, 0),
               (101, 1, 1, 11, 'e1', 0, 0, 'episode', 1, 1, 0),
               (102, 1, 1, 11, 'e2', 0, 0, 'episode', 2, 2, 0),
               (103, 1, 1, 12, 'e3', 0, 0, 'episode', 1, 3, 0);",
        )
        .unwrap();
        conn
    }

    #[test]
    fn next_episode_stays_among_regular_episodes() {
        let conn = setup();
        assert_eq!(next_file(&conn, 101).unwrap(), Some(102));
        assert_eq!(next_file(&conn, 102).unwrap(), Some(103));
        assert_eq!(next_file(&conn, 103).unwrap(), None);
        assert_eq!(next_file(&conn, 100).unwrap(), None);
    }

    #[test]
    fn continue_watching_resumes_or_moves_on() {
        let mut conn = setup();
        let images = Path::new("img");
        assert!(continue_watching(&conn, images).unwrap().is_empty());

        // Stopped part-way: resume there.
        assert!(!save_progress(&conn, 101, 300.0, 1400.0).unwrap());
        let list = continue_watching(&conn, images).unwrap();
        assert_eq!((list[0].item.file_id, list[0].reason, list[0].item.resume), (101, "resume", Some(300.0)));

        // Finished: the next episode is up.
        assert!(save_progress(&conn, 101, 1350.0, 1400.0).unwrap());
        let list = continue_watching(&conn, images).unwrap();
        assert_eq!((list[0].item.file_id, list[0].reason), (102, "next"));

        // Only just started the next one: still offered as up next.
        save_progress(&conn, 102, 5.0, 1400.0).unwrap();
        let list = continue_watching(&conn, images).unwrap();
        assert_eq!((list[0].item.file_id, list[0].reason, list[0].item.resume), (102, "next", None));

        // Next one already watched by hand: skip past it.
        set_watched(&mut conn, &[102], true).unwrap();
        conn.execute("UPDATE watch SET updated_at = 0 WHERE file_id = 102", []).unwrap();
        assert_eq!(continue_watching(&conn, images).unwrap()[0].item.file_id, 103);

        // Removed by hand: gone until something of it is watched again.
        hide_from_continue(&conn, 1).unwrap();
        assert!(continue_watching(&conn, images).unwrap().is_empty());
        conn.execute("UPDATE continue_hidden SET hidden_at = hidden_at - 10", []).unwrap();
        assert_eq!(continue_watching(&conn, images).unwrap()[0].item.file_id, 103);

        // Everything watched: the show drops off the list.
        set_watched(&mut conn, &[103], true).unwrap();
        assert!(continue_watching(&conn, images).unwrap().is_empty());
    }

    #[test]
    fn watch_time_counts_playing_but_not_jumps() {
        let conn = setup();
        let logged = || -> f64 { conn.query_row("SELECT COALESCE(SUM(seconds), 0) FROM watch_log", [], |r| r.get(0)).unwrap() };
        save_progress(&conn, 101, 5.0, 1400.0).unwrap();
        assert_eq!(logged(), 5.0);
        // Five seconds later, five seconds further.
        conn.execute("UPDATE watch SET updated_at = updated_at - 5", []).unwrap();
        save_progress(&conn, 101, 10.0, 1400.0).unwrap();
        assert_eq!(logged(), 10.0);
        // A jump of ten minutes in five seconds isn't watching.
        conn.execute("UPDATE watch SET updated_at = updated_at - 5", []).unwrap();
        save_progress(&conn, 101, 610.0, 1400.0).unwrap();
        assert_eq!(logged(), 10.0);
        // Going back neither.
        save_progress(&conn, 101, 0.0, 1400.0).unwrap();
        assert_eq!(logged(), 10.0);
        let s = stats(&conn).unwrap();
        assert_eq!(s.time.len(), 1);
    }

    #[test]
    fn finishing_the_last_episode_of_a_season() {
        let conn = setup();
        save_progress(&conn, 101, 1350.0, 1400.0).unwrap();
        assert!(finished_season(&conn, 101).unwrap().is_none());
        save_progress(&conn, 102, 1350.0, 1400.0).unwrap();
        let done = finished_season(&conn, 102).unwrap().unwrap();
        assert_eq!((done.season.as_str(), done.show_done), ("Season 1", false));
        save_progress(&conn, 100, 1350.0, 1400.0).unwrap();
        save_progress(&conn, 103, 1350.0, 1400.0).unwrap();
        let done = finished_season(&conn, 103).unwrap().unwrap();
        assert_eq!((done.season.as_str(), done.show_done), ("Season 2", true));
    }
}
