//! What's in a movie's file, for its page: length, picture (size, codec, 10-bit, HDR), the
//! audio and subtitle tracks, chapters. The hidden mpv of `thumbnails` opens the file once and
//! the answer is kept in `<app data>/file-info/<video>.json`.
//!
//! Frontend -> here: `file_info` { path } answers straight away with what's saved, or asks for
//! it to be found out; `fileinfo:ready` { path, info } follows (info null if the file couldn't
//! be read).

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};

use crate::mpv::Mpv;
use crate::thumbnails::{video_key, Msg, Thumbs};

/// Changed when more is found out, so files are looked at again.
pub const VERSION: u32 = 1;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub version: u32,
    /// Seconds.
    pub duration: f64,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub video_codec: Option<String>,
    pub bit_depth: Option<i64>,
    pub hdr: bool,
    pub fps: Option<f64>,
    /// "matroska", "mp4"...
    pub container: Option<String>,
    pub audio: Vec<Track>,
    pub subs: Vec<Track>,
    pub chapters: usize,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub lang: Option<String>,
    pub title: Option<String>,
    pub codec: Option<String>,
    pub channels: Option<i64>,
    pub forced: bool,
}

pub fn root(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.path().app_local_data_dir()?.join("file-info"))
}

pub fn file_for(app: &AppHandle, path: &str) -> Option<PathBuf> {
    Some(root(app).ok()?.join(format!("{}.json", video_key(Path::new(path)))))
}

/// What's saved for a file, if it was found out the current way.
pub fn saved(file: &Path) -> Option<FileInfo> {
    let info: FileInfo = serde_json::from_slice(&fs::read(file).ok()?).ok()?;
    (info.version == VERSION).then_some(info)
}

#[tauri::command]
pub fn file_info(app: AppHandle, thumbs: State<'_, Thumbs>, path: String) -> Option<FileInfo> {
    if let Some(info) = saved(&file_for(&app, &path)?) {
        return Some(info);
    }
    thumbs.send(&app, Msg::Probe(path));
    None
}

/// Reads everything from a file mpv has open, and saves it.
pub fn probe(mpv: &Mpv, file: &Path) -> Option<FileInfo> {
    let get = |name: &str| mpv.get_property(name).unwrap_or_default();
    let (audio, subs, video) = tracks(&get("track-list"));
    let dec = get("video-dec-params");
    let pixels = dec.get("pixelformat").and_then(Value::as_str).unwrap_or_default();
    let gamma = dec.get("gamma").and_then(Value::as_str).unwrap_or_default();
    let info = FileInfo {
        version: VERSION,
        duration: get("duration").as_f64().unwrap_or(0.0),
        width: video.as_ref().map(|v| v.0),
        height: video.as_ref().map(|v| v.1),
        video_codec: video.as_ref().map(|v| v.2.clone()).filter(|c| !c.is_empty()),
        bit_depth: bit_depth(pixels),
        hdr: matches!(gamma, "pq" | "hlg"),
        fps: video.and_then(|v| v.3),
        container: get("file-format").as_str().map(str::to_string),
        audio,
        subs,
        chapters: get("chapter-list").as_array().map_or(0, Vec::len),
    };
    fs::create_dir_all(file.parent()?).ok()?;
    fs::write(file, serde_json::to_vec(&info).ok()?).ok()?;
    Some(info)
}

/// "yuv420p10" -> 10, "yuv420p" -> 8.
fn bit_depth(pixel_format: &str) -> Option<i64> {
    if pixel_format.is_empty() {
        return None;
    }
    let digits: String = pixel_format.chars().rev().take_while(char::is_ascii_digit).collect::<Vec<_>>().into_iter().rev().collect();
    match digits.parse::<i64>() {
        Ok(n) if (9..=16).contains(&n) => Some(n),
        _ => Some(8),
    }
}

type VideoTrack = (i64, i64, String, Option<f64>);

/// The audio and subtitle tracks, and the picture's size, codec and frame rate, from mpv's `track-list`.
fn tracks(list: &Value) -> (Vec<Track>, Vec<Track>, Option<VideoTrack>) {
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
            forced: t.get("forced").and_then(Value::as_bool).unwrap_or(false),
        };
        match t.get("type").and_then(Value::as_str) {
            Some("audio") => audio.push(track),
            Some("sub") => subs.push(track),
            Some("video") if video.is_none() && !t.get("image").and_then(Value::as_bool).unwrap_or(false) => {
                let w = t.get("demux-w").and_then(Value::as_i64);
                let h = t.get("demux-h").and_then(Value::as_i64);
                if let (Some(w), Some(h)) = (w, h) {
                    video = Some((w, h, track.codec.unwrap_or_default(), t.get("demux-fps").and_then(Value::as_f64)));
                }
            }
            _ => {}
        }
    }
    (audio, subs, video)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bit_depths() {
        assert_eq!(bit_depth("yuv420p10"), Some(10));
        assert_eq!(bit_depth("yuv420p"), Some(8));
        assert_eq!(bit_depth("p010"), Some(10));
        assert_eq!(bit_depth(""), None);
    }
}
