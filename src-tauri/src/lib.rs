mod library;
mod metadata;
mod mpv;
mod player;

use tauri::{Manager, WindowEvent};

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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            player::player_init,
            player::player_command,
            player::player_set_property,
            player::player_get_property,
            library::library_list,
            library::library_add,
            library::library_remove,
            library::library_rescan,
            library::library_scanning,
            library::library_titles,
            library::library_title,
            library::watch_item,
            library::watch_next,
            library::watch_save,
            library::watch_set,
            library::watch_continue,
            metadata::metadata_status,
            metadata::metadata_search,
            metadata::metadata_match_title,
            metadata::metadata_match_season,
            metadata::metadata_match_file,
            metadata::settings_tmdb_key,
            metadata::settings_set_tmdb_key,
            metadata::ui_setting,
            metadata::set_ui_setting,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" && player::begin_close(window.app_handle()) {
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
