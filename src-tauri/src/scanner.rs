mod file_hash;
mod metadata_reader;
mod scan_paths;

pub use file_hash::FileHashResult;
pub use metadata_reader::AssetMetadata;
pub use scan_paths::{RelatedFile, ScannedFile};

#[tauri::command]
pub fn scan_directories(dirs: Vec<String>) -> Result<Vec<ScannedFile>, String> {
    scan_paths::scan_directories(dirs)
}

#[tauri::command]
pub fn scan_model_related_files(model_path: String) -> Result<Vec<RelatedFile>, String> {
    scan_paths::scan_model_related_files(model_path)
}

#[tauri::command]
pub fn read_asset_metadata_table(json_path: String) -> Result<Vec<AssetMetadata>, String> {
    metadata_reader::read_asset_metadata_table(json_path)
}

#[tauri::command]
pub fn read_asset_metadata(json_path: String, asset_path: String) -> Result<Option<AssetMetadata>, String> {
    metadata_reader::read_asset_metadata(json_path, asset_path)
}

#[tauri::command]
pub fn hash_files(paths: Vec<String>) -> Vec<FileHashResult> {
    file_hash::hash_files(paths)
}
