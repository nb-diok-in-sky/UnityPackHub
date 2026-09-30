//! Package prefab previews rendered by the bridge inside the user's Unity project.
//! Layout per package: `previews/<package key>/{prefabs.json, _trigger, manifest.json, *.png}`.

use crate::files::write_json_if_changed;
use crate::paths;
use crate::protocol::{self, ManifestEntry, PreviewRequest, PreviewRequestFile};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
pub struct PrefabRef {
    pub pathname: String,
    pub filename: String,
}

#[derive(Debug, Serialize)]
pub struct PreviewFolder {
    pub path: String,
    /// Package pathname -> preview PNG name, so the frontend never re-derives names.
    #[serde(rename = "outputFiles")]
    pub output_files: HashMap<String, String>,
    /// Names of the preview PNGs that already exist in `path`.
    pub files: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct RenderedPreviews {
    /// Folder holding the PNGs named in `entries[].preview`.
    pub path: String,
    pub entries: Vec<ManifestEntry>,
}

/// Records which prefabs the package contains and asks Unity to render the missing ones.
pub fn request_previews(package_key: &str, prefabs: Vec<PrefabRef>) -> Result<PreviewFolder, String> {
    let requests: Vec<_> =
        prefabs.into_iter().map(|prefab| PreviewRequest::new(prefab.pathname, prefab.filename)).collect();
    let directory = write_requests(package_key, &requests)?;
    if requests.iter().any(|request| !directory.join(&request.output_file).exists()) {
        fs::write(directory.join(protocol::TRIGGER_FILE), "")
            .map_err(|error| format!("Failed to trigger Unity preview generation: {error}"))?;
    }
    Ok(PreviewFolder {
        path: directory.to_string_lossy().to_string(),
        output_files: requests.into_iter().map(|request| (request.pathname, request.output_file)).collect(),
        files: png_names(&directory).collect(),
    })
}

pub fn preview_files_of(package_key: &str) -> Vec<String> {
    png_names(&paths::package_previews_dir(package_key)).collect()
}

/// Previously rendered previews listed in the package's manifest, with their images.
pub fn rendered_previews(package_key: &str) -> Result<Option<RenderedPreviews>, String> {
    let directory = paths::package_previews_dir(package_key);
    let Ok(text) = fs::read_to_string(directory.join(protocol::MANIFEST_FILE)) else { return Ok(None) };
    let entries = protocol::parse_manifest(&text)
        .map_err(|error| format!("Failed to parse preview manifest: {error}"))?
        .into_iter()
        .filter(|entry| directory.join(&entry.preview).is_file())
        .collect();
    Ok(Some(RenderedPreviews { path: directory.to_string_lossy().to_string(), entries }))
}

/// Prepares an import started from the app: once Unity finishes importing it, the bridge
/// renders into this package's folder with the same names the showcase reads.
pub fn prepare_import(package_path: &str, package_key: &str) -> Result<(), String> {
    let requests: Vec<_> = crate::package::prefab_entries(package_path)?
        .into_iter()
        .map(|(pathname, filename)| PreviewRequest::new(pathname, filename))
        .collect();
    write_requests(package_key, &requests)?;
    // Unity reports only the package file name, while preview folders are keyed by full path.
    let stem = Path::new(package_path).file_stem().and_then(|stem| stem.to_str()).unwrap_or_default();
    let pending = paths::pending_imports_dir();
    fs::create_dir_all(&pending).map_err(|error| format!("Failed to register import: {error}"))?;
    fs::write(pending.join(format!("{stem}.txt")), package_key)
        .map_err(|error| format!("Failed to register import: {error}"))
}

pub fn clear_all() -> Result<u32, String> {
    let root = paths::previews_root();
    if !root.exists() {
        return Ok(0);
    }
    let mut count = 0;
    for directory in
        fs::read_dir(root).map_err(|error| error.to_string())?.flatten().filter(|entry| entry.path().is_dir())
    {
        if directory.file_name() == protocol::PENDING_IMPORTS_DIR {
            continue;
        }
        count += png_names(&directory.path()).count() as u32;
        let _ = fs::remove_dir_all(directory.path());
    }
    Ok(count)
}

fn write_requests(package_key: &str, requests: &[PreviewRequest]) -> Result<PathBuf, String> {
    let directory = paths::package_previews_dir(package_key);
    fs::create_dir_all(&directory).map_err(|error| format!("Failed to create preview dir: {error}"))?;
    if !requests.is_empty() {
        let file = PreviewRequestFile { version: protocol::VERSION, items: requests.to_vec() };
        write_json_if_changed(&directory.join(protocol::REQUESTS_FILE), &file)?;
    }
    Ok(directory)
}

fn png_names(directory: &Path) -> impl Iterator<Item = String> {
    fs::read_dir(directory)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|entry| crate::files::extension_lowercase(&entry.path()) == "png")
        .filter_map(|entry| entry.file_name().to_str().map(String::from))
}
