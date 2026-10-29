"""Checks the three legendary effects (Elimination Engine, Failover Core, Insight Lens), gear above your level being inactive, old saves gaining gear fields, and a full gear bag.

Run from anywhere:  python tests/legendaries.py
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
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8781", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
def answer(pg, right):
    t = pg.inner_text("#question-text")
    idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
    pg.click(f"#choices button >> nth={idx if right else (idx+1)%4}"); pg.wait_for_function("!turnInProgress")
    return idx
def page(b, mode="learner", save=None):
    ctx = b.new_context(); pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    if save: pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8781/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click(f"button[data-mode={mode}]")
    if pg.is_visible("#class-panel"): pg.click("#class-list button >> nth=0")
    return pg
LEG = {
 "eliminate": {"id": 1, "name": "Elimination Engine", "tier": "legendary", "slot": "module", "stat": "time", "value": 18, "level": 4, "effect": "eliminate", "effectText": "Removes one wrong answer from every question."},
 "failover": {"id": 2, "name": "Failover Core", "tier": "legendary", "slot": "armor", "stat": "hp", "value": 60, "level": 4, "effect": "failover", "effectText": "x"},
 "insight": {"id": 3, "name": "Insight Lens", "tier": "legendary", "slot": "tool", "stat": "damage", "value": 30, "level": 4, "effect": "insight", "effectText": "x"},
}
def with_gear(*names, level=4, cls="defender"):
    inv = [LEG[n] for n in names]
    return {"level": level, "xp": 0, "clearedZones": [], "classId": cls, "inventory": inv,
            "equipped": {"tool": 3 if "insight" in names else None, "armor": 2 if "failover" in names else None, "module": 1 if "eliminate" in names else None}, "nextItemId": 10}
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # Elimination Engine: one wrong answer crossed out, never the right one, every question
        pg = page(b, save=with_gear("eliminate"))
        pg.click("#zone-list button >> nth=0"); ok = 0
        for i in range(6):
            pg.click("#skills button >> nth=0")
            elim = pg.evaluate("[...document.querySelectorAll('#choices button')].map((b,i)=>b.classList.contains('eliminated')?i:-1).filter(i=>i>=0)")
            t = pg.inner_text("#question-text"); right = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
            ok += (len(elim) == 1 and elim[0] != right)
            answer(pg, True)
            if pg.evaluate("fightOver"): break
            pg.click("#next-button")
        print(f"eliminate: correct on {ok} questions (exactly one wrong answer removed, never the right one)")
        pg.wait_for_timeout(50)
        # Failover Core: lethal hit leaves 1 HP once
        pg = page(b, "hard", save=with_gear("failover", level=4))
        pg.click("#zone-list button >> nth=0")
        pg.evaluate("enemyHitChance = () => 1; player.hp = 5")
        pg.click("#skills button >> nth=0"); answer(pg, False)
        print("failover 1st lethal hit -> hp:", pg.evaluate("player.hp"), "|", pg.inner_text("#battle-log")[-62:])
        pg.click("#next-button"); pg.click("#skills button >> nth=0"); answer(pg, False)
        print("failover 2nd lethal hit -> hp:", pg.evaluate("player.hp"), "fight over:", pg.evaluate("fightOver"))
        pg.click("#next-button")  # try again: new fight resets failover
        pg.evaluate("enemyHitChance = () => 1; player.hp = 5"); pg.click("#skills button >> nth=0"); answer(pg, False)
        print("failover in a new fight -> hp:", pg.evaluate("player.hp"))
        # Insight Lens: weak point multiplier 1.5 -> 2.0 (plus +30% tool)
        pg = page(b, save=with_gear("insight"))
        pg.click("#zone-list button >> nth=0")
        print("insight: weak-point Firewall Rule damage:", pg.evaluate("skillDamage(skills[0])"), "(expect 20 x 1.3 lvl x 1.2 favored x 1.3 tool x 2.0 = 81)")
        # Level gate: gear above your level stops working (e.g. after a class switch)
        pg = page(b, save=with_gear("insight", level=2))
        print("insight equipped at level 2 (needs 4): active gear count:", pg.evaluate("activeGear().length"))
        pg.click("#gear-button"); print("  gear row:", pg.inner_text(".gear-item").replace("\n", " | "))
        # Old save from before loot existed
        pg = page(b, save={"level": 3, "xp": 10, "clearedZones": ["controls-yard"], "classId": "analyst"})
        print("old save migrates:", pg.evaluate("JSON.stringify({inv: save.inventory, eq: save.equipped, next: save.nextItemId})"), "| map:", pg.inner_text("#player-summary"))
        # Full bag
        pg.evaluate("for (let i = 0; i < 24; i++) save.inventory.push({id: 500+i, name: 'Common Hex Editor', tier: 'common', slot: 'tool', stat: 'damage', value: 5, level: 1})")
        pg.evaluate("enemy.boss = true; currentZone = zones[0]")
        print("full bag drop:", pg.evaluate("JSON.stringify((d => ({kept: d.kept, bag: save.inventory.length}))(rollDrop()))"))
        b.close()
finally: srv.terminate()
print("page errors:", errors)
