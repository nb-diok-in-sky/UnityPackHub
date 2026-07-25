using UnityEditor;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

public static class ModelDependencyCopier
{
    static readonly Dictionary<string, Dictionary<string, string>> GuidIndexes = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
    static readonly HashSet<string> DependencyExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    { ".mat", ".mtl", ".png", ".jpg", ".jpeg", ".tga", ".psd", ".tif", ".tiff", ".bmp", ".exr", ".hdr", ".dds" };
    static readonly HashSet<string> GuidTextExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    { ".prefab", ".mat", ".asset", ".controller", ".overridecontroller", ".anim", ".mask", ".playable", ".shadergraph", ".shadersubgraph", ".shader", ".cginc", ".hlsl" };

    public static string Copy(string sourcePath, string importDirectory)
    {
        var assetsRoot = FindAssetsRoot(sourcePath);
        return string.IsNullOrEmpty(assetsRoot) ? CopyLoose(sourcePath, importDirectory) : CopyProject(sourcePath, assetsRoot, importDirectory);
    }

    static string CopyLoose(string sourcePath, string importDirectory)
    {
        Directory.CreateDirectory(importDirectory);
        File.Copy(sourcePath, Path.Combine(importDirectory, Path.GetFileName(sourcePath)), true);
        foreach (var file in Directory.GetFiles(Path.GetDirectoryName(sourcePath)))
            if (DependencyExtensions.Contains(Path.GetExtension(file))) File.Copy(file, Path.Combine(importDirectory, Path.GetFileName(file)), true);
        return importDirectory + "/" + Path.GetFileName(sourcePath);
    }

    static string CopyProject(string sourcePath, string assetsRoot, string importDirectory)
    {
        var target = importDirectory + "/ProjectAssets/" + RelativeTo(assetsRoot, sourcePath);
        var copied = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        CopyFileAndMeta(sourcePath, target, copied);
        foreach (var file in Directory.GetFiles(Path.GetDirectoryName(sourcePath)))
            if (DependencyExtensions.Contains(Path.GetExtension(file))) CopyFileAndMeta(file, importDirectory + "/ProjectAssets/" + RelativeTo(assetsRoot, file), copied);
        CopyGuidDependencies(sourcePath, assetsRoot, importDirectory, copied);
        foreach (var material in copied.Where(path => Path.GetExtension(path).Equals(".mat", StringComparison.OrdinalIgnoreCase))) PreviewMaterialSystem.RegisterMaterial(material);
        return Normalize(target);
    }

    static void CopyGuidDependencies(string sourcePath, string assetsRoot, string importDirectory, HashSet<string> copied)
    {
        var pending = new Queue<string>();
        var parsed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        pending.Enqueue(sourcePath);
        while (pending.Count > 0)
        {
            var dependency = pending.Dequeue();
            if (!parsed.Add(dependency) || !GuidTextExtensions.Contains(Path.GetExtension(dependency))) continue;
            string text;
            try { text = File.ReadAllText(dependency); } catch { continue; }
            var index = GetGuidIndex(assetsRoot);
            foreach (Match match in Regex.Matches(text, @"guid:\s*([0-9a-fA-F]{32})"))
            {
                if (!index.TryGetValue(match.Groups[1].Value, out var absolutePath)) continue;
                CopyFileAndMeta(absolutePath, importDirectory + "/ProjectAssets/" + RelativeTo(assetsRoot, absolutePath), copied);
                if (GuidTextExtensions.Contains(Path.GetExtension(absolutePath))) pending.Enqueue(absolutePath);
            }
        }
    }

    static Dictionary<string, string> GetGuidIndex(string assetsRoot)
    {
        if (GuidIndexes.TryGetValue(assetsRoot, out var cached)) return cached;
        var index = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var metaPath in Directory.EnumerateFiles(assetsRoot, "*.meta", SearchOption.AllDirectories))
        {
            var guid = File.ReadLines(metaPath).Take(8).FirstOrDefault(line => line.StartsWith("guid: "))?.Substring(6).Trim();
            var assetPath = metaPath.Substring(0, metaPath.Length - 5);
            if (!string.IsNullOrEmpty(guid) && File.Exists(assetPath)) index[guid] = assetPath;
        }
        return GuidIndexes[assetsRoot] = index;
    }

    static void CopyFileAndMeta(string sourcePath, string targetPath, HashSet<string> copied)
    {
        if (!copied.Add(sourcePath)) return;
        Directory.CreateDirectory(Path.GetDirectoryName(targetPath));
        File.Copy(sourcePath, targetPath, true);
        if (File.Exists(sourcePath + ".meta")) File.Copy(sourcePath + ".meta", targetPath + ".meta", true);
    }

    static string FindAssetsRoot(string sourcePath)
    {
        for (var directory = new DirectoryInfo(Path.GetDirectoryName(sourcePath)); directory != null; directory = directory.Parent)
            if (directory.Name.Equals("Assets", StringComparison.OrdinalIgnoreCase)) return directory.FullName;
        return null;
    }

    static string RelativeTo(string root, string path) => Normalize(Path.GetRelativePath(root, path));
    static string Normalize(string path) => path.Replace('\\', '/');
}
