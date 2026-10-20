"""Clean star demo player + four-surface deploy kit."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "deploy/demo-video-clean"
PLAYER = PKG / "opt-patch/components/star-demo-player.tsx"
UNI_PLAYER = PKG / "opt-patch/apps/uniapp/src/components/star-demo-player.vue"
APPLY = PKG / "scripts/apply-on-server.sh"
MAC = PKG / "scripts/mac-four-surface-release.sh"
MP_JS = PKG / "opt-patch/miniprogram/utils/star-demos.js"

FORBIDDEN = [
    "打开B站原页",
    "换源 ·",
    "进入哔哩哔哩",
    "star-demo-credit",
    "star-demo-actions",
    "alternateSource",
    "Switch ·",
    "Open original",
    "qualityHint",
    "overrideCredit",
]


def test_kit_files_exist():
    for p in (PLAYER, UNI_PLAYER, APPLY, MAC, MP_JS):
        assert p.is_file(), p


def test_next_player_has_no_chrome_ui():
    text = PLAYER.read_text(encoding="utf-8")
    assert "data-clean-demo" in text
    assert "preferredEmbed" in text
    assert "iframe" in text
    for bad in FORBIDDEN:
        assert bad not in text, bad


def test_uni_player_has_no_chrome_ui():
    text = UNI_PLAYER.read_text(encoding="utf-8")
    assert "data-clean-demo" in text
    for bad in ("打开B站", "换源", "star-demo-credit", "watchUrl"):
        assert bad not in text, bad


def test_apply_covers_four_surfaces():
    text = APPLY.read_text(encoding="utf-8")
    for needle in (
        "/opt/tennis-ai",
        "star-demo-player.tsx",
        "star-demo-player.vue",
        "tennis-ai.apk",
        "tennis-ai.ipa",
        "mp-weixin.zip",
        "systemctl restart tennis-ai",
    ):
        assert needle in text, needle


def test_mac_release_uploads_clients():
    text = MAC.read_text(encoding="utf-8")
    assert "voice-diary-prod-ssh" in text
    assert "tennis-ai.apk" in text
    assert "tennis-ai.ipa" in text
    assert "mp-weixin.zip" in text
    assert "apply-on-server.sh" in text


def test_player_keeps_hd_embed_path():
    text = PLAYER.read_text(encoding="utf-8")
    assert "preferBilibili" in text
    assert "embedUrl" in text
    assert "watchUrl" not in text
