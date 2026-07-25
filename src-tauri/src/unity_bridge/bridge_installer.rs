use std::fs;
use std::path::{Path, PathBuf};

const SCRIPTS: &[(&str, &str)] = &[
    ("UnityPackHubBridge.cs", include_str!("../bridge/UnityPackHubBridge.cs")),
    ("UnityPackHubEditorActions.cs", include_str!("../bridge/UnityPackHubEditorActions.cs")),
    ("UnityPackHubPreviewProtocol.cs", include_str!("../bridge/UnityPackHubPreviewProtocol.cs")),
    ("UnityPackHubPreviewMatcher.cs", include_str!("../bridge/UnityPackHubPreviewMatcher.cs")),
    ("UnityPackHubPreviewManifest.cs", include_str!("../bridge/UnityPackHubPreviewManifest.cs")),
    ("UnityPackHubAssetRenderer.cs", include_str!("../bridge/UnityPackHubAssetRenderer.cs")),
    ("UnityPackHubPreviewRequests.cs", include_str!("../bridge/UnityPackHubPreviewRequests.cs")),
];

pub fn ensure_bridge_script(project_path: &str) -> Result<bool, String> {
    let project = Path::new(project_path);
    if !project.join("Assets").exists() { return Err("Invalid Unity project path: Assets folder not found".into()); }
    let editor_dir = project.join("Assets/Editor/UnityPackHub");
    if scripts_are_current(&editor_dir) { return Ok(false); }

    fs::create_dir_all(&editor_dir).map_err(|error| format!("Failed to create Editor dir: {error}"))?;
    for (name, content) in SCRIPTS {
        fs::write(editor_dir.join(name), content).map_err(|error| format!("Failed to write {name}: {error}"))?;
    }
    let old_dir = project.join("Assets/Editor/UnityAssetShelf");
    if old_dir.exists() { let _ = fs::remove_dir_all(old_dir); }
    Ok(true)
}

fn scripts_are_current(directory: &Path) -> bool {
    SCRIPTS.iter().all(|(name, content)| read_script(directory.join(name)).as_deref() == Some(*content))
}

fn read_script(path: PathBuf) -> Option<String> {
    fs::read_to_string(path).ok()
}
