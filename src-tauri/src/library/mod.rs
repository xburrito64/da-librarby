//! The media library: which folders to scan, the database of what's in them, and
//! background rescans.
//!
//! Events sent to the frontend:
//!   `library:scan`    { running, library }   while scans run / when they finish
//!   `library:changed` {}                     after a scan changed the database

pub mod db;
pub mod parse;
pub mod scan;

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
        Ok(Self { db: Mutex::new(conn), queue: Mutex::new(ScanQueue::default()) })
    }

    fn with_db<T>(&self, f: impl FnOnce(&mut Connection) -> rusqlite::Result<T>) -> Result<T, String> {
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
    library.with_db(|c| db::titles(c))
}

#[tauri::command]
pub async fn library_title(library: State<'_, Library>, id: i64) -> Result<Option<db::TitleDetail>, String> {
    library.with_db(|c| db::title_detail(c, id))
}

/// "f:/Anime/" -> "F:\Anime"
fn normalize(path: &str) -> String {
    let p: PathBuf = path.replace('/', "\\").into();
    let mut s = p.to_string_lossy().trim_end_matches('\\').to_string();
    if s.len() == 2 && s.ends_with(':') {
        s.push('\\'); // keep drive roots as "F:\"
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
