//! Request/response channel to the bridge running inside the open Unity Editor.

use crate::paths;
use crate::protocol::{self, EditorActionRequest, EditorActionResult, Heartbeat};
use serde::Serialize;
use std::{
    fs,
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum BridgeStatus {
    /// The bridge is running and speaks the current protocol.
    Ready,
    /// An older bridge is running; Unity has not recompiled the updated scripts yet.
    Outdated,
    /// No recent heartbeat: Unity is closed, busy compiling, or the bridge is not installed.
    Offline,
}

/// State of the bridge in the editor that has `project_path` open. Several editors can run at
/// once, each writing its own heartbeat; stale files from closed editors are ignored.
pub fn status(project_path: &str) -> BridgeStatus {
    let root = paths::editor_actions_root();
    let mut outdated = false;
    for entry in fs::read_dir(&root).into_iter().flatten().flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let is_heartbeat = name.starts_with(protocol::HEARTBEAT_PREFIX) || name == "heartbeat.json";
        if !is_heartbeat || !name.ends_with(".json") || !is_fresh(&entry.path()) {
            continue;
        }
        // Bridges before protocol 2 wrote a bare timestamp without version or project.
        let Some(heartbeat) =
            fs::read_to_string(entry.path()).ok().and_then(|text| serde_json::from_str::<Heartbeat>(&text).ok())
        else {
            outdated = true;
            continue;
        };
        if heartbeat.project_path.is_empty() {
            outdated = true;
            continue;
        }
        if !protocol::same_project(&heartbeat.project_path, project_path) {
            continue;
        }
        if heartbeat.version == protocol::VERSION {
            return BridgeStatus::Ready;
        }
        outdated = true;
    }
    if outdated {
        BridgeStatus::Outdated
    } else {
        BridgeStatus::Offline
    }
}

fn is_fresh(path: &Path) -> bool {
    fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|time| time.elapsed().ok())
        .is_some_and(|elapsed| elapsed < HEARTBEAT_TIMEOUT)
}

pub fn request(project_path: &str, action: &str, source_path: &str) -> Result<String, String> {
    let project = Path::new(project_path);
    if !project.join("Assets").is_dir() {
        return Err("Invalid Unity project path".into());
    }
    let millis = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|error| error.to_string())?.as_millis();
    let id = format!("{}-{millis}", std::process::id());
    let request = EditorActionRequest {
        id: &id,
        project_path,
        action,
        source_path,
        asset_path: project_asset_path(project, Path::new(source_path)),
    };
    let pending = paths::editor_actions_root().join("pending");
    fs::create_dir_all(&pending).map_err(|error| error.to_string())?;
    let text = serde_json::to_string_pretty(&request).map_err(|error| error.to_string())?;
    fs::write(pending.join(format!("{id}.json")), text).map_err(|error| error.to_string())?;
    Ok(id)
}

pub fn collect(id: &str) -> Result<Option<EditorActionResult>, String> {
    let path = paths::editor_actions_root().join("results").join(format!("{id}.json"));
    let Ok(text) = fs::read_to_string(&path) else { return Ok(None) };
    let result = serde_json::from_str(&text).map_err(|error| format!("Invalid response from Unity: {error}"))?;
    let _ = fs::remove_file(path);
    Ok(Some(result))
}

/// `Assets/...` path of a file that already lives inside the project, if it does.
fn project_asset_path(project: &Path, source: &Path) -> String {
    source
        .strip_prefix(project.join("Assets"))
        .ok()
        .map(|relative| format!("Assets/{}", relative.to_string_lossy().replace('\\', "/")))
        .unwrap_or_default()
}
