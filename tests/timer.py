"""Checks the Hard mode timer runs out correctly (red warning, Time's up) and Fun mode has no timer.

Run from anywhere:  python tests/timer.py
Needs Playwright with Chromium (see tests/README.md)."""
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if len(_sys.argv) < 2:
    _sys.argv.append(_ROOT)  # default: the project folder this script lives in
_sys.argv[1] = _os.path.abspath(_sys.argv[1])
_os.makedirs(_os.path.join(_ROOT, "tests", "screenshots"), exist_ok=True)
_os.chdir(_os.path.join(_ROOT, "tests", "screenshots"))  # screenshots land here, not in the project
import subprocess, time, sys
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8777", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.clock.install(); pg.goto("http://localhost:8777/")
        pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click("button[data-mode=hard]"); pg.click("#class-list button >> nth=1") if pg.is_visible("#class-panel") else None
        pg.click("#zone-list button >> nth=0"); pg.click("#skills button >> nth=0")
        pg.clock.run_for(25000); low = "low" in (pg.get_attribute("#timer-bar", "class") or "")
        pg.clock.run_for(6000)
        print("hard timeout -> player hp:", pg.evaluate("player.hp + '/' + player.maxHp"), "| red warning:", low, "| feedback:", pg.inner_text("#feedback")[:11])
        pg2 = b.new_page(); pg2.goto("http://localhost:8777/"); pg2.wait_for_selector("#mode-panel:not([hidden])")
        pg2.click("button[data-mode=fun]"); pg2.click("#class-list button >> nth=1"); pg2.click("#zone-list button >> nth=0"); pg2.click("#skills button >> nth=0")
        print("fun mode timer hidden:", not pg2.is_visible("#timer"))
        b.close()
finally: srv.terminate()
print("page errors:", errors)
