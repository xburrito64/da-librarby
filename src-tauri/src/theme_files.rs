//! A theme's "your own files" folder: a font, sounds and music the owner adds themselves (for example
//! from their own copy of a game). The files stay on this PC; nothing in here is part of the app.
//! Each theme has its own folder: <app data>\theme-files\<theme id>\.

use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager};

/// File types the app can use: fonts, and sounds and music.
const USABLE: &[&str] = &["ttf", "otf", "woff", "woff2", "wav", "ogg", "mp3", "flac", "m4a", "opus"];

#[derive(Serialize)]
pub struct ThemeFiles {
    folder: String,
    files: Vec<ThemeFile>,
}

#[derive(Serialize)]
pub struct ThemeFile {
    /// The file's name without its extension, in lower case ("select", "font", ...).
    name: String,
    path: String,
}

/// The folder holding every theme's own folder.
pub fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("theme-files"))
}

fn folder(app: &AppHandle, theme: &str) -> Result<PathBuf, String> {
    if theme.is_empty() || !theme.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(format!("Not a theme: {theme}"));
    }
    let dir = root(app)?.join(theme);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// What's in a theme's own folder (created if needed).
#[tauri::command]
pub async fn theme_files(app: AppHandle, theme: String) -> Result<ThemeFiles, String> {
    let dir = folder(&app, &theme)?;
    let mut files = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        let usable = path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| USABLE.contains(&e.to_ascii_lowercase().as_str()));
        let Some(name) = path.file_stem().and_then(|n| n.to_str()) else { continue };
        if usable && path.is_file() {
            files.push(ThemeFile { name: name.to_lowercase(), path: path.to_string_lossy().into_owned() });
        }
    }
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(ThemeFiles { folder: dir.to_string_lossy().into_owned(), files })
}

/// Opens a theme's own folder in Explorer.
#[tauri::command]
pub async fn theme_files_open(app: AppHandle, theme: String) -> Result<(), String> {
    let dir = folder(&app, &theme)?;
    std::process::Command::new("explorer").arg(&dir).spawn().map_err(|e| e.to_string())?;
    Ok(())
}
