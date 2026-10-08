//! The media library: which folders to scan, the database of what's in them, and
//! background rescans.
//!
//! Events sent to the frontend:
//!   `library:scan`    { running, library }   while scans run / when they finish
//!   `library:changed` {}                     after a scan changed the database

pub mod db;
pub mod parse;
pub mod scan;
pub mod watch;
pub mod watcher;

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use scan::LibraryKind;

pub struct Library {
    db: Mutex<Connection>,
    queue: Mutex<ScanQueue>,
    /// Where downloaded artwork lives (kept out of the roaming profile).
    pub images_dir: PathBuf,
}

#[derive(Default)]
struct ScanQueue {
    running: bool,
    pending: BTreeSet<i64>,
}

impl Library {
    pub fn open(app: &AppHandle) -> Result<Self, String> {
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let conn = db::open(&dir.join("library.db")).map_err(|e| e.to_string())?;
        let images_dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?.join("images");
        Ok(Self { db: Mutex::new(conn), queue: Mutex::new(ScanQueue::default()), images_dir })
    }

    pub(crate) fn with_db<T>(&self, f: impl FnOnce(&mut Connection) -> rusqlite::Result<T>) -> Result<T, String> {
        let mut conn = self.db.lock().unwrap();
        f(&mut conn).map_err(|e| e.to_string())
    }
}

/// Queues libraries for a rescan (all of them if `ids` is None) and starts the
/// background scanner if it isn't already running.
pub fn request_scan(app: &AppHandle, ids: Option<Vec<i64>>) {
    let library = app.state::<Library>();
    let ids = match ids {
        Some(ids) => ids,
        None => match library.with_db(|c| db::libraries(c)) {
            Ok(libs) => libs.into_iter().map(|l| l.id).collect(),
            Err(_) => return,
        },
    };
    let start = {
        let mut queue = library.queue.lock().unwrap();
        queue.pending.extend(ids);
        !std::mem::replace(&mut queue.running, true)
    };
    if start {
        let app = app.clone();
        std::thread::Builder::new()
            .name("library-scan".into())
            .spawn(move || run_scans(app))
            .expect("failed to spawn library scan thread");
    }
}

fn run_scans(app: AppHandle) {
    let library = app.state::<Library>();
    loop {
        let next = {
            let mut queue = library.queue.lock().unwrap();
            let next = queue.pending.pop_first();
            if next.is_none() {
                queue.running = false;
            }
            next
        };
        let Some(id) = next else { break };
        let Ok(Some(lib)) = library.with_db(|c| db::library(c, id)) else { continue };
        let _ = app.emit("library:scan", json!({ "running": true, "library": lib.path }));

        // Reading the folders happens without holding the database, so the interface stays responsive.
        match scan::scan_library(Path::new(&lib.path), lib.kind) {
            Ok(titles) => match library.with_db(|c| db::apply_scan(c, id, &titles)) {
                Ok(stats) => {
                    if stats.changed() {
                        let _ = app.emit("library:changed", json!({}));
                    }
                }
                Err(e) => eprintln!("saving scan of {} failed: {e}", lib.path),
            },
            Err(_) => {
                // Drive disconnected or folder gone: keep everything, just mark it offline.
                if lib.online {
                    let _ = library.with_db(|c| db::set_online(c, id, false));
                    let _ = app.emit("library:changed", json!({}));
                }
            }
        }
    }
    let _ = app.emit("library:scan", json!({ "running": false, "library": null }));
    crate::metadata::request(&app, None);
}

// ---------------------------------------------------------------------------------------------
// Commands

#[tauri::command]
pub async fn library_list(library: State<'_, Library>) -> Result<Vec<db::Library>, String> {
    library.with_db(|c| db::libraries(c))
}

#[tauri::command]
pub async fn library_add(
    app: AppHandle,
    library: State<'_, Library>,
    path: String,
    kind: LibraryKind,
) -> Result<Vec<db::Library>, String> {
    let path = normalize(&path);
    if !Path::new(&path).is_dir() {
        return Err(format!("{path} is not a folder that can be opened."));
    }
    let existing = library.with_db(|c| db::libraries(c))?;
    for lib in &existing {
        if contains(&lib.path, &path) || contains(&path, &lib.path) {
            return Err(format!("{path} overlaps with the library folder {}.", lib.path));
        }
    }
    let id = library.with_db(|c| db::add_library(c, &path, kind))?;
    request_scan(&app, Some(vec![id]));
    library.with_db(|c| db::libraries(c))
}

#[tauri::command]
pub async fn library_remove(
    app: AppHandle,
    library: State<'_, Library>,
    id: i64,
) -> Result<Vec<db::Library>, String> {
    library.with_db(|c| db::remove_library(c, id))?;
    let _ = app.emit("library:changed", json!({}));
    library.with_db(|c| db::libraries(c))
}

/// The app came to the front: look for new files (at most once a minute).
#[tauri::command]
pub async fn library_focused(app: AppHandle) -> Result<(), String> {
    watcher::window_focused(&app);
    Ok(())
}

#[tauri::command]
pub async fn library_rescan(app: AppHandle) -> Result<(), String> {
    request_scan(&app, None);
    Ok(())
}

#[tauri::command]
pub async fn library_scanning(library: State<'_, Library>) -> Result<bool, String> {
    Ok(library.queue.lock().unwrap().running)
}

