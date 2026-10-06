//! One Pace, the fan re-edit of One Piece: episode titles and descriptions from the One Pace
//! team's episode guide (gathered at github.com/ladyisatis/one-pace-metadata), matched to the
//! files by the manga chapters in their names ("One Pace[8-11] - Orange Town - E01.mkv") or by
//! the checksum some names carry ("[839FC67B]"). Pictures come from the One Piece episodes each
//! One Pace episode is cut from.

use std::collections::{BTreeSet, HashMap};
use std::sync::LazyLock;
use std::time::Duration;

use regex::Regex;
use serde::Deserialize;

use super::anilist::Error;
use super::tmdb::{Episode, Season};

const DATA_URL: &str = "https://raw.githubusercontent.com/ladyisatis/one-pace-metadata/refs/heads/v2/metadata/data.min.json";
const USER_AGENT: &str = "DaLibrarby/0.1 (personal media library)";
/// Fuzzy chapter matches below this overlap are ignored.
const MIN_OVERLAP: f64 = 0.5;

static CHAPTERS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[(\d[\d,\s\-]*)\]").unwrap());
static CRC: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[([0-9A-Fa-f]{8})\]").unwrap());
static NUMBERS: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(\d+)(?:\s*-\s*(\d+))?").unwrap());

pub fn is_one_pace(title: &str) -> bool {
    let t = title.to_lowercase();
    t.trim() == "one pace" || t.starts_with("one pace ")
}

/// The episode guide, as downloaded (kept so it can be cached as-is).
pub fn download() -> Result<String, Error> {
    let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(60))).build().into();
    let mut response = agent
        .get(DATA_URL)
        .header("User-Agent", USER_AGENT)
        .call()
        .map_err(|e| Error::Unavailable(format!("One Pace guide: {e}")))?;
    response
        .body_mut()
        .with_config()
        .limit(50 * 1024 * 1024)
        .read_to_string()
        .map_err(|e| Error::Unavailable(format!("One Pace guide: {e}")))
}

#[derive(Debug, Clone)]
pub struct GuideEpisode {
    pub arc: i64,
    pub episode: i64,
    pub chapters: BTreeSet<i32>,
    /// One Piece episodes it's cut from, in order.
    pub anime: Vec<i32>,
    pub title: Option<String>,
    pub description: Option<String>,
}

pub struct Guide {
    episodes: Vec<GuideEpisode>,
    by_crc: HashMap<String, usize>,
    /// One Piece episodes each arc is made from.
    arc_anime: HashMap<i64, BTreeSet<i32>>,
}

#[derive(Deserialize)]
struct RawData {
    episodes: HashMap<String, RawEpisode>,
    #[serde(default)]
    descriptions: HashMap<String, Vec<RawDescription>>,
    #[serde(default)]
    arcs: HashMap<String, Vec<RawArc>>,
}

#[derive(Deserialize)]
struct RawArc {
    part: i64,
    info: Option<RawArcInfo>,
}

#[derive(Deserialize)]
struct RawArcInfo {
    anime_episodes: Option<String>,
}

#[derive(Deserialize)]
struct RawEpisode {
    arc: i64,
    episode: i64,
    manga_chapters: Option<String>,
    anime_episodes: Option<String>,
}

#[derive(Deserialize)]
struct RawDescription {
    arc: i64,
    episode: i64,
    title: Option<String>,
    description: Option<String>,
}

