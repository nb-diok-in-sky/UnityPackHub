use std::path::Path;

pub fn detect_unity_project() -> Result<Option<String>, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"Name='Unity.exe'\" | Select-Object -ExpandProperty CommandLine"])
            .creation_flags(0x08000000)
            .output()
            .map_err(|error| error.to_string())?;
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            if let Some(path) = project_path_from_command_line(line) {
                if Path::new(&path).join("Assets").exists() { return Ok(Some(path)); }
            }
        }
    }
    Ok(None)
}

fn project_path_from_command_line(command_line: &str) -> Option<String> {
    let index = command_line.to_ascii_lowercase().find("-projectpath")?;
    let value = command_line[index + 12..].trim();
    let path = if let Some(quoted) = value.strip_prefix('"') { quoted.split('"').next()? } else { value.split(' ').next()? };
    (!path.is_empty()).then(|| path.to_string())
}

#[cfg(test)]
mod tests {
    use super::project_path_from_command_line;

    #[test]
    fn parses_quoted_and_plain_project_paths() {
        assert_eq!(project_path_from_command_line("Unity.exe -projectPath \"C:\\My Project\" -logFile"), Some("C:\\My Project".into()));
        assert_eq!(project_path_from_command_line("Unity.exe -projectPath C:\\Project -batchmode"), Some("C:\\Project".into()));
    }
}
