//! Reading meaning out of folder and file names: show titles, years, seasons,
//! episode numbers, extras. Pure functions, no file system access.

use regex::Regex;
use std::cmp::Ordering;
use std::sync::LazyLock;

const VIDEO_EXTENSIONS: &[&str] = &[
    "mkv", "mp4", "m4v", "avi", "webm", "mov", "ts", "m2ts", "wmv", "flv", "mpg", "mpeg", "ogv",
];

pub fn is_video(name: &str) -> bool {
    name.rsplit_once('.')
        .is_some_and(|(_, ext)| VIDEO_EXTENSIONS.iter().any(|v| v.eq_ignore_ascii_case(ext)))
}

pub fn file_stem(name: &str) -> &str {
    name.rsplit_once('.').map_or(name, |(stem, _)| stem)
}

macro_rules! re {
    ($name:ident, $pattern:literal) => {
        static $name: LazyLock<Regex> = LazyLock::new(|| Regex::new($pattern).unwrap());
    };
}

// Words that only appear in release/encoding tags, never in real titles.
re!(QUALITY, r"(?i)\b(\d{3,4}p|x26[45]|h\.?26[45]|hevc|avc|av1|blu-?ray|bdrip|bd|web-?dl|webrip|web|amzn|dual[- ]?audio|10[- ]?bit|aac|flac|e-?ac-?3|ddp?\d?|dts(-hd)?|truehd|remux|hdr(10)?|dv|uhd|multi-subs)\b");
re!(BRACKETS, r"\[[^\]]*\]");
re!(PARENS, r"\([^)]*\)");
// Where a dotted release tail starts, e.g. "Name (2023).1080p.BluRay.x264-GROUP", or the bracket
// it starts in: "KILL la KILL - 03 [BD 1080p x265 OPUS][Anipakku]", "... Series (BD 1080p)(Dual-Audio)".
re!(RELEASE_TAIL, r"(?i)(?:[\[(][^\])]*?)?[ .(\[](2160p|1080p|720p|480p|blu-?ray|web-?dl|webrip|bdrip|remux)\b.*$");
// A release group in round brackets in front: "(CBB) Tengen Toppa Gurren Lagann" (a word, never
// just a number: "(500) Days of Summer" is the title).
re!(LEADING_GROUP, r"^\s*\([A-Za-z][A-Za-z0-9._&-]{1,15}\)\s*");
// ... or after an episode's title: "Parallel Works - Episode 1 (CBB)".
re!(TRAILING_GROUP, r"\s*\(([A-Z][A-Z0-9]{1,7})\)$");
// More words only bonus material has.
re!(BONUS_WORDS, r"(?i)\b(textless|teasers?|promos?|previews?|pvs?|cms?|commercials?|spots?|storyboards?|outtakes?|bloopers?|gag reel|clean (opening|ending))\b");
// Words that go with bonus material in a heading: "Season 2", "Behind The Scenes & Easter Eggs".
re!(BONUS_HEADING_WORDS, r"(?i)\b(season\s*\d+|s\d+|easter eggs?|and|the|of|special|bonus|clips?|videos?)\b");
// What a folder holding a show's own episodes is called, numbered or not ("01. Series").
re!(MAIN_SERIES, r"(?i)^(the )?(main )?(tv )?(series|episodes|show|story)$");
re!(YEAR_PARENS, r"\((19\d{2}|20[0-3]\d)\)");
re!(YEAR_TRAILING, r"\s(19\d{2}|20[0-3]\d)$");
re!(EPISODE_RANGE_PARENS, r"\(\s*\d+\s*-\s*\d+[^)]*\)");
re!(SEASON_SUFFIX, r"(?i)\s+(S\d{1,3}(\s*-\s*S?\d{1,3})?|seasons?\s*\d{1,3}(\s*-\s*\d{1,3})?)(\s*\+.*)?$");
re!(COMPLETE_SUFFIX, r"(?i)\s+(complete|the complete series)$");
re!(SEASON_TOKEN, r"(?i)(?:^|[\s._\-])S(\d{1,3})(?:$|[\s._\-+])");
re!(SEASON_WORD, r"(?i)\bseason[\s._\-]*(\d{1,3})\b");
re!(SPECIALS, r"(?i)\b(specials?|sp|ovas?|oads?|onas?)\b");
re!(EXTRAS, r"(?i)\b(extras?|featurettes?|bonus|behind the scenes|nc|ncop|nced|creditless|artworks?|screens|screenshots|soundtracks?|ost|samples?|trailers?|interviews?|deleted scenes|making of|menus?|op\s*(and|&|\+)\s*ed|openings?|endings?)\b");
// An opening or ending video: "OP 001 Snow fairy", "NCED 3", "[Group] Show - Opening 2".
re!(OP_ED, r"(?i)(?:^|[\s\-_.(])(?:nc\s*)?(?:op|ed|opening|ending)\s*\d{0,3}(?:v\d)?(?:$|[\s\-_.)])");
// "OVA 1", "OAD 2", "SP 3", "Special 4": a special's own number.
re!(SPECIAL_NUMBER, r"(?i)(?:^|[\s\-_.])(?:OVA|OAD|ONA|SP|Special)\s*(\d{1,3}(?:\.\d+)?)(?:$|[\s\-_.])");
// "Movie 01" in a movie's name says nothing about which movie it is.
re!(MOVIE_NUMBER, r"(?i)(^|[\s\-–:])movie\s*0*\d{1,2}($|[\s\-–:])");
// "The Movie 02": the number goes, "The Movie" stays (it's part of the name).
re!(THE_MOVIE_NUMBER, r"(?i)\b(the movie)\s*0*\d{1,2}\b");
re!(DOUBLE_DASH, r"\s*[-–]\s*[-–:]\s*");
re!(LEADING_SEASON, r"(?i)^(season\s*\d{1,3}|s\d{1,3}(e\d{1,4})?)(\s*[-–:.]\s+|\s+)");
re!(MOVIES_FOLDER,r"(?i)^(movies|films)$");
re!(THE_MOVIE, r"(?i)\bthe movie\b");
re!(SXXEYY, r"(?i)\bS(\d{1,3})\s*E(\d{1,4}(?:\.\d+)?)(?:[a-e]{1,5}\b)?(?:-?E(\d{1,4}(?:\.\d+)?)(?:[a-e]{1,5}\b)?)?");
// (Several in one file: "Episode 9-15", "E09-E15".)
re!(EPISODE_ONLY, r"(?i)(?:^|[\s\-_.])E(?:p|pisode)?\s?(\d{1,4}(?:\.\d+)?)(?:-(?:E(?:p|pisode)?\s?)?(\d{1,4}))?(?:$|[\s\-_.])");
// (A half-episode too: "05.5 - My Gurren is Sparkling!!".)
re!(ABSOLUTE, r"(?:^|\s-\s)(\d{1,4}(?:\.\d)?)(?:\s-\s|$)");
re!(TRAILING_NUMBER, r"\s(\d{1,3})$");
re!(LEADING_NUMBER, r"^(\d{1,3})(½)?\s*[.\-]\s+");
re!(SPACES, r"\s+");
// "Fear.Of.A.Krabby.Patty" (dots for spaces) and "A+B" (segments joined without spaces).
re!(WORD_DOT, r"([\p{L}\d])\.([\p{L}])");
re!(TIGHT_PLUS, r"\s*\+\s*");
// Words of a release's name that say which languages it has, not what the episode is called:
// "Attack.on.Titan.S03E01.GERMAN.Dubbed.DL.1080p.WEB.x264-GROUP".
re!(RELEASE_WORD, r"(?i)^(german|ger|deu|deutsch|english|eng|french|fre|vf|vostfr|spanish|spa|esp|castellano|latino|italian|ita|japanese|jap|jpn|korean|kor|chinese|chi|russian|rus|polish|pol|multi|dual|dubbed|dub|subbed|sub|subs|dl|ml|ac3|dd51|uncut|repack|proper|internal|hdtv|sdtv|dvdrip|dvd|hdrip|cr|nf|dsnp)$");
// One of these alone is enough to tell it's a release tag (a lone "German" could be a title).
re!(SURE_RELEASE_WORD, r"(?i)^(dubbed|subbed|dl|multi|uncut|repack|proper|vostfr)$");

