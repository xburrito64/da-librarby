//! A movie's page shows a row of moments from the film itself and what's in the file (length,
//! picture size, audio and subtitle languages). The hidden mpv of `thumbnails` makes them once
//! per file and keeps them in `<app data>/scenes/<video>/` (`scenes.json` and `<n>.jpg`).
//!
//! Frontend -> here: `scenes_get` { path } answers straight away with what's saved, or asks for
//! it to be made; `scenes:ready` { path, info } follows when it's done (info null if the file
//! couldn't be read).

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};

use crate::thumbnails::{video_key, Msg, Thumbs};

/// Changed when the way scenes are picked changes, so they're made again.
pub const VERSION: u32 = 1;
/// Picture width in pixels (shown at about 300 px, sharp on high-resolution screens).
pub const WIDTH: u32 = 640;
/// Moments picked when the file has no usable chapters...
const EVEN_COUNT: usize = 8;
/// ...and at most this many chapters.
const MAX_CHAPTERS: usize = 12;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneInfo {
    pub version: u32,
    /// Seconds.
    pub duration: f64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub video_codec: Option<String>,
    pub audio: Vec<Track>,
    pub subs: Vec<Track>,
    pub scenes: Vec<Scene>,
    /// The folder the pictures are in (filled in when sent to the interface).
    #[serde(default)]
    pub dir: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub lang: Option<String>,
    pub title: Option<String>,
    pub codec: Option<String>,
    pub channels: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    /// Where it is (seconds), and the picture's file name.
    pub time: f64,
    pub file: String,
    /// The chapter's name, if it has a real one.
    pub title: Option<String>,
}

pub fn root(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.path().app_local_data_dir()?.join("scenes"))
}

pub fn dir_for(app: &AppHandle, path: &str) -> Option<PathBuf> {
    Some(root(app).ok()?.join(video_key(Path::new(path))))
}

/// What's saved for a file, if it was made the current way.
pub fn saved(dir: &Path) -> Option<SceneInfo> {
    let info: SceneInfo = serde_json::from_slice(&fs::read(dir.join("scenes.json")).ok()?).ok()?;
    (info.version == VERSION).then(|| SceneInfo { dir: dir.to_string_lossy().into_owned(), ..info })
}

#[tauri::command]
pub fn scenes_get(app: AppHandle, thumbs: State<'_, Thumbs>, path: String) -> Option<SceneInfo> {
    let dir = dir_for(&app, &path)?;
    if let Some(info) = saved(&dir) {
        return Some(info);
    }
    thumbs.send(&app, Msg::Scenes(path));
    None
}

/// A chapter from mpv's `chapter-list`.
#[derive(Debug, Clone, PartialEq)]
pub struct Chapter {
    pub time: f64,
    pub title: Option<String>,
}

