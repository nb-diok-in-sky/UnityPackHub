use base64::Engine;
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use tar::Archive;

#[derive(Debug, Serialize, Clone)]
pub struct PackageInfo {
    pub files: Vec<String>,
    pub preview: Option<String>,
    pub file_count: usize,
}

#[derive(Debug, Serialize, Clone)]
pub struct PackageAssetEntry {
    pub guid: String,
    pub pathname: String,
    pub filename: String,
    pub extension: String,
    pub asset_type: String,
    pub preview: Option<String>,
    pub has_asset_data: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct PackageAssetList {
    pub entries: Vec<PackageAssetEntry>,
    pub total_count: usize,
}

const TEXTURE_EXTENSIONS: &[&str] = &[
    ".png", ".jpg", ".jpeg", ".tga", ".psd", ".exr", ".tif", ".tiff", ".bmp", ".gif", ".hdr",
    ".svg", ".ico", ".dds", ".ktx", ".astc", ".cubemap",
];

const HIGH_PRIORITY_EXTENSIONS: &[&str] = &[
    ".prefab", ".fbx", ".obj", ".blend", ".dae", ".3ds", ".max", ".ma", ".mb",
];

const MEDIUM_PRIORITY_EXTENSIONS: &[&str] = &[
    ".mat", ".shader", ".unity", ".asset", ".shadergraph", ".shadersubgraph",
];

fn asset_priority(pathname: &str) -> Option<u8> {
    let lower = pathname.to_lowercase();

    for ext in TEXTURE_EXTENSIONS {
        if lower.ends_with(ext) {
            return None;
        }
    }

    for ext in HIGH_PRIORITY_EXTENSIONS {
        if lower.ends_with(ext) {
            return Some(2);
        }
    }

    for ext in MEDIUM_PRIORITY_EXTENSIONS {
        if lower.ends_with(ext) {
            return Some(1);
        }
    }

    Some(0)
}

fn pick_best_preview(
    pathnames: &HashMap<String, String>,
    previews: &HashMap<String, Vec<u8>>,
) -> Option<String> {
    if previews.is_empty() {
        return None;
    }

    let mut best_guid: Option<&str> = None;
    let mut best_priority: u8 = 0;
    let mut best_size: usize = 0;

    for (guid, data) in previews {
        let priority = match pathnames.get(guid) {
            Some(path) => match asset_priority(path) {
                Some(p) => p,
                None => continue,
            },
            None => 0,
        };

        if best_guid.is_none() || priority > best_priority || (priority == best_priority && data.len() > best_size) {
            best_guid = Some(guid);
            best_priority = priority;
            best_size = data.len();
        }
    }

    if best_guid.is_none() {
        let fallback = previews.values().max_by_key(|d| d.len()).unwrap();
        let b64 = base64::engine::general_purpose::STANDARD.encode(fallback);
        return Some(format!("data:image/png;base64,{}", b64));
    }

    let data = &previews[best_guid.unwrap()];
    let b64 = base64::engine::general_purpose::STANDARD.encode(data);
    Some(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
pub fn parse_unity_package(path: String) -> Result<PackageInfo, String> {
    let file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    let decoder = GzDecoder::new(file);
    let mut archive = Archive::new(decoder);

    let mut pathnames: HashMap<String, String> = HashMap::new();
    let mut previews: HashMap<String, Vec<u8>> = HashMap::new();

    let entries = archive
        .entries()
        .map_err(|e| format!("Failed to read archive: {}", e))?;

    for entry_result in entries {
        let mut entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_path = match entry.path() {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => continue,
        };

        let parts: Vec<&str> = entry_path.split('/').collect();
        if parts.len() != 2 {
            continue;
        }

        let guid = parts[0].to_string();
        let filename = parts[1];

        match filename {
            "pathname" => {
                if let Some(path) = read_pathname(&mut entry) {
                    pathnames.insert(guid, path);
                }
            }
            "preview.png" => {
                let mut data = Vec::new();
                if entry.read_to_end(&mut data).is_ok() && !data.is_empty() {
                    previews.insert(guid, data);
                }
            }
            _ => {}
        }
    }

    let mut files: Vec<String> = pathnames.values().cloned().collect();
    files.sort();

    let preview = pick_best_preview(&pathnames, &previews);
    let file_count = files.len();

    Ok(PackageInfo {
        files,
        preview,
        file_count,
    })
}

#[tauri::command]
pub fn extract_package_preview(path: String) -> Result<Option<String>, String> {
    let file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    let decoder = GzDecoder::new(file);
    let mut archive = Archive::new(decoder);

    let mut pathnames: HashMap<String, String> = HashMap::new();
    let mut previews: HashMap<String, Vec<u8>> = HashMap::new();

    let entries = archive
        .entries()
        .map_err(|e| format!("Failed to read archive: {}", e))?;

    for entry_result in entries {
        let mut entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_path = match entry.path() {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => continue,
        };

        let parts: Vec<&str> = entry_path.split('/').collect();
        if parts.len() != 2 {
            continue;
        }

        let guid = parts[0].to_string();
        let filename = parts[1];

        match filename {
            "pathname" => {
                if let Some(path) = read_pathname(&mut entry) {
                    pathnames.insert(guid, path);
                }
            }
            "preview.png" => {
                let mut data = Vec::new();
                if entry.read_to_end(&mut data).is_ok() && !data.is_empty() {
                    previews.insert(guid, data);
                }
            }
            _ => {}
        }
    }

    Ok(pick_best_preview(&pathnames, &previews))
}

fn read_pathname(entry: &mut impl std::io::Read) -> Option<String> {
    let mut buf = Vec::new();
    entry.read_to_end(&mut buf).ok()?;
    // .unitypackage pathname entries are padded with \n + ASCII '0' '0'
    // after the actual path. Truncate at first newline to strip all junk.
    if let Some(pos) = buf.iter().position(|&b| b == b'\n' || b == 0) {
        buf.truncate(pos);
    }
    let s = String::from_utf8_lossy(&buf).trim().to_string();
    if s.is_empty() { None } else { Some(s) }
}

fn classify_pathname(pathname: &str) -> Option<String> {
    let p = pathname.to_lowercase();

    // Skip meta files — they're Unity metadata, not user-facing assets
    if p.ends_with(".meta") {
        return None;
    }

    let model = [".fbx", ".obj", ".blend", ".dae", ".3ds", ".max", ".ma", ".mb",
                 ".stl", ".ply", ".gltf", ".glb", ".abc", ".usd", ".usda", ".usdc", ".usdz"];
    let texture = [".png", ".jpg", ".jpeg", ".tga", ".psd", ".exr", ".tif", ".tiff",
                   ".bmp", ".gif", ".hdr", ".svg", ".dds", ".ktx", ".cubemap", ".astc",
                   ".rendertexture", ".flare", ".giparams"];
    let material = [".mat", ".physicmaterial", ".physicsmaterial"];
    let shader = [".shader", ".shadergraph", ".shadersubgraph", ".hlsl", ".cginc",
                  ".glsl", ".compute", ".raytrace"];
    let prefab = [".prefab"];
    let scene = [".unity", ".lighting", ".scenetemplate"];
    let script = [".cs", ".js", ".ts", ".jslib", ".asmdef", ".asmref", ".rsp"];
    let animation = [".anim", ".controller", ".overridecontroller", ".mask",
                     ".avatar", ".signal", ".playable"];
    let audio = [".wav", ".mp3", ".ogg", ".aif", ".aiff", ".flac", ".mixer"];
    let font = [".ttf", ".otf", ".fontsettings", ".fnt"];
    let asset = [".asset", ".scriptableobject", ".preset", ".brush",
                 ".terrainlayer", ".guiskin", ".spriteatlas"];
    let plugin = [".dll", ".so", ".dylib", ".bundle", ".aar", ".jar"];
    let ui = [".uxml", ".uss", ".tss"];

    macro_rules! check {
        ($arr:expr, $label:expr) => {
            for ext in &$arr {
                if p.ends_with(ext) { return Some($label.into()); }
            }
        };
    }

    check!(model, "Model");
    check!(texture, "Texture");
    check!(material, "Material");
    check!(shader, "Shader");
    check!(prefab, "Prefab");
    check!(scene, "Scene");
    check!(script, "Script");
    check!(animation, "Animation");
    check!(audio, "Audio");
    check!(font, "Font");
    check!(asset, "Asset");
    check!(plugin, "Plugin");
    check!(ui, "UI");

    Some("Other".into())
}

#[tauri::command]
pub fn parse_package_assets(path: String) -> Result<PackageAssetList, String> {
    let file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    let decoder = GzDecoder::new(file);
    let mut archive = Archive::new(decoder);

    let mut pathnames: HashMap<String, String> = HashMap::new();
    let mut previews: HashMap<String, Vec<u8>> = HashMap::new();
    let mut has_asset: HashMap<String, bool> = HashMap::new();

    let entries = archive
        .entries()
        .map_err(|e| format!("Failed to read archive: {}", e))?;

    for entry_result in entries {
        let mut entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_path = match entry.path() {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => continue,
        };

        let parts: Vec<&str> = entry_path.split('/').collect();
        if parts.len() != 2 {
            continue;
        }

        let guid = parts[0].to_string();
        let filename = parts[1];

        match filename {
            "pathname" => {
                if let Some(path) = read_pathname(&mut entry) {
                    pathnames.insert(guid, path);
                }
            }
            "preview.png" => {
                let mut data = Vec::new();
                if entry.read_to_end(&mut data).is_ok() && !data.is_empty() {
                    previews.insert(guid, data);
                }
            }
            "asset" | "asset.meta" => {
                has_asset.insert(guid, true);
            }
            _ => {}
        }
    }

    let mut entries_out: Vec<PackageAssetEntry> = Vec::new();

    for (guid, pathname) in &pathnames {
        if pathname.ends_with('/') {
            continue;
        }

        let asset_type = match classify_pathname(pathname) {
            Some(t) => t,
            None => continue,
        };

        let filename = pathname.rsplit('/').next().unwrap_or(pathname).to_string();
        let extension = Path::new(&filename)
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        let preview = previews.get(guid).map(|data| {
            let b64 = base64::engine::general_purpose::STANDARD.encode(data);
            format!("data:image/png;base64,{}", b64)
        });

        entries_out.push(PackageAssetEntry {
            guid: guid.clone(),
            pathname: pathname.clone(),
            filename,
            extension,
            asset_type,
            preview,
            has_asset_data: has_asset.contains_key(guid),
        });
    }

    entries_out.sort_by(|a, b| a.pathname.cmp(&b.pathname));
    let total_count = entries_out.len();

    Ok(PackageAssetList {
        entries: entries_out,
        total_count,
    })
}

#[tauri::command]
pub fn debug_package_pathnames(path: String, limit: usize) -> Result<Vec<String>, String> {
    let file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    let decoder = GzDecoder::new(file);
    let mut archive = Archive::new(decoder);
    let mut result = Vec::new();

    let entries = archive
        .entries()
        .map_err(|e| format!("Failed to read archive: {}", e))?;

    for entry_result in entries {
        let mut entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };
        let entry_path = match entry.path() {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => continue,
        };
        let parts: Vec<&str> = entry_path.split('/').collect();
        if parts.len() == 2 && parts[1] == "pathname" {
            if let Some(trimmed) = read_pathname(&mut entry) {
                if !trimmed.ends_with('/') {
                    let classified = classify_pathname(&trimmed).unwrap_or_else(|| "SKIP".into());
                    result.push(format!("[{}] {}", classified, trimmed));
                    if result.len() >= limit {
                        break;
                    }
                }
            }
        }
    }
    Ok(result)
}

#[derive(Debug, Deserialize)]
pub struct ExtractRequest {
    pub package_path: String,
    pub guid: String,
    pub target_dir: String,
}

#[tauri::command]
pub fn extract_single_asset(request: ExtractRequest) -> Result<Vec<String>, String> {
    let target = Path::new(&request.target_dir);
    if !target.exists() {
        std::fs::create_dir_all(target)
            .map_err(|e| format!("Failed to create target directory: {}", e))?;
    }

    let file = File::open(&request.package_path)
        .map_err(|e| format!("Failed to open package: {}", e))?;
    let decoder = GzDecoder::new(file);
    let mut archive = Archive::new(decoder);

    let mut pathname: Option<String> = None;
    let mut asset_data: Option<Vec<u8>> = None;
    let mut meta_data: Option<Vec<u8>> = None;

    let entries = archive
        .entries()
        .map_err(|e| format!("Failed to read archive: {}", e))?;

    for entry_result in entries {
        let mut entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let entry_path = match entry.path() {
            Ok(p) => p.to_string_lossy().to_string(),
            Err(_) => continue,
        };

        let parts: Vec<&str> = entry_path.split('/').collect();
        if parts.len() != 2 || parts[0] != request.guid {
            continue;
        }

        match parts[1] {
            "pathname" => {
                pathname = read_pathname(&mut entry);
            }
            "asset" => {
                let mut data = Vec::new();
                if entry.read_to_end(&mut data).is_ok() {
                    asset_data = Some(data);
                }
            }
            "asset.meta" => {
                let mut data = Vec::new();
                if entry.read_to_end(&mut data).is_ok() {
                    meta_data = Some(data);
                }
            }
            _ => {}
        }
    }

    let pathname = pathname.ok_or("Asset pathname not found in package")?;
    let asset_data = asset_data.ok_or("Asset data not found in package")?;

    let filename = pathname.rsplit('/').next().unwrap_or(&pathname);
    let mut extracted_files: Vec<String> = Vec::new();

    let asset_path = target.join(filename);
    std::fs::write(&asset_path, &asset_data)
        .map_err(|e| format!("Failed to write asset: {}", e))?;
    extracted_files.push(asset_path.to_string_lossy().to_string());

    if let Some(meta) = meta_data {
        let meta_path = target.join(format!("{}.meta", filename));
        std::fs::write(&meta_path, &meta)
            .map_err(|e| format!("Failed to write meta: {}", e))?;
        extracted_files.push(meta_path.to_string_lossy().to_string());
    }

    Ok(extracted_files)
}

#[tauri::command]
pub fn open_with_default_app(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &path])
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|e| format!("Failed to open: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let normalized = path.replace("/", "\\");
        std::process::Command::new("explorer")
            .arg(format!("/select,{}", normalized))
            .spawn()
            .map_err(|e| format!("Failed to reveal: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to reveal: {}", e))?;
    }
    Ok(())
}
