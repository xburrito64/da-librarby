//! Keeps the library up to date by itself, without getting in the way of the drives:
//! - drives being plugged in or removed are noticed from Windows' list of drive letters
//!   (no disk access, so sleeping drives stay asleep), and
//! - new files are looked for whenever the app's window comes to the front (after a download,
//!   say), at most once a minute.
//!
//! Watching folders for changes directly would hold them open, and Windows then refuses to
//! safely remove an external drive while the app is running.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

use super::{db, request_scan, Library};

/// How often drives are checked for being connected or disconnected.
const CHECK_DRIVES_EVERY: Duration = Duration::from_secs(20);
/// Coming back to the app looks for new files at most this often.
const RESCAN_ON_FOCUS_AFTER: Duration = Duration::from_secs(60);

static LAST_FOCUS_SCAN: Mutex<Option<Instant>> = Mutex::new(None);

pub fn start(app: AppHandle) {
    *LAST_FOCUS_SCAN.lock().unwrap() = Some(Instant::now());
    std::thread::Builder::new()
        .name("drive-watcher".into())
        .spawn(move || watch_drives(app))
        .expect("failed to spawn drive watcher");
}

/// The window came to the front: look for new files, unless that happened a moment ago.
pub fn window_focused(app: &AppHandle) {
    let mut last = LAST_FOCUS_SCAN.lock().unwrap();
    if last.is_none_or(|at| at.elapsed() >= RESCAN_ON_FOCUS_AFTER) {
        *last = Some(Instant::now());
        request_scan(app, None);
    }
}

fn watch_drives(app: AppHandle) {
    // Library id -> whether its drive was there at the last check.
    let mut before: HashMap<i64, bool> = HashMap::new();
    loop {
        let libraries = app.state::<Library>().with_db(|c| db::libraries(c)).unwrap_or_default();
        let letters = drive_letters();
        for lib in &libraries {
            let there = match drive_letter(&lib.path) {
                Some(letter) => letters & (1 << (letter - b'A')) != 0,
                // Not on a drive letter (a network path): fall back to looking.
                None => std::path::Path::new(&lib.path).is_dir(),
            };
            let was = before.insert(lib.id, there).unwrap_or(lib.online);
            if there != was {
                // Plugged in or removed: a scan brings the library up to date.
                request_scan(&app, Some(vec![lib.id]));
            }
        }
        std::thread::sleep(CHECK_DRIVES_EVERY);
    }
}

/// "F:\Anime" -> b'F'
fn drive_letter(path: &str) -> Option<u8> {
    let bytes = path.as_bytes();
    (bytes.len() >= 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic()).then(|| bytes[0].to_ascii_uppercase())
}

/// Bit 0 = A:, bit 1 = B:, ... for every drive letter Windows currently has.
#[cfg(windows)]
fn drive_letters() -> u32 {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetLogicalDrives() -> u32;
    }
    unsafe { GetLogicalDrives() }
}

#[cfg(not(windows))]
fn drive_letters() -> u32 {
    u32::MAX
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drive_letters_from_paths() {
        assert_eq!(drive_letter("F:\\"), Some(b'F'));
        assert_eq!(drive_letter("h:\\Cartoons"), Some(b'H'));
        assert_eq!(drive_letter("\\\\server\\share"), None);
    }
}
