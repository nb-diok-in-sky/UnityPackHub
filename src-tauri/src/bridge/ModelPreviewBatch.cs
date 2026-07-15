using UnityEditor;
using UnityEngine;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;

public static class ModelPreviewBatch
{
    static readonly Dictionary<string, Dictionary<string, string>> GuidIndexes =
        new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
    [Serializable] class JobList { public ModelJob[] jobs; }
    [Serializable] class ModelJob { public string assetId; public string sourcePath; public string outputPath; public string resultPath; }
    [Serializable] class ModelResult { public string assetId; public string imagePath; public bool success; public string error; }

    public static void Run()
    {
        var args = Environment.GetCommandLineArgs();
        var jobsPath = GetArg(args, "-uphJobs");
        var rulesPath = GetArg(args, "-uphShaderRules");
        if (string.IsNullOrEmpty(jobsPath) || !File.Exists(jobsPath))
            throw new Exception("UnityPackHub model preview job file is missing.");

        var list = JsonUtility.FromJson<JobList>(File.ReadAllText(jobsPath));
        PreviewMaterialSystem.LoadRules(rulesPath);
        foreach (var job in list.jobs ?? Array.Empty<ModelJob>()) Process(job);
        EditorApplication.Exit(0);
    }

    static void Process(ModelJob job)
    {
        var result = new ModelResult { assetId = job.assetId, imagePath = job.outputPath, success = false, error = "" };
        string importDirectory = "Assets/ModelInput/" + job.assetId;
        string importedPath = CopySourceWithDependencies(job.sourcePath, importDirectory);
        try
        {
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
            MakeImportedTexturesReadable(importDirectory);
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(importedPath);
            if (model == null) throw new Exception("Unity cannot import this model format.");
            Directory.CreateDirectory(Path.GetDirectoryName(job.outputPath));
            if (!UnityPackHubPreviewRenderer.Render(model, job.outputPath))
                throw new Exception(string.IsNullOrEmpty(UnityPackHubPreviewRenderer.LastError)
                    ? "No renderable mesh was found."
                    : UnityPackHubPreviewRenderer.LastError);
            result.success = true;
        }
        catch (Exception error) { result.error = error.Message; }
        finally
        {
            AssetDatabase.DeleteAsset(importDirectory);
            File.WriteAllText(job.resultPath + ".tmp", JsonUtility.ToJson(result));
            if (File.Exists(job.resultPath)) File.Delete(job.resultPath);
            File.Move(job.resultPath + ".tmp", job.resultPath);
        }
    }

    static string CopySourceWithDependencies(string sourcePath, string importDirectory)
    {
        var assetsRoot = FindAssetsRoot(sourcePath);
        if (!string.IsNullOrEmpty(assetsRoot))
            return CopyUnityProjectDependencies(sourcePath, assetsRoot, importDirectory);

        return CopyLooseDependencies(sourcePath, importDirectory);
    }

    static void MakeImportedTexturesReadable(string importDirectory)
    {
        foreach (var guid in AssetDatabase.FindAssets("t:Texture2D", new[] { importDirectory }))
        {
            var path = AssetDatabase.GUIDToAssetPath(guid);
            var importer = AssetImporter.GetAtPath(path) as TextureImporter;
            if (importer == null || importer.isReadable) continue;
            importer.isReadable = true;
            importer.SaveAndReimport();
        }
    }

