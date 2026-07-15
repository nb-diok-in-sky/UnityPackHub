use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}, process::Command, sync::Mutex};

const BATCH_SCRIPT: &str = include_str!("bridge/ModelPreviewBatch.cs");
const RENDERER_SCRIPT: &str = include_str!("bridge/UnityPackHubPreviewRenderer.cs");
const MATERIAL_SYSTEM_SCRIPT: &str = include_str!("bridge/PreviewMaterialSystem.cs");
static ACTIVE_PROCESS: Mutex<Option<u32>> = Mutex::new(None);

#[derive(Debug, Deserialize)]
pub struct PreviewRequest {
    #[serde(rename = "assetId")]
    asset_id: String,
    #[serde(rename = "sourcePath")]
    source_path: String,
}

#[derive(Debug, Serialize)]
struct PreviewJob {
    #[serde(rename = "assetId")]
    asset_id: String,
    #[serde(rename = "sourcePath")]
    source_path: String,
    #[serde(rename = "outputPath")]
    output_path: String,
    #[serde(rename = "resultPath")]
    result_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PreviewResult {
    #[serde(rename = "assetId")]
    asset_id: String,
    #[serde(rename = "imagePath")]
    image_path: String,
    success: bool,
    error: String,
}

struct PreviewWorkspace {
    root: PathBuf,
    project: PathBuf,
    images: PathBuf,
    results: PathBuf,
}

impl PreviewWorkspace {
    fn open() -> Result<Self, String> {
        let root = PathBuf::from(std::env::var("APPDATA").unwrap_or_default())
            .join("com.unitypackhub.app").join("Model picture");
        let workspace = Self {
            project: root.join("PreviewProject"),
            images: root.join("images"),
            results: root.join("results"),
            root,
        };
        workspace.prepare()?;
        Ok(workspace)
    }

