use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const BRIDGE_SCRIPT: &str = include_str!("bridge/UnityPackHubBridge.cs");

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

fn get_preview_root() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    PathBuf::from(appdata)
        .join("com.unitypackhub.app")
        .join("previews")
}

#[derive(Debug, Serialize)]
pub struct PreviewDirInfo {
    pub path: String,
    pub existing_files: Vec<String>,
}

#[tauri::command]
pub fn ensure_preview_dir(
    package_name: String,
    prefab_names: Vec<String>,
) -> Result<PreviewDirInfo, String> {
    let dir = get_preview_root().join(&package_name);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create preview dir: {}", e))?;

    let prefabs_file = dir.join("prefabs.json");
    if !prefab_names.is_empty() {
        let json = serde_json::to_string_pretty(&prefab_names).unwrap_or_default();
        let needs_write = if prefabs_file.exists() {
            fs::read_to_string(&prefabs_file).unwrap_or_default() != json
        } else {
            true
        };
        if needs_write {
            let _ = fs::write(&prefabs_file, json);
        }

        let has_missing = prefab_names
            .iter()
            .any(|name| !dir.join(format!("{}.png", name)).exists());
        if has_missing {
            let _ = fs::write(dir.join("_trigger"), "");
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
    let root = get_preview_root();
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

    if script_path.exists() {
        let existing = fs::read_to_string(&script_path).unwrap_or_default();
        if existing == BRIDGE_SCRIPT {
            return Ok(false);
        }
    }

    fs::create_dir_all(&editor_dir).map_err(|e| format!("Failed to create Editor dir: {}", e))?;
    fs::write(&script_path, BRIDGE_SCRIPT)
        .map_err(|e| format!("Failed to write bridge script: {}", e))?;

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
    let preview_dir = get_preview_root().join(&package_name);
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

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &package_path])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| format!("Failed to open: {}", e))?;
    }

    Ok(newly_injected)
}
