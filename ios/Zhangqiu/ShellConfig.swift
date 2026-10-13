import UIKit

/// Build-time and launch-time start URL, plus the offline page shared with Android.
enum ShellConfig {
    /// Same default as `android/app/build.gradle` (`ZQ_START_URL`).
    static let defaultStartURL = "https://tennis.47.93.203.28.sslip.io/e1"

    /// Launch environment, then the `-ZQStartURL` argument, then the Info.plist
    /// value baked in from the `ZQ_START_URL` build setting, then the default.
    static func resolveStartURL() -> String {
        let candidates = [
            ProcessInfo.processInfo.environment["ZQ_START_URL"],
            launchArgument("-ZQStartURL"),
            Bundle.main.object(forInfoDictionaryKey: "ZQStartURL") as? String,
            defaultStartURL,
        ]
        for candidate in candidates {
            if let url = normalize(candidate) {
                return url
            }
        }
        return defaultStartURL
    }

    static func normalize(_ raw: String?) -> String? {
        guard let trimmed = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }
        if !(trimmed.hasPrefix("http://") || trimmed.hasPrefix("https://")) {
            return nil
        }
        guard URL(string: trimmed) != nil else {
            return nil
        }
        return trimmed
    }

    private static func launchArgument(_ flag: String) -> String? {
        let args = ProcessInfo.processInfo.arguments
        guard let index = args.firstIndex(of: flag), index + 1 < args.count else {
            return nil
        }
        return args[index + 1]
    }

    /// Same copy and escaping as `MainActivity.errorHtml` on Android.
    static func errorHTML(retryURL: String) -> String {
        let retry = retryURL
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "<", with: "")
        return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/>"
            + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>"
            + "<style>body{margin:0;padding:32px 24px;background:#07140e;color:#eef6ee;"
            + "font-family:sans-serif;font-size:18px;line-height:1.5}"
            + "h1{font-size:28px}a{color:#d6e35a}</style></head><body>"
            + "<h1>涨球</h1>"
            + "<p>页面暂时打不开。请检查网络后重试。</p>"
            + "<p>The page could not be opened. Check the network and try again.</p>"
            + "<p><a href=\"" + retry + "\">重试 / Retry</a></p>"
            + "</body></html>"
    }

    /// The E1 page hides its file inputs with `clip`. iOS will not open the
    /// picker for a clipped input, so the shell relaxes that rule in-page.
    static let fileInputStyleScript = """
    (function () {
      var style = document.createElement("style");
      style.setAttribute("data-zq", "file");
      style.textContent = "input[type=file]{position:fixed!important;left:0!important;top:0!important;width:8px!important;height:8px!important;margin:0!important;padding:0!important;opacity:0.02!important;clip:auto!important;clip-path:none!important;-webkit-clip-path:none!important;overflow:visible!important;}";
      var root = document.head || document.documentElement;
      if (root) root.appendChild(style);
    })();
    """
}

enum ShellTheme {
    static let background = UIColor(red: 7.0 / 255.0, green: 20.0 / 255.0, blue: 14.0 / 255.0, alpha: 1)
}
