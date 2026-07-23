use serde::Serialize;
use std::fs;
use std::path::Path;
use crate::{editor_actions, unity_paths::preview_root};

const BRIDGE_SCRIPT: &str = include_str!("bridge/UnityPackHubBridge.cs");
const EDITOR_ACTIONS_SCRIPT: &str = include_str!("bridge/UnityPackHubEditorActions.cs");
const PREVIEW_PROTOCOL_SCRIPT: &str = include_str!("bridge/UnityPackHubPreviewProtocol.cs");
const PREVIEW_MATCHER_SCRIPT: &str = include_str!("bridge/UnityPackHubPreviewMatcher.cs");
const PREVIEW_MANIFEST_SCRIPT: &str = include_str!("bridge/UnityPackHubPreviewManifest.cs");
const ASSET_RENDERER_SCRIPT: &str = include_str!("bridge/UnityPackHubAssetRenderer.cs");

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

#[tauri::command]
pub fn request_unity_editor_action(
    project_path: String,
    action: String,
    source_path: String,
) -> Result<String, String> {
    ensure_bridge_script(project_path.clone())?;
    editor_actions::request(&project_path, &action, &source_path)
}

#[tauri::command]
pub fn collect_unity_editor_action_result(id: String) -> Result<Option<String>, String> {
    editor_actions::collect(&id)
}

#[tauri::command]
pub fn is_unity_editor_bridge_ready() -> Result<bool, String> {
    Ok(editor_actions::is_ready())
}

#[derive(Debug, Serialize)]
pub struct PreviewDirInfo {
    pub path: String,
    pub existing_files: Vec<String>,
}

fn preview_output_file(pathname: &str, filename: &str) -> String {
    let mut hash = 2166136261_u32;
    for byte in pathname.replace('\\', "/").to_lowercase().bytes() {
        hash = (hash ^ byte as u32).wrapping_mul(16777619);
    }
    format!("{}--{:08x}.png", filename, hash)
}

#[tauri::command]
pub fn ensure_preview_dir(
    package_name: String,
    prefab_names: Vec<serde_json::Value>,
) -> Result<PreviewDirInfo, String> {
    let dir = preview_root().join(&package_name);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create preview dir: {}", e))?;

    let prefabs_file = dir.join("prefabs.json");
    if !prefab_names.is_empty() {
        let requests: Vec<_> = prefab_names.into_iter().filter_map(|value| {
            let pathname = value.get("pathname")?.as_str()?.to_string();
            let filename = value.get("filename")?.as_str()?.to_string();
            Some(serde_json::json!({
                "pathname": pathname,
                "filename": filename,
                "outputFile": preview_output_file(&pathname, &filename),
            }))
        }).collect();
        let json = serde_json::to_string_pretty(&requests).unwrap_or_default();
        let needs_write = if prefabs_file.exists() {
            fs::read_to_string(&prefabs_file).unwrap_or_default() != json
        } else {
            true
        };
        if needs_write {
            fs::write(&prefabs_file, json)
                .map_err(|e| format!("Failed to write preview requests: {}", e))?;
        }

        let has_missing = requests
            .iter()
            .filter_map(|request| request.get("outputFile").and_then(|value| value.as_str()))
            .any(|name| !dir.join(name).exists());
        if has_missing {
            fs::write(dir.join("_trigger"), "")
                .map_err(|e| format!("Failed to trigger Unity preview generation: {}", e))?;
        }
    }

    let mut existing = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map_or(false, |e| e == "png") {
                if let Some(name) = entry.file_name().to_str() {
                    existing.push(name.to_string());
                }
            }
        }
    }

    Ok(PreviewDirInfo {
        path: dir.to_string_lossy().to_string(),
        existing_files: existing,
    })
}

#[tauri::command]
pub fn clear_all_previews() -> Result<u32, String> {
    let root = preview_root();
    if !root.exists() {
        return Ok(0);
    }
    let mut count: u32 = 0;
    for entry in fs::read_dir(&root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            if let Ok(files) = fs::read_dir(&path) {
                for f in files.flatten() {
                    if f.path()
                        .extension()
                        .map_or(false, |e| e == "png" || e == "json")
                    {
                        let _ = fs::remove_file(f.path());
                        count += 1;
                    }
                }
            }
            let _ = fs::remove_dir(&path);
        }
    }
    Ok(count)
}

#[tauri::command]
pub fn detect_unity_project() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let output = std::process::Command::new("powershell")
            .args([
                "-NoProfile",
                "-Command",
                "Get-CimInstance Win32_Process -Filter \"Name='Unity.exe'\" | Select-Object -ExpandProperty CommandLine",
            ])
            .creation_flags(0x08000000)
            .output()
            .map_err(|e| format!("{}", e))?;

        let text = String::from_utf8_lossy(&output.stdout);
        let text_lower = text.to_lowercase();
        for (line, line_lower) in text.lines().zip(text_lower.lines()) {
            if let Some(idx) = line_lower.find("-projectpath") {
                let rest = line[idx + 12..].trim();
                let path = if rest.starts_with('"') {
                    rest[1..].split('"').next().unwrap_or("")
                } else {
                    rest.split(' ').next().unwrap_or("")
                };
                if !path.is_empty() && Path::new(path).join("Assets").exists() {
                    return Ok(Some(path.to_string()));
                }
            }
        }
    }
    Ok(None)
}

