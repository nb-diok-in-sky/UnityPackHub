//! Locating installed Unity Editors.

use std::fs;
use std::path::{Path, PathBuf};

pub fn discover() -> Vec<String> {
    let mut roots = vec![PathBuf::from(r"C:\Program Files\Unity\Hub\Editor")];
    roots.extend(hub_install_location());
    let mut editors: Vec<String> = roots
        .iter()
        .flat_map(|root| fs::read_dir(root).into_iter().flatten().flatten())
        .map(|version| version.path().join("Editor").join("Unity.exe"))
        .chain(std::iter::once(PathBuf::from(r"C:\Program Files\Unity\Editor\Unity.exe")))
        .filter(|editor| editor.exists())
        .map(|editor| editor.to_string_lossy().to_string())
        .collect();
    editors.sort();
    editors.dedup();
    editors.reverse();
    editors
}

/// Unity Hub stores a custom "Installs location" as a JSON string in this file.
fn hub_install_location() -> Option<PathBuf> {
    let setting = PathBuf::from(std::env::var("APPDATA").ok()?).join("UnityHub").join("secondaryInstallPath.json");
    let path: String = serde_json::from_str(&fs::read_to_string(setting).ok()?).ok()?;
    (!path.is_empty()).then(|| Path::new(&path).to_path_buf())
}
