"""Rolls 100,000 drops to check tier odds (normal, Hard, bosses), then checks real drops, equip rules, gear stat bonuses and discarding.

Run from anywhere:  python tests/loot.py
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
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8797", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []
def answer(pg, right):
    t = pg.inner_text("#question-text")
    idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
    pg.click(f"#choices button >> nth={idx if right else (idx+1)%4}"); pg.wait_for_function("!turnInProgress")
def page(b, mode="learner", save=None, cls=0):
    ctx = b.new_context(); pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    if save: pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8797/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click(f"button[data-mode={mode}]")
    if pg.is_visible("#class-panel"): pg.click(f"#class-list button >> nth={cls}")
    return pg
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # 1. Drop odds by simulation
        for mode in ["learner", "hard"]:
            pg = page(b, mode)
            dist = pg.evaluate("""() => { const c = {}; for (let i = 0; i < 100000; i++) { const t = rollTier().id; c[t] = (c[t] || 0) + 1; }
                return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, (v / 1000).toFixed(1) + '%'])); }""")
            print(f"{mode:8} tier odds:", dist)
        boss = pg.evaluate("""() => { enemy.boss = true; currentZone = zones[0]; const c = {}; save.inventory = [];
            for (let i = 0; i < 20000; i++) { const d = rollDrop(); save.inventory = []; c[d.item.tier] = (c[d.item.tier] || 0) + 1; }
            return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, (v / 200).toFixed(1) + '%'])); }""")
        print("hard boss tier odds (best of two):", boss)
        # 2. Real fights: drops happen, gear screen, equip changes stats
        pg = page(b, "learner")
        pg.click("#zone-list button >> nth=0")
        drops = []
        while True:
            over = pg.evaluate("fightOver")
            if over:
                msg = pg.inner_text("#loot-message")
                if msg: drops.append(msg)
                if pg.is_visible("#next-button"): pg.click("#next-button"); continue
                break
            pg.click("#skills button >> nth=0"); answer(pg, True)
            if not pg.evaluate("fightOver"): pg.click("#next-button")
        print("\nControls Yard drops:", drops)
        pg.click("#map-button"); print("map gear button:", pg.inner_text("#gear-button"))
        # give a known item set for checking equip rules
        pg.evaluate("""() => { save.inventory = [
            {id: 101, name: 'Rare Port Scanner', tier: 'rare', slot: 'tool', stat: 'damage', value: 20, level: 2},
            {id: 102, name: 'Epic Firewall Plating', tier: 'epic', slot: 'armor', stat: 'hp', value: 50, level: 9},
            {id: 103, name: 'Common Overclock Chip', tier: 'common', slot: 'module', stat: 'time', value: 6, level: 1}]; writeSave(); }""")
        pg.click("#gear-button")
        rows = [r.inner_text().replace("\n", " | ") for r in pg.query_selector_all(".gear-item")]
        print("gear rows:"); [print("  ", r) for r in rows]
        print("too-high-level equip disabled:", pg.is_disabled(".gear-item:has-text('Firewall Plating') button:text('Equip')"))
        before = pg.evaluate("({hp: playerMaxHp(), dmg: (currentZone = zones[0], skillDamage(skills[0]))})")
        pg.click(".gear-item:has-text('Port Scanner') button:text('Equip')")
        pg.click(".gear-item:has-text('Overclock') button:text('Equip')")
        after = pg.evaluate("({hp: playerMaxHp(), dmg: skillDamage(skills[0])})")
        print("summary:", pg.inner_text("#gear-summary"))
        print("damage before/after +20% tool:", before["dmg"], "->", after["dmg"])
        pg.click("#gear-back-button"); pg.click("#zone-list button >> nth=0"); pg.click("#skills button >> nth=0")
        print("timer with +6s module:", pg.inner_text("#timer-text"), "(expect 66s)")
        # unequip + discard
        pg.click("#map-button") if pg.is_visible("#map-button") else pg.evaluate("showMap()")
        pg.click("#gear-button"); pg.click(".gear-item:has-text('Overclock') button:text('Discard')")
        print("after discard:", pg.evaluate("save.inventory.length"), "items, module slot:", pg.evaluate("save.equipped.module"))
        b.close()
finally: srv.terminate()
print("page errors:", errors)
