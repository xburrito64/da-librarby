//! TMDB client (https://developer.themoviedb.org). Needs the owner's API key, which is
//! stored only in the local database. Accepts either the short "API key" or the long
//! "API read access token".

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use super::anilist::Error;

const BASE: &str = "https://api.themoviedb.org/3";
const IMAGES: &str = "https://image.tmdb.org/t/p";
/// TMDB allows ~40 requests per second; stay far below.
const MIN_INTERVAL: Duration = Duration::from_millis(120);
const LANGUAGE: &str = "en-US";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub id: i64,
    /// TV shows have `name`, movies have `title`.
    pub name: Option<String>,
    pub title: Option<String>,
    pub original_name: Option<String>,
    pub original_title: Option<String>,
    pub first_air_date: Option<String>,
    pub release_date: Option<String>,
    pub poster_path: Option<String>,
    pub overview: Option<String>,
    #[serde(default)]
    pub popularity: f64,
    #[serde(default)]
    pub genre_ids: Vec<i64>,
    #[serde(default)]
    pub origin_country: Vec<String>,
}

impl SearchResult {
    pub fn display_title(&self) -> String {
        self.name.clone().or_else(|| self.title.clone()).unwrap_or_default()
    }

    pub fn all_titles(&self) -> Vec<&str> {
        [&self.name, &self.title, &self.original_name, &self.original_title]
            .into_iter()
            .filter_map(|t| t.as_deref())
            .collect()
    }

    pub fn year(&self) -> Option<i32> {
        year_of(self.first_air_date.as_deref().or(self.release_date.as_deref()))
    }
}

