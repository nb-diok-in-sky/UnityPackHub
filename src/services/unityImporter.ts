import { commands } from "./tauriCommands";
import type { UnityProjectAsset } from "../types/asset";

export interface ImportResult {
  success: boolean;
  message: string;
  newlyInjected: boolean;
}

export async function importToUnity(
  packagePath: string,
  projectPath?: string,
): Promise<ImportResult> {
  try {
    if (projectPath) {
      const injected = await commands.importWithBridge(
        packagePath,
        projectPath,
      );
      return { success: true, message: "ok", newlyInjected: injected };
    }
    await commands.openWithDefaultApp(packagePath);
    return { success: true, message: "ok", newlyInjected: false };
  } catch (error) {
    return { success: false, message: String(error), newlyInjected: false };
  }
}

export async function openFileLocation(filePath: string): Promise<void> {
  await commands.revealInExplorer(filePath);
}

export async function detectUnityProject(): Promise<string | null> {
  try {
    return await commands.detectUnityProject();
  } catch {
    return null;
  }
}

interface UnityEditorActionResult {
  success: boolean;
  message: string;
  assetPath?: string;
  assets?: UnityProjectAsset[];
}

async function executeUnityEditorAction(
  projectPath: string,
  action: string,
  sourcePath = "",
  timeoutMs = 12_000,
): Promise<UnityEditorActionResult> {
  if (!(await commands.isUnityEditorBridgeReady())) {
    await commands.ensureBridgeScript(projectPath);
    return {
      success: false,
      message:
        "Unity 尚未加载 UnityPackHub Bridge。请在 Unity 中执行 Assets > Refresh，等待脚本编译完成后重试。",
    };
  }

  const id = await commands.requestUnityEditorAction(
    projectPath,
    action,
    sourcePath,
  );
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const raw = await commands.collectUnityEditorActionResult(id);
    if (raw) return JSON.parse(raw) as UnityEditorActionResult;
  }
  return { success: false, message: "Unity did not respond in time" };
}

export async function highlightInUnity(
  sourcePath: string,
): Promise<UnityEditorActionResult> {
  const projectPath = await detectUnityProject();
  if (!projectPath)
    return { success: false, message: "No open Unity project was detected" };

  return executeUnityEditorAction(projectPath, "highlight", sourcePath);
}

export function highlightUnityAssetPath(
  projectPath: string,
  unityPath: string,
): Promise<UnityEditorActionResult> {
  return executeUnityEditorAction(projectPath, "highlight-path", unityPath);
}

export async function indexUnityProject(
  projectPath: string,
): Promise<UnityProjectAsset[]> {
  const result = await executeUnityEditorAction(
    projectPath,
    "index",
    "",
    30_000,
  );
  if (!result.success) throw new Error(result.message);
  return result.assets ?? [];
}

export interface PreviewEntry {
  path: string;
  name: string;
  type: string;
  preview: string;
  renderType: "rendered" | "thumbnail";
}

export interface PackagePreviews {
  package_name: string;
  entries: PreviewEntry[];
  preview_dir: string;
}

export async function getPackagePreviews(
  packageName: string,
): Promise<PackagePreviews | null> {
  try {
    return await commands.getPackagePreviews(packageName);
  } catch {
    return null;
  }
}

export async function readPreviewImage(
  previewDir: string,
  filename: string,
): Promise<string | null> {
  try {
    return await commands.readPreviewImage(previewDir, filename);
  } catch {
    return null;
  }
}