pub fn parse(json: &str) -> Result<Guide, String> {
    let raw: RawData = serde_json::from_str(json).map_err(|e| format!("One Pace guide unreadable: {e}"))?;
    let texts: HashMap<(i64, i64), &RawDescription> = raw
        .descriptions
        .get("en")
        .map(|list| list.iter().map(|d| ((d.arc, d.episode), d)).collect())
        .unwrap_or_default();
    let mut episodes = Vec::new();
    let mut by_crc = HashMap::new();
    // Several files (standard and extended cuts, older releases) can describe the same episode.
    let mut index: HashMap<(i64, i64), usize> = HashMap::new();
    let mut crcs: Vec<(&String, &RawEpisode)> = raw.episodes.iter().collect();
    crcs.sort_by(|a, b| a.0.cmp(b.0));
    for (crc, e) in crcs {
        let i = *index.entry((e.arc, e.episode)).or_insert_with(|| {
            let text = texts.get(&(e.arc, e.episode));
            episodes.push(GuideEpisode {
                arc: e.arc,
                episode: e.episode,
                chapters: BTreeSet::new(),
                anime: Vec::new(),
                title: text.and_then(|t| t.title.clone()).filter(|s| !s.trim().is_empty()),
                description: text.and_then(|t| t.description.clone()).filter(|s| !s.trim().is_empty()),
            });
            episodes.len() - 1
        });
        let ep = &mut episodes[i];
        if ep.chapters.is_empty() {
            ep.chapters = numbers(e.manga_chapters.as_deref().unwrap_or(""));
        }
        if ep.anime.is_empty() {
            ep.anime = numbers(e.anime_episodes.as_deref().unwrap_or("")).into_iter().collect();
        }
        by_crc.insert(crc.to_uppercase(), i);
    }
    let arc_anime = raw
        .arcs
        .get("en")
        .map(|arcs| {
            arcs.iter()
                .map(|a| (a.part, numbers(a.info.as_ref().and_then(|i| i.anime_episodes.as_deref()).unwrap_or(""))))
                .collect()
        })
        .unwrap_or_default();
    Ok(Guide { episodes, by_crc, arc_anime })
}

/// "8-11", "153-155, 142", "1 - 4, 19" -> the set of numbers.
fn numbers(text: &str) -> BTreeSet<i32> {
    let mut out = BTreeSet::new();
    for m in NUMBERS.captures_iter(text) {
        let a: i32 = m[1].parse().unwrap_or(0);
        let b: i32 = m.get(2).and_then(|b| b.as_str().parse().ok()).unwrap_or(a);
        if a > 0 && b >= a && b - a < 500 {
            out.extend(a..=b);
        }
    }
    out
}

/// One episode file: its id, its season (arc folder), episode number and file name.
pub struct FileInput {
    pub file_id: i64,
    pub season_id: Option<i64>,
    pub episode: Option<f64>,
    pub file_name: String,
}

/// Which guide episode each file is.
pub fn match_files<'g>(guide: &'g Guide, files: &[FileInput]) -> Vec<(i64, &'g GuideEpisode)> {
    // First pass: by checksum, else by the chapters in the name.
    let first: Vec<Option<(usize, f64)>> = files.iter().map(|f| guess(guide, &f.file_name)).collect();

    // Each folder is one arc: whichever arc its exact matches agree on.
    let mut votes: HashMap<Option<i64>, HashMap<i64, usize>> = HashMap::new();
    for (f, g) in files.iter().zip(&first) {
        if let Some((i, score)) = g {
            if *score >= 1.0 {
                *votes.entry(f.season_id).or_default().entry(guide.episodes[*i].arc).or_default() += 1;
            }
        }
    }
    let arc_of = |season: Option<i64>| {
        votes.get(&season).and_then(|v| v.iter().max_by_key(|(arc, n)| (**n, -**arc)).map(|(arc, _)| *arc))
    };

    let mut out = Vec::new();
    for (f, g) in files.iter().zip(first) {
        let arc = arc_of(f.season_id);
        let chosen = match (g, arc) {
            (Some((i, score)), _) if score >= 1.0 => Some(i),
            // A re-cut episode: the closest one within the folder's arc.
            (Some((i, _)), Some(arc)) if guide.episodes[i].arc == arc => Some(i),
            // Nothing close enough: the same episode number within the folder's arc.
            (_, Some(arc)) => f.episode.and_then(|n| {
                guide.episodes.iter().position(|e| e.arc == arc && e.episode as f64 == n)
            }),
            (Some((i, _)), None) => Some(i),
            (None, None) => None,
        };
        if let Some(i) = chosen {
            out.push((f.file_id, &guide.episodes[i]));
        }
    }
    out
}

