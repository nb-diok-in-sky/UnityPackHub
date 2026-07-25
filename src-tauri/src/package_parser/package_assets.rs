use super::package_archive;
use super::package_preview::encode_preview;
use serde::Serialize;
use std::path::Path;

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

pub fn parse_package_assets(path: String) -> Result<PackageAssetList, String> {
    let content = package_archive::read_package(&path)?;
    let mut entries: Vec<PackageAssetEntry> = content.pathnames.iter().filter_map(|(guid, pathname)| {
        if pathname.ends_with('/') { return None; }
        let asset_type = classify_pathname(pathname)?;
        let filename = pathname.rsplit('/').next().unwrap_or(pathname).to_string();
        let extension = Path::new(&filename).extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase();
        Some(PackageAssetEntry {
            guid: guid.clone(),
            pathname: pathname.clone(),
            filename,
            extension,
            asset_type: asset_type.to_string(),
            preview: content.previews.get(guid).map(|data| encode_preview(data)),
            has_asset_data: content.assets.contains(guid),
        })
    }).collect();
    entries.sort_by(|left, right| left.pathname.cmp(&right.pathname));
    Ok(PackageAssetList { total_count: entries.len(), entries })
}

pub fn debug_package_pathnames(path: String, limit: usize) -> Result<Vec<String>, String> {
    let content = package_archive::read_package(&path)?;
    Ok(content.pathnames.values()
        .filter(|pathname| !pathname.ends_with('/'))
        .take(limit)
        .map(|pathname| format!("[{}] {}", classify_pathname(pathname).unwrap_or("SKIP"), pathname))
        .collect())
}

fn classify_pathname(pathname: &str) -> Option<&'static str> {
    let extension = Path::new(pathname).extension().and_then(|value| value.to_str()).unwrap_or_default().to_ascii_lowercase();
    let extension = extension.as_str();
    if extension == "meta" { return None; }
    let kind = match extension {
        "fbx" | "obj" | "blend" | "dae" | "3ds" | "max" | "ma" | "mb" | "stl" | "ply" | "gltf" | "glb" | "abc" | "usd" | "usda" | "usdc" | "usdz" => "Model",
        "png" | "jpg" | "jpeg" | "tga" | "psd" | "exr" | "tif" | "tiff" | "bmp" | "gif" | "hdr" | "svg" | "dds" | "ktx" | "cubemap" | "astc" | "rendertexture" | "flare" | "giparams" => "Texture",
        "mat" | "physicmaterial" | "physicsmaterial" => "Material",
        "shader" | "shadergraph" | "shadersubgraph" | "hlsl" | "cginc" | "glsl" | "compute" | "raytrace" => "Shader",
        "prefab" => "Prefab",
        "unity" | "lighting" | "scenetemplate" => "Scene",
        "cs" | "js" | "ts" | "jslib" | "asmdef" | "asmref" | "rsp" => "Script",
        "anim" | "controller" | "overridecontroller" | "mask" | "avatar" | "signal" | "playable" => "Animation",
        "wav" | "mp3" | "ogg" | "aif" | "aiff" | "flac" | "mixer" => "Audio",
        "ttf" | "otf" | "fontsettings" | "fnt" => "Font",
        "asset" | "scriptableobject" | "preset" | "brush" | "terrainlayer" | "guiskin" | "spriteatlas" => "Asset",
        "dll" | "so" | "dylib" | "bundle" | "aar" | "jar" => "Plugin",
        "uxml" | "uss" | "tss" => "UI",
        _ => "Other",
    };
    Some(kind)
}

#[cfg(test)]
mod tests {
    use super::classify_pathname;

    #[test]
    fn classifies_common_assets_case_insensitively() {
        assert_eq!(classify_pathname("Assets/Tree.FBX"), Some("Model"));
        assert_eq!(classify_pathname("Assets/Leaves.PNG"), Some("Texture"));
        assert_eq!(classify_pathname("Assets/Tree.prefab.meta"), None);
    }
}
