"""Checks Ascension: locked until the first finale boss, 1 point per finale, choosing 1 of 2 ascendancies,
tier and capstone rules, free reset, class switch, and the special effects in real fights.

Run from anywhere:  python tests/ascension.py
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
srv = subprocess.Popen([sys.executable, "-m", "http.server", "8782", "-d", sys.argv[1]], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1); errors = []; failures = []

def check(label, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + label + (f"  ({detail})" if detail else ""))
    if not ok:
        failures.append(label)

def fresh(b, save, mode="learner", size=(1280, 720)):
    ctx = b.new_context(viewport={"width": size[0], "height": size[1]}); pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.add_init_script(f"localStorage.setItem('secplus-rpg-save', {json.dumps(json.dumps(save))})")
    pg.goto("http://localhost:8782/"); pg.wait_for_selector("#mode-panel:not([hidden])"); pg.click(f"button[data-mode={mode}]")
    return pg

def answer(pg, right):
    t = pg.inner_text("#question-text")
    idx = pg.evaluate("t => questions.find(q => q.question === t).answer", t)
    pg.click(f"#choices button >> nth={idx if right else (idx + 1) % 4}"); pg.wait_for_function("!turnInProgress")

def node(pg, node_id):
    return pg.locator(f".ascension-node[data-node='{node_id}']")

def take(pg, node_id):
    node(pg, node_id).click(); pg.click("#ascension-take-button")

def fight(pg, save_extra):
    # Start the first zone with the given ascension already set in the save
    pg.evaluate(f"Object.assign(save, {json.dumps(save_extra)})")
    pg.evaluate("showMap()"); pg.click("#zone-list button >> nth=0")

try:
    with sync_playwright() as p:
        b = p.chromium.launch()

        # Work out which zones clear which areas, from the game itself
        pg = fresh(b, {"level": 5, "classId": "analyst"})
        area_zones = pg.evaluate("areas.map(a => a.zones.map(z => z.id))")
        foundry = area_zones[0]
        everything = [z for zones in area_zones for z in zones]

        # No finale beaten: the circle is locked
        pg.click("#tree-button")
        check("emblem locked with 0 points", pg.is_disabled("#ascension-button") and "Locked" in pg.inner_text("#ascension-button"))
        check("locked note says how to unlock", "need an Ascension point to unlock" in pg.inner_text("#ascension-note"), pg.inner_text("#ascension-note"))

        # The Foundry's finale beaten: 1 point, unlocked
        pg = fresh(b, {"level": 12, "classId": "cryptographer", "clearedZones": foundry})
        check("map button shows the ascension point", "1 ascension" in pg.inner_text("#tree-button"), pg.inner_text("#tree-button"))
        pg.click("#tree-button")
        check("emblem unlocked after the first point", not pg.is_disabled("#ascension-button") and "Choose" in pg.inner_text("#ascension-button"))
        pg.click("#ascension-button")
        names = [x.inner_text().split("\n")[0] for x in pg.query_selector_all(".ascendancy-choice")]
        check("Cryptographer chooses between 2 ascendancies", names == ["Cipher Master", "PKI Warden"], str(names))
        check("reset disabled before choosing", pg.is_disabled("#ascension-reset-button"))
        pg.click(".ascendancy-choice >> nth=0")
        check("circle shows 8 nodes", pg.locator(".ascension-node").count() == 8)
        check("save remembers the choice", pg.evaluate("save.ascendancy") == "cipher-master")
        node(pg, "forward-secrecy").click()
        check("tier 2 starts closed", "spend 2 points" in pg.inner_text("#ascension-take-button"))
        hp_before = pg.evaluate("playerMaxHp()")
        take(pg, "key-rotation")
        check("Key Rotation: +25 max health", pg.evaluate("playerMaxHp()") == hp_before + 25)
        node(pg, "salting").click()
        check("out of points after 1", "no Ascension points left" in pg.inner_text("#ascension-take-button"))
        pg.screenshot(path="ascension_circle.png")
        pg.click("#ascension-back-button")
        check("back goes to the skill tree", pg.is_visible("#tree-panel") and "Cipher Master" in pg.inner_text("#ascension-button"))

        # All 5 finales: tiers open at 2 and 4 points, only one capstone
        pg = fresh(b, {"level": 34, "classId": "defender", "clearedZones": everything})
        pg.click("#tree-button"); pg.click("#ascension-button"); pg.click(".ascendancy-choice >> nth=1")
        check("Defender's second choice is Firewall Architect", pg.evaluate("save.ascendancy") == "firewall-architect")
        take(pg, "implicit-deny"); take(pg, "port-security")
        node(pg, "next-gen-firewall").click()
        check("capstones closed at 2 points", "spend 4 points" in pg.inner_text("#ascension-take-button"))
        take(pg, "stateful-inspection"); take(pg, "ingress-filtering")
        take(pg, "air-gap")
        node(pg, "next-gen-firewall").click()
        check("only one capstone", "only one capstone" in pg.inner_text("#ascension-take-button"))
        check("5 points spent", pg.evaluate("ascensionPointsSpent()") == 5 and pg.evaluate("ascensionPointsLeft()") == 0)
        pg.screenshot(path="ascension_full.png")
        level = pg.evaluate("save.level")
        pg.once("dialog", lambda d: d.accept()); pg.click("#ascension-reset-button")
        check("reset is free (no level lost)", pg.evaluate("save.level") == level)
        check("reset clears the choice", pg.evaluate("save.ascendancy") is None and pg.evaluate("JSON.stringify(save.ascension)") == "{}")

        # Switching class clears ascension
        pg.click(".ascendancy-choice >> nth=0"); take(pg, "hardened-perimeter")
        pg.evaluate("showMap()"); pg.click("#change-class-button")
        pg.once("dialog", lambda d: d.accept()); pg.click("#class-list button >> nth=1")
        check("switching class clears ascension", pg.evaluate("save.ascendancy") is None)

        # ---- Effects in real fights (nodes set straight in the save) ----
        pg = fresh(b, {"level": 34, "classId": "defender", "clearedZones": everything})
        pg.evaluate("enemyHitChance = () => 1")  # every enemy attack lands
        fight(pg, {"ascendancy": "blue-team-lead", "ascension": {"preventive-control": 1}})
        hp = pg.evaluate("player.hp")
        pg.click("#skills button >> nth=0"); answer(pg, False)
        check("Preventive Control blocks the first hit", pg.evaluate("player.hp") == hp and "blocked" in pg.inner_text("#battle-log"),
              pg.inner_text("#battle-log"))
        pg.click("#next-button"); pg.click("#skills button >> nth=0"); answer(pg, False)
        check("...but only the first", pg.evaluate("player.hp") < hp)

        fight(pg, {"ascendancy": "firewall-architect", "ascension": {"stateful-inspection": 1}})
        enemy_hp = pg.evaluate("enemy.hp")
        pg.click("#skills button >> nth=0"); answer(pg, False)
        check("Stateful Inspection hurts the attacker", pg.evaluate("enemy.hp") < enemy_hp, pg.inner_text("#battle-log"))

        fight(pg, {"ascendancy": "blue-team-lead", "ascension": {"fail-safe": 1}})
        pg.evaluate("player.hp = 1")
        pg.click("#skills button >> nth=0"); answer(pg, False)
        check("Fail-Safe survives a killing blow at 1 health", pg.evaluate("player.hp") == 1, pg.inner_text("#battle-log"))

        fight(pg, {"ascendancy": "blue-team-lead", "ascension": {"rate-limiting": 1}})
        pg.evaluate("player.hp = player.maxHp; currentMode.enemyDamage = 10000")  # a huge hit
        pg.click("#skills button >> nth=0"); answer(pg, False)
        lost = pg.evaluate("player.maxHp - player.hp"); cap = pg.evaluate("Math.round(player.maxHp * 0.25)")
        check("Rate Limiting caps a hit at 25% of max health", lost <= cap, f"lost {lost}, cap {cap}")
        pg.evaluate("currentMode = MODES.learner; currentMode.enemyDamage = 15")

        pg = fresh(b, {"level": 34, "classId": "analyst", "clearedZones": everything})
        pg.evaluate("enemyHitChance = () => 0")  # enemies never hit, so fights last
        fight(pg, {"ascendancy": "threat-hunter", "ascension": {"soar-playbook": 1}})
        enemy_hp = pg.evaluate("enemy.hp")
        pg.click("#skills button >> nth=0"); answer(pg, False)
        check("SOAR Playbook: a wrong answer still deals damage", pg.evaluate("enemy.hp") < enemy_hp, pg.inner_text("#battle-log"))

        fight(pg, {"ascendancy": "forensic-investigator", "ascension": {"expert-witness": 1}})
        pg.click("#skills button >> nth=0")
        check("Expert Witness crosses out a wrong answer", pg.locator("#choices button.eliminated").count() == 1)

        fight(pg, {"ascendancy": "threat-hunter", "ascension": {"threat-feed": 1}})
        first = pg.evaluate("skillDamage(zoneSkills()[0])")
        pg.click("#skills button >> nth=0"); answer(pg, True); pg.click("#next-button")
        second = pg.evaluate("skillDamage(zoneSkills()[0])")
        check("Threat Feed: a streak raises damage", second > first, f"{first} -> {second}")

        pg = fresh(b, {"level": 34, "classId": "cryptographer", "clearedZones": everything})
        pg.evaluate("enemyHitChance = () => 0")
        fight(pg, {"ascendancy": "cipher-master", "ascension": {"one-time-pad": 1}})
        pg.evaluate("enemy.maxHp = enemy.hp = 999999")  # make sure the enemy lasts 4 hits
        crit_turns = []
        for turn in range(1, 5):
            pg.click("#skills button >> nth=0"); answer(pg, True)
            if "Critical hit!" in pg.inner_text("#battle-log"):
                crit_turns.append(turn)
            pg.click("#next-button")
        check("One-Time Pad: exactly the 4th right answer crits", crit_turns == [4], f"crits on turns {crit_turns}")

        # The finale message announces the point, only on the first clear
        msg = pg.evaluate("(() => { currentZone = areas[0].zones[areas[0].zones.length - 1]; return clearedZoneMessage(areas[0], true); })()")
        check("finale gives +1 Ascension point message", "+1 Ascension point" in msg)
        msg = pg.evaluate("clearedZoneMessage(areas[0], false)")
        check("no point message on a replay", "Ascension point" not in msg)

        # Phone: the circle fits the screen width
        ph = fresh(b, {"level": 12, "classId": "analyst", "clearedZones": everything, "ascendancy": "threat-hunter",
                       "ascension": {"triage": 1}}, mode="fun", size=(390, 844))
        ph.click("#tree-button")
        ph.screenshot(path="ascension_emblem_phone.png")
        ph.click("#ascension-button")
        check("no sideways scrolling on a phone", ph.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
        ph.screenshot(path="ascension_phone.png")
        b.close()
finally: srv.terminate()
print("\npage errors:", errors)
print("ALL PASSED" if not failures and not errors else f"{len(failures)} FAILED")
