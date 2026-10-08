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

const SCHEMA_VERSION: i32 = 9;

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

/// Metadata from AniList/TMDB. `provider_id` NULL means "looked, found nothing".
/// `locked` rows were chosen by hand and are never replaced automatically.
/// Image columns hold file names inside the images folder.
const SCHEMA_V2: &str = "
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE provider_cache (
    provider   TEXT NOT NULL,
    id         TEXT NOT NULL,
    json       TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (provider, id)
);
CREATE TABLE title_meta (
    title_id    INTEGER PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL,
    provider_id TEXT,
    locked      INTEGER NOT NULL DEFAULT 0,
    name        TEXT,
    description TEXT,
    year        INTEGER,
    genres      TEXT,
    score       INTEGER,
    status      TEXT,
    studio      TEXT,
    color       TEXT,
    cover       TEXT,
    thumb       TEXT,
    banner      TEXT,
    updated_at  INTEGER NOT NULL
);
CREATE TABLE season_meta (
    season_id    INTEGER PRIMARY KEY REFERENCES seasons(id) ON DELETE CASCADE,
    provider_ids TEXT NOT NULL DEFAULT '[]',
    locked       INTEGER NOT NULL DEFAULT 0,
    name         TEXT,
    description  TEXT,
    year         INTEGER,
    score        INTEGER,
    cover        TEXT,
    thumb        TEXT,
    updated_at   INTEGER NOT NULL
);
CREATE TABLE file_meta (
    file_id          INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
    provider_id      TEXT,
    provider_episode INTEGER,
    locked           INTEGER NOT NULL DEFAULT 0,
    name             TEXT,
    description      TEXT,
    year             INTEGER,
    air_date         TEXT,
    cover            TEXT,
    thumb            TEXT,
    updated_at       INTEGER NOT NULL
);
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
    if version < 2 {
        conn.execute_batch(SCHEMA_V2)?;
    }
    if version < 3 {
        // Each title has its own kind, so "Anime" and "Movies" folders on one drive work.
        conn.execute_batch(
            "ALTER TABLE titles ADD COLUMN kind TEXT;
             UPDATE titles SET kind = (SELECT kind FROM libraries l WHERE l.id = titles.library_id);",
        )?;
    }
    if version < 4 {
        // tmdb_id: the TMDB show used for an anime's episode info.
        // details_at: when episode details (description, thumbnail) were last looked up.
        conn.execute_batch(
            "ALTER TABLE title_meta ADD COLUMN tmdb_id TEXT;
             ALTER TABLE file_meta ADD COLUMN details_at INTEGER;",
        )?;
    }
    if version < 5 {
        conn.execute_batch(super::watch::SCHEMA_V5)?;
    }
    if version < 6 {
        conn.execute_batch(super::watch::SCHEMA_V6)?;
    }
    if version < 7 {
        // Extras are listed under headings ("Season 15", "TV Shorts"), and a movie's extras
        // only on the movies tab. Filled in by the next scan.
        conn.execute_batch(
            "ALTER TABLE files ADD COLUMN extra_group TEXT;
             ALTER TABLE files ADD COLUMN extra_movie INTEGER NOT NULL DEFAULT 0;",
        )?;
    }
    if version < 8 {
        // My List: shows and movies saved for later.
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS my_list (
                 title_id INTEGER PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
                 added_at INTEGER NOT NULL
             );",
        )?;
    }
    if version < 9 {
        conn.execute_batch(super::watch::SCHEMA_V9)?;
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
    extra_group: Option<String>,
    extra_movie: bool,
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
            "SELECT path, id, title_id, season_id, size, mtime, role, episode, episode_end, name, year, sort, present,
                    extra_group, extra_movie
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
                    extra_group: r.get(13)?,
                    extra_movie: r.get(14)?,
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
                    "UPDATE titles SET parent_id = ?2, is_movie = ?3, name = ?4, year = ?5, folder = ?6, kind = ?7,
                         present = 1
                     WHERE id = ?1",
                    params![id, parent_id, title.is_movie, title.name, title.year, folder, title.kind.as_str()],
                )?;
                id
            }
            None => {
                tx.execute(
                    "INSERT INTO titles (library_id, key, parent_id, is_movie, name, year, folder, kind, added_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        library_id, title.key, parent_id, title.is_movie, title.name, title.year, folder,
                        title.kind.as_str(), now
                    ],
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
            let extra_group = file.extra.as_ref().and_then(|g| g.label.clone());
            let extra_movie = file.extra.as_ref().is_some_and(|g| g.movie);
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
                        && old.sort == file.sort
                        && old.extra_group == extra_group
                        && old.extra_movie == extra_movie;
                    if !same {
                        tx.execute(
                            "UPDATE files SET title_id = ?2, season_id = ?3, size = ?4, mtime = ?5, role = ?6,
                                 episode = ?7, episode_end = ?8, name = ?9, year = ?10, sort = ?11, present = 1,
                                 extra_group = ?12, extra_movie = ?13
                             WHERE id = ?1",
                            params![
                                old.id, title_id, season_id, file.size as i64, file.mtime, role,
                                file.episode, file.episode_end, file.name, file.year, file.sort, extra_group,
                                extra_movie
                            ],
                        )?;
                        if old.present { stats.updated += 1 } else { stats.added += 1 }
                    }
                }
                None => {
                    tx.execute(
                        "INSERT INTO files (library_id, title_id, season_id, path, size, mtime, role,
                                            episode, episode_end, name, year, sort, added_at, extra_group, extra_movie)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                        params![
                            library_id, title_id, season_id, path, file.size as i64, file.mtime, role,
                            file.episode, file.episode_end, file.name, file.year, file.sort, now, extra_group,
                            extra_movie
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

/// Turns a stored image file name into a full path the interface can load.
fn image_path(dir: &Path, name: Option<String>) -> Option<String> {
    name.map(|n| dir.join(n).to_string_lossy().into_owned())
}

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
    pub thumb: Option<String>,
    pub color: Option<String>,
    /// None = not looked up yet, Some(false) = looked up, nothing found.
    pub matched: Option<bool>,
    pub genres: Vec<String>,
    /// Full path of the wide artwork, if downloaded.
    pub banner: Option<String>,
    pub score: Option<i32>,
    /// Episodes and movies watched.
    pub watched: i64,
    /// Episodes and movies that are new (see `new_files`).
    pub new_count: i64,
    /// The title itself showed up recently.
    pub is_new: bool,
    /// When its newest file was added, and when something of it was last watched.
    pub added_at: i64,
    pub last_watched: Option<i64>,
    /// When it was put on My List (None = it isn't).
    pub listed_at: Option<i64>,
}

/// Things count as new for two weeks after they show up...
const NEW_FOR_SECONDS: i64 = 14 * 24 * 60 * 60;
/// ...unless they came with the library's first scan (a freshly added drive isn't all "new").
const FIRST_SCAN_SECONDS: i64 = 60 * 60;

/// Episodes and movies that are new and not started yet: (file id, title id).
pub fn new_files(conn: &Connection) -> rusqlite::Result<Vec<(i64, i64)>> {
    let mut stmt = conn.prepare(
        "WITH first_scan AS (SELECT library_id, MIN(added_at) AS at FROM files GROUP BY library_id)
         SELECT f.id, f.title_id FROM files f JOIN first_scan s ON s.library_id = f.library_id
         WHERE f.present = 1 AND f.role IN ('episode', 'movie')
           AND f.added_at > s.at + ?1 AND f.added_at > ?2
           AND NOT EXISTS (SELECT 1 FROM watch w WHERE w.file_id = f.id AND (w.watched = 1 OR w.position > 0))",
    )?;
    let rows = stmt.query_map(params![FIRST_SCAN_SECONDS, now() - NEW_FOR_SECONDS], |r| Ok((r.get(0)?, r.get(1)?)))?;
    rows.collect()
}

pub fn titles(conn: &Connection, images: &Path) -> rusqlite::Result<Vec<TitleSummary>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.library_id, COALESCE(t.kind, l.kind), t.parent_id, t.is_movie, t.name, COALESCE(t.year, m.year), l.online,
                (SELECT COUNT(DISTINCT f.season_id) FROM files f
                  WHERE f.title_id = t.id AND f.present = 1 AND f.role = 'episode'),
                (SELECT COUNT(*) FROM files f WHERE f.title_id = t.id AND f.present = 1 AND f.role = 'episode'),
                (SELECT COUNT(*) FROM files f WHERE f.title_id = t.id AND f.present = 1 AND f.role = 'movie'),
                (SELECT COUNT(*) FROM files f WHERE f.title_id = t.id AND f.present = 1 AND f.role = 'extra'),
                m.thumb, m.color, m.title_id IS NOT NULL, m.provider_id IS NOT NULL,
                m.genres, m.banner, m.score,
                (SELECT MAX(f.added_at) FROM files f WHERE f.title_id = t.id AND f.present = 1),
                (SELECT MAX(w.updated_at) FROM watch w JOIN files f ON f.id = w.file_id WHERE f.title_id = t.id),
                t.added_at > (SELECT MIN(f.added_at) FROM files f WHERE f.library_id = t.library_id) + ?1
                  AND t.added_at > ?2,
                (SELECT added_at FROM my_list WHERE title_id = t.id)
         FROM titles t JOIN libraries l ON l.id = t.library_id
         LEFT JOIN title_meta m ON m.title_id = t.id
         WHERE t.present = 1",
    )?;
    let watched = super::watch::watched_counts(conn)?;
    let mut new_counts: HashMap<i64, i64> = HashMap::new();
    for (_, title_id) in new_files(conn)? {
        *new_counts.entry(title_id).or_default() += 1;
    }
    let rows = stmt.query_map(params![FIRST_SCAN_SECONDS, now() - NEW_FOR_SECONDS], |r| {
        let looked_up: bool = r.get(14)?;
        let id: i64 = r.get(0)?;
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
            thumb: image_path(images, r.get(12)?),
            color: r.get(13)?,
            matched: if looked_up { Some(r.get(15)?) } else { None },
            genres: r.get::<_, Option<String>>(16)?.and_then(|g| serde_json::from_str(&g).ok()).unwrap_or_default(),
            banner: image_path(images, r.get(17)?),
            score: r.get(18)?,
            watched: watched.get(&id).copied().unwrap_or(0),
            new_count: new_counts.get(&id).copied().unwrap_or(0),
            added_at: r.get::<_, Option<i64>>(19)?.unwrap_or(0),
            last_watched: r.get(20)?,
            is_new: r.get::<_, Option<bool>>(21)?.unwrap_or(false),
            listed_at: r.get(22)?,
        })
    })?;
    rows.collect()
}

