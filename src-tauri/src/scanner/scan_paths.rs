use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;
use walkdir::WalkDir;

const MODEL_EXTENSIONS: &[&str] = &["fbx", "prefab", "obj", "blend", "gltf", "glb", "dae", "3ds", "abc"];
const TEXTURE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "tga", "psd", "exr", "tif", "tiff", "bmp", "gif", "hdr", "dds"];
const MATERIAL_EXTENSIONS: &[&str] = &["mat", "mtl"];

#[derive(Debug, Serialize, Clone)]
pub struct ScannedFile {
    pub name: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    #[serde(rename = "assetKind")]
    pub asset_kind: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct RelatedFile {
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    #[serde(rename = "fileType")]
    pub file_type: String,
}

pub fn scan_directories(directories: Vec<String>) -> Result<Vec<ScannedFile>, String> {
    let files = directories.iter().flat_map(|directory| {
        WalkDir::new(directory).follow_links(true).into_iter().filter_map(Result::ok)
    }).filter_map(|entry| scanned_file(&entry));
    Ok(files.collect())
}

pub fn scan_model_related_files(model_path: String) -> Result<Vec<RelatedFile>, String> {
    let model = Path::new(&model_path);
    let parent = model.parent().ok_or("Cannot determine parent directory")?;
    if !parent.exists() { return Err("Parent directory does not exist".into()); }
    let model_name = model.file_name().and_then(|name| name.to_str()).unwrap_or_default();
    let directory = std::fs::read_dir(parent).map_err(|error| format!("Failed to read directory: {error}"))?;
    let mut seen = HashSet::new();
    let mut related: Vec<RelatedFile> = directory.filter_map(Result::ok).filter_map(|entry| {
        let path = entry.path();
        let name = path.file_name()?.to_str()?.to_string();
        if !path.is_file() || name == model_name || !seen.insert(name.clone()) { return None; }
        let file_type = related_file_type(&path)?;
        Some(RelatedFile {
            file_name: name,
            file_path: path.to_string_lossy().to_string(),
            file_size: entry.metadata().map(|metadata| metadata.len()).unwrap_or(0),
            file_type: file_type.into(),
        })
    }).collect();
    related.sort_by(|left, right| left.file_name.cmp(&right.file_name));
    Ok(related)
}

fn scanned_file(entry: &walkdir::DirEntry) -> Option<ScannedFile> {
    let path = entry.path();
    if !path.is_file() || is_unity_internal(path) { return None; }
    let extension = extension(path);
    let asset_kind = match extension.as_str() {
        "unitypackage" if !is_embedded_package(path) => "package",
        extension if MODEL_EXTENSIONS.contains(&extension) => "model",
        _ => return None,
    };
    let file_name = path.file_name()?.to_str()?.to_string();
    Some(ScannedFile {
        name: strip_extension(&file_name),
        file_name,
        file_path: path.to_string_lossy().to_string(),
        file_size: entry.metadata().map(|metadata| metadata.len()).unwrap_or(0),
        asset_kind: asset_kind.into(),
    })
}

fn related_file_type(path: &Path) -> Option<&'static str> {
    let extension = extension(path);
    if TEXTURE_EXTENSIONS.contains(&extension.as_str()) { Some("texture") }
    else if MATERIAL_EXTENSIONS.contains(&extension.as_str()) { Some("material") }
    else if extension == "prefab" { Some("prefab") }
    else if MODEL_EXTENSIONS.contains(&extension.as_str()) { Some("model") }
    else { None }
}

fn extension(path: &Path) -> String {
    path.extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase()
}

fn strip_extension(file_name: &str) -> String {
    Path::new(file_name).file_stem().and_then(|value| value.to_str()).unwrap_or(file_name).to_string()
}

fn is_unity_internal(path: &Path) -> bool {
    path.components().filter_map(|component| component.as_os_str().to_str()).any(|component| matches!(component.to_ascii_lowercase().as_str(), "library" | "packagecache" | "temp" | "obj" | "logs"))
}

fn is_embedded_package(path: &Path) -> bool {
    path.ancestors().any(|ancestor| {
        ancestor.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.eq_ignore_ascii_case("Assets"))
            && ancestor.parent().is_some_and(|project| project.join("ProjectSettings").is_dir())
    })
}