    static string CopyLooseDependencies(string sourcePath, string importDirectory)
    {
        Directory.CreateDirectory(importDirectory);
        var sourceDirectory = Path.GetDirectoryName(sourcePath);
        var dependencyExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".mat", ".mtl", ".png", ".jpg", ".jpeg", ".tga", ".psd", ".tif", ".tiff",
            ".bmp", ".exr", ".hdr", ".dds"
        };
        File.Copy(sourcePath, Path.Combine(importDirectory, Path.GetFileName(sourcePath)), true);
        foreach (var file in Directory.GetFiles(sourceDirectory))
        {
            if (!dependencyExtensions.Contains(Path.GetExtension(file))) continue;
            File.Copy(file, Path.Combine(importDirectory, Path.GetFileName(file)), true);
        }
        return importDirectory + "/" + Path.GetFileName(sourcePath);
    }

    static string CopyUnityProjectDependencies(string sourcePath, string assetsRoot, string importDirectory)
    {
        var sourceDirectory = Path.GetDirectoryName(sourcePath);
        var sourceRelative = NormalizeAssetPath(Path.GetRelativePath(assetsRoot, sourcePath));
        var targetAssetPath = importDirectory + "/ProjectAssets/" + sourceRelative;
        var targetRoot = Path.GetDirectoryName(targetAssetPath);
        Directory.CreateDirectory(targetRoot);

        var copied = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        CopyFileAndMeta(sourcePath, targetAssetPath, copied);

        var dependencyExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".mat", ".mtl", ".png", ".jpg", ".jpeg", ".tga", ".psd", ".tif", ".tiff",
            ".bmp", ".exr", ".hdr", ".dds"
        };
        foreach (var file in Directory.GetFiles(sourceDirectory))
        {
            if (!dependencyExtensions.Contains(Path.GetExtension(file))) continue;
            var relative = NormalizeAssetPath(Path.GetRelativePath(assetsRoot, file));
            CopyFileAndMeta(file, importDirectory + "/ProjectAssets/" + relative, copied);
        }

        CopyGuidDependenciesRecursive(sourcePath, assetsRoot, importDirectory, copied);

        foreach (var copiedPath in copied.Where(path => Path.GetExtension(path).Equals(".mat", StringComparison.OrdinalIgnoreCase)))
            PreviewMaterialSystem.RegisterMaterial(copiedPath);

        return NormalizeAssetPath(targetAssetPath);
    }

    static void CopyGuidDependenciesRecursive(
        string sourcePath,
        string assetsRoot,
        string importDirectory,
        HashSet<string> copied)
    {
        var pendingFiles = new Queue<string>();
        var parsedFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        pendingFiles.Enqueue(sourcePath);

        while (pendingFiles.Count > 0)
        {
            var dependencySource = pendingFiles.Dequeue();
            if (!parsedFiles.Add(dependencySource) || !IsGuidTextAsset(dependencySource)) continue;

            string text;
            try { text = File.ReadAllText(dependencySource); }
            catch { continue; }

            var guids = Regex.Matches(text, @"guid:\s*([0-9a-fA-F]{32})")
                .Cast<Match>()
                .Select(match => match.Groups[1].Value)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            if (guids.Length == 0) continue;

            var guidIndex = GetGuidIndex(assetsRoot);
            foreach (var guid in guids)
            {
                if (!guidIndex.TryGetValue(guid, out var absolutePath)) continue;
                var relative = NormalizeAssetPath(Path.GetRelativePath(assetsRoot, absolutePath));
                CopyFileAndMeta(absolutePath, importDirectory + "/ProjectAssets/" + relative, copied);
                if (IsGuidTextAsset(absolutePath)) pendingFiles.Enqueue(absolutePath);
            }
        }
    }

    static bool IsGuidTextAsset(string path)
    {
        switch (Path.GetExtension(path).ToLowerInvariant())
        {
            case ".prefab":
            case ".mat":
            case ".asset":
            case ".controller":
            case ".overridecontroller":
            case ".anim":
            case ".mask":
            case ".playable":
            case ".shadergraph":
            case ".shadersubgraph":
            case ".shader":
            case ".cginc":
            case ".hlsl":
                return true;
            default:
                return false;
        }
    }

    static Dictionary<string, string> GetGuidIndex(string assetsRoot)
    {
        if (GuidIndexes.TryGetValue(assetsRoot, out var cached)) return cached;
        var index = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var metaPath in Directory.EnumerateFiles(assetsRoot, "*.meta", SearchOption.AllDirectories))
        {
            string guid = null;
            foreach (var line in File.ReadLines(metaPath).Take(8))
            {
                if (!line.StartsWith("guid: ")) continue;
                guid = line.Substring(6).Trim();
                break;
            }
            if (guid == null) continue;
            var assetPath = metaPath.Substring(0, metaPath.Length - 5);
            if (File.Exists(assetPath)) index[guid] = assetPath;
        }
        GuidIndexes[assetsRoot] = index;
        return index;
    }

    static void CopyFileAndMeta(string sourcePath, string targetAssetPath, HashSet<string> copied)
    {
        if (!copied.Add(sourcePath)) return;
        Directory.CreateDirectory(Path.GetDirectoryName(targetAssetPath));
        File.Copy(sourcePath, targetAssetPath, true);
        var metaPath = sourcePath + ".meta";
        if (File.Exists(metaPath)) File.Copy(metaPath, targetAssetPath + ".meta", true);
    }

    static string FindAssetsRoot(string sourcePath)
    {
        var directory = new DirectoryInfo(Path.GetDirectoryName(sourcePath));
        while (directory != null)
        {
            if (directory.Name.Equals("Assets", StringComparison.OrdinalIgnoreCase))
                return directory.FullName;
            directory = directory.Parent;
        }
        return null;
    }

    static string NormalizeAssetPath(string path)
    {
        return path.Replace('\\', '/');
    }

    static string GetArg(string[] args, string name)
    {
        for (var index = 0; index < args.Length - 1; index++) if (args[index] == name) return args[index + 1];
        return null;
    }
}
