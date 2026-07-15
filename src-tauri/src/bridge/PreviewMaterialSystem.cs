using UnityEditor;
using UnityEngine;
using System;
using System.IO;
using System.Collections.Generic;
using System.Text.RegularExpressions;

public static class PreviewMaterialSystem
{
    [Serializable] class RuleSet { public ShaderRule[] rules; }
    [Serializable] class ShaderRule
    {
        public string shader;
        public string[] baseMap;
        public string[] baseColor;
        public string[] normalMap;
        public string[] emissionMap;
        public string alphaCutoff;
        public string surface;
        public bool doubleSided;
    }

    interface IShaderAdapterStrategy { ShaderRule Match(Material material); }

    sealed class JsonRuleStrategy : IShaderAdapterStrategy
    {
        readonly ShaderRule[] rules;
        public JsonRuleStrategy(ShaderRule[] rules) { this.rules = rules ?? Array.Empty<ShaderRule>(); }
        public ShaderRule Match(Material material)
        {
            var shaderName = material != null && material.shader != null ? material.shader.name : "";
            foreach (var rule in rules)
                if (rule != null && !string.IsNullOrEmpty(rule.shader)
                    && shaderName.IndexOf(rule.shader, StringComparison.OrdinalIgnoreCase) >= 0) return rule;
            return null;
        }
    }

    static readonly Dictionary<string, string> YamlByMaterialName = new Dictionary<string, string>();
    static IShaderAdapterStrategy adapterStrategy = new JsonRuleStrategy(Array.Empty<ShaderRule>());

    public static void LoadRules(string path)
    {
        if (string.IsNullOrEmpty(path) || !File.Exists(path))
        {
            adapterStrategy = new JsonRuleStrategy(Array.Empty<ShaderRule>());
            return;
        }
        try
        {
            var set = JsonUtility.FromJson<RuleSet>(File.ReadAllText(path));
            adapterStrategy = new JsonRuleStrategy(set != null ? set.rules : null);
        }
        catch (Exception error) { Debug.LogWarning($"[UnityPackHub] Shader rules ignored: {error.Message}"); }
    }

    public static void RegisterMaterial(string path)
    {
        if (string.IsNullOrEmpty(path) || !File.Exists(path)) return;
        try
        {
            var yaml = File.ReadAllText(path);
            var name = Regex.Match(yaml, @"(?m)^\s*m_Name:\s*(.+?)\s*$");
            if (name.Success) YamlByMaterialName[name.Groups[1].Value.Trim()] = yaml;
        }
        catch { }
    }

    public static void Apply(GameObject instance)
    {
        var shader = Shader.Find("Standard") ?? Shader.Find("Universal Render Pipeline/Lit");
        if (shader == null) return;
        foreach (var renderer in instance.GetComponentsInChildren<Renderer>(true))
        {
            var materials = renderer.sharedMaterials;
            for (var index = 0; index < materials.Length; index++)
                materials[index] = CreatePreviewMaterial(materials[index], shader);
            renderer.sharedMaterials = materials;
        }
    }

    static Material CreatePreviewMaterial(Material source, Shader shader)
    {
        if (source == null) return null;
        var rule = adapterStrategy.Match(source);
        var preview = new Material(shader) { name = source.name + " (Preview)", hideFlags = HideFlags.HideAndDontSave };
        var baseMap = FindTexture(source, rule != null ? rule.baseMap : null) ?? FindBaseMap(source, rule);
        SetTexture(preview, baseMap, "_MainTex", "_BaseMap");
        var color = FindColor(source, rule);
        SetColor(preview, color, "_Color", "_BaseColor");
        ApplyOptionalMaps(preview, source, rule);
        ConfigureSurface(preview, baseMap, source, rule);
        return preview;
    }

    static void ApplyOptionalMaps(Material preview, Material source, ShaderRule rule)
    {
        var normal = FindTexture(source, rule != null ? rule.normalMap : null) ?? FindTexture(source, new[] { "_BumpMap", "_NormalMap", "_NormalTex" });
        if (normal != null && preview.HasProperty("_BumpMap")) { preview.SetTexture("_BumpMap", normal); preview.EnableKeyword("_NORMALMAP"); }
        var emission = FindTexture(source, rule != null ? rule.emissionMap : null) ?? FindTexture(source, new[] { "_EmissionMap", "_EmissionTex" });
        if (emission != null && preview.HasProperty("_EmissionMap"))
        {
            preview.SetTexture("_EmissionMap", emission);
            preview.SetColor("_EmissionColor", source.HasProperty("_EmissionColor") ? source.GetColor("_EmissionColor") : Color.white);
            preview.EnableKeyword("_EMISSION");
        }
    }

