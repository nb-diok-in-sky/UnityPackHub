using System.Collections.Generic;
using System.IO;
using System.Text;

public static class UnityPackHubPreviewManifest
{
    public static UnityPackHubPreviewEntry Entry(string assetPath, string preview, string renderType, string name = null, string type = "GameObject")
    {
        return new UnityPackHubPreviewEntry {
            path = assetPath, name = name ?? Path.GetFileNameWithoutExtension(assetPath),
            type = type, preview = preview, renderType = renderType
        };
    }

    public static void Write(string directory, IReadOnlyList<UnityPackHubPreviewEntry> entries)
    {
        var json = new StringBuilder("[\n");
        for (var index = 0; index < entries.Count; index++)
        {
            var item = entries[index];
            json.Append("  {")
                .Append($"\"path\":\"{Escape(item.path)}\",")
                .Append($"\"name\":\"{Escape(item.name)}\",")
                .Append($"\"type\":\"{Escape(item.type)}\",")
                .Append($"\"preview\":\"{Escape(item.preview)}\",")
                .Append($"\"renderType\":\"{Escape(item.renderType)}\"")
                .Append(index < entries.Count - 1 ? "},\n" : "}\n");
        }
        json.Append("]\n");
        File.WriteAllText(Path.Combine(directory, "manifest.json"), json.ToString(), Encoding.UTF8);
    }

    static string Escape(string value) => (value ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");
}
