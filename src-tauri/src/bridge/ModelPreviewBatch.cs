using UnityEditor;
using UnityEngine;
using System;
using System.IO;

public static class ModelPreviewBatch
{
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
        string importedPath = ModelDependencyCopier.Copy(job.sourcePath, importDirectory);
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

    static string GetArg(string[] args, string name)
    {
        for (var index = 0; index < args.Length - 1; index++) if (args[index] == name) return args[index + 1];
        return null;
    }
}
