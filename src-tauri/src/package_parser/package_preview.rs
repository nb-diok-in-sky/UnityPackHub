use base64::Engine;
use std::collections::HashMap;

const TEXTURES: &[&str] = &["png", "jpg", "jpeg", "tga", "psd", "exr", "tif", "tiff", "bmp", "gif", "hdr", "svg", "ico", "dds", "ktx", "astc", "cubemap"];
const HIGH_PRIORITY: &[&str] = &["prefab", "fbx", "obj", "blend", "dae", "3ds", "max", "ma", "mb"];
const MEDIUM_PRIORITY: &[&str] = &["mat", "shader", "unity", "asset", "shadergraph", "shadersubgraph"];

pub fn encode_preview(data: &[u8]) -> String {
    let encoded = base64::engine::general_purpose::STANDARD.encode(data);
    format!("data:image/png;base64,{encoded}")
}

pub fn pick_best_preview(pathnames: &HashMap<String, String>, previews: &HashMap<String, Vec<u8>>) -> Option<String> {
    let best = previews.iter()
        .filter_map(|(guid, data)| preview_priority(pathnames.get(guid).map(String::as_str)).map(|priority| (priority, data.len(), data)))
        .max_by_key(|(priority, size, _)| (*priority, *size))
        .map(|(_, _, data)| data)
        .or_else(|| previews.values().max_by_key(|data| data.len()))?;
    Some(encode_preview(best))
}

fn preview_priority(pathname: Option<&str>) -> Option<u8> {
    let extension = pathname.and_then(|path| path.rsplit('.').next()).unwrap_or_default().to_ascii_lowercase();
    if TEXTURES.contains(&extension.as_str()) { return None; }
    if HIGH_PRIORITY.contains(&extension.as_str()) { return Some(2); }
    if MEDIUM_PRIORITY.contains(&extension.as_str()) { return Some(1); }
    Some(0)
}

#[cfg(test)]
mod tests {
    use super::pick_best_preview;
    use std::collections::HashMap;

    #[test]
    fn prefers_model_preview_over_larger_material_preview() {
        let pathnames = HashMap::from([
            ("model".into(), "Assets/Tree.fbx".into()),
            ("material".into(), "Assets/Tree.mat".into()),
        ]);
        let previews = HashMap::from([
            ("model".into(), vec![1, 2]),
            ("material".into(), vec![1, 2, 3, 4]),
        ]);
        let result = pick_best_preview(&pathnames, &previews).unwrap();
        assert!(result.ends_with("AQI="));
    }
}
