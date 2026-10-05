//! Lines up a show folder with AniList.
//!
//! AniList lists every season (and often every half-season "cour") as its own entry,
//! while folders group them under one show. So:
//!   1. find the show's first TV entry (search, then walk back through prequels),
//!   2. follow the chain of sequels until it covers all episodes on disk,
//!   3. number every episode across the whole run and see which entry it falls into.
//! Mushoku Tensei S1 (23 episodes) thereby becomes Part 1 (11) + Part 2 (12).

use std::collections::{HashMap, HashSet};

use super::anilist::{is_series_format, Error, Media, RelationNode};

/// Where AniList data comes from (cached in the app, or a fake in tests).
pub trait Source {
    fn media(&mut self, ids: &[i64]) -> Result<HashMap<i64, Media>, Error>;
    fn search(&mut self, query: &str, formats: Option<&[&str]>) -> Result<Vec<Media>, Error>;
}

/// A hand-made choice: `Some(Some(id))` = use this entry, `Some(None)` = no match, `None` = automatic.
pub type Locked = Option<Option<i64>>;

pub struct ShowInput {
    pub name: String,
    /// From the folder name, if it has one ("South Park (1997)").
    pub year: Option<i32>,
    pub is_movie: bool,
    pub locked_root: Locked,
    pub seasons: Vec<SeasonInput>,
    pub movies: Vec<MovieInput>,
}

pub struct SeasonInput {
    pub id: i64,
    pub number: Option<i32>,
    /// Entries picked by hand for this season, in order.
    pub locked: Option<Vec<i64>>,
    pub episodes: Vec<EpisodeInput>,
}

pub struct EpisodeInput {
    pub file_id: i64,
    pub episode: Option<f64>,
    /// Last episode in a multi-episode file ("S01E01-E03").
    pub episode_end: Option<f64>,
    /// Title from the file name, if any.
    pub name: Option<String>,
}

pub struct MovieInput {
    pub file_id: i64,
    pub name: String,
    pub year: Option<i32>,
    pub locked: Locked,
}

pub struct ShowMatch {
    pub root: Option<Media>,
    /// The main run, in order (empty for movies or unmatched shows).
    pub chain: Vec<Media>,
    pub seasons: Vec<SeasonMatch>,
    pub episodes: Vec<EpisodeMatch>,
    pub movies: Vec<MovieMatch>,
}

pub struct SeasonMatch {
    pub season_id: i64,
    pub entries: Vec<Media>,
    pub locked: bool,
}

pub struct EpisodeMatch {
    pub file_id: i64,
    /// The AniList entry and its own episode number (what AniList progress sync will need).
    pub media_id: Option<i64>,
    pub episode: Option<i32>,
}

pub struct MovieMatch {
    pub file_id: i64,
    pub media: Option<Media>,
    pub locked: bool,
}

const MIN_SIMILARITY: f64 = 0.8;

