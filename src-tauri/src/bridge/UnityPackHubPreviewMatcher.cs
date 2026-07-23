using System;
using System.IO;
using System.Linq;

public static class UnityPackHubPreviewMatcher
{
    static string Normalize(string value) => (value ?? "").Replace('\\', '/').TrimStart('/');

    public static string Match(UnityPackHubPreviewRequest request, string[] candidates)
    {
        var expected = Normalize(request.pathname);
        var exact = candidates.Where(path => Normalize(path).EndsWith(expected, StringComparison.OrdinalIgnoreCase)).ToArray();
        if (exact.Length == 1) return exact[0];
        var fileMatches = candidates.Where(path => string.Equals(Path.GetFileName(path), request.filename, StringComparison.OrdinalIgnoreCase)).ToArray();
        return fileMatches.Length == 1 ? fileMatches[0] : null;
    }
}
