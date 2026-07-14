mod package_parser;
mod scanner;
mod unity_bridge;

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
      scanner::scan_directories,
      scanner::scan_model_related_files,
      scanner::read_asset_metadata,
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
