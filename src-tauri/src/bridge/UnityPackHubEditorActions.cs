using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;
using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;

[InitializeOnLoad]
public static class UnityPackHubEditorActions
{
    static readonly string Root = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "com.unitypackhub.app", "editor-actions");
    static double lastPollTime;
    static readonly string HeartbeatPath = Path.Combine(Root, "heartbeat.json");

    [Serializable] class Request { public string id; public string action; public string sourcePath; public string assetPath; }
    [Serializable] class Result { public bool success; public string message; public string assetPath; public ProjectAssetInfo[] assets; }
    [Serializable] class ProjectAssetInfo
    {
        public string guid; public string path; public string fileName; public string assetType;
        public string[] dependencies; public int sceneUsageCount; public string[] referencedBy;
    }

    static UnityPackHubEditorActions() { EditorApplication.update += Poll; }

    static void Poll()
    {
        if (EditorApplication.timeSinceStartup - lastPollTime < .25) return;
        lastPollTime = EditorApplication.timeSinceStartup;
        try { Directory.CreateDirectory(Root); File.WriteAllText(HeartbeatPath, DateTime.UtcNow.Ticks.ToString()); } catch { }
        var pending = Path.Combine(Root, "pending");
        if (!Directory.Exists(pending)) return;
        foreach (var path in Directory.GetFiles(pending, "*.json")) Process(path);
    }

    static void Process(string requestPath)
    {
        var id = Path.GetFileNameWithoutExtension(requestPath);
        try
        {
            var request = JsonUtility.FromJson<Request>(File.ReadAllText(requestPath));
            if (request == null || string.IsNullOrEmpty(request.id)) throw new InvalidDataException("Invalid editor action");
            id = request.id;
            Write(id, Execute(request));
        }
        catch (Exception error) { Write(id, new Result { success = false, message = error.Message, assetPath = "" }); }
        finally { try { File.Delete(requestPath); } catch { } }
    }

    static Result Execute(Request request)
    {
        if (string.Equals(request.action, "index", StringComparison.OrdinalIgnoreCase)) return BuildIndex();
        if (string.Equals(request.action, "highlight", StringComparison.OrdinalIgnoreCase)) return Highlight(request);
        if (string.Equals(request.action, "highlight-path", StringComparison.OrdinalIgnoreCase))
            return HighlightPath(request.sourcePath);
        return new Result { success = false, message = "Unsupported editor action", assetPath = "" };
    }

    static Result Highlight(Request request)
    {
        var path = request.assetPath;
        if (string.IsNullOrEmpty(path))
        {
            var fileName = Path.GetFileName(request.sourcePath);
            var matches = AssetDatabase.FindAssets(Path.GetFileNameWithoutExtension(fileName))
                .Select(AssetDatabase.GUIDToAssetPath)
                .Where(candidate => string.Equals(Path.GetFileName(candidate), fileName, StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            if (matches.Length == 0) return new Result { success = false, message = "Asset was not found in the open Unity project" };
            if (matches.Length > 1) return new Result { success = false, message = "Multiple Unity assets have the same file name" };
            path = matches[0];
        }
        return HighlightPath(path);
    }

    static Result HighlightPath(string path)
    {
        var asset = AssetDatabase.LoadMainAssetAtPath(path);
        if (asset == null) return new Result { success = false, message = "Unity could not load the matched asset", assetPath = path };
        Selection.activeObject = asset;
        EditorGUIUtility.PingObject(asset);
        return new Result { success = true, message = "Asset highlighted", assetPath = path };
    }

    static Result BuildIndex()
    {
        var usage = CollectSceneUsage();
        var extensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { ".prefab", ".fbx", ".obj", ".blend", ".gltf", ".glb", ".dae", ".3ds", ".abc", ".mat", ".shader" };
        var paths = AssetDatabase.GetAllAssetPaths()
            .Where(path => path.StartsWith("Assets/", StringComparison.OrdinalIgnoreCase) && extensions.Contains(Path.GetExtension(path)))
            .ToArray();
        var reverse = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        var dependenciesByPath = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        foreach (var path in paths)
        {
            var dependencies = AssetDatabase.GetDependencies(path, false)
                .Where(value => value.StartsWith("Assets/", StringComparison.OrdinalIgnoreCase)).ToArray();
            dependenciesByPath[path] = dependencies;
            foreach (var dependency in dependencies)
            {
                if (!reverse.TryGetValue(dependency, out var references)) reverse[dependency] = references = new List<string>();
                references.Add(path);
            }
        }
        var assets = paths.Select(path => new ProjectAssetInfo {
                guid = AssetDatabase.AssetPathToGUID(path), path = path, fileName = Path.GetFileName(path),
                assetType = AssetDatabase.GetMainAssetTypeAtPath(path)?.Name ?? "Unknown",
                dependencies = dependenciesByPath[path], sceneUsageCount = usage.TryGetValue(path, out var count) ? count : 0,
                referencedBy = reverse.TryGetValue(path, out var references) ? references.Distinct(StringComparer.OrdinalIgnoreCase).ToArray() : Array.Empty<string>()
            }).ToArray();
        return new Result { success = true, message = "Project indexed", assetPath = "", assets = assets };
    }

    static Dictionary<string, int> CollectSceneUsage()
    {
        var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var sceneIndex = 0; sceneIndex < SceneManager.sceneCount; sceneIndex++)
        foreach (var root in SceneManager.GetSceneAt(sceneIndex).GetRootGameObjects())
        foreach (var transform in root.GetComponentsInChildren<Transform>(true))
        {
            var source = PrefabUtility.GetCorrespondingObjectFromSource(transform.gameObject);
            var path = source != null ? AssetDatabase.GetAssetPath(source) : "";
            if (!string.IsNullOrEmpty(path)) result[path] = result.TryGetValue(path, out var count) ? count + 1 : 1;
        }
        return result;
    }

    static void Write(string id, Result result)
    {
        var directory = Path.Combine(Root, "results");
        Directory.CreateDirectory(directory);
        File.WriteAllText(Path.Combine(directory, id + ".json"), JsonUtility.ToJson(result));
    }
}
