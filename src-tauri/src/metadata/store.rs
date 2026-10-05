//! Reading and writing metadata in the library database.

use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension};

use super::anilist::Media;
use super::anime_match::{EpisodeInput, Locked, MovieInput, SeasonInput, ShowInput, ShowMatch};
use super::images::SavedCover;
use crate::library::db::now;

/// Anime titles with something not yet looked up: a new show, a new season, a new episode or movie.
pub fn anime_titles_needing_work(conn: &Connection) -> rusqlite::Result<Vec<i64>> {
    let mut stmt = conn.prepare(
        "SELECT t.id FROM titles t JOIN libraries l ON l.id = t.library_id
         WHERE t.present = 1 AND l.kind = 'anime' AND (
             NOT EXISTS (SELECT 1 FROM title_meta m WHERE m.title_id = t.id)
             OR EXISTS (SELECT 1 FROM seasons s WHERE s.title_id = t.id AND s.present = 1
                        AND NOT EXISTS (SELECT 1 FROM season_meta sm WHERE sm.season_id = s.id))
             OR EXISTS (SELECT 1 FROM files f WHERE f.title_id = t.id AND f.present = 1
                        AND f.role IN ('episode', 'movie')
                        AND NOT EXISTS (SELECT 1 FROM file_meta fm WHERE fm.file_id = f.id)))
         ORDER BY t.name",
    )?;
    let ids = stmt.query_map([], |r| r.get(0))?.collect();
    ids
}

pub fn is_anime(conn: &Connection, title_id: i64) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT l.kind = 'anime' FROM titles t JOIN libraries l ON l.id = t.library_id WHERE t.id = ?1",
        [title_id],
        |r| r.get(0),
    )
    .optional()
    .map(|v| v.unwrap_or(false))
}

