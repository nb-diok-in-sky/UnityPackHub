using UnityEditor;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

public static class UnityPackHubPreviewRequests
{
    static readonly HashSet<string> PrefabExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    { ".prefab", ".fbx", ".obj", ".blend", ".dae", ".3ds", ".gltf", ".glb", ".abc", ".usd", ".usda", ".usdc" };

    public static IEnumerable<string> PackageDirectories(string previewRoot)
    {
        return Directory.Exists(previewRoot) ? Directory.GetDirectories(previewRoot) : Array.Empty<string>();
    }

    public static bool TryConsumeTrigger(string packageDirectory, out UnityPackHubPreviewRequest[] requests)
    {
        requests = Array.Empty<UnityPackHubPreviewRequest>();
        var trigger = Path.Combine(packageDirectory, "_trigger");
        if (!File.Exists(trigger)) return false;
        File.Delete(trigger);
        var listFile = Path.Combine(packageDirectory, "prefabs.json");
        if (!File.Exists(listFile)) return false;
        try
        {
            var json = File.ReadAllText(listFile);
            requests = JsonUtility.FromJson<UnityPackHubPreviewRequestList>("{\"items\":" + json + "}").items ?? requests;
            return true;
        }
        catch { return false; }
    }

    public static List<UnityPackHubPreviewRequest> Match(UnityPackHubPreviewRequest[] requests)
    {
        var allAssets = RenderableAssetPaths().ToArray();
        return requests.Select(request =>
        {
            request.assetPath = UnityPackHubPreviewMatcher.Match(request, allAssets);
            return request;
        }).Where(request => !string.IsNullOrEmpty(request.assetPath)).ToList();
    }

    public static IEnumerable<string> RenderableAssetPaths()
    {
        return AssetDatabase.GetAllAssetPaths().Where(path => path.StartsWith("Assets/") && PrefabExtensions.Contains(Path.GetExtension(path)));
    }
}
