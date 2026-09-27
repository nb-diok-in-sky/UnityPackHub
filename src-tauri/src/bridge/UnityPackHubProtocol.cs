// File protocol shared with the UnityPackHub app. Mirrors src-tauri/src/protocol.rs field by
// field (JsonUtility maps fields by exact name). Bump Version on both sides when a format changes.
using System;
using System.IO;
using System.Text;
using UnityEngine;

namespace UnityPackHub
{
    public static class UnityPackHubProtocol
    {
        public const int Version = 2;

        public const string TriggerFile = "_trigger";
        public const string RequestsFile = "prefabs.json";
        public const string ManifestFile = "manifest.json";
        public const string PendingImportsDir = "_pending_imports";
        /// One heartbeat file per running editor: "heartbeat-<process id>.json".
        public const string HeartbeatPrefix = "heartbeat-";

        public static readonly string AppDataRoot = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "com.unitypackhub.app");
        public static readonly string PreviewsRoot = Path.Combine(AppDataRoot, "previews");
        public static readonly string PendingImportsRoot = Path.Combine(PreviewsRoot, PendingImportsDir);
        public static readonly string EditorActionsRoot = Path.Combine(AppDataRoot, "editor-actions");

        /// Root folder of the Unity project this editor has open.
        public static string ProjectRoot => Path.GetFullPath(Path.Combine(Application.dataPath, ".."));

        /// Several editors can run at once; requests name the project they are meant for.
        public static bool IsThisProject(string projectPath)
        {
            string Normalize(string value) => Path.GetFullPath(value).Replace('\\', '/').TrimEnd('/').ToLowerInvariant();
            try { return !string.IsNullOrEmpty(projectPath) && Normalize(projectPath) == Normalize(ProjectRoot); }
            catch { return false; }
        }

        public static T ReadJson<T>(string path) where T : class
        {
            try { return File.Exists(path) ? JsonUtility.FromJson<T>(File.ReadAllText(path)) : null; }
            catch (Exception error) { Debug.LogWarning($"[UnityPackHub] Ignoring unreadable {path}: {error.Message}"); return null; }
        }

        /// Writes through a temporary file so the app never reads a half-written file.
        public static void WriteJson(string path, object value)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            var temporary = path + ".tmp";
            File.WriteAllText(temporary, JsonUtility.ToJson(value, true), new UTF8Encoding(false));
            if (File.Exists(path)) File.Delete(path);
            File.Move(temporary, path);
        }
    }

    // ------------------------------------------------------------ package previews

    [Serializable]
    public sealed class PreviewRequest
    {
        public string pathname;
        public string filename;
        public string outputFile;
        [NonSerialized] public string assetPath;
    }

    [Serializable]
    public sealed class PreviewRequestFile
    {
        public int version;
        public PreviewRequest[] items;
    }

    [Serializable]
    public struct ManifestEntry
    {
        public string path, name, type, preview, renderType;
    }

    [Serializable]
    public sealed class ManifestFile
    {
        public int version;
        public ManifestEntry[] entries;
    }

    // ------------------------------------------------------------ editor actions

    [Serializable]
    public sealed class EditorActionRequest
    {
        public string id;
        public string projectPath;
        public string action;
        public string sourcePath;
        public string assetPath;
    }

    [Serializable]
    public sealed class EditorActionResult
    {
        public bool success;
        public string message;
        public string assetPath;
        public ProjectAsset[] assets;
    }

    [Serializable]
    public sealed class ProjectAsset
    {
        public string guid;
        public string path;
        public string fileName;
        public string assetType;
        public string[] dependencies;
        public int sceneUsageCount;
        public string[] referencedBy;
    }

    [Serializable]
    public sealed class Heartbeat
    {
        public int version;
        public string projectPath;
        public long ticks;
    }

    // ------------------------------------------------------------ model preview batch

    [Serializable]
    public sealed class ModelPreviewJob
    {
        public string assetId;
        public string sourcePath;
        public string outputPath;
        public string resultPath;
    }

    [Serializable]
    public sealed class ModelPreviewJobFile
    {
        public int version;
        public ModelPreviewJob[] jobs;
    }

    [Serializable]
    public sealed class ModelPreviewResult
    {
        public string assetId;
        public string imagePath;
        public bool success;
        public string error;
    }
}