    static void ConfigureSurface(Material preview, Texture texture, Material source, ShaderRule rule)
    {
        var yaml = ReadYaml(source);
        var alpha = AnalyzeAlpha(texture as Texture2D);
        var cutoffName = rule != null && !string.IsNullOrEmpty(rule.alphaCutoff) ? rule.alphaCutoff : "_Cutoff";
        var cutout = rule != null && rule.surface == "cutout" || Enabled(yaml, "_AlphaClip") || Enabled(yaml, "_UseAlphaClipping") || yaml.Contains("_ALPHATEST_ON") || alpha.Item1;
        var transparent = rule != null && rule.surface == "transparent" || ReadFloat(yaml, "_Surface", 0) > .5f || alpha.Item2;
        if (cutout)
        {
            preview.SetFloat("_Mode", 1); preview.SetFloat("_Cutoff", Mathf.Clamp01(ReadFloat(yaml, cutoffName, .5f)));
            preview.SetOverrideTag("RenderType", "TransparentCutout"); preview.EnableKeyword("_ALPHATEST_ON");
            preview.renderQueue = (int)UnityEngine.Rendering.RenderQueue.AlphaTest;
        }
        else if (transparent)
        {
            preview.SetFloat("_Mode", 3); preview.SetOverrideTag("RenderType", "Transparent");
            preview.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            preview.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            preview.SetInt("_ZWrite", 0); preview.EnableKeyword("_ALPHABLEND_ON");
            preview.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
        }
        if ((rule == null || rule.doubleSided || cutout) && preview.HasProperty("_Cull")) preview.SetInt("_Cull", 0);
    }

    static Texture FindBaseMap(Material material, ShaderRule rule)
    {
        var texture = FindTexture(material, new[] { "_BaseMap", "_MainTex", "_BaseColorMap", "_BaseTex", "_AlbedoMap", "_DiffuseMap", "_ColorMap" });
        if (texture != null) return texture;
        try
        {
            foreach (var property in material.GetTexturePropertyNames())
            {
                var name = property.ToLowerInvariant();
                if (!IsAuxiliary(name) && (name.Contains("base") || name.Contains("main") || name.Contains("albedo") || name.Contains("diffuse") || name.Contains("color")))
                    if (material.GetTexture(property) != null) return material.GetTexture(property);
            }
        }
        catch { }
        return FindTextureInYaml(material, rule);
    }

    static Texture FindTextureInYaml(Material material, ShaderRule rule)
    {
        var yaml = ReadYaml(material);
        foreach (Match match in Regex.Matches(yaml, @"-\s+([^:]+):\s*\r?\n\s*m_Texture:\s*\{fileID:\s*\d+,\s*guid:\s*([0-9a-fA-F]{32})"))
        {
            var name = match.Groups[1].Value.Trim().ToLowerInvariant();
            if (IsAuxiliary(name)) continue;
            var path = AssetDatabase.GUIDToAssetPath(match.Groups[2].Value);
            var texture = string.IsNullOrEmpty(path) ? null : AssetDatabase.LoadAssetAtPath<Texture>(path);
            if (texture != null && (name.Contains("base") || name.Contains("main") || name.Contains("albedo") || name.Contains("diffuse") || name.Contains("color"))) return texture;
        }
        return null;
    }

    static Texture FindTexture(Material material, string[] names)
    {
        if (material == null || names == null) return null;
        foreach (var name in names) if (!string.IsNullOrEmpty(name) && material.HasProperty(name) && material.GetTexture(name) != null) return material.GetTexture(name);
        return null;
    }

    static Color FindColor(Material material, ShaderRule rule)
    {
        var names = rule != null && rule.baseColor != null ? rule.baseColor : new[] { "_BaseColor", "_MainColor", "_TintColor", "_Color" };
        foreach (var name in names) if (material.HasProperty(name)) return material.GetColor(name);
        return Color.white;
    }

    static string ReadYaml(Material material)
    {
        try
        {
            var path = AssetDatabase.GetAssetPath(material);
            if (!string.IsNullOrEmpty(path) && File.Exists(path)) return File.ReadAllText(path);
            return material != null && YamlByMaterialName.TryGetValue(material.name, out var yaml) ? yaml : "";
        }
        catch { return ""; }
    }

    static Tuple<bool, bool> AnalyzeAlpha(Texture2D texture)
    {
        if (texture == null || !texture.isReadable) return Tuple.Create(false, false);
        try
        {
            var pixels = texture.GetPixels32(); var empty = 0; var partial = 0; var sampled = 0; var step = Math.Max(1, pixels.Length / 4096);
            for (var i = 0; i < pixels.Length; i += step) { sampled++; if (pixels[i].a < 16) empty++; else if (pixels[i].a < 240) partial++; }
            return Tuple.Create(empty > sampled * .02f && partial < sampled * .15f, partial >= sampled * .15f);
        }
        catch { return Tuple.Create(false, false); }
    }

    static float ReadFloat(string yaml, string property, float fallback)
    {
        var match = Regex.Match(yaml, @"-\s+" + Regex.Escape(property) + @":\s*([-+0-9.eE]+)");
        return match.Success && float.TryParse(match.Groups[1].Value, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var value) ? value : fallback;
    }
    static bool Enabled(string yaml, string property) => ReadFloat(yaml, property, 0) > .5f;
    static bool IsAuxiliary(string name) => name.Contains("normal") || name.Contains("bump") || name.Contains("mask") || name.Contains("metal") || name.Contains("rough") || name.Contains("smooth") || name.Contains("occlusion") || name.Contains("spec") || name.Contains("emission") || name.Contains("noise");
    static void SetTexture(Material material, Texture value, params string[] names) { if (value == null) return; foreach (var name in names) if (material.HasProperty(name)) material.SetTexture(name, value); }
    static void SetColor(Material material, Color value, params string[] names) { foreach (var name in names) if (material.HasProperty(name)) material.SetColor(name, value); }
}
