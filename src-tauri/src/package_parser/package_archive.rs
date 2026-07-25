use flate2::read::GzDecoder;
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::Read;
use tar::Archive;

#[derive(Default)]
pub struct PackageContent {
    pub pathnames: HashMap<String, String>,
    pub previews: HashMap<String, Vec<u8>>,
    pub assets: HashSet<String>,
}

pub fn read_package(path: &str) -> Result<PackageContent, String> {
    let file = File::open(path).map_err(|error| format!("Failed to open file: {error}"))?;
    let mut archive = Archive::new(GzDecoder::new(file));
    let entries = archive.entries().map_err(|error| format!("Failed to read archive: {error}"))?;
    let mut content = PackageContent::default();

    for entry_result in entries {
        let mut entry = match entry_result { Ok(entry) => entry, Err(_) => continue };
        let entry_path = match entry.path() { Ok(path) => path.to_string_lossy().to_string(), Err(_) => continue };
        let Some((guid, entry_name)) = split_entry_path(&entry_path) else { continue };

        match entry_name {
            "pathname" => if let Some(pathname) = read_pathname(&mut entry) {
                content.pathnames.insert(guid.to_string(), pathname);
            },
            "preview.png" => if let Some(data) = read_bytes(&mut entry) {
                content.previews.insert(guid.to_string(), data);
            },
            "asset" | "asset.meta" => { content.assets.insert(guid.to_string()); },
            _ => {}
        }
    }
    Ok(content)
}

pub fn split_entry_path(path: &str) -> Option<(&str, &str)> {
    let (guid, name) = path.split_once('/')?;
    if name.contains('/') { None } else { Some((guid, name)) }
}

pub fn read_pathname(reader: &mut impl Read) -> Option<String> {
    let mut bytes = Vec::new();
    reader.read_to_end(&mut bytes).ok()?;
    if let Some(index) = bytes.iter().position(|byte| *byte == b'\n' || *byte == 0) {
        bytes.truncate(index);
    }
    let pathname = String::from_utf8_lossy(&bytes).trim().to_string();
    (!pathname.is_empty()).then_some(pathname)
}

pub fn read_bytes(reader: &mut impl Read) -> Option<Vec<u8>> {
    let mut bytes = Vec::new();
    reader.read_to_end(&mut bytes).ok()?;
    (!bytes.is_empty()).then_some(bytes)
}

#[cfg(test)]
mod tests {
    use super::{read_pathname, split_entry_path};

    #[test]
    fn splits_only_guid_and_entry_name() {
        assert_eq!(split_entry_path("guid/pathname"), Some(("guid", "pathname")));
        assert_eq!(split_entry_path("guid/folder/asset"), None);
    }

    #[test]
    fn trims_unitypackage_pathname_padding() {
        let mut bytes = &b"Assets/Tree.prefab\n00"[..];
        assert_eq!(read_pathname(&mut bytes).as_deref(), Some("Assets/Tree.prefab"));
    }
}
