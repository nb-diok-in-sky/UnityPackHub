mod package_archive;
mod package_assets;
mod package_extract;
mod package_preview;
mod system_open;

use serde::{Deserialize, Serialize};

pub use package_assets::PackageAssetList;

#[derive(Debug, Serialize, Clone)]
pub struct PackageInfo {
    pub files: Vec<String>,
    pub preview: Option<String>,
    pub file_count: usize,
}

#[derive(Debug, Deserialize)]
pub struct ExtractRequest {
    pub package_path: String,
    pub guid: String,
    pub target_dir: String,
}

#[tauri::command]
pub fn parse_unity_package(path: String) -> Result<PackageInfo, String> {
    let content = package_archive::read_package(&path)?;
    let mut files: Vec<String> = content.pathnames.values().cloned().collect();
    files.sort();
    let file_count = files.len();

    Ok(PackageInfo {
        files,
        preview: package_preview::pick_best_preview(&content.pathnames, &content.previews),
        file_count,
    })
}

#[tauri::command]
pub fn extract_package_preview(path: String) -> Result<Option<String>, String> {
    let content = package_archive::read_package(&path)?;
    Ok(package_preview::pick_best_preview(&content.pathnames, &content.previews))
}

#[tauri::command]
pub fn parse_package_assets(path: String) -> Result<PackageAssetList, String> {
    package_assets::parse_package_assets(path)
}

#[tauri::command]
pub fn debug_package_pathnames(path: String, limit: usize) -> Result<Vec<String>, String> {
    package_assets::debug_package_pathnames(path, limit)
}

#[tauri::command]
pub fn extract_single_asset(request: ExtractRequest) -> Result<Vec<String>, String> {
    package_extract::extract_single_asset(request)
}

#[tauri::command]
pub fn open_with_default_app(path: String) -> Result<(), String> {
    system_open::open_with_default_app(path)
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), String> {
    system_open::reveal_in_explorer(path)
}
