//! Everything that talks to Unity: the open editor (bridge scripts, previews, editor actions)
//! and the headless preview project (model covers). File formats live in `crate::protocol`.

mod bridge_installer;
mod editor_actions;
mod editors;
mod model_preview;
mod previews;
mod project;

use crate::protocol::{EditorActionResult, ModelPreviewResult};
use editor_actions::BridgeStatus;
use model_preview::ModelPreviewRequest;
use previews::{PrefabRef, PreviewFolder, RenderedPreviews};
use std::collections::HashMap;

// ---------------------------------------------------------------- open editor

#[tauri::command(async)]
pub fn detect_unity_project() -> Result<Option<String>, String> { project::detect_unity_project() }

#[tauri::command(async)]
pub fn discover_unity_editors() -> Vec<String> { editors::discover() }

#[tauri::command(async)]
pub fn install_unity_bridge(project_path: String) -> Result<bool, String> {
    bridge_installer::install_project_bridge(&project_path)
}

#[tauri::command]
pub fn unity_bridge_status(project_path: String) -> BridgeStatus { editor_actions::status(&project_path) }

#[tauri::command(async)]
pub fn request_unity_editor_action(project_path: String, action: String, source_path: String) -> Result<String, String> {
    bridge_installer::install_project_bridge(&project_path)?;
    editor_actions::request(&project_path, &action, &source_path)
}

#[tauri::command(async)]
pub fn collect_unity_editor_action_result(id: String) -> Result<Option<EditorActionResult>, String> {
    editor_actions::collect(&id)
}

/// Installs the bridge, prepares previews for the package, then hands the package to Unity.
#[tauri::command(async)]
pub fn import_package_into_unity(package_path: String, project_path: String, package_key: String) -> Result<bool, String> {
    let bridge_changed = bridge_installer::install_project_bridge(&project_path)?;
    // Previews are best effort: a package we cannot parse must still be importable.
    if let Err(error) = previews::prepare_import(&package_path, &package_key) {
        log::warn!("Skipping previews for {package_path}: {error}");
    }
    // Give Unity time to compile an updated bridge before the import starts.
    if bridge_changed { std::thread::sleep(std::time::Duration::from_secs(5)); }
    crate::system::open_with_default_app(package_path)?;
    Ok(bridge_changed)
}

// ---------------------------------------------------------------- package previews

#[tauri::command(async)]
pub fn request_package_previews(package_key: String, prefabs: Vec<PrefabRef>) -> Result<PreviewFolder, String> {
    previews::request_previews(&package_key, prefabs)
}

#[tauri::command(async)]
pub fn read_package_preview_images(package_key: String) -> HashMap<String, String> {
    previews::read_images_of(&package_key)
}

#[tauri::command(async)]
pub fn get_rendered_previews(package_key: String) -> Result<Option<RenderedPreviews>, String> {
    previews::rendered_previews(&package_key)
}

#[tauri::command(async)]
pub fn clear_all_previews() -> Result<u32, String> { previews::clear_all() }

// ---------------------------------------------------------------- model covers

#[tauri::command(async)]
pub fn start_model_preview_job(unity_editor_path: String, models: Vec<ModelPreviewRequest>, shader_rules_path: String) -> Result<u32, String> {
    model_preview::start(&unity_editor_path, models, &shader_rules_path)
}

#[tauri::command]
pub fn is_model_preview_job_running() -> bool { model_preview::is_running() }

#[tauri::command]
pub fn cancel_model_preview_job() -> Result<bool, String> { model_preview::cancel() }

#[tauri::command(async)]
pub fn collect_model_preview_results() -> Result<Vec<ModelPreviewResult>, String> { model_preview::collect_results() }

#[tauri::command(async)]
pub fn read_image_file(path: String) -> Result<String, String> {
    crate::files::read_png_data_url(std::path::Path::new(&path))
}
