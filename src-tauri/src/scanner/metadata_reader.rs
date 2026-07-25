use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Deserialize)]
struct BoundsSize {
    x: Option<f64>, y: Option<f64>, z: Option<f64>,
    unit: Option<String>, source: Option<String>,
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

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum RawMetadataDocument {
    Entries(Vec<RawMetadataEntry>),
    Wrapped { assets: Vec<RawMetadataEntry> },
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

pub fn read_asset_metadata_table(json_path: String) -> Result<Vec<AssetMetadata>, String> {
    Ok(read_document(&json_path)?.into_iter().map(|entry| convert(entry, String::new())).collect())
}

pub fn read_asset_metadata(json_path: String, asset_path: String) -> Result<Option<AssetMetadata>, String> {
    let target_path = normalize_path(&asset_path);
    let target_name = filename(&asset_path).to_ascii_lowercase();
    let matched = read_document(&json_path)?.into_iter().find(|entry| {
        entry.path.as_deref().map(normalize_path).is_some_and(|path| path == target_path)
            || entry.original_name.as_ref().is_some_and(|name| name.to_ascii_lowercase() == target_name)
    });
    Ok(matched.map(|entry| convert(entry, asset_path)))
}

fn read_document(path: &str) -> Result<Vec<RawMetadataEntry>, String> {
    let text = std::fs::read_to_string(path).map_err(|error| format!("Failed to read metadata json: {error}"))?;
    match serde_json::from_str(&text).map_err(|error| format!("Failed to parse metadata json: {error}"))? {
        RawMetadataDocument::Entries(entries) => Ok(entries),
        RawMetadataDocument::Wrapped { assets } => Ok(assets),
    }
}

fn convert(entry: RawMetadataEntry, fallback_path: String) -> AssetMetadata {
    let path = entry.path.unwrap_or(fallback_path);
    AssetMetadata {
        original_name: entry.original_name.unwrap_or_else(|| filename(&path)),
        inferred_object: entry.inferred_object,
        format: entry.format,
        bounds_text: bounds_text(entry.bounds_size),
        path,
        source_asset: entry.source_asset,
        confidence: entry.confidence,
    }
}

fn bounds_text(bounds: Option<BoundsSize>) -> Option<String> {
    let bounds = bounds?;
    match (bounds.x, bounds.y, bounds.z) {
        (Some(x), Some(y), Some(z)) => Some(format!("{x:.2} x {y:.2} x {z:.2} {}", bounds.unit.unwrap_or_else(|| "Unity world unit".into()))),
        _ => bounds.source,
    }
}

fn filename(path: &str) -> String {
    Path::new(path).file_name().and_then(|name| name.to_str()).unwrap_or(path).to_string()
}

fn normalize_path(path: &str) -> String {
    path.replace('\\', "/").to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::{bounds_text, normalize_path, BoundsSize};

    #[test]
    fn normalizes_windows_paths_for_matching() {
        assert_eq!(normalize_path("C:\\Models\\Tree.FBX"), "c:/models/tree.fbx");
    }

    #[test]
    fn formats_complete_bounds_and_falls_back_to_source() {
        let complete = BoundsSize { x: Some(1.0), y: Some(2.0), z: Some(3.0), unit: Some("m".into()), source: None };
        assert_eq!(bounds_text(Some(complete)).as_deref(), Some("1.00 x 2.00 x 3.00 m"));
        let fallback = BoundsSize { x: None, y: None, z: None, unit: None, source: Some("unknown".into()) };
        assert_eq!(bounds_text(Some(fallback)).as_deref(), Some("unknown"));
    }
}
