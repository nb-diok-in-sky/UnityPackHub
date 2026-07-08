use serde::Serialize;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Clone)]
pub struct ScannedFile {
    pub name: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
}

#[tauri::command]
pub fn scan_directories(dirs: Vec<String>) -> Result<Vec<ScannedFile>, String> {
    let mut results = Vec::new();

    for dir in &dirs {
        for entry in WalkDir::new(dir).follow_links(true).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            if !ext.eq_ignore_ascii_case("unitypackage") {
                continue;
            }
            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let display_name = file_name
                .strip_suffix(".unitypackage")
                .or_else(|| file_name.strip_suffix(".UnityPackage"))
                .or_else(|| file_name.strip_suffix(".UNITYPACKAGE"))
                .unwrap_or(&file_name)
                .to_string();
            let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);

            results.push(ScannedFile {
                name: display_name,
                file_name,
                file_path: path.to_string_lossy().to_string(),
                file_size,
            });
        }
    }

    Ok(results)
}
