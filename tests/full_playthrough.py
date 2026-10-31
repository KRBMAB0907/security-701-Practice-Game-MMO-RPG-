"""Plays the whole game as a new Defender on Learner, answering every question right: all 33 zones from level 1 to the final boss. Checks nothing breaks end to end. About 1-2 minutes.

Run from anywhere:  python tests/full_playthrough.py
Watch it play:      python tests/full_playthrough.py --watch
  --watch opens a real Chrome window and slows down so you can follow along.
  It also gets about 1 in 5 questions wrong, so you see misses and enemy hits
  (and maybe a death). Close the window, or press Ctrl+C, to stop it.
Needs Playwright with Chromium (see tests/README.md)."""
import os as _os, sys as _sys
WATCH = "--watch" in _sys.argv
if WATCH:
    _sys.argv.remove("--watch")  # the folder argument below works the same either way
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if len(_sys.argv) < 2:
    _sys.argv.append(_ROOT)  # default: the project folder this script lives in
_sys.argv[1] = _os.path.abspath(_sys.argv[1])
_os.makedirs(_os.path.join(_ROOT, "tests", "screenshots"), exist_ok=True)
_os.chdir(_os.path.join(_ROOT, "tests", "screenshots"))  # screenshots land here, not in the project
import subprocess, time, sys, collections, random
from playwright.sync_api import sync_playwright, Error as PlaywrightError

# Watch mode settings
SLOW_MS = 250        # pause before every click, so each step is visible
READ_PAUSE_MS = 1800 # time to read the answer's explanation and the enemy's turn
WATCH_ACCURACY = 0.8 # how often watch mode answers right
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8790", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
try:
    with sync_playwright() as p:
        if WATCH:
            b = p.chromium.launch(headless=False, slow_mo=SLOW_MS)  # a real window you can see
            pg = b.new_page(viewport={"width": 1280, "height": 720})
        else:
            b = p.chromium.launch(); pg = b.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
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
                answer = pg.evaluate('t => questions.find(q => q.question === t).answer', t)
                if WATCH and random.random() > WATCH_ACCURACY:
                    answer = (answer + 1) % 4  # a wrong answer, so you see a miss
                pg.click(f"#choices button >> nth={answer}"); pg.wait_for_function("!turnInProgress")
                if WATCH:
                    pg.wait_for_timeout(READ_PAUSE_MS)
                if not pg.evaluate("fightOver"): pg.click("#next-button")
            zones_done += 1; last_log = pg.inner_text("#battle-log")
            if WATCH:
                print(f"Cleared zone {zones_done}/33: {pg.evaluate('currentZone.name')} (level {pg.evaluate('save.level')})", flush=True)
            if "IS COMPLETE" in last_log: area_msgs.append(last_log[last_log.find("+"):][:60] + " ...")
            pg.click("#map-button")
        print(f"zones cleared: {zones_done}, fights won: {fights}, questions answered: {len(asked)}, distinct: {len(set(asked))} of {pg.evaluate('questions.length')}")
        print(f"final level {pg.evaluate('save.level')}, gear in bag {pg.evaluate('save.inventory.length')}, run time {int(time.time()-start)}s")
        print("map:", pg.inner_text("#player-summary"))
        print("\nFINAL MESSAGE:\n", last_log)
        b.close()
except PlaywrightError:
    if not WATCH:
        raise
    print("The window was closed, so the playthrough stopped.")  # closing the window is how you stop watch mode
except KeyboardInterrupt:
    print("\nStopped with Ctrl+C.")
finally: srv.terminate()
print("\npage errors:", errors)
