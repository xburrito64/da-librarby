//! Lines up shows and movies with TMDB, and fetches per-episode info (descriptions,
//! thumbnails) for anime, which AniList doesn't have.

use std::collections::HashMap;

use super::anilist::Error;
use super::anime_match::{best_similarity, global_numbers, similarity, whole, SeasonInput, ShowInput};
use super::tmdb::{Episode, Movie, SearchResult, Season, SeasonSummary, Tmdb, TvShow};

const MIN_SIMILARITY: f64 = 0.8;
const ANIMATION_GENRE: i64 = 16;

pub struct TvMatch {
    pub show: Option<TvShow>,
    /// TMDB season for each of our seasons, by our season id.
    pub seasons: Vec<(i64, Option<SeasonSummary>)>,
    /// TMDB episodes for each episode file (several for "S01E01-E03" files).
    pub episodes: Vec<(i64, Vec<Episode>)>,
    pub movies: Vec<MovieMatch>,
}

pub struct MovieMatch {
    pub file_id: i64,
    pub movie: Option<Movie>,
    pub locked: bool,
}

/// A TV show folder (and any movies inside it).
pub fn match_tv(input: &ShowInput, tmdb: &Tmdb) -> Result<TvMatch, Error> {
    let id = match input.locked_root {
        Some(id) => id,
        None => find_tv(&[input.name.as_str()], input.year, false, tmdb)?.map(|r| r.id),
    };
    let (show, seasons) = match id {
        Some(id) => {
            let (show, seasons) = tmdb.tv_with_seasons(id)?;
            (Some(show), seasons)
        }
        None => (None, Vec::new()),
    };

    let season_matches = input
        .seasons
        .iter()
        .map(|s| {
            let summary = show
                .as_ref()
                .and_then(|sh| s.number.and_then(|n| sh.seasons.iter().find(|x| x.season_number == n)).cloned());
            (s.id, summary)
        })
        .collect();
    let episodes = map_episodes(&input.seasons, &seasons);

    let mut movies = Vec::new();
    for movie in &input.movies {
        let found = match movie.locked {
            Some(Some(id)) => Some(tmdb.movie(id)?),
            Some(None) => None,
            None => find_movie(&movie.name, movie.year, tmdb)?,
        };
        movies.push(MovieMatch { file_id: movie.file_id, movie: found, locked: movie.locked.is_some() });
    }

    Ok(TvMatch { show, seasons: season_matches, episodes, movies })
}

/// A title that is a single movie.
pub fn match_movie(input: &ShowInput, tmdb: &Tmdb) -> Result<Option<Movie>, Error> {
    match input.locked_root {
        Some(Some(id)) => Ok(Some(tmdb.movie(id)?)),
        Some(None) => Ok(None),
        None => {
            let year = input.year.or_else(|| input.movies.first().and_then(|m| m.year));
            find_movie(&input.name, year, tmdb)
        }
    }
}

/// A TMDB anime by name (or the known id) with all its seasons.
pub fn anime_show(names: &[&str], year: Option<i32>, known_id: Option<i64>, tmdb: &Tmdb) -> Result<Option<(i64, Vec<Season>)>, Error> {
    let id = match known_id {
        Some(id) => Some(id),
        None => find_tv(names, year, true, tmdb)?.map(|r| r.id),
    };
    let Some(id) = id else { return Ok(None) };
    let (_, seasons) = tmdb.tv_with_seasons(id)?;
    Ok(Some((id, seasons)))
}

/// Episode descriptions and thumbnails for an anime, using the names AniList knows it by.
pub fn anime_episodes(
    input: &ShowInput,
    names: &[&str],
    year: Option<i32>,
    known_id: Option<i64>,
    tmdb: &Tmdb,
) -> Result<(Option<i64>, Vec<(i64, Vec<Episode>)>), Error> {
    let id = match known_id {
        Some(id) => Some(id),
        None => find_tv(names, year, true, tmdb)?.map(|r| r.id),
    };
    let Some(id) = id else { return Ok((None, Vec::new())) };
    let (_, seasons) = tmdb.tv_with_seasons(id)?;
    Ok((Some(id), map_episodes(&input.seasons, &seasons)))
}