#[tauri::command]
pub fn ensure_bridge_script(project_path: String) -> Result<bool, String> {
    let editor_dir = Path::new(&project_path)
        .join("Assets")
        .join("Editor")
        .join("UnityPackHub");

    if !Path::new(&project_path).join("Assets").exists() {
        return Err("Invalid Unity project path: Assets folder not found".into());
    }

    let script_path = editor_dir.join("UnityPackHubBridge.cs");
    let editor_actions_path = editor_dir.join("UnityPackHubEditorActions.cs");
    let support_scripts = [
        (editor_dir.join("UnityPackHubPreviewProtocol.cs"), PREVIEW_PROTOCOL_SCRIPT),
        (editor_dir.join("UnityPackHubPreviewMatcher.cs"), PREVIEW_MATCHER_SCRIPT),
        (editor_dir.join("UnityPackHubPreviewManifest.cs"), PREVIEW_MANIFEST_SCRIPT),
        (editor_dir.join("UnityPackHubAssetRenderer.cs"), ASSET_RENDERER_SCRIPT),
    ];

    if script_path.exists() && editor_actions_path.exists() && support_scripts.iter().all(|(path, _)| path.exists()) {
        let existing = fs::read_to_string(&script_path).unwrap_or_default();
        let existing_actions = fs::read_to_string(&editor_actions_path).unwrap_or_default();
        let support_current = support_scripts.iter().all(|(path, content)| fs::read_to_string(path).unwrap_or_default() == *content);
        if existing == BRIDGE_SCRIPT && existing_actions == EDITOR_ACTIONS_SCRIPT && support_current {
            return Ok(false);
        }
    }

    fs::create_dir_all(&editor_dir).map_err(|e| format!("Failed to create Editor dir: {}", e))?;
    fs::write(&script_path, BRIDGE_SCRIPT)
        .map_err(|e| format!("Failed to write bridge script: {}", e))?;
    fs::write(&editor_actions_path, EDITOR_ACTIONS_SCRIPT)
        .map_err(|e| format!("Failed to write editor actions script: {}", e))?;
    for (path, content) in support_scripts {
        fs::write(path, content).map_err(|e| format!("Failed to write preview support script: {}", e))?;
    }

    // Clean up old bridge script if exists
    let old_dir = Path::new(&project_path)
        .join("Assets")
        .join("Editor")
        .join("UnityAssetShelf");
    if old_dir.exists() {
        let _ = fs::remove_dir_all(&old_dir);
    }

    Ok(true)
}

#[tauri::command]
pub fn get_package_previews(package_name: String) -> Result<Option<PackagePreviews>, String> {
    let preview_dir = preview_root().join(&package_name);
    let manifest_path = preview_dir.join("manifest.json");

    if !manifest_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;

    let parsed: Vec<serde_json::Value> =
        serde_json::from_str(&content).map_err(|e| format!("Failed to parse manifest: {}", e))?;

    let entries: Vec<PreviewEntry> = parsed
        .into_iter()
        .filter_map(|v| {
            Some(PreviewEntry {
                path: v.get("path")?.as_str()?.to_string(),
                name: v.get("name")?.as_str()?.to_string(),
                asset_type: v.get("type")?.as_str()?.to_string(),
                preview: v.get("preview")?.as_str()?.to_string(),
                render_type: v
                    .get("renderType")?
                    .as_str()
                    .unwrap_or("thumbnail")
                    .to_string(),
            })
        })
        .collect();

    Ok(Some(PackagePreviews {
        package_name,
        entries,
        preview_dir: preview_dir.to_string_lossy().to_string(),
    }))
}

#[tauri::command]
pub fn read_preview_image(preview_dir: String, filename: String) -> Result<String, String> {
    let path = Path::new(&preview_dir).join(&filename);
    let data = fs::read(&path).map_err(|e| format!("Failed to read preview: {}", e))?;
    let b64 = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &data);
    Ok(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
pub fn read_all_previews(
    preview_dir: String,
) -> Result<std::collections::HashMap<String, String>, String> {
    let dir = Path::new(&preview_dir);
    if !dir.exists() {
        return Ok(std::collections::HashMap::new());
    }
    let mut result = std::collections::HashMap::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |e| e == "png") {
                if let Some(name) = entry.file_name().to_str() {
                    if let Ok(data) = fs::read(&path) {
                        let b64 = base64::Engine::encode(
                            &base64::engine::general_purpose::STANDARD,
                            &data,
                        );
                        result.insert(name.to_string(), format!("data:image/png;base64,{}", b64));
                    }
                }
            }
        }
    }
    Ok(result)
}

#[tauri::command]
pub fn import_with_bridge(package_path: String, project_path: String) -> Result<bool, String> {
    let newly_injected = ensure_bridge_script(project_path)?;

    if newly_injected {
        std::thread::sleep(std::time::Duration::from_secs(5));
    }

    crate::package_parser::open_with_default_app(package_path)?;

    Ok(newly_injected)
}
