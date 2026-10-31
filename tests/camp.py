"""Checks the home camp: smelting gear into scrap, forging new gear, crafting a legendary,
upgrading and re-leveling items, costs being paid, a full bag, old saves without scrap,
and that the camp scene draws. Saves screenshots.

Run from anywhere:  python tests/camp.py
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
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8812", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []; missing = []; failures = []

def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (" | " + str(detail) if detail != "" else ""))
    if not ok:
        failures.append(name)

def item(id, tier, slot, icon, name, level, stat, value, effect=None):
    return {"id": id, "name": name, "tier": tier, "slot": slot, "icon": icon, "stat": stat,
            "value": value, "level": level, "effect": effect, "effectText": None}

def page(b, save, viewport=(1100, 1000)):
    ctx = b.new_context(viewport={"width": viewport[0], "height": viewport[1]}, device_scale_factor=1)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: missing.append(m.text) if "Missing image" in m.text else None)
    pg.on("dialog", lambda d: d.accept())
    pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8812/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click("button[data-mode=learner]")
    pg.wait_for_timeout(300)
    return pg

# An old save from before the camp existed: no "materials" field
OLD_SAVE = {"level": 10, "xp": 0, "classId": "defender", "clearedZones": [], "nextItemId": 6, "tree": {},
    "equipped": {"tool": 1, "armor": None, "module": None},
    "inventory": [item(1, "rare", "tool", "port-scanner", "Rare Port Scanner", 4, "damage", 17),
                  item(2, "common", "tool", "hex-editor", "Common Hex Editor", 2, "damage", 5),
                  item(3, "common", "armor", "hardened-kernel", "Common Hardened Kernel", 2, "hp", 11),
                  item(4, "epic", "module", "cache-module", "Epic Cache Module", 5, "time", 17),
                  item(5, "legendary", "armor", "failover-core", "Failover Core", 6, "hp", 75, "failover")]}

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = page(b, OLD_SAVE)
        check("old save gets empty scrap", pg.evaluate("JSON.stringify(save.materials)") ==
              json.dumps({"common": 0, "uncommon": 0, "rare": 0, "epic": 0, "legendary": 0}, separators=(",", ":")))

        pg.click("#camp-button"); pg.wait_for_timeout(400)
        check("camp panel opens", pg.is_visible("#camp-panel"))
        pg.locator("#game").screenshot(path="camp_scene.png"); pg.screenshot(path="camp_blacksmith.png")

        # Blacksmith: equipped item can't be smelted, others can
        rows = pg.query_selector_all("#camp-content .gear-item")
        check("blacksmith lists every item", len(rows) == 5, len(rows))
        eq_btn = pg.query_selector("#camp-content .gear-item:has-text('Rare Port Scanner') button")
        check("equipped item's smelt button is disabled", eq_btn.is_disabled(), eq_btn.inner_text())
        pg.click("#camp-content .gear-item:has-text('Common Hex Editor') button")
        pg.click("#camp-content .gear-item:has-text('Common Hardened Kernel') button")
        pg.click("#camp-content .gear-item:has-text('Epic Cache Module') button")
        pg.click("#camp-content .gear-item:has-text('Failover Core') button")
        mats = pg.evaluate("save.materials")
        check("smelting gives scrap of each tier", mats == {"common": 4, "uncommon": 0, "rare": 0, "epic": 2, "legendary": 3}, mats)
        check("smelted items left the bag", pg.evaluate("save.inventory.length") == 1)
        check("message shows", "Smelted" in pg.inner_text("#camp-message"), pg.inner_text("#camp-message"))
        stored = pg.evaluate("JSON.parse(localStorage.getItem('secplus-rpg-save')).materials")
        check("scrap is saved", stored == mats, stored)

        # Crafter: forge a common Firewall Plating at level 10
        pg.click("#crafter-tab"); pg.wait_for_timeout(200)
        pg.screenshot(path="camp_crafter.png")
        pg.select_option("#camp-content select >> nth=0", label="Armor: Firewall Plating")
        pg.select_option("#camp-content select >> nth=1", "rare")
        check("forge disabled without enough scrap", pg.is_disabled("#camp-content button:text-is('Forge')"))
        pg.select_option("#camp-content select >> nth=1", "common")
        pg.click("#camp-content button:text-is('Forge')")
        forged = pg.evaluate("save.inventory[save.inventory.length - 1]")
        check("forged item", forged["name"] == "Common Firewall Plating" and forged["level"] == 10 and forged["slot"] == "armor"
              and forged["value"] == pg.evaluate("itemValue(tierById('common'), 'hp', 10)"), forged)
        check("forge paid 4 common", pg.evaluate("save.materials.common") == 0)

        # Legendary: 2 cores + 4 epic, we have 3 cores + 2 epic -> can't
        check("legendary disabled without enough epic", pg.is_disabled("#camp-content button:text-is('Craft Insight Lens')"))
        pg.evaluate("save.materials.epic = 4; showCamp()")
        pg.click("#camp-content button:text-is('Craft Insight Lens')")
        lens = pg.evaluate("save.inventory.find(i => i.name === 'Insight Lens')")
        check("crafted legendary", lens is not None and lens["effect"] == "insight" and lens["level"] == 10, lens)
        check("legendary paid", pg.evaluate("[save.materials.legendary, save.materials.epic]") == [1, 0])

        # Upgrade: Rare Port Scanner -> Epic needs 6 rare scrap
        pg.evaluate("save.materials.rare = 6; showCamp()")
        pg.click("#camp-content .gear-item:has-text('Rare Port Scanner') button:has-text('Upgrade')")
        scanner = pg.evaluate("findItem(1)")
        check("upgraded to epic, same level", scanner["name"] == "Epic Port Scanner" and scanner["tier"] == "epic" and scanner["level"] == 4
              and scanner["value"] == pg.evaluate("itemValue(tierById('epic'), 'damage', 4)"), scanner)
        check("still equipped after upgrade", pg.evaluate("save.equipped.tool") == 1)
        check("no upgrade button on epic", pg.query_selector("#camp-content .gear-item:has-text('Epic Port Scanner') button:has-text('Upgrade')") is None)

        # Re-level: Epic Port Scanner level 4 -> 10 costs 2 epic
        pg.evaluate("save.materials.epic = 2; showCamp()")
        pg.click("#camp-content .gear-item:has-text('Epic Port Scanner') button:has-text('Re-level')")
        scanner = pg.evaluate("findItem(1)")
        check("re-leveled to 10", scanner["level"] == 10 and scanner["value"] == pg.evaluate("itemValue(tierById('epic'), 'damage', 10)"), scanner)
        check("re-level paid", pg.evaluate("save.materials.epic") == 0)
        check("no re-level button at your level", pg.query_selector("#camp-content .gear-item:has-text('Epic Port Scanner') button:has-text('Re-level')") is None)

        # Full bag: forging is blocked
        pg.evaluate("""() => { while (save.inventory.length < lootTable.inventoryLimit) save.inventory.push(makeItem(tierById('common'), 1));
                               save.materials.common = 8; showCamp(); }""")
        check("forge blocked when bag is full", pg.is_disabled("#camp-content button:text-is('Forge')"), pg.inner_text("#camp-content .camp-row small"))
        pg.evaluate("forge(lootTable.bases[0], tierById('common'))")
        check("forge() itself refuses a full bag", pg.evaluate("save.inventory.length") == pg.evaluate("lootTable.inventoryLimit"))

        # Back to map; the camp scene stops drawing
        pg.click("#camp-back-button"); pg.wait_for_timeout(200)
        check("back to map", pg.is_visible("#map-panel") and not pg.evaluate("isCampOpen()"))

        # Phone size: the map's buttons and the camp still fit without page scrolling
        pg2 = page(b, OLD_SAVE, viewport=(375, 667))
        pg2.click("#camp-button"); pg2.click("#crafter-tab"); pg2.wait_for_timeout(300)
        check("phone: page doesn't scroll", pg2.evaluate("document.documentElement.scrollHeight <= innerHeight"))
        pg2.screenshot(path="camp_phone.png")
        b.close()
finally: srv.terminate()
print("missing images:", missing or "none"); print("page errors:", errors or "none")
print("ALL PASSED" if not failures and not errors and not missing else f"FAILED: {failures}")
