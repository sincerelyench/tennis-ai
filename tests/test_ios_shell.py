"""iOS WKWebView shell matches the Android /e1 contract. No device build."""

from __future__ import annotations

import plistlib
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IOS = ROOT / "ios"
APP = IOS / "Zhangqiu"
START = "https://tennis.47.93.203.28.sslip.io/e1"
TARGET = "A10000000000000000000013"


class IosShellTests(unittest.TestCase):
    def test_xcode_project_bakes_start_url(self):
        pbx_path = IOS / "Zhangqiu.xcodeproj" / "project.pbxproj"
        with pbx_path.open("rb") as handle:
            project = plistlib.load(handle)
        target = project["objects"][TARGET]
        self.assertEqual(target["productType"], "com.apple.product-type.application")
        self.assertEqual(target["name"], "Zhangqiu")
        configs = project["objects"][target["buildConfigurationList"]]["buildConfigurations"]
        self.assertEqual(len(configs), 2)
        for config_id in configs:
            settings = project["objects"][config_id]["buildSettings"]
            self.assertEqual(settings["ZQ_START_URL"], START)
            self.assertEqual(settings["PRODUCT_BUNDLE_IDENTIFIER"], "app.zhangqiu")
            self.assertEqual(settings["MARKETING_VERSION"], "0.1.0")
            self.assertEqual(settings["INFOPLIST_FILE"], "Zhangqiu/Info.plist")
            self.assertEqual(settings["IPHONEOS_DEPLOYMENT_TARGET"], "15.0")
        sources = "\n".join(
            project["objects"][ref]["path"]
            for phase in target["buildPhases"]
            if project["objects"][phase]["isa"] == "PBXSourcesBuildPhase"
            for ref in project["objects"][phase]["files"]
            for ref in [project["objects"][ref]["fileRef"]]
        )
        for name in (
            "AppDelegate.swift",
            "SceneDelegate.swift",
            "WebShellViewController.swift",
            "ShellConfig.swift",
        ):
            self.assertIn(name, sources)
            self.assertTrue((APP / name).is_file())
        scheme = (IOS / "Zhangqiu.xcodeproj" / "xcshareddata" / "xcschemes" / "Zhangqiu.xcscheme").read_text(
            encoding="utf-8"
        )
        self.assertIn(TARGET, scheme)
        self.assertIn("Zhangqiu.app", scheme)

    def test_info_plist_name_url_and_upload_prompts(self):
        with (APP / "Info.plist").open("rb") as handle:
            info = plistlib.load(handle)
        self.assertEqual(info["CFBundleDisplayName"], "涨球")
        self.assertEqual(info["ZQStartURL"], "$(ZQ_START_URL)")
        self.assertTrue(info["NSAppTransportSecurity"]["NSAllowsArbitraryLoads"])
        for key in (
            "NSCameraUsageDescription",
            "NSMicrophoneUsageDescription",
            "NSPhotoLibraryUsageDescription",
            "NSLocalNetworkUsageDescription",
        ):
            self.assertTrue(info[key].strip())
        self.assertIn("SceneDelegate", info["UIApplicationSceneManifest"]["UISceneConfigurations"][
            "UIWindowSceneSessionRoleApplication"
        ][0]["UISceneDelegateClassName"])
        icon = APP / "Assets.xcassets" / "AppIcon.appiconset" / "AppIcon.png"
        self.assertTrue(icon.is_file())
        self.assertTrue(icon.read_bytes().startswith(b"\x89PNG"))

    def test_shell_matches_android_error_page_and_marks_ios_client(self):
        swift = (APP / "WebShellViewController.swift").read_text(encoding="utf-8")
        config = (APP / "ShellConfig.swift").read_text(encoding="utf-8")
        java = (
            ROOT / "android" / "app" / "src" / "main" / "java" / "app" / "zhangqiu" / "MainActivity.java"
        ).read_text(encoding="utf-8")
        for snippet in (
            "页面暂时打不开。请检查网络后重试。",
            "The page could not be opened. Check the network and try again.",
            "重试 / Retry",
            "#07140e",
            "#d6e35a",
        ):
            self.assertIn(snippet, config)
            self.assertIn(snippet, java)
        self.assertIn(START, config)
        self.assertIn("ZhangqiuIOS/1", swift)
        self.assertIn("statusCode >= 400", swift)
        self.assertIn("input[type=file]", config)
        self.assertNotIn("serverTrust", swift)
        script = (ROOT / "web" / "static" / "e1.js").read_text(encoding="utf-8")
        self.assertIn('ua.indexOf("ZhangqiuIOS") >= 0) return "ios"', script)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("open ios/Zhangqiu.xcodeproj", readme)
        self.assertIn("ZQ_START_URL", readme)
        self.assertIn("127.0.0.1", readme)
        self.assertTrue((IOS / "ExportOptions.development.plist").is_file())


if __name__ == "__main__":
    unittest.main()
