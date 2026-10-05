//! Covers, descriptions and episode mapping from AniList (anime) and later TMDB (shows, movies).
//! Runs in the background after scans; everything is saved locally so it works offline.
//!
//! Events: `metadata:status` { running, done, total, current, error }, plus `library:changed`
//! after each title so the interface fills in as it goes.

pub mod anilist;
pub mod anime_match;
pub mod images;
pub mod store;

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::library::Library;
use anilist::{AniList, Media};
use anime_match::Source;
use images::Images;

pub struct Metadata {
    anilist: AniList,
    images: Images,
    queue: Mutex<Queue>,
    status: Mutex<Status>,
}

#[derive(Default)]
struct Queue {
    running: bool,
    /// Something changed while running: look for work again before stopping.
    again: bool,
    /// Titles to (re)process first, even if nothing looks missing (after a hand-made fix).
    forced: Vec<i64>,
}

#[derive(Default, Clone, Serialize)]
pub struct Status {
    running: bool,
    done: usize,
    total: usize,
    current: Option<String>,
    error: Option<String>,
}

impl Metadata {
    pub fn new(library: &Library) -> Self {
        if let Err(e) = library.with_db(|c| store::clean_saved_descriptions(c)) {
            eprintln!("cleaning saved descriptions failed: {e}");
        }
        Self {
            anilist: AniList::new(),
            images: Images::new(library.images_dir.clone()),
            queue: Mutex::new(Queue::default()),
            status: Mutex::new(Status::default()),
        }
    }
}

/// Looks for titles that need metadata and works through them in the background.
pub fn request(app: &AppHandle, force: Option<i64>) {
    let metadata = app.state::<Metadata>();
    let start = {
        let mut queue = metadata.queue.lock().unwrap();
        if let Some(id) = force {
            queue.forced.retain(|&f| f != id);
            queue.forced.insert(0, id);
        }
        queue.again = true;
        !std::mem::replace(&mut queue.running, true)
    };
    if start {
        let app = app.clone();
        std::thread::Builder::new()
            .name("metadata".into())
            .spawn(move || run(app))
            .expect("failed to spawn metadata thread");
    }
}

fn run(app: AppHandle) {
    let metadata = app.state::<Metadata>();
    let library = app.state::<Library>();
    // Each title is processed at most once per round unless a hand-made fix forces it again.
    let mut attempted: HashSet<i64> = HashSet::new();
    let mut done = 0;

    'outer: loop {
        let forced = {
            let mut queue = metadata.queue.lock().unwrap();
            queue.again = false;
            std::mem::take(&mut queue.forced)
        };
        let mut todo = forced.clone();
        if let Ok(ids) = library.with_db(|c| store::anime_titles_needing_work(c)) {
            todo.extend(ids.into_iter().filter(|id| !forced.contains(id) && !attempted.contains(id)));
        }
        todo.retain(|id| library.with_db(|c| store::is_anime(c, *id)).unwrap_or(false));

        if todo.is_empty() {
            let mut queue = metadata.queue.lock().unwrap();
            if queue.again || !queue.forced.is_empty() {
                continue;
            }
            queue.running = false;
            break;
        }

        let total = done + todo.len();
        for id in todo {
            let input = match library.with_db(|c| store::load_show_input(c, id)) {
                Ok(Some(input)) => input,
                _ => continue,
            };
            attempted.insert(id);
            set_status(&app, Status { running: true, done, total, current: Some(input.name.clone()), error: None });

            match process(&app, id, &input) {
                Ok(()) => {
                    let _ = app.emit("library:changed", json!({}));
                }
                Err(anilist::Error::Unavailable(message)) => {
                    // Offline or AniList down: stop now, try again on the next scan or start.
                    eprintln!("metadata paused: {message}");
                    metadata.queue.lock().unwrap().running = false;
                    set_status(&app, Status { error: Some("AniList can't be reached right now.".into()), ..Status::default() });
                    return;
                }
                Err(e) => eprintln!("metadata for {} failed: {e}", input.name),
            }
            done += 1;

            // A hand-made fix jumps the queue.
            if !metadata.queue.lock().unwrap().forced.is_empty() {
                continue 'outer;
            }
        }
    }
    set_status(&app, Status::default());
}

fn process(app: &AppHandle, title_id: i64, input: &anime_match::ShowInput) -> Result<(), anilist::Error> {
    let metadata = app.state::<Metadata>();
    let library = app.state::<Library>();
    let mut source = CachedSource { library: &library, anilist: &metadata.anilist };
    let matched = anime_match::match_show(input, &mut source)?;

    // Artwork: the show's cover and banner, each season's cover, each movie's cover.
    let mut art = store::SavedArt::default();
    let mut wanted: Vec<&Media> = Vec::new();
    wanted.extend(matched.root.iter());
    wanted.extend(matched.seasons.iter().filter_map(|s| s.entries.first()));
    wanted.extend(matched.movies.iter().filter_map(|m| m.media.as_ref()));
    for media in wanted {
        if art.covers.contains_key(&media.id) {
            continue;
        }
        let url = media.cover_image.as_ref().and_then(|c| c.extra_large.as_deref().or(c.large.as_deref()));
        if let Some(saved) = metadata.images.cover(&format!("anilist-{}", media.id), url) {
            art.covers.insert(media.id, saved);
        }
    }
    // Many first seasons have no banner; fall back to a later season's.
    let banner_source = matched.root.iter().chain(matched.chain.iter()).find(|m| m.banner_image.is_some());
    if let Some(media) = banner_source {
        art.banner = metadata.images.banner(&format!("anilist-{}", media.id), media.banner_image.as_deref());
    }

    library
        .with_db(|c| store::save_show_match(c, title_id, input, &matched, &art))
        .map_err(anilist::Error::Rejected)
}