fn find_tv(names: &[&str], year: Option<i32>, anime: bool, tmdb: &Tmdb) -> Result<Option<SearchResult>, Error> {
    for name in names.iter().filter(|n| !n.is_empty()) {
        // With the year first (fewer wrong hits), then without (folders rarely carry the right year).
        let mut results = Vec::new();
        if let Some(y) = year {
            results = tmdb.search_tv(name, Some(y))?;
        }
        if results.is_empty() {
            results = tmdb.search_tv(name, None)?;
        }
        if let Some(best) = pick(results, names, year, anime) {
            return Ok(Some(best));
        }
    }
    Ok(None)
}

fn find_movie(name: &str, year: Option<i32>, tmdb: &Tmdb) -> Result<Option<Movie>, Error> {
    let mut results = tmdb.search_movie(name, year)?;
    if results.is_empty() && year.is_some() {
        results = tmdb.search_movie(name, None)?;
    }
    // "South Park: The Streaming Wars Part" with no number is the first part.
    let without_part = name.trim_end().strip_suffix(" Part").or_else(|| name.trim_end().strip_suffix(" part"));
    let names: Vec<&str> = std::iter::once(name).chain(without_part).collect();
    match pick(results, &names, year, false) {
        Some(best) => Ok(Some(tmdb.movie(best.id)?)),
        None => Ok(None),
    }
}

/// The result whose name is closest, preferring the right year, then popularity.
fn pick(results: Vec<SearchResult>, names: &[&str], year: Option<i32>, anime: bool) -> Option<SearchResult> {
    let top_popularity = results.iter().map(|r| r.popularity).fold(1.0, f64::max);
    results
        .into_iter()
        .enumerate()
        .map(|(rank, r)| {
            let sim = names.iter().map(|n| best_similarity(n, &r.all_titles())).fold(0.0, f64::max);
            let mut score = sim - rank as f64 * 0.01 + 0.05 * (r.popularity / top_popularity);
            if year.is_some() && r.year() == year {
                score += 0.05;
            }
            if anime && r.genre_ids.contains(&ANIMATION_GENRE) && r.origin_country.iter().any(|c| c == "JP") {
                score += 0.05;
            }
            (score, sim, r)
        })
        .filter(|(_, sim, _)| *sim >= MIN_SIMILARITY)
        .max_by(|a, b| a.0.total_cmp(&b.0))
        .map(|(_, _, r)| r)
}

