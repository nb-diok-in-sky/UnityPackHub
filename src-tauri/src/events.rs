//! Pushes changes Unity makes on disk to the frontend, so the UI reacts instead of polling.
//! Event names are mirrored in `src/platform/backend.ts`.

use crate::paths;
use notify::{EventKind, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::{Component, Path};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

/// A package's Unity-rendered previews changed. Payload: `{ packageKey }`.
pub const PACKAGE_PREVIEWS_CHANGED: &str = "unity://package-previews-changed";
/// A model cover render result was written; collect it. No payload.
pub const MODEL_PREVIEW_RESULTS: &str = "unity://model-preview-results";
/// The headless Unity process rendering model covers exited. No payload.
pub const MODEL_PREVIEW_FINISHED: &str = "unity://model-preview-finished";
/// An editor action was answered. Payload: `{ id }`.
pub const EDITOR_ACTION_RESULT: &str = "unity://editor-action-result";

#[derive(Debug, PartialEq)]
pub enum Change {
    PackagePreviews(String),
    ModelPreviewResult,
    EditorActionResult(String),
}

#[derive(Clone, Serialize)]
struct PackageKey<'a> {
    #[serde(rename = "packageKey")]
    package_key: &'a str,
}

#[derive(Clone, Serialize)]
struct ActionId<'a> {
    id: &'a str,
}

static WATCHER: OnceLock<notify::RecommendedWatcher> = OnceLock::new();

/// Starts watching the app data folder for the lifetime of the app. Failing to watch is not
/// fatal: the frontend still collects results after each action, it just reacts later.
pub fn start(app: AppHandle) {
    let roots = [
        paths::previews_root(),
        paths::model_preview_root().join("results"),
        paths::editor_actions_root().join("results"),
    ];
    for root in &roots {
        let _ = std::fs::create_dir_all(root);
    }
    let handler = move |result: notify::Result<notify::Event>| {
        let Ok(event) = result else { return };
        if !matches!(event.kind, EventKind::Create(_) | EventKind::Modify(_)) {
            return;
        }
        for path in &event.paths {
            match classify(path) {
                Some(Change::PackagePreviews(key)) => {
                    let _ = app.emit(PACKAGE_PREVIEWS_CHANGED, PackageKey { package_key: &key });
                }
                Some(Change::ModelPreviewResult) => {
                    let _ = app.emit(MODEL_PREVIEW_RESULTS, ());
                }
                Some(Change::EditorActionResult(id)) => {
                    let _ = app.emit(EDITOR_ACTION_RESULT, ActionId { id: &id });
                }
                None => {}
            }
        }
    };
    match notify::recommended_watcher(handler) {
        Ok(mut watcher) => {
            for root in &roots {
                if let Err(error) = watcher.watch(root, RecursiveMode::Recursive) {
                    log::warn!("Cannot watch {}: {error}", root.display());
                }
            }
            let _ = WATCHER.set(watcher);
        }
        Err(error) => log::warn!("File watching unavailable: {error}"),
    }
}

pub fn model_preview_finished(app: &AppHandle) {
    let _ = app.emit(MODEL_PREVIEW_FINISHED, ());
}

/// Which kind of change a written file means. Temporary files (`*.tmp`) are ignored: the
/// bridge renames them into place, which arrives as a second event for the final name.
pub fn classify(path: &Path) -> Option<Change> {
    let extension = crate::files::extension_lowercase(path);
    if extension == "tmp" {
        return None;
    }
    let name = path.file_stem()?.to_string_lossy().to_string();
    if let Ok(relative) = path.strip_prefix(paths::previews_root()) {
        let key = match relative.components().next()? {
            Component::Normal(key) => key.to_string_lossy().to_string(),
            _ => return None,
        };
        let is_image = extension == "png" || path.file_name()? == crate::protocol::MANIFEST_FILE;
        return (is_image && !key.starts_with('_')).then_some(Change::PackagePreviews(key));
    }
    if extension != "json" {
        return None;
    }
    if path.parent()? == paths::model_preview_root().join("results") {
        return Some(Change::ModelPreviewResult);
    }
    if path.parent()? == paths::editor_actions_root().join("results") {
        return Some(Change::EditorActionResult(name));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::{classify, Change};
    use crate::paths;

    #[test]
    fn classifies_files_written_by_unity() {
        let previews = paths::previews_root();
        assert_eq!(
            classify(&previews.join("Trees--1").join("Oak.prefab--1.png")),
            Some(Change::PackagePreviews("Trees--1".into()))
        );
        assert_eq!(
            classify(&previews.join("Trees--1").join("manifest.json")),
            Some(Change::PackagePreviews("Trees--1".into()))
        );
        assert_eq!(classify(&previews.join("Trees--1").join("Oak.png.tmp")), None);
        assert_eq!(classify(&previews.join("_pending_imports").join("x.png")), None);
        assert_eq!(
            classify(&paths::model_preview_root().join("results").join("a.done.json")),
            Some(Change::ModelPreviewResult)
        );
        assert_eq!(
            classify(&paths::editor_actions_root().join("results").join("42-7.json")),
            Some(Change::EditorActionResult("42-7".into()))
        );
        assert_eq!(classify(&paths::editor_actions_root().join("heartbeat-1.json")), None);
    }
}
