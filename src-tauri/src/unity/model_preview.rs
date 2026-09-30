//! Model covers rendered by a headless Unity instance (`-batchmode`) on a private project.

use super::bridge_installer::install_preview_project_scripts;
use crate::paths;
use crate::protocol::{self, ModelPreviewJob, ModelPreviewJobFile, ModelPreviewResult};
use serde::Deserialize;
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
};

static ACTIVE_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

#[derive(Debug, Deserialize)]
pub struct ModelPreviewRequest {
    #[serde(rename = "assetId")]
    pub asset_id: String,
    #[serde(rename = "sourcePath")]
    pub source_path: String,
}

struct Workspace {
    root: PathBuf,
    project: PathBuf,
    images: PathBuf,
    results: PathBuf,
}

impl Workspace {
    fn locate() -> Self {
        let root = paths::model_preview_root();
        Self { project: root.join("PreviewProject"), images: root.join("images"), results: root.join("results"), root }
    }

    /// ProjectSettings are left to Unity: pinning an editor version made every other
    /// version upgrade and reimport the preview project on each run.
    fn prepare(&self) -> Result<(), String> {
        for directory in [&self.images, &self.results] {
            fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        }
        install_preview_project_scripts(&self.project.join("Assets").join("Editor")).map(|_| ())
    }

    fn write_jobs(&self, requests: Vec<ModelPreviewRequest>) -> Result<(PathBuf, u32), String> {
        let jobs: Vec<_> = requests
            .into_iter()
            .map(|request| {
                let source = Path::new(&request.source_path);
                let format = crate::files::extension_lowercase(source);
                let format = if format.is_empty() { "model".to_string() } else { format };
                let file_name =
                    format!("Model_{format}_{}_{}.png", safe_stem(source), short_hash(&request.source_path));
                let result_path = self.results.join(format!("{}.done.json", request.asset_id));
                let _ = fs::remove_file(&result_path);
                ModelPreviewJob {
                    result_path: result_path.to_string_lossy().into(),
                    output_path: self.images.join(file_name).to_string_lossy().into(),
                    asset_id: request.asset_id,
                    source_path: request.source_path,
                }
            })
            .collect();
        let count = jobs.len() as u32;
        let path = self.root.join("jobs.json");
        let file = ModelPreviewJobFile { version: protocol::VERSION, jobs };
        fs::write(&path, serde_json::to_string_pretty(&file).map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
        Ok((path, count))
    }
}

pub fn start(
    app: tauri::AppHandle,
    unity_editor_path: &str,
    models: Vec<ModelPreviewRequest>,
    shader_rules_path: &str,
) -> Result<u32, String> {
    let mut active = ACTIVE_PROCESS.lock().map_err(|_| "Preview process lock failed")?;
    if let Some(child) = active.as_mut() {
        if child.try_wait().map_err(|error| error.to_string())?.is_none() {
            return Err("A model preview job is already running".into());
        }
    }
    let editor = Path::new(unity_editor_path);
    if !editor.exists() {
        return Err("Unity Editor executable does not exist".into());
    }
    let workspace = Workspace::locate();
    workspace.prepare()?;
    let (jobs_path, count) = workspace.write_jobs(models)?;
    let child = background_command(editor)
        .arg("-batchmode")
        .arg("-quit")
        .arg("-projectPath")
        .arg(&workspace.project)
        .arg("-executeMethod")
        .arg("UnityPackHub.ModelPreviewBatch.Run")
        .arg("-uphJobs")
        .arg(&jobs_path)
        .arg("-uphShaderRules")
        .arg(shader_rules_path)
        .arg("-logFile")
        .arg(workspace.root.join("unity-render.log"))
        .spawn()
        .map_err(|error| error.to_string())?;
    *active = Some(child);
    drop(active);
    watch_exit(app);
    Ok(count)
}

/// Tells the frontend when the Unity process ends, so it stops waiting for missing results.
fn watch_exit(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        while is_running() {
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
        crate::events::model_preview_finished(&app);
    });
}

pub fn is_running() -> bool {
    let Ok(mut active) = ACTIVE_PROCESS.lock() else { return false };
    let finished = active.as_mut().map_or(true, |child| !matches!(child.try_wait(), Ok(None)));
    if finished {
        *active = None;
    }
    !finished
}

pub fn cancel() -> Result<bool, String> {
    let child = ACTIVE_PROCESS.lock().map_err(|_| "Preview process lock failed")?.take();
    let Some(mut child) = child else { return Ok(false) };
    if child.try_wait().map_err(|error| error.to_string())?.is_some() {
        return Ok(false);
    }
    child.kill().map_err(|error| error.to_string())?;
    let _ = child.wait();
    Ok(true)
}

/// Results written so far; each one is consumed (deleted) once returned.
pub fn collect_results() -> Result<Vec<ModelPreviewResult>, String> {
    let results = Workspace::locate().results;
    if !results.exists() {
        return Ok(Vec::new());
    }
    let mut collected = Vec::new();
    for entry in fs::read_dir(results).map_err(|error| error.to_string())?.flatten() {
        let path = entry.path();
        if crate::files::extension_lowercase(&path) != "json" {
            continue;
        }
        let Ok(text) = fs::read_to_string(&path) else { continue };
        if let Ok(result) = serde_json::from_str(&text) {
            collected.push(result);
            let _ = fs::remove_file(path);
        }
    }
    Ok(collected)
}

fn background_command(program: &Path) -> Command {
    let mut command = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        command.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }
    command.stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    command
}

fn short_hash(path: &str) -> String {
    let hash = path
        .replace('\\', "/")
        .to_lowercase()
        .bytes()
        .fold(1469598103934665603_u64, |hash, byte| (hash ^ byte as u64).wrapping_mul(1099511628211));
    format!("{:08x}", hash as u32)
}

fn safe_stem(path: &Path) -> String {
    path.file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("model")
        .chars()
        .map(|character| if "<>:\"/\\|?*".contains(character) { '_' } else { character })
        .collect::<String>()
        .trim_matches(&[' ', '.'][..])
        .chars()
        .take(80)
        .collect()
}
