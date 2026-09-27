// Answers requests from the app (highlight an asset, index the project) and publishes a
// heartbeat so the app knows this bridge is loaded and which protocol version it speaks.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace UnityPackHub
{
    [InitializeOnLoad]
    public static class UnityPackHubEditorActions
    {
        static readonly string PendingRoot = Path.Combine(UnityPackHubProtocol.EditorActionsRoot, "pending");
        static readonly string ResultsRoot = Path.Combine(UnityPackHubProtocol.EditorActionsRoot, "results");
        static readonly string HeartbeatPath = Path.Combine(UnityPackHubProtocol.EditorActionsRoot,
            UnityPackHubProtocol.HeartbeatPrefix + System.Diagnostics.Process.GetCurrentProcess().Id + ".json");

        static readonly HashSet<string> IndexedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { ".prefab", ".fbx", ".obj", ".blend", ".gltf", ".glb", ".dae", ".3ds", ".abc", ".mat", ".shader" };

        static double _lastPollTime;
        static double _lastHeartbeatTime;

        static UnityPackHubEditorActions()
        {
            EditorApplication.update += Poll;
            EditorApplication.quitting += () => { try { File.Delete(HeartbeatPath); } catch { } };
            // Bridges before protocol 2 shared one heartbeat file for every editor.
            try { File.Delete(Path.Combine(UnityPackHubProtocol.EditorActionsRoot, "heartbeat.json")); } catch { }
        }

        static void Poll()
        {
            var now = EditorApplication.timeSinceStartup;
            if (now - _lastPollTime < .25) return;
            _lastPollTime = now;
            if (now - _lastHeartbeatTime >= 1)
            {
                _lastHeartbeatTime = now;
                var heartbeat = new Heartbeat { version = UnityPackHubProtocol.Version, projectPath = UnityPackHubProtocol.ProjectRoot, ticks = DateTime.UtcNow.Ticks };
                try { UnityPackHubProtocol.WriteJson(HeartbeatPath, heartbeat); }
                catch { /* The app treats a stale heartbeat as "bridge offline". */ }
            }
            if (!Directory.Exists(PendingRoot)) return;
            foreach (var path in Directory.GetFiles(PendingRoot, "*.json")) Process(path);
        }

        static void Process(string requestPath)
        {
            var id = Path.GetFileNameWithoutExtension(requestPath);
            EditorActionResult result;
            var request = UnityPackHubProtocol.ReadJson<EditorActionRequest>(requestPath);
            // Requests for another open project are left for that editor's bridge.
            if (request != null && !UnityPackHubProtocol.IsThisProject(request.projectPath)) return;
            try
            {
                if (request == null || string.IsNullOrEmpty(request.id)) throw new InvalidDataException("Invalid editor action");
                id = request.id;
                result = Execute(request);
            }
            catch (Exception error) { result = Fail(error.Message); }
            finally { try { File.Delete(requestPath); } catch { } }
            UnityPackHubProtocol.WriteJson(Path.Combine(ResultsRoot, id + ".json"), result);
        }

        static EditorActionResult Execute(EditorActionRequest request)
        {
            switch ((request.action ?? "").ToLowerInvariant())
            {
                case "index": return BuildIndex();
                case "highlight": return Highlight(request);
                case "highlight-path": return HighlightPath(request.sourcePath);
                default: return Fail("Unsupported editor action");
            }
        }

        static EditorActionResult Highlight(EditorActionRequest request)
        {
            var path = request.assetPath;
            if (string.IsNullOrEmpty(path))
            {
                var fileName = Path.GetFileName(request.sourcePath);
                var matches = AssetDatabase.FindAssets(Path.GetFileNameWithoutExtension(fileName))
                    .Select(AssetDatabase.GUIDToAssetPath)
                    .Where(candidate => string.Equals(Path.GetFileName(candidate), fileName, StringComparison.OrdinalIgnoreCase))
                    .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
                if (matches.Length == 0) return Fail("Asset was not found in the open Unity project");
                if (matches.Length > 1) return Fail("Multiple Unity assets have the same file name");
                path = matches[0];
            }
            return HighlightPath(path);
        }

        static EditorActionResult HighlightPath(string path)
        {
            var asset = AssetDatabase.LoadMainAssetAtPath(path);
            if (asset == null) return Fail("Unity could not load the matched asset", path);
            Selection.activeObject = asset;
            EditorGUIUtility.PingObject(asset);
            return new EditorActionResult { success = true, message = "Asset highlighted", assetPath = path };
        }

        static EditorActionResult BuildIndex()
        {
            var usage = CollectSceneUsage();
            var paths = AssetDatabase.GetAllAssetPaths()
                .Where(path => path.StartsWith("Assets/", StringComparison.OrdinalIgnoreCase) && IndexedExtensions.Contains(Path.GetExtension(path)))
                .ToArray();
            var dependenciesByPath = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
            var referencedBy = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            foreach (var path in paths)
            {
                var dependencies = AssetDatabase.GetDependencies(path, false)
                    .Where(value => value.StartsWith("Assets/", StringComparison.OrdinalIgnoreCase)).ToArray();
                dependenciesByPath[path] = dependencies;
                foreach (var dependency in dependencies)
                {
                    if (!referencedBy.TryGetValue(dependency, out var references))
                        referencedBy[dependency] = references = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    references.Add(path);
                }
            }
            var assets = paths.Select(path => new ProjectAsset
            {
                guid = AssetDatabase.AssetPathToGUID(path),
                path = path,
                fileName = Path.GetFileName(path),
                assetType = AssetDatabase.GetMainAssetTypeAtPath(path)?.Name ?? "Unknown",
                dependencies = dependenciesByPath[path],
                sceneUsageCount = usage.TryGetValue(path, out var count) ? count : 0,
                referencedBy = referencedBy.TryGetValue(path, out var references) ? references.ToArray() : Array.Empty<string>(),
            }).ToArray();
            return new EditorActionResult { success = true, message = "Project indexed", assetPath = "", assets = assets };
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

        static EditorActionResult Fail(string message, string assetPath = "") =>
            new EditorActionResult { success = false, message = message, assetPath = assetPath };
    }
}