pub fn chapters(list: &Value) -> Vec<Chapter> {
    list.as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|c| {
                    Some(Chapter {
                        time: c.get("time")?.as_f64()?,
                        title: c.get("title").and_then(Value::as_str).map(str::to_string),
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Where to take the pictures: a little into each chapter (skipping very short ones like
/// logos), or evenly through the film when it has no real chapters. Never the very start or
/// the credits at the end.
pub fn pick_moments(duration: f64, chapters: &[Chapter]) -> Vec<(f64, Option<String>)> {
    let ends: Vec<f64> = chapters.iter().skip(1).map(|c| c.time).chain(std::iter::once(duration)).collect();
    let usable: Vec<(f64, Option<String>)> = chapters
        .iter()
        .zip(&ends)
        .filter(|(c, end)| *end - c.time >= 45.0 && c.time < duration * 0.94)
        .map(|(c, end)| (c.time + (20.0f64).min((end - c.time) * 0.3), c.title.clone().filter(|t| real_title(t))))
        .collect();
    if usable.len() >= 3 {
        if usable.len() <= MAX_CHAPTERS {
            return usable;
        }
        // Spread evenly over the chapters.
        return (0..MAX_CHAPTERS).map(|i| usable[i * usable.len() / MAX_CHAPTERS].clone()).collect();
    }
    if duration <= 0.0 {
        return Vec::new();
    }
    let (from, to) = (0.06, 0.88);
    (0..EVEN_COUNT)
        .map(|i| (duration * (from + (to - from) * i as f64 / (EVEN_COUNT - 1) as f64), None))
        .collect()
}

/// "Chapter 01", "01", "00:12:00.000" say nothing; "The Catbus" does.
fn real_title(title: &str) -> bool {
    let t = title.trim().to_lowercase();
    let generic = t.trim_start_matches("chapter").trim_start_matches("kapitel").trim();
    !generic.is_empty() && !generic.chars().all(|c| c.is_ascii_digit() || matches!(c, ':' | '.' | ' '))
}

/// The audio and subtitle tracks, and the picture's size and codec, from mpv's `track-list`.
pub fn tracks(list: &Value) -> (Vec<Track>, Vec<Track>, Option<(i64, i64, String)>) {
    let mut audio = Vec::new();
    let mut subs = Vec::new();
    let mut video = None;
    for t in list.as_array().into_iter().flatten() {
        let text = |key: &str| t.get(key).and_then(Value::as_str).map(str::to_string);
        let track = Track {
            lang: text("lang"),
            title: text("title"),
            codec: text("codec"),
            channels: t.get("demux-channel-count").and_then(Value::as_i64),
        };
        match t.get("type").and_then(Value::as_str) {
            Some("audio") => audio.push(track),
            Some("sub") => subs.push(track),
            Some("video") if video.is_none() && !t.get("image").and_then(Value::as_bool).unwrap_or(false) => {
                let w = t.get("demux-w").and_then(Value::as_i64);
                let h = t.get("demux-h").and_then(Value::as_i64);
                if let (Some(w), Some(h)) = (w, h) {
                    video = Some((w, h, track.codec.unwrap_or_default()));
                }
            }
            _ => {}
        }
    }
    (audio, subs, video)
}

/// How bright a saved picture is on average (0-255), to skip black frames.
pub fn brightness(file: &Path) -> Option<f64> {
    let image = image::open(file).ok()?.to_luma8();
    let pixels = image.as_raw();
    (!pixels.is_empty()).then(|| pixels.iter().map(|&p| p as f64).sum::<f64>() / pixels.len() as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ch(time: f64, title: &str) -> Chapter {
        Chapter { time, title: Some(title.into()) }
    }

    #[test]
    fn evenly_without_chapters() {
        let m = pick_moments(6000.0, &[]);
        assert_eq!(m.len(), EVEN_COUNT);
        assert!((m[0].0 - 360.0).abs() < 0.01);
        assert!((m[7].0 - 5280.0).abs() < 0.01);
    }

    #[test]
    fn into_each_real_chapter() {
        let chapters = [ch(0.0, "Logo"), ch(10.0, "Chapter 02"), ch(300.0, "The Catbus"), ch(900.0, "Chapter 04"), ch(1500.0, "End")];
        let m = pick_moments(1560.0, &chapters);
        // The 10 second logo and the credits at the end are left out.
        assert_eq!(m.iter().map(|x| x.0).collect::<Vec<_>>(), [30.0, 320.0, 920.0]);
        assert_eq!(m[1].1.as_deref(), Some("The Catbus"));
        assert_eq!(m[0].1, None);
    }

    #[test]
    fn too_few_chapters_falls_back() {
        let m = pick_moments(3000.0, &[ch(0.0, "A"), ch(1500.0, "B")]);
        assert_eq!(m.len(), EVEN_COUNT);
    }

    #[test]
    fn many_chapters_are_thinned() {
        let chapters: Vec<Chapter> = (0..30).map(|i| ch(i as f64 * 200.0, "x")).collect();
        assert_eq!(pick_moments(6000.0, &chapters).len(), MAX_CHAPTERS);
    }
}
