//! Your ratings of shows, movies, seasons and episodes, and the "How was it?" notes for things just
//! finished. A rating is one score from 10 to 100 (1.0 to 10.0 out of 10, in tenths); the interface
//! shows it as stars, a score, thumbs, a tier or stickers, whichever style is chosen, so switching
//! styles never changes it.

use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, Connection};
use serde::Serialize;

use super::db::now;

pub const SCHEMA_V15: &str = "
CREATE TABLE IF NOT EXISTS ratings (
    kind     TEXT NOT NULL,
    item_id  INTEGER NOT NULL,
    score    INTEGER NOT NULL,
    rated_at INTEGER NOT NULL,
    PRIMARY KEY (kind, item_id)
);
CREATE TABLE IF NOT EXISTS rating_dismissed (
    kind    TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    PRIMARY KEY (kind, item_id)
);
";

/// What can be rated: a show or movie ("title"), a season, or an episode ("file").
pub const KINDS: [&str; 3] = ["title", "season", "file"];

/// Rates something (`score` 10..=100), or takes its rating away (None).
pub fn set_rating(conn: &Connection, kind: &str, id: i64, score: Option<i64>) -> rusqlite::Result<()> {
    match score {
        Some(score) => {
            conn.execute(
                "INSERT INTO ratings (kind, item_id, score, rated_at) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT (kind, item_id) DO UPDATE SET score = ?3, rated_at = ?4",
                params![kind, id, score.clamp(10, 100), now()],
            )?;
        }
        None => {
            conn.execute("DELETE FROM ratings WHERE kind = ?1 AND item_id = ?2", params![kind, id])?;
        }
    }
    Ok(())
}

/// Every rating of one kind, by id.
pub fn ratings(conn: &Connection, kind: &str) -> rusqlite::Result<HashMap<i64, i64>> {
    let mut stmt = conn.prepare("SELECT item_id, score FROM ratings WHERE kind = ?1")?;
    let rows = stmt.query_map([kind], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rows.collect()
}

/// A show, season or movie finished lately and not rated yet: "How was it?"
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RatingNote {
    /// "title" or "season".
    pub kind: String,
    pub id: i64,
    pub title_id: i64,
    pub name: String,
    /// The season's name, for a season.
    pub season: Option<String>,
    pub thumb: Option<String>,
    pub finished_at: i64,
}

/// How long after finishing something it's still asked about.
const ASK_FOR_SECONDS: i64 = 30 * 24 * 60 * 60;

/// Things finished by watching them to the end (all of a show's episodes watched, or a movie)
/// within the last month, not rated and not waved away; a season of a show with several, while the
/// show isn't finished. Latest first.
pub fn notes(conn: &Connection, images: &Path) -> rusqlite::Result<Vec<RatingNote>> {
    let since = now() - ASK_FOR_SECONDS;
    let mut found = Vec::new();
    let mut stmt = conn.prepare(
        "WITH done AS (
             SELECT t.id, t.name, m.thumb,
                    (SELECT MAX(v.ended_at) FROM viewings v JOIN files f ON f.id = v.file_id
                      WHERE f.title_id = t.id AND v.finished = 1) AS at
             FROM titles t LEFT JOIN title_meta m ON m.title_id = t.id
             WHERE t.present = 1
               AND EXISTS (SELECT 1 FROM files f WHERE f.title_id = t.id AND f.present = 1 AND f.role IN ('episode', 'movie'))
               AND NOT EXISTS (SELECT 1 FROM files f WHERE f.title_id = t.id AND f.present = 1 AND f.role IN ('episode', 'movie')
                               AND NOT EXISTS (SELECT 1 FROM watch w WHERE w.file_id = f.id AND w.watched = 1)))
         SELECT id, name, thumb, at FROM done
         WHERE at > ?1
           AND NOT EXISTS (SELECT 1 FROM ratings r WHERE r.kind = 'title' AND r.item_id = done.id)
           AND NOT EXISTS (SELECT 1 FROM rating_dismissed d WHERE d.kind = 'title' AND d.item_id = done.id)",
    )?;
    let titles = stmt.query_map([since], |r| {
        Ok(RatingNote {
            kind: "title".into(),
            id: r.get(0)?,
            title_id: r.get(0)?,
            name: r.get(1)?,
            season: None,
            thumb: image(images, r.get(2)?),
            finished_at: r.get(3)?,
        })
    })?;
    for note in titles {
        found.push(note?);
    }
    let mut stmt = conn.prepare(
        "WITH done AS (
             SELECT s.id, s.title_id, s.label, t.name, COALESCE(sm.thumb, m.thumb) AS thumb,
                    (SELECT MAX(v.ended_at) FROM viewings v JOIN files f ON f.id = v.file_id
                      WHERE f.season_id = s.id AND v.finished = 1) AS at
             FROM seasons s JOIN titles t ON t.id = s.title_id
             LEFT JOIN season_meta sm ON sm.season_id = s.id LEFT JOIN title_meta m ON m.title_id = t.id
             WHERE s.present = 1 AND t.present = 1
               AND EXISTS (SELECT 1 FROM files f WHERE f.season_id = s.id AND f.present = 1 AND f.role = 'episode')
               AND NOT EXISTS (SELECT 1 FROM files f WHERE f.season_id = s.id AND f.present = 1 AND f.role = 'episode'
                               AND NOT EXISTS (SELECT 1 FROM watch w WHERE w.file_id = f.id AND w.watched = 1))
               -- A show with several seasons, not all of it watched (that's asked about as a whole).
               AND (SELECT COUNT(DISTINCT f.season_id) FROM files f WHERE f.title_id = t.id AND f.present = 1 AND f.role = 'episode') > 1
               AND EXISTS (SELECT 1 FROM files f WHERE f.title_id = t.id AND f.present = 1 AND f.role IN ('episode', 'movie')
                           AND NOT EXISTS (SELECT 1 FROM watch w WHERE w.file_id = f.id AND w.watched = 1)))
         SELECT id, title_id, label, name, thumb, at FROM done
         WHERE at > ?1
           AND NOT EXISTS (SELECT 1 FROM ratings r WHERE r.kind = 'season' AND r.item_id = done.id)
           AND NOT EXISTS (SELECT 1 FROM rating_dismissed d WHERE d.kind = 'season' AND d.item_id = done.id)",
    )?;
    let seasons = stmt.query_map([since], |r| {
        Ok(RatingNote {
            kind: "season".into(),
            id: r.get(0)?,
            title_id: r.get(1)?,
            season: Some(r.get(2)?),
            name: r.get(3)?,
            thumb: image(images, r.get(4)?),
            finished_at: r.get(5)?,
        })
    })?;
    for note in seasons {
        found.push(note?);
    }
    found.sort_by(|a, b| b.finished_at.cmp(&a.finished_at));
    Ok(found)
}

