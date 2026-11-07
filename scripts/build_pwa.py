"""Build docs/index.html (the standalone iPhone app) from src/artifact-index.html.

The shared JS files live in docs/ and are used by both the claude.ai artifact and
the standalone app. Re-run this after changing the artifact page, then commit docs/.
Also bumps the service-worker cache version so phones pick up the new files.
"""
import pathlib
import re
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
src = (ROOT / "src" / "artifact-index.html").read_text(encoding="utf-8")
lines = src.split("\n")

# Line 1 is the artifact publish wrapper: keep its reset <style>, drop the rest.
wrap_style = re.search(r"<style>.*?</style>", lines[0]).group(0)
start = next(i for i, l in enumerate(lines) if l.startswith("<style>"))
head_extra = [l for l in lines[1:start] if "claude:" not in l]  # title + font links
body = "\n".join(lines[start:])
body = body.replace("</body></html>", "").rstrip()

head = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
{chr(10).join(head_extra)}
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Training">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#eaeff4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0f15" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
{wrap_style}</head><body>"""

tail = """
<script>if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));</script>
</body></html>
"""
(ROOT / "docs" / "index.html").write_text(head + "\n" + body + tail, encoding="utf-8", newline="\n")

sw = ROOT / "docs" / "sw.js"
text = sw.read_text(encoding="utf-8")
text = re.sub(r"const VERSION = '[^']*';", f"const VERSION = 'v{int(time.time())}';", text)
sw.write_text(text, encoding="utf-8", newline="\n")
print("built docs/index.html and bumped sw.js")
