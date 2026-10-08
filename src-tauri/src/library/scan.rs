//! Walks a library folder and describes what's in it as titles (shows or movies),
//! seasons and files. Touches only the file system; saving happens in `db`.

use std::cmp::Ordering;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};

use super::parse::{self, FolderKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LibraryKind {
    Anime,
    Shows,
    Movies,
}

impl LibraryKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Anime => "anime",
            Self::Shows => "shows",
            Self::Movies => "movies",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "anime" => Some(Self::Anime),
            "shows" => Some(Self::Shows),
            "movies" => Some(Self::Movies),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Role {
    Episode,
    Movie,
    Extra,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Episode => "episode",
            Self::Movie => "movie",
            Self::Extra => "extra",
        }
    }
}

#[derive(Debug)]
pub struct ScannedTitle {
    /// Folder (or file) path relative to the library root, '/'-separated. Stable identity.
    pub key: String,
    /// Usually the library's kind; a category folder ("Anime", "Movies") inside it overrides it.
    pub kind: LibraryKind,
    /// Key of the show this one is nested in (spin-offs like "Adventure Time: Fionna and Cake").
    pub parent_key: Option<String>,
    /// A single movie rather than a series.
    pub is_movie: bool,
    pub name: String,
    pub year: Option<i32>,
    pub folder: PathBuf,
    pub seasons: Vec<ScannedSeason>,
    pub files: Vec<ScannedFile>,
}

#[derive(Debug)]
pub struct ScannedSeason {
    /// Stable identity within the title: "s1", "s0", or "g:<folder name>" for arc-style groups.
    pub key: String,
    /// None for groups without a season number (One Pace arcs). Story arcs whose files are
    /// numbered within a season (Hunter x Hunter's, all "S01") carry that season's number.
    pub number: Option<i32>,
    pub label: String,
    pub sort: f64,
}

#[derive(Debug)]
pub struct ScannedFile {
    pub path: PathBuf,
    pub size: u64,
    pub mtime: i64,
    pub role: Role,
    /// Index into the title's `seasons`.
    pub season: Option<usize>,
    pub episode: Option<f64>,
    pub episode_end: Option<f64>,
    pub name: Option<String>,
    pub year: Option<i32>,
    pub sort: i64,
    /// For extras: the heading it's listed under.
    pub extra: Option<ExtraGroup>,
}

/// Which heading an extra is listed under on the show page, taken from the folders it sits in.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ExtraGroup {
    /// "Season 15", "Season 15 · Deleted Scenes", "Mabels Guide"; None = no heading of its own.
    pub label: Option<String>,
    /// Belongs to a movie, so it's shown with the movies rather than the seasons.
    pub movie: bool,
    /// Order of the headings: seasons by number, then named folders, then the rest.
    pub sort: f64,
}

/// Where named extras folders ("TV Shorts") and loose extras go among the seasons' headings.
const NAMED_EXTRAS_SORT: f64 = 2000.0;
const LOOSE_EXTRAS_SORT: f64 = 1e9;
/// Extras of the specials come after those of the regular seasons, like the tabs.
const SPECIALS_EXTRAS_SORT: f64 = 999.0;

impl ExtraGroup {
    /// Extras that belong to no season or folder in particular.
    fn general() -> Self {
        Self { label: None, movie: false, sort: LOOSE_EXTRAS_SORT }
    }

    /// The extras of a movie, under its name (None: the title is just that movie).
    fn movie(name: Option<String>) -> Self {
        Self { label: name, movie: true, sort: 0.0 }
    }

    /// A subfolder: "Season 15" + "Deleted Scenes" -> "Season 15 · Deleted Scenes".
    fn sub(&self, folder: &str) -> Self {
        if parse::generic_extras_folder(folder) {
            return self.clone();
        }
        let name = parse::clean_text(&parse::strip_tags(folder));
        match &self.label {
            Some(label) => Self { label: Some(format!("{label} · {name}")), ..self.clone() },
            None => Self { label: Some(name), movie: self.movie, sort: NAMED_EXTRAS_SORT },
        }
    }
}