/// "Not now": the note for it doesn't come back.
pub fn dismiss(conn: &Connection, kind: &str, id: i64) -> rusqlite::Result<()> {
    conn.execute("INSERT OR IGNORE INTO rating_dismissed (kind, item_id) VALUES (?1, ?2)", params![kind, id])?;
    Ok(())
}

fn image(dir: &Path, name: Option<String>) -> Option<String> {
    name.map(|n| dir.join(n).to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::db;

    #[test]
    fn ratings_and_notes() {
        let conn = db::open(Path::new(":memory:")).unwrap();
        let soon = now() - 3600;
        conn.execute_batch(&format!(
            "INSERT INTO libraries (id, path, kind) VALUES (1, 'X:', 'anime');
             INSERT INTO titles (id, library_id, key, is_movie, name, folder, added_at) VALUES (1, 1, 'show', 0, 'Show', 'X:\\Show', 0);
             INSERT INTO seasons (id, title_id, key, number, label, sort) VALUES (11, 1, 's1', 1, 'Season 1', 1);
             INSERT INTO seasons (id, title_id, key, number, label, sort) VALUES (12, 1, 's2', 2, 'Season 2', 2);
             INSERT INTO files (id, library_id, title_id, season_id, path, size, mtime, role, episode, sort, added_at) VALUES
               (101, 1, 1, 11, 'e1', 0, 0, 'episode', 1, 1, 0),
               (102, 1, 1, 12, 'e2', 0, 0, 'episode', 1, 2, 0);
             INSERT INTO watch (file_id, position, duration, watched, updated_at) VALUES (101, 1400, 1400, 1, {soon});
             INSERT INTO viewings (file_id, session, started_at, ended_at, seconds, position, duration, finished) VALUES (101, 1, {soon}, {soon}, 1400, 1400, 1400, 1);"
        ))
        .unwrap();
        // Season 1 finished, the show not: the season is asked about.
        let found = notes(&conn, Path::new("")).unwrap();
        assert_eq!(found.iter().map(|n| (n.kind.as_str(), n.id)).collect::<Vec<_>>(), [("season", 11)]);
        // Rated: no more note. Ratings stay between 1 and 10.
        set_rating(&conn, "season", 11, Some(87)).unwrap();
        assert!(notes(&conn, Path::new("")).unwrap().is_empty());
        set_rating(&conn, "title", 1, Some(500)).unwrap();
        assert_eq!(ratings(&conn, "title").unwrap()[&1], 100);
        set_rating(&conn, "title", 1, None).unwrap();
        // The whole show finished: asked about as a whole, not its season 2.
        conn.execute_batch(&format!(
            "INSERT INTO watch (file_id, position, duration, watched, updated_at) VALUES (102, 1400, 1400, 1, {soon});
             INSERT INTO viewings (file_id, session, started_at, ended_at, seconds, position, duration, finished) VALUES (102, 2, {soon}, {soon}, 1400, 1400, 1400, 1);"
        ))
        .unwrap();
        let found = notes(&conn, Path::new("")).unwrap();
        assert_eq!(found.iter().map(|n| (n.kind.as_str(), n.id)).collect::<Vec<_>>(), [("title", 1)]);
        dismiss(&conn, "title", 1).unwrap();
        assert!(notes(&conn, Path::new("")).unwrap().is_empty());
    }
}
