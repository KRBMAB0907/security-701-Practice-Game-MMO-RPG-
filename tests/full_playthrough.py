"""Plays the whole game as a new Defender on Learner, answering every question right: all 33 zones from level 1 to the final boss. Checks nothing breaks end to end. About 1-2 minutes.

Run from anywhere:  python tests/full_playthrough.py
Needs Playwright with Chromium (see tests/README.md)."""
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if len(_sys.argv) < 2:
    _sys.argv.append(_ROOT)  # default: the project folder this script lives in
_sys.argv[1] = _os.path.abspath(_sys.argv[1])
_os.makedirs(_os.path.join(_ROOT, "tests", "screenshots"), exist_ok=True)
_os.chdir(_os.path.join(_ROOT, "tests", "screenshots"))  # screenshots land here, not in the project
import subprocess, time, sys, collections
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8790", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto("http://localhost:8790/"); pg.wait_for_selector("#mode-panel:not([hidden])")
        pg.click("button[data-mode=learner]"); pg.click("#class-list button >> nth=0")
        start = time.time(); asked = []; fights = 0; zones_done = 0; last_log = ""; area_msgs = []
        while True:
            # play the first unlocked, uncleared zone in the selected area
            buttons = pg.query_selector_all("#zone-list button")
            target = next((i for i, x in enumerate(buttons) if not x.is_disabled() and "cleared" not in x.inner_text()), None)
            if target is None: break
            pg.click(f"#zone-list button >> nth={target}")
            while True:
                if pg.evaluate("fightOver"):
                    fights += 1
                    if pg.is_visible("#next-button"): pg.click("#next-button"); continue
                    break
                weak = pg.query_selector("#skills button.weak-point"); (weak or pg.query_selector("#skills button")).click()
                t = pg.inner_text("#question-text"); asked.append(t)
                pg.click(f"#choices button >> nth={pg.evaluate('t => questions.find(q => q.question === t).answer', t)}"); pg.wait_for_function("!turnInProgress")
                if not pg.evaluate("fightOver"): pg.click("#next-button")
            zones_done += 1; last_log = pg.inner_text("#battle-log")
            if "IS COMPLETE" in last_log: area_msgs.append(last_log[last_log.find("+"):][:60] + " ...")
            pg.click("#map-button")
        print(f"zones cleared: {zones_done}, fights won: {fights}, questions answered: {len(asked)}, distinct: {len(set(asked))} of {pg.evaluate('questions.length')}")
        print(f"final level {pg.evaluate('save.level')}, gear in bag {pg.evaluate('save.inventory.length')}, run time {int(time.time()-start)}s")
        print("map:", pg.inner_text("#player-summary"))
        print("\nFINAL MESSAGE:\n", last_log)
        b.close()
finally: srv.terminate()
print("\npage errors:", errors)
