"""Balance: the Breach Wastes from a save that has cleared the Foundry. Prints deaths per zone per mode/class/accuracy.

Run from anywhere:  python tests/balance_breach_wastes.py
Needs Playwright with Chromium (see tests/README.md)."""
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if len(_sys.argv) < 2:
    _sys.argv.append(_ROOT)  # default: the project folder this script lives in
_sys.argv[1] = _os.path.abspath(_sys.argv[1])
_os.makedirs(_os.path.join(_ROOT, "tests", "screenshots"), exist_ok=True)
_os.chdir(_os.path.join(_ROOT, "tests", "screenshots"))  # screenshots land here, not in the project
import subprocess, time, sys, json, random
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8785", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
FOUNDRY = ["controls-yard", "core-sanctum", "change-gate", "cipher-vault", "foundry-heart"]
def run(b, mode, cls, acc, seed):
    pg = b.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    save = {"level": 7, "xp": 0, "classId": cls, "inventory": [], "equipped": {"tool": None, "armor": None, "module": None}, "nextItemId": 1, "clearedZones": FOUNDRY}
    pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8785/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click(f"button[data-mode={mode}]")
    rng = random.Random(seed); deaths = []
    for z in range(6):
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
    return deaths, pg.evaluate("save.level")
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for mode, cls, acc in [("learner", "cryptographer", 0.65), ("hard", "cryptographer", 0.65), ("hard", "defender", 0.75), ("learner", "analyst", 0.5)]:
            deaths, lvl = run(b, mode, cls, acc, 3)
            print(f"{mode:8} {cls:13} {int(acc*100)}% correct -> deaths per zone {deaths}, total {sum(deaths)}, ends level {lvl}")
        b.close()
finally: srv.terminate()
print("page errors:", errors)
