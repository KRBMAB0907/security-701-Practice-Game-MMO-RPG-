"""Balance: new players through the Foundry from level 1, across modes, classes and accuracy levels. Prints deaths per zone.

Run from anywhere:  python tests/balance_new_player.py
Needs Playwright with Chromium (see tests/README.md)."""
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if len(_sys.argv) < 2:
    _sys.argv.append(_ROOT)  # default: the project folder this script lives in
_sys.argv[1] = _os.path.abspath(_sys.argv[1])
_os.makedirs(_os.path.join(_ROOT, "tests", "screenshots"), exist_ok=True)
_os.chdir(_os.path.join(_ROOT, "tests", "screenshots"))  # screenshots land here, not in the project
import subprocess, time, sys, random
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8803", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
def run(b, mode, cls, acc, seed):
    pg = b.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.goto("http://localhost:8803/"); pg.wait_for_selector("#mode-panel:not([hidden])")
    pg.evaluate("window.ENEMY_FAST = true")
    pg.click(f"button[data-mode={mode}]"); pg.click(f"#class-list button >> nth={cls}")
    rng = random.Random(seed); deaths = []
    for z in range(5):
        pg.click(f"#zone-list button >> nth={z}"); d = 0
        while True:
            st = pg.evaluate("({over: fightOver, won: fightWon})")
            if st["over"]:
                if not st["won"]:
                    d += 1
                    if d > 25: break
                    pg.click("#next-button"); continue
                if pg.is_visible("#next-button"): pg.click("#next-button"); continue
                break
            weak = pg.query_selector("#skills button.weak-point"); (weak or pg.query_selector("#skills button")).click()
            t = pg.inner_text("#question-text"); idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
            pg.click(f"#choices button >> nth={idx if rng.random() < acc else (idx+1)%4}"); pg.wait_for_function("!turnInProgress")
            if not pg.evaluate("fightOver"): pg.click("#next-button")
        deaths.append(d); pg.click("#map-button")
    lvl = pg.evaluate("save.level"); pg.close(); return deaths, lvl
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for mode, cls, acc in [("learner", 1, 0.5), ("learner", 2, 0.65), ("learner", 0, 1.0), ("hard", 2, 0.65), ("hard", 0, 0.75), ("fun", 2, 0.4)]:
            deaths, lvl = run(b, mode, cls, acc, 4)
            print(f"Foundry from scratch: {mode:8} {['defender','analyst','cryptographer'][cls]:13} {int(acc*100)}% -> deaths per zone {deaths}, total {sum(deaths)}, ends level {lvl}")
        b.close()
finally: srv.terminate()
print("page errors:", errors)