/// Finds the TMDB episode(s) for every episode file, in this order of trust:
///   1. by title (survives different numbering, e.g. SpongeBob's files numbered by segment
///      while TMDB numbers whole episodes), also among TMDB's specials: OVAs and episode 0s
///      that are part of a season on disk often sit there (Mushoku Tensei S01E16.5, S02E00),
///   2. in order, when a season has exactly one TMDB entry per file but numbered differently,
///   3. by number in the same season (a file "E01-E03" gets episodes 1 to 3),
///   4. by counting episodes across the whole run (anime numbered from episode 1 to 220).
/// When a season's numbers don't fit TMDB's season, 3 is skipped, and 4 is only used if it
/// agrees with the episodes matched by title (no info beats wrong info).
pub fn map_episodes(ours: &[SeasonInput], theirs: &[Season]) -> Vec<(i64, Vec<Episode>)> {
    let by_number: HashMap<i32, &Season> = theirs.iter().map(|s| (s.season_number, s)).collect();
    let mut run: Vec<&Season> = theirs.iter().filter(|s| s.season_number > 0).collect();
    run.sort_by_key(|s| s.season_number);
    let flat: Vec<&Episode> = run.iter().flat_map(|s| s.episodes.iter()).collect();
    let everything: Vec<Episode> = flat.iter().map(|e| (*e).clone()).collect();
    let specials: Vec<Episode> = by_number.get(&0).map(|s| s.episodes.clone()).unwrap_or_default();
    let globals = global_numbers(ours);
    let same = |a: &Episode, b: &Episode| a.season_number == b.season_number && a.episode_number == b.episode_number;

    let mut out = Vec::new();
    for season in ours {
        let tmdb_season = season.number.and_then(|n| by_number.get(&n)).copied();
        let max_number = season.episodes.iter().filter_map(|e| whole(e.episode)).max().unwrap_or(0);
        let in_order = tmdb_season
            .filter(|ts| season.episodes.len() == ts.episodes.len() && max_number as usize > ts.episodes.len());
        let numbers_fit = tmdb_season.is_none_or(|ts| max_number as f64 <= ts.episodes.len() as f64 * 1.5 + 1.0);

        let by_name: Vec<Vec<Episode>> = season
            .episodes
            .iter()
            .map(|ep| {
                let Some(name) = ep.name.as_deref() else { return Vec::new() };
                let found = tmdb_season.map(|ts| match_by_name(name, &ts.episodes)).unwrap_or_default();
                // Seasons cut differently (SpongeBob's season 10 on disk spans TMDB's 10 and 11): look everywhere.
                if found.is_empty() && !numbers_fit { match_by_name(name, &everything) } else { found }
            })
            .collect();
        let counted: Vec<Option<&Episode>> = season
            .episodes
            .iter()
            .map(|ep| {
                let ok = season.number.is_some_and(|n| n > 0) && whole(ep.episode).is_some();
                ok.then(|| globals.get(&ep.file_id).and_then(|&g| flat.get((g - 1).max(0) as usize).copied())).flatten()
            })
            .collect();
        // Does counting across the run agree with the title matches?
        let pairs: Vec<bool> = by_name
            .iter()
            .zip(&counted)
            .filter_map(|(named, c)| Some(same(named.first()?, (*c)?)))
            .collect();
        let counting_agrees = pairs.len() >= 3 && pairs.iter().filter(|a| **a).count() * 10 >= pairs.len() * 7;

        for (i, ep) in season.episodes.iter().enumerate() {
            let special = || ep.name.as_deref().map(|name| match_by_name(name, &specials)).unwrap_or_default();
            let found: Vec<Episode> = if !by_name[i].is_empty() {
                by_name[i].clone()
            } else if let found @ [_, ..] = special().as_slice() {
                found.to_vec()
            } else if let Some(ts) = in_order {
                vec![ts.episodes[i].clone()]
            } else {
                let first = whole(ep.episode);
                let last = whole(ep.episode_end).or(first);
                let direct: Vec<Episode> = match (tmdb_season.filter(|_| numbers_fit), first, last) {
                    (Some(ts), Some(a), Some(b)) => {
                        ts.episodes.iter().filter(|e| e.episode_number >= a && e.episode_number <= b).cloned().collect()
                    }
                    _ => Vec::new(),
                };
                if !direct.is_empty() {
                    direct
                } else if numbers_fit || counting_agrees {
                    counted[i].map(|e| vec![e.clone()]).unwrap_or_default()
                } else {
                    Vec::new()
                }
            };
            out.push((ep.file_id, found));
        }
    }
    out
}

/// TMDB episodes whose titles match ours. A combined title ("Help Wanted & Reef Blower")
/// is matched part by part when TMDB lists the parts separately.
fn match_by_name(name: &str, episodes: &[Episode]) -> Vec<Episode> {
    let parts = split_title(name);
    if parts.len() > 1 {
        let mut found: Vec<&Episode> = Vec::new();
        for part in &parts {
            let best = episodes
                .iter()
                .filter_map(|e| Some((similarity(part, e.name.as_deref()?), e)))
                .filter(|(score, _)| *score >= 0.85)
                .max_by(|a, b| a.0.total_cmp(&b.0))
                .map(|(_, e)| e);
            if let Some(e) = best.filter(|e| !found.iter().any(|f| std::ptr::eq(*f, *e))) {
                found.push(e);
            }
        }
        if found.len() * 2 >= parts.len() {
            found.sort_by_key(|e| e.episode_number);
            return found.into_iter().cloned().collect();
        }
    }
    episodes
        .iter()
        .filter_map(|e| Some((title_similarity(name, e.name.as_deref()?), e)))
        .filter(|(score, _)| *score >= 0.85)
        .max_by(|a, b| a.0.total_cmp(&b.0))
        .map(|(_, e)| vec![e.clone()])
        .unwrap_or_default()
}

