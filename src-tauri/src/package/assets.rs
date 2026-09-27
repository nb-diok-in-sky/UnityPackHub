use super::archive;
use crate::files::png_data_url;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackageAssetEntry {
    pub guid: String,
    pub pathname: String,
    pub filename: String,
    pub extension: String,
    pub asset_type: String,
    /// Preview image embedded in the package by the exporter, as a data URL.
    pub preview: Option<String>,
    pub has_asset_data: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PackageAssetList {
    pub entries: Vec<PackageAssetEntry>,
    pub total_count: usize,
}

pub fn list_assets(path: &str) -> Result<PackageAssetList, String> {
    let content = archive::read_package(path, true)?;
    let mut entries: Vec<PackageAssetEntry> = content.pathnames.iter().filter_map(|(guid, pathname)| {
        if pathname.ends_with('/') { return None; }
        let asset_type = classify_pathname(pathname)?;
        let filename = file_name(pathname).to_string();
        Some(PackageAssetEntry {
            guid: guid.clone(),
            pathname: pathname.clone(),
            extension: crate::files::extension_lowercase(Path::new(&filename)),
            filename,
            asset_type: asset_type.to_string(),
            preview: content.previews.get(guid).map(|data| png_data_url(data)),
            has_asset_data: content.assets.contains(guid),
        })
    }).collect();
    entries.sort_by(|left, right| left.pathname.cmp(&right.pathname));
    Ok(PackageAssetList { total_count: entries.len(), entries })
}

/// (pathname, filename) of every prefab. Reads only pathnames, not embedded previews.
pub fn prefab_entries(path: &str) -> Result<Vec<(String, String)>, String> {
    let content = archive::read_package(path, false)?;
    let mut prefabs: Vec<_> = content.pathnames.into_values()
        .filter(|pathname| classify_pathname(pathname) == Some("Prefab"))
        .map(|pathname| { let filename = file_name(&pathname).to_string(); (pathname, filename) })
        .collect();
    prefabs.sort();
    Ok(prefabs)
}

fn file_name(pathname: &str) -> &str { pathname.rsplit('/').next().unwrap_or(pathname) }

fn classify_pathname(pathname: &str) -> Option<&'static str> {
    let extension = crate::files::extension_lowercase(Path::new(pathname));
    let kind = match extension.as_str() {
        "meta" => return None,
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
