using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine.SceneManagement;
using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
using System.Text;

[InitializeOnLoad]
public class UnityPackHubBridge
{
    static readonly string PreviewRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
        "com.unitypackhub.app", "previews");

    const int RENDER_SIZE = 512;
    const int WAIT_FRAMES = 180;

    static readonly HashSet<string> PrefabExtensions = new HashSet<string>(
        StringComparer.OrdinalIgnoreCase) { ".prefab", ".fbx", ".obj", ".blend",
        ".dae", ".3ds", ".gltf", ".glb", ".abc", ".usd", ".usda", ".usdc" };

    static string _importingPackage;
    static List<string> _prefabPaths;
    static int _waitFrames;

    static Queue<string> _renderQueue;
    static List<PreviewEntry> _entries;
    static string _currentPkgDir;
    static int _skippedCount;

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

            string[] expectedPrefabs;
            try {
                var json = File.ReadAllText(listFile);
                expectedPrefabs = json.TrimStart('[').TrimEnd(']', '\n', '\r', ' ')
                    .Split(',')
                    .Select(s => s.Trim().Trim('"'))
                    .Where(s => !string.IsNullOrEmpty(s))
                    .ToArray();
            } catch { continue; }

            var allPrefabs = new Dictionary<string, string>();
            foreach (var p in AssetDatabase.GetAllAssetPaths()
                .Where(p => p.StartsWith("Assets/") && PrefabExtensions.Contains(Path.GetExtension(p))))
            {
                var key = Path.GetFileName(p);
                if (!allPrefabs.ContainsKey(key))
                    allPrefabs[key] = p;
            }

            var pkgName = Path.GetFileName(pkgDir);
            _importingPackage = pkgName;
            _currentPkgDir = pkgDir;
            _entries = new List<PreviewEntry>();
            _skippedCount = 0;

            var toRender = new List<string>();
            foreach (var prefabFile in expectedPrefabs)
            {
                string pngPath = Path.Combine(pkgDir, prefabFile + ".png");
                if (File.Exists(pngPath)) { _skippedCount++; continue; }
                if (allPrefabs.TryGetValue(prefabFile, out var assetPath))
                    toRender.Add(assetPath);
            }

            if (toRender.Count == 0)
            {
                Debug.Log($"[UnityPackHub] '{pkgName}': all previews exist, nothing to render.");
                continue;
            }

            Debug.Log($"[UnityPackHub] '{pkgName}': auto-rendering {toRender.Count} prefabs ({_skippedCount} skipped)...");
            _renderQueue = new Queue<string>(toRender);
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
            _entries = new List<PreviewEntry>();
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
            _renderQueue = new Queue<string>(toRender);
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
    }

    static void OnCompleted(string packageName)
    {
        _prefabPaths = AssetDatabase.GetAllAssetPaths()
            .Where(p => p.StartsWith("Assets/") && PrefabExtensions.Contains(Path.GetExtension(p)))
            .ToList();

        if (_prefabPaths.Count == 0)
        {
            Debug.Log("[UnityPackHub] Package imported but no prefabs/models found in project.");
            return;
        }

        _waitFrames = 0;
        EditorApplication.update += PollReady;
        Debug.Log($"[UnityPackHub] Package imported, {_prefabPaths.Count} prefabs/models in project. Checking for missing previews...");
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
        _entries = new List<PreviewEntry>();
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
            return;
        }

        _renderQueue = new Queue<string>(toRender);
        Debug.Log($"[UnityPackHub] Rendering {toRender.Count} prefabs ({_skippedCount} skipped, already exist)...");
        EditorApplication.update += ProcessNextAsset;
    }

    static void ProcessNextAsset()
    {
        if (_renderQueue.Count == 0)
        {
            EditorApplication.update -= ProcessNextAsset;
            WriteManifest();
            return;
        }

        var assetPath = _renderQueue.Dequeue();
        CaptureAsset(assetPath);
    }

    static void CaptureAsset(string assetPath)
    {
        var obj = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
        if (obj == null)
        {
            var fallback = AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath);
            if (fallback == null) return;

            string fbPng = Path.GetFileName(assetPath) + ".png";
            string fbPath = Path.Combine(_currentPkgDir, fbPng);
            if (CaptureThumbnail(fallback, fbPath))
            {
                _entries.Add(new PreviewEntry
                {
                    path = assetPath, name = fallback.name,
                    type = fallback.GetType().Name,
                    preview = fbPng, renderType = "thumbnail"
                });
            }
            return;
        }

        string pngFile = Path.GetFileName(assetPath) + ".png";
        string pngPath = Path.Combine(_currentPkgDir, pngFile);

        bool captured = RenderModel(obj, pngPath);
        string renderType = captured ? "rendered" : "thumbnail";

        if (!captured)
            captured = CaptureThumbnail(obj, pngPath);

        if (!captured) return;

        _entries.Add(new PreviewEntry
        {
            path = assetPath, name = obj.name,
            type = "GameObject",
            preview = pngFile, renderType = renderType
        });
    }

    static bool RenderModel(GameObject prefab, string outputPath)
    {
        Scene tempScene = default;
        try
        {
            tempScene = EditorSceneManager.NewPreviewScene();

            var instance = PrefabUtility.InstantiatePrefab(prefab, tempScene) as GameObject;
            if (instance == null)
            {
                instance = UnityEngine.Object.Instantiate(prefab);
                SceneManager.MoveGameObjectToScene(instance, tempScene);
            }
            instance.transform.position = Vector3.zero;
            instance.transform.rotation = Quaternion.identity;

            var renderers = instance.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0)
            {
                CleanupScene(instance, tempScene);
                return false;
            }

            var bounds = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i++)
                bounds.Encapsulate(renderers[i].bounds);

            var camGO = EditorUtility.CreateGameObjectWithHideFlags(
                "PreviewCam", HideFlags.HideAndDontSave, typeof(Camera));
            SceneManager.MoveGameObjectToScene(camGO, tempScene);
            var cam = camGO.GetComponent<Camera>();
            cam.cameraType = CameraType.Preview;
            cam.scene = tempScene;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.85f, 0.85f, 0.85f, 1f);
            cam.nearClipPlane = 0.01f;
            cam.farClipPlane = 5000f;
            cam.fieldOfView = 30f;

            float maxExtent = bounds.extents.magnitude;
            if (maxExtent < 0.001f) maxExtent = 1f;
            float dist = maxExtent * 1.2f / Mathf.Tan(cam.fieldOfView * 0.5f * Mathf.Deg2Rad);
            var camDir = new Vector3(1f, 0.6f, 1f).normalized;
            cam.transform.position = bounds.center + camDir * dist;
            cam.transform.LookAt(bounds.center);

            var keyLightGO = EditorUtility.CreateGameObjectWithHideFlags(
                "KeyLight", HideFlags.HideAndDontSave, typeof(Light));
            SceneManager.MoveGameObjectToScene(keyLightGO, tempScene);
            var keyLight = keyLightGO.GetComponent<Light>();
            keyLight.type = LightType.Directional;
            keyLight.intensity = 1.1f;
            keyLight.color = new Color(1f, 0.98f, 0.95f);
            keyLight.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            var fillLightGO = EditorUtility.CreateGameObjectWithHideFlags(
                "FillLight", HideFlags.HideAndDontSave, typeof(Light));
            SceneManager.MoveGameObjectToScene(fillLightGO, tempScene);
            var fillLight = fillLightGO.GetComponent<Light>();
            fillLight.type = LightType.Directional;
            fillLight.intensity = 0.35f;
            fillLight.color = new Color(0.75f, 0.85f, 1f);
            fillLight.transform.rotation = Quaternion.Euler(-15f, 150f, 0f);

            var rt = new RenderTexture(RENDER_SIZE, RENDER_SIZE, 24, RenderTextureFormat.ARGB32);
            rt.antiAliasing = 4;
            cam.targetTexture = rt;
            cam.Render();

            var prevRT = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(RENDER_SIZE, RENDER_SIZE, TextureFormat.RGBA32, false);
            tex.ReadPixels(new Rect(0, 0, RENDER_SIZE, RENDER_SIZE), 0, 0);
            tex.Apply();
            RenderTexture.active = prevRT;

            File.WriteAllBytes(outputPath, tex.EncodeToPNG());

            cam.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(tex);
            UnityEngine.Object.DestroyImmediate(rt);
            UnityEngine.Object.DestroyImmediate(keyLightGO);
            UnityEngine.Object.DestroyImmediate(fillLightGO);
            UnityEngine.Object.DestroyImmediate(camGO);
            CleanupScene(instance, tempScene);

            return true;
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[UnityPackHub] Render failed for prefab: {e.Message}");
            if (tempScene.IsValid())
                EditorSceneManager.ClosePreviewScene(tempScene);
            return false;
        }
    }

    static void CleanupScene(GameObject instance, Scene scene)
    {
        if (instance != null)
            UnityEngine.Object.DestroyImmediate(instance);
        if (scene.IsValid())
            EditorSceneManager.ClosePreviewScene(scene);
    }

    static bool CaptureThumbnail(UnityEngine.Object obj, string outputPath)
    {
        Texture2D preview = AssetPreview.GetAssetPreview(obj);
        if (preview == null)
            preview = AssetPreview.GetMiniThumbnail(obj);
        if (preview == null)
            return false;

        try
        {
            var rt = RenderTexture.GetTemporary(preview.width, preview.height, 0);
            Graphics.Blit(preview, rt);
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var readable = new Texture2D(preview.width, preview.height, TextureFormat.RGBA32, false);
            readable.ReadPixels(new Rect(0, 0, preview.width, preview.height), 0, 0);
            readable.Apply();
            RenderTexture.active = prev;
            RenderTexture.ReleaseTemporary(rt);

            File.WriteAllBytes(outputPath, readable.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(readable);
            return true;
        }
        catch (Exception e)
        {
            Debug.LogWarning($"[UnityPackHub] Thumbnail capture failed: {e.Message}");
            return false;
        }
    }

    static void WriteManifest()
    {
        var sb = new StringBuilder();
        sb.AppendLine("[");
        for (int i = 0; i < _entries.Count; i++)
        {
            var e = _entries[i];
            sb.Append("  {");
            sb.Append($"\"path\":\"{Esc(e.path)}\",");
            sb.Append($"\"name\":\"{Esc(e.name)}\",");
            sb.Append($"\"type\":\"{Esc(e.type)}\",");
            sb.Append($"\"preview\":\"{Esc(e.preview)}\",");
            sb.Append($"\"renderType\":\"{Esc(e.renderType)}\"");
            sb.Append("}");
            if (i < _entries.Count - 1) sb.Append(",");
            sb.AppendLine();
        }
        sb.AppendLine("]");

        File.WriteAllText(Path.Combine(_currentPkgDir, "manifest.json"), sb.ToString(), Encoding.UTF8);
        Debug.Log($"[UnityPackHub] Done! {_entries.Count} new renders, {_skippedCount} skipped for '{_importingPackage}'");
    }

    static string Esc(string s) =>
        s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");

    struct PreviewEntry
    {
        public string path, name, type, preview, renderType;
    }
}
