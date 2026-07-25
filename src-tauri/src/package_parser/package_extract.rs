use super::package_archive::{read_bytes, read_pathname, split_entry_path};
use super::ExtractRequest;
use flate2::read::GzDecoder;
use std::fs::File;
use std::path::Path;
use tar::Archive;

pub fn extract_single_asset(request: ExtractRequest) -> Result<Vec<String>, String> {
    let target = Path::new(&request.target_dir);
    std::fs::create_dir_all(target).map_err(|error| format!("Failed to create target directory: {error}"))?;
    let file = File::open(&request.package_path).map_err(|error| format!("Failed to open package: {error}"))?;
    let mut archive = Archive::new(GzDecoder::new(file));
    let entries = archive.entries().map_err(|error| format!("Failed to read archive: {error}"))?;
    let (mut pathname, mut asset, mut meta) = (None, None, None);

    for entry_result in entries {
        let mut entry = match entry_result { Ok(entry) => entry, Err(_) => continue };
        let entry_path = match entry.path() { Ok(path) => path.to_string_lossy().to_string(), Err(_) => continue };
        let Some((guid, name)) = split_entry_path(&entry_path) else { continue };
        if guid != request.guid { continue; }
        match name {
            "pathname" => pathname = read_pathname(&mut entry),
            "asset" => asset = read_bytes(&mut entry),
            "asset.meta" => meta = read_bytes(&mut entry),
            _ => {}
        }
    }

    let pathname = pathname.ok_or("Asset pathname not found in package")?;
    let asset = asset.ok_or("Asset data not found in package")?;
    let filename = pathname.rsplit('/').next().unwrap_or(&pathname);
    let asset_path = target.join(filename);
    std::fs::write(&asset_path, asset).map_err(|error| format!("Failed to write asset: {error}"))?;
    let mut extracted = vec![asset_path.to_string_lossy().to_string()];
    if let Some(meta) = meta {
        let meta_path = target.join(format!("{filename}.meta"));
        std::fs::write(&meta_path, meta).map_err(|error| format!("Failed to write meta: {error}"))?;
        extracted.push(meta_path.to_string_lossy().to_string());
    }
    Ok(extracted)
}
