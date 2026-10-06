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
    let was_watched = progress(conn, file_id)?.is_some_and(|p| p.watched);
    let finished = duration > 0.0 && position >= duration * WATCHED_AT;
    conn.execute(
        "INSERT INTO watch (file_id, position, duration, watched, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (file_id) DO UPDATE SET position = ?2, duration = ?3, watched = watched OR ?4, updated_at = ?5",
        params![file_id, position.max(0.0), duration.max(0.0), finished, now()],
    )?;
    Ok(finished && !was_watched)
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

    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for (title_id, file_id, updated_at) in rows {
        if !seen.insert(title_id) {
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

        // Everything watched: the show drops off the list.
        set_watched(&mut conn, &[103], true).unwrap();
        assert!(continue_watching(&conn, images).unwrap().is_empty());
    }
}
