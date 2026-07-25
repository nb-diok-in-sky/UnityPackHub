use base64::Engine;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use crate::unity_paths::preview_root;

#[derive(Debug, Serialize, Clone)]
pub struct PreviewEntry {
    pub path: String,
    pub name: String,
    #[serde(rename = "type")]
    pub asset_type: String,
    pub preview: String,
    #[serde(rename = "renderType")]
    pub render_type: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct PackagePreviews {
    pub package_name: String,
    pub entries: Vec<PreviewEntry>,
    pub preview_dir: String,
}

#[derive(Debug, Serialize)]
pub struct PreviewDirInfo {
    pub path: String,
    pub existing_files: Vec<String>,
}

pub fn ensure_preview_dir(package_name: String, prefab_names: Vec<serde_json::Value>) -> Result<PreviewDirInfo, String> {
    let directory = preview_root().join(&package_name);
    fs::create_dir_all(&directory).map_err(|error| format!("Failed to create preview dir: {error}"))?;
    if !prefab_names.is_empty() {
        let requests: Vec<_> = prefab_names.into_iter().filter_map(preview_request).collect();
        write_if_changed(&directory.join("prefabs.json"), &serde_json::to_string_pretty(&requests).unwrap_or_default())?;
        let has_missing = requests.iter().filter_map(|request| request.get("outputFile")?.as_str()).any(|name| !directory.join(name).exists());
        if has_missing { fs::write(directory.join("_trigger"), "").map_err(|error| format!("Failed to trigger Unity preview generation: {error}"))?; }
    }
    Ok(PreviewDirInfo { path: directory.to_string_lossy().to_string(), existing_files: png_names(&directory) })
}

pub fn clear_all_previews() -> Result<u32, String> {
    let root = preview_root();
    if !root.exists() { return Ok(0); }
    let mut count = 0;
    for directory in fs::read_dir(root).map_err(|error| error.to_string())?.filter_map(Result::ok).filter(|entry| entry.path().is_dir()) {
        for file in fs::read_dir(directory.path()).into_iter().flatten().filter_map(Result::ok) {
            if matches!(extension(&file.path()), Some("png" | "json")) && fs::remove_file(file.path()).is_ok() { count += 1; }
        }
        let _ = fs::remove_dir(directory.path());
    }
    Ok(count)
}

pub fn get_package_previews(package_name: String) -> Result<Option<PackagePreviews>, String> {
    let directory = preview_root().join(&package_name);
    let manifest = directory.join("manifest.json");
    if !manifest.exists() { return Ok(None); }
    let content = fs::read_to_string(manifest).map_err(|error| format!("Failed to read manifest: {error}"))?;
    let values: Vec<serde_json::Value> = serde_json::from_str(&content).map_err(|error| format!("Failed to parse manifest: {error}"))?;
    let entries = values.into_iter().filter_map(preview_entry).collect();
    Ok(Some(PackagePreviews { package_name, entries, preview_dir: directory.to_string_lossy().to_string() }))
}

pub fn read_preview_image(preview_dir: String, filename: String) -> Result<String, String> {
    encode_file(&Path::new(&preview_dir).join(filename))
}

pub fn read_all_previews(preview_dir: String) -> Result<HashMap<String, String>, String> {
    let directory = Path::new(&preview_dir);
    if !directory.exists() { return Ok(HashMap::new()); }
    Ok(fs::read_dir(directory).into_iter().flatten().filter_map(Result::ok).filter_map(|entry| {
        let path = entry.path();
        if extension(&path) != Some("png") { return None; }
        Some((entry.file_name().to_str()?.to_string(), encode_file(&path).ok()?))
    }).collect())
}

fn preview_request(value: serde_json::Value) -> Option<serde_json::Value> {
    let pathname = value.get("pathname")?.as_str()?;
    let filename = value.get("filename")?.as_str()?;
    Some(serde_json::json!({ "pathname": pathname, "filename": filename, "outputFile": preview_output_file(pathname, filename) }))
}

fn preview_entry(value: serde_json::Value) -> Option<PreviewEntry> {
    Some(PreviewEntry {
        path: value.get("path")?.as_str()?.into(),
        name: value.get("name")?.as_str()?.into(),
        asset_type: value.get("type")?.as_str()?.into(),
        preview: value.get("preview")?.as_str()?.into(),
        render_type: value.get("renderType").and_then(|item| item.as_str()).unwrap_or("thumbnail").into(),
    })
}

fn preview_output_file(pathname: &str, filename: &str) -> String {
    let hash = pathname.replace('\\', "/").to_ascii_lowercase().bytes().fold(2166136261_u32, |hash, byte| (hash ^ byte as u32).wrapping_mul(16777619));
    format!("{filename}--{hash:08x}.png")
}

fn write_if_changed(path: &Path, content: &str) -> Result<(), String> {
    if fs::read_to_string(path).ok().as_deref() != Some(content) { fs::write(path, content).map_err(|error| format!("Failed to write preview requests: {error}"))?; }
    Ok(())
}

fn png_names(directory: &Path) -> Vec<String> {
    fs::read_dir(directory).into_iter().flatten().filter_map(Result::ok).filter(|entry| extension(&entry.path()) == Some("png")).filter_map(|entry| entry.file_name().to_str().map(String::from)).collect()
}

fn encode_file(path: &Path) -> Result<String, String> {
    let data = fs::read(path).map_err(|error| format!("Failed to read preview: {error}"))?;
    Ok(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(data)))
}

fn extension(path: &Path) -> Option<&str> {
    path.extension()?.to_str()
}