pub fn load_show_input(conn: &Connection, title_id: i64) -> rusqlite::Result<Option<ShowInput>> {
    let head = conn
        .query_row(
            "SELECT t.name, t.is_movie, m.locked, m.provider_id FROM titles t
             LEFT JOIN title_meta m ON m.title_id = t.id WHERE t.id = ?1",
            [title_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, bool>(1)?,
                    r.get::<_, Option<bool>>(2)?,
                    r.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .optional()?;
    let Some((name, is_movie, locked, provider_id)) = head else { return Ok(None) };
    let locked_root = locked_choice(locked, provider_id);

    let mut stmt = conn.prepare(
        "SELECT s.id, s.number, sm.locked, sm.provider_ids FROM seasons s
         LEFT JOIN season_meta sm ON sm.season_id = s.id
         WHERE s.title_id = ?1 AND s.present = 1 ORDER BY s.sort",
    )?;
    let mut seasons: Vec<SeasonInput> = stmt
        .query_map([title_id], |r| {
            let locked: Option<bool> = r.get(2)?;
            let ids: Option<String> = r.get(3)?;
            Ok(SeasonInput {
                id: r.get(0)?,
                number: r.get(1)?,
                locked: if locked == Some(true) {
                    Some(ids.and_then(|s| serde_json::from_str(&s).ok()).unwrap_or_default())
                } else {
                    None
                },
                episodes: Vec::new(),
            })
        })?
        .collect::<rusqlite::Result<_>>()?;

    let mut stmt = conn.prepare(
        "SELECT id, season_id, episode FROM files
         WHERE title_id = ?1 AND present = 1 AND role = 'episode' ORDER BY sort",
    )?;
    let rows: Vec<(i64, Option<i64>, Option<f64>)> =
        stmt.query_map([title_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<rusqlite::Result<_>>()?;
    for (file_id, season_id, episode) in rows {
        if let Some(season) = seasons.iter_mut().find(|s| Some(s.id) == season_id) {
            season.episodes.push(EpisodeInput { file_id, episode });
        }
    }

    let mut stmt = conn.prepare(
        "SELECT f.id, f.name, f.year, fm.locked, fm.provider_id FROM files f
         LEFT JOIN file_meta fm ON fm.file_id = f.id
         WHERE f.title_id = ?1 AND f.present = 1 AND f.role = 'movie' ORDER BY f.sort",
    )?;
    let movies = stmt
        .query_map([title_id], |r| {
            Ok(MovieInput {
                file_id: r.get(0)?,
                name: r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                year: r.get(2)?,
                locked: locked_choice(r.get(3)?, r.get(4)?),
            })
        })?
        .collect::<rusqlite::Result<_>>()?;

    Ok(Some(ShowInput { name, is_movie, locked_root, seasons, movies }))
}

fn locked_choice(locked: Option<bool>, provider_id: Option<String>) -> Locked {
    (locked == Some(true)).then(|| provider_id.and_then(|id| id.parse().ok()))
}

// ---------------------------------------------------------------------------------------------
// AniList response cache

pub fn cached_media(conn: &Connection, ids: &[i64]) -> rusqlite::Result<HashMap<i64, Media>> {
    let mut out = HashMap::new();
    let mut stmt = conn.prepare("SELECT json, fetched_at FROM provider_cache WHERE provider = 'anilist' AND id = ?1")?;
    for id in ids {
        let row: Option<(String, i64)> =
            stmt.query_row([id.to_string()], |r| Ok((r.get(0)?, r.get(1)?))).optional()?;
        let Some((json, fetched_at)) = row else { continue };
        let Ok(media) = serde_json::from_str::<Media>(&json) else { continue };
        // Finished shows don't change much; airing ones gain episodes.
        let max_age = if media.status.as_deref() == Some("FINISHED") { 30 * 86_400 } else { 2 * 86_400 };
        if now() - fetched_at < max_age {
            out.insert(*id, media);
        }
    }
    Ok(out)
}

pub fn store_media(conn: &Connection, media: &[Media]) -> rusqlite::Result<()> {
    let now = now();
    for m in media {
        let json = serde_json::to_string(m).unwrap_or_default();
        conn.execute(
            "INSERT OR REPLACE INTO provider_cache (provider, id, json, fetched_at) VALUES ('anilist', ?1, ?2, ?3)",
            params![m.id.to_string(), json, now],
        )?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------------------------
// Saving a match

/// Artwork saved for a match, by AniList id.
#[derive(Default)]
pub struct SavedArt {
    pub covers: HashMap<i64, SavedCover>,
    pub banner: Option<String>,
}

pub fn save_show_match(
    conn: &mut Connection,
    title_id: i64,
    input: &ShowInput,
    m: &ShowMatch,
    art: &SavedArt,
) -> rusqlite::Result<()> {
    let tx = conn.transaction()?;
    let now = now();
    let cover = |id: i64| art.covers.get(&id);

    let root = m.root.as_ref();
    let root_cover = root.and_then(|r| cover(r.id));
    tx.execute(
        "INSERT OR REPLACE INTO title_meta
           (title_id, provider, provider_id, locked, name, description, year, genres, score, status, studio,
            color, cover, thumb, banner, updated_at)
         VALUES (?1, 'anilist', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            title_id,
            root.map(|r| r.id.to_string()),
            input.locked_root.is_some(),
            root.map(Media::display_title),
            root.and_then(Media::plain_description),
            root.and_then(Media::year),
            root.map(|r| serde_json::to_string(&r.genres).unwrap_or_default()),
            root.and_then(|r| r.average_score),
            root.and_then(|r| r.status.clone()),
            root.and_then(|r| r.studios.as_ref()).and_then(|s| s.nodes.first()).map(|s| s.name.clone()),
            root.and_then(|r| r.cover_image.as_ref()).and_then(|c| c.color.clone()),
            root_cover.map(|c| c.cover.clone()),
            root_cover.map(|c| c.thumb.clone()),
            art.banner,
            now,
        ],
    )?;

    for season in &m.seasons {
        let first = season.entries.first();
        let ids: Vec<i64> = season.entries.iter().map(|e| e.id).collect();
        let c = first.and_then(|f| cover(f.id));
        tx.execute(
            "INSERT OR REPLACE INTO season_meta
               (season_id, provider_ids, locked, name, description, year, score, cover, thumb, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                season.season_id,
                serde_json::to_string(&ids).unwrap_or_else(|_| "[]".into()),
                season.locked,
                first.map(Media::display_title),
                first.and_then(Media::plain_description),
                first.and_then(Media::year),
                first.and_then(|f| f.average_score),
                c.map(|c| c.cover.clone()),
                c.map(|c| c.thumb.clone()),
                now,
            ],
        )?;
    }

    for ep in &m.episodes {
        tx.execute(
            "INSERT INTO file_meta (file_id, provider_id, provider_episode, updated_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (file_id) DO UPDATE SET provider_id = ?2, provider_episode = ?3, updated_at = ?4
             WHERE locked = 0",
            params![ep.file_id, ep.media_id.map(|id| id.to_string()), ep.episode, now],
        )?;
    }

    for movie in &m.movies {
        let media = movie.media.as_ref();
        let c = media.and_then(|x| cover(x.id));
        tx.execute(
            "INSERT OR REPLACE INTO file_meta
               (file_id, provider_id, locked, name, description, year, cover, thumb, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                movie.file_id,
                media.map(|x| x.id.to_string()),
                movie.locked,
                media.map(Media::display_title),
                media.and_then(Media::plain_description),
                media.and_then(Media::year),
                c.map(|c| c.cover.clone()),
                c.map(|c| c.thumb.clone()),
                now,
            ],
        )?;
    }

    tx.commit()
}

// ---------------------------------------------------------------------------------------------
// Fixing matches by hand

/// "auto" clears the hand-made choice, "none" says there's no match, "pick" uses `id`.
pub fn set_title_choice(conn: &Connection, title_id: i64, mode: &str, id: Option<i64>) -> rusqlite::Result<()> {
    clear_unlocked_children(conn, title_id)?;
    match mode {
        "auto" => {
            conn.execute("DELETE FROM title_meta WHERE title_id = ?1", [title_id])?;
        }
        _ => {
            let id = if mode == "pick" { id.map(|i| i.to_string()) } else { None };
            conn.execute(
                "INSERT OR REPLACE INTO title_meta (title_id, provider, provider_id, locked, updated_at)
                 VALUES (?1, 'anilist', ?2, 1, ?3)",
                params![title_id, id, now()],
            )?;
        }
    }
    Ok(())
}

/// Empty `ids` goes back to automatic matching for the season.
pub fn set_season_choice(conn: &Connection, season_id: i64, ids: &[i64]) -> rusqlite::Result<i64> {
    let title_id: i64 = conn.query_row("SELECT title_id FROM seasons WHERE id = ?1", [season_id], |r| r.get(0))?;
    if ids.is_empty() {
        conn.execute("DELETE FROM season_meta WHERE season_id = ?1", [season_id])?;
    } else {
        conn.execute(
            "INSERT OR REPLACE INTO season_meta (season_id, provider_ids, locked, updated_at) VALUES (?1, ?2, 1, ?3)",
            params![season_id, serde_json::to_string(ids).unwrap_or_default(), now()],
        )?;
    }
    conn.execute(
        "DELETE FROM file_meta WHERE locked = 0 AND file_id IN (SELECT id FROM files WHERE season_id = ?1)",
        [season_id],
    )?;
    Ok(title_id)
}

pub fn set_file_choice(conn: &Connection, file_id: i64, mode: &str, id: Option<i64>) -> rusqlite::Result<i64> {
    let title_id: i64 = conn.query_row("SELECT title_id FROM files WHERE id = ?1", [file_id], |r| r.get(0))?;
    match mode {
        "auto" => {
            conn.execute("DELETE FROM file_meta WHERE file_id = ?1", [file_id])?;
        }
        _ => {
            let id = if mode == "pick" { id.map(|i| i.to_string()) } else { None };
            conn.execute(
                "INSERT OR REPLACE INTO file_meta (file_id, provider_id, locked, updated_at) VALUES (?1, ?2, 1, ?3)",
                params![file_id, id, now()],
            )?;
        }
    }
    Ok(title_id)
}

fn clear_unlocked_children(conn: &Connection, title_id: i64) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM season_meta WHERE locked = 0 AND season_id IN (SELECT id FROM seasons WHERE title_id = ?1)",
        [title_id],
    )?;
    conn.execute(
        "DELETE FROM file_meta WHERE locked = 0 AND file_id IN (SELECT id FROM files WHERE title_id = ?1)",
        [title_id],
    )?;
    Ok(())
}

/// One-time tidy-up of descriptions saved before editor notes were stripped.
pub fn clean_saved_descriptions(conn: &mut Connection) -> rusqlite::Result<()> {
    if setting(conn, "descriptions_cleaned")?.is_some() {
        return Ok(());
    }
    let tx = conn.transaction()?;
    for (table, key) in [("title_meta", "title_id"), ("season_meta", "season_id"), ("file_meta", "file_id")] {
        let rows: Vec<(i64, String)> = {
            let mut stmt = tx.prepare(&format!("SELECT {key}, description FROM {table} WHERE description IS NOT NULL"))?;
            let rows = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<rusqlite::Result<_>>()?;
            rows
        };
        for (id, text) in rows {
            let cleaned = super::anilist::strip_editor_notes(&text);
            tx.execute(&format!("UPDATE {table} SET description = ?2 WHERE {key} = ?1"), params![id, cleaned])?;
        }
    }
    set_setting(&tx, "descriptions_cleaned", Some("1"))?;
    tx.commit()
}

// ---------------------------------------------------------------------------------------------
// Settings

pub fn setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0)).optional()
}

pub fn set_setting(conn: &Connection, key: &str, value: Option<&str>) -> rusqlite::Result<()> {
    match value {
        Some(v) => conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)", params![key, v])?,
        None => conn.execute("DELETE FROM settings WHERE key = ?1", [key])?,
    };
    Ok(())
}