pub fn match_show(input: &ShowInput, src: &mut dyn Source) -> Result<ShowMatch, Error> {
    let mut seen: Vec<Media> = Vec::new(); // every entry fetched, for finding related movies

    // 1. The show itself.
    let root = match input.locked_root {
        Some(Some(id)) => fetch_one(src, id)?,
        Some(None) => None,
        None => find_root(input, src, &mut seen)?,
    };
    if let Some(r) = &root {
        seen.push(r.clone());
    }

    // 2 + 3. Seasons and episodes.
    let globals = global_numbers(&input.seasons);
    let need = globals.values().copied().max().unwrap_or(0);
    let chain = match &root {
        Some(r) if !input.is_movie && is_series_format(r.format.as_deref(), r.episodes) => {
            build_chain(r.clone(), need, src, &mut seen)?
        }
        _ => Vec::new(),
    };
    let ranges = ranges(&chain);

    let mut seasons = Vec::new();
    let mut episodes = Vec::new();
    for season in &input.seasons {
        if let Some(ids) = &season.locked {
            let fetched = src.media(ids)?;
            let entries: Vec<Media> = ids.iter().filter_map(|id| fetched.get(id).cloned()).collect();
            seen.extend(entries.iter().cloned());
            let local = ranges_of(&entries);
            for ep in &season.episodes {
                let hit = whole(ep.episode).and_then(|n| locate(&local, n));
                episodes.push(EpisodeMatch { file_id: ep.file_id, media_id: hit.map(|h| h.0), episode: hit.map(|h| h.1) });
            }
            seasons.push(SeasonMatch { season_id: season.id, entries, locked: true });
            continue;
        }

        let mut entry_ids: Vec<i64> = Vec::new();
        for ep in &season.episodes {
            let hit = globals.get(&ep.file_id).and_then(|&g| locate(&ranges, g));
            if let Some((id, _)) = hit {
                if !entry_ids.contains(&id) {
                    entry_ids.push(id);
                }
            }
            episodes.push(EpisodeMatch { file_id: ep.file_id, media_id: hit.map(|h| h.0), episode: hit.map(|h| h.1) });
        }
        let entries = entry_ids.iter().filter_map(|id| chain.iter().find(|m| m.id == *id).cloned()).collect();
        seasons.push(SeasonMatch { season_id: season.id, entries, locked: false });
    }

    // Movies stored inside the show folder.
    let mut movies = Vec::new();
    for movie in &input.movies {
        let media = match movie.locked {
            Some(Some(id)) => fetch_one(src, id)?,
            Some(None) => None,
            None if input.is_movie => root.clone(),
            None => find_movie(movie, &input.name, &seen, src)?,
        };
        movies.push(MovieMatch { file_id: movie.file_id, media, locked: movie.locked.is_some() });
    }

    Ok(ShowMatch { root, chain, seasons, episodes, movies })
}

fn fetch_one(src: &mut dyn Source, id: i64) -> Result<Option<Media>, Error> {
    Ok(src.media(&[id])?.remove(&id))
}

/// Searches for the show and walks back to its first season.
fn find_root(input: &ShowInput, src: &mut dyn Source, seen: &mut Vec<Media>) -> Result<Option<Media>, Error> {
    let formats: Option<&[&str]> = if input.is_movie { Some(&["MOVIE", "OVA", "SPECIAL", "ONA"]) } else { None };
    let results = src.search(&input.name, formats)?;

    let best = results
        .iter()
        .enumerate()
        .map(|(rank, m)| {
            let sim = best_similarity(&input.name, &m.all_titles());
            let wanted_format = if input.is_movie {
                m.format.as_deref() == Some("MOVIE")
            } else {
                is_series_format(m.format.as_deref(), m.episodes)
            };
            let score = sim + if wanted_format { 0.05 } else { 0.0 } - rank as f64 * 0.01;
            (score, sim, m)
        })
        .filter(|(_, sim, _)| *sim >= MIN_SIMILARITY)
        .max_by(|a, b| a.0.total_cmp(&b.0))
        .map(|(_, _, m)| m.clone());

    let Some(mut root) = best else { return Ok(None) };
    if input.is_movie || !is_series_format(root.format.as_deref(), root.episodes) {
        return Ok(Some(root));
    }

    // The search may have found a later season ("Kaiji" finds Kaiji 2): go back to the start
    // through entries that still carry the show's name. Movies/OVAs may be stepped through
    // (a season's prequel can be a movie), but only a TV entry can become the start.
    let mut cursor = root.clone();
    let mut visited = HashSet::from([root.id]);
    for _ in 0..10 {
        let prequels: Vec<&RelationNode> = cursor
            .relations()
            .filter(|e| e.relation_type.as_deref() == Some("PREQUEL"))
            .map(|e| &e.node)
            .filter(|n| !visited.contains(&n.id))
            .filter(|n| best_similarity(&input.name, &n.all_titles()) >= MIN_SIMILARITY)
            .collect();
        let latest = |nodes: Vec<&&RelationNode>| nodes.into_iter().max_by_key(|n| n.year().unwrap_or(0)).map(|n| n.id);
        let series: Vec<&&RelationNode> =
            prequels.iter().filter(|n| is_series_format(n.format.as_deref(), n.episodes)).collect();
        let next = if series.is_empty() { latest(prequels.iter().collect()) } else { latest(series) };
        let Some(id) = next else { break };
        visited.insert(id);
        let Some(previous) = fetch_one(src, id)? else { break };
        seen.push(previous.clone());
        if is_series_format(previous.format.as_deref(), previous.episodes) {
            root = previous.clone();
        }
        cursor = previous;
    }
    Ok(Some(root))
}

