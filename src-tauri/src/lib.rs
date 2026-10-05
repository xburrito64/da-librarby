mod library;
mod mpv;
mod player;

use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(player::Player::default())
        .setup(|app| {
            app.manage(library::Library::open(app.handle())?);
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
