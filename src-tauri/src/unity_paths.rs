use std::path::PathBuf;

fn app_data_root() -> PathBuf {
    PathBuf::from(std::env::var("APPDATA").unwrap_or_default()).join("com.unitypackhub.app")
}

pub fn preview_root() -> PathBuf { app_data_root().join("previews") }
pub fn editor_action_root() -> PathBuf { app_data_root().join("editor-actions") }
