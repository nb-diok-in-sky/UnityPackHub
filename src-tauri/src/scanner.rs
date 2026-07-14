use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use walkdir::WalkDir;

const MODEL_EXTENSIONS: &[&str] = &[
    "fbx", "prefab", "obj", "blend", "gltf", "glb", "dae", "3ds", "abc",
];
const TEXTURE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "tga", "psd", "exr", "tif", "tiff", "bmp", "gif", "hdr", "dds",
];
const MATERIAL_EXTENSIONS: &[&str] = &["mat", "mtl"];

#[derive(Debug, Serialize, Clone)]
pub struct ScannedFile {
    pub name: String,
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    #[serde(rename = "assetKind")]
    pub asset_kind: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct RelatedFile {
    #[serde(rename = "fileName")]
    pub file_name: String,
    #[serde(rename = "filePath")]
    pub file_path: String,
    #[serde(rename = "fileSize")]
    pub file_size: u64,
    #[serde(rename = "fileType")]
    pub file_type: String,
}

#[derive(Debug, Deserialize)]
struct BoundsSize {
    x: Option<f64>,
    y: Option<f64>,
    z: Option<f64>,
    unit: Option<String>,
    source: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawMetadataEntry {
    #[serde(rename = "originalName")]
    original_name: Option<String>,
    #[serde(rename = "inferredObject")]
    inferred_object: Option<String>,
    format: Option<String>,
    #[serde(rename = "boundsSize")]
    bounds_size: Option<BoundsSize>,
    path: Option<String>,
    #[serde(rename = "sourceAsset")]
    source_asset: Option<String>,
    confidence: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AssetMetadata {
    #[serde(rename = "originalName")]
    pub original_name: String,
    #[serde(rename = "inferredObject")]
    pub inferred_object: Option<String>,
    pub format: Option<String>,
    #[serde(rename = "boundsText")]
    pub bounds_text: Option<String>,
    pub path: String,
    #[serde(rename = "sourceAsset")]
    pub source_asset: Option<String>,
    pub confidence: Option<String>,
}

fn strip_known_suffix(name: &str, extensions: &[&str]) -> String {
    for ext in extensions {
        let suffix = format!(".{}", ext);
        if let Some(stripped) = name.strip_suffix(&suffix) {
            return stripped.to_string();
        }
        let upper_suffix = format!(".{}", ext.to_uppercase());
        if let Some(stripped) = name.strip_suffix(&upper_suffix) {
            return stripped.to_string();
        }
    }
    name.to_string()
}

fn normalize_path_text(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

fn filename_of(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path)
        .to_string()
}

fn bounds_to_text(bounds: Option<BoundsSize>) -> Option<String> {
    let b = bounds?;
    match (b.x, b.y, b.z) {
        (Some(x), Some(y), Some(z)) => {
            let unit = b.unit.unwrap_or_else(|| "Unity world unit".to_string());
            Some(format!("{:.2} x {:.2} x {:.2} {}", x, y, z, unit))
        }
        _ => b.source,
    }
}

#[tauri::command]
pub fn scan_directories(dirs: Vec<String>) -> Result<Vec<ScannedFile>, String> {
    let mut results = Vec::new();

    for dir in &dirs {
        for entry in WalkDir::new(dir)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");

            let (asset_kind, display_name) = if ext.eq_ignore_ascii_case("unitypackage") {
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let display = strip_known_suffix(&file_name, &["unitypackage"]);
                ("package".to_string(), display)
            } else if MODEL_EXTENSIONS.iter().any(|e| ext.eq_ignore_ascii_case(e)) {
                let file_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();
                let display = strip_known_suffix(&file_name, MODEL_EXTENSIONS);
                ("model".to_string(), display)
            } else {
                continue;
            };

            let file_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let file_size = entry.metadata().map(|m| m.len()).unwrap_or(0);

            results.push(ScannedFile {
                name: display_name,
                file_name,
                file_path: path.to_string_lossy().to_string(),
                file_size,
                asset_kind,
            });
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn scan_model_related_files(model_path: String) -> Result<Vec<RelatedFile>, String> {
    let model = Path::new(&model_path);
    let parent = model.parent().ok_or("Cannot determine parent directory")?;

    if !parent.exists() {
        return Err("Parent directory does not exist".into());
    }

    let model_file_name = model.file_name().and_then(|n| n.to_str()).unwrap_or("");

    let mut files = Vec::new();
    let mut seen = HashMap::new();

    let read_dir =
        std::fs::read_dir(parent).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let fname = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        if fname == model_file_name {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        let file_type = if TEXTURE_EXTENSIONS.iter().any(|&e| ext == e) {
            "texture"
        } else if MATERIAL_EXTENSIONS.iter().any(|&e| ext == e) {
            "material"
        } else if ext == "prefab" {
            "prefab"
        } else if ext == "meta" {
            continue;
        } else if MODEL_EXTENSIONS.iter().any(|&e| ext == e) {
            "model"
        } else {
            continue;
        };

        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

        if seen.contains_key(&fname) {
            continue;
        }
        seen.insert(fname.clone(), true);

        files.push(RelatedFile {
            file_name: fname,
            file_path: path.to_string_lossy().to_string(),
            file_size: size,
            file_type: file_type.to_string(),
        });
    }

    files.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(files)
}

#[tauri::command]
pub fn read_asset_metadata(
    json_path: String,
    asset_path: String,
) -> Result<Option<AssetMetadata>, String> {
    let text = std::fs::read_to_string(&json_path)
        .map_err(|e| format!("Failed to read metadata json: {}", e))?;
    let entries: Vec<RawMetadataEntry> =
        serde_json::from_str(&text).map_err(|e| format!("Failed to parse metadata json: {}", e))?;

    let target_path = normalize_path_text(&asset_path);
    let target_name = filename_of(&asset_path).to_lowercase();

    let matched = entries.into_iter().find(|entry| {
        if let Some(path) = &entry.path {
            if normalize_path_text(path) == target_path {
                return true;
            }
        }
        if let Some(name) = &entry.original_name {
            if name.to_lowercase() == target_name {
                return true;
            }
        }
        false
    });

    Ok(matched.map(|entry| {
        let path = entry.path.clone().unwrap_or_else(|| asset_path.clone());
        AssetMetadata {
            original_name: entry.original_name.unwrap_or_else(|| filename_of(&path)),
            inferred_object: entry.inferred_object,
            format: entry.format,
            bounds_text: bounds_to_text(entry.bounds_size),
            path,
            source_asset: entry.source_asset,
            confidence: entry.confidence,
        }
    }))
}
