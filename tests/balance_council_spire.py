"""Balance: the Council Spire from a save that has cleared areas 1-4. Slow (10+ minutes).

Run from anywhere:  python tests/balance_council_spire.py
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
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8789", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
CLEARED = ["controls-yard", "core-sanctum", "change-gate", "cipher-vault", "foundry-heart",
           "actors-den", "vector-fields", "vulnerability-rift", "malware-marsh", "hardening-forge", "breach-core",
           "cloud-spires", "perimeter-walls", "data-vaults", "resilience-bastion", "citadel-keep",
           "baseline-barracks", "asset-depot", "scanner-pits", "watchtower", "defense-grid", "identity-halls", "script-engine", "response-bunker", "log-archive", "operations-core"]
def run(b, mode, cls, acc, seed, verbose=False):
    pg = b.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    save = {"level": 26, "xp": 0, "classId": cls, "inventory": [], "equipped": {"tool": None, "armor": None, "module": None}, "nextItemId": 1, "clearedZones": CLEARED}
    pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8789/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click(f"button[data-mode={mode}]")
    if verbose:
        print("lands on:", pg.inner_text("#area-title")[:60])
        print("tabs:", [x.inner_text() for x in pg.query_selector_all("#area-list button")])
    rng = random.Random(seed); deaths = []; missing = []; phases = set()
    for z in range(7):
        pg.click(f"#zone-list button >> nth={z}"); d = 0
        while True:
            st = pg.evaluate("({over: fightOver, won: fightWon, boss: enemy.boss})")
            if st["over"]:
                if not st["won"]:
                    d += 1
                    if d > 25: break
                    pg.click("#next-button"); continue
                if pg.is_visible("#next-button"): pg.click("#next-button"); continue
                break
            if st["boss"]: phases.add((pg.evaluate("enemy.name"), pg.evaluate("currentPhase()")))
            weak = pg.query_selector("#skills button.weak-point")
            if weak is None: missing.append(pg.evaluate("enemy.name"))
            (weak or pg.query_selector("#skills button")).click()
            t = pg.inner_text("#question-text"); idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
            pg.click(f"#choices button >> nth={idx if rng.random() < acc else (idx+1)%4}"); pg.wait_for_function("!turnInProgress")
            if not pg.evaluate("fightOver"): pg.click("#next-button")
        if verbose: print(f"  zone {z+1}: {pg.inner_text('#battle-log')[:120]}")
        deaths.append(d); pg.click("#map-button")
    if verbose:
        print("map summary:", pg.inner_text("#player-summary"))
        print("final tabs:", [x.inner_text() for x in pg.query_selector_all("#area-list button")])
        print("boss phases reached:", sorted(phases)); print("enemies with no weak-point skill:", missing or "none")
    return deaths, pg.evaluate("save.level")
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        run(b, "learner", "analyst", 1.0, 1, verbose=True)
        print()
        for mode, cls, acc in [("learner", "analyst", 0.5), ("hard", "cryptographer", 0.65), ("hard", "defender", 0.75)]:
            deaths, lvl = run(b, mode, cls, acc, 5)
            print(f"{mode:8} {cls:13} {int(acc*100)}% correct -> deaths per zone {deaths}, total {sum(deaths)}, ends level {lvl}")
        b.close()
finally: srv.terminate()
print("page errors:", errors)
