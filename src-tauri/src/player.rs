//! Owns the single embedded mpv instance and exposes it to the frontend.
//!
//! Frontend -> mpv: the `player_*` commands below.
//! mpv -> frontend: a background thread forwards mpv events as Tauri events:
//!   `mpv:property` { name, value }   for observed properties
//!   `mpv:event`    { event, ... }    for file-loaded, end-file, shutdown, ...

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use raw_window_handle::{HasWindowHandle, RawWindowHandle};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

use crate::mpv::{Event, Mpv};

const LIBMPV_DLL: &str = "libmpv-2.dll";

#[derive(Default)]
pub struct Player {
    mpv: Mutex<Option<Arc<Mpv>>>,
    observed: Mutex<HashSet<String>>,
    closing: AtomicBool,
}

impl Player {
    fn get(&self) -> Result<Arc<Mpv>, String> {
        self.mpv
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| "The player is not running".to_string())
    }
}

#[derive(Clone, Serialize)]
struct PropertyPayload {
    name: String,
    value: Value,
}

/// Starts mpv inside `window` (if not already running) and observes `observe`.
/// Safe to call repeatedly, e.g. after a frontend reload.
#[tauri::command]
pub async fn player_init(
    app: AppHandle,
    window: WebviewWindow,
    player: State<'_, Player>,
    observe: Vec<String>,
) -> Result<(), String> {
    let mpv = {
        let mut slot = player.mpv.lock().unwrap();
        match slot.as_ref() {
            Some(mpv) => mpv.clone(),
            None => {
                let mpv = Arc::new(start_mpv(&app, &window)?);
                spawn_event_thread(app.clone(), mpv.clone());
                player.observed.lock().unwrap().clear();
                player.closing.store(false, Ordering::SeqCst);
                *slot = Some(mpv.clone());
                mpv
            }
        }
    };

    let mut observed = player.observed.lock().unwrap();
    for name in observe {
        if !observed.contains(&name) {
            mpv.observe(&name)?;
            observed.insert(name);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn player_command(player: State<'_, Player>, args: Vec<String>) -> Result<(), String> {
    player.get()?.command(&args)
}

#[tauri::command]
pub async fn player_set_property(
    player: State<'_, Player>,
    name: String,
    value: Value,
) -> Result<(), String> {
    player.get()?.set_property(&name, &value)
}

#[tauri::command]
pub async fn player_get_property(player: State<'_, Player>, name: String) -> Result<Value, String> {
    player.get()?.get_property(&name)
}

/// The folder screenshots go to (Pictures\Da Librarby), created if needed.
#[tauri::command]
pub async fn player_screenshot_dir(app: AppHandle) -> Result<String, String> {
    let dir = app.path().picture_dir().map_err(|e| e.to_string())?.join("Da Librarby");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().into_owned())
}

/// Called when the main window is asked to close. If mpv is running, asks it to
/// quit and returns true (the window must stay open until mpv has let go of it;
/// the event thread closes the window once mpv has shut down).
pub fn begin_close(app: &AppHandle) -> bool {
    let player = app.state::<Player>();
    let Ok(mpv) = player.get() else {
        return false;
    };
    if !player.closing.swap(true, Ordering::SeqCst) {
        let _ = mpv.command(&["quit"]);
        // Safety net in case mpv never reports shutdown.
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(3));
            app.exit(0);
        });
    }
    true
}

fn start_mpv(app: &AppHandle, window: &WebviewWindow) -> Result<Mpv, String> {
    let lib_path = find_libmpv(app).ok_or_else(|| {
        format!("{LIBMPV_DLL} was not found. Run scripts/setup-mpv.ps1 to download it.")
    })?;

    let handle = window.window_handle().map_err(|e| e.to_string())?;
    let wid = match handle.as_raw() {
        RawWindowHandle::Win32(h) => h.hwnd.get() as i64,
        other => return Err(format!("Unsupported window type: {other:?}")),
    };

    let options: Vec<(&str, String)> = [
        ("wid", wid.to_string()),
        // Ignore any mpv.conf on the machine so behaviour is predictable.
        ("config", "no".into()),
        ("terminal", "no".into()),
        ("vo", "gpu-next".into()),
        ("hwdec", "auto-safe".into()),
        ("keep-open", "yes".into()),
        ("idle", "yes".into()),
        ("force-window", "yes".into()),
        // Our own UI handles all input and on-screen display.
        ("osd-level", "0".into()),
        ("input-default-bindings", "no".into()),
        ("input-vo-keyboard", "no".into()),
        ("input-cursor", "no".into()),
        ("cursor-autohide", "no".into()),
        // Subtitle files next to the video with a similar name are picked up too.
        ("sub-auto", "fuzzy".into()),
        ("volume-max", "100".into()),
        ("screenshot-jpeg-quality", "92".into()),
    ]
    .into_iter()
    .collect();

    Mpv::new(&lib_path, &options)
}

fn find_libmpv(app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("lib").join(LIBMPV_DLL));
    }
    if let Some(dir) = std::env::current_exe().ok().and_then(|p| p.parent().map(Path::to_path_buf)) {
        candidates.push(dir.join("lib").join(LIBMPV_DLL));
        candidates.push(dir.join(LIBMPV_DLL));
    }
    if cfg!(debug_assertions) {
        candidates.push(Path::new(env!("CARGO_MANIFEST_DIR")).join("lib").join(LIBMPV_DLL));
    }
    candidates.into_iter().find(|p| p.exists())
}

fn spawn_event_thread(app: AppHandle, mpv: Arc<Mpv>) {
    std::thread::Builder::new()
        .name("mpv-events".into())
        .spawn(move || {
            // The playback position changes every frame; a few updates a second are plenty
            // for the interface (jumps, like after seeking, still go through right away).
            let mut last_time: Option<(Instant, f64)> = None;
            loop {
                let event = match mpv.wait_event(-1.0) {
                    Event::Shutdown => break,
                    Event::Nothing => continue,
                    Event::PropertyChange { name, value } => {
                        if name == "time-pos" {
                            let t = value.as_f64().unwrap_or(0.0);
                            if let Some((at, prev)) = last_time {
                                if at.elapsed() < Duration::from_millis(250) && (t - prev).abs() < 1.5 {
                                    continue;
                                }
                            }
                            last_time = Some((Instant::now(), t));
                        }
                        let _ = app.emit("mpv:property", PropertyPayload { name, value });
                        continue;
                    }
                    Event::StartFile => json!({ "event": "start-file" }),
                    Event::FileLoaded => json!({ "event": "file-loaded" }),
                    Event::Seek => json!({ "event": "seek" }),
                    Event::PlaybackRestart => json!({ "event": "playback-restart" }),
                    Event::EndFile { reason, error } => {
                        json!({ "event": "end-file", "reason": reason, "error": error })
                    }
                };
                let _ = app.emit("mpv:event", event);
            }

            // mpv has shut down: release it (the last Arc frees it), then finish
            // closing the window if that is what triggered the shutdown.
            let player = app.state::<Player>();
            player.mpv.lock().unwrap().take();
            drop(mpv);
            if player.closing.load(Ordering::SeqCst) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.close();
                }
            } else {
                let _ = app.emit("mpv:event", json!({ "event": "shutdown" }));
            }
        })
        .expect("failed to spawn mpv event thread");
}
