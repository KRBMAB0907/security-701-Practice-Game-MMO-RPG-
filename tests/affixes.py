"""Checks gear affixes and set items: how many affixes each tier rolls, names, rolled numbers,
risky affixes only on Rare+, affix effects in fights, gear above your level not counting, set
bonuses at 2 and 3 pieces, set drops (own area, PKI only from finale bosses), the loot message,
the Gear screen, and old items without affixes. Saves screenshots.

Run from anywhere:  python tests/affixes.py
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
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8829", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []; missing = []; failures = []

def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (" | " + str(detail) if detail != "" else ""))
    if not ok:
        failures.append(name)

def item(id, tier, slot, icon, name, level, stat, value, affixes=None, set_id=None):
    return {"id": id, "name": name, "tier": tier, "slot": slot, "icon": icon, "stat": stat, "value": value,
            "level": level, "effect": None, "effectText": None, "affixes": affixes or [], "set": set_id}

def page(b, save):
    ctx = b.new_context(viewport={"width": 1100, "height": 1000}, device_scale_factor=1)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: missing.append(m.text) if "Missing image" in m.text else None)
    pg.on("dialog", lambda d: d.accept())
    pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8829/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click("button[data-mode=learner]")
    pg.wait_for_timeout(300)
    return pg

EMPTY = {"tool": None, "armor": None, "module": None}
# An old item from before affixes existed: no "affixes" or "set" fields
OLD_ITEM = {"id": 1, "name": "Rare Port Scanner", "tier": "rare", "slot": "tool", "icon": "port-scanner",
            "stat": "damage", "value": 17, "level": 4, "effect": None, "effectText": None}
SAVE = {"level": 10, "xp": 0, "classId": "defender", "clearedZones": [], "nextItemId": 20, "tree": {},
        "inventory": [OLD_ITEM], "equipped": {"tool": 1, "armor": None, "module": None}}

try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = page(b, SAVE)

        # Rolling: affix counts per tier, no repeats, names, numbers in range
        rolls = pg.evaluate("""() => {
            const result = {};
            lootTable.tiers.forEach(tier => {
                const items = [];
                for (let i = 0; i < 150; i++) items.push(makeItem(tier, 5));
                result[tier.id] = items;
            });
            return result; }""")
        affixes = {a["id"]: a for a in pg.evaluate("lootTable.affixes")}
        expected = {"common": 0, "uncommon": 1, "rare": 2, "epic": 3, "legendary": 0}
        for tier_id, count in expected.items():
            counts = {len(i["affixes"]) for i in rolls[tier_id]}
            check(f"{tier_id} rolls {count} affixes", counts == {count}, counts)
        all_rolled = [i for items in rolls.values() for i in items]
        check("no item repeats an affix", all(len({a["id"] for a in i["affixes"]}) == len(i["affixes"]) for i in all_rolled))
        in_range = all(affixes[a["id"]]["stats"][s][0] <= v <= affixes[a["id"]]["stats"][s][1]
                       for i in all_rolled for a in i["affixes"] for s, v in a["stats"].items())
        check("rolled numbers stay in their ranges", in_range)
        low_tier_ids = {a["id"] for i in rolls["uncommon"] for a in i["affixes"]}
        check("risky and Sandboxed never on Uncommon", not (low_tier_ids & {"unpatched", "legacy", "shadow-it", "sandboxed"}), low_tier_ids)
        rare_ids = {a["id"] for t in ("rare", "epic") for i in rolls[t] for a in i["affixes"]}
        check("risky affixes do show up on Rare+", rare_ids & {"unpatched", "legacy", "shadow-it"} != set(), len(rare_ids))
        epic = rolls["epic"][0]
        prefix = next((affixes[a["id"]]["name"] for a in epic["affixes"] if affixes[a["id"]]["kind"] == "prefix"), "")
        suffix = next((affixes[a["id"]]["name"] for a in epic["affixes"] if affixes[a["id"]]["kind"] == "suffix"), "")
        check("name: tier, first prefix, base, first suffix", epic["name"].startswith("Epic ") and prefix in epic["name"] and epic["name"].endswith(suffix), epic["name"])
        check("legendary names stay plain", all(i["name"] in ("Insight Lens", "Failover Core", "Elimination Engine") for i in rolls["legendary"]))

        # Affix effects: a tool with Salted +5% damage and of Reconnaissance 6% crit,
        # armor with Unpatched (+12% damage, enemies hit 5% more) and of Redundancy +10 health
        tool = item(2, "rare", "tool", "port-scanner", "Rare Salted Port Scanner of Reconnaissance", 5, "damage", 17,
                    [{"id": "salted", "stats": {"damage": 5}}, {"id": "reconnaissance", "stats": {"critChance": 6}}])
        armor = item(3, "rare", "armor", "hardened-kernel", "Rare Unpatched Hardened Kernel of Redundancy", 5, "hp", 30,
                     [{"id": "unpatched", "stats": {"damage": 12, "dodge": -5}}, {"id": "redundancy", "stats": {"hp": 10}}])
        too_high = item(4, "epic", "module", "cache-module", "Epic Signed Cache Module", 99, "time", 14,
                        [{"id": "signed", "stats": {"xp": 8}}])
        pg.evaluate(f"save.inventory.push({json.dumps(tool)}, {json.dumps(armor)}, {json.dumps(too_high)})")
        pg.click("#zone-list button >> nth=0"); pg.wait_for_timeout(200)
        skill = "zoneSkills()[0]"
        before = pg.evaluate(f"[skillDamage({skill}), enemyHitChance(), playerMaxHp()]")
        pg.evaluate("save.equipped = { tool: 2, armor: 3, module: 4 }")
        after = pg.evaluate(f"[skillDamage({skill}), enemyHitChance(), playerMaxHp()]")
        check("affix damage adds up (5 + 12)", pg.evaluate("specialBonus('damage')") == 17)
        check("affix crit chance counts", pg.evaluate("specialBonus('critChance')") == 6)
        check("risky downside: enemies hit 5% more", round(after[1] - before[1], 3) == 0.05, f"{before[1]} -> {after[1]}")
        check("affix health counts", after[2] - before[2] == 10 + 30, f"{before[2]} -> {after[2]}")
        check("gear above your level adds no affixes", pg.evaluate("specialBonus('xp')") == 0)
        check("skill damage goes up", after[0] > before[0], f"{before[0]} -> {after[0]}")

        # Gear screen: affixes listed with what they mean; the old item still works
        pg.evaluate("showGear()"); pg.wait_for_timeout(200)
        text = pg.inner_text("#gear-list")
        check("gear screen lists affixes", "Salted: +5% skill damage" in text and "Salting:" in text, text[:200])
        check("risky affix text flips the sign", "Unpatched: +12% skill damage, but enemies hit 5% more often" in text)
        check("old item without affixes shows fine", "Rare Port Scanner" in text)
        pg.screenshot(path="affixes_gear.png")

        # Sets: CIA Triad pieces turn on bonuses at 2 and 3
        cia = [item(10 + i, "epic", slot, icon, name, 5, stat, 30, None, "cia-triad")
               for i, (slot, icon, name, stat) in enumerate([("tool", "hex-editor", "Confidentiality Cipher", "damage"),
                                                              ("armor", "firewall-plating", "Integrity Plate", "hp"),
                                                              ("module", "cache-module", "Availability Core", "time")])]
        pg.evaluate(f"save.inventory.push(...{json.dumps(cia)}); save.equipped = {{ tool: 10, armor: null, module: null }}")
        check("1 piece: no bonus", pg.evaluate("specialBonus('damage')") == 0)
        pg.evaluate("save.equipped.armor = 11")
        check("2 pieces: +10% damage", pg.evaluate("specialBonus('damage')") == 10)
        hp2 = pg.evaluate("playerMaxHp()")
        pg.evaluate("save.equipped.module = 12")
        check("3 pieces: +15% damage and +10% health", pg.evaluate("[specialBonus('damage'), specialBonus('hpPercent'), specialBonus('time')]") == [15, 10, 5])
        check("3 pieces raise max health", pg.evaluate("playerMaxHp()") > hp2)
        pg.evaluate("showGear()"); pg.wait_for_timeout(200)
        check("gear screen shows set 3/3", "Set: CIA Triad (3/3 worn)" in pg.inner_text("#gear-list"))
        check("both set bonuses lit", pg.locator("#gear-list small.set-bonus.active").count() == 6)  # 2 bonuses x 3 pieces
        check("summary lists set bonuses", "Set bonuses on" in pg.inner_text("#gear-summary"))
        check("set pieces use the set color", pg.evaluate("itemColor(findItem(10))") == pg.evaluate("lootTable.setColor"))
        pg.screenshot(path="affixes_set.png")

        # Zero Trust 3 pieces: the first enemy hit each fight is blocked
        zt = [item(30 + i, "epic", slot, "port-scanner", "x", 5, "damage", 1, None, "zero-trust-architecture") for i, slot in enumerate(["tool", "armor", "module"])]
        pg.evaluate(f"save.inventory.push(...{json.dumps(zt)}); save.equipped = {{ tool: 30, armor: 31, module: 32 }}")
        pg.evaluate("enterZone(zones[0])"); pg.wait_for_timeout(100)
        check("Zero Trust set blocks a hit", pg.evaluate("ascFight.blocksLeft") == 1)

        # Set drops: Foundry drops the CIA Triad; PKI only from a finale boss
        pg.evaluate("save.equipped = { tool: null, armor: null, module: null }; enterZone(zones[0])")
        pg.evaluate("Math.random = () => 0")  # every roll succeeds
        check("Foundry enemy drops CIA Triad", pg.evaluate("rollSetDrop().id") == "cia-triad")
        finale = pg.evaluate("""() => { const area = areas[0]; const zone = area.zones[area.zones.length - 1];
            enterZone(zone); enemyIndex = zone.enemies.length - 1; startFight();
            return [isFinaleBoss(), lootTable.sets.filter(s => s.area === area.id || (s.area === 'finale' && isFinaleBoss())).map(s => s.id)]; }""")
        check("finale boss can drop PKI too", finale[0] and sorted(finale[1]) == ["cia-triad", "pki-chain"], finale)
        drop = pg.evaluate("rollDrop()")
        made = drop["item"]
        check("drop became a set piece", made["set"] in ("cia-triad", "pki-chain") and made["tier"] == "epic" and made["affixes"] == [], made)
        check("set piece is Epic level + 2", made["level"] == pg.evaluate("currentZone.level") + 2, made["level"])
        pg.evaluate(f"setLootMessage({json.dumps(drop)})")
        check("loot message says set item", "LOOT: Set item:" in pg.inner_text("#loot-message"), pg.inner_text("#loot-message")[:80])
        check("loot message shows the set", "Set:" in pg.inner_text("#loot-message small.loot-extras"))
        not_finale = pg.evaluate("enterZone(zones[0]); isFinaleBoss()")
        check("first zone's enemy isn't a finale boss", not not_finale)
        b.close()
finally: srv.terminate()
print("missing images:", missing or "none"); print("page errors:", errors or "none")
print("ALL PASSED" if not failures and not errors and not missing else f"FAILED: {failures}")