/// Follows sequels from `root` until the run covers `need` episodes.
fn build_chain(root: Media, need: i32, src: &mut dyn Source, seen: &mut Vec<Media>) -> Result<Vec<Media>, Error> {
    let mut total = root.episodes.unwrap_or(i32::MAX);
    let mut chain = vec![root.clone()];
    let mut visited: HashSet<i64> = HashSet::from([root.id]);
    let mut current = root;

    for _ in 0..30 {
        if total >= need {
            break;
        }
        let sequels: Vec<&RelationNode> = current
            .relations()
            .filter(|e| e.relation_type.as_deref() == Some("SEQUEL"))
            .map(|e| &e.node)
            .filter(|n| !visited.contains(&n.id))
            .collect();
        // Prefer the next TV season; otherwise step through a movie/OVA to reach the one after it
        // (SAO II's sequel is a movie, whose sequel is Alicization).
        let next = sequels
            .iter()
            .filter(|n| is_series_format(n.format.as_deref(), n.episodes))
            .min_by_key(|n| n.year().unwrap_or(i32::MAX))
            .or_else(|| sequels.iter().min_by_key(|n| n.year().unwrap_or(i32::MAX)))
            .map(|n| n.id);
        let Some(id) = next else { break };
        visited.insert(id);
        let Some(media) = fetch_one(src, id)? else { break };
        seen.push(media.clone());
        if is_series_format(media.format.as_deref(), media.episodes) {
            total = total.saturating_add(media.episodes.unwrap_or(i32::MAX));
            chain.push(media.clone());
        }
        current = media;
    }
    Ok(chain)
}

/// Numbers every whole episode across the show's run, keyed by file id.
/// Seasons that continue the count (Naruto's season 2 starts at episode 58) are kept as they are.
pub(crate) fn global_numbers(seasons: &[SeasonInput]) -> HashMap<i64, i32> {
    let mut numbered: Vec<&SeasonInput> = seasons.iter().filter(|s| s.number.is_some_and(|n| n > 0)).collect();
    numbered.sort_by_key(|s| s.number);

    let mut out = HashMap::new();
    let mut offset = 0;
    for season in numbered {
        let eps: Vec<(i64, i32)> =
            season.episodes.iter().filter_map(|e| whole(e.episode).map(|n| (e.file_id, n))).collect();
        let (Some(min), Some(max)) = (eps.iter().map(|e| e.1).min(), eps.iter().map(|e| e.1).max()) else {
            continue;
        };
        let continues_count = min > 1 && min as usize > eps.len();
        if continues_count {
            for (file_id, n) in eps {
                out.insert(file_id, n);
            }
            offset = max;
            continue;
        }
        // An "episode 0" (Mushoku Tensei S2's "Guardian Fitz") is counted by AniList as the
        // season's first episode, so everything after it shifts by one.
        let zero = season.episodes.iter().find(|e| e.episode == Some(0.0));
        let shift = zero.is_some() as i32;
        if let Some(zero) = zero {
            out.insert(zero.file_id, offset + 1);
        }
        for (file_id, n) in eps {
            out.insert(file_id, offset + n + shift);
        }
        offset += max + shift;
    }
    out
}

