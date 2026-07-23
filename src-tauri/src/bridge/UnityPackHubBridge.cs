using UnityEngine;
using UnityEditor;
using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;

[InitializeOnLoad]
public class UnityPackHubBridge
{
    static readonly string PreviewRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "com.unitypackhub.app", "previews");
    const int WAIT_FRAMES = 180;

    static readonly HashSet<string> PrefabExtensions = new HashSet<string>(
        StringComparer.OrdinalIgnoreCase) { ".prefab", ".fbx", ".obj", ".blend",
        ".dae", ".3ds", ".gltf", ".glb", ".abc", ".usd", ".usda", ".usdc" };

    static string _importingPackage;
    static List<string> _prefabPaths;
    static HashSet<string> _assetsBeforeImport;
    static int _waitFrames;

    static Queue<UnityPackHubPreviewRequest> _renderQueue;
    static List<UnityPackHubPreviewEntry> _entries;
    static string _currentPkgDir;
    static int _skippedCount;
    static readonly Queue<UnityPackHubRenderJob> RenderJobs = new Queue<UnityPackHubRenderJob>();
    static bool _renderingJob;

    static double _lastPollTime;

    static UnityPackHubBridge()
    {
        Debug.Log("[UnityPackHub] Bridge script loaded.");
        AssetDatabase.importPackageStarted += OnStarted;
        AssetDatabase.importPackageCompleted += OnCompleted;
        EditorApplication.update += PollTriggerFiles;
    }

    static void PollTriggerFiles()
    {
        if (EditorApplication.timeSinceStartup - _lastPollTime < 2.0) return;
        _lastPollTime = EditorApplication.timeSinceStartup;

        if (!Directory.Exists(PreviewRoot)) return;

        foreach (var pkgDir in Directory.GetDirectories(PreviewRoot))
        {
            var triggerFile = Path.Combine(pkgDir, "_trigger");
            if (!File.Exists(triggerFile)) continue;

            File.Delete(triggerFile);

            var listFile = Path.Combine(pkgDir, "prefabs.json");
            if (!File.Exists(listFile)) continue;

            UnityPackHubPreviewRequest[] expectedPrefabs;
            try {
                var json = File.ReadAllText(listFile);
                expectedPrefabs = JsonUtility.FromJson<UnityPackHubPreviewRequestList>("{\"items\":" + json + "}").items ?? Array.Empty<UnityPackHubPreviewRequest>();
            } catch { continue; }

            var allPrefabs = AssetDatabase.GetAllAssetPaths()
                .Where(p => p.StartsWith("Assets/") && PrefabExtensions.Contains(Path.GetExtension(p))).ToArray();

            var pkgName = Path.GetFileName(pkgDir);
            _importingPackage = pkgName;
            _currentPkgDir = pkgDir;
            _entries = new List<UnityPackHubPreviewEntry>();
            _skippedCount = 0;

            var toRender = new List<UnityPackHubPreviewRequest>();
            foreach (var request in expectedPrefabs)
            {
                var assetPath = UnityPackHubPreviewMatcher.Match(request, allPrefabs);
                if (string.IsNullOrEmpty(assetPath)) continue;
                string pngPath = Path.Combine(pkgDir, request.outputFile);
                if (File.Exists(pngPath)) {
                    _skippedCount++;
                    _entries.Add(UnityPackHubPreviewManifest.Entry(assetPath, request.outputFile, "rendered"));
                    continue;
                }
                request.assetPath = assetPath;
                toRender.Add(request);
            }

            if (toRender.Count == 0)
            {
                Debug.Log($"[UnityPackHub] '{pkgName}': all previews exist, nothing to render.");
                WriteManifest();
                continue;
            }

            Debug.Log($"[UnityPackHub] '{pkgName}': auto-rendering {toRender.Count} prefabs ({_skippedCount} skipped)...");
            _renderQueue = new Queue<UnityPackHubPreviewRequest>(toRender);
            EditorApplication.update += ProcessNextAsset;
            return;
        }
    }

    [MenuItem("Tools/UnityPackHub/Generate Missing Previews")]
    static void ManualGenerateAll()
    {
        if (!Directory.Exists(PreviewRoot))
        {
            EditorUtility.DisplayDialog("UnityPackHub",
                "No preview folders found. Please open the showcase in UnityPackHub first to set up folders.", "OK");
            return;
        }

        var allPrefabs = new Dictionary<string, string>();
        foreach (var p in AssetDatabase.GetAllAssetPaths()
            .Where(p => p.StartsWith("Assets/") && PrefabExtensions.Contains(Path.GetExtension(p))))
        {
            var key = Path.GetFileName(p);
            if (!allPrefabs.ContainsKey(key))
                allPrefabs[key] = p;
        }

        int totalRendered = 0;
        int totalSkipped = 0;

        foreach (var pkgDir in Directory.GetDirectories(PreviewRoot))
        {
            var listFile = Path.Combine(pkgDir, "prefabs.json");
            if (!File.Exists(listFile)) continue;

            string[] expectedPrefabs;
            try {
                var json = File.ReadAllText(listFile);
                expectedPrefabs = json.TrimStart('[').TrimEnd(']', '\n', '\r', ' ')
                    .Split(',')
                    .Select(s => s.Trim().Trim('"'))
                    .Where(s => !string.IsNullOrEmpty(s))
                    .ToArray();
            } catch { continue; }

            var pkgName = Path.GetFileName(pkgDir);
            _importingPackage = pkgName;
            _currentPkgDir = pkgDir;
            _entries = new List<UnityPackHubPreviewEntry>();
            _skippedCount = 0;

            var toRender = new List<string>();
            foreach (var prefabFile in expectedPrefabs)
            {
                string pngPath = Path.Combine(pkgDir, prefabFile + ".png");
                if (File.Exists(pngPath))
                {
                    _skippedCount++;
                    continue;
                }
                if (allPrefabs.TryGetValue(prefabFile, out var assetPath))
                {
                    toRender.Add(assetPath);
                }
            }

            totalSkipped += _skippedCount;

            if (toRender.Count == 0)
            {
                Debug.Log($"[UnityPackHub] '{pkgName}': all {_skippedCount} previews exist, skipping.");
                continue;
            }

            Debug.Log($"[UnityPackHub] '{pkgName}': rendering {toRender.Count}, skipping {_skippedCount} existing...");
            _renderQueue = new Queue<UnityPackHubPreviewRequest>(toRender.Select(path => new UnityPackHubPreviewRequest {
                assetPath = path, filename = Path.GetFileName(path), outputFile = Path.GetFileName(path) + ".png"
            }));
            EditorApplication.update += ProcessNextAsset;
            totalRendered += toRender.Count;
        }

        if (totalRendered == 0)
            EditorUtility.DisplayDialog("UnityPackHub",
                $"All previews are up to date! ({totalSkipped} existing)", "OK");
    }

    static void OnStarted(string packageName)
    {
        _importingPackage = Path.GetFileNameWithoutExtension(packageName);
        _assetsBeforeImport = new HashSet<string>(AssetDatabase.GetAllAssetPaths(), StringComparer.OrdinalIgnoreCase);
    }

    static void OnCompleted(string packageName)
    {
        var before = _assetsBeforeImport ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        _prefabPaths = AssetDatabase.GetAllAssetPaths()
            .Where(p => p.StartsWith("Assets/") && !before.Contains(p)
                && PrefabExtensions.Contains(Path.GetExtension(p)))
            .ToList();

        if (_prefabPaths.Count == 0)
        {
            Debug.Log("[UnityPackHub] Package imported but no prefabs/models found in project.");
            return;
        }

        RenderJobs.Enqueue(new UnityPackHubRenderJob { packageName = _importingPackage, assetPaths = new List<string>(_prefabPaths) });
        Debug.Log($"[UnityPackHub] Package imported, {_prefabPaths.Count} new prefabs/models queued for preview.");
        TryStartNextJob();
    }

    static void TryStartNextJob()
    {
        if (_renderingJob || RenderJobs.Count == 0) return;
        var job = RenderJobs.Dequeue();
        _renderingJob = true;
        _importingPackage = job.packageName;
        _prefabPaths = job.assetPaths;
        _waitFrames = 0;
        EditorApplication.update += PollReady;
    }

    static void PollReady()
    {
        _waitFrames++;
        if (_waitFrames < WAIT_FRAMES) return;

        EditorApplication.update -= PollReady;
        StartBatchCapture();
    }

    static void StartBatchCapture()
    {
        _currentPkgDir = Path.Combine(PreviewRoot, _importingPackage);
        Directory.CreateDirectory(_currentPkgDir);
        _entries = new List<UnityPackHubPreviewEntry>();
        _skippedCount = 0;

        var toRender = new List<string>();
        foreach (var p in _prefabPaths)
        {
            string pngFile = Path.GetFileName(p) + ".png";
            string pngPath = Path.Combine(_currentPkgDir, pngFile);
            if (File.Exists(pngPath))
            {
                _skippedCount++;
            }
            else
            {
                toRender.Add(p);
            }
        }

        if (toRender.Count == 0)
        {
            Debug.Log($"[UnityPackHub] All {_skippedCount} prefab previews already exist, nothing to render.");
            _renderingJob = false;
            TryStartNextJob();
            return;
        }

        _renderQueue = new Queue<UnityPackHubPreviewRequest>(toRender.Select(path => new UnityPackHubPreviewRequest {
            assetPath = path, filename = Path.GetFileName(path), outputFile = Path.GetFileName(path) + ".png"
        }));
        Debug.Log($"[UnityPackHub] Rendering {toRender.Count} prefabs ({_skippedCount} skipped, already exist)...");
        EditorApplication.update += ProcessNextAsset;
    }

    static void ProcessNextAsset()
    {
        if (_renderQueue.Count == 0)
        {
            EditorApplication.update -= ProcessNextAsset;
            WriteManifest();
            _renderingJob = false;
            TryStartNextJob();
            return;
        }

        var request = _renderQueue.Dequeue();
        CaptureAsset(request.assetPath, request.outputFile);
    }

    static void CaptureAsset(string assetPath, string outputFile = null)
    {
        var result = UnityPackHubAssetRenderer.Capture(assetPath, _currentPkgDir, outputFile ?? Path.GetFileName(assetPath) + ".png");
        if (result.HasValue) _entries.Add(result.Value);
    }

    static void WriteManifest()
    {
        UnityPackHubPreviewManifest.Write(_currentPkgDir, _entries);
        Debug.Log($"[UnityPackHub] Done! {_entries.Count} new renders, {_skippedCount} skipped for '{_importingPackage}'");
    }

}
