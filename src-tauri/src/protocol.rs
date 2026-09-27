//! File-based protocol between UnityPackHub and the Unity Editor.
//!
//! The app and Unity never talk directly: they exchange JSON files under `%APPDATA%`.
//! Every file format lives here, and `bridge/UnityPackHubProtocol.cs` mirrors it field by
//! field (Unity's `JsonUtility` maps fields by exact name). Bump [`VERSION`] on both sides
//! whenever a format changes; the Unity heartbeat reports its version so an outdated bridge
//! is detected instead of silently misbehaving.

use serde::{Deserialize, Serialize};

pub const VERSION: u32 = 2;

pub const TRIGGER_FILE: &str = "_trigger";
pub const REQUESTS_FILE: &str = "prefabs.json";
pub const MANIFEST_FILE: &str = "manifest.json";
pub const PENDING_IMPORTS_DIR: &str = "_pending_imports";
/// Each running editor writes its own `heartbeat-<process id>.json`.
pub const HEARTBEAT_PREFIX: &str = "heartbeat-";

// ---------------------------------------------------------------- package previews

/// A prefab of a package that Unity should render once the package is in the open project.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PreviewRequest {
    pub pathname: String,
    pub filename: String,
    #[serde(rename = "outputFile")]
    pub output_file: String,
}

impl PreviewRequest {
    pub fn new(pathname: String, filename: String) -> Self {
        let output_file = preview_output_file(&pathname, &filename);
        Self { pathname, filename, output_file }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PreviewRequestFile {
    pub version: u32,
    pub items: Vec<PreviewRequest>,
}

/// One rendered preview, written by Unity into `manifest.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestEntry {
    pub path: String,
    pub name: String,
    #[serde(rename = "type")]
    pub asset_type: String,
    pub preview: String,
    #[serde(rename = "renderType", default = "default_render_type")]
    pub render_type: String,
}

fn default_render_type() -> String { "thumbnail".into() }

#[derive(Debug, Serialize, Deserialize)]
pub struct ManifestFile {
    #[serde(default)]
    pub version: u32,
    pub entries: Vec<ManifestEntry>,
}

/// Accepts the current `{ version, entries }` form and the legacy top-level array.
pub fn parse_manifest(text: &str) -> Result<Vec<ManifestEntry>, serde_json::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum AnyManifest { Current(ManifestFile), Legacy(Vec<ManifestEntry>) }
    Ok(match serde_json::from_str(text)? {
        AnyManifest::Current(file) => file.entries,
        AnyManifest::Legacy(entries) => entries,
    })
}

/// PNG name for a package prefab preview. The only definition of the naming scheme: the
/// frontend receives these names from the backend and Unity reads them from `prefabs.json`.
pub fn preview_output_file(pathname: &str, filename: &str) -> String {
    let hash = pathname.replace('\\', "/").to_ascii_lowercase().bytes()
        .fold(2166136261_u32, |hash, byte| (hash ^ byte as u32).wrapping_mul(16777619));
    format!("{filename}--{hash:08x}.png")
}

// ---------------------------------------------------------------- editor actions

#[derive(Debug, Serialize)]
pub struct EditorActionRequest<'a> {
    pub id: &'a str,
    /// Only the bridge of this project answers; other open editors leave the request alone.
    #[serde(rename = "projectPath")]
    pub project_path: &'a str,
    pub action: &'a str,
    #[serde(rename = "sourcePath")]
    pub source_path: &'a str,
    #[serde(rename = "assetPath")]
    pub asset_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EditorActionResult {
    pub success: bool,
    #[serde(default)]
    pub message: String,
    #[serde(rename = "assetPath", default)]
    pub asset_path: String,
    #[serde(default)]
    pub assets: Vec<ProjectAsset>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectAsset {
    pub guid: String,
    pub path: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "assetType")]
    pub asset_type: String,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(rename = "sceneUsageCount", default)]
    pub scene_usage_count: u32,
    #[serde(rename = "referencedBy", default)]
    pub referenced_by: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Heartbeat {
    #[serde(default)]
    pub version: u32,
    #[serde(rename = "projectPath", default)]
    pub project_path: String,
}

/// Compares project folders the way Windows does: case-insensitive, either slash.
pub fn same_project(left: &str, right: &str) -> bool {
    let normalize = |value: &str| value.replace('\\', "/").trim_end_matches('/').to_lowercase();
    !left.is_empty() && normalize(left) == normalize(right)
}

// ---------------------------------------------------------------- model preview batch

#[derive(Debug, Serialize)]
pub struct ModelPreviewJob {
    #[serde(rename = "assetId")]
    pub asset_id: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    #[serde(rename = "outputPath")]
    pub output_path: String,
    #[serde(rename = "resultPath")]
    pub result_path: String,
}

#[derive(Debug, Serialize)]
pub struct ModelPreviewJobFile {
    pub version: u32,
    pub jobs: Vec<ModelPreviewJob>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelPreviewResult {
    #[serde(rename = "assetId")]
    pub asset_id: String,
    #[serde(rename = "imagePath")]
    pub image_path: String,
    pub success: bool,
    #[serde(default)]
    pub error: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    const CSHARP_PROTOCOL: &str = include_str!("bridge/UnityPackHubProtocol.cs");

    #[test]
    fn csharp_bridge_uses_the_same_protocol_version_and_file_names() {
        assert!(CSHARP_PROTOCOL.contains(&format!("public const int Version = {VERSION};")));
        for name in [TRIGGER_FILE, REQUESTS_FILE, MANIFEST_FILE, PENDING_IMPORTS_DIR, HEARTBEAT_PREFIX] {
            assert!(CSHARP_PROTOCOL.contains(&format!("\"{name}\"")), "C# protocol is missing {name}");
        }
    }

    #[test]
    fn preview_names_hash_utf8_bytes_of_the_normalized_pathname() {
        assert_eq!(preview_output_file(r"Assets\Trees\Oak.prefab", "Oak.prefab"), preview_output_file("assets/trees/oak.prefab", "Oak.prefab"));
        assert_eq!(preview_output_file("Assets/树/橡树.prefab", "橡树.prefab"), "橡树.prefab--130de7c6.png");
    }

    #[test]
    fn matches_project_paths_like_windows() {
        assert!(same_project(r"D:\Games\Haven", "d:/games/haven/"));
        assert!(!same_project(r"D:\Games\Haven", r"D:\Games\Haven2"));
        assert!(!same_project("", r"D:\Games"));
    }

    #[test]
    fn reads_current_and_legacy_manifests() {
        let entry = r#"{"path":"Assets/A.prefab","name":"A","type":"GameObject","preview":"A.png"}"#;
        assert_eq!(parse_manifest(&format!("[{entry}]")).unwrap()[0].render_type, "thumbnail");
        assert_eq!(parse_manifest(&format!(r#"{{"version":2,"entries":[{entry}]}}"#)).unwrap().len(), 1);
    }

    #[test]
    fn reads_editor_results_as_written_by_json_utility() {
        let text = r#"{"success":true,"message":"Project indexed","assetPath":"","assets":[{"guid":"g","path":"Assets/A.fbx","fileName":"A.fbx","assetType":"GameObject","dependencies":[],"sceneUsageCount":2,"referencedBy":["Assets/B.prefab"]}]}"#;
        let result: EditorActionResult = serde_json::from_str(text).unwrap();
        assert_eq!(result.assets[0].scene_usage_count, 2);
        let failure: EditorActionResult = serde_json::from_str(r#"{"success":false,"message":"boom"}"#).unwrap();
        assert!(failure.assets.is_empty());
    }
}
