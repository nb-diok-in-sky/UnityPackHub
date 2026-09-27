// Entry point of the headless preview project:
//   Unity.exe -batchmode -quit -executeMethod UnityPackHub.ModelPreviewBatch.Run -uphJobs <jobs.json> ...
// Each job copies one model (plus the textures/materials it references) into the project,
// renders it and writes one result file. A failing job never stops the rest of the batch.
using System;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace UnityPackHub
{
    public static class ModelPreviewBatch
    {
        public static void Run()
        {
            var args = Environment.GetCommandLineArgs();
            var jobsPath = GetArg(args, "-uphJobs");
            var jobs = UnityPackHubProtocol.ReadJson<ModelPreviewJobFile>(jobsPath ?? "");
            if (jobs == null) throw new Exception("UnityPackHub model preview job file is missing or unreadable.");

            PreviewMaterialSystem.LoadRules(GetArg(args, "-uphShaderRules"));
            foreach (var job in jobs.jobs ?? Array.Empty<ModelPreviewJob>())
            {
                try { Process(job); }
                catch (Exception error) { Debug.LogError($"[UnityPackHub] Preview job {job.assetId} crashed: {error}"); }
            }
            EditorApplication.Exit(0);
        }

        static void Process(ModelPreviewJob job)
        {
            var result = new ModelPreviewResult { assetId = job.assetId, imagePath = job.outputPath, success = false, error = "" };
            var importDirectory = "Assets/ModelInput/" + job.assetId;
            try
            {
                var importedPath = ModelDependencyCopier.Copy(job.sourcePath, importDirectory);
                AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
                MakeImportedTexturesReadable(importDirectory);
                var model = AssetDatabase.LoadAssetAtPath<GameObject>(importedPath);
                if (model == null) throw new Exception("Unity cannot import this model format.");
                if (!UnityPackHubRenderer.RenderModel(model, job.outputPath, RenderOptions.ModelCover(PreviewMaterialSystem.Apply)))
                    throw new Exception(string.IsNullOrEmpty(UnityPackHubRenderer.LastError) ? "No renderable mesh was found." : UnityPackHubRenderer.LastError);
                result.success = true;
            }
            catch (Exception error) { result.error = error.Message; }
            finally
            {
                try
                {
                    AssetDatabase.DeleteAsset(importDirectory);
                    if (Directory.Exists(importDirectory)) Directory.Delete(importDirectory, true);
                }
                catch (Exception error) { Debug.LogWarning($"[UnityPackHub] Could not clean {importDirectory}: {error.Message}"); }
                UnityPackHubProtocol.WriteJson(job.resultPath, result);
            }
        }

        static void MakeImportedTexturesReadable(string importDirectory)
        {
            foreach (var guid in AssetDatabase.FindAssets("t:Texture2D", new[] { importDirectory }))
            {
                var importer = AssetImporter.GetAtPath(AssetDatabase.GUIDToAssetPath(guid)) as TextureImporter;
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
}
