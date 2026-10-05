//! The library database (SQLite). Holds libraries, titles, seasons and files so the
//! app can show everything instantly on start, before any rescan.
//!
//! Nothing is deleted when files disappear: rows are marked `present = 0`, so
//! metadata and watch history survive a disconnected drive or a moved folder.

use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use super::scan::{LibraryKind, ScannedTitle};

const SCHEMA_VERSION: i32 = 1;

const SCHEMA_V1: &str = "
CREATE TABLE libraries (
    id        INTEGER PRIMARY KEY,
    path      TEXT NOT NULL UNIQUE,
    kind      TEXT NOT NULL,
    online    INTEGER NOT NULL DEFAULT 1,
    last_scan INTEGER
);
CREATE TABLE titles (
    id         INTEGER PRIMARY KEY,
    library_id INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    key        TEXT NOT NULL,
    parent_id  INTEGER REFERENCES titles(id) ON DELETE SET NULL,
    is_movie   INTEGER NOT NULL,
    name       TEXT NOT NULL,
    year       INTEGER,
    folder     TEXT NOT NULL,
    present    INTEGER NOT NULL DEFAULT 1,
    added_at   INTEGER NOT NULL,
    UNIQUE (library_id, key)
);
CREATE TABLE seasons (
    id       INTEGER PRIMARY KEY,
    title_id INTEGER NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    key      TEXT NOT NULL,
    number   INTEGER,
    label    TEXT NOT NULL,
    sort     REAL NOT NULL,
    present  INTEGER NOT NULL DEFAULT 1,
    UNIQUE (title_id, key)
);
CREATE TABLE files (
    id          INTEGER PRIMARY KEY,
    library_id  INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
    title_id    INTEGER NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    season_id   INTEGER REFERENCES seasons(id) ON DELETE SET NULL,
    path        TEXT NOT NULL UNIQUE,
    size        INTEGER NOT NULL,
    mtime       INTEGER NOT NULL,
    role        TEXT NOT NULL,
    episode     REAL,
    episode_end REAL,
    name        TEXT,
    year        INTEGER,
    sort        INTEGER NOT NULL,
    present     INTEGER NOT NULL DEFAULT 1,
    added_at    INTEGER NOT NULL
);
CREATE INDEX files_title ON files (title_id, present);
CREATE INDEX files_season ON files (season_id);
CREATE INDEX titles_library ON titles (library_id);
";

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;",
    )?;
    let version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version < 1 {
        conn.execute_batch(SCHEMA_V1)?;
    }
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    Ok(conn)
}

pub fn now() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs() as i64)
}

// ---------------------------------------------------------------------------------------------
// Libraries

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Library {
    pub id: i64,
    pub path: String,
    pub kind: LibraryKind,
    pub online: bool,
    pub last_scan: Option<i64>,
    pub title_count: i64,
}

pub fn libraries(conn: &Connection) -> rusqlite::Result<Vec<Library>> {
    let mut stmt = conn.prepare(
        "SELECT l.id, l.path, l.kind, l.online, l.last_scan,
                (SELECT COUNT(*) FROM titles t WHERE t.library_id = l.id AND t.present = 1)
         FROM libraries l ORDER BY l.path",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(Library {
            id: r.get(0)?,
            path: r.get(1)?,
            kind: LibraryKind::parse(&r.get::<_, String>(2)?).unwrap_or(LibraryKind::Shows),
            online: r.get(3)?,
            last_scan: r.get(4)?,
            title_count: r.get(5)?,
        })
    })?;
    rows.collect()
}

pub fn library(conn: &Connection, id: i64) -> rusqlite::Result<Option<Library>> {
    Ok(libraries(conn)?.into_iter().find(|l| l.id == id))
}

pub fn add_library(conn: &Connection, path: &str, kind: LibraryKind) -> rusqlite::Result<i64> {
    conn.execute("INSERT INTO libraries (path, kind) VALUES (?1, ?2)", params![path, kind.as_str()])?;
    Ok(conn.last_insert_rowid())
}

pub fn remove_library(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM libraries WHERE id = ?1", [id])?;
    Ok(())
}

