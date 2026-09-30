//! `uph://` serves images from the app's data folder (package previews, Unity renders, model
//! covers) straight to `<img>` tags, instead of shipping them through IPC as base64 strings.
//! On Windows the WebView reaches it as `http://uph.localhost/<percent-encoded absolute path>`.

use percent_encoding::percent_decode_str;
use std::path::{Path, PathBuf};
use tauri::http::{header, Response, StatusCode};

pub const SCHEME: &str = "uph";

/// Maps a request path to a file, refusing anything outside `root` (including `..` tricks).
pub fn resolve(request_path: &str, root: &Path) -> Option<PathBuf> {
    let decoded = percent_decode_str(request_path.trim_start_matches('/')).decode_utf8().ok()?;
    let file = PathBuf::from(decoded.as_ref()).canonicalize().ok()?;
    let root = root.canonicalize().ok()?;
    (file.starts_with(&root) && file.is_file()).then_some(file)
}

pub fn respond(request_path: &str) -> Response<Vec<u8>> {
    let Some(file) = resolve(request_path, &crate::paths::app_data_root()) else {
        return status(StatusCode::NOT_FOUND);
    };
    let Ok(bytes) = std::fs::read(&file) else { return status(StatusCode::NOT_FOUND) };
    Response::builder()
        .header(header::CONTENT_TYPE, content_type(&file))
        // Renders are overwritten in place, so always revalidate.
        .header(header::CACHE_CONTROL, "no-cache")
        // The page fetches covers as blobs from its own origin.
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .body(bytes)
        .unwrap_or_else(|_| status(StatusCode::INTERNAL_SERVER_ERROR))
}

fn status(code: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = code;
    response
}

fn content_type(path: &Path) -> &'static str {
    match crate::files::extension_lowercase(path).as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::resolve;
    use std::fs;

    #[test]
    fn serves_only_files_inside_the_root() {
        let base = std::env::temp_dir().join(format!("uph-protocol-{}", std::process::id()));
        let root = base.join("数据");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("a b.png"), [1]).unwrap();
        fs::write(base.join("secret.txt"), [1]).unwrap();
        let encoded = |path: &std::path::Path| {
            percent_encoding::utf8_percent_encode(&path.to_string_lossy(), percent_encoding::NON_ALPHANUMERIC)
                .to_string()
        };

        assert!(resolve(&format!("/{}", encoded(&root.join("a b.png"))), &root).is_some());
        assert!(resolve(&format!("/{}", encoded(&root.join("..").join("secret.txt"))), &root).is_none());
        assert!(resolve(&format!("/{}", encoded(&base.join("secret.txt"))), &root).is_none());
        assert!(resolve("/%FF", &root).is_none());
        let _ = fs::remove_dir_all(&base);
    }
}