/// Normalises display text: turns the look-alike characters used in place of
/// characters Windows forbids in file names back into the real ones, and tidies spacing.
pub fn clean_text(s: &str) -> String {
    let mapped: String = s
        .chars()
        .map(|c| match c {
            '∶' | '：' | '꞉' => ':',
            '？' | '❔' | '❓' => '?',
            '❕' | '❗' => '!',
            '／' => '/',
            '＂' => '"',
            '＊' => '*',
            '＜' => '<',
            '＞' => '>',
            '｜' => '|',
            '_' => ' ',
            c => c,
        })
        .collect();
    let collapsed = SPACES.replace_all(&mapped, " ");
    collapsed
        .trim_matches(|c: char| c.is_whitespace() || matches!(c, '-' | '.' | '[' | ']' | ','))
        .to_string()
}

/// An episode title as shown: dotted release-style names get their spaces back, and
/// segments joined with "+" are spaced out ("Krusty.Koncessionaires+Dream.Hoppers").
fn episode_title(s: &str) -> String {
    let s = clean_text(s);
    let s = WORD_DOT.replace_all(&s, "$1 $2");
    // Twice: "A.B.C" overlaps.
    let s = WORD_DOT.replace_all(&s, "$1 $2");
    let s = without_release_words(&clean_text(&TIGHT_PLUS.replace_all(&s, " + ")));
    clean_text(&TRAILING_GROUP.replace(&s, ""))
}

/// A release tag's word, also with its group on the end ("x264-GROUP").
fn is_release_word(word: &str) -> bool {
    let word = word.split('-').next().unwrap_or(word);
    RELEASE_WORD.is_match(word) || QUALITY.is_match(word)
}

/// Drops the language and dub tags a release puts after the episode code ("GERMAN Dubbed DL"),
/// which can be all there is after it.
fn without_release_words(title: &str) -> String {
    let words: Vec<&str> = title.split(' ').collect();
    let keep = words.iter().rposition(|w| !is_release_word(w)).map_or(0, |i| i + 1);
    let tail = &words[keep..];
    if tail.len() >= 2 || tail.iter().any(|w| SURE_RELEASE_WORD.is_match(w)) {
        clean_text(&words[..keep].join(" "))
    } else {
        title.to_string()
    }
}

/// Removes release tags: `[Group]`, `(Group)` in front, `(1080p BluRay x265)`, `.1080p.BluRay.x264-GROUP`
/// tails, stray brackets.
pub fn strip_tags(s: &str) -> String {
    let s = LEADING_GROUP.replace(s, "");
    let s = RELEASE_TAIL.replace(&s, "");
    let s = BRACKETS.replace_all(&s, " ");
    let s = PARENS.replace_all(&s, |caps: &regex::Captures| {
        if QUALITY.is_match(&caps[0]) { " ".to_string() } else { caps[0].to_string() }
    });
    s.replace(['[', ']'], " ")
}

