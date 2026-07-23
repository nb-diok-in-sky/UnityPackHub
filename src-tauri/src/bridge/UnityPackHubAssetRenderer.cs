using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using System;
using System.IO;

public static class UnityPackHubAssetRenderer
{
    const int Size = 512;

    public static UnityPackHubPreviewEntry? Capture(string assetPath, string outputDirectory, string outputFile)
    {
        var asset = AssetDatabase.LoadAssetAtPath<GameObject>(assetPath);
        if (asset == null)
        {
            var fallback = AssetDatabase.LoadAssetAtPath<UnityEngine.Object>(assetPath);
            if (fallback == null || !CaptureThumbnail(fallback, Path.Combine(outputDirectory, outputFile))) return null;
            return UnityPackHubPreviewManifest.Entry(assetPath, outputFile, "thumbnail", fallback.name, fallback.GetType().Name);
        }

        var outputPath = Path.Combine(outputDirectory, outputFile);
        var rendered = RenderModel(asset, outputPath);
        if (!rendered && !CaptureThumbnail(asset, outputPath)) return null;
        return UnityPackHubPreviewManifest.Entry(assetPath, outputFile, rendered ? "rendered" : "thumbnail", asset.name);
    }

    static bool RenderModel(GameObject prefab, string outputPath)
    {
        Scene scene = default;
        GameObject instance = null;
        try
        {
            scene = EditorSceneManager.NewPreviewScene();
            instance = PrefabUtility.InstantiatePrefab(prefab, scene) as GameObject ?? UnityEngine.Object.Instantiate(prefab);
            if (instance.scene != scene) SceneManager.MoveGameObjectToScene(instance, scene);
            instance.transform.SetPositionAndRotation(Vector3.zero, Quaternion.identity);
            var renderers = instance.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return false;

            var bounds = renderers[0].bounds;
            for (var index = 1; index < renderers.Length; index++) bounds.Encapsulate(renderers[index].bounds);
            var cameraObject = CreateObject("Preview Camera", scene, typeof(Camera));
            var camera = cameraObject.GetComponent<Camera>();
            camera.cameraType = CameraType.Preview;
            camera.scene = scene;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(.85f, .85f, .85f, 1f);
            camera.nearClipPlane = .01f;
            camera.farClipPlane = 5000f;
            camera.fieldOfView = 30f;
            var extent = Math.Max(bounds.extents.magnitude, 1f);
            var distance = extent * 1.2f / Mathf.Tan(camera.fieldOfView * .5f * Mathf.Deg2Rad);
            camera.transform.position = bounds.center + new Vector3(1f, .6f, 1f).normalized * distance;
            camera.transform.LookAt(bounds.center);

            CreateLight(scene, "Key Light", 1.1f, new Color(1f, .98f, .95f), new Vector3(50f, -30f));
            CreateLight(scene, "Fill Light", .35f, new Color(.75f, .85f, 1f), new Vector3(-15f, 150f));
            var texture = new RenderTexture(Size, Size, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
            camera.targetTexture = texture;
            camera.Render();
            WriteTexture(texture, outputPath);
            camera.targetTexture = null;
            UnityEngine.Object.DestroyImmediate(texture);
            return true;
        }
        catch (Exception error)
        {
            Debug.LogWarning($"[UnityPackHub] Render failed for {AssetDatabase.GetAssetPath(prefab)}: {error.Message}");
            return false;
        }
        finally
        {
            if (instance != null) UnityEngine.Object.DestroyImmediate(instance);
            if (scene.IsValid()) EditorSceneManager.ClosePreviewScene(scene);
        }
    }

    static bool CaptureThumbnail(UnityEngine.Object asset, string outputPath)
    {
        var preview = AssetPreview.GetAssetPreview(asset) ?? AssetPreview.GetMiniThumbnail(asset);
        if (preview == null) return false;
        try
        {
            var texture = RenderTexture.GetTemporary(preview.width, preview.height);
            Graphics.Blit(preview, texture);
            WriteTexture(texture, outputPath);
            RenderTexture.ReleaseTemporary(texture);
            return true;
        }
        catch (Exception error) { Debug.LogWarning($"[UnityPackHub] Thumbnail failed: {error.Message}"); return false; }
    }

    static void WriteTexture(RenderTexture source, string outputPath)
    {
        var previous = RenderTexture.active;
        RenderTexture.active = source;
        var image = new Texture2D(source.width, source.height, TextureFormat.RGBA32, false);
        image.ReadPixels(new Rect(0, 0, source.width, source.height), 0, 0);
        image.Apply();
        RenderTexture.active = previous;
        File.WriteAllBytes(outputPath, image.EncodeToPNG());
        UnityEngine.Object.DestroyImmediate(image);
    }

    static GameObject CreateObject(string name, Scene scene, params Type[] components)
    {
        var value = EditorUtility.CreateGameObjectWithHideFlags(name, HideFlags.HideAndDontSave, components);
        SceneManager.MoveGameObjectToScene(value, scene);
        return value;
    }

    static void CreateLight(Scene scene, string name, float intensity, Color color, Vector3 rotation)
    {
        var value = CreateObject(name, scene, typeof(Light));
        var light = value.GetComponent<Light>();
        light.type = LightType.Directional;
        light.intensity = intensity;
        light.color = color;
        light.transform.rotation = Quaternion.Euler(rotation);
    }
}