/// Scans one library folder. Fails only if the folder itself can't be read
/// (e.g. the drive is disconnected); unreadable subfolders are skipped.
///
/// Category folders directly inside it ("Anime", "Cartoons", "Movies"...) are scanned as
/// their own kind, so a whole drive can be added as one library.
pub fn scan_library(root: &Path, kind: LibraryKind) -> io::Result<Vec<ScannedTitle>> {
    let entries = list(root)?;
    let mut out = Vec::new();
    scan_entries(root, &entries, kind, "", true, &mut out);
    Ok(out)
}

fn scan_entries(dir: &Path, entries: &[Entry], kind: LibraryKind, prefix: &str, top: bool, out: &mut Vec<ScannedTitle>) {
    for entry in entries {
        let key = format!("{prefix}{}", entry.name);
        let start = out.len();
        let mut entry_kind = kind;
        if entry.is_dir {
            match parse::category_folder(&entry.name).filter(|_| top) {
                Some(category) => {
                    if let Ok(children) = list(&entry.path) {
                        scan_entries(&entry.path, &children, category, &format!("{key}/"), false, out);
                    }
                    continue;
                }
                None => match kind {
                    LibraryKind::Movies => scan_movie_dir(&entry.path, &key, out),
                    LibraryKind::Anime | LibraryKind::Shows => scan_show(&entry.path, &key, None, out),
                },
            }
        } else if parse::is_video(&entry.name) {
            let (name, year) = parse::title_and_year(parse::file_stem(&entry.name));
            let mut title = ScannedTitle::new(key, None, name.clone(), year, dir);
            title.push_file(entry, Role::Movie, None, None, None, Some(name), year);
            title.finish();
            out.push(title);
            entry_kind = kind;
        }
        for title in &mut out[start..] {
            title.kind = entry_kind;
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Shows

fn scan_show(dir: &Path, key: &str, parent_key: Option<&str>, out: &mut Vec<ScannedTitle>) {
    let Ok(entries) = list(dir) else { return };
    let (name, year) = parse::show_title(&file_name(dir));
    let mut title = ScannedTitle::new(key.to_string(), parent_key.map(str::to_string), name, year, dir);
    let mut nested = Vec::new();

    for entry in &entries {
        if !entry.is_dir {
            if parse::is_video(&entry.name) {
                add_loose_file(&mut title, entry);
            }
            continue;
        }
        let sub_key = format!("{key}/{}", entry.name);
        match parse::classify_folder(&entry.name) {
            FolderKind::Extras => {
                // "Jujutsu Kaisen S01 Extras" next to the season folders belongs to season 1.
                let group = match parse::extras_season(&entry.name) {
                    Some(n) => title.season_extras(n),
                    None => ExtraGroup::general(),
                };
                add_extras(&mut title, &entry.path, group);
            }
            FolderKind::Season(n) => {
                let season = title.season_by_number(n);
                add_season_dir(&mut title, &entry.path, season, Some(n));
            }
            FolderKind::Movies => {
                for video in videos_recursive(&entry.path) {
                    let (name, year) = parse::title_and_year(parse::file_stem(&video.name));
                    title.push_file(&video, Role::Movie, None, None, None, Some(name), year);
                }
            }
            FolderKind::Other => {
                classify_other_folder(&mut title, entry, &sub_key, key, &mut nested);
            }
        }
    }

    let movies = split_movies(&mut title);
    if !title.files.is_empty() {
        title.finish();
        out.push(title);
    }
    out.extend(movies);
    out.extend(nested);
}

/// Movies kept in a show's folder (Naruto's, "Jujutsu Kaisen 0") become titles of their own
/// inside the show, so each gets a movie page and is listed with the movies. A movie in a folder
/// of its own takes that folder's extras along. A folder that is just one movie stays as it is.
fn split_movies(title: &mut ScannedTitle) -> Vec<ScannedTitle> {
    let episodes = title.files.iter().filter(|f| f.role == Role::Episode).count();
    let movies = title.files.iter().filter(|f| f.role == Role::Movie).count();
    if movies == 0 || (episodes == 0 && movies == 1) {
        return Vec::new();
    }
    let show_dir = title.folder.clone();
    let parent_dir = |f: &ScannedFile| f.path.parent().map(Path::to_path_buf).unwrap_or_default();
    let movie_dirs: Vec<PathBuf> = title.files.iter().filter(|f| f.role == Role::Movie).map(parent_dir).collect();
    let (movie_files, rest): (Vec<ScannedFile>, Vec<ScannedFile>) =
        std::mem::take(&mut title.files).into_iter().partition(|f| f.role == Role::Movie);
    title.files = rest;
    // Folders that also hold episodes (SAO's movie among its specials) aren't the movie's own.
    let episode_dirs: Vec<PathBuf> = title.files.iter().filter(|f| f.role == Role::Episode).map(parent_dir).collect();

    let mut out = Vec::new();
    for mut movie in movie_files {
        let dir = parent_dir(&movie);
        // Its own folder: not the show's, and not shared with other movies ("Movies") or episodes.
        let own_dir = dir != show_dir && movie_dirs.iter().filter(|d| **d == dir).count() == 1 && !episode_dirs.contains(&dir);
        let place = if own_dir { dir.clone() } else { movie.path.clone() };
        let key = format!("{}/{}", title.key, relative_key(&show_dir, &place));
        let name = movie.name.clone().unwrap_or_else(|| parse::file_stem(&file_name(&movie.path)).to_string());
        let mut child = ScannedTitle::new(key, Some(title.key.clone()), name, movie.year, &dir);
        child.kind = title.kind;
        movie.season = None;
        child.files.push(movie);
        if own_dir {
            let (extras, rest): (Vec<ScannedFile>, Vec<ScannedFile>) = std::mem::take(&mut title.files)
                .into_iter()
                .partition(|f| f.role == Role::Extra && f.extra.as_ref().is_some_and(|g| g.movie) && f.path.starts_with(&dir));
            title.files = rest;
            for mut extra in extras {
                // "Jujutsu Kaisen 0 · Featurettes" is just "Featurettes" on the movie's own page.
                if let Some(group) = extra.extra.as_mut() {
                    group.label = group.label.as_deref().and_then(|l| l.split_once(" · ")).map(|(_, rest)| rest.to_string());
                }
                child.files.push(extra);
            }
        }
        child.finish();
        out.push(child);
    }
    out
}

/// `path` inside `base` as a '/'-separated key.
fn relative_key(base: &Path, path: &Path) -> String {
    let rel = path.strip_prefix(base).unwrap_or(path);
    rel.components().map(|c| c.as_os_str().to_string_lossy()).collect::<Vec<_>>().join("/")
}

/// A subfolder of a show that isn't obviously a season, extras or movies folder.
/// Decides from its contents what it is.
fn classify_other_folder(
    title: &mut ScannedTitle,
    entry: &Entry,
    sub_key: &str,
    key: &str,
    nested: &mut Vec<ScannedTitle>,
) {
    let Ok(children) = list(&entry.path) else { return };
    let videos: Vec<&Entry> = children.iter().filter(|c| !c.is_dir && parse::is_video(&c.name)).collect();
    let parsed: Vec<parse::EpisodeName> =
        videos.iter().map(|v| parse::parse_episode(parse::file_stem(&v.name))).collect();
    let with_season = parsed.iter().filter(|p| p.season.is_some()).count();
    let numbered = parsed.iter().filter(|p| p.episode.is_some()).count();
    let has_season_dirs = children
        .iter()
        .any(|c| c.is_dir && matches!(parse::classify_folder(&c.name), FolderKind::Season(_)));

    let (group_number, group_label) = parse::numbered_group(&entry.name);
    // A numbered folder of episodes is a story arc, even when its files carry a season number
    // ("01. Hunter Exam Arc" holding "Hunter x Hunter - S01E001").
    let arc = group_number.is_some() && !has_season_dirs && numbered * 2 > videos.len();

    if !arc && (has_season_dirs || (videos.len() >= 2 && with_season * 2 > videos.len())) {
        // Its own show living inside this one: "Adventure Time: Fionna and Cake", "Distant Lands".
        scan_show(&entry.path, sub_key, Some(key), nested);
    } else if arc || (numbered * 2 > videos.len() && videos.len() >= 2) {
        // Numbered episodes grouped by story arc, like One Pace's arcs ("04. Gaimon" holds a
        // single episode but is still an arc, not a movie). When the files all say which season
        // they're from (Hunter x Hunter's arcs are all season 1), the arc keeps that number so
        // its episodes can be looked up.
        let mut seasons = parsed.iter().filter_map(|p| p.season);
        let first = seasons.next();
        let season_number = first.filter(|&n| n > 0 && seasons.all(|s| s == n));
        let season = title.add_group(&entry.name, group_label, group_number, season_number);
        add_season_dir(title, &entry.path, season, season_number);
    } else if !videos.is_empty() {
        // A movie in its own folder ("Jujutsu Kaisen 0", "South Park: Post COVID (2021)").
        let (folder_name, folder_year) = parse::title_and_year(&entry.name);
        let single = videos.len() == 1;
        for video in videos {
            let (name, year) = if single {
                (folder_name.clone(), folder_year)
            } else {
                parse::title_and_year(parse::file_stem(&video.name))
            };
            title.push_file(video, Role::Movie, None, None, None, Some(name), year);
        }
        let group = ExtraGroup::movie(Some(folder_name));
        for child in children.iter().filter(|c| c.is_dir) {
            add_extras_folder(title, child, &group);
        }
    } else if children.iter().any(|c| c.is_dir) {
        scan_show(&entry.path, sub_key, Some(key), nested);
    }
}

/// A video sitting directly in a show folder.
fn add_loose_file(title: &mut ScannedTitle, entry: &Entry) {
    let p = parse::parse_episode(parse::file_stem(&entry.name));
    if p.season.is_some() || p.episode.is_some() {
        let season = title.season_by_number(p.season.unwrap_or(1));
        title.push_file(entry, Role::Episode, Some(season), p.episode, p.episode_end, p.title, None);
    } else {
        let (name, year) = parse::title_and_year(parse::file_stem(&entry.name));
        title.push_file(entry, Role::Movie, None, None, None, Some(name), year);
    }
}

/// Adds every video in a season folder (and its non-extras subfolders) as episodes.
fn add_season_dir(title: &mut ScannedTitle, dir: &Path, season: usize, folder_number: Option<i32>) {
    let Ok(entries) = list(dir) else { return };
    for entry in &entries {
        if entry.is_dir {
            if parse::classify_folder(&entry.name) == FolderKind::Extras {
                let s = &title.seasons[season];
                let sort = if s.number == Some(0) { SPECIALS_EXTRAS_SORT } else { s.sort };
                add_extras(title, &entry.path, ExtraGroup { label: Some(s.label.clone()), movie: false, sort });
            } else {
                add_season_dir(title, &entry.path, season, folder_number);
            }
        } else if parse::is_video(&entry.name) {
            let p = parse::parse_episode(parse::file_stem(&entry.name));
            if folder_number == Some(0) && p.title.as_deref().is_some_and(parse::is_movie_title) {
                // A movie among the specials (SAO's "S02E25 - Sword Art Online The Movie Ordinal Scale").
                let (name, year) = parse::title_and_year(p.title.as_deref().unwrap_or_default());
                title.push_file(entry, Role::Movie, None, None, None, Some(name), year);
                continue;
            }
            // Trust the file's episode number only if it belongs to this folder's season
            // (SAO's Specials folder holds "S01E26", which is special 1, not episode 26).
            let consistent = folder_number.is_none() || p.season.is_none() || p.season == folder_number;
            let (episode, episode_end) = if consistent { (p.episode, p.episode_end) } else { (None, None) };
            title.push_file(entry, Role::Episode, Some(season), episode, episode_end, p.title, None);
        }
    }
}

/// Adds the videos in an extras folder: loose ones under `group`, those in subfolders under a
/// heading of their own ("Season 15 · Deleted Scenes", or "Mabels Guide" for general extras).
fn add_extras(title: &mut ScannedTitle, dir: &Path, group: ExtraGroup) {
    let Ok(entries) = list(dir) else { return };
    for entry in &entries {
        if entry.is_dir {
            add_extras_folder(title, entry, &group);
        } else if parse::is_video(&entry.name) {
            title.push_extra(entry, group.clone());
        }
    }
}

/// Adds every video in a subfolder of extras under that subfolder's heading. A general extras
/// folder split by season ("Adventure Time Extras/Season 01") goes under the seasons' headings.
fn add_extras_folder(title: &mut ScannedTitle, folder: &Entry, parent: &ExtraGroup) {
    let season = parse::extras_season(&folder.name).filter(|_| parent.label.is_none() && !parent.movie);
    let group = match season {
        Some(n) => title.season_extras(n),
        None => parent.sub(&folder.name),
    };
    for video in videos_recursive(&folder.path) {
        title.push_extra(&video, group.clone());
    }
}

// ---------------------------------------------------------------------------------------------
// Movies library: "Movie Name (Year)/Movie Name (Year).mkv", loose files, or collection folders.

fn scan_movie_dir(dir: &Path, key: &str, out: &mut Vec<ScannedTitle>) {
    let Ok(children) = list(dir) else { return };
    let mut videos: Vec<&Entry> = children.iter().filter(|c| !c.is_dir && parse::is_video(&c.name)).collect();

    if videos.is_empty() {
        // A collection folder: each subfolder is its own movie.
        for child in children.iter().filter(|c| c.is_dir) {
            if parse::classify_folder(&child.name) != FolderKind::Extras {
                scan_movie_dir(&child.path, &format!("{key}/{}", child.name), out);
            }
        }
        return;
    }

    // The biggest video is the movie; anything else alongside it is an extra (samples, trailers).
    videos.sort_by_key(|v| std::cmp::Reverse(v.size));
    let (name, year) = parse::title_and_year(&file_name(dir));
    let mut title = ScannedTitle::new(key.to_string(), None, name.clone(), year, dir);
    title.push_file(videos[0], Role::Movie, None, None, None, Some(name), year);
    let group = ExtraGroup::movie(None);
    for extra in &videos[1..] {
        title.push_extra(extra, group.clone());
    }
    for child in children.iter().filter(|c| c.is_dir) {
        add_extras_folder(&mut title, child, &group);
    }
    title.finish();
    out.push(title);
}

// ---------------------------------------------------------------------------------------------

impl ScannedTitle {
    fn new(key: String, parent_key: Option<String>, name: String, year: Option<i32>, folder: &Path) -> Self {
        Self {
            key,
            kind: LibraryKind::Shows,
            parent_key,
            is_movie: false,
            name,
            year,
            folder: folder.to_path_buf(),
            seasons: Vec::new(),
            files: Vec::new(),
        }
    }

    fn season_by_number(&mut self, number: i32) -> usize {
        let key = format!("s{number}");
        if let Some(i) = self.seasons.iter().position(|s| s.key == key) {
            return i;
        }
        let label = if number == 0 { "Specials".to_string() } else { format!("Season {number}") };
        self.seasons.push(ScannedSeason {
            key,
            number: Some(number),
            label,
            sort: number as f64,
        });
        self.seasons.len() - 1
    }

    /// The heading for extras of season `number`, named like its tab.
    fn season_extras(&self, number: i32) -> ExtraGroup {
        let label = match self.seasons.iter().find(|s| s.key == format!("s{number}")) {
            Some(s) => s.label.clone(),
            None if number == 0 => "Specials".to_string(),
            None => format!("Season {number}"),
        };
        let sort = if number == 0 { SPECIALS_EXTRAS_SORT } else { number as f64 };
        ExtraGroup { label: Some(label), movie: false, sort }
    }

    /// A story arc: `number` orders it, `season` is the season its episodes are numbered in.
    fn add_group(&mut self, folder: &str, label: String, number: Option<f64>, season: Option<i32>) -> usize {
        let sort = number.unwrap_or(1000.0 + self.seasons.len() as f64);
        self.seasons.push(ScannedSeason { key: format!("g:{folder}"), number: season, label, sort });
        self.seasons.len() - 1
    }

    #[allow(clippy::too_many_arguments)]
    fn push_file(
        &mut self,
        entry: &Entry,
        role: Role,
        season: Option<usize>,
        episode: Option<f64>,
        episode_end: Option<f64>,
        name: Option<String>,
        year: Option<i32>,
    ) {
        self.files.push(ScannedFile {
            path: entry.path.clone(),
            size: entry.size,
            mtime: entry.mtime,
            role,
            season,
            episode,
            episode_end,
            name,
            year,
            sort: 0,
            extra: None,
        });
    }

    fn push_extra(&mut self, entry: &Entry, group: ExtraGroup) {
        let folder = entry.path.parent().and_then(Path::file_name).map(|n| n.to_string_lossy());
        let name = parse::extra_name(parse::file_stem(&entry.name), &self.name, folder.as_deref());
        self.push_file(entry, Role::Extra, None, None, None, Some(name), None);
        if let Some(file) = self.files.last_mut() {
            file.extra = Some(group);
        }
    }

    /// Orders files (episodes by season and number, then movies, then extras by heading) and
    /// drops seasons that ended up without episodes.
    fn finish(&mut self) {
        let seasons = &self.seasons;
        let season_sort = |f: &ScannedFile| f.season.map_or(f64::MAX, |i| seasons[i].sort);
        self.files.sort_by(|a, b| {
            a.role
                .cmp(&b.role)
                .then_with(|| extra_order(a.extra.as_ref(), b.extra.as_ref()))
                .then_with(|| season_sort(a).total_cmp(&season_sort(b)))
                .then_with(|| match (a.episode, b.episode) {
                    (Some(x), Some(y)) => x.total_cmp(&y),
                    (Some(_), None) => Ordering::Less,
                    (None, Some(_)) => Ordering::Greater,
                    (None, None) => a.year.cmp(&b.year),
                })
                .then_with(|| parse::natural_cmp(&a.path.to_string_lossy(), &b.path.to_string_lossy()))
        });
        for (i, file) in self.files.iter_mut().enumerate() {
            file.sort = i as i64;
        }

        let used: Vec<bool> = (0..self.seasons.len())
            .map(|i| self.files.iter().any(|f| f.season == Some(i)))
            .collect();
        if used.iter().any(|u| !u) {
            let mut remap = vec![None; self.seasons.len()];
            let mut kept = Vec::new();
            for (i, season) in std::mem::take(&mut self.seasons).into_iter().enumerate() {
                if used[i] {
                    remap[i] = Some(kept.len());
                    kept.push(season);
                }
            }
            for file in &mut self.files {
                file.season = file.season.and_then(|i| remap[i]);
            }
            self.seasons = kept;
        }

        let movies = self.files.iter().filter(|f| f.role == Role::Movie).count();
        let episodes = self.files.iter().filter(|f| f.role == Role::Episode).count();
        self.is_movie = episodes == 0 && movies == 1;
        if self.is_movie {
            if let Some(movie) = self.files.iter().find(|f| f.role == Role::Movie) {
                self.year = self.year.or(movie.year);
            }
        }
    }
}

/// Extras of the seasons before those of the movies; headings by their place, then by name.
fn extra_order(a: Option<&ExtraGroup>, b: Option<&ExtraGroup>) -> Ordering {
    let (Some(a), Some(b)) = (a, b) else { return Ordering::Equal };
    a.movie
        .cmp(&b.movie)
        .then_with(|| a.sort.total_cmp(&b.sort))
        .then_with(|| match (&a.label, &b.label) {
            (Some(x), Some(y)) => parse::natural_cmp(x, y),
            (None, Some(_)) => Ordering::Less,
            (Some(_), None) => Ordering::Greater,
            (None, None) => Ordering::Equal,
        })
}

struct Entry {
    name: String,
    path: PathBuf,
    is_dir: bool,
    size: u64,
    mtime: i64,
}

/// Lists a folder, skipping hidden/system entries, in natural name order.
fn list(dir: &Path) -> io::Result<Vec<Entry>> {
    let mut entries = Vec::new();
    for item in fs::read_dir(dir)? {
        let Ok(item) = item else { continue };
        let name = item.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || name.starts_with('$') || name == "System Volume Information" {
            continue;
        }
        let Ok(meta) = item.metadata() else { continue };
        if is_hidden(&meta) {
            continue;
        }
        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map_or(0, |d| d.as_secs() as i64);
        entries.push(Entry { name, path: item.path(), is_dir: meta.is_dir(), size: meta.len(), mtime });
    }
    entries.sort_by(|a, b| parse::natural_cmp(&a.name, &b.name));
    Ok(entries)
}

#[cfg(windows)]
fn is_hidden(meta: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    const HIDDEN: u32 = 0x2;
    const SYSTEM: u32 = 0x4;
    meta.file_attributes() & (HIDDEN | SYSTEM) != 0
}

#[cfg(not(windows))]
fn is_hidden(_meta: &fs::Metadata) -> bool {
    false
}

fn videos_recursive(dir: &Path) -> Vec<Entry> {
    let mut out = Vec::new();
    let Ok(entries) = list(dir) else { return out };
    for entry in entries {
        if entry.is_dir {
            out.extend(videos_recursive(&entry.path));
        } else if parse::is_video(&entry.name) {
            out.push(entry);
        }
    }
    out
}

fn file_name(path: &Path) -> String {
    path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Prints what the scanner makes of the real library folders.
    /// Run with: cargo test dump_real_libraries -- --ignored --nocapture
    #[test]
    #[ignore]
    fn dump_real_libraries() {
        for (root, kind) in [
            (r"F:\Anime", LibraryKind::Anime),
            (r"F:\Cartoons", LibraryKind::Shows),
            (r"H:\Cartoons", LibraryKind::Shows),
            (r"F:\Mobies", LibraryKind::Movies),
            (r"D:\Anime", LibraryKind::Anime),
        ] {
            println!("########## {root}");
            let titles = scan_library(Path::new(root), kind).unwrap();
            for t in titles {
                let parent = t.parent_key.as_deref().map(|p| format!("  (inside {p})")).unwrap_or_default();
                let extras = t.files.iter().filter(|f| f.role == Role::Extra).count();
                if t.is_movie {
                    println!("MOVIE {} ({:?}){parent} key={} extras={extras}", t.name, t.year, t.key);
                    continue;
                }
                let kind = if t.is_movie { "MOVIE" } else { "SHOW" };
                println!("{kind} {} ({:?}){parent}", t.name, t.year);
                for (i, s) in t.seasons.iter().enumerate() {
                    let eps: Vec<&ScannedFile> = t.files.iter().filter(|f| f.season == Some(i)).collect();
                    let first = eps.first().map(|f| fmt_file(f)).unwrap_or_default();
                    let last = eps.last().map(|f| fmt_file(f)).unwrap_or_default();
                    println!("   [{}] {} — {} eps: {first} … {last}", s.sort, s.label, eps.len());
                }
                for f in t.files.iter().filter(|f| f.role == Role::Movie) {
                    println!("   movie: {} ({:?})", f.name.as_deref().unwrap_or("?"), f.year);
                }
                let mut last = None;
                for f in t.files.iter().filter(|f| f.role == Role::Extra) {
                    let group = f.extra.as_ref().map(|g| (g.movie, g.label.clone()));
                    if group != last {
                        let (movie, label) = group.clone().unwrap_or_default();
                        let side = if movie { "movie extras" } else { "extras" };
                        println!("   {side}: {}", label.as_deref().unwrap_or("(no heading)"));
                        last = group;
                    }
                    println!("      {}", f.name.as_deref().unwrap_or("?"));
                }
            }
        }
    }

    fn fmt_file(f: &ScannedFile) -> String {
        let ep = match (f.episode, f.episode_end) {
            (Some(a), Some(b)) => format!("E{a}-{b}"),
            (Some(a), None) => format!("E{a}"),
            _ => "E?".into(),
        };
        format!("{ep} {}", f.name.as_deref().unwrap_or(""))
    }
}
