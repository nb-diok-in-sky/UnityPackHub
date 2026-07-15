using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using System;
using System.IO;

public static class UnityPackHubPreviewRenderer
{
    const int RenderSize = 512;
    public static string LastError { get; private set; }

    public static bool Render(GameObject source, string outputPath)
    {
        LastError = "";
        Scene scene = default;
        GameObject instance = null;
        try
        {
            scene = EditorSceneManager.NewPreviewScene();
            instance = Instantiate(source, scene);
            PreviewMaterialSystem.Apply(instance);

            var bounds = CalculateBounds(instance);
            var camera = CreateCamera(scene, bounds);
            ConfigureLighting(scene);
            WriteImage(camera, outputPath);
            return true;
        }
        catch (Exception error)
        {
            LastError = error.Message;
            Debug.LogWarning($"[UnityPackHub] Preview render failed: {error.Message}");
            return false;
        }
        finally
        {
            if (instance != null) UnityEngine.Object.DestroyImmediate(instance);
            if (scene.IsValid()) EditorSceneManager.ClosePreviewScene(scene);
        }
    }

    static GameObject Instantiate(GameObject source, Scene scene)
    {
        var instance = PrefabUtility.InstantiatePrefab(source, scene) as GameObject;
        if (instance == null)
        {
            instance = UnityEngine.Object.Instantiate(source);
            SceneManager.MoveGameObjectToScene(instance, scene);
        }
        instance.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
        return instance;
    }

    static Bounds CalculateBounds(GameObject instance)
    {
        var renderers = instance.GetComponentsInChildren<Renderer>();
        if (renderers.Length == 0) throw new Exception("No renderable mesh was found.");
        var bounds = renderers[0].bounds;
        for (var index = 1; index < renderers.Length; index++) bounds.Encapsulate(renderers[index].bounds);
        return bounds;
    }

    static Camera CreateCamera(Scene scene, Bounds bounds)
    {
        var cameraObject = EditorUtility.CreateGameObjectWithHideFlags("Preview Camera", HideFlags.HideAndDontSave, typeof(Camera));
        SceneManager.MoveGameObjectToScene(cameraObject, scene);
        var camera = cameraObject.GetComponent<Camera>();
        camera.cameraType = CameraType.Preview;
        camera.scene = scene;
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(0.08f, 0.09f, 0.11f, 0f);
        camera.fieldOfView = 30f;
        var extent = Mathf.Max(bounds.extents.magnitude, 0.01f);
        var distance = extent * 1.35f / Mathf.Tan(camera.fieldOfView * 0.5f * Mathf.Deg2Rad);
        camera.nearClipPlane = Mathf.Max(0.001f, distance - extent * 2.5f);
        camera.farClipPlane = distance + extent * 4f;
        camera.transform.position = bounds.center + new Vector3(1f, 0.65f, 1f).normalized * distance;
        camera.transform.LookAt(bounds.center);
        return camera;
    }

    static void ConfigureLighting(Scene scene)
    {
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
        RenderSettings.ambientSkyColor = new Color(0.55f, 0.58f, 0.65f);
        RenderSettings.ambientEquatorColor = new Color(0.32f, 0.34f, 0.38f);
        RenderSettings.ambientGroundColor = new Color(0.12f, 0.13f, 0.15f);
        RenderSettings.ambientIntensity = 1f;
        AddLight(scene, "Key Light", new Vector3(45f, -35f, 0f), 1.25f, new Color(1f, 0.95f, 0.88f));
        AddLight(scene, "Fill Light", new Vector3(-20f, 145f, 0f), 0.55f, new Color(0.68f, 0.8f, 1f));
        AddLight(scene, "Rim Light", new Vector3(15f, 210f, 0f), 0.45f, new Color(0.9f, 0.95f, 1f));
    }

    static void WriteImage(Camera camera, string outputPath)
    {
        var target = new RenderTexture(RenderSize, RenderSize, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
        target.Create();
        camera.targetTexture = target;
        camera.Render();
        var previous = RenderTexture.active;
        RenderTexture.active = target;
        var image = new Texture2D(RenderSize, RenderSize, TextureFormat.RGBA32, false, false);
        image.ReadPixels(new Rect(0, 0, RenderSize, RenderSize), 0, 0);
        image.Apply();
        RenderTexture.active = previous;
        if (IsShaderError(image)) throw new Exception("Material shader could not be adapted.");
        Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
        File.WriteAllBytes(outputPath + ".tmp", image.EncodeToPNG());
        if (File.Exists(outputPath)) File.Delete(outputPath);
        File.Move(outputPath + ".tmp", outputPath);
        camera.targetTexture = null;
        UnityEngine.Object.DestroyImmediate(image);
        UnityEngine.Object.DestroyImmediate(target);
    }

    static bool IsShaderError(Texture2D image)
    {
        var magenta = 0; var visible = 0;
        foreach (var pixel in image.GetPixels32()) { if (pixel.a < 16) continue; visible++; if (pixel.r > 220 && pixel.b > 220 && pixel.g < 40) magenta++; }
        return visible > 0 && magenta > visible * .2f;
    }

    static void AddLight(Scene scene, string name, Vector3 rotation, float intensity, Color color)
    {
        var value = EditorUtility.CreateGameObjectWithHideFlags(name, HideFlags.HideAndDontSave, typeof(Light));
        SceneManager.MoveGameObjectToScene(value, scene);
        var light = value.GetComponent<Light>();
        light.type = LightType.Directional; light.intensity = intensity; light.color = color; light.shadows = LightShadows.Soft;
        light.transform.rotation = Quaternion.Euler(rotation);
    }
}
