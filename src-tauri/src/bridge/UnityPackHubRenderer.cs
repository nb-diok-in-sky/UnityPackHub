// Offscreen renderer shared by the in-project bridge (package previews) and the headless
// preview project (model covers). Everything happens in an isolated preview scene.
using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace UnityPackHub
{
    public sealed class RenderOptions
    {
        public Color background;
        /// Only the headless preview project may change RenderSettings: in the user's project
        /// that would rewrite the lighting of the currently open scene.
        public bool overrideAmbient;
        /// Fail the render when most of the model is Unity's magenta "missing shader" colour.
        public bool rejectShaderErrors;
        /// Runs on the instance before rendering, e.g. to swap in previewable materials.
        public Action<GameObject> prepare;
        /// Scales the three-light rig. The user's project adds its own ambient light, so
        /// package previews need less direct light to keep light materials from clipping to white.
        public float lightIntensity = 1f;

        public static RenderOptions PackagePreview() => new RenderOptions { background = new Color(.85f, .85f, .85f, 1f), lightIntensity = .6f };

        public static RenderOptions ModelCover(Action<GameObject> prepare) => new RenderOptions
        {
            background = new Color(.08f, .09f, .11f, 0f),
            overrideAmbient = true,
            rejectShaderErrors = true,
            prepare = prepare,
        };
    }

    public static class UnityPackHubRenderer
    {
        const int Size = 512;

        public static string LastError { get; private set; } = "";

        public static bool RenderModel(GameObject source, string outputPath, RenderOptions options)
        {
            LastError = "";
            Scene scene = default;
            GameObject instance = null;
            RenderTexture target = null;
            try
            {
                scene = EditorSceneManager.NewPreviewScene();
                instance = Instantiate(source, scene);
                options.prepare?.Invoke(instance);

                var camera = CreateCamera(scene, CalculateBounds(instance), options.background);
                AddLights(scene, options);
                target = new RenderTexture(Size, Size, 24, RenderTextureFormat.ARGB32) { antiAliasing = 4 };
                target.Create();
                camera.targetTexture = target;
                camera.Render();
                camera.targetTexture = null;

                var image = ReadPixels(target);
                try
                {
                    if (options.rejectShaderErrors && IsShaderError(image)) throw new Exception("Material shader could not be adapted.");
                    WritePng(image, outputPath);
                }
                finally { UnityEngine.Object.DestroyImmediate(image); }
                return true;
            }
            catch (Exception error)
            {
                LastError = error.Message;
                Debug.LogWarning($"[UnityPackHub] Render failed for {AssetDatabase.GetAssetPath(source)}: {error.Message}");
                return false;
            }
            finally
            {
                if (target != null) UnityEngine.Object.DestroyImmediate(target);
                if (instance != null) UnityEngine.Object.DestroyImmediate(instance);
                if (scene.IsValid()) EditorSceneManager.ClosePreviewScene(scene);
            }
        }

        /// Falls back to Unity's own asset preview for assets without renderers.
        public static bool CaptureThumbnail(UnityEngine.Object asset, string outputPath)
        {
            var preview = AssetPreview.GetAssetPreview(asset) ?? AssetPreview.GetMiniThumbnail(asset);
            if (preview == null) return false;
            var texture = RenderTexture.GetTemporary(preview.width, preview.height);
            try
            {
                Graphics.Blit(preview, texture);
                var image = ReadPixels(texture);
                try { WritePng(image, outputPath); }
                finally { UnityEngine.Object.DestroyImmediate(image); }
                return true;
            }
            catch (Exception error) { Debug.LogWarning($"[UnityPackHub] Thumbnail failed: {error.Message}"); return false; }
            finally { RenderTexture.ReleaseTemporary(texture); }
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

        static Camera CreateCamera(Scene scene, Bounds bounds, Color background)
        {
            var camera = CreateInScene(scene, "Preview Camera", typeof(Camera)).GetComponent<Camera>();
            camera.cameraType = CameraType.Preview;
            camera.scene = scene;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = background;
            camera.fieldOfView = 30f;
            var extent = Mathf.Max(bounds.extents.magnitude, 0.01f);
            var distance = extent * 1.35f / Mathf.Tan(camera.fieldOfView * 0.5f * Mathf.Deg2Rad);
            camera.nearClipPlane = Mathf.Max(0.001f, distance - extent * 2.5f);
            camera.farClipPlane = distance + extent * 4f;
            camera.transform.position = bounds.center + new Vector3(1f, 0.65f, 1f).normalized * distance;
            camera.transform.LookAt(bounds.center);
            return camera;
        }

        static void AddLights(Scene scene, RenderOptions options)
        {
            if (options.overrideAmbient)
            {
                RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
                RenderSettings.ambientSkyColor = new Color(0.55f, 0.58f, 0.65f);
                RenderSettings.ambientEquatorColor = new Color(0.32f, 0.34f, 0.38f);
                RenderSettings.ambientGroundColor = new Color(0.12f, 0.13f, 0.15f);
                RenderSettings.ambientIntensity = 1f;
            }
            var scale = options.lightIntensity;
            AddLight(scene, "Key Light", new Vector3(45f, -35f, 0f), 1.25f * scale, new Color(1f, 0.95f, 0.88f));
            AddLight(scene, "Fill Light", new Vector3(-20f, 145f, 0f), 0.55f * scale, new Color(0.68f, 0.8f, 1f));
            AddLight(scene, "Rim Light", new Vector3(15f, 210f, 0f), 0.45f * scale, new Color(0.9f, 0.95f, 1f));
        }

        static void AddLight(Scene scene, string name, Vector3 rotation, float intensity, Color color)
        {
            var light = CreateInScene(scene, name, typeof(Light)).GetComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = intensity;
            light.color = color;
            light.shadows = LightShadows.Soft;
            light.transform.rotation = Quaternion.Euler(rotation);
        }

        static GameObject CreateInScene(Scene scene, string name, Type component)
        {
            var value = EditorUtility.CreateGameObjectWithHideFlags(name, HideFlags.HideAndDontSave, component);
            SceneManager.MoveGameObjectToScene(value, scene);
            return value;
        }

        static Texture2D ReadPixels(RenderTexture source)
        {
            var previous = RenderTexture.active;
            RenderTexture.active = source;
            var image = new Texture2D(source.width, source.height, TextureFormat.RGBA32, false);
            image.ReadPixels(new Rect(0, 0, source.width, source.height), 0, 0);
            image.Apply();
            RenderTexture.active = previous;
            return image;
        }

        static void WritePng(Texture2D image, string outputPath)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
            var temporary = outputPath + ".tmp";
            File.WriteAllBytes(temporary, image.EncodeToPNG());
            if (File.Exists(outputPath)) File.Delete(outputPath);
            File.Move(temporary, outputPath);
        }

        static bool IsShaderError(Texture2D image)
        {
            var magenta = 0;
            var visible = 0;
            foreach (var pixel in image.GetPixels32())
            {
                if (pixel.a < 16) continue;
                visible++;
                if (pixel.r > 220 && pixel.b > 220 && pixel.g < 40) magenta++;
            }
            return visible > 0 && magenta > visible * .2f;
        }
    }
}
