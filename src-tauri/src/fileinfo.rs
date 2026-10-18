//! What's in a video file, for a movie's page and an episode's card: length, picture (size, codec,
//! 10-bit, colours, HDR), the audio and subtitle tracks, chapters. The hidden mpv of `thumbnails` opens the file once and
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
pub const VERSION: u32 = 2;

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
    /// "Main 10", "High"...
    pub video_profile: Option<String>,
    /// Bits per second.
    pub video_bitrate: Option<i64>,
    /// How the colours are stored, as mpv names them: "bt.709", "bt.2020-ncl"...
    pub color_matrix: Option<String>,
    pub color_primaries: Option<String>,
    /// "bt.1886" (SDR), "pq" (HDR10), "hlg"...
    pub color_transfer: Option<String>,
    /// "limited" (TV) or "full" (PC).
    pub color_range: Option<String>,
    /// "4:2:0", "4:2:2", "4:4:4".
    pub chroma: Option<String>,
    /// Its Dolby Vision profile, when it has one (5, 7, 8).
    pub dolby_vision: Option<i64>,
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
    /// "5.1(side)", "stereo"...
    pub layout: Option<String>,
    /// "LC", "DTS-HD MA"...
    pub profile: Option<String>,
    pub sample_rate: Option<i64>,
    /// Bits per second.
    pub bitrate: Option<i64>,
    pub default: bool,
    pub hearing_impaired: bool,
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
    // (With the picture decoded by the graphics card, its own format is the one that tells.)
    let pixels = dec.get("hw-pixelformat").or_else(|| dec.get("pixelformat")).and_then(Value::as_str).unwrap_or_default();
    let gamma = dec.get("gamma").and_then(Value::as_str).unwrap_or_default();
    let param = |key: &str| dec.get(key).and_then(Value::as_str).filter(|v| !v.is_empty() && *v != "auto").map(str::to_string);
    let info = FileInfo {
        version: VERSION,
        duration: get("duration").as_f64().unwrap_or(0.0),
        width: video.as_ref().map(|v| v.width),
        height: video.as_ref().map(|v| v.height),
        video_codec: video.as_ref().and_then(|v| v.track.codec.clone()).filter(|c| !c.is_empty()),
        bit_depth: bit_depth(pixels),
        hdr: matches!(gamma, "pq" | "hlg"),
        fps: video.as_ref().and_then(|v| v.fps),
        video_profile: video.as_ref().and_then(|v| v.track.profile.clone()),
        video_bitrate: video.as_ref().and_then(|v| v.track.bitrate),
        color_matrix: param("colormatrix"),
        color_primaries: param("primaries"),
        color_transfer: param("gamma"),
        color_range: param("colorlevels"),
        chroma: chroma(pixels).map(str::to_string),
        dolby_vision: video.and_then(|v| v.dolby_vision),
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

/// "yuv420p10", "p010" -> "4:2:0".
fn chroma(pixel_format: &str) -> Option<&'static str> {
    let is = |names: &[&str]| names.iter().any(|n| pixel_format.starts_with(n));
    if is(&["yuv420", "yuvj420", "nv12", "nv21", "p010", "p012", "p016"]) {
        Some("4:2:0")
    } else if is(&["yuv422", "yuvj422", "p210", "p212", "p216", "y210"]) {
        Some("4:2:2")
    } else if is(&["yuv444", "yuvj444", "p410", "p412", "p416", "gbr"]) {
        Some("4:4:4")
    } else {
        None
    }
}

struct VideoTrack {
    width: i64,
    height: i64,
    fps: Option<f64>,
    dolby_vision: Option<i64>,
    track: Track,
}

/// The audio and subtitle tracks, and the picture's size, codec and frame rate, from mpv's `track-list`.
fn tracks(list: &Value) -> (Vec<Track>, Vec<Track>, Option<VideoTrack>) {
    let flag = |t: &Value, key: &str| t.get(key).and_then(Value::as_bool).unwrap_or(false);
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
            forced: flag(t, "forced"),
            // ("unknown2": no layout given, only how many channels.)
            layout: text("demux-channels").filter(|l| !l.starts_with("unknown")),
            profile: text("codec-profile").filter(|p| !p.is_empty()),
            sample_rate: t.get("demux-samplerate").and_then(Value::as_i64),
            // Given by the file itself (Matroska's statistics), or worked out while reading it.
            bitrate: t
                .pointer("/metadata/BPS")
                .and_then(Value::as_str)
                .and_then(|b| b.parse().ok())
                .or_else(|| t.get("demux-bitrate").and_then(Value::as_i64))
                .filter(|&b| b > 0),
            default: flag(t, "default"),
            hearing_impaired: flag(t, "hearing-impaired"),
        };
        match t.get("type").and_then(Value::as_str) {
            Some("audio") => audio.push(track),
            Some("sub") => subs.push(track),
            Some("video") if video.is_none() && !flag(t, "image") && !flag(t, "albumart") => {
                let w = t.get("demux-w").and_then(Value::as_i64);
                let h = t.get("demux-h").and_then(Value::as_i64);
                if let (Some(width), Some(height)) = (w, h) {
                    video = Some(VideoTrack {
                        width,
                        height,
                        fps: t.get("demux-fps").and_then(Value::as_f64),
                        dolby_vision: t.get("dolby-vision-profile").and_then(Value::as_i64).filter(|&p| p > 0),
                        track,
                    });
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
        assert_eq!(chroma("p010"), Some("4:2:0"));
        assert_eq!(chroma("yuv444p12"), Some("4:4:4"));
        assert_eq!(chroma("d3d11"), None);
        assert_eq!(bit_depth(""), None);
    }
}
