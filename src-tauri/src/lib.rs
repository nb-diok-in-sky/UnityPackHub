mod package_parser;
mod scanner;
mod unity_bridge;
mod model_preview;
mod unity_paths;
mod editor_actions;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            package_parser::parse_unity_package,
            package_parser::extract_package_preview,
            package_parser::parse_package_assets,
            package_parser::extract_single_asset,
            package_parser::open_with_default_app,
            package_parser::reveal_in_explorer,
            package_parser::debug_package_pathnames,
            unity_bridge::ensure_preview_dir,
            unity_bridge::clear_all_previews,
            unity_bridge::detect_unity_project,
            unity_bridge::ensure_bridge_script,
            unity_bridge::get_package_previews,
            unity_bridge::read_preview_image,
            unity_bridge::read_all_previews,
            unity_bridge::import_with_bridge,
            unity_bridge::request_unity_editor_action,
            unity_bridge::collect_unity_editor_action_result,
            unity_bridge::is_unity_editor_bridge_ready,
            model_preview::discover_unity_editors,
            model_preview::start_model_preview_job,
            model_preview::collect_model_preview_results,
            model_preview::cancel_model_preview_job,
            model_preview::read_model_preview_image,
            scanner::scan_directories,
            scanner::scan_model_related_files,
            scanner::read_asset_metadata,
            scanner::read_asset_metadata_table,
            scanner::hash_files,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
