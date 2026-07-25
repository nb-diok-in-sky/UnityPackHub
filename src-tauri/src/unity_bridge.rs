mod bridge_installer;
mod project_detector;
mod preview_store;

use crate::editor_actions;
pub use preview_store::{PackagePreviews, PreviewDirInfo};

#[tauri::command]
pub fn request_unity_editor_action(project_path: String, action: String, source_path: String) -> Result<String, String> {
    ensure_bridge_script(project_path.clone())?;
    editor_actions::request(&project_path, &action, &source_path)
}

#[tauri::command]
pub fn collect_unity_editor_action_result(id: String) -> Result<Option<String>, String> {
    editor_actions::collect(&id)
}

#[tauri::command]
pub fn is_unity_editor_bridge_ready() -> Result<bool, String> {
    Ok(editor_actions::is_ready())
}

#[tauri::command]
pub fn ensure_preview_dir(package_name: String, prefab_names: Vec<serde_json::Value>) -> Result<PreviewDirInfo, String> {
    preview_store::ensure_preview_dir(package_name, prefab_names)
}

#[tauri::command]
pub fn clear_all_previews() -> Result<u32, String> {
    preview_store::clear_all_previews()
}

#[tauri::command]
pub fn detect_unity_project() -> Result<Option<String>, String> {
    project_detector::detect_unity_project()
}

#[tauri::command]
pub fn ensure_bridge_script(project_path: String) -> Result<bool, String> {
    bridge_installer::ensure_bridge_script(&project_path)
}

#[tauri::command]
pub fn get_package_previews(package_name: String) -> Result<Option<PackagePreviews>, String> {
    preview_store::get_package_previews(package_name)
}

#[tauri::command]
pub fn read_preview_image(preview_dir: String, filename: String) -> Result<String, String> {
    preview_store::read_preview_image(preview_dir, filename)
}

#[tauri::command]
pub fn read_all_previews(preview_dir: String) -> Result<std::collections::HashMap<String, String>, String> {
    preview_store::read_all_previews(preview_dir)
}

#[tauri::command]
pub fn import_with_bridge(package_path: String, project_path: String) -> Result<bool, String> {
    let newly_installed = bridge_installer::ensure_bridge_script(&project_path)?;
    if newly_installed { std::thread::sleep(std::time::Duration::from_secs(5)); }
    crate::package_parser::open_with_default_app(package_path)?;
    Ok(newly_installed)
}
