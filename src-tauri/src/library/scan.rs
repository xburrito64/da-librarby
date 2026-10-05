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
    /// None for groups without a season number (One Pace arcs).
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
}

/// Scans one library folder. Fails only if the folder itself can't be read
/// (e.g. the drive is disconnected); unreadable subfolders are skipped.
pub fn scan_library(root: &Path, kind: LibraryKind) -> io::Result<Vec<ScannedTitle>> {
    let entries = list(root)?;
    let mut out = Vec::new();
    for entry in entries {
        let key = entry.name.clone();
        if entry.is_dir {
            match kind {
                LibraryKind::Movies => scan_movie_dir(&entry.path, &key, &mut out),
                LibraryKind::Anime | LibraryKind::Shows => scan_show(&entry.path, &key, None, &mut out),
            }
        } else if parse::is_video(&entry.name) {
            let (name, year) = parse::title_and_year(parse::file_stem(&entry.name));
            let mut title = ScannedTitle::new(key, None, name.clone(), year, root);
            title.push_file(&entry, Role::Movie, None, None, None, Some(name), year);
            title.finish();
            out.push(title);
        }
    }
    Ok(out)
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
            FolderKind::Extras => add_all(&mut title, &entry.path, Role::Extra),
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

    if !title.files.is_empty() {
        title.finish();
        out.push(title);
    }
    out.extend(nested);
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

    if has_season_dirs || (videos.len() >= 2 && with_season * 2 > videos.len()) {
        // Its own show living inside this one: "Adventure Time: Fionna and Cake", "Distant Lands".
        scan_show(&entry.path, sub_key, Some(key), nested);
    } else if numbered * 2 > videos.len()
        && (videos.len() >= 2 || parse::numbered_group(&entry.name).0.is_some())
    {
        // Numbered episodes grouped without a season number, like One Pace's story arcs
        // ("04. Gaimon" holds a single episode but is still an arc, not a movie).
        let (number, label) = parse::numbered_group(&entry.name);
        let season = title.add_group(&entry.name, label, number);
        add_season_dir(title, &entry.path, season, None);
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
        for child in children.iter().filter(|c| c.is_dir) {
            add_all(title, &child.path, Role::Extra);
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
                add_all(title, &entry.path, Role::Extra);
            } else {
                add_season_dir(title, &entry.path, season, folder_number);
            }
        } else if parse::is_video(&entry.name) {
            let p = parse::parse_episode(parse::file_stem(&entry.name));
            // Trust the file's episode number only if it belongs to this folder's season
            // (SAO's Specials folder holds "S01E26", which is special 1, not episode 26).
            let consistent = folder_number.is_none() || p.season.is_none() || p.season == folder_number;
            let (episode, episode_end) = if consistent { (p.episode, p.episode_end) } else { (None, None) };
            title.push_file(entry, Role::Episode, Some(season), episode, episode_end, p.title, None);
        }
    }
}

fn add_all(title: &mut ScannedTitle, dir: &Path, role: Role) {
    for video in videos_recursive(dir) {
        let name = parse::clean_text(&parse::strip_tags(parse::file_stem(&video.name)));
        title.push_file(&video, role, None, None, None, Some(name), None);
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
    for extra in &videos[1..] {
        let extra_name = parse::clean_text(&parse::strip_tags(parse::file_stem(&extra.name)));
        title.push_file(extra, Role::Extra, None, None, None, Some(extra_name), None);
    }
    for child in children.iter().filter(|c| c.is_dir) {
        add_all(&mut title, &child.path, Role::Extra);
    }
    title.finish();
    out.push(title);
}

// ---------------------------------------------------------------------------------------------

impl ScannedTitle {
    fn new(key: String, parent_key: Option<String>, name: String, year: Option<i32>, folder: &Path) -> Self {
        Self {
            key,
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
        if let Some(i) = self.seasons.iter().position(|s| s.number == Some(number)) {
            return i;
        }
        let label = if number == 0 { "Specials".to_string() } else { format!("Season {number}") };
        self.seasons.push(ScannedSeason {
            key: format!("s{number}"),
            number: Some(number),
            label,
            sort: number as f64,
        });
        self.seasons.len() - 1
    }

    fn add_group(&mut self, folder: &str, label: String, number: Option<f64>) -> usize {
        let sort = number.unwrap_or(1000.0 + self.seasons.len() as f64);
        self.seasons.push(ScannedSeason { key: format!("g:{folder}"), number: None, label, sort });
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
        });
    }

    /// Orders files (episodes by season and number, then movies, then extras) and
    /// drops seasons that ended up without episodes.
    fn finish(&mut self) {
        let seasons = &self.seasons;
        let season_sort = |f: &ScannedFile| f.season.map_or(f64::MAX, |i| seasons[i].sort);
        self.files.sort_by(|a, b| {
            a.role
                .cmp(&b.role)
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
        ] {
            println!("########## {root}");
            let titles = scan_library(Path::new(root), kind).unwrap();
            for t in titles {
                let parent = t.parent_key.as_deref().map(|p| format!("  (inside {p})")).unwrap_or_default();
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
                let extras = t.files.iter().filter(|f| f.role == Role::Extra).count();
                if extras > 0 {
                    println!("   extras: {extras}");
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
