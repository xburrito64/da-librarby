//! The mini player ("picture in picture"): the window turns into a small borderless video that
//! stays on top of other windows in a corner of the screen, and grows back afterwards.
//! Where it was and how wide it was are remembered for next time.
//!
//! mpv draws into the app's own window, so the mini player is that same window made small
//! (the library isn't reachable meanwhile).

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, LogicalSize, Manager, Monitor, PhysicalPosition, PhysicalSize, State, WebviewWindow};

use crate::library::Library;
use crate::metadata::store;

const SETTING: &str = "ui.mini";
/// Width of a first mini player and its gap to the screen corner (before display scaling).
const DEFAULT_WIDTH: f64 = 480.0;
const MARGIN: f64 = 24.0;
const MIN_SIZE: LogicalSize<f64> = LogicalSize { width: 240.0, height: 135.0 };
/// The normal window's smallest size (as in tauri.conf.json).
const NORMAL_MIN_SIZE: LogicalSize<f64> = LogicalSize { width: 640.0, height: 400.0 };

/// The normal window, to go back to.
struct Normal {
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    maximized: bool,
    fullscreen: bool,
}

static NORMAL: Mutex<Option<Normal>> = Mutex::new(None);

/// Where the mini player was last time (screen pixels).
#[derive(Serialize, Deserialize)]
struct Placement {
    x: i32,
    y: i32,
    width: u32,
}

/// Turns the mini player on or off. `aspect` is the video's width / height.
#[tauri::command]
pub async fn player_mini(
    window: WebviewWindow,
    library: State<'_, Library>,
    on: bool,
    aspect: Option<f64>,
) -> Result<(), String> {
    let result = if on {
        let aspect = aspect.filter(|a| a.is_finite() && (0.25..=5.0).contains(a)).unwrap_or(16.0 / 9.0);
        enter(&window, &library, aspect)
    } else {
        leave(&window, &library)
    };
    result.map_err(|e| e.to_string())
}

/// Back to the normal window if the mini player is on (e.g. before the app closes, so the
/// normal size is what gets remembered).
pub fn restore(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = leave(&window, &app.state::<Library>());
    }
}

fn enter(window: &WebviewWindow, library: &Library, aspect: f64) -> tauri::Result<()> {
    let mut normal = NORMAL.lock().unwrap();
    if normal.is_some() {
        return Ok(());
    }
    let fullscreen = window.is_fullscreen()?;
    if fullscreen {
        window.set_fullscreen(false)?;
    }
    let maximized = window.is_maximized()?;
    if maximized {
        window.unmaximize()?;
    }
    *normal = Some(Normal {
        position: window.outer_position()?,
        size: window.inner_size()?,
        maximized,
        fullscreen,
    });

    let saved: Option<Placement> = library
        .with_db(|c| store::setting(c, SETTING))
        .ok()
        .flatten()
        .and_then(|s| serde_json::from_str(&s).ok());
    let monitors = window.available_monitors()?;
    // The screen it was on last time, if that's still connected; else the window's screen.
    let remembered = saved.and_then(|p| monitor_at(&monitors, p.x, p.y).map(|m| (m, p)));
    let current = window.current_monitor()?.or(window.primary_monitor()?);

    let (x, y, width, height, area) = match remembered {
        Some((monitor, p)) => {
            let height = (p.width as f64 / aspect).round() as u32;
            (p.x, p.y, p.width, height, *monitor.work_area())
        }
        None => {
            let Some(monitor) = current.as_ref() else { return Ok(()) };
            let scale = monitor.scale_factor();
            let area = *monitor.work_area();
            let width = (DEFAULT_WIDTH * scale).round() as u32;
            let height = (width as f64 / aspect).round() as u32;
            let margin = (MARGIN * scale).round() as i32;
            let x = area.position.x + area.size.width as i32 - width as i32 - margin;
            let y = area.position.y + area.size.height as i32 - height as i32 - margin;
            (x, y, width, height, area)
        }
    };
    // Keep it on screen.
    let width = width.min(area.size.width);
    let height = height.min(area.size.height);
    let x = x.clamp(area.position.x, area.position.x + (area.size.width - width) as i32);
    let y = y.clamp(area.position.y, area.position.y + (area.size.height - height) as i32);

    window.set_decorations(false)?;
    window.set_always_on_top(true)?;
    window.set_min_size(Some(MIN_SIZE))?;
    window.set_size(PhysicalSize::new(width, height))?;
    window.set_position(PhysicalPosition::new(x, y))?;
    Ok(())
}

fn leave(window: &WebviewWindow, library: &Library) -> tauri::Result<()> {
    let Some(normal) = NORMAL.lock().unwrap().take() else {
        return Ok(());
    };
    if let (Ok(p), Ok(s)) = (window.outer_position(), window.inner_size()) {
        let placement = serde_json::to_string(&Placement { x: p.x, y: p.y, width: s.width })?;
        let _ = library.with_db(|c| store::set_setting(c, SETTING, Some(&placement)));
    }
    window.set_always_on_top(false)?;
    window.set_min_size(Some(NORMAL_MIN_SIZE))?;
    window.set_decorations(true)?;
    window.set_size(normal.size)?;
    window.set_position(normal.position)?;
    if normal.maximized {
        window.maximize()?;
    }
    if normal.fullscreen {
        window.set_fullscreen(true)?;
    }
    Ok(())
}

fn monitor_at(monitors: &[Monitor], x: i32, y: i32) -> Option<&Monitor> {
    monitors.iter().find(|m| {
        let a = m.work_area();
        x >= a.position.x
            && y >= a.position.y
            && x < a.position.x + a.size.width as i32
            && y < a.position.y + a.size.height as i32
    })
}