/// "South Park∶ Post COVID (2021)" -> ("South Park: Post COVID", Some(2021))
pub fn title_and_year(name: &str) -> (String, Option<i32>) {
    let mut s = strip_tags(name);
    let mut year = None;
    if let Some(m) = YEAR_PARENS.captures(&s) {
        year = m[1].parse().ok();
        s = YEAR_PARENS.replace(&s, " ").into_owned();
    } else if let Some(m) = YEAR_TRAILING.captures(s.trim_end()) {
        let without = YEAR_TRAILING.replace(s.trim_end(), "").into_owned();
        if !clean_text(&without).is_empty() {
            year = m[1].parse().ok();
            s = without;
        }
    }
    (clean_text(&s), year)
}

/// Title of a show from its folder name: "Ping Pong the Animation S01" -> "Ping Pong the Animation",
/// "Naruto Complete (001-220 + Movies)" -> "Naruto".
pub fn show_title(folder: &str) -> (String, Option<i32>) {
    let without_ranges = EPISODE_RANGE_PARENS.replace_all(folder, " ");
    let (title, year) = title_and_year(&without_ranges);
    let title = SEASON_SUFFIX.replace(&title, "");
    let title = COMPLETE_SUFFIX.replace(&title, "");
    let title = clean_text(&title);
    if title.is_empty() { (clean_text(folder), year) } else { (title, year) }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FolderKind {
    Extras,
    /// 0 = specials.
    Season(i32),
    Movies,
    Other,
}

/// Folders that sort media by type rather than being a show: "Anime", "Cartoons", "Movies"...
pub fn category_folder(name: &str) -> Option<super::scan::LibraryKind> {
    use super::scan::LibraryKind;
    match clean_text(name).to_lowercase().as_str() {
        "anime" | "animes" => Some(LibraryKind::Anime),
        "cartoons" | "cartoon" | "shows" | "tv shows" | "tv" | "series" | "tv series" | "serien" => Some(LibraryKind::Shows),
        "movies" | "movie" | "mobies" | "films" | "film" | "filme" => Some(LibraryKind::Movies),
        _ => None,
    }
}

/// What a folder inside a show folder holds. Only the part before a "+" counts:
/// "South Park (1997) S01 + Extras" is season 1, "Jujutsu Kaisen S01 Extras" is extras. A number in
/// front only orders them: "01. Series" holds the show's episodes (its first season), "02. Movies"
/// its movies.
pub fn classify_folder(name: &str) -> FolderKind {
    let stripped = strip_tags(name);
    let head = stripped.split('+').next().unwrap_or_default();
    let bare = clean_text(&LEADING_NUMBER.replace(head.trim(), ""));
    if EXTRAS.is_match(head) {
        FolderKind::Extras
    } else if let Some(n) = season_number(head) {
        FolderKind::Season(n)
    } else if MOVIES_FOLDER.is_match(&bare) {
        FolderKind::Movies
    } else if MAIN_SERIES.is_match(&bare) {
        FolderKind::Season(1)
    } else {
        FolderKind::Other
    }
}

/// The season an extras folder belongs to: "Season 01" -> 1, "Jujutsu Kaisen S01 Extras" -> 1.
pub fn extras_season(name: &str) -> Option<i32> {
    season_number(&strip_tags(name))
}

/// Name of an extra as shown, without the show's name, its folder's name and the season in front
/// (it's listed under that heading anyway): "South Park - S01E14 [EXTRA] - Jay Leno's Appearance" ->
/// "Jay Leno's Appearance", "Season 01 - Behind the Scenes" -> "Behind the Scenes",
/// "Lost Mystery Shack Interviews Zendaya" -> "Zendaya". Never leaves just a number.
pub fn extra_name(stem: &str, show: &str, folder: Option<&str>) -> String {
    let name = clean_text(&strip_tags(stem));
    let mut rest = without_prefix(&name, show);
    if let Some(folder) = folder {
        rest = without_prefix(rest, &clean_text(&strip_tags(folder)));
    }
    let rest = clean_text(&LEADING_SEASON.replace(rest, ""));
    if rest.chars().any(char::is_alphabetic) { rest } else { name }
}

/// `s` without `prefix` (any case) and the separator after it, if it starts with it as whole words.
fn without_prefix<'a>(s: &'a str, prefix: &str) -> &'a str {
    if prefix.is_empty() || !s.get(..prefix.len()).is_some_and(|p| p.to_lowercase() == prefix.to_lowercase()) {
        return s;
    }
    let after = &s[prefix.len()..];
    if after.chars().next().is_some_and(|c| !c.is_alphanumeric()) {
        after.trim_start_matches(|c: char| c.is_whitespace() || matches!(c, '-' | '–' | ':'))
    } else {
        s
    }
}

/// Folders that only say "these are extras" ("Featurettes", "Bonus"), so they don't make a heading.
pub fn generic_extras_folder(name: &str) -> bool {
    matches!(
        clean_text(&strip_tags(name)).to_lowercase().as_str(),
        "extras" | "extra" | "featurettes" | "featurette" | "bonus" | "bonus features" | "special features" | "bonus content"
    )
}

/// "Chainsaw Man S01" -> 1, "Season 02" -> 2, "Sword Art Online Specials" / "S00" -> 0.
fn season_number(s: &str) -> Option<i32> {
    if let Some(c) = SEASON_TOKEN.captures(s).or_else(|| SEASON_WORD.captures(s)) {
        return c[1].parse().ok();
    }
    SPECIALS.is_match(s).then_some(0)
}

/// An opening or ending (or one without credits), which is an extra, never a movie.
pub fn is_op_ed(stem: &str) -> bool {
    OP_ED.is_match(&strip_tags(stem))
}