fn set_status(app: &AppHandle, status: Status) {
    *app.state::<Metadata>().status.lock().unwrap() = status.clone();
    let _ = app.emit("metadata:status", status);
}

/// AniList data, served from the local cache when it's fresh enough.
struct CachedSource<'a> {
    library: &'a Library,
    anilist: &'a AniList,
}

impl Source for CachedSource<'_> {
    fn media(&mut self, ids: &[i64]) -> Result<HashMap<i64, Media>, anilist::Error> {
        let mut found = self.library.with_db(|c| store::cached_media(c, ids)).unwrap_or_default();
        let missing: Vec<i64> = ids.iter().copied().filter(|id| !found.contains_key(id)).collect();
        if !missing.is_empty() {
            let fetched = self.anilist.media(&missing)?;
            let _ = self.library.with_db(|c| store::store_media(c, &fetched));
            found.extend(fetched.into_iter().map(|m| (m.id, m)));
        }
        Ok(found)
    }

    fn search(&mut self, query: &str, formats: Option<&[&str]>) -> Result<Vec<Media>, anilist::Error> {
        let results = self.anilist.search(query, formats)?;
        let _ = self.library.with_db(|c| store::store_media(c, &results));
        Ok(results)
    }
}

// ---------------------------------------------------------------------------------------------
// Commands

#[tauri::command]
pub async fn metadata_status(metadata: State<'_, Metadata>) -> Result<Status, String> {
    Ok(metadata.status.lock().unwrap().clone())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    id: i64,
    title: String,
    alt_title: Option<String>,
    format: Option<String>,
    year: Option<i32>,
    episodes: Option<i32>,
    cover_url: Option<String>,
}

/// Searches AniList for the "fix match" picker.
#[tauri::command]
pub async fn metadata_search(metadata: State<'_, Metadata>, query: String) -> Result<Vec<Candidate>, String> {
    let results = metadata.anilist.search(&query, None).map_err(|e| e.to_string())?;
    Ok(results
        .into_iter()
        .map(|m| Candidate {
            id: m.id,
            title: m.display_title(),
            alt_title: m.title.romaji.clone().filter(|r| Some(r) != m.title.english.as_ref()),
            format: m.format.clone(),
            year: m.year(),
            episodes: m.episodes,
            cover_url: m.cover_image.as_ref().and_then(|c| c.large.clone()),
        })
        .collect())
}

/// mode: "auto" (let the app decide), "none" (no match), or "pick" (use `id`).
#[tauri::command]
pub async fn metadata_match_title(
    app: AppHandle,
    library: State<'_, Library>,
    title_id: i64,
    mode: String,
    id: Option<i64>,
) -> Result<(), String> {
    library.with_db(|c| store::set_title_choice(c, title_id, &mode, id))?;
    request(&app, Some(title_id));
    Ok(())
}

/// The AniList entries a season covers, in order. Empty goes back to automatic.
#[tauri::command]
pub async fn metadata_match_season(
    app: AppHandle,
    library: State<'_, Library>,
    season_id: i64,
    ids: Vec<i64>,
) -> Result<(), String> {
    let title_id = library.with_db(|c| store::set_season_choice(c, season_id, &ids))?;
    request(&app, Some(title_id));
    Ok(())
}

#[tauri::command]
pub async fn metadata_match_file(
    app: AppHandle,
    library: State<'_, Library>,
    file_id: i64,
    mode: String,
    id: Option<i64>,
) -> Result<(), String> {
    let title_id = library.with_db(|c| store::set_file_choice(c, file_id, &mode, id))?;
    request(&app, Some(title_id));
    Ok(())
}

/// Whether a TMDB key is saved, shown only by its last four characters.
#[tauri::command]
pub async fn settings_tmdb_key(library: State<'_, Library>) -> Result<Option<String>, String> {
    let key = library.with_db(|c| store::setting(c, "tmdb_api_key"))?;
    Ok(key.map(|k| format!("••••{}", k.chars().rev().take(4).collect::<Vec<_>>().into_iter().rev().collect::<String>())))
}

#[tauri::command]
pub async fn settings_set_tmdb_key(library: State<'_, Library>, key: Option<String>) -> Result<(), String> {
    let key = key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty());
    library.with_db(|c| store::set_setting(c, "tmdb_api_key", key.as_deref()))
}
