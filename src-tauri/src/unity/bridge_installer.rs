//! Deploys the C# bridge scripts: into the user's open project (package previews, editor
//! actions) and into the headless preview project (model covers).

use crate::files::write_if_changed;
use std::fs;
use std::path::Path;

type Script = (&'static str, &'static str);

const PROTOCOL: Script = ("UnityPackHubProtocol.cs", include_str!("../bridge/UnityPackHubProtocol.cs"));
const RENDERER: Script = ("UnityPackHubRenderer.cs", include_str!("../bridge/UnityPackHubRenderer.cs"));

const PROJECT_SCRIPTS: &[Script] = &[
    PROTOCOL,
    RENDERER,
    ("UnityPackHubPreviews.cs", include_str!("../bridge/UnityPackHubPreviews.cs")),
    ("UnityPackHubEditorActions.cs", include_str!("../bridge/UnityPackHubEditorActions.cs")),
];

const PREVIEW_PROJECT_SCRIPTS: &[Script] = &[
    PROTOCOL,
    RENDERER,
    ("ModelPreviewBatch.cs", include_str!("../bridge/ModelPreviewBatch.cs")),
    ("ModelDependencyCopier.cs", include_str!("../bridge/ModelDependencyCopier.cs")),
    ("PreviewMaterialSystem.cs", include_str!("../bridge/PreviewMaterialSystem.cs")),
];

/// Returns true when scripts changed, i.e. Unity has to recompile before the bridge works.
pub fn install_project_bridge(project_path: &str) -> Result<bool, String> {
    let project = Path::new(project_path);
    if !project.join("Assets").is_dir() { return Err("Invalid Unity project path: Assets folder not found".into()); }
    let changed = install(&project.join("Assets/Editor/UnityPackHub"), PROJECT_SCRIPTS)?;
    let legacy = project.join("Assets/Editor/UnityAssetShelf");
    if legacy.exists() { let _ = fs::remove_dir_all(legacy); }
    Ok(changed)
}

pub fn install_preview_project_scripts(editor_dir: &Path) -> Result<bool, String> {
    install(editor_dir, PREVIEW_PROJECT_SCRIPTS)
}

/// Writes the given scripts and deletes every other script in the folder: a leftover file
/// from an older version would reference removed types and break the whole compilation.
fn install(directory: &Path, scripts: &[Script]) -> Result<bool, String> {
    fs::create_dir_all(directory).map_err(|error| format!("Failed to create {}: {error}", directory.display()))?;
    let mut changed = false;
    for (name, content) in scripts {
        let path = directory.join(name);
        if fs::read_to_string(&path).ok().as_deref() != Some(*content) {
            write_if_changed(&path, content)?;
            changed = true;
        }
    }
    for entry in fs::read_dir(directory).map_err(|error| error.to_string())?.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let script = name.strip_suffix(".meta").unwrap_or(&name);
        if script.ends_with(".cs") && !scripts.iter().any(|(expected, _)| *expected == script) {
            fs::remove_file(entry.path()).map_err(|error| format!("Failed to remove outdated {name}: {error}"))?;
            changed = true;
        }
    }
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::install;
    use std::fs;

    #[test]
    fn replaces_outdated_scripts_and_reports_changes() {
        let directory = std::env::temp_dir().join(format!("uph-bridge-{}", std::process::id()));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).unwrap();
        fs::write(directory.join("Old.cs"), "class Old {}").unwrap();
        fs::write(directory.join("Old.cs.meta"), "guid: x").unwrap();
        let scripts = [("New.cs", "class New {}")];
        assert!(install(&directory, &scripts).unwrap());
        assert!(!directory.join("Old.cs").exists() && !directory.join("Old.cs.meta").exists());
        assert!(!install(&directory, &scripts).unwrap());
        let _ = fs::remove_dir_all(&directory);
    }
}