/// A movie's name without "Movie 01" in it: "Fairy Tail - Movie 01 - The Phoenix Priestess" ->
/// "Fairy Tail - The Phoenix Priestess" (what the movie is called everywhere else), and
/// "Naruto Shippuden The Movie 02 - Bonds" -> "Naruto Shippuden The Movie - Bonds".
pub fn movie_name(name: &str) -> String {
    let without = THE_MOVIE_NUMBER.replace(name, "$1");
    let without = MOVIE_NUMBER.replace(&without, "$1$2");
    let tidy = clean_text(&DOUBLE_DASH.replace_all(&without, " - "));
    if tidy.chars().any(char::is_alphabetic) { tidy } else { name.to_string() }
}

/// A movie kept among a show's specials: "Sword Art Online The Movie Ordinal Scale"
/// (but not the short "Sword Art Online Movie Ordinal Scale - Sword Art Offline").
pub fn is_movie_title(title: &str) -> bool {
    THE_MOVIE.is_match(title)
}

/// Folders that group episodes without a season number, like One Pace arcs:
/// "06½. The Adventures of Buggy's Crew" -> (6.5, "The Adventures of Buggy's Crew").
pub fn numbered_group(name: &str) -> (Option<f64>, String) {
    let s = strip_tags(name);
    let s = s.trim();
    match LEADING_NUMBER.captures(s) {
        Some(c) => {
            let n: f64 = c[1].parse().unwrap_or(0.0);
            let half = if c.get(2).is_some() { 0.5 } else { 0.0 };
            (Some(n + half), clean_text(&s[c.get(0).unwrap().end()..]))
        }
        None => (None, clean_text(s)),
    }
}

#[derive(Debug, Default, Clone, PartialEq)]
pub struct EpisodeName {
    pub season: Option<i32>,
    pub episode: Option<f64>,
    pub episode_end: Option<f64>,
    /// True when the episode number counts from the start of the show (Naruto "- 001 -").
    pub absolute: bool,
    /// An OVA, OAD or special by its own number ("OVA 3"): it belongs with the specials.
    pub special: bool,
    pub title: Option<String>,
}

/// Reads season/episode numbers and the episode title from a video file name (without extension).
pub fn parse_episode(stem: &str) -> EpisodeName {
    let s = strip_tags(stem);
    let s = s.trim();

    if let Some(c) = SXXEYY.captures(s) {
        let m = c.get(0).unwrap();
        let after = episode_title(&s[m.end()..]);
        let before = clean_text(&s[..m.start()]);
        let title = if !after.is_empty() {
            Some(after)
        } else {
            // "Tokyo Ghoul - Tokyo Ghoul∶ Jack - S00E01": the title sits before the code.
            before.split_once(" - ").map(|(_, rest)| clean_text(rest)).filter(|t| !t.is_empty())
        };
        return EpisodeName {
            season: c[1].parse().ok(),
            episode: c[2].parse().ok(),
            episode_end: c.get(3).and_then(|e| e.as_str().parse().ok()),
            absolute: false,
            special: false,
            title,
        };
    }

    // "Naruto Shippuden - 290 - Power - Episode 1": the number counting from the start of the show
    // comes first; the "Episode 1" after it is part of the episode's title.
    let absolute_first = |other: Option<regex::Match>| match (ABSOLUTE.find(s), other) {
        (Some(a), Some(o)) => a.start() < o.start(),
        _ => false,
    };

    if let Some(c) = SPECIAL_NUMBER.captures(s).filter(|c| !absolute_first(c.get(0))) {
        let m = c.get(0).unwrap();
        let after = episode_title(&s[m.end()..]);
        return EpisodeName {
            episode: c[1].parse().ok(),
            special: true,
            title: (!after.is_empty()).then_some(after),
            ..Default::default()
        };
    }

    if let Some(c) = EPISODE_ONLY.captures(s).filter(|c| !absolute_first(c.get(0))) {
        let m = c.get(0).unwrap();
        let after = episode_title(&s[m.end()..]);
        return EpisodeName {
            episode: c[1].parse().ok(),
            episode_end: c.get(2).and_then(|e| e.as_str().parse().ok()),
            title: (!after.is_empty()).then_some(after),
            ..Default::default()
        };
    }

    if let Some(c) = ABSOLUTE.captures(s) {
        let m = c.get(0).unwrap();
        let after = episode_title(&s[m.end()..]);
        return EpisodeName {
            episode: c[1].parse().ok(),
            absolute: true,
            title: (!after.is_empty()).then_some(after),
            ..Default::default()
        };
    }

    if let Some(c) = TRAILING_NUMBER.captures(s) {
        return EpisodeName { episode: c[1].parse().ok(), ..Default::default() };
    }

    EpisodeName { title: Some(clean_text(s)).filter(|t| !t.is_empty()), ..Default::default() }
}

/// Bonus material by its name (openings, endings, textless versions, trailers, interviews...), which
/// stays an extra even when TMDB lists something like it among a show's specials.
pub fn is_bonus(name: &str) -> bool {
    // ("Behind-the-Scenes" too.)
    let name = name.replace(['-', '_'], " ");
    EXTRAS.is_match(&name) || OP_ED.is_match(&name) || BONUS_WORDS.is_match(&name)
}

/// A heading that only says it's bonus material ("Interviews", "Featurettes", "Season 2 · Behind The
/// Scenes & Easter Eggs"), not the name of a series that happens to have such a word in it ("Lost
/// Mystery Shack Interviews").
pub fn is_bonus_heading(heading: &str) -> bool {
    let h = heading.replace(['-', '_'], " ");
    if !is_bonus(&h) {
        return false;
    }
    let rest = EXTRAS.replace_all(&h, " ");
    let rest = BONUS_WORDS.replace_all(&rest, " ");
    let rest = BONUS_HEADING_WORDS.replace_all(&rest, " ");
    !rest.chars().any(char::is_alphabetic)
}

