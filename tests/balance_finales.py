"""Balance: how many tries the Operations Deep and Council Spire finales take on Hard (Cryptographer, 65% accuracy, 5 runs each). Target: a handful of tries, never 25 (= never won).

Run from anywhere:  python tests/balance_finales.py
Needs Playwright with Chromium (see tests/README.md)."""
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if len(_sys.argv) < 2:
    _sys.argv.append(_ROOT)  # default: the project folder this script lives in
if len(_sys.argv) < 3:
    _sys.argv += ["8812", "finale"]  # port, label
_sys.argv[1] = _os.path.abspath(_sys.argv[1])
_os.makedirs(_os.path.join(_ROOT, "tests", "screenshots"), exist_ok=True)
_os.chdir(_os.path.join(_ROOT, "tests", "screenshots"))  # screenshots land here, not in the project
import subprocess, time, sys, json, random
from playwright.sync_api import sync_playwright
R = sys.argv[1]; port = sys.argv[2]; label = sys.argv[3]
srv = subprocess.Popen([sys.executable, "-m", "http.server", port, "-d", R], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
data = {a: json.load(open(f"{R}/data/areas/{a}.json")) for a in ["foundry", "breach-wastes", "citadel", "operations-deep", "council-spire"]}
def cleared_before(area_id):
    ids = []
    for a in ["foundry", "breach-wastes", "citadel", "operations-deep", "council-spire"]:
        zs = [z["id"] for z in data[a]["zones"]]
        if a == area_id: return ids + zs[:-1], zs[-1]
        ids += zs
def run(b, area, level, cls, acc, seed):
    cleared, finale = cleared_before(area)
    pg = b.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    save = {"level": level, "xp": 0, "classId": cls, "clearedZones": cleared, "inventory": [], "equipped": {"tool": None, "armor": None, "module": None}, "nextItemId": 1}
    pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto(f"http://localhost:{port}/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click("button[data-mode=hard]")
    pg.evaluate(f"enterZone(zones.find(z => z.id === '{finale}'))")
    rng = random.Random(seed); deaths = 0
    while True:
        st = pg.evaluate("({over: fightOver, won: fightWon})")
        if st["over"]:
            if st["won"]: break
            deaths += 1
            if deaths >= 25: break
            pg.click("#next-button"); continue
        weak = pg.query_selector("#skills button.weak-point"); (weak or pg.query_selector("#skills button")).click()
        t = pg.inner_text("#question-text"); idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
        pg.click(f"#choices button >> nth={idx if rng.random() < acc else (idx+1)%4}"); pg.wait_for_function("!turnInProgress")
        if not pg.evaluate("fightOver"): pg.click("#next-button")
    pg.close(); return deaths
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for area, level in [("operations-deep", 25), ("council-spire", 32)]:
            res = [run(b, area, level, "cryptographer", 0.65, s) for s in range(5)]
            print(f"{label}: {area} finale, Hard Cryptographer lvl {level} @65%, deaths per attempt-run (5 seeds): {res} (25 = never won)")
        b.close()
finally: srv.terminate()
print("page errors:", errors)
