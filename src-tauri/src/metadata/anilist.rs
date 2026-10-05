//! AniList GraphQL client (https://docs.anilist.co). No account needed for public data.
//! Requests are paced to stay under AniList's rate limit (currently 30 per minute).

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const ENDPOINT: &str = "https://graphql.anilist.co";
const MIN_INTERVAL: Duration = Duration::from_millis(2100);
const USER_AGENT: &str = "DaLibrarby/0.1 (+https://github.com/xburrito64/da-librarby)";

const MEDIA_FIELDS: &str = "
fragment M on Media {
  id type format episodes status seasonYear
  startDate { year month day }
  title { romaji english native }
  synonyms
  description(asHtml: false)
  genres averageScore
  coverImage { extraLarge large color }
  bannerImage
  studios(isMain: true) { nodes { name } }
  relations {
    edges {
      relationType
      node { id type format episodes status title { romaji english native } startDate { year month day } }
    }
  }
}";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Media {
    pub id: i64,
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub format: Option<String>,
    pub episodes: Option<i32>,
    pub status: Option<String>,
    pub season_year: Option<i32>,
    pub start_date: Option<FuzzyDate>,
    pub title: Title,
    #[serde(default)]
    pub synonyms: Vec<String>,
    pub description: Option<String>,
    #[serde(default)]
    pub genres: Vec<String>,
    pub average_score: Option<i32>,
    pub cover_image: Option<CoverImage>,
    pub banner_image: Option<String>,
    pub studios: Option<Studios>,
    pub relations: Option<Relations>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Title {
    pub romaji: Option<String>,
    pub english: Option<String>,
    pub native: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuzzyDate {
    pub year: Option<i32>,
    pub month: Option<i32>,
    pub day: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverImage {
    pub extra_large: Option<String>,
    pub large: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Studios {
    pub nodes: Vec<Studio>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Studio {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Relations {
    pub edges: Vec<RelationEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationEdge {
    pub relation_type: Option<String>,
    pub node: RelationNode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationNode {
    pub id: i64,
    #[serde(rename = "type")]
    pub kind: Option<String>,
    pub format: Option<String>,
    pub episodes: Option<i32>,
    pub status: Option<String>,
    pub title: Title,
    pub start_date: Option<FuzzyDate>,
}

impl Media {
    /// English title if there is one, otherwise the romanised Japanese one.
    pub fn display_title(&self) -> String {
        self.title.english.clone().or_else(|| self.title.romaji.clone()).unwrap_or_default()
    }

    /// Every name this entry goes by, for matching against folder names.
    pub fn all_titles(&self) -> Vec<&str> {
        let t = &self.title;
        [t.english.as_deref(), t.romaji.as_deref(), t.native.as_deref()]
            .into_iter()
            .flatten()
            .chain(self.synonyms.iter().map(String::as_str))
            .collect()
    }

    pub fn year(&self) -> Option<i32> {
        self.start_date.as_ref().and_then(|d| d.year).or(self.season_year)
    }

    pub fn relations(&self) -> impl Iterator<Item = &RelationEdge> {
        self.relations.iter().flat_map(|r| r.edges.iter()).filter(|e| e.node.kind.as_deref() == Some("ANIME"))
    }

    /// AniList descriptions contain a little HTML (<br>, <i>); turn it into plain text.
    pub fn plain_description(&self) -> Option<String> {
        strip_editor_notes(&html_to_text(self.description.as_deref()?))
    }
}

impl RelationNode {
    pub fn all_titles(&self) -> Vec<&str> {
        let t = &self.title;
        [t.english.as_deref(), t.romaji.as_deref(), t.native.as_deref()].into_iter().flatten().collect()
    }

    pub fn year(&self) -> Option<i32> {
        self.start_date.as_ref().and_then(|d| d.year)
    }
}

/// Series formats that make up the main run of a show (as opposed to movies, OVAs, specials).
pub fn is_series_format(format: Option<&str>, episodes: Option<i32>) -> bool {
    match format {
        Some("TV") | Some("TV_SHORT") => true,
        Some("ONA") => episodes.is_none_or(|e| e >= 5),
        _ => false,
    }
}

pub struct AniList {
    agent: ureq::Agent,
    last_request: Mutex<Option<Instant>>,
}

#[derive(Debug)]
pub enum Error {
    /// No connection, AniList down, or it keeps refusing: stop and try again later.
    Unavailable(String),
    /// The request itself was bad (e.g. an id that doesn't exist).
    Rejected(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Unavailable(m) => write!(f, "AniList is unavailable: {m}"),
            Error::Rejected(m) => write!(f, "AniList rejected the request: {m}"),
        }
    }
}

impl AniList {
    pub fn new() -> Self {
        let agent = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(30)))
            .http_status_as_error(false)
            .user_agent(USER_AGENT)
            .build()
            .into();
        Self { agent, last_request: Mutex::new(None) }
    }

    /// Anime matching `query`, best matches first.
    pub fn search(&self, query: &str, formats: Option<&[&str]>) -> Result<Vec<Media>, Error> {
        // AniList fails on an empty format filter, so it's only included when set.
        let (params, filter) = match formats {
            Some(_) => (", $formats: [MediaFormat]", ", format_in: $formats"),
            None => ("", ""),
        };
        let q = format!(
            "query ($search: String{params}) {{
               Page(perPage: 10) {{ media(search: $search, type: ANIME{filter}, sort: SEARCH_MATCH) {{ ...M }} }}
             }} {MEDIA_FIELDS}"
        );
        let data = self.request(&q, json!({ "search": query, "formats": formats }))?;
        parse_list(&data["Page"]["media"])
    }

    /// Fetches entries by id (in any order; missing ids are left out).
    pub fn media(&self, ids: &[i64]) -> Result<Vec<Media>, Error> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }
        let q = format!(
            "query ($ids: [Int]) {{ Page(perPage: 50) {{ media(id_in: $ids, type: ANIME) {{ ...M }} }} }} {MEDIA_FIELDS}"
        );
        let data = self.request(&q, json!({ "ids": ids }))?;
        parse_list(&data["Page"]["media"])
    }

    fn request(&self, query: &str, variables: Value) -> Result<Value, Error> {
        let body = json!({ "query": query, "variables": variables });
        for attempt in 0..4 {
            self.pace();
            let response = self
                .agent
                .post(ENDPOINT)
                .header("Accept", "application/json")
                .send_json(&body);
            let mut response = match response {
                Ok(r) => r,
                Err(e) if attempt < 2 => {
                    std::thread::sleep(Duration::from_secs(5));
                    eprintln!("AniList request failed, retrying: {e}");
                    continue;
                }
                Err(e) => return Err(Error::Unavailable(e.to_string())),
            };
            let status = response.status().as_u16();
            if status == 429 {
                let wait = response
                    .headers()
                    .get("Retry-After")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(60)
                    .min(120);
                std::thread::sleep(Duration::from_secs(wait + 1));
                continue;
            }
            if status >= 500 {
                std::thread::sleep(Duration::from_secs(5 * (attempt as u64 + 1)));
                continue;
            }
            let value: Value = response
                .body_mut()
                .read_json()
                .map_err(|e| Error::Unavailable(format!("unreadable response: {e}")))?;
            if let Some(errors) = value.get("errors").filter(|e| !e.is_null()) {
                if value["data"].is_null() {
                    return Err(Error::Rejected(errors.to_string()));
                }
            }
            if status >= 400 {
                return Err(Error::Rejected(format!("HTTP {status}")));
            }
            return Ok(value["data"].clone());
        }
        Err(Error::Unavailable("too many retries".into()))
    }

    /// Waits so requests are at least MIN_INTERVAL apart.
    fn pace(&self) {
        let mut last = self.last_request.lock().unwrap();
        if let Some(previous) = *last {
            let elapsed = previous.elapsed();
            if elapsed < MIN_INTERVAL {
                std::thread::sleep(MIN_INTERVAL - elapsed);
            }
        }
        *last = Some(Instant::now());
    }
}