/// An extra that turned out to be one of the show's specials, as a special: its number (when it has
/// one of its own, not a season's) and its name (the one it was found by: "Zendaya" in "Lost Mystery
/// Shack Interviews").
pub fn special_from_extra(stem: &str, extra_name: Option<&str>) -> (Option<f64>, Option<f64>, Option<String>) {
    let p = parse_episode(stem);
    let own = p.season.is_none_or(|s| s == 0);
    let (episode, end) = if own { (p.episode, p.episode_end) } else { (None, None) };
    (episode, end, extra_name.map(str::to_string).or(p.title))
}

/// Says outright which episode it is ("S01E05", "E05", "Episode 5"), not just a number at the end
/// ("Day 38, Day 39, Day 40" isn't an episode of anything).
pub fn names_episode(stem: &str) -> bool {
    let s = strip_tags(stem);
    SXXEYY.is_match(&s) || EPISODE_ONLY.is_match(&s)
}

/// A spin-off series' name as a heading, without the show's name in front: "Gurren Lagann -
/// Parallel Works" in "Tengen Toppa Gurren Lagann" is "Parallel Works".
pub fn series_label(folder: &str, show: &str) -> String {
    let name = clean_text(&strip_tags(folder));
    let rest = without_prefix(&name, show);
    if rest != name {
        return rest.to_string();
    }
    let lower = |s: &str| s.to_lowercase();
    match name.split_once(" - ") {
        Some((head, rest)) if !head.is_empty() && lower(show).ends_with(&lower(head)) => clean_text(rest),
        _ => name,
    }
}