/// Best guess for one file name: (episode index, how sure, 1.0 = exact).
fn guess(guide: &Guide, file_name: &str) -> Option<(usize, f64)> {
    for c in CRC.captures_iter(file_name) {
        if let Some(&i) = guide.by_crc.get(&c[1].to_uppercase()) {
            return Some((i, 1.0));
        }
    }
    let chapters = numbers(&CHAPTERS.captures(file_name)?[1]);
    if chapters.is_empty() {
        return None;
    }
    guide
        .episodes
        .iter()
        .enumerate()
        .map(|(i, e)| {
            let shared = chapters.intersection(&e.chapters).count() as f64;
            let all = chapters.union(&e.chapters).count() as f64;
            (i, if all > 0.0 { shared / all } else { 0.0 })
        })
        .filter(|(_, score)| *score >= MIN_OVERLAP)
        .max_by(|a, b| a.1.total_cmp(&b.1))
}

impl Guide {
    /// The One Piece episode whose picture fits a One Pace episode: the first one it's cut from
    /// that belongs to its arc. Some are cut from much later flashbacks (Romance Dawn 01 comes
    /// from episode 312, whose picture shows Water Seven); then the arc's first episode is used.
    fn picture_source(&self, g: &GuideEpisode) -> Option<i32> {
        let arc = self.arc_anime.get(&g.arc).filter(|a| !a.is_empty());
        match arc {
            Some(arc) => g.anime.iter().find(|n| arc.contains(n)).or_else(|| arc.first()).copied(),
            None => g.anime.first().copied(),
        }
    }
}

/// Turns matches into episode info: One Pace's own title and description, with the date and
/// picture of a One Piece episode it's cut from (`one_piece` = TMDB's seasons of One Piece).
pub fn episode_info(guide: &Guide, matches: &[(i64, &GuideEpisode)], one_piece: &[Season]) -> Vec<(i64, Vec<Episode>)> {
    let lookup = AbsoluteEpisodes::new(one_piece);
    matches
        .iter()
        .map(|(file_id, g)| {
            let source = guide.picture_source(g).and_then(|n| lookup.get(n));
            let info = Episode {
                season_number: source.map_or(0, |e| e.season_number),
                episode_number: source.map_or(0, |e| e.episode_number),
                name: g.title.clone().or_else(|| source.and_then(|e| e.name.clone())),
                overview: g.description.clone().or_else(|| source.and_then(|e| e.overview.clone())),
                air_date: source.and_then(|e| e.air_date.clone()),
                still_path: source.and_then(|e| e.still_path.clone()),
                runtime: None,
            };
            (*file_id, vec![info])
        })
        .collect()
}

/// One Piece episodes by their overall number (1 to 1100+), whether TMDB numbers them per
/// season or straight through.
struct AbsoluteEpisodes<'a> {
    by_number: HashMap<i32, &'a Episode>,
}

impl<'a> AbsoluteEpisodes<'a> {
    fn new(seasons: &'a [Season]) -> Self {
        let mut regular: Vec<&Season> = seasons.iter().filter(|s| s.season_number > 0 && !s.episodes.is_empty()).collect();
        regular.sort_by_key(|s| s.season_number);
        let straight_through = regular.windows(2).all(|w| {
            let last = w[0].episodes.iter().map(|e| e.episode_number).max().unwrap_or(0);
            let first = w[1].episodes.iter().map(|e| e.episode_number).min().unwrap_or(0);
            first > last
        });
        let mut by_number = HashMap::new();
        let mut counter = 0;
        for season in regular {
            let mut eps: Vec<&Episode> = season.episodes.iter().collect();
            eps.sort_by_key(|e| e.episode_number);
            for e in eps {
                counter += 1;
                by_number.insert(if straight_through { e.episode_number } else { counter }, e);
            }
        }
        Self { by_number }
    }

