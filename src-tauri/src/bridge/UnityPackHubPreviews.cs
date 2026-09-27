// Renders previews of package prefabs inside the user's open Unity project.
//
// Every render goes through one path: a package folder under PreviewsRoot holds prefabs.json
// (written by the app) and a _trigger file. The app writes the trigger when the showcase opens;
// this script writes it after a package imported from the app finishes importing.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace UnityPackHub
{
    [InitializeOnLoad]
    public static class UnityPackHubPreviews
    {
        static readonly HashSet<string> RenderableExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        { ".prefab", ".fbx", ".obj", ".blend", ".dae", ".3ds", ".gltf", ".glb", ".abc", ".usd", ".usda", ".usdc" };

        sealed class RenderJob
        {
            public string directory;
            public Queue<PreviewRequest> pending;
            public List<ManifestEntry> entries;
            public int rendered;
        }

        static RenderJob _job;
        static double _lastPollTime;
        /// Triggers checked without finding any of their prefabs in this project, by trigger
        /// time. They are left for another open editor, and rechecked only when the trigger is
        /// renewed or this project's assets change.
        static readonly Dictionary<string, DateTime> UnmatchedTriggers = new Dictionary<string, DateTime>();

        static UnityPackHubPreviews()
        {
            AssetDatabase.importPackageCompleted += OnImportCompleted;
            EditorApplication.projectChanged += UnmatchedTriggers.Clear;
            EditorApplication.update += Poll;
        }

        [MenuItem("Tools/UnityPackHub/Generate Missing Previews")]
        static void GenerateAllMissing()
        {
            var queued = PackageDirectories().Count(RequestRender);
            if (queued == 0)
                EditorUtility.DisplayDialog("UnityPackHub",
                    "No preview folders found. Please open the showcase in UnityPackHub first to set up folders.", "OK");
            else
                Debug.Log($"[UnityPackHub] Queued preview generation for {queued} packages.");
        }

        static void OnImportCompleted(string packageName)
        {
            // Unity reports the package path without ".unitypackage" (sometimes just the name). Strip
            // only the directory: names like "Forest v1.8.8" must keep their dots.
            var pending = new[] { Path.GetFileName(packageName), Path.GetFileNameWithoutExtension(packageName) }
                .Select(name => Path.Combine(UnityPackHubProtocol.PendingImportsRoot, name + ".txt"))
                .FirstOrDefault(File.Exists);
            if (pending == null) return;
            try
            {
                var directory = Path.Combine(UnityPackHubProtocol.PreviewsRoot, File.ReadAllText(pending).Trim());
                File.Delete(pending);
                if (RequestRender(directory)) Debug.Log($"[UnityPackHub] '{packageName}' imported, previews queued.");
            }
            catch (Exception error) { Debug.LogWarning($"[UnityPackHub] Could not queue previews for '{packageName}': {error.Message}"); }
        }

        static void Poll()
        {
            if (_job != null) { RenderNext(); return; }
            if (EditorApplication.timeSinceStartup - _lastPollTime < 2.0) return;
            _lastPollTime = EditorApplication.timeSinceStartup;
            string[] projectAssets = null;
            foreach (var directory in PackageDirectories())
            {
                var trigger = Path.Combine(directory, UnityPackHubProtocol.TriggerFile);
                if (!File.Exists(trigger)) continue;
                var triggeredAt = File.GetLastWriteTimeUtc(trigger);
                if (UnmatchedTriggers.TryGetValue(directory, out var checkedAt) && checkedAt == triggeredAt) continue;

                var requests = ReadRequests(directory);
                if (projectAssets == null)
                    projectAssets = AssetDatabase.GetAllAssetPaths()
                        .Where(path => path.StartsWith("Assets/") && RenderableExtensions.Contains(Path.GetExtension(path)))
                        .ToArray();
                foreach (var request in requests) request.assetPath = MatchAsset(request, projectAssets);
                if (!requests.Any(request => !string.IsNullOrEmpty(request.assetPath)))
                {
                    UnmatchedTriggers[directory] = triggeredAt;
                    continue;
                }
                try { File.Delete(trigger); } catch { continue; }
                UnmatchedTriggers.Remove(directory);
                if (Start(directory, requests)) return;
            }
        }

        static bool Start(string directory, PreviewRequest[] requests)
        {
            var job = new RenderJob { directory = directory, pending = new Queue<PreviewRequest>(), entries = new List<ManifestEntry>() };
            foreach (var request in requests)
            {
                if (string.IsNullOrEmpty(request.assetPath)) continue;
                if (File.Exists(Path.Combine(directory, request.outputFile))) job.entries.Add(Entry(request.assetPath, request.outputFile, "rendered"));
                else job.pending.Enqueue(request);
            }

            if (job.pending.Count == 0)
            {
                WriteManifest(directory, job.entries);
                return false;
            }
            Debug.Log($"[UnityPackHub] '{Path.GetFileName(directory)}': rendering {job.pending.Count} prefabs ({job.entries.Count} already exist)...");
            _job = job;
            return true;
        }

        // One asset per editor tick keeps the editor responsive while rendering.
        static void RenderNext()
        {
            if (_job.pending.Count == 0)
            {
                WriteManifest(_job.directory, _job.entries);
                Debug.Log($"[UnityPackHub] Done! {_job.rendered} new renders for '{Path.GetFileName(_job.directory)}'.");
                _job = null;
                return;
            }
            var request = _job.pending.Dequeue();
            var entry = Capture(request.assetPath, Path.Combine(_job.directory, request.outputFile), request.outputFile);
            if (entry.HasValue) { _job.entries.Add(entry.Value); _job.rendered++; }
        }

        static ManifestEntry? Capture(string assetPath, string outputPath, string outputFile)
        {
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
            if (prefab != null && UnityPackHubRenderer.RenderModel(prefab, outputPath, RenderOptions.PackagePreview()))
                return Entry(assetPath, outputFile, "rendered", prefab.name);

            UnityEngine.Object asset = prefab != null ? prefab : AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath);
            if (asset == null || !UnityPackHubRenderer.CaptureThumbnail(asset, outputPath)) return null;
            return Entry(assetPath, outputFile, "thumbnail", asset.name, asset.GetType().Name);
        }

        /// Exact package path first (imports keep paths), then a unique file name as a fallback
        /// for packages whose content was moved after import.
        static string MatchAsset(PreviewRequest request, string[] candidates)
        {
            string Normalize(string value) => (value ?? "").Replace('\\', '/').TrimStart('/');
            var expected = Normalize(request.pathname);
            var exact = candidates.Where(path => Normalize(path).EndsWith(expected, StringComparison.OrdinalIgnoreCase)).ToArray();
            if (exact.Length == 1) return exact[0];
            var byName = candidates.Where(path => string.Equals(Path.GetFileName(path), request.filename, StringComparison.OrdinalIgnoreCase)).ToArray();
            return byName.Length == 1 ? byName[0] : null;
        }

        static IEnumerable<string> PackageDirectories()
        {
            // Folders starting with "_" (such as _pending_imports) are bookkeeping, not packages.
            return Directory.Exists(UnityPackHubProtocol.PreviewsRoot)
                ? Directory.GetDirectories(UnityPackHubProtocol.PreviewsRoot).Where(path => !Path.GetFileName(path).StartsWith("_"))
                : Enumerable.Empty<string>();
        }

        static bool RequestRender(string directory)
        {
            if (!File.Exists(Path.Combine(directory, UnityPackHubProtocol.RequestsFile))) return false;
            try { File.WriteAllText(Path.Combine(directory, UnityPackHubProtocol.TriggerFile), ""); return true; }
            catch (Exception error) { Debug.LogWarning($"[UnityPackHub] Could not queue previews: {error.Message}"); return false; }
        }

        static PreviewRequest[] ReadRequests(string directory)
        {
            return UnityPackHubProtocol.ReadJson<PreviewRequestFile>(Path.Combine(directory, UnityPackHubProtocol.RequestsFile))?.items
                ?? Array.Empty<PreviewRequest>();
        }

        /// Merges into the existing manifest so a partial render never drops earlier previews.
        static void WriteManifest(string directory, List<ManifestEntry> entries)
        {
            var path = Path.Combine(directory, UnityPackHubProtocol.ManifestFile);
            var merged = new List<ManifestEntry>();
            var positions = new Dictionary<string, int>();
            var existing = UnityPackHubProtocol.ReadJson<ManifestFile>(path)?.entries ?? Array.Empty<ManifestEntry>();
            foreach (var entry in existing.Concat(entries))
            {
                if (string.IsNullOrEmpty(entry.preview) || !File.Exists(Path.Combine(directory, entry.preview))) continue;
                if (positions.TryGetValue(entry.preview, out var position)) merged[position] = entry;
                else { positions[entry.preview] = merged.Count; merged.Add(entry); }
            }
            UnityPackHubProtocol.WriteJson(path, new ManifestFile { version = UnityPackHubProtocol.Version, entries = merged.ToArray() });
        }

        static ManifestEntry Entry(string assetPath, string preview, string renderType, string name = null, string type = "GameObject")
        {
            return new ManifestEntry
            {
                path = assetPath, name = name ?? Path.GetFileNameWithoutExtension(assetPath),
                type = type, preview = preview, renderType = renderType,
            };
        }
    }
}