/// Information from AniList/TMDB about a title, season or file.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub provider: Option<String>,
    /// AniList/TMDB ids; empty = nothing found.
    pub provider_ids: Vec<String>,
    /// Chosen by hand.
    pub locked: bool,
    pub name: Option<String>,
    pub description: Option<String>,
    pub year: Option<i32>,
    pub score: Option<i32>,
    pub cover: Option<String>,
    pub thumb: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TitleMeta {
    #[serde(flatten)]
    pub base: Meta,
    pub genres: Vec<String>,
    pub status: Option<String>,
    pub studio: Option<String>,
    pub color: Option<String>,
    pub banner: Option<String>,
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
    pub meta: Option<Meta>,
    /// Episode number within the AniList entry in `meta.provider_ids[0]`.
    pub provider_episode: Option<i32>,
    pub progress: Option<super::watch::Progress>,
    pub is_new: bool,
    /// For extras: the heading it's listed under ("Season 15", "TV Shorts"), if any.
    pub extra_group: Option<String>,
    /// For extras: belongs to a movie (shown on the movies tab).
    pub extra_movie: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonRow {
    pub id: i64,
    pub number: Option<i32>,
    pub label: String,
    pub meta: Option<Meta>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TitleDetail {
    pub id: i64,
    pub kind: LibraryKind,
    pub name: String,
    pub year: Option<i32>,
    pub is_movie: bool,
    pub folder: String,
    pub meta: Option<TitleMeta>,
    pub seasons: Vec<SeasonRow>,
    pub files: Vec<FileRow>,
    /// When it was put on My List (None = it isn't).
    pub listed_at: Option<i64>,
}

pub fn title_detail(conn: &Connection, id: i64, images: &Path) -> rusqlite::Result<Option<TitleDetail>> {
    let head = conn
        .query_row(
            "SELECT t.name, t.year, t.is_movie, t.folder, COALESCE(t.kind, l.kind) FROM titles t
             JOIN libraries l ON l.id = t.library_id WHERE t.id = ?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get::<_, String>(4)?)),
        )
        .optional()?;
    let Some((name, year, is_movie, folder, kind)) = head else { return Ok(None) };
    let kind = LibraryKind::parse(&kind).unwrap_or(LibraryKind::Shows);

    let meta = conn
        .query_row(
            "SELECT provider, provider_id, locked, name, description, year, score, cover, thumb,
                    genres, status, studio, color, banner
             FROM title_meta WHERE title_id = ?1",
            [id],
            |r| {
                Ok(TitleMeta {
                    base: Meta {
                        provider: r.get(0)?,
                        provider_ids: r.get::<_, Option<String>>(1)?.into_iter().collect(),
                        locked: r.get(2)?,
                        name: r.get(3)?,
                        description: r.get(4)?,
                        year: r.get(5)?,
                        score: r.get(6)?,
                        cover: image_path(images, r.get(7)?),
                        thumb: image_path(images, r.get(8)?),
                    },
                    genres: r
                        .get::<_, Option<String>>(9)?
                        .and_then(|g| serde_json::from_str(&g).ok())
                        .unwrap_or_default(),
                    status: r.get(10)?,
                    studio: r.get(11)?,
                    color: r.get(12)?,
                    banner: image_path(images, r.get(13)?),
                })
            },
        )
        .optional()?;
    let provider = meta.as_ref().and_then(|m| m.base.provider.clone());

    // Specials go last, like on streaming services.
    let mut stmt = conn.prepare(
        "SELECT s.id, s.number, s.label,
                sm.season_id IS NOT NULL, sm.provider_ids, sm.locked, sm.name, sm.description, sm.year, sm.score,
                sm.cover, sm.thumb
         FROM seasons s LEFT JOIN season_meta sm ON sm.season_id = s.id
         WHERE s.title_id = ?1 AND s.present = 1
           AND EXISTS (SELECT 1 FROM files f WHERE f.season_id = s.id AND f.present = 1)
         ORDER BY s.number = 0, s.sort",
    )?;
    let seasons = stmt
        .query_map([id], |r| {
            let has_meta: bool = r.get(3)?;
            let meta = if has_meta {
                let ids: Vec<i64> =
                    r.get::<_, Option<String>>(4)?.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default();
                Some(Meta {
                    provider: provider.clone(),
                    provider_ids: ids.iter().map(i64::to_string).collect(),
                    locked: r.get(5)?,
                    name: r.get(6)?,
                    description: r.get(7)?,
                    year: r.get(8)?,
                    score: r.get(9)?,
                    cover: image_path(images, r.get(10)?),
                    thumb: image_path(images, r.get(11)?),
                })
            } else {
                None
            };
            Ok(SeasonRow { id: r.get(0)?, number: r.get(1)?, label: r.get(2)?, meta })
        })?
        .collect::<rusqlite::Result<_>>()?;

    let progress = super::watch::progress_for_title(conn, id)?;
    let new: HashSet<i64> = new_files(conn)?.into_iter().filter(|(_, t)| *t == id).map(|(f, _)| f).collect();
    let mut stmt = conn.prepare(
        "SELECT f.id, f.path, f.role, f.season_id, f.episode, f.episode_end, f.name, f.year, f.size,
                fm.file_id IS NOT NULL, fm.provider_id, fm.locked, fm.name, fm.description, fm.year,
                fm.cover, fm.thumb, fm.provider_episode, f.extra_group, f.extra_movie
         FROM files f LEFT JOIN file_meta fm ON fm.file_id = f.id
         WHERE f.title_id = ?1 AND f.present = 1 ORDER BY f.sort",
    )?;
    let files = stmt
        .query_map([id], |r| {
            let has_meta: bool = r.get(9)?;
            let meta = if has_meta {
                Some(Meta {
                    provider: provider.clone(),
                    provider_ids: r.get::<_, Option<String>>(10)?.into_iter().collect(),
                    locked: r.get(11)?,
                    name: r.get(12)?,
                    description: r.get(13)?,
                    year: r.get(14)?,
                    score: None,
                    cover: image_path(images, r.get(15)?),
                    thumb: image_path(images, r.get(16)?),
                })
            } else {
                None
            };
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
                meta,
                provider_episode: r.get(17)?,
                progress: progress.get(&r.get::<_, i64>(0)?).cloned(),
                is_new: new.contains(&r.get::<_, i64>(0)?),
                extra_group: r.get(18)?,
                extra_movie: r.get(19)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;

    let listed_at = conn.query_row("SELECT added_at FROM my_list WHERE title_id = ?1", [id], |r| r.get(0)).optional()?;
    Ok(Some(TitleDetail { id, kind, name, year, is_movie, folder, meta, seasons, files, listed_at }))
}

/// Puts a title on My List or takes it off.
pub fn set_listed(conn: &Connection, title_id: i64, on: bool) -> rusqlite::Result<()> {
    if on {
        conn.execute("INSERT OR IGNORE INTO my_list (title_id, added_at) VALUES (?1, ?2)", params![title_id, now()])?;
    } else {
        conn.execute("DELETE FROM my_list WHERE title_id = ?1", [title_id])?;
    }
    Ok(())
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
        let summary = &titles(&conn, &root).unwrap()[0];
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

#[cfg(test)]
mod category_tests {
    use super::*;
    use crate::library::scan::scan_library;
    use std::fs;

    #[test]
    fn drive_with_category_folders() {
        let root = std::env::temp_dir().join(format!("da-librarby-test-drive-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        for path in [
            "Anime/Show/Show S01/Show - S01E01 - One.mkv",
            "Cartoons/Toon/Toon S01/Toon - S01E01 - Pilot.mkv",
            "Mobies/Film (2020)/Film (2020).mkv",
        ] {
            let p = root.join(path);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(p, b"x").unwrap();
        }
        let mut conn = open(&root.join("test.db")).unwrap();
        let id = add_library(&conn, &root.to_string_lossy(), LibraryKind::Shows).unwrap();
        let scanned = scan_library(&root, LibraryKind::Shows).unwrap();
        apply_scan(&mut conn, id, &scanned).unwrap();

        let mut kinds: Vec<(String, LibraryKind, bool)> =
            titles(&conn, &root).unwrap().into_iter().map(|t| (t.name, t.kind, t.is_movie)).collect();
        kinds.sort_by(|a, b| a.0.cmp(&b.0));
        assert_eq!(
            kinds,
            [
                ("Film".to_string(), LibraryKind::Movies, true),
                ("Show".to_string(), LibraryKind::Anime, false),
                ("Toon".to_string(), LibraryKind::Shows, false),
            ]
        );
        drop(conn);
        let _ = fs::remove_dir_all(&root);
    }
}

/// An episode or movie found by search.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FoundFile {
    pub file_id: i64,
    pub title_id: i64,
    pub title_name: String,
    pub role: String,
    pub season_number: Option<i32>,
    pub episode: Option<f64>,
    pub episode_end: Option<f64>,
    pub name: Option<String>,
    pub thumb: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    /// Matching shows and movies (ids of `titles`), names starting with the search first.
    pub titles: Vec<i64>,
    pub files: Vec<FoundFile>,
}

/// Shows by their name (or the name AniList/TMDB knows them by), episodes and movies by
/// their title. Every word typed must appear.
pub fn search(conn: &Connection, images: &Path, query: &str) -> rusqlite::Result<SearchResults> {
    let words: Vec<String> =
        query.split_whitespace().take(6).map(|w| format!("%{}%", w.replace(['%', '_'], ""))).collect();
    if words.is_empty() {
        return Ok(SearchResults { titles: Vec::new(), files: Vec::new() });
    }
    let all = |column: &str| -> String {
        (1..=words.len()).map(|i| format!("{column} LIKE ?{i}")).collect::<Vec<_>>().join(" AND ")
    };
    let prefix = format!("{}%", query.trim().replace(['%', '_'], ""));

    let sql = format!(
        "SELECT t.id FROM titles t LEFT JOIN title_meta m ON m.title_id = t.id
         WHERE t.present = 1 AND (({}) OR ({}))
         ORDER BY t.name LIKE ?{} DESC, t.name",
        all("t.name"),
        all("COALESCE(m.name, '')"),
        words.len() + 1,
    );
    let mut stmt = conn.prepare(&sql)?;
    let titles = stmt
        .query_map(rusqlite::params_from_iter(words.iter().chain(std::iter::once(&prefix))), |r| r.get(0))?
        .collect::<rusqlite::Result<_>>()?;

    let sql = format!(
        "SELECT f.id, f.title_id, t.name, f.role, s.number, f.episode, f.episode_end, COALESCE(f.name, fm.name), fm.thumb
         FROM files f JOIN titles t ON t.id = f.title_id
         LEFT JOIN seasons s ON s.id = f.season_id LEFT JOIN file_meta fm ON fm.file_id = f.id
         WHERE f.present = 1 AND t.present = 1 AND f.role IN ('episode', 'movie') AND ({})
         ORDER BY t.name, f.sort LIMIT 60",
        all("(COALESCE(fm.name, '') || ' ' || COALESCE(f.name, ''))"),
    );
    let mut stmt = conn.prepare(&sql)?;
    let files = stmt
        .query_map(rusqlite::params_from_iter(words.iter()), |r| {
            Ok(FoundFile {
                file_id: r.get(0)?,
                title_id: r.get(1)?,
                title_name: r.get(2)?,
                role: r.get(3)?,
                season_number: r.get(4)?,
                episode: r.get(5)?,
                episode_end: r.get(6)?,
                name: r.get(7)?,
                thumb: image_path(images, r.get(8)?),
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    Ok(SearchResults { titles, files })
}