pub fn set_online(conn: &Connection, id: i64, online: bool) -> rusqlite::Result<()> {
    conn.execute("UPDATE libraries SET online = ?2 WHERE id = ?1", params![id, online])?;
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Applying a scan

#[derive(Debug, Default, Clone, Copy, Serialize)]
pub struct ScanStats {
    pub added: usize,
    pub updated: usize,
    pub removed: usize,
}

impl ScanStats {
    pub fn changed(&self) -> bool {
        self.added + self.updated + self.removed > 0
    }
}

struct ExistingFile {
    id: i64,
    title_id: i64,
    season_id: Option<i64>,
    size: i64,
    mtime: i64,
    role: String,
    episode: Option<f64>,
    episode_end: Option<f64>,
    name: Option<String>,
    year: Option<i32>,
    sort: i64,
    present: bool,
}

/// Brings the database in line with a fresh scan of one library, touching only what changed.
pub fn apply_scan(conn: &mut Connection, library_id: i64, titles: &[ScannedTitle]) -> rusqlite::Result<ScanStats> {
    let tx = conn.transaction()?;
    let now = now();
    let mut stats = ScanStats::default();

    let existing_titles: HashMap<String, i64> = {
        let mut stmt = tx.prepare("SELECT key, id FROM titles WHERE library_id = ?1")?;
        let rows = stmt.query_map([library_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
        rows.collect::<rusqlite::Result<_>>()?
    };
    let existing_files: HashMap<String, ExistingFile> = {
        let mut stmt = tx.prepare(
            "SELECT path, id, title_id, season_id, size, mtime, role, episode, episode_end, name, year, sort, present
             FROM files WHERE library_id = ?1",
        )?;
        let rows = stmt.query_map([library_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                ExistingFile {
                    id: r.get(1)?,
                    title_id: r.get(2)?,
                    season_id: r.get(3)?,
                    size: r.get(4)?,
                    mtime: r.get(5)?,
                    role: r.get(6)?,
                    episode: r.get(7)?,
                    episode_end: r.get(8)?,
                    name: r.get(9)?,
                    year: r.get(10)?,
                    sort: r.get(11)?,
                    present: r.get(12)?,
                },
            ))
        })?;
        rows.collect::<rusqlite::Result<_>>()?
    };

    let mut title_ids: HashMap<&str, i64> = HashMap::new();
    let mut seen_titles = HashSet::new();
    let mut seen_files = HashSet::new();

    for title in titles {
        let parent_id = title.parent_key.as_deref().and_then(|k| title_ids.get(k).copied());
        let folder = title.folder.to_string_lossy();
        let title_id = match existing_titles.get(&title.key) {
            Some(&id) => {
                tx.execute(
                    "UPDATE titles SET parent_id = ?2, is_movie = ?3, name = ?4, year = ?5, folder = ?6, present = 1
                     WHERE id = ?1",
                    params![id, parent_id, title.is_movie, title.name, title.year, folder],
                )?;
                id
            }
            None => {
                tx.execute(
                    "INSERT INTO titles (library_id, key, parent_id, is_movie, name, year, folder, added_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![library_id, title.key, parent_id, title.is_movie, title.name, title.year, folder, now],
                )?;
                tx.last_insert_rowid()
            }
        };
        title_ids.insert(&title.key, title_id);
        seen_titles.insert(title_id);

        // Seasons, matched by their stable key.
        let mut season_ids = Vec::with_capacity(title.seasons.len());
        for season in &title.seasons {
            tx.execute(
                "INSERT INTO seasons (title_id, key, number, label, sort) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT (title_id, key) DO UPDATE SET number = ?3, label = ?4, sort = ?5, present = 1",
                params![title_id, season.key, season.number, season.label, season.sort],
            )?;
            let id: i64 = tx.query_row(
                "SELECT id FROM seasons WHERE title_id = ?1 AND key = ?2",
                params![title_id, season.key],
                |r| r.get(0),
            )?;
            season_ids.push(id);
        }
        let keys: Vec<&str> = title.seasons.iter().map(|s| s.key.as_str()).collect();
        mark_missing_seasons(&tx, title_id, &keys)?;

        for file in &title.files {
            let path = file.path.to_string_lossy();
            let season_id = file.season.map(|i| season_ids[i]);
            let role = file.role.as_str();
            match existing_files.get(path.as_ref()) {
                Some(old) => {
                    seen_files.insert(old.id);
                    let same = old.present
                        && old.title_id == title_id
                        && old.season_id == season_id
                        && old.size == file.size as i64
                        && old.mtime == file.mtime
                        && old.role == role
                        && old.episode == file.episode
                        && old.episode_end == file.episode_end
                        && old.name == file.name
                        && old.year == file.year
                        && old.sort == file.sort;
                    if !same {
                        tx.execute(
                            "UPDATE files SET title_id = ?2, season_id = ?3, size = ?4, mtime = ?5, role = ?6,
                                 episode = ?7, episode_end = ?8, name = ?9, year = ?10, sort = ?11, present = 1
                             WHERE id = ?1",
                            params![
                                old.id, title_id, season_id, file.size as i64, file.mtime, role,
                                file.episode, file.episode_end, file.name, file.year, file.sort
                            ],
                        )?;
                        if old.present { stats.updated += 1 } else { stats.added += 1 }
                    }
                }
                None => {
                    tx.execute(
                        "INSERT INTO files (library_id, title_id, season_id, path, size, mtime, role,
                                            episode, episode_end, name, year, sort, added_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                        params![
                            library_id, title_id, season_id, path, file.size as i64, file.mtime, role,
                            file.episode, file.episode_end, file.name, file.year, file.sort, now
                        ],
                    )?;
                    stats.added += 1;
                }
            }
        }
    }

    for old in existing_files.values() {
        if old.present && !seen_files.contains(&old.id) {
            tx.execute("UPDATE files SET present = 0 WHERE id = ?1", [old.id])?;
            stats.removed += 1;
        }
    }
    for &id in existing_titles.values() {
        if !seen_titles.contains(&id) {
            tx.execute("UPDATE titles SET present = 0 WHERE id = ?1", [id])?;
        }
    }
    tx.execute("UPDATE libraries SET online = 1, last_scan = ?2 WHERE id = ?1", params![library_id, now])?;
    tx.commit()?;
    Ok(stats)
}

fn mark_missing_seasons(conn: &Connection, title_id: i64, keep: &[&str]) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare("SELECT id, key FROM seasons WHERE title_id = ?1 AND present = 1")?;
    let rows: Vec<(i64, String)> =
        stmt.query_map([title_id], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<rusqlite::Result<_>>()?;
    for (id, key) in rows {
        if !keep.contains(&key.as_str()) {
            conn.execute("UPDATE seasons SET present = 0 WHERE id = ?1", [id])?;
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Reading for the interface

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TitleSummary {
    pub id: i64,
    pub library_id: i64,
    pub kind: LibraryKind,
    pub parent_id: Option<i64>,
    pub is_movie: bool,
    pub name: String,
    pub year: Option<i32>,
    pub online: bool,
    pub seasons: i64,
    pub episodes: i64,
    pub movies: i64,
    pub extras: i64,
}

pub fn titles(conn: &Connection) -> rusqlite::Result<Vec<TitleSummary>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.library_id, l.kind, t.parent_id, t.is_movie, t.name, t.year, l.online,
                (SELECT COUNT(DISTINCT f.season_id) FROM files f
                  WHERE f.title_id = t.id AND f.present = 1 AND f.role = 'episode'),
                (SELECT COUNT(*) FROM files f WHERE f.title_id = t.id AND f.present = 1 AND f.role = 'episode'),
                (SELECT COUNT(*) FROM files f WHERE f.title_id = t.id AND f.present = 1 AND f.role = 'movie'),
                (SELECT COUNT(*) FROM files f WHERE f.title_id = t.id AND f.present = 1 AND f.role = 'extra')
         FROM titles t JOIN libraries l ON l.id = t.library_id
         WHERE t.present = 1",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(TitleSummary {
            id: r.get(0)?,
            library_id: r.get(1)?,
            kind: LibraryKind::parse(&r.get::<_, String>(2)?).unwrap_or(LibraryKind::Shows),
            parent_id: r.get(3)?,
            is_movie: r.get(4)?,
            name: r.get(5)?,
            year: r.get(6)?,
            online: r.get(7)?,
            seasons: r.get(8)?,
            episodes: r.get(9)?,
            movies: r.get(10)?,
            extras: r.get(11)?,
        })
    })?;
    rows.collect()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRow {
    pub id: i64,
    pub path: String,
    pub role: String,
    pub season_id: Option<i64>,
    pub episode: Option<f64>,
    pub episode_end: Option<f64>,
    pub name: Option<String>,
    pub year: Option<i32>,
    pub size: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonRow {
    pub id: i64,
    pub number: Option<i32>,
    pub label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TitleDetail {
    pub id: i64,
    pub name: String,
    pub year: Option<i32>,
    pub is_movie: bool,
    pub folder: String,
    pub seasons: Vec<SeasonRow>,
    pub files: Vec<FileRow>,
}

pub fn title_detail(conn: &Connection, id: i64) -> rusqlite::Result<Option<TitleDetail>> {
    let head = conn
        .query_row("SELECT name, year, is_movie, folder FROM titles WHERE id = ?1", [id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
        })
        .optional()?;
    let Some((name, year, is_movie, folder)) = head else { return Ok(None) };

    // Specials go last, like on streaming services.
    let mut stmt = conn.prepare(
        "SELECT s.id, s.number, s.label FROM seasons s
         WHERE s.title_id = ?1 AND s.present = 1
           AND EXISTS (SELECT 1 FROM files f WHERE f.season_id = s.id AND f.present = 1)
         ORDER BY s.number = 0, s.sort",
    )?;
    let seasons = stmt
        .query_map([id], |r| Ok(SeasonRow { id: r.get(0)?, number: r.get(1)?, label: r.get(2)? }))?
        .collect::<rusqlite::Result<_>>()?;

    let mut stmt = conn.prepare(
        "SELECT id, path, role, season_id, episode, episode_end, name, year, size FROM files
         WHERE title_id = ?1 AND present = 1 ORDER BY sort",
    )?;
    let files = stmt
        .query_map([id], |r| {
            Ok(FileRow {
                id: r.get(0)?,
                path: r.get(1)?,
                role: r.get(2)?,
                season_id: r.get(3)?,
                episode: r.get(4)?,
                episode_end: r.get(5)?,
                name: r.get(6)?,
                year: r.get(7)?,
                size: r.get(8)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;

    Ok(Some(TitleDetail { id, name, year, is_movie, folder, seasons, files }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::scan::scan_library;
    use std::fs;
    use std::path::PathBuf;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("da-librarby-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn touch(path: &Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, b"x").unwrap();
    }

    fn rescan(conn: &mut Connection, id: i64, root: &Path) -> ScanStats {
        let titles = scan_library(root, LibraryKind::Anime).unwrap();
        apply_scan(conn, id, &titles).unwrap()
    }

    #[test]
    fn rescans_only_record_changes() {
        let root = temp_dir("rescan");
        let show = root.join("Show").join("Show S01");
        touch(&show.join("Show - S01E01 - One.mkv"));
        touch(&show.join("Show - S01E02 - Two.mkv"));

        let mut conn = open(&root.join("test.db")).unwrap();
        let id = add_library(&conn, &root.to_string_lossy(), LibraryKind::Anime).unwrap();

        let first = rescan(&mut conn, id, &root);
        assert_eq!((first.added, first.updated, first.removed), (2, 0, 0));

        let again = rescan(&mut conn, id, &root);
        assert!(!again.changed(), "unchanged folders must not touch the database");

        touch(&show.join("Show - S01E03 - Three.mkv"));
        let added = rescan(&mut conn, id, &root);
        assert_eq!(added.added, 1);

        fs::remove_file(show.join("Show - S01E01 - One.mkv")).unwrap();
        let removed = rescan(&mut conn, id, &root);
        assert_eq!(removed.removed, 1);
        let summary = &titles(&conn).unwrap()[0];
        assert_eq!(summary.episodes, 2);

        // The row is kept (hidden), so it comes back with the same id if the file returns.
        let old_id: i64 = conn
            .query_row("SELECT id FROM files WHERE path LIKE '%E01%' AND present = 0", [], |r| r.get(0))
            .unwrap();
        touch(&show.join("Show - S01E01 - One.mkv"));
        rescan(&mut conn, id, &root);
        let new_id: i64 = conn
            .query_row("SELECT id FROM files WHERE path LIKE '%E01%' AND present = 1", [], |r| r.get(0))
            .unwrap();
        assert_eq!(old_id, new_id);

        // A missing library folder (disconnected drive) can't be scanned at all.
        assert!(scan_library(&root.join("not-there"), LibraryKind::Anime).is_err());

        drop(conn);
        let _ = fs::remove_dir_all(&root);
    }
}