fn parse_list(value: &Value) -> Result<Vec<Media>, Error> {
    match value {
        Value::Null => Ok(Vec::new()),
        v => serde_json::from_value(v.clone()).map_err(|e| Error::Rejected(format!("unexpected data: {e}"))),
    }
}

/// Drops the editor notes AniList appends after the story ("(Source: ...)", "Note: ...",
/// "*This includes ..."): everything from the first such paragraph on.
pub fn strip_editor_notes(text: &str) -> Option<String> {
    let story: Vec<&str> = text
        .split("

")
        .take_while(|p| {
            let p = p.trim_start();
            !(p.starts_with("(Source")
                || p.starts_with("Source:")
                || p.starts_with("Note:")
                || p.starts_with("(Note")
                || p.starts_with('*'))
        })
        .collect();
    Some(story.join("

")).filter(|d| !d.is_empty())
}

fn html_to_text(html: &str) -> String {
    let with_breaks = html.replace("<br>", "\n").replace("<br/>", "\n").replace("<br />", "\n");
    let mut out = String::with_capacity(with_breaks.len());
    let mut in_tag = false;
    for c in with_breaks.chars() {
        match c {
            '<' => in_tag = true,
            '>' if in_tag => in_tag = false,
            c if !in_tag => out.push(c),
            _ => {}
        }
    }
    let out = out
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#039;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&mdash;", "—");
    // Collapse the blank lines AniList leaves between paragraphs.
    let mut text = String::new();
    let mut blank = 0;
    for line in out.lines().map(str::trim) {
        if line.is_empty() {
            blank += 1;
            continue;
        }
        if !text.is_empty() {
            text.push_str(if blank > 0 { "\n\n" } else { "\n" });
        }
        text.push_str(line);
        blank = 0;
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn descriptions_lose_editor_notes() {
        let mut m: Media = serde_json::from_value(serde_json::json!({ "id": 1, "title": {} })).unwrap();
        m.description = Some("Story one.<br><br>Story <i>two</i>.<br><br>(Source: Funimation)<br><br>Note: aired early".into());
        assert_eq!(m.plain_description().as_deref(), Some("Story one.

Story two."));
        m.description = Some("(Source: X)".into());
        assert_eq!(m.plain_description(), None);
    }
}
