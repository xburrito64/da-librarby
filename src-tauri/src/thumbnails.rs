//! Little pictures for the seek bar: a second, hidden mpv grabs a frame every few seconds of
//! the video that's playing, in the background. The whole bar gets covered coarsely first and
//! then filled in, and the spot being pointed at is always done next.
//!
//! The pictures are kept in `<app data>/thumbs/<video>/<n>.jpg` (for the most recently played
//! videos only), so watching something again has them straight away.
//!
//! Frontend -> here: `thumbs_open` (a video started), `thumbs_want` (pointing at a time),
//! `thumbs_close` (the player closed).
//! Here -> frontend: `thumbs:info` { path, dir, interval, count, ready } once a video is
//! ready, and `thumbs:ready` { path, index } for each new picture.

use std::collections::VecDeque;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::time::{Duration, Instant, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::mpv::{Event, Mpv};

/// About this many pictures per video, but never closer together than `MIN_INTERVAL` seconds.
const TARGET_COUNT: f64 = 200.0;
const MIN_INTERVAL: f64 = 4.0;
/// Picture width in pixels.
const WIDTH: u32 = 320;
/// Folders of this many videos are kept; older ones are deleted.
const KEEP_VIDEOS: usize = 40;

enum Msg {
    Open(String),
    Want(String, f64),
    Close,
}

#[derive(Default)]
pub struct Thumbs {
    tx: Mutex<Option<Sender<Msg>>>,
}

impl Thumbs {
    fn send(&self, app: &AppHandle, msg: Msg) {
        let mut tx = self.tx.lock().unwrap();
        if tx.is_none() {
            let (sender, receiver) = mpsc::channel();
            let app = app.clone();
            let spawned = std::thread::Builder::new()
                .name("thumbnails".into())
                .spawn(move || Worker::new(app, receiver).run());
            if spawned.is_err() {
                return;
            }
            *tx = Some(sender);
        }
        if tx.as_ref().is_some_and(|t| t.send(msg).is_err()) {
            // The worker stopped (e.g. libmpv failed to start); try again next time.
            *tx = None;
        }
    }
}

#[tauri::command]
pub fn thumbs_open(app: AppHandle, thumbs: State<'_, Thumbs>, path: String) {
    thumbs.send(&app, Msg::Open(path));
}

#[tauri::command]
pub fn thumbs_want(app: AppHandle, thumbs: State<'_, Thumbs>, path: String, time: f64) {
    thumbs.send(&app, Msg::Want(path, time));
}

#[tauri::command]
pub fn thumbs_close(app: AppHandle, thumbs: State<'_, Thumbs>) {
    thumbs.send(&app, Msg::Close);
}

/// Where the pictures of all videos live (allowed for the page to load, see lib.rs).
pub fn root(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.path().app_local_data_dir()?.join("thumbs"))
}

#[derive(Clone, Serialize, Deserialize, PartialEq)]
struct Layout {
    interval: f64,
    count: usize,
}

struct Job {
    path: String,
    dir: PathBuf,
    layout: Layout,
    done: Vec<bool>,
    /// Coarse to fine: every 32nd picture first, then every 16th, ...
    order: VecDeque<usize>,
    /// Pointed at: done before anything else.
    wanted: Option<usize>,
}

impl Job {
    fn next(&mut self) -> Option<usize> {
        if let Some(i) = self.wanted.take() {
            // The picture nearest to the pointed-at spot that isn't there yet.
            let near = (0..self.done.len()).filter(|&j| !self.done[j]).min_by_key(|&j| j.abs_diff(i));
            if let Some(j) = near.filter(|&j| j.abs_diff(i) <= 2) {
                return Some(j);
            }
        }
        while let Some(i) = self.order.pop_front() {
            if !self.done[i] {
                return Some(i);
            }
        }
        None
    }
}

struct Worker {
    app: AppHandle,
    rx: Receiver<Msg>,
    mpv: Option<Mpv>,
    job: Option<Job>,
    /// A video is open in the hidden mpv (closed again when there's nothing left to do, so it
    /// doesn't keep a drive busy).
    loaded: bool,
}

impl Worker {
    fn new(app: AppHandle, rx: Receiver<Msg>) -> Self {
        Self { app, rx, mpv: None, job: None, loaded: false }
    }

