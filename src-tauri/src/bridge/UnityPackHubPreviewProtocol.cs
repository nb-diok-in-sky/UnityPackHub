using System;

[Serializable]
public sealed class UnityPackHubPreviewRequestList { public UnityPackHubPreviewRequest[] items; }

[Serializable]
public sealed class UnityPackHubPreviewRequest
{
    public string pathname;
    public string filename;
    public string outputFile;
    [NonSerialized] public string assetPath;
}

public struct UnityPackHubPreviewEntry
{
    public string path, name, type, preview, renderType;
}

public sealed class UnityPackHubRenderJob
{
    public string packageName;
    public System.Collections.Generic.List<string> assetPaths;
}
