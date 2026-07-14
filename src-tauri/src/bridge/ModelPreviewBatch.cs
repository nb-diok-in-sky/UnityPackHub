using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using System;
using System.IO;

public static class ModelPreviewBatch
{
    const int RenderSize = 512;

    [Serializable] class JobList { public ModelJob[] jobs; }
    [Serializable] class ModelJob { public string assetId; public string sourcePath; public string outputPath; public string resultPath; }
    [Serializable] class ModelResult { public string assetId; public string imagePath; public bool success; public string error; }

    public static void Run()
    {
        var args = Environment.GetCommandLineArgs();
        var jobsPath = GetArg(args, "-uphJobs");
        if (string.IsNullOrEmpty(jobsPath) || !File.Exists(jobsPath))
            throw new Exception("UnityPackHub model preview job file is missing.");

        var list = JsonUtility.FromJson<JobList>(File.ReadAllText(jobsPath));
        foreach (var job in list.jobs ?? Array.Empty<ModelJob>()) Process(job);
        EditorApplication.Exit(0);
    }

    static void Process(ModelJob job)
    {
        var result = new ModelResult { assetId = job.assetId, imagePath = job.outputPath, success = false, error = "" };
        string importedPath = "Assets/ModelInput/" + Path.GetFileName(job.sourcePath);
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(importedPath));
            File.Copy(job.sourcePath, importedPath, true);
            AssetDatabase.ImportAsset(importedPath, ImportAssetOptions.ForceSynchronousImport | ImportAssetOptions.ForceUpdate);
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(importedPath);
            if (model == null) throw new Exception("Unity cannot import this model format.");
            Directory.CreateDirectory(Path.GetDirectoryName(job.outputPath));
            if (!Render(model, job.outputPath)) throw new Exception("No renderable mesh was found.");
            result.success = true;
        }
        catch (Exception error) { result.error = error.Message; }
        finally
        {
            AssetDatabase.DeleteAsset(importedPath);
            File.WriteAllText(job.resultPath + ".tmp", JsonUtility.ToJson(result));
            if (File.Exists(job.resultPath)) File.Delete(job.resultPath);
            File.Move(job.resultPath + ".tmp", job.resultPath);
        }
    }

    static bool Render(GameObject source, string outputPath)
    {
        var scene = EditorSceneManager.NewPreviewScene();
        GameObject instance = null;
        try
        {
            instance = UnityEngine.Object.Instantiate(source);
            SceneManager.MoveGameObjectToScene(instance, scene);
            instance.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
            var renderers = instance.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return false;
            var bounds = renderers[0].bounds;
            for (var index = 1; index < renderers.Length; index++) bounds.Encapsulate(renderers[index].bounds);

            var cameraObject = new GameObject("Preview Camera", typeof(Camera));
            SceneManager.MoveGameObjectToScene(cameraObject, scene);
            var camera = cameraObject.GetComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.85f, 0.85f, 0.85f, 1f);
            camera.fieldOfView = 30f;
            camera.nearClipPlane = 0.01f;
            camera.farClipPlane = 10000f;
            var extent = Mathf.Max(bounds.extents.magnitude, 0.01f);
            var distance = extent * 1.25f / Mathf.Tan(camera.fieldOfView * 0.5f * Mathf.Deg2Rad);
            camera.transform.position = bounds.center + new Vector3(1f, 0.65f, 1f).normalized * distance;
            camera.transform.LookAt(bounds.center);

            AddLight(scene, new Vector3(50f, -30f, 0f), 1.1f, new Color(1f, 0.98f, 0.95f));
            AddLight(scene, new Vector3(-15f, 150f, 0f), 0.35f, new Color(0.75f, 0.85f, 1f));

            var target = new RenderTexture(RenderSize, RenderSize, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = target;
            camera.Render();
            var previous = RenderTexture.active;
            RenderTexture.active = target;
            var texture = new Texture2D(RenderSize, RenderSize, TextureFormat.RGBA32, false);
            texture.ReadPixels(new Rect(0, 0, RenderSize, RenderSize), 0, 0);
            texture.Apply();
            File.WriteAllBytes(outputPath + ".tmp", texture.EncodeToPNG());
            if (File.Exists(outputPath)) File.Delete(outputPath);
            File.Move(outputPath + ".tmp", outputPath);
            RenderTexture.active = previous;
            UnityEngine.Object.DestroyImmediate(texture);
            UnityEngine.Object.DestroyImmediate(target);
            return true;
        }
        finally
        {
            if (instance != null) UnityEngine.Object.DestroyImmediate(instance);
            EditorSceneManager.ClosePreviewScene(scene);
        }
    }

    static void AddLight(Scene scene, Vector3 rotation, float intensity, Color color)
    {
        var lightObject = new GameObject("Preview Light", typeof(Light));
        SceneManager.MoveGameObjectToScene(lightObject, scene);
        var light = lightObject.GetComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = intensity;
        light.color = color;
        light.transform.rotation = Quaternion.Euler(rotation);
    }

    static string GetArg(string[] args, string name)
    {
        for (var index = 0; index < args.Length - 1; index++) if (args[index] == name) return args[index + 1];
        return null;
    }
}
