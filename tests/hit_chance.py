"""Measures enemy hit rates over 20,000 attacks per mode and compares them with the configured chances, then checks one real turn: your attack first, the enemy's after the pause, the Continue button hidden until the turn ends. Saves hit_miss.png and hit_hit.png.

Run from anywhere:  python tests/hit_chance.py
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
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8802", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1366, "height": 768})
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto("http://localhost:8802/"); pg.wait_for_selector("#mode-panel:not([hidden])")
        for mode in ["fun", "learner", "hard"]:
            pg.evaluate(f"currentMode = MODES.{mode}; currentZone = zones[0]; enterZone(zones[0]);" if mode == "fun" else f"currentMode = MODES.{mode}; startFight();") if mode != "fun" else None
            if mode == "fun":
                pg.click("button[data-mode=fun]"); pg.click("#class-list button >> nth=0"); pg.click("#zone-list button >> nth=0")
            for boss in (False, True):
                rate = pg.evaluate(f"""() => {{ enemy.boss = {str(boss).lower()}; let hits = 0; const n = 20000;
                    for (let i = 0; i < n; i++) {{ player.hp = 99999; enemyAttacks(); if (player.hp < 99999) hits++; }}
                    return [hits / n, enemyHitChance()]; }}""")
                print(f"{mode:8} {'boss' if boss else 'enemy'}: measured hit rate {rate[0]:.3f}, configured {rate[1]:.2f}")
        pg.evaluate("enemy.boss = false; speech = null; floatingTexts = []")
        # a real turn: correct answer -> your hit now, enemy attack after the pause
        pg.evaluate("currentMode = MODES.learner; startFight()")
        print("\nintro log:", pg.inner_text("#battle-log")); print("intro speech bubble:", pg.evaluate("speech && speech.text"))
        pg.click("#skills button >> nth=0")
        t = pg.inner_text("#question-text"); idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
        pg.click(f"#choices button >> nth={idx}")
        print("right after answering: log =", repr(pg.inner_text("#battle-log")), "| Continue visible:", pg.is_visible("#next-button"), "| turnInProgress:", pg.evaluate("turnInProgress"))
        pg.wait_for_function("!turnInProgress")
        print("after the enemy's turn: log =", repr(pg.inner_text("#battle-log")), "| Continue visible:", pg.is_visible("#next-button"))
        # wrong answer narration
        pg.click("#next-button"); pg.click("#skills button >> nth=0")
        t = pg.inner_text("#question-text"); idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
        pg.click(f"#choices button >> nth={(idx + 1) % 4}"); pg.wait_for_function("!turnInProgress")
        print("wrong answer turn:", repr(pg.inner_text("#battle-log")))
        # screenshot: forced miss with a taunt, mid-animation
        pg.click("#next-button"); pg.evaluate("enemyHitChance = () => 0; say('Hold still!'); enemyAttacks();"); pg.wait_for_timeout(170)
        pg.locator("#game").screenshot(path="hit_miss.png")
        pg.evaluate("enemyHitChance = () => 1; say('Just click the link...'); enemyAttacks();"); pg.wait_for_timeout(150)
        pg.locator("#game").screenshot(path="hit_hit.png")
        b.close()
finally: srv.terminate()
print("page errors:", errors)
