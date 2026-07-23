use serde::Serialize;
use std::{fs, path::Path, time::{SystemTime, UNIX_EPOCH}};
use crate::unity_paths::editor_action_root;

#[derive(Debug, Serialize)]
struct EditorActionRequest<'a> {
    id: &'a str,
    action: &'a str,
    #[serde(rename = "sourcePath")]
    source_path: &'a str,
    #[serde(rename = "assetPath")]
    asset_path: String,
}

fn project_asset_path(project_path: &Path, source_path: &Path) -> String {
    source_path.strip_prefix(project_path.join("Assets")).ok()
        .map(|relative| format!("Assets/{}", relative.to_string_lossy().replace('\\', "/")))
        .unwrap_or_default()
}

pub fn request(project_path: &str, action: &str, source_path: &str) -> Result<String, String> {
    let project = Path::new(project_path);
    if !project.join("Assets").is_dir() { return Err("Invalid Unity project path".into()); }
    let id = format!("{}-{}", std::process::id(), SystemTime::now()
        .duration_since(UNIX_EPOCH).map_err(|e| e.to_string())?.as_millis());
    let pending = editor_action_root().join("pending");
    fs::create_dir_all(&pending).map_err(|e| e.to_string())?;
    let value = EditorActionRequest {
        id: &id, action, source_path,
        asset_path: project_asset_path(project, Path::new(source_path)),
    };
    fs::write(pending.join(format!("{}.json", id)), serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    Ok(id)
}

pub fn collect(id: &str) -> Result<Option<String>, String> {
    let path = editor_action_root().join("results").join(format!("{}.json", id));
    if !path.exists() { return Ok(None); }
    let result = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    fs::remove_file(path).map_err(|e| e.to_string())?;
    Ok(Some(result))
}

pub fn is_ready() -> bool {
    fs::metadata(editor_action_root().join("heartbeat.json"))
        .and_then(|metadata| metadata.modified()).ok()
        .and_then(|time| time.elapsed().ok())
        .map(|elapsed| elapsed.as_secs() < 5).unwrap_or(false)
}
