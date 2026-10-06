//! Covers, descriptions and episode mapping from AniList (anime) and later TMDB (shows, movies).
//! Runs in the background after scans; everything is saved locally so it works offline.
//!
//! Events: `metadata:status` { running, done, total, current, source, error }, plus `library:changed`
//! after each title so the interface fills in as it goes.

pub mod anilist;
pub mod anime_match;
pub mod images;
pub mod onepace;
pub mod store;
pub mod tmdb;
pub mod tmdb_match;

use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::library::Library;
use anilist::{AniList, Media};
use anime_match::Source;
use images::Images;
use tmdb::Tmdb;

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
    /// "AniList" or "TMDB".
    source: Option<String>,
    error: Option<String>,
}

impl Metadata {
    pub fn new(library: &Library) -> Self {
        if let Err(e) = library.with_db(|c| store::clean_saved_descriptions(c)) {
            eprintln!("cleaning saved descriptions failed: {e}");
        }
        if let Err(e) = library.with_db(|c| store::refresh_tmdb_matches_if_outdated(c)) {
            eprintln!("refreshing TMDB matches failed: {e}");
        }
        if let Err(e) = library.with_db(|c| store::refresh_one_pace_if_outdated(c)) {
            eprintln!("refreshing One Pace failed: {e}");
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

/// Which service a piece of work goes to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum Job {
    /// Anime: show, seasons, movies.
    AniList,
    /// Shows and movies; for anime, episode descriptions and thumbnails.
    Tmdb,
}

impl Job {
    fn label(self) -> &'static str {
        match self {
            Job::AniList => "AniList",
            Job::Tmdb => "TMDB",
        }
    }
}

fn tmdb_key(library: &Library) -> Option<String> {
    library.with_db(|c| store::setting(c, "tmdb_api_key")).ok().flatten()
}

/// Everything that needs looking up, hand-made fixes first.
fn find_jobs(library: &Library, forced: &[i64], attempted: &HashSet<(i64, Job)>, has_key: bool) -> Vec<(i64, Job)> {
    let is_anime = |id: i64| library.with_db(|c| store::is_anime(c, id)).unwrap_or(false);
    let mut jobs: Vec<(i64, Job)> = Vec::new();
    for &id in forced {
        if is_anime(id) {
            jobs.push((id, Job::AniList));
        } else if has_key {
            jobs.push((id, Job::Tmdb));
        }
    }
    let mut add = |ids: Vec<i64>, job: Job| {
        for id in ids {
            if !attempted.contains(&(id, job)) && !jobs.contains(&(id, job)) {
                jobs.push((id, job));
            }
        }
    };
    add(library.with_db(|c| store::anime_titles_needing_work(c)).unwrap_or_default(), Job::AniList);
    if has_key {
        add(library.with_db(|c| store::titles_needing_tmdb(c)).unwrap_or_default(), Job::Tmdb);
    }
    jobs
}

fn run(app: AppHandle) {
    let metadata = app.state::<Metadata>();
    let library = app.state::<Library>();
    // Each piece of work runs at most once per round unless a hand-made fix forces it again.
    let mut attempted: HashSet<(i64, Job)> = HashSet::new();
    let mut done = 0;

    'outer: loop {
        let forced = {
            let mut queue = metadata.queue.lock().unwrap();
            queue.again = false;
            std::mem::take(&mut queue.forced)
        };
        let key = tmdb_key(&library);
        let tmdb = key.as_deref().map(Tmdb::new);
        let jobs = find_jobs(&library, &forced, &attempted, tmdb.is_some());

        if jobs.is_empty() {
            let mut queue = metadata.queue.lock().unwrap();
            if queue.again || !queue.forced.is_empty() {
                continue;
            }
            queue.running = false;
            break;
        }

        let total = done + jobs.len();
        for (id, job) in jobs {
            let input = match library.with_db(|c| store::load_show_input(c, id)) {
                Ok(Some(input)) => input,
                _ => continue,
            };
            attempted.insert((id, job));
            set_status(
                &app,
                Status { running: true, done, total, current: Some(input.name.clone()), source: Some(job.label().into()), error: None },
            );

            let result = match (job, &tmdb) {
                (Job::AniList, _) => process(&app, id, &input),
                (Job::Tmdb, Some(tmdb)) => process_tmdb(&app, id, &input, tmdb),
                (Job::Tmdb, None) => Ok(()),
            };
            match result {
                Ok(()) => {
                    let _ = app.emit("library:changed", json!({}));
                }
                Err(anilist::Error::Unavailable(message)) => {
                    // Offline, service down or key refused: stop now, try again on the next scan or start.
                    eprintln!("metadata paused: {message}");
                    metadata.queue.lock().unwrap().running = false;
                    let error = if message.contains("key") {
                        "The TMDB key wasn't accepted. Check it in Settings.".to_string()
                    } else {
                        format!("{} can't be reached right now.", job.label())
                    };
                    set_status(&app, Status { error: Some(error), ..Status::default() });
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

/// TMDB work for one title: a show, a movie, or episode details for an anime.
fn process_tmdb(app: &AppHandle, title_id: i64, input: &anime_match::ShowInput, tmdb: &Tmdb) -> Result<(), anilist::Error> {
    let metadata = app.state::<Metadata>();
    let library = app.state::<Library>();
    let images = &metadata.images;
    let db_error = |e: String| anilist::Error::Rejected(e);
    let kind = library.with_db(|c| store::title_kind(c, title_id)).map_err(db_error)?;
    let mut art = store::TmdbArt::default();

    if kind.as_deref() == Some("anime") && onepace::is_one_pace(&input.name) {
        return process_one_pace(&library, images, title_id, tmdb);
    }

    if kind.as_deref() == Some("anime") {
        let (names, year, known) = library.with_db(|c| store::anime_lookup_hints(c, title_id)).map_err(db_error)?;
        let names: Vec<&str> = names.iter().map(String::as_str).collect();
        let (tmdb_id, episodes) = tmdb_match::anime_episodes(input, &names, year, known, tmdb)?;
        art.stills = save_stills(images, tmdb_id, &episodes);
        return library.with_db(|c| store::save_anime_episodes(c, title_id, tmdb_id, &episodes, &art)).map_err(db_error);
    }

    if input.is_movie {
        let movie = tmdb_match::match_movie(input, tmdb)?;
        if let Some(m) = &movie {
            save_poster(images, &mut art, &format!("movie-{}", m.id), m.poster_path.as_deref());
            art.banner = images.banner(&format!("tmdb-movie-{}", m.id), tmdb::image_url(m.backdrop_path.as_deref(), "w1280").as_deref());
        }
        return library.with_db(|c| store::save_movie_title(c, title_id, input, movie.as_ref(), &art)).map_err(db_error);
    }

    let matched = tmdb_match::match_tv(input, tmdb)?;
    if let Some(show) = &matched.show {
        save_poster(images, &mut art, &format!("tv-{}", show.id), show.poster_path.as_deref());
        art.banner = images.banner(&format!("tmdb-tv-{}", show.id), tmdb::image_url(show.backdrop_path.as_deref(), "w1280").as_deref());
        for summary in matched.seasons.iter().filter_map(|(_, s)| s.as_ref()) {
            let key = format!("season-{}", summary.season_number);
            if let Some(saved) = images.cover(
                &format!("tmdb-tv-{}-s{}", show.id, summary.season_number),
                tmdb::image_url(summary.poster_path.as_deref(), "w780").as_deref(),
            ) {
                art.covers.insert(key, saved);
            }
        }
    }
    for movie in matched.movies.iter().filter_map(|m| m.movie.as_ref()) {
        save_poster(images, &mut art, &format!("movie-{}", movie.id), movie.poster_path.as_deref());
    }
    art.stills = save_stills(images, matched.show.as_ref().map(|s| s.id), &matched.episodes);
    library.with_db(|c| store::save_tv_match(c, title_id, input, &matched, &art)).map_err(db_error)
}

/// The One Pace guide is downloaded again after this long (new episodes come out regularly).
const ONE_PACE_GUIDE_MAX_AGE: i64 = 24 * 60 * 60;

/// One Pace: titles and descriptions from the One Pace guide, pictures from One Piece on TMDB.
fn process_one_pace(library: &Library, images: &Images, title_id: i64, tmdb: &Tmdb) -> Result<(), anilist::Error> {
    let db_error = |e: String| anilist::Error::Rejected(e);
    let cached = library.with_db(|c| store::one_pace_guide(c)).map_err(db_error)?;
    let fresh = cached.as_ref().is_some_and(|(_, at)| crate::library::db::now() - at < ONE_PACE_GUIDE_MAX_AGE);
    let json = if fresh {
        cached.map(|(json, _)| json).unwrap_or_default()
    } else {
        match onepace::download() {
            Ok(json) if onepace::parse(&json).is_ok() => {
                library.with_db(|c| store::store_one_pace_guide(c, &json)).map_err(db_error)?;
                json
            }
            // Offline or a bad download: use the old copy if there is one.
            Ok(_) | Err(_) if cached.is_some() => cached.map(|(json, _)| json).unwrap_or_default(),
            Ok(_) => return Err(anilist::Error::Rejected("One Pace guide unreadable".into())),
            Err(e) => return Err(e),
        }
    };
    let guide = onepace::parse(&json).map_err(db_error)?;
    let files = library.with_db(|c| store::episode_files(c, title_id)).map_err(db_error)?;
    let matches = onepace::match_files(&guide, &files);

    let one_piece = tmdb_match::anime_show(&["One Piece"], Some(1999), None, tmdb)?;
    let (tmdb_id, seasons) = match one_piece {
        Some((id, seasons)) => (Some(id), seasons),
        None => (None, Vec::new()),
    };
    let episodes = onepace::episode_info(&guide, &matches, &seasons);
    let art = store::TmdbArt { stills: save_stills(images, tmdb_id, &episodes), ..Default::default() };
    library.with_db(|c| store::save_anime_episodes(c, title_id, tmdb_id, &episodes, &art)).map_err(db_error)
}

/// `key` is "tv-<id>" or "movie-<id>"; the file is named "tmdb-<key>".
fn save_poster(images: &Images, art: &mut store::TmdbArt, key: &str, path: Option<&str>) {
    if let Some(saved) = images.cover(&format!("tmdb-{key}"), tmdb::image_url(path, "w780").as_deref()) {
        art.covers.insert(key.to_string(), saved);
    }
}

/// Downloads episode thumbnails a few at a time; returns file id -> image name.
fn save_stills(images: &Images, show_id: Option<i64>, episodes: &[(i64, Vec<tmdb::Episode>)]) -> HashMap<i64, String> {
    let Some(show_id) = show_id else { return HashMap::new() };
    let wanted: Vec<(i64, String, String)> = episodes
        .iter()
        .filter_map(|(file_id, eps)| {
            let ep = eps.iter().find(|e| e.still_path.is_some())?;
            let url = tmdb::image_url(ep.still_path.as_deref(), "w300")?;
            Some((*file_id, format!("tmdb-tv-{show_id}-s{}e{}", ep.season_number, ep.episode_number), url))
        })
        .collect();
    let results = Mutex::new(HashMap::new());
    let next = std::sync::atomic::AtomicUsize::new(0);
    std::thread::scope(|scope| {
        for _ in 0..6 {
            scope.spawn(|| loop {
                let i = next.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                let Some((file_id, key, url)) = wanted.get(i) else { break };
                if let Some(name) = images.still(key, Some(url)) {
                    results.lock().unwrap().insert(*file_id, name);
                }
            });
        }
    });
    results.into_inner().unwrap()
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

/// Searches for the "fix match" picker. `source`: "anilist", "tmdb-tv" or "tmdb-movie".
#[tauri::command]
pub async fn metadata_search(
    metadata: State<'_, Metadata>,
    library: State<'_, Library>,
    query: String,
    source: String,
) -> Result<Vec<Candidate>, String> {
    if source == "anilist" {
        let results = metadata.anilist.search(&query, None).map_err(|e| e.to_string())?;
        return Ok(results
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
            .collect());
    }
    let key = tmdb_key(&library).ok_or("Add your TMDB key in Settings first.")?;
    let tmdb = Tmdb::new(&key);
    let movie = source == "tmdb-movie";
    let results = if movie { tmdb.search_movie(&query, None) } else { tmdb.search_tv(&query, None) }
        .map_err(|e| e.to_string())?;
    Ok(results
        .into_iter()
        .map(|r| Candidate {
            id: r.id,
            title: r.display_title(),
            alt_title: r.original_name.clone().or(r.original_title.clone()).filter(|o| *o != r.display_title()),
            format: Some(if movie { "MOVIE" } else { "TV" }.into()),
            year: r.year(),
            episodes: None,
            cover_url: tmdb::image_url(r.poster_path.as_deref(), "w185"),
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
pub async fn settings_set_tmdb_key(app: AppHandle, library: State<'_, Library>, key: Option<String>) -> Result<(), String> {
    let key = key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty());
    library.with_db(|c| store::set_setting(c, "tmdb_api_key", key.as_deref()))?;
    // Fetch info for shows and movies right away.
    request(&app, None);
    Ok(())
}

/// Settings of the interface itself (like the theme). Only keys starting with "ui." can be used
/// this way, so the page can never read the TMDB key through it.
fn ui_key(key: &str) -> Result<(), String> {
    if key.starts_with("ui.") { Ok(()) } else { Err(format!("not an interface setting: {key}")) }
}

#[tauri::command]
pub async fn ui_setting(library: State<'_, Library>, key: String) -> Result<Option<String>, String> {
    ui_key(&key)?;
    library.with_db(|c| store::setting(c, &key))
}

#[tauri::command]
pub async fn set_ui_setting(library: State<'_, Library>, key: String, value: Option<String>) -> Result<(), String> {
    ui_key(&key)?;
    library.with_db(|c| store::set_setting(c, &key, value.as_deref()))
}