/// Episode number as a whole number ≥ 1 (0 and 14.5 are specials and aren't mapped).
pub(crate) fn whole(episode: Option<f64>) -> Option<i32> {
    episode.filter(|e| *e >= 1.0 && e.fract() == 0.0).map(|e| e as i32)
}

/// (entry id, first episode before it, its episode count) for a run of entries.
fn ranges(chain: &[Media]) -> Vec<(i64, i32, i32)> {
    ranges_of(chain)
}

fn ranges_of(entries: &[Media]) -> Vec<(i64, i32, i32)> {
    let mut start = 0i32;
    entries
        .iter()
        .map(|m| {
            let len = m.episodes.unwrap_or(i32::MAX);
            let range = (m.id, start, len);
            start = start.saturating_add(len);
            range
        })
        .collect()
}

/// Which entry episode `n` (counted across the run) belongs to, and its number within that entry.
fn locate(ranges: &[(i64, i32, i32)], n: i32) -> Option<(i64, i32)> {
    ranges.iter().find(|(_, start, len)| n > *start && n - start <= *len).map(|(id, start, _)| (*id, n - start))
}

/// Finds a movie that lives in a show folder: first among the franchise's related entries, then by search.
fn find_movie(movie: &MovieInput, show_name: &str, seen: &[Media], src: &mut dyn Source) -> Result<Option<Media>, Error> {
    let mut candidates: Vec<&RelationNode> = seen
        .iter()
        .flat_map(|m| m.relations())
        .map(|e| &e.node)
        .filter(|n| n.format.as_deref() == Some("MOVIE"))
        .collect();
    candidates.dedup_by_key(|n| n.id);

    let names = movie_names(&movie.name, show_name);
    let related = candidates
        .iter()
        .map(|n| (names.iter().map(|q| best_similarity(q, &n.all_titles())).fold(0.0, f64::max), n))
        .filter(|(sim, _)| *sim >= 0.85)
        .max_by(|a, b| a.0.total_cmp(&b.0))
        .map(|(_, n)| n.id);
    if let Some(id) = related {
        return fetch_one(src, id);
    }

    let results = src.search(&movie.name, Some(&["MOVIE", "OVA", "SPECIAL", "ONA"]))?;
    Ok(results
        .into_iter()
        .map(|m| {
            let sim = names.iter().map(|q| best_similarity(q, &m.all_titles())).fold(0.0, f64::max);
            let year_bonus = if movie.year.is_some() && movie.year == m.year() { 0.05 } else { 0.0 };
            (sim + year_bonus, sim, m)
        })
        .filter(|(_, sim, _)| *sim >= 0.85)
        .max_by(|a, b| a.0.total_cmp(&b.0))
        .map(|(_, _, m)| m))
}

/// The movie's name as written, and without the show's name in front
/// ("Naruto The Movie - Legend Of The Stone Of Gelel" -> "Legend Of The Stone Of Gelel").
fn movie_names(name: &str, show_name: &str) -> Vec<String> {
    let mut names = vec![name.to_string()];
    let n = normalize(name);
    let show = normalize(show_name);
    if let Some(rest) = n.strip_prefix(&show) {
        let rest = rest.trim().trim_start_matches("the movie").trim();
        if rest.len() > 3 {
            names.push(rest.to_string());
        }
    }
    names
}