#[tauri::command]
pub async fn library_titles(library: State<'_, Library>) -> Result<Vec<db::TitleSummary>, String> {
    library.with_db(|c| db::titles(c, &library.images_dir))
}

#[tauri::command]
pub async fn library_title(library: State<'_, Library>, id: i64) -> Result<Option<db::TitleDetail>, String> {
    library.with_db(|c| db::title_detail(c, id, &library.images_dir))
}

/// Everything needed to play a file, including where it was stopped last time.
#[tauri::command]
pub async fn watch_item(library: State<'_, Library>, file_id: i64) -> Result<Option<watch::PlayItem>, String> {
    library.with_db(|c| watch::play_item(c, &library.images_dir, file_id))
}

/// The episode that plays after this one.
#[tauri::command]
pub async fn watch_next(library: State<'_, Library>, file_id: i64) -> Result<Option<watch::PlayItem>, String> {
    library.with_db(|c| match watch::next_file(c, file_id)? {
        Some(next) => watch::play_item(c, &library.images_dir, next),
        None => Ok(None),
    })
}

/// Saves how far a file has been played. `done` = playback of it just stopped, so the
/// library screens refresh (continue watching, progress bars).
#[tauri::command]
pub async fn watch_save(
    app: AppHandle,
    library: State<'_, Library>,
    file_id: i64,
    position: f64,
    duration: f64,
    done: bool,
) -> Result<(), String> {
    let finished = library.with_db(|c| watch::save_progress(c, file_id, position, duration))?;
    if finished {
        // The last episode of a season: the library celebrates when it's next on screen.
        if let Ok(Some(season)) = library.with_db(|c| watch::finished_season(c, file_id)) {
            let _ = app.emit("library:finished", season);
        }
    }
    if done || finished {
        let _ = app.emit("library:changed", json!({}));
    }
    Ok(())
}

#[tauri::command]
pub async fn watch_set(app: AppHandle, library: State<'_, Library>, file_ids: Vec<i64>, watched: bool) -> Result<(), String> {
    library.with_db(|c| watch::set_watched(c, &file_ids, watched))?;
    let _ = app.emit("library:changed", json!({}));
    Ok(())
}

#[tauri::command]
pub async fn library_search(library: State<'_, Library>, query: String) -> Result<db::SearchResults, String> {
    library.with_db(|c| db::search(c, &library.images_dir, &query))
}

#[tauri::command]
pub async fn watch_set_title(app: AppHandle, library: State<'_, Library>, title_id: i64, watched: bool) -> Result<(), String> {
    library.with_db(|c| watch::set_title_watched(c, title_id, watched))?;
    let _ = app.emit("library:changed", json!({}));
    Ok(())
}

/// Puts a show or movie on My List, or takes it off.
#[tauri::command]
pub async fn library_list_set(app: AppHandle, library: State<'_, Library>, title_id: i64, on: bool) -> Result<(), String> {
    library.with_db(|c| db::set_listed(c, title_id, on))?;
    let _ = app.emit("library:changed", json!({}));
    Ok(())
}

/// Removes a show from "continue watching" (until something of it is watched again).
#[tauri::command]
pub async fn watch_hide(app: AppHandle, library: State<'_, Library>, title_id: i64) -> Result<(), String> {
    library.with_db(|c| watch::hide_from_continue(c, title_id))?;
    let _ = app.emit("library:changed", json!({}));
    Ok(())
}

/// What the watch-time page adds up.
#[tauri::command]
pub async fn watch_stats(library: State<'_, Library>) -> Result<watch::WatchStats, String> {
    library.with_db(|c| watch::stats(c))
}

#[tauri::command]
pub async fn watch_continue(library: State<'_, Library>) -> Result<Vec<watch::ContinueItem>, String> {
    library.with_db(|c| watch::continue_watching(c, &library.images_dir))
}

/// "f:/Anime/" -> "F:\Anime"
fn normalize(path: &str) -> String {
    let p: PathBuf = path.replace('/', "\\").into();
    let mut s = p.to_string_lossy().trim_end_matches('\\').to_string();
    if s.len() == 2 && s.ends_with(':') {
        s.push('\\'); // keep drive roots as "F:\"
    } else if s.len() > 2 && s.get(1..2) == Some(":") && s.get(2..3) != Some("\\") {
        // "H:Cartoons" means "wherever drive H: last was" to Windows; it's meant as "H:\Cartoons".
        s.insert(2, '\\');
    }
    if let Some(first) = s.get(..1) {
        if s.get(1..2) == Some(":") {
            s = first.to_uppercase() + &s[1..];
        }
    }
    s
}

/// True if `inner` is `outer` or inside it.
fn contains(outer: &str, inner: &str) -> bool {
    let (o, i) = (outer.to_lowercase(), inner.to_lowercase());
    let o = o.trim_end_matches('\\');
    i == o || i.starts_with(&format!("{o}\\"))
}

#[cfg(test)]
mod path_tests {
    use super::normalize;

    #[test]
    fn folder_paths() {
        assert_eq!(normalize("f:/Anime/"), r"F:\Anime");
        assert_eq!(normalize("H:"), r"H:\");
        assert_eq!(normalize(r"H:\"), r"H:\");
        assert_eq!(normalize("H:Cartoons"), r"H:\Cartoons");
    }
}