fn split_title(title: &str) -> Vec<String> {
    title.split(" & ").flat_map(|p| p.split(" / ")).map(|p| p.trim().to_string()).filter(|p| !p.is_empty()).collect()
}

/// Like `similarity`, but also matches one segment of a combined title
/// ("Extreme Spots" is part of "Extreme Spots & Squirrel Record").
fn title_similarity(ours: &str, theirs: &str) -> f64 {
    let (our_parts, their_parts) = (split_title(ours), split_title(theirs));
    let parts = our_parts
        .iter()
        .map(|o| their_parts.iter().map(|t| similarity(o, t)).fold(0.0, f64::max))
        .sum::<f64>()
        / our_parts.len().max(1) as f64;
    similarity(ours, theirs).max(parts * 0.97)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::metadata::anime_match::EpisodeInput;

    fn tmdb_season(n: i32, count: i32) -> Season {
        Season {
            season_number: n,
            episodes: (1..=count)
                .map(|e| Episode {
                    season_number: n,
                    episode_number: e,
                    name: Some(format!("S{n}E{e}")),
                    overview: None,
                    air_date: None,
                    still_path: None,
                    runtime: None,
                })
                .collect(),
        }
    }

    fn ours(id: i64, number: i32, eps: &[(f64, Option<f64>)]) -> SeasonInput {
        SeasonInput {
            id,
            number: Some(number),
            locked: None,
            episodes: eps
                .iter()
                .enumerate()
                .map(|(i, (e, end))| EpisodeInput { file_id: id * 100 + i as i64, episode: Some(*e), episode_end: *end, name: None })
                .collect(),
        }
    }

    fn names(out: &[(i64, Vec<Episode>)], file: i64) -> Vec<String> {
        out.iter().find(|(f, _)| *f == file).unwrap().1.iter().filter_map(|e| e.name.clone()).collect()
    }

    #[test]
    fn same_numbering() {
        let out = map_episodes(&[ours(1, 1, &[(1.0, None), (2.0, None)])], &[tmdb_season(1, 2)]);
        assert_eq!(names(&out, 101), ["S1E2"]);
    }

    #[test]
    fn continuous_numbering() {
        // Naruto: our season 2 starts at episode 58; TMDB splits 57 + 43.
        let s1: Vec<(f64, Option<f64>)> = (1..=57).map(|e| (e as f64, None)).collect();
        let s2: Vec<(f64, Option<f64>)> = (58..=100).map(|e| (e as f64, None)).collect();
        let out = map_episodes(&[ours(1, 1, &s1), ours(2, 2, &s2)], &[tmdb_season(1, 57), tmdb_season(2, 43)]);
        assert_eq!(names(&out, 200), ["S2E1"]);
    }

    #[test]
    fn multi_episode_files_in_order() {
        // SpongeBob: files numbered by segment (E01-E03, E04-E05), TMDB one entry per file.
        let out = map_episodes(&[ours(1, 1, &[(1.0, Some(3.0)), (4.0, Some(5.0))])], &[tmdb_season(1, 2)]);
        assert_eq!(names(&out, 101), ["S1E2"]);
    }

    #[test]
    fn multi_episode_files_by_range() {
        let out = map_episodes(&[ours(1, 1, &[(1.0, Some(2.0)), (3.0, None)])], &[tmdb_season(1, 3)]);
        assert_eq!(names(&out, 100), ["S1E1", "S1E2"]);
    }

    #[test]
    fn by_title_beats_numbers() {
        let mut theirs = tmdb_season(10, 2);
        theirs.episodes[0].name = Some("Mimic Madness & Grooming Gary".into());
        theirs.episodes[1].name = Some("Extreme Spots & Squirrel Record".into());
        let mut season = ours(1, 10, &[(1.0, None)]);
        season.episodes[0].name = Some("Extreme Spots".into());
        let out = map_episodes(&[season], &[theirs]);
        assert_eq!(names(&out, 100), ["Extreme Spots & Squirrel Record"]);
    }

    #[test]
    fn episode_zero_is_not_counted_into_the_run() {
        let season = ours(1, 2, &[(0.0, None), (1.0, None)]);
        let out = map_episodes(&[season], &[tmdb_season(1, 3), tmdb_season(2, 3)]);
        assert!(names(&out, 100).is_empty());
        assert_eq!(names(&out, 101), ["S2E1"]);
    }

    #[test]
    fn combined_titles_match_each_part() {
        let mut theirs = tmdb_season(1, 3);
        for (e, n) in theirs.episodes.iter_mut().zip(["Help Wanted", "Reef Blower", "Tea at the Treedome"]) {
            e.name = Some(n.into());
        }
        let mut season = ours(1, 1, &[(1.0, Some(3.0))]);
        season.episodes[0].name = Some("Help Wanted & Reef Blower & Tea at the Treedome".into());
        let out = map_episodes(&[season], &[theirs]);
        assert_eq!(names(&out, 100), ["Help Wanted", "Reef Blower", "Tea at the Treedome"]);
    }

    #[test]
    fn different_numbering_scheme_trusts_titles_only() {
        // 70 short files numbered 1..70 against a TMDB season of 11 episodes.
        let eps: Vec<(f64, Option<f64>)> = (1..=70).map(|e| (e as f64, None)).collect();
        let season = ours(1, 10, &eps);
        let out = map_episodes(&[season], &[tmdb_season(10, 11)]);
        assert!(names(&out, 100).is_empty());
    }

    #[test]
    fn differently_cut_seasons_match_titles_in_other_seasons() {
        let mut s10 = tmdb_season(10, 2);
        let mut s11 = tmdb_season(11, 2);
        s10.episodes[0].name = Some("Extreme Spots".into());
        s11.episodes[1].name = Some("Whirly Brains".into());
        let eps: Vec<(f64, Option<f64>)> = (1..=40).map(|e| (e as f64, None)).collect();
        let mut season = ours(1, 10, &eps);
        season.episodes[30].name = Some("Whirly Brains".into());
        let out = map_episodes(&[season], &[s10, s11]);
        assert_eq!(names(&out, 130), ["Whirly Brains"]);
    }

    #[test]
    fn counting_across_seasons_fills_gaps_when_titles_agree() {
        // Tokyo Ghoul: our season 3 (24 episodes) is TMDB's seasons 3 and 4 (12 each).
        let mut seasons_theirs = vec![tmdb_season(1, 2), tmdb_season(3, 12), tmdb_season(4, 12)];
        let s1: Vec<(f64, Option<f64>)> = (1..=2).map(|e| (e as f64, None)).collect();
        let s3: Vec<(f64, Option<f64>)> = (1..=24).map(|e| (e as f64, None)).collect();
        let mut ours3 = ours(3, 3, &s3);
        for (i, ep) in ours3.episodes.iter_mut().enumerate() {
            let tmdb = if i < 12 { (3, i + 1) } else { (4, i - 11) };
            ep.name = Some(format!("S{}E{}", tmdb.0, tmdb.1));
        }
        ours3.episodes[8].name = Some("A title TMDB writes differently".into());
        seasons_theirs.remove(0);
        let mut ours1 = ours(1, 1, &s1);
        ours1.number = Some(2); // a season before it, so counting starts at 3
        let out = map_episodes(&[ours1, ours3], &[tmdb_season(2, 2), seasons_theirs.remove(0), seasons_theirs.remove(0)]);
        assert_eq!(names(&out, 308), ["S3E9"]);
    }

    #[test]
    fn specials_listed_separately_match_by_title() {
        // Mushoku Tensei: our season 2 starts with "S02E00 - Guardian Fitz", which TMDB lists as a special.
        let mut specials = tmdb_season(0, 3);
        specials.episodes[2].name = Some("Guardian Fitz".into());
        let mut season = ours(2, 2, &[(0.0, None), (1.0, None), (2.0, None)]);
        season.episodes[0].name = Some("Guardian Fitz".into());
        let out = map_episodes(&[season], &[specials, tmdb_season(2, 2)]);
        assert_eq!(names(&out, 200), ["Guardian Fitz"]);
        assert_eq!(names(&out, 201), ["S2E1"]);
    }
}