pub fn normalize(s: &str) -> String {
    let lowered: String = s
        .chars()
        .map(|c| if c.is_alphanumeric() { c.to_lowercase().next().unwrap_or(c) } else { ' ' })
        .collect();
    lowered.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// How alike two titles are, 0..1. Exact (ignoring case and punctuation) is 1.0;
/// one being the start of the other ("Mushoku Tensei" / "Mushoku Tensei: Isekai...") is 0.9.
pub fn similarity(a: &str, b: &str) -> f64 {
    let (a, b) = (normalize(a), normalize(b));
    if a.is_empty() || b.is_empty() {
        return 0.0;
    }
    if a == b {
        return 1.0;
    }
    if let Some(rest) = b.strip_prefix(&format!("{a} ")).or_else(|| a.strip_prefix(&format!("{b} "))) {
        // "Kaiji" vs "Kaiji 2": a bare sequel number is a weaker match than a subtitle
        // ("Mushoku Tensei: Isekai..."), so an un-numbered entry wins when both exist.
        return if is_sequel_number(rest) { 0.85 } else { 0.9 };
    }
    // Overlap of letter pairs: tolerant of small differences, strict with short names
    // ("One Pace" is not "One Piece").
    strsim::sorensen_dice(&a, &b) * 0.95
}

pub(crate) fn is_sequel_number(rest: &str) -> bool {
    let words: Vec<&str> = rest.split_whitespace().collect();
    let numeric = |w: &&str| w.chars().all(|c| c.is_ascii_digit()) || ["ii", "iii", "iv", "v", "2nd", "3rd"].contains(w);
    words.iter().any(numeric) && words.iter().all(|w| numeric(w) || ["part", "season", "cour"].contains(w))
}

pub(crate) fn best_similarity(query: &str, titles: &[&str]) -> f64 {
    titles.iter().map(|t| similarity(query, t)).fold(0.0, f64::max)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::metadata::anilist::{RelationEdge, Relations, Title};

    fn media(id: i64, format: &str, episodes: Option<i32>, title: &str, relations: &[(&str, i64, &str, i32, &str)]) -> Media {
        Media {
            id,
            kind: Some("ANIME".into()),
            format: Some(format.into()),
            episodes,
            status: Some("FINISHED".into()),
            season_year: None,
            start_date: None,
            title: Title { romaji: Some(title.into()), english: None, native: None },
            synonyms: vec![],
            description: None,
            genres: vec![],
            average_score: None,
            cover_image: None,
            banner_image: None,
            studios: None,
            relations: Some(Relations {
                edges: relations
                    .iter()
                    .map(|(kind, id, format, year, node_title)| RelationEdge {
                        relation_type: Some(kind.to_string()),
                        node: RelationNode {
                            id: *id,
                            kind: Some("ANIME".into()),
                            format: Some(format.to_string()),
                            episodes: None,
                            status: None,
                            title: Title { romaji: Some(node_title.to_string()), english: None, native: None },
                            start_date: Some(crate::metadata::anilist::FuzzyDate { year: Some(*year), month: None, day: None }),
                        },
                    })
                    .collect(),
            }),
        }
    }

    struct Fake(HashMap<i64, Media>, Vec<i64>);

    impl Source for Fake {
        fn media(&mut self, ids: &[i64]) -> Result<HashMap<i64, Media>, Error> {
            Ok(ids.iter().filter_map(|id| self.0.get(id).map(|m| (*id, m.clone()))).collect())
        }
        fn search(&mut self, _q: &str, _f: Option<&[&str]>) -> Result<Vec<Media>, Error> {
            Ok(self.1.iter().map(|id| self.0[id].clone()).collect())
        }
    }

    fn season(id: i64, number: i32, eps: std::ops::RangeInclusive<i32>) -> SeasonInput {
        SeasonInput {
            id,
            number: Some(number),
            locked: None,
            episodes: eps.map(|e| EpisodeInput { file_id: id * 1000 + e as i64, episode: Some(e as f64), episode_end: None, name: None }).collect(),
        }
    }

    #[test]
    fn split_seasons_and_later_search_hits() {
        // Search finds season 2; it must walk back to season 1, then forward through
        // the cours, stepping through a movie in between.
        let all = [
            media(1, "TV", Some(11), "Show", &[("SEQUEL", 2, "TV", 2021, "Show Part 2")]),
            media(2, "TV", Some(12), "Show Part 2", &[("PREQUEL", 1, "TV", 2021, "Show"), ("SEQUEL", 3, "MOVIE", 2022, "Show Movie")]),
            media(3, "MOVIE", Some(1), "Show Movie", &[("PREQUEL", 2, "TV", 2021, "Show Part 2"), ("SEQUEL", 4, "TV", 2023, "Show II")]),
            media(4, "TV", Some(12), "Show II", &[("PREQUEL", 3, "MOVIE", 2022, "Show Movie"), ("PREQUEL", 9, "OVA", 2020, "Show OVA")]),
        ];
        let mut src = Fake(all.into_iter().map(|m| (m.id, m)).collect(), vec![4]);
        let input = ShowInput {
            name: "Show".into(),
            year: None,
            is_movie: false,
            locked_root: None,
            seasons: vec![season(10, 1, 1..=23), season(20, 2, 1..=12)],
            movies: vec![MovieInput { file_id: 99, name: "Show Movie".into(), year: None, locked: None }],
        };
        let m = match_show(&input, &mut src).unwrap();
        assert_eq!(m.root.as_ref().unwrap().id, 1);
        assert_eq!(m.chain.iter().map(|c| c.id).collect::<Vec<_>>(), [1, 2, 4]);
        let ids = |i: usize| m.seasons[i].entries.iter().map(|e| e.id).collect::<Vec<_>>();
        assert_eq!(ids(0), [1, 2]);
        assert_eq!(ids(1), [4]);
        let ep = |file: i64| m.episodes.iter().find(|e| e.file_id == file).map(|e| (e.media_id, e.episode)).unwrap();
        assert_eq!(ep(10_011), (Some(1), Some(11)));
        assert_eq!(ep(10_012), (Some(2), Some(1)));
        assert_eq!(ep(20_001), (Some(4), Some(1)));
        assert_eq!(m.movies[0].media.as_ref().map(|m| m.id), Some(3));
    }

    #[test]
    fn continuous_numbering() {
        // Naruto-style: one 220-episode entry, season folders numbered 1..57, 58..100.
        let all = [media(1, "TV", Some(220), "Naruto", &[])];
        let mut src = Fake(all.into_iter().map(|m| (m.id, m)).collect(), vec![1]);
        let input = ShowInput {
            name: "Naruto".into(),
            year: None,
            is_movie: false,
            locked_root: None,
            seasons: vec![season(1, 1, 1..=57), season(2, 2, 58..=100)],
            movies: vec![],
        };
        let m = match_show(&input, &mut src).unwrap();
        let ep = |file: i64| m.episodes.iter().find(|e| e.file_id == file).map(|e| e.episode).unwrap();
        assert_eq!(ep(2_058), Some(58));
        assert_eq!(ep(1_057), Some(57));
    }

    #[test]
    fn similarities() {
        assert_eq!(similarity("Jujutsu Kaisen 0", "JUJUTSU KAISEN 0"), 1.0);
        assert_eq!(similarity("Chainsaw Man – The Movie Reze Arc", "Chainsaw Man – The Movie: Reze Arc"), 1.0);
        assert_eq!(similarity("Mushoku Tensei", "Mushoku Tensei: Isekai Ittara Honki Dasu"), 0.9);
        assert!(similarity("One Pace", "One Piece") < MIN_SIMILARITY);
        assert!(similarity("Naruto", "Boruto: Naruto Next Generations") < MIN_SIMILARITY);
        let part = "South Park: The Streaming Wars Part";
        assert!(similarity(part, "South Park: The Streaming Wars") > similarity(part, "South Park the Streaming Wars Part 2"));
    }
}

#[cfg(test)]
mod live {
    use super::*;
    use crate::library::scan::{scan_library, LibraryKind, Role};
    use crate::metadata::anilist::AniList;

    struct Live(AniList, HashMap<i64, Media>);

    impl Source for Live {
        fn media(&mut self, ids: &[i64]) -> Result<HashMap<i64, Media>, Error> {
            let missing: Vec<i64> = ids.iter().copied().filter(|i| !self.1.contains_key(i)).collect();
            for m in self.0.media(&missing)? {
                self.1.insert(m.id, m);
            }
            Ok(ids.iter().filter_map(|i| self.1.get(i).map(|m| (*i, m.clone()))).collect())
        }
        fn search(&mut self, q: &str, f: Option<&[&str]>) -> Result<Vec<Media>, Error> {
            let results = self.0.search(q, f)?;
            for m in &results {
                self.1.insert(m.id, m.clone());
            }
            Ok(results)
        }
    }

    /// Matches the real anime folder against AniList and prints the result.
    /// cargo test live_anime_matching -- --ignored --nocapture
    #[test]
    #[ignore]
    fn live_anime_matching() {
        let mut src = Live(AniList::new(), HashMap::new());
        let titles = scan_library(std::path::Path::new(r"F:\Anime"), LibraryKind::Anime).unwrap();
        let mut next_id = 1;
        for t in titles {
            let mut ids = |_: ()| { next_id += 1; next_id };
            let seasons: Vec<SeasonInput> = t
                .seasons
                .iter()
                .enumerate()
                .map(|(i, s)| SeasonInput {
                    id: i as i64,
                    number: s.number,
                    locked: None,
                    episodes: t
                        .files
                        .iter()
                        .enumerate()
                        .filter(|(_, f)| f.season == Some(i))
                        .map(|(j, f)| EpisodeInput { file_id: j as i64, episode: f.episode, episode_end: f.episode_end, name: f.name.clone() })
                        .collect(),
                })
                .collect();
            let movies = t
                .files
                .iter()
                .enumerate()
                .filter(|(_, f)| f.role == Role::Movie)
                .map(|(j, f)| MovieInput { file_id: j as i64, name: f.name.clone().unwrap_or_default(), year: f.year, locked: None })
                .collect();
            let _ = ids(());
            let input = ShowInput { name: t.name.clone(), year: t.year, is_movie: t.is_movie, locked_root: None, seasons, movies };
            let m = match_show(&input, &mut src).unwrap();
            println!("=== {} -> {}", t.name, m.root.as_ref().map(|r| format!("{} {} ({:?})", r.id, r.display_title(), r.format)).unwrap_or("NO MATCH".into()));
            for (s, sm) in t.seasons.iter().zip(&m.seasons) {
                let eps: Vec<&EpisodeMatch> = m.episodes.iter().filter(|e| t.files[e.file_id as usize].season == t.seasons.iter().position(|x| std::ptr::eq(x, s))).collect();
                let mapped = eps.iter().filter(|e| e.media_id.is_some()).count();
                let names: Vec<String> = sm.entries.iter().map(|e| format!("{} [{}ep]", e.display_title(), e.episodes.unwrap_or(-1))).collect();
                println!("   {} ({} eps, {} mapped): {}", s.label, eps.len(), mapped, names.join(" + "));
            }
            for mm in &m.movies {
                let name = t.files[mm.file_id as usize].name.clone().unwrap_or_default();
                println!("   movie {name} -> {}", mm.media.as_ref().map(|x| format!("{} {}", x.id, x.display_title())).unwrap_or("NO MATCH".into()));
            }
        }
    }
}

#[cfg(test)]
mod episode_zero {
    use super::*;

    #[test]
    fn episode_zero_counts_as_first() {
        let mk = |id: i64, number: i32, eps: &[f64]| SeasonInput {
            id,
            number: Some(number),
            locked: None,
            episodes: eps.iter().map(|&e| EpisodeInput { file_id: id * 100 + e as i64, episode: Some(e), episode_end: None, name: None }).collect(),
        };
        let seasons = [mk(1, 1, &[1.0, 2.0]), mk(2, 2, &[0.0, 1.0, 2.0]), mk(3, 3, &[1.0])];
        let g = global_numbers(&seasons);
        assert_eq!(g[&200], 3); // S2E0 follows S1's 2 episodes
        assert_eq!(g[&201], 4);
        assert_eq!(g[&202], 5);
        assert_eq!(g[&301], 6); // S3 isn't shifted by the zero
    }
}