/// Compares names so that "Episode 2" sorts before "Episode 10".
pub fn natural_cmp(a: &str, b: &str) -> Ordering {
    let (mut a, mut b) = (a.chars().peekable(), b.chars().peekable());
    loop {
        match (a.peek().copied(), b.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) if x.is_ascii_digit() && y.is_ascii_digit() => {
                let take = |it: &mut std::iter::Peekable<std::str::Chars>| {
                    let mut n = String::new();
                    while let Some(c) = it.peek().copied().filter(char::is_ascii_digit) {
                        n.push(c);
                        it.next();
                    }
                    n.trim_start_matches('0').to_string()
                };
                let (na, nb) = (take(&mut a), take(&mut b));
                let ord = na.len().cmp(&nb.len()).then_with(|| na.cmp(&nb));
                if ord != Ordering::Equal {
                    return ord;
                }
            }
            (Some(x), Some(y)) => {
                let ord = x.to_lowercase().cmp(y.to_lowercase());
                if ord != Ordering::Equal {
                    return ord;
                }
                a.next();
                b.next();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ep(stem: &str) -> EpisodeName {
        parse_episode(stem)
    }

    #[test]
    fn show_titles() {
        assert_eq!(show_title("Chainsaw Man"), ("Chainsaw Man".into(), None));
        assert_eq!(show_title("Ping Pong the Animation S01"), ("Ping Pong the Animation".into(), None));
        assert_eq!(show_title("Naruto Complete (001-220 + Movies)"), ("Naruto".into(), None));
        assert_eq!(show_title("SpongeBob SquarePants Season 1-13 1080p COMPLETE"), ("SpongeBob SquarePants".into(), None));
        assert_eq!(show_title("Some Show S01-S05"), ("Some Show".into(), None));
        assert_eq!(show_title("Adventure Time∶ Fionna and Cake"), ("Adventure Time: Fionna and Cake".into(), None));
        assert_eq!(show_title("SpongeBob SquarePants"), ("SpongeBob SquarePants".into(), None));
    }

    #[test]
    fn release_groups_and_tags_in_round_brackets() {
        assert_eq!(
            show_title("(CBB) Tengen Toppa Gurren Lagann - The Complete Series (BD 1080p)(Dual-Audio)(HEVC-x265-10bit)").0,
            "Tengen Toppa Gurren Lagann"
        );
        // A number in round brackets in front is part of the title.
        assert_eq!(title_and_year("(500) Days of Summer (2009)"), ("(500) Days of Summer".to_string(), Some(2009)));
        assert_eq!(classify_folder("01. Series"), FolderKind::Season(1));
        assert_eq!(classify_folder("02. Movies"), FolderKind::Movies);
        assert_eq!(classify_folder("03. Extra"), FolderKind::Extras);
        assert_eq!(classify_folder("04. OVA"), FolderKind::Season(0));
        assert_eq!(classify_folder("03. Special"), FolderKind::Season(0));
        assert_eq!(classify_folder("01. Romance Dawn"), FolderKind::Other);
    }

    #[test]
    fn bonus_headings() {
        assert!(is_bonus_heading("Interviews"));
        assert!(is_bonus_heading("Season 2 · Featurettes"));
        assert!(is_bonus_heading("Behind The Scenes & Easter Eggs"));
        assert!(!is_bonus_heading("Lost Mystery Shack Interviews"));
        assert!(!is_bonus_heading("05. Music Videos"));
        assert!(!is_bonus_heading("Season 1"));
    }

    #[test]
    fn titles_and_years() {
        assert_eq!(title_and_year("South Park∶ Post COVID (2021)"), ("South Park: Post COVID".into(), Some(2021)));
        assert_eq!(
            title_and_year("South Park∶ Not Suitable for Children (2023).1080p.BluRay.x264-MiMESiS"),
            ("South Park: Not Suitable for Children".into(), Some(2023))
        );
        assert_eq!(title_and_year("The SpongeBob SquarePants Movie 2004"), ("The SpongeBob SquarePants Movie".into(), Some(2004)));
        assert_eq!(title_and_year("Jujutsu Kaisen 0"), ("Jujutsu Kaisen 0".into(), None));
        assert_eq!(title_and_year("2012 (2009)"), ("2012".into(), Some(2009)));
        assert_eq!(title_and_year("2012"), ("2012".into(), None));
        assert_eq!(
            title_and_year("[Anime Time] Naruto The Movie - Legend Of The Stone Of Gelel (2005)"),
            ("Naruto The Movie - Legend Of The Stone Of Gelel".into(), Some(2005))
        );
    }

    #[test]
    fn folders() {
        use FolderKind::*;
        assert_eq!(classify_folder("Chainsaw Man S01"), Season(1));
        assert_eq!(classify_folder("Season 03"), Season(3));
        assert_eq!(classify_folder("S02"), Season(2));
        assert_eq!(classify_folder("Mushoku Tensei S01+SP"), Season(1));
        assert_eq!(classify_folder("Mushoku Tensei S02 + SP"), Season(2));
        assert_eq!(classify_folder("South Park (1997) S01 + Extras"), Season(1));
        assert_eq!(classify_folder("Tokyo Ghoul S00"), Season(0));
        assert_eq!(classify_folder("Sword Art Online Specials"), Season(0));
        assert_eq!(classify_folder("Chainsaw Man – The Movie Reze Arc"), Other);
        assert_eq!(classify_folder("Jujutsu Kaisen 0"), Other);
        assert_eq!(classify_folder("01. Romance Dawn"), Other);
        assert_eq!(classify_folder("Adventure Time∶ Distant Lands"), Other);
        assert_eq!(classify_folder("Extras"), Extras);
        assert_eq!(classify_folder("Jujutsu Kaisen S01 Extras"), Extras);
        assert_eq!(classify_folder("Gravity Falls Extra"), Extras);
        assert_eq!(classify_folder("Featurettes"), Extras);
        assert_eq!(classify_folder("NC"), Extras);
        assert_eq!(classify_folder("Sword Art Online Extra Artwork"), Extras);
        assert_eq!(classify_folder("Movies"), Movies);
        assert_eq!(classify_folder("Fairy Tail OVA"), Season(0));
        assert_eq!(classify_folder("OADs"), Season(0));
        assert_eq!(classify_folder("[Anime Time] Fairy Tail OP And ED (Plus Full OP And ED MP3)"), Extras);
        assert_eq!(classify_folder("Openings"), Extras);
        assert_eq!(classify_folder("Fairy Tail OST"), Extras);

        assert_eq!(extras_season("Season 01"), Some(1));
        assert_eq!(extras_season("Jujutsu Kaisen S01 Extras"), Some(1));
        assert_eq!(extras_season("Gravity Falls Extra"), None);
        assert_eq!(extras_season("Lost Mystery Shack Interviews"), None);
        assert_eq!(extras_season("Shop at Home with Mr Mystery"), None);
        assert_eq!(extra_name("Season 01 - Behind the Scenes", "Adventure Time", Some("Season 01")), "Behind the Scenes");
        assert_eq!(
            extra_name("South Park - S01E14 [EXTRA] - Jay Leno's Appearance on South Park", "South Park", Some("Featurettes")),
            "Jay Leno's Appearance on South Park"
        );
        assert_eq!(
            extra_name("Jujutsu Kaisen - S01 NCED01 - Lost in Paradise", "Jujutsu Kaisen", None),
            "NCED01 - Lost in Paradise"
        );
        assert_eq!(extra_name("Six Days to South Park", "South Park", None), "Six Days to South Park");
        assert_eq!(extra_name("TV Shorts 1", "Gravity Falls", Some("TV Shorts")), "TV Shorts 1");
        assert_eq!(
            extra_name("Lost Mystery Shack Interviews Zendaya", "Gravity Falls", Some("Lost Mystery Shack Interviews")),
            "Zendaya"
        );
        assert_eq!(extra_name("Fixin It with Soos Golf Cart", "Gravity Falls", Some("Fixin It with Soos")), "Golf Cart");
        assert_eq!(extra_name("Menu Art", "South Park", None), "Menu Art");
        assert!(generic_extras_folder("Featurettes"));
        assert!(!generic_extras_folder("Deleted Scenes"));

        use crate::library::scan::LibraryKind;
        assert_eq!(category_folder("Anime"), Some(LibraryKind::Anime));
        assert_eq!(category_folder("Mobies"), Some(LibraryKind::Movies));
        assert_eq!(category_folder("Cartoons"), Some(LibraryKind::Shows));
        assert_eq!(category_folder("Chainsaw Man"), None);

        assert_eq!(numbered_group("01. Romance Dawn"), (Some(1.0), "Romance Dawn".into()));
        assert_eq!(numbered_group("06½. The Adventures of Buggy's Crew"), (Some(6.5), "The Adventures of Buggy's Crew".into()));
        assert_eq!(numbered_group("07. Loguetown [480p] [TBR]"), (Some(7.0), "Loguetown".into()));
        assert_eq!(numbered_group("01. Hunter Exam Arc"), (Some(1.0), "Hunter Exam Arc".into()));

        assert!(is_movie_title("Sword Art Online The Movie Ordinal Scale"));
        assert!(!is_movie_title("Sword Art Online Movie Ordinal Scale - Sword Art Offline"));
        assert!(!is_movie_title("The New Terrance and Phillip Movie Trailer"));
    }

    #[test]
    fn episodes_sxxeyy() {
        let e = ep("Chainsaw Man - S01E01 - Dog & Chainsaw");
        assert_eq!((e.season, e.episode, e.title.as_deref()), (Some(1), Some(1.0), Some("Dog & Chainsaw")));

        let e = ep("Mushoku Tensei - S01E01- Jobless Reincarnation");
        assert_eq!(e.title.as_deref(), Some("Jobless Reincarnation"));

        let e = ep("Sword Art Online - S02E14.5 - Debriefing");
        assert_eq!((e.season, e.episode), (Some(2), Some(14.5)));

        let e = ep("SpongeBob SquarePants (1999) - S01E01-E03 - Help Wanted & Reef Blower & Tea at the Treedome (1080p AMZN WEB-DL x265 RCVR)");
        assert_eq!((e.episode, e.episode_end), (Some(1.0), Some(3.0)));
        assert_eq!(e.title.as_deref(), Some("Help Wanted & Reef Blower & Tea at the Treedome"));

        let e = ep("SpongeBob SquarePants (1999) S04E01-E02 Fear of a Krabby Patty & Shell of a Man (1080p AMZN Webrip x265 10bit EAC3 2.0 - Frys) [TAoE]");
        assert_eq!((e.season, e.episode, e.episode_end), (Some(4), Some(1.0), Some(2.0)));
        assert_eq!(e.title.as_deref(), Some("Fear of a Krabby Patty & Shell of a Man"));

        let e = ep("Tokyo Ghoul - Tokyo Ghoul∶ Jack - S00E01");
        assert_eq!((e.season, e.title.as_deref()), (Some(0), Some("Tokyo Ghoul: Jack")));

        let e = ep("Ping Pong the Animation - S01E01 - Tbe Wind Makes It too Hard to Hear]");
        assert_eq!(e.title.as_deref(), Some("Tbe Wind Makes It too Hard to Hear"));

        let e = ep("Sousou no Frieren - S02E01 - Shall We Go, Then？");
        assert_eq!(e.title.as_deref(), Some("Shall We Go, Then?"));

        let e = ep("Adventure Time - S04E01 - Hot to the Touch (2)");
        assert_eq!(e.title.as_deref(), Some("Hot to the Touch (2)"));

        let e = ep("[Judas] Hunter x Hunter (2011) - S01E018 Big × Time × Interview");
        assert_eq!((e.season, e.episode, e.title.as_deref()), (Some(1), Some(18.0), Some("Big × Time × Interview")));

        let e = ep("[Judas] Hunter x Hunter (2011) - S01E084 -A × Fated × Awakening");
        assert_eq!((e.episode, e.title.as_deref()), (Some(84.0), Some("A × Fated × Awakening")));

        let e = ep("Kaiji - S02E01 - Underground Hell");
        assert_eq!((e.season, e.episode), (Some(2), Some(1.0)));
    }

    #[test]
    fn episodes_other_numbering() {
        let e = ep("[Anime Time] Naruto - 001 - Enter Naruto Uzumaki!");
        assert_eq!((e.episode, e.absolute, e.title.as_deref()), (Some(1.0), true, Some("Enter Naruto Uzumaki!")));

        let e = ep("One Pace[1] - Romance Dawn - E01");
        assert_eq!((e.season, e.episode, e.title.as_deref()), (None, Some(1.0), None));

        let e = ep("One Pace[103-105] - Reverse Mountain - E02 Extended");
        assert_eq!((e.episode, e.title.as_deref()), (Some(2.0), Some("Extended")));

        let e = ep("One Pace[431-432] Post-Enies Lobby 01");
        assert_eq!(e.episode, Some(1.0));

        // Tags in brackets after the number, with a release tail inside them.
        let e = ep("KILL la KILL - 03 [BD 1080p x265 OPUS][Anipakku]");
        assert_eq!((e.episode, e.absolute, e.title.as_deref()), (Some(3.0), true, None));
        let e = ep("KILL la KILL - E03 [BD 1080p x265 OPUS][Anipakku]");
        assert_eq!((e.episode, e.title.as_deref()), (Some(3.0), None));
        let e = ep("KILL la KILL - 25 [BD 1080p x265 OPUS][Anipakku]");
        assert_eq!(e.episode, Some(25.0));

        // Gurren Lagann's: titles with a look-alike question mark, and the release group after one.
        let e = ep("03 - Who Do You Think You Are, Having Two Faces!❔");
        assert_eq!((e.episode, e.title.as_deref()), (Some(3.0), Some("Who Do You Think You Are, Having Two Faces!?")));
        let e = ep("Gurren Lagann Parallel Works - Episode 1 (CBB)");
        assert_eq!((e.episode, e.title.as_deref()), (Some(1.0), None));
        let e = ep("Gurren Lagann Parallel Works - Episode 9-15 - The Sense of Wonder + Kittan Zero (CBB)");
        assert_eq!((e.episode, e.episode_end, e.title.as_deref()), (Some(9.0), Some(15.0), Some("The Sense of Wonder + Kittan Zero")));
        let e = ep("Show - E01-Title");
        assert_eq!((e.episode, e.episode_end), (Some(1.0), None));
        let e = ep("05.5 - My Gurren is Sparkling!! (DS Ver. Soft Inclusion)");
        assert_eq!((e.episode, e.title.as_deref()), (Some(5.5), Some("My Gurren is Sparkling!! (DS Ver. Soft Inclusion)")));

        let e = ep("Chainsaw Man -  The Movie Reze Arc");
        assert_eq!((e.episode, e.title.as_deref()), (None, Some("Chainsaw Man - The Movie Reze Arc")));
    }

    #[test]
    fn absolute_number_before_an_episode_word() {
        let e = ep("[Anime Time] Naruto Shippuden - 290 - Power - Episode 1");
        assert_eq!((e.episode, e.absolute, e.title.as_deref()), (Some(290.0), true, Some("Power - Episode 1")));
        let e = ep("[Anime Time] Naruto Shippuden - 295 - Power - Final Episode");
        assert_eq!((e.episode, e.title.as_deref()), (Some(295.0), Some("Power - Final Episode")));
    }

    #[test]
    fn release_words_are_not_titles() {
        let e = ep("Attack.on.Titan.2013.S03E01.GERMAN.Dubbed.DL.1080p.WEB.x264-TVS");
        assert_eq!((e.season, e.episode, e.title), (Some(3), Some(1.0), None));
        let e = ep("Attack.on.Titan.2013.S03E02.GERMAN.DL.AAC.x264-Group");
        assert_eq!(e.title, None);
        let e = ep("Show.S01E04.Pain.GERMAN.Dubbed.DL.1080p.WEB.x264");
        assert_eq!(e.title.as_deref(), Some("Pain"));
        let e = ep("Show.S01E05.Episode.Name.MULTi.1080p");
        assert_eq!(e.title.as_deref(), Some("Episode Name"));
        // Real titles stay as they are.
        assert_eq!(ep("Show - S01E06 - The German").title.as_deref(), Some("The German"));
        assert_eq!(ep("Show - S01E07 - Dub Step").title.as_deref(), Some("Dub Step"));
        assert_eq!(ep("Show - S02E01 - Krusty.Koncessionaires+Dream.Hoppers").title.as_deref(), Some("Krusty Koncessionaires + Dream Hoppers"));
    }

    #[test]
    fn specials_openings_and_movie_names() {
        let e = ep("[Anime Time] Fairy Tail - OVA 3 - Memory Days");
        assert_eq!((e.season, e.episode, e.special, e.title.as_deref()), (None, Some(3.0), true, Some("Memory Days")));
        let e = ep("Some Show - OAD 2");
        assert_eq!((e.episode, e.special), (Some(2.0), true));
        // A real episode code still wins.
        assert!(!ep("Show - S00E03 - Special Delivery").special);

        assert!(is_op_ed("[Anime Time] Fairy Tail OP 001 Snow fairy"));
        assert!(is_op_ed("[Anime Time] Fairy Tail ED 006 -Be As One-"));
        assert!(is_op_ed("Jujutsu Kaisen NCOP2"));
        assert!(!is_op_ed("Fairy Tail - The Phoenix Priestess"));
        assert!(!is_op_ed("The SpongeBob Movie - Sponge Out of Water"));

        assert_eq!(movie_name("Fairy Tail - Movie 01 - The Phoenix Priestess"), "Fairy Tail - The Phoenix Priestess");
        assert_eq!(movie_name("Hunter X Hunter - Movie 2 - The Last Mission"), "Hunter X Hunter - The Last Mission");
        assert_eq!(movie_name("Naruto The Movie - Legend Of The Stone Of Gelel"), "Naruto The Movie - Legend Of The Stone Of Gelel");
        assert_eq!(movie_name("Movie 2"), "Movie 2");
        assert_eq!(movie_name("Naruto Shippuden The Movie 02 - Bonds"), "Naruto Shippuden The Movie - Bonds");
        assert_eq!(movie_name("The Last - Naruto The Movie 07"), "The Last - Naruto The Movie");
    }

    #[test]
    fn natural_sorting() {
        let mut v = vec!["E10", "E2", "E1"];
        v.sort_by(|a, b| natural_cmp(a, b));
        assert_eq!(v, ["E1", "E2", "E10"]);
    }

    #[test]
    fn segment_letters_after_the_episode_number() {
        // One file per broadcast, holding segments a, b (and c).
        let e = parse_episode(file_stem("SpongeBob SquarePants - S01E01abc - Help Wanted + Reef Blower + Tea at the Treedome WEBDL-1080p.mkv"));
        assert_eq!((e.season, e.episode), (Some(1), Some(1.0)));
        assert_eq!(e.title.as_deref(), Some("Help Wanted + Reef Blower + Tea at the Treedome"));
        let e = parse_episode(file_stem("SpongeBob SquarePants - S01E04ab- Naughty Nautical Neighbors + Boating School WEBDL-1080p.mkv"));
        assert_eq!(e.title.as_deref(), Some("Naughty Nautical Neighbors + Boating School"));
        let e = parse_episode(file_stem("SpongeBob SquarePants - S13E02b - Squidward's Sick Daze WEBRip-1080p.mkv"));
        assert_eq!((e.season, e.episode, e.title.as_deref()), (Some(13), Some(2.0), Some("Squidward's Sick Daze")));
        let e = parse_episode(file_stem("SpongeBob SquarePants - S04E01ab - Fear.Of.A.Krabby.Patty.and.Shell.Of.A.Man WEBDL-1080p.mkv"));
        assert_eq!(e.title.as_deref(), Some("Fear Of A Krabby Patty and Shell Of A Man"));
        let e = parse_episode(file_stem("SpongeBob SquarePants - S12E26ab - Krusty.Koncessionaires+Dream.Hoppers WEBDL-1080p.mkv"));
        assert_eq!(e.title.as_deref(), Some("Krusty Koncessionaires + Dream Hoppers"));
        let e = parse_episode(file_stem("SpongeBob SquarePants - S08E09 - Mr. Krabs Takes a Vacation.mkv"));
        assert_eq!(e.title.as_deref(), Some("Mr. Krabs Takes a Vacation"));
    }
}
