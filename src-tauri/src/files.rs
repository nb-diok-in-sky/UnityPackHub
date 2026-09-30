//! Small filesystem helpers shared by the command modules.

use serde::Serialize;
use std::fs;
use std::path::Path;

/// Writes only when the content differs, so file watchers (Unity's script compiler,
/// the bridge's request polling) do not see spurious changes.
pub fn write_if_changed(path: &Path, content: &str) -> Result<(), String> {
    if fs::read_to_string(path).ok().as_deref() == Some(content) {
        return Ok(());
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("Failed to create {}: {error}", parent.display()))?;
    }
    fs::write(path, content).map_err(|error| format!("Failed to write {}: {error}", path.display()))
}

pub fn write_json_if_changed(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    write_if_changed(path, &text)
}

pub fn extension_lowercase(path: &Path) -> String {
    path.extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase()
}
