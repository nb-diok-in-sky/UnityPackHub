pub fn open_with_default_app(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd").args(["/c", "start", "", &path]).creation_flags(0x08000000).spawn().map_err(|error| format!("Failed to open: {error}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    std::process::Command::new("open").arg(&path).spawn().map_err(|error| format!("Failed to open: {error}"))?;
    Ok(())
}

pub fn reveal_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(format!("/select,{}", path.replace('/', "\\"))).spawn().map_err(|error| format!("Failed to reveal: {error}"))?;
    #[cfg(not(target_os = "windows"))]
    std::process::Command::new("open").arg("-R").arg(&path).spawn().map_err(|error| format!("Failed to reveal: {error}"))?;
    Ok(())
}
