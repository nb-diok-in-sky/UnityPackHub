//! Tauri backend of UnityPackHub.
//!
//! - `library`  the user's asset folders (scan, sibling files, metadata, hashes)
//! - `package`  reading `.unitypackage` archives
//! - `unity`    the open Unity Editor and the headless preview project
//! - `system`   handing files to the OS
//! - `protocol` / `paths` / `files`  shared formats, locations and helpers

mod app_protocol;
mod events;
mod files;
mod library;
mod package;
mod paths;
mod protocol;
mod system;
mod unity;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .register_asynchronous_uri_scheme_protocol(app_protocol::SCHEME, |_context, request, responder| {
            let path = request.uri().path().to_string();
            std::thread::spawn(move || responder.respond(app_protocol::respond(&path)));
        })
        .invoke_handler(tauri::generate_handler![
            library::scan_directories,
            library::scan_model_related_files,
            library::read_asset_metadata,
            library::read_asset_metadata_table,
            library::hash_files,
            package::parse_package_assets,
            system::open_with_default_app,
            system::reveal_in_explorer,
            unity::detect_unity_project,
            unity::discover_unity_editors,
            unity::install_unity_bridge,
            unity::unity_bridge_status,
            unity::request_unity_editor_action,
            unity::collect_unity_editor_action_result,
            unity::import_package_into_unity,
            unity::request_package_previews,
            unity::list_package_preview_files,
            unity::get_rendered_previews,
            unity::clear_all_previews,
            unity::start_model_preview_job,
            unity::is_model_preview_job_running,
            unity::cancel_model_preview_job,
            unity::collect_model_preview_results,
        ])
        .setup(|app| {
            events::start(app.handle().clone());
            if cfg!(debug_assertions) {
                app.handle().plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
