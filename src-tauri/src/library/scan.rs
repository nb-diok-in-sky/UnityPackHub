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

#[derive(Debug, Serialize)]
pub struct ScanResult {
    pub files: Vec<ScannedFile>,
    /// Directories that were actually readable. Assets outside these must not be
    /// treated as deleted: an unplugged drive would otherwise wipe their tags and notes.
    #[serde(rename = "scannedDirectories")]
    pub scanned_directories: Vec<String>,
}

/// Scan progress, reported while walking the folders.
#[derive(Debug, Serialize, Clone, Copy, Default)]
pub struct ScanProgress {
    /// Files and folders looked at so far.
    pub visited: usize,
    /// Packages and models found so far.
    pub found: usize,
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

/// Walks the folders; `on_progress` is called for every visited entry and decides itself
/// how often to report (see `library::scan_directories`).
pub fn scan_directories(directories: Vec<String>, mut on_progress: impl FnMut(ScanProgress)) -> Result<ScanResult, String> {
    let mut result = ScanResult { files: Vec::new(), scanned_directories: Vec::new() };
    let mut progress = ScanProgress::default();
    for directory in directories {
        if std::fs::read_dir(&directory).is_err() { continue; }
        let walker = WalkDir::new(&directory).follow_links(true).into_iter()
            .filter_entry(|entry| !is_unity_internal_dir(entry));
        for entry in walker.filter_map(Result::ok) {
            progress.visited += 1;
            if let Some(file) = scanned_file(&entry) {
                result.files.push(file);
                progress.found += 1;
            }
            on_progress(progress);
        }
        result.scanned_directories.push(directory);
    }
    Ok(result)
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
    if !entry.file_type().is_file() { return None; }
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

use crate::files::extension_lowercase as extension;

fn strip_extension(file_name: &str) -> String {
    Path::new(file_name).file_stem().and_then(|value| value.to_str()).unwrap_or(file_name).to_string()
}

/// Skips generated folders only when they sit at the root of a Unity project, so that a
/// user folder that happens to be called "Library" or "Temp" is still scanned.
fn is_unity_internal_dir(entry: &walkdir::DirEntry) -> bool {
    if !entry.file_type().is_dir() { return false; }
    let is_generated = entry.file_name().to_str().is_some_and(|name| {
        matches!(name.to_ascii_lowercase().as_str(), "library" | "temp" | "obj" | "logs" | "usersettings")
    });
    is_generated && entry.path().parent().is_some_and(|project| project.join("ProjectSettings").is_dir())
}

fn is_embedded_package(path: &Path) -> bool {
    path.ancestors().any(|ancestor| {
        ancestor.file_name().and_then(|name| name.to_str()).is_some_and(|name| name.eq_ignore_ascii_case("Assets"))
            && ancestor.parent().is_some_and(|project| project.join("ProjectSettings").is_dir())
    })
}

#[cfg(test)]
mod tests {
    use super::scan_directories;
    use std::fs;

    #[test]
    fn skips_unity_library_but_keeps_user_folders_named_library() {
        let root = std::env::temp_dir().join(format!("uph-scan-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("Project/ProjectSettings")).unwrap();
        fs::create_dir_all(root.join("Project/Library")).unwrap();
        fs::create_dir_all(root.join("Library")).unwrap();
        fs::write(root.join("Project/Library/cached.fbx"), "x").unwrap();
        fs::write(root.join("Library/tree.fbx"), "x").unwrap();
        let mut last = super::ScanProgress::default();
        let result = scan_directories(vec![root.to_string_lossy().into(), root.join("missing").to_string_lossy().into()], |progress| last = progress).unwrap();
        assert_eq!(last.found, 1);
        let names: Vec<_> = result.files.iter().map(|file| file.file_name.as_str()).collect();
        assert_eq!(names, vec!["tree.fbx"]);
        assert_eq!(result.scanned_directories, vec![root.to_string_lossy().to_string()]);
        let _ = fs::remove_dir_all(&root);
    }
}
