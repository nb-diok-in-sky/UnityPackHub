use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Read;

#[derive(Debug, Serialize)]
pub struct FileHashResult {
    #[serde(rename = "filePath")]
    pub file_path: String,
    pub hash: String,
    pub error: String,
}

pub fn hash_files(paths: Vec<String>) -> Vec<FileHashResult> {
    paths.into_iter().map(hash_file).collect()
}

fn hash_file(file_path: String) -> FileHashResult {
    match calculate_hash(&file_path) {
        Ok(hash) => FileHashResult { file_path, hash, error: String::new() },
        Err(error) => FileHashResult { file_path, hash: String::new(), error },
    }
}

fn calculate_hash(path: &str) -> Result<String, String> {
    let mut file = std::fs::File::open(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 1024 * 1024];
    loop {
        let count = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if count == 0 { break; }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}
