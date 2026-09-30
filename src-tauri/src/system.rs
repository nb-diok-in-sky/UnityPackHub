//! Handing files to the operating system.

#[tauri::command]
pub fn open_with_default_app(path: String) -> Result<(), String> {
    // ShellExecute directly instead of `cmd /c start`, which splits paths containing `&`, `^` or `%`.
    open::that_detached(&path).map_err(|error| format!("Failed to open: {error}"))
}

#[tauri::command]
pub fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // explorer expects `/select,"C:\path"`; pass it raw so Rust does not re-quote the whole argument.
        std::process::Command::new("explorer")
            .raw_arg(format!("/select,\"{}\"", path.replace('/', "\\")))
            .spawn()
            .map_err(|error| format!("Failed to reveal: {error}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|error| format!("Failed to reveal: {error}"))?;
    Ok(())
}
