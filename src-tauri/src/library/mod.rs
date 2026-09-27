//! The user's asset library on disk: scanning folders, sibling files, metadata tables, hashes.

mod hash;
mod metadata;
mod scan;

pub use hash::FileHashResult;
pub use metadata::AssetMetadata;
pub use scan::{RelatedFile, ScanResult};

#[tauri::command(async)]
pub fn scan_directories(dirs: Vec<String>) -> Result<ScanResult, String> {
    scan::scan_directories(dirs)
}

#[tauri::command(async)]
pub fn scan_model_related_files(model_path: String) -> Result<Vec<RelatedFile>, String> {
    scan::scan_model_related_files(model_path)
}

#[tauri::command(async)]
pub fn read_asset_metadata_table(json_path: String) -> Result<Vec<AssetMetadata>, String> {
    metadata::read_asset_metadata_table(json_path)
}

#[tauri::command(async)]
pub fn read_asset_metadata(json_path: String, asset_path: String) -> Result<Option<AssetMetadata>, String> {
    metadata::read_asset_metadata(json_path, asset_path)
}

#[tauri::command(async)]
pub fn hash_files(paths: Vec<String>) -> Vec<FileHashResult> {
    hash::hash_files(paths)
}
