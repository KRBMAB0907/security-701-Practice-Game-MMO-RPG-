"""Checks the Equip now button after a battle, armor appearing on the character, the Minecraft-style gear screen slots, and old items getting icons. Saves screenshots.

Run from anywhere:  python tests/gear_screen.py
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
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8801", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []; missing = []
def answer(pg, right=True):
    t = pg.inner_text("#question-text")
    idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
    pg.click(f"#choices button >> nth={idx if right else (idx+1)%4}"); pg.wait_for_function("!turnInProgress")
def page(b, save=None, cls=0):
    ctx = b.new_context(viewport={"width": 1100, "height": 1000}, device_scale_factor=1)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: missing.append(m.text) if "Missing image" in m.text else None)
    pg.on("dialog", lambda d: d.accept())
    if save: pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8801/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click("button[data-mode=learner]")
    if pg.is_visible("#class-panel"): pg.click(f"#class-list button >> nth={cls}")
    pg.wait_for_timeout(300)
    return pg
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # 1. Fresh Defender: beat a boss (always drops), check the loot message and Equip now
        pg = page(b, cls=0)
        pg.click("#zone-list button >> nth=0")
        pg.evaluate("enemyIndex = 3; startFight()")   # Unpatched Warden (boss)
        while not pg.evaluate("fightOver"):
            weak = pg.query_selector("#skills button.weak-point"); (weak or pg.query_selector("#skills button")).click(); answer(pg)
            if not pg.evaluate("fightOver"): pg.click("#next-button")
        print("loot message:", pg.inner_text("#loot-message").replace("\n", " | "))
        btn = pg.query_selector("#loot-message button")
        print("button:", btn.inner_text(), "| disabled:", btn.is_disabled())
        # force a known armor drop for the visual test
        pg.evaluate("""() => { const item = makeItem(tierById('rare'), 1); item.slot = 'armor'; item.stat = 'hp'; item.icon = 'firewall-plating';
             item.name = 'Rare Firewall Plating'; item.level = 1; save.inventory.push(item); writeSave(); setLootMessage({item, kept: true}); }""")
        pg.click("#loot-message button")
        print("after Equip now:", pg.inner_text("#loot-message").replace("\n", " | "), "| armor slot:", pg.evaluate("findItem(save.equipped.armor).name"))
        pg.wait_for_timeout(200); pg.screenshot(path="ui_battle_loot.png", full_page=True)
        # 2. Gear screen with the paper doll
        pg.click("#map-button"); pg.evaluate("""() => {
            const add = (tier, slot, icon, name) => { const i = makeItem(tierById(tier), 1); Object.assign(i, {slot, icon, name, level: 1,
                stat: slotById(slot).stat}); save.inventory.push(i); return i; };
            save.equipped.tool = add('epic', 'tool', 'port-scanner', 'Epic Port Scanner').id;
            add('legendary', 'module', 'elimination-engine', 'Elimination Engine');
            add('uncommon', 'armor', 'hardened-kernel', 'Uncommon Hardened Kernel');
            writeSave(); }""")
        pg.click("#gear-button"); pg.wait_for_timeout(300)
        print("slots:", [s.inner_text().replace("\n", " | ") for s in pg.query_selector_all(".doll-slot")])
        pg.screenshot(path="ui_gear.png", full_page=True)
        # equip the legendary module from the list, slot updates
        pg.click(".gear-item:has-text('Elimination Engine') button:text('Equip')"); pg.wait_for_timeout(150)
        print("module slot after equip:", pg.query_selector_all(".doll-slot")[2].inner_text().replace("\n", " | "))
        # 3. old save item without an icon field gets one by name
        pg2 = page(b, save={"level": 5, "xp": 0, "classId": "cryptographer", "clearedZones": [], "nextItemId": 3,
            "equipped": {"tool": None, "armor": 1, "module": None},
            "inventory": [{"id": 1, "name": "Epic Encrypted Shell", "tier": "epic", "slot": "armor", "stat": "hp", "value": 50, "level": 3},
                          {"id": 2, "name": "Failover Core", "tier": "legendary", "slot": "armor", "stat": "hp", "value": 77, "level": 9, "effect": "failover", "effectText": "x"}]})
        print("old items' icons:", pg2.evaluate("save.inventory.map(itemIcon)"), "| worn armor:", pg2.evaluate("wornArmor() && wornArmor().name"))
        pg2.click("#gear-button"); pg2.wait_for_timeout(300); pg2.screenshot(path="ui_gear_crypto.png", full_page=True)
        pg2.click("#gear-back-button"); pg2.click("#zone-list button >> nth=0"); pg2.wait_for_timeout(300)
        pg2.locator("#game").screenshot(path="ui_crypto_battle.png")
        # hit flash with armor
        pg2.evaluate("player.flash = 100000; player.shake = 0"); pg2.wait_for_timeout(100)
        pg2.locator("#game").screenshot(path="ui_crypto_flash.png")
        b.close()
finally: srv.terminate()
print("missing images:", missing or "none"); print("page errors:", errors)
