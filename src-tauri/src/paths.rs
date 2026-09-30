//! Every on-disk location UnityPackHub uses outside of the WebView storage.
//! The C# bridge resolves the same folders in `bridge/UnityPackHubProtocol.cs`.

use std::path::PathBuf;

pub const APP_IDENTIFIER: &str = "com.unitypackhub.app";

pub fn app_data_root() -> PathBuf {
    PathBuf::from(std::env::var("APPDATA").unwrap_or_default()).join(APP_IDENTIFIER)
}

/// One sub-folder per package, holding Unity-rendered prefab previews.
pub fn previews_root() -> PathBuf {
    app_data_root().join("previews")
}

pub fn package_previews_dir(package_key: &str) -> PathBuf {
    previews_root().join(package_key)
}

pub fn pending_imports_dir() -> PathBuf {
    previews_root().join(crate::protocol::PENDING_IMPORTS_DIR)
}

pub fn editor_actions_root() -> PathBuf {
    app_data_root().join("editor-actions")
}

/// Preview images embedded in a package, extracted once when the package is listed.
pub fn package_embedded_previews_dir(package_path: &str) -> PathBuf {
    let stem = std::path::Path::new(package_path)
        .file_stem()
        .map(|stem| stem.to_string_lossy().to_string())
        .unwrap_or_default();
    let hash = package_path
        .replace('\\', "/")
        .to_lowercase()
        .bytes()
        .fold(2166136261_u32, |hash, byte| (hash ^ byte as u32).wrapping_mul(16777619));
    app_data_root().join("cache").join("package-previews").join(format!("{stem}--{hash:08x}"))
}

/// Workspace of the headless Unity project that renders model covers.
pub fn model_preview_root() -> PathBuf {
    app_data_root().join("Model picture")
}