    fn run(mut self) {
        loop {
            // Waits for news while idle; only peeks while there's work.
            let busy = self.job.as_ref().is_some_and(|j| j.done.iter().any(|d| !d));
            let msg = if busy {
                match self.rx.try_recv() {
                    Ok(m) => Some(m),
                    Err(mpsc::TryRecvError::Empty) => None,
                    Err(mpsc::TryRecvError::Disconnected) => return,
                }
            } else {
                self.unload();
                match self.rx.recv_timeout(Duration::from_secs(60)) {
                    Ok(m) => Some(m),
                    Err(RecvTimeoutError::Timeout) => continue,
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            };
            match msg {
                Some(Msg::Open(path)) => self.open(path),
                Some(Msg::Want(path, time)) => {
                    if let Some(job) = self.job.as_mut().filter(|j| j.path == path) {
                        let i = ((time / job.layout.interval).round() as usize).min(job.layout.count - 1);
                        job.wanted = Some(i);
                    }
                }
                Some(Msg::Close) => {
                    self.job = None;
                    self.unload();
                }
                None => self.step(),
            }
        }
    }

    fn mpv(&mut self) -> Option<&Mpv> {
        if self.mpv.is_none() {
            let lib = crate::player::find_libmpv(&self.app)?;
            let options: Vec<(&str, String)> = [
                ("config", "no"),
                ("terminal", "no"),
                // No picture, sound or subtitles: frames are only decoded for the pictures.
                ("vo", "null"),
                ("ao", "null"),
                ("aid", "no"),
                ("sid", "no"),
                ("hwdec", "no"),
                ("pause", "yes"),
                ("idle", "yes"),
                ("keep-open", "always"),
                // Jump to the nearest keyframe: much faster, and close enough for a preview.
                ("hr-seek", "no"),
                ("demuxer-readahead-secs", "0"),
                ("vd-lavc-fast", "yes"),
                ("vd-lavc-skiploopfilter", "all"),
                ("vd-lavc-threads", "2"),
                ("vf", &format!("scale=w={WIDTH}:h=-2")),
                ("screenshot-format", "jpg"),
                ("screenshot-jpeg-quality", "72"),
            ]
            .into_iter()
            .map(|(k, v)| (k, v.to_string()))
            .collect();
            self.mpv = Mpv::new(&lib, &options).ok();
        }
        self.mpv.as_ref()
    }

    /// Starts on a video: reuses pictures made earlier, works out the rest.
    fn open(&mut self, path: String) {
        if self.job.as_ref().is_some_and(|j| j.path == path) {
            self.emit_info();
            return;
        }
        self.job = None;
        let Ok(root) = root(&self.app) else { return };
        let dir = root.join(video_key(Path::new(&path)));
        let Some(mpv) = self.mpv() else { return };
        let opened = mpv.command(&["loadfile", &path]).is_ok() && wait_for(mpv, true);
        let duration = mpv.get_property("duration").ok().and_then(|v| v.as_f64()).unwrap_or(0.0);
        self.loaded = opened;
        if !opened {
            return;
        }
        if duration <= 1.0 {
            return;
        }
        let interval = (duration / TARGET_COUNT).max(MIN_INTERVAL);
        let layout = Layout { interval, count: (duration / interval).ceil().max(1.0) as usize };

        // Pictures from an earlier time, if they were made the same way.
        let info = dir.join("info.json");
        let earlier: Option<Layout> = fs::read(&info).ok().and_then(|b| serde_json::from_slice(&b).ok());
        if earlier.as_ref() != Some(&layout) {
            let _ = fs::remove_dir_all(&dir);
        }
        if fs::create_dir_all(&dir).is_err() {
            return;
        }
        let _ = fs::write(&info, serde_json::to_vec(&layout).unwrap_or_default());
        let done: Vec<bool> = (0..layout.count).map(|i| dir.join(format!("{i}.jpg")).exists()).collect();
        let order = coarse_to_fine(layout.count);
        self.job = Some(Job { path, dir, layout, done, order, wanted: None });
        self.emit_info();
        forget_old(&root);
    }

    fn emit_info(&self) {
        let Some(job) = &self.job else { return };
        let ready: Vec<usize> = (0..job.done.len()).filter(|&i| job.done[i]).collect();
        let _ = self.app.emit(
            "thumbs:info",
            json!({
                "path": job.path,
                "dir": job.dir,
                "interval": job.layout.interval,
                "count": job.layout.count,
                "ready": ready,
            }),
        );
    }

    /// Makes one picture.
    fn step(&mut self) {
        let Some(i) = self.job.as_mut().and_then(Job::next) else { return };
        let (path, file, time) = {
            let job = self.job.as_ref().unwrap();
            (job.path.clone(), job.dir.join(format!("{i}.jpg")), i as f64 * job.layout.interval)
        };
        if !self.loaded {
            let Some(mpv) = self.mpv() else { return };
            if mpv.command(&["loadfile", &path]).is_err() || !wait_for(mpv, true) {
                self.job = None;
                return;
            }
            self.loaded = true;
        }
        let Some(mpv) = self.mpv.as_ref() else { return };
        let ok = mpv.command(&["seek", &format!("{time:.2}"), "absolute+keyframes"]).is_ok()
            && wait_for(mpv, false)
            && mpv.command(&["screenshot-to-file", &file.to_string_lossy(), "video"]).is_ok();
        let job = self.job.as_mut().unwrap();
        // Marked done even if it failed (e.g. no picture right at the end), so it isn't retried forever.
        job.done[i] = true;
        if ok {
            let _ = self.app.emit("thumbs:ready", json!({ "path": job.path, "index": i }));
        }
    }

    fn unload(&mut self) {
        if self.loaded {
            if let Some(mpv) = &self.mpv {
                let _ = mpv.command(&["stop"]);
            }
            self.loaded = false;
        }
    }
}

/// Waits until mpv has a picture ready after loading (`loading`) or seeking. False if that
/// didn't happen within a few seconds or the file couldn't be opened.
fn wait_for(mpv: &Mpv, loading: bool) -> bool {
    let start = Instant::now();
    let limit = Duration::from_secs(if loading { 20 } else { 4 });
    // Messages left over from before (the "stop" when the last video was let go of ends with
    // an end-of-file) don't count: only those after this load or seek has begun.
    let mut begun = false;
    while start.elapsed() < limit {
        match mpv.wait_event(0.25) {
            Event::StartFile if loading => begun = true,
            Event::Seek if !loading => begun = true,
            Event::PlaybackRestart if begun => return true,
            Event::EndFile { .. } if loading && begun => return false,
            _ => {}
        }
    }
    false
}

/// 0, 32, 64, ... then 16, 48, ... then 8, 24, ... down to every picture.
fn coarse_to_fine(count: usize) -> VecDeque<usize> {
    let mut order = VecDeque::with_capacity(count);
    let mut seen = vec![false; count];
    let mut step = 32;
    loop {
        for i in (0..count).step_by(step) {
            if !seen[i] {
                seen[i] = true;
                order.push_back(i);
            }
        }
        if step == 1 {
            return order;
        }
        step /= 2;
    }
}

/// A folder name for a video: changes when the file is replaced by another one.
fn video_key(path: &Path) -> String {
    let meta = fs::metadata(path).ok();
    let size = meta.as_ref().map_or(0, |m| m.len());
    let mtime = meta
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_secs());
    // FNV-1a: stable between app versions, unlike the standard library's hasher.
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in format!("{}|{size}|{mtime}", path.to_string_lossy().to_lowercase()).bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

/// Deletes the pictures of all but the most recently played videos.
fn forget_old(root: &Path) {
    let Ok(entries) = fs::read_dir(root) else { return };
    let mut dirs: Vec<(std::time::SystemTime, PathBuf)> = entries
        .flatten()
        .filter(|e| e.path().is_dir())
        .map(|e| {
            let at = fs::metadata(e.path().join("info.json")).and_then(|m| m.modified()).unwrap_or(UNIX_EPOCH);
            (at, e.path())
        })
        .collect();
    dirs.sort_by_key(|d| std::cmp::Reverse(d.0));
    for (_, dir) in dirs.into_iter().skip(KEEP_VIDEOS) {
        let _ = fs::remove_dir_all(dir);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coarse_first_then_every_picture_once() {
        let order = coarse_to_fine(100);
        assert_eq!(&order.iter().take(4).copied().collect::<Vec<_>>(), &[0, 32, 64, 96]);
        let mut sorted: Vec<usize> = order.into_iter().collect();
        sorted.sort();
        assert_eq!(sorted, (0..100).collect::<Vec<_>>());
    }
}