    fn prepare(&self) -> Result<(), String> {
        let editor_dir = self.project.join("Assets").join("Editor");
        fs::create_dir_all(&editor_dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(&self.images).map_err(|e| e.to_string())?;
        fs::create_dir_all(&self.results).map_err(|e| e.to_string())?;
        fs::create_dir_all(self.project.join("ProjectSettings")).map_err(|e| e.to_string())?;
        fs::write(editor_dir.join("ModelPreviewBatch.cs"), BATCH_SCRIPT).map_err(|e| e.to_string())?;
        fs::write(editor_dir.join("UnityPackHubPreviewRenderer.cs"), RENDERER_SCRIPT).map_err(|e| e.to_string())?;
        fs::write(editor_dir.join("PreviewMaterialSystem.cs"), MATERIAL_SYSTEM_SCRIPT).map_err(|e| e.to_string())?;
        fs::write(self.project.join("ProjectSettings").join("ProjectVersion.txt"), "m_EditorVersion: 2022.3.0f1\n")
            .map_err(|e| e.to_string())
    }

    fn create_jobs(&self, requests: Vec<PreviewRequest>) -> Result<(PathBuf, u32), String> {
        let jobs: Vec<_> = requests.into_iter().map(|request| {
            let source = Path::new(&request.source_path);
            let format = source.extension().and_then(|v| v.to_str()).unwrap_or("model").to_lowercase();
            let file_name = format!("Model_{}_{}_{}.png", format, safe_stem(source), short_hash(&request.source_path));
            let _ = fs::remove_file(self.results.join(format!("{}.done.json", request.asset_id)));
            PreviewJob {
                result_path: self.results.join(format!("{}.done.json", request.asset_id)).to_string_lossy().into(),
                output_path: self.images.join(file_name).to_string_lossy().into(),
                asset_id: request.asset_id,
                source_path: request.source_path,
            }
        }).collect();
        let count = jobs.len() as u32;
        let path = self.root.join("jobs.json");
        fs::write(&path, serde_json::to_string_pretty(&serde_json::json!({ "jobs": jobs })).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        Ok((path, count))
    }
}

struct ProcessRegistry;

impl ProcessRegistry {
    fn ensure_idle() -> Result<(), String> {
        let mut active = ACTIVE_PROCESS.lock().map_err(|_| "Preview process lock failed")?;
        if active.map(process_is_running).unwrap_or(false) {
            return Err("A model preview job is already running".into());
        }
        *active = None;
        Ok(())
    }

    fn register(pid: u32) -> Result<(), String> {
        *ACTIVE_PROCESS.lock().map_err(|_| "Preview process lock failed")? = Some(pid);
        Ok(())
    }

    fn refresh() {
        if let Ok(mut active) = ACTIVE_PROCESS.lock() {
            if active.map(|pid| !process_is_running(pid)).unwrap_or(false) { *active = None; }
        }
    }

    fn cancel() -> Result<bool, String> {
        let mut active = ACTIVE_PROCESS.lock().map_err(|_| "Preview process lock failed")?;
        let Some(pid) = *active else { return Ok(false); };
        let status = Command::new("taskkill").args(["/PID", &pid.to_string(), "/T", "/F"])
            .status().map_err(|e| e.to_string())?;
        *active = None;
        Ok(status.success())
    }
}

fn short_hash(path: &str) -> String {
    let mut hash = 1469598103934665603_u64;
    for byte in path.replace('\\', "/").to_lowercase().bytes() {
        hash = (hash ^ byte as u64).wrapping_mul(1099511628211);
    }
    format!("{:08x}", hash as u32)
}

fn safe_stem(path: &Path) -> String {
    path.file_stem().and_then(|v| v.to_str()).unwrap_or("model").chars()
        .map(|c| if "<>:\"/\\|?*".contains(c) { '_' } else { c })
        .collect::<String>().trim_matches(&[' ', '.'][..]).chars().take(80).collect()
}

fn process_is_running(pid: u32) -> bool {
    Command::new("tasklist").args(["/FI", &format!("PID eq {}", pid), "/NH"]).output()
        .map(|output| String::from_utf8_lossy(&output.stdout).contains(&pid.to_string())).unwrap_or(false)
}

#[tauri::command]
pub fn discover_unity_editors() -> Result<Vec<String>, String> {
    let mut editors = Vec::new();
    let root = Path::new(r"C:\Program Files\Unity\Hub\Editor");
    if let Ok(versions) = fs::read_dir(root) {
        for version in versions.flatten() {
            let editor = version.path().join("Editor").join("Unity.exe");
            if editor.exists() { editors.push(editor.to_string_lossy().to_string()); }
        }
    }
    editors.sort();
    editors.reverse();
    Ok(editors)
}

#[tauri::command]
pub fn start_model_preview_job(
    unity_editor_path: String,
    models: Vec<PreviewRequest>,
    shader_rules_path: String,
) -> Result<u32, String> {
    ProcessRegistry::ensure_idle()?;
    let editor = Path::new(&unity_editor_path);
    if !editor.exists() { return Err("Unity Editor executable does not exist".into()); }
    let workspace = PreviewWorkspace::open()?;
    let (jobs_path, count) = workspace.create_jobs(models)?;
    use std::os::windows::process::CommandExt;
    let child = Command::new(editor).args([
        "-batchmode", "-quit", "-projectPath", workspace.project.to_str().unwrap_or_default(),
        "-executeMethod", "ModelPreviewBatch.Run", "-uphJobs", jobs_path.to_str().unwrap_or_default(),
        "-uphShaderRules", shader_rules_path.as_str(), "-logFile",
        workspace.root.join("unity-render.log").to_str().unwrap_or_default(),
    ]).creation_flags(0x08000000).spawn().map_err(|e| e.to_string())?;
    ProcessRegistry::register(child.id())?;
    Ok(count)
}

#[tauri::command]
pub fn cancel_model_preview_job() -> Result<bool, String> { ProcessRegistry::cancel() }

#[tauri::command]
pub fn collect_model_preview_results() -> Result<Vec<PreviewResult>, String> {
    ProcessRegistry::refresh();
    let results_dir = PreviewWorkspace::open()?.results;
    let mut results = Vec::new();
    for entry in fs::read_dir(results_dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        if path.extension().and_then(|v| v.to_str()) != Some("json") { continue; }
        if let Ok(result) = fs::read_to_string(&path).and_then(|text| serde_json::from_str(&text).map_err(std::io::Error::other)) {
            results.push(result);
            let _ = fs::remove_file(path);
        }
    }
    Ok(results)
}

#[tauri::command]
pub fn read_model_preview_image(path: String) -> Result<String, String> {
    let data = fs::read(path).map_err(|e| e.to_string())?;
    Ok(format!("data:image/png;base64,{}", base64::Engine::encode(&base64::engine::general_purpose::STANDARD, data)))
}
