"""Checks each class's health, damage and healing, switching class (cancel and confirm), Keep my class, Reset progress, and old saves without a class.

Run from anywhere:  python tests/classes.py
Needs Playwright with Chromium (see tests/README.md)."""
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
if len(_sys.argv) < 2:
    _sys.argv.append(_ROOT)  # default: the project folder this script lives in
_sys.argv[1] = _os.path.abspath(_sys.argv[1])
_os.makedirs(_os.path.join(_ROOT, "tests", "screenshots"), exist_ok=True)
_os.chdir(_os.path.join(_ROOT, "tests", "screenshots"))  # screenshots land here, not in the project
import subprocess, time, sys, json
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8774", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
def answer(pg, right):
    t = pg.inner_text("#question-text")
    idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
    pg.click(f"#choices button >> nth={idx if right else (idx+1)%4}"); pg.wait_for_function("!turnInProgress")
def fresh(b, mode="learner", save=None):
    ctx = b.new_context(); pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    if save: pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8774/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click(f"button[data-mode={mode}]")
    return pg
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = fresh(b)
        print("first visit shows class picker:", pg.is_visible("#class-panel"), "| cancel hidden:", not pg.is_visible("#class-cancel-button"))
        print(" ", pg.inner_text("#class-intro"))
        for i, cls in enumerate(["defender", "analyst", "cryptographer"]):
            pg = fresh(b)
            pg.click(f"#class-list button >> nth={i}")
            print(f"\n{cls}: map summary:", pg.inner_text("#player-summary"))
            pg.click("#zone-list button >> nth=0")
            print("  canvas name/hp:", pg.evaluate("player.name + ' ' + player.hp + '/' + player.maxHp"))
            print("  skills:", [x.inner_text().split("\n")[0] for x in pg.query_selector_all("#skills button")])
            # wrong answer: damage taken
            pg.click("#skills button >> nth=1"); answer(pg, False)
            print("  enemy hit for:", pg.evaluate("player.maxHp - player.hp"))
            pg.click("#next-button"); pg.click("#skills button >> nth=0"); answer(pg, True)
            print("  log:", pg.inner_text("#battle-log"))
        # switching cost from level 5 analyst, with an old-style save that has no class
        pg = fresh(b, save={"level": 5, "xp": 200, "clearedZones": ["controls-yard"]})
        print("\nold save without class -> picker:", pg.is_visible("#class-panel"))
        pg.click("#class-list button >> nth=1")
        print("  after picking:", pg.inner_text("#player-summary"), "| cleared kept:", pg.evaluate("save.clearedZones"))
        pg.click("#change-class-button")
        print("  switch screen:", pg.inner_text("#class-intro"), "| own class disabled:", pg.is_disabled("#class-list button >> nth=1"))
        pg.once("dialog", lambda d: (print("  confirm:", d.message), d.dismiss()))
        pg.click("#class-list button >> nth=0")
        print("  after cancel in dialog, still analyst:", pg.evaluate("save.classId"), "level", pg.evaluate("save.level"))
        pg.once("dialog", lambda d: d.accept())
        pg.click("#class-list button >> nth=0")
        print("  after accept:", pg.inner_text("#player-summary"))
        pg.click("#change-class-button"); pg.click("#class-cancel-button")
        print("  'Keep my class' returns to map:", pg.is_visible("#map-panel"))
        pg.once("dialog", lambda d: d.accept()); pg.click("#reset-button")
        print("  reset -> picker:", pg.is_visible("#class-panel"), pg.evaluate("JSON.stringify(save)"))
        pg.wait_for_timeout(50); pg.screenshot(path="class_picker.png", full_page=True)
        b.close()
finally: srv.terminate()
print("\npage errors:", errors)
