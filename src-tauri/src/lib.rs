mod library;
mod metadata;
mod mini_player;
mod mpv;
mod player;

use tauri::{Manager, WindowEvent};
use tauri_plugin_window_state::StateFlags;

/// Added to the command line when Windows starts the app at sign-in.
const AUTOSTART_FLAG: &str = "--autostart";

/// The page has drawn its first frame: show the window (minimized when Windows started the app).
#[tauri::command]
fn app_ready(app: tauri::AppHandle) {
    reveal_window(&app);
}

fn reveal_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return };
    if window.is_visible().unwrap_or(false) {
        return;
    }
    if std::env::args().any(|a| a == AUTOSTART_FLAG) {
        let _ = window.minimize();
        let _ = window.show();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Must be registered first. Opening the app again just brings the open window forward;
        // two copies would fight over the same database, player and web view data.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        // Remembers the window's size, position and maximized state (not fullscreen: the app
        // should never start in fullscreen just because it was closed during playback; nor the
        // mini player's borderless look).
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    StateFlags::all()
                        - StateFlags::FULLSCREEN
                        - StateFlags::VISIBLE
                        - StateFlags::DECORATIONS,
                )
                .build(),
        )
        // "Start with Windows" (off unless turned on in Settings); such starts begin minimized.
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![AUTOSTART_FLAG]),
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(player::Player::default())
        .setup(|app| {
            let library = library::Library::open(app.handle())?;
            app.manage(metadata::Metadata::new(&library));
            // The configured image scope only covers folders that existed at launch; the images
            // folder is created on first run, so allow it explicitly as well.
            app.asset_protocol_scope().allow_directory(&library.images_dir, true)?;
            app.manage(library);
            // Pick up anything that changed on disk since last time, in the background.
            library::request_scan(app.handle(), None);
            // From then on, notice new files and drives coming and going by itself.
            library::watcher::start(app.handle().clone());
            // The window starts hidden and the page shows it once it has drawn its first frame
            // (no black flash). Should that never happen, show it anyway.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(4));
                reveal_window(&handle);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            player::player_init,
            player::player_command,
            player::player_set_property,
            player::player_get_property,
            player::player_screenshot_dir,
            mini_player::player_mini,
            library::library_list,
            library::library_add,
            library::library_remove,
            library::library_rescan,
            library::library_focused,
            library::library_scanning,
            library::library_titles,
            library::library_title,
            library::watch_item,
            library::watch_next,
            library::watch_save,
            library::watch_set,
            library::watch_continue,
            library::watch_hide,
            library::watch_set_title,
            library::library_search,
            metadata::metadata_status,
            metadata::metadata_search,
            metadata::metadata_match_title,
            metadata::metadata_match_season,
            metadata::metadata_match_file,
            metadata::settings_tmdb_key,
            metadata::settings_set_tmdb_key,
            metadata::ui_setting,
            app_ready,
            metadata::set_ui_setting,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    // Closed from the mini player: the normal window is what gets remembered.
                    mini_player::restore(window.app_handle());
                }
                if window.label() == "main" && player::begin_close(window.app_handle()) {
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
