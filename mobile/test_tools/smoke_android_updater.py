"""Exercise the release updater through Flutter's button and Android's installer on an emulator."""
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PROBE = "tr.com.yukvinc.yukvinc_mobile.updatesmoke"
APP = "tr.com.yukvinc.yukvinc_mobile.android"
ACTIVITY = "tr.com.yukvinc.yukvinc_mobile.MainActivity"


def adb(*args, check=True):
    out = subprocess.run(["adb", *args], capture_output=True, text=True, timeout=35, check=check)
    return out.stdout.strip()


def screen():
    adb("shell", "uiautomator", "dump", "/sdcard/yv-update-ui.xml", check=False)
    xml = adb("shell", "cat", "/sdcard/yv-update-ui.xml", check=False)
    try:
        return list(ET.fromstring(xml).iter("node"))
    except ET.ParseError:
        return []


def label(node):
    return (node.get("text", "") + " " + node.get("content-desc", "")).strip()


def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.get("bounds")))
    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


def wait_button(title, timeout, manual=False):
    end = time.monotonic() + timeout
    next_manual = time.monotonic() + 10
    labels = []
    while time.monotonic() < end:
        nodes = screen()
        labels = [label(n) for n in nodes if label(n)]
        for n in nodes:
            if title.casefold() in label(n).casefold():
                tap(n)
                return
        if manual and time.monotonic() >= next_manual:
            for n in nodes:
                if "Güncellemeleri kontrol et" in label(n):
                    tap(n)
                    next_manual = time.monotonic() + 20
                    break
        time.sleep(1)
    raise RuntimeError(f"{title} did not appear. Last app screen: {labels}")


adb("install", "mobile/build/app/outputs/flutter-apk/app-debug.apk")
adb("shell", "appops", "set", PROBE, "REQUEST_INSTALL_PACKAGES", "allow")
assert "allow" in adb("shell", "appops", "get", PROBE, "REQUEST_INSTALL_PACKAGES")
assert not adb("shell", "pm", "path", APP, check=False), "Target app must start absent"
adb("shell", "am", "start", "-W", "-n", f"{PROBE}/{ACTIVITY}")
wait_button("İndir ve güncelle", 100, manual=True)

end = time.monotonic() + 210
labels = []
confirmed = False
while time.monotonic() < end:
    if adb("shell", "pm", "path", APP, check=False).startswith("package:"):
        break
    nodes = screen()
    labels = [label(n) for n in nodes if label(n)]
    if any("YükVinç ayarını aç" in value for value in labels):
        raise RuntimeError("App requested the install setting even though it was already granted")
    for n in nodes:
        package = n.get("package", "")
        if ("packageinstaller" in package or "permissioncontroller" in package) and (
                n.get("resource-id") == "android:id/button1" or label(n).casefold() in ("install", "yükle")):
            if n.get("enabled") == "true":
                tap(n)
                confirmed = True
                break
    time.sleep(1)
else:
    raise RuntimeError(f"Public APK was not installed from the app. Last screen: {labels}")

assert confirmed, "Android must have requested installation confirmation"
print("Already-granted permission, public download, verified content URI and Android installation passed.")
