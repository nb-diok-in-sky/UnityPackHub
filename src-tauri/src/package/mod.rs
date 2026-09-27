//! Reading `.unitypackage` archives (gzip tar, one folder per asset GUID).

mod archive;
mod assets;

pub use assets::{prefab_entries, PackageAssetList};

#[tauri::command(async)]
pub fn parse_package_assets(path: String) -> Result<PackageAssetList, String> {
    assets::list_assets(&path)
}