#[derive(Debug, Clone, Deserialize)]
struct Page<T> {
    results: Vec<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Named {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TvShow {
    pub id: i64,
    pub name: String,
    pub original_name: Option<String>,
    pub overview: Option<String>,
    pub first_air_date: Option<String>,
    pub status: Option<String>,
    pub vote_average: Option<f64>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    #[serde(default)]
    pub genres: Vec<Named>,
    #[serde(default)]
    pub networks: Vec<Named>,
    #[serde(default)]
    pub production_companies: Vec<Named>,
    #[serde(default)]
    pub seasons: Vec<SeasonSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeasonSummary {
    pub season_number: i32,
    pub name: Option<String>,
    pub overview: Option<String>,
    pub air_date: Option<String>,
    pub poster_path: Option<String>,
    pub episode_count: Option<i32>,
    pub vote_average: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Season {
    pub season_number: i32,
    #[serde(default)]
    pub episodes: Vec<Episode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub season_number: i32,
    pub episode_number: i32,
    pub name: Option<String>,
    pub overview: Option<String>,
    pub air_date: Option<String>,
    pub still_path: Option<String>,
    pub runtime: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Movie {
    pub id: i64,
    pub title: String,
    pub original_title: Option<String>,
    pub overview: Option<String>,
    pub release_date: Option<String>,
    pub status: Option<String>,
    pub vote_average: Option<f64>,
    pub runtime: Option<i32>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    #[serde(default)]
    pub genres: Vec<Named>,
    #[serde(default)]
    pub production_companies: Vec<Named>,
    pub tagline: Option<String>,
    pub belongs_to_collection: Option<Collection>,
    /// Asked for along with the movie.
    pub credits: Option<Credits>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collection {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Credits {
    #[serde(default)]
    pub cast: Vec<CastMember>,
    #[serde(default)]
    pub crew: Vec<CrewMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CastMember {
    pub id: i64,
    pub name: String,
    pub character: Option<String>,
    pub profile_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrewMember {
    pub name: String,
    pub job: Option<String>,
}

impl Movie {
    pub fn year(&self) -> Option<i32> {
        year_of(self.release_date.as_deref())
    }
}

impl TvShow {
    pub fn year(&self) -> Option<i32> {
        year_of(self.first_air_date.as_deref())
    }
}

pub fn year_of(date: Option<&str>) -> Option<i32> {
    date.and_then(|d| d.get(..4)).and_then(|y| y.parse().ok())
}

/// Full image URL. Sizes: posters "w780", backdrops "w1280", episode stills "w300".
pub fn image_url(path: Option<&str>, size: &str) -> Option<String> {
    path.filter(|p| p.starts_with('/')).map(|p| format!("{IMAGES}/{size}{p}"))
}

pub struct Tmdb {
    agent: ureq::Agent,
    key: String,
    last_request: Mutex<Option<Instant>>,
}

impl Tmdb {
    pub fn new(key: &str) -> Self {
        let agent = ureq::Agent::config_builder()
            .timeout_global(Some(Duration::from_secs(30)))
            .http_status_as_error(false)
            .user_agent("DaLibrarby/0.1 (+https://github.com/xburrito64/da-librarby)")
            .build()
            .into();
        Self { agent, key: key.trim().to_string(), last_request: Mutex::new(None) }
    }

    pub fn search_tv(&self, query: &str, year: Option<i32>) -> Result<Vec<SearchResult>, Error> {
        let mut params = vec![("query", query.to_string()), ("include_adult", "false".into())];
        if let Some(y) = year {
            params.push(("first_air_date_year", y.to_string()));
        }
        Ok(self.get::<Page<SearchResult>>("/search/tv", &params)?.results)
    }

    pub fn search_movie(&self, query: &str, year: Option<i32>) -> Result<Vec<SearchResult>, Error> {
        let mut params = vec![("query", query.to_string()), ("include_adult", "false".into())];
        if let Some(y) = year {
            params.push(("year", y.to_string()));
        }
        Ok(self.get::<Page<SearchResult>>("/search/movie", &params)?.results)
    }

    /// The show plus every listed season with its episodes (TMDB allows 20 seasons per request).
    pub fn tv_with_seasons(&self, id: i64) -> Result<(TvShow, Vec<Season>), Error> {
        let show: TvShow = self.get(&format!("/tv/{id}"), &[])?;
        let numbers: Vec<i32> = show.seasons.iter().map(|s| s.season_number).collect();
        let mut seasons = Vec::new();
        for chunk in numbers.chunks(20) {
            let append = chunk.iter().map(|n| format!("season/{n}")).collect::<Vec<_>>().join(",");
            let value: serde_json::Value = self.get(&format!("/tv/{id}"), &[("append_to_response", append)])?;
            for n in chunk {
                if let Some(season) = value.get(format!("season/{n}")) {
                    if let Ok(season) = serde_json::from_value::<Season>(season.clone()) {
                        seasons.push(season);
                    }
                }
            }
        }
        Ok((show, seasons))
    }

    /// A movie with its cast and crew.
    pub fn movie(&self, id: i64) -> Result<Movie, Error> {
        self.get(&format!("/movie/{id}"), &[("append_to_response", "credits".to_string())])
    }

    fn get<T: DeserializeOwned>(&self, path: &str, params: &[(&str, String)]) -> Result<T, Error> {
        // The short API key goes in the URL; the long read-access token is sent as a bearer token.
        let bearer = self.key.len() > 40;
        for attempt in 0..4 {
            self.pace();
            let mut request = self.agent.get(&format!("{BASE}{path}")).query("language", LANGUAGE);
            for (k, v) in params {
                request = request.query(*k, v);
            }
            request = if bearer {
                request.header("Authorization", &format!("Bearer {}", self.key))
            } else {
                request.query("api_key", &self.key)
            };
            let mut response = match request.call() {
                Ok(r) => r,
                Err(e) if attempt < 2 => {
                    eprintln!("TMDB request failed, retrying: {e}");
                    std::thread::sleep(Duration::from_secs(3));
                    continue;
                }
                Err(e) => return Err(Error::Unavailable(format!("TMDB: {e}"))),
            };
            match response.status().as_u16() {
                200 => {
                    return response
                        .body_mut()
                        .with_config()
                        .limit(20 * 1024 * 1024)
                        .read_json()
                        .map_err(|e| Error::Rejected(format!("TMDB sent unexpected data: {e}")));
                }
                401 => return Err(Error::Unavailable("the TMDB key was not accepted".into())),
                404 => return Err(Error::Rejected(format!("TMDB has nothing at {path}"))),
                429 | 500..=599 => std::thread::sleep(Duration::from_secs(2 * (attempt as u64 + 1))),
                status => return Err(Error::Rejected(format!("TMDB answered HTTP {status}"))),
            }
        }
        Err(Error::Unavailable("TMDB keeps failing".into()))
    }

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