    fn get(&self, n: i32) -> Option<&'a Episode> {
        self.by_number.get(&n).copied()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DATA: &str = r#"{
      "episodes": {
        "E5F09F49": {"arc": 1, "episode": 1, "manga_chapters": "1", "anime_episodes": "312"},
        "A465972A": {"arc": 1, "episode": 2, "manga_chapters": "2", "anime_episodes": "1-2"},
        "2DEB2701": {"arc": 1, "episode": 3, "manga_chapters": "3-4", "anime_episodes": "2-3"},
        "6E46167D": {"arc": 1, "episode": 4, "manga_chapters": "5-7", "anime_episodes": "3-4, 19"},
        "11111111": {"arc": 20, "episode": 2, "manga_chapters": "433-434", "anime_episodes": "313"},
        "22222222": {"arc": 20, "episode": 3, "manga_chapters": "", "anime_episodes": "314"},
        "839FC67B": {"arc": 12, "episode": 5, "manga_chapters": "127-129", "anime_episodes": "77"}
      },
      "arcs": {"en": [{"part": 1, "info": {"anime_episodes": "1 - 4, 19"}}]},
      "descriptions": {"en": [
        {"arc": 1, "episode": 1, "title": "Romance Dawn, the Dawn of an Adventure", "description": "Luffy sets out."},
        {"arc": 20, "episode": 3, "title": "Aftermath", "description": ""}
      ]}
    }"#;

    fn file(id: i64, season: i64, episode: f64, name: &str) -> FileInput {
        FileInput { file_id: id, season_id: Some(season), episode: Some(episode), file_name: name.into() }
    }

    fn matched(files: &[FileInput]) -> Vec<(i64, i64, i64)> {
        let guide = parse(DATA).unwrap();
        match_files(&guide, files).into_iter().map(|(f, g)| (f, g.arc, g.episode)).collect()
    }

    #[test]
    fn matches_by_chapters_checksum_and_arc() {
        let out = matched(&[
            file(1, 10, 1.0, "One Pace[1] - Romance Dawn - E01.mkv"),
            file(2, 10, 3.0, "One Pace[3-5] - Romance Dawn - E03.mkv"), // re-cut since: closest in the arc
            file(3, 10, 4.0, "One Pace[5-7] - Romance Dawn - E04.mkv"),
            file(4, 11, 5.0, "[One Pace][127-129] Little Garden 05 [1080p][839FC67B].mkv"),
            file(5, 12, 2.0, "One Pace[433-434] Post-Enies Lobby 02.mkv"),
            file(6, 12, 3.0, "One Pace[436-437] Post-Enies Lobby 03.mkv"), // no chapters listed: by number
        ]);
        assert_eq!(out, [(1, 1, 1), (2, 1, 3), (3, 1, 4), (4, 12, 5), (5, 20, 2), (6, 20, 3)]);
    }

    #[test]
    fn resolution_tags_are_not_chapters() {
        assert_eq!(matched(&[file(1, 10, 1.0, "One Pace [1080p] - Something - E01.mkv")]), []);
    }

    #[test]
    fn one_piece_episodes_by_overall_number() {
        let ep = |s: i32, n: i32| Episode {
            season_number: s,
            episode_number: n,
            name: Some(format!("S{s}E{n}")),
            overview: None,
            air_date: None,
            still_path: None,
            runtime: None,
        };
        // Numbered per season.
        let per_season = [Season { season_number: 1, episodes: vec![ep(1, 1), ep(1, 2)] }, Season { season_number: 2, episodes: vec![ep(2, 1)] }];
        assert_eq!(AbsoluteEpisodes::new(&per_season).get(3).and_then(|e| e.name.clone()).as_deref(), Some("S2E1"));
        // Numbered straight through.
        let straight = [Season { season_number: 1, episodes: vec![ep(1, 1), ep(1, 2)] }, Season { season_number: 2, episodes: vec![ep(2, 3)] }];
        assert_eq!(AbsoluteEpisodes::new(&straight).get(3).and_then(|e| e.name.clone()).as_deref(), Some("S2E3"));

        // Romance Dawn 01 is cut from episode 312 (a later flashback): the picture comes from
        // its own arc instead. Romance Dawn 02 is cut from episode 1-2 as usual.
        let guide = parse(DATA).unwrap();
        let matches = match_files(
            &guide,
            &[file(1, 10, 1.0, "One Pace[1] - Romance Dawn - E01.mkv"), file(2, 10, 2.0, "One Pace[2] - Romance Dawn - E02.mkv")],
        );
        let info = episode_info(&guide, &matches, &per_season);
        assert_eq!(info[0].1[0].name.as_deref(), Some("Romance Dawn, the Dawn of an Adventure"));
        assert_eq!(info[0].1[0].overview.as_deref(), Some("Luffy sets out."));
        assert_eq!((info[0].1[0].season_number, info[0].1[0].episode_number), (1, 1));
        assert_eq!((info[1].1[0].season_number, info[1].1[0].episode_number), (1, 1));
    }
}
